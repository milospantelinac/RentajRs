import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';
import { Prisma, Subscription, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../common/cache/cache.service';
import { ListingsService } from '../listings/listings.service';
import { LISTING_COUNTS_CACHE_KEY, TaxonomyService } from '../taxonomy/taxonomy.service';
import { NestPayCheckoutService } from '../../common/payment/nestpay/nestpay-checkout.service';
import { FiscalizationProvider } from '../../common/fiscalization/fiscalization-provider.interface';
import { paraToRsd, rsdToPara } from '../../common/utils/money';
import { LISTING_CARD_INCLUDE, loadListingCardNames, serializeListingCard } from '../../common/utils/listing-card';
import {
  DAY_MS,
  PACKAGE_ENDING_WITHOUT_RENEWAL,
  RENEWABLE_SUBSCRIPTION_STATUSES,
  addDays,
  cycleLength,
  isRunningPeriod,
} from '../../common/utils/subscription-renewal';
import { PurchaseSubscriptionDto, AdjustPriceDto, InitCheckoutDto } from './dto/subscriptions.dto';

type RenewalBlock = 'NOT_RENEWABLE' | 'NO_LISTINGS' | 'ALREADY_RENEWED';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);
  private featuredExpiryCheckedUntil: Date | null = null;

  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
    private listings: ListingsService,
    private taxonomy: TaxonomyService,
    private nestpay: NestPayCheckoutService,
    private fiscalization: FiscalizationProvider,
    private i18n: I18nService,
    private events: EventEmitter2,
    private config: ConfigService,
  ) {}

  // -- Packages --------------------------------------------------------

  async listPackages() {
    return this.cache.getOrSet('subscriptions:packages', 300, async () => {
      const packages = await this.prisma.package.findMany({ where: { active: true }, orderBy: { displayOrder: 'asc' } });
      return packages.map((p) => ({
        ...p,
        priceMonthly: paraToRsd(p.priceMonthly),
        priceYearly: paraToRsd(p.priceYearly),
      }));
    });
  }

  // -- Purchase / attach --------------------------------------------------

  /**
   * Korak 11 of the listing wizard for a DRAFT/REJECTED listing — the moment
   * a subscription actually gets attached to it. Also doubles as the *free*
   * upgrade path for an already-ACTIVE listing (dto.existingSubscriptionId):
   * attaching it to an existing Pro subscription with room, which is the
   * one reachable trigger for ADR-005's banked-days transfer that doesn't
   * involve a real charge. A paid upgrade (buying a brand-new package for an
   * ACTIVE listing) goes through NestPay checkout instead — see
   * initCheckout()/handleNestPaySuccess() below — so this method never
   * charges a card for a listing that's already live.
   */
  async purchaseForListing(userId: string, dto: PurchaseSubscriptionDto) {
    const listing = await this.prisma.listing.findUniqueOrThrow({ where: { id: dto.listingId } });
    if (listing.userId !== userId) throw new ForbiddenException();
    assertCategoryAssigned(listing, this.i18n);

    const wasActive = listing.status === 'ACTIVE';
    const eligibleStatuses = dto.existingSubscriptionId ? ['DRAFT', 'REJECTED', 'ACTIVE'] : ['DRAFT', 'REJECTED'];
    if (!eligibleStatuses.includes(listing.status)) {
      throw new BadRequestException('Listing is not eligible for this package change');
    }

    const previousSubscription = listing.subscriptionId
      ? await this.prisma.subscription.findUnique({ where: { id: listing.subscriptionId }, include: { package: true } })
      : null;

    let subscription: Subscription;
    if (dto.existingSubscriptionId) {
      subscription = await this.attachToExistingSubscription(userId, dto.existingSubscriptionId);
    } else {
      if (!dto.packageId || !dto.billingCycle) {
        throw new BadRequestException('packageId and billingCycle are required to buy a new subscription');
      }
      await this.assertPackageCompatibleWithListing(listing.id, dto.packageId);
      subscription = await this.createProFormaSubscription(userId, dto.packageId, dto.billingCycle);
    }

    // ADR-005: moving to Pro banks whatever's left on the old package rather than losing it.
    const newPackage = await this.prisma.package.findUniqueOrThrow({ where: { id: subscription.packageId } });
    if (previousSubscription && previousSubscription.package.key !== 'PRO' && newPackage.key === 'PRO') {
      await this.bankRemainingDays(listing.id, previousSubscription);
    }

    if (wasActive) {
      // Already live — just repoint it at the new subscription, no re-approval detour.
      await this.prisma.listing.update({ where: { id: listing.id }, data: { subscriptionId: subscription.id } });
      this.events.emit('subscription.listing_attached', { listingId: listing.id, subscriptionId: subscription.id });
      return { listing: await this.listings.getOwned(userId, listing.id), subscription: this.serialize(subscription) };
    }

    const updatedListing = await this.listings.markPendingApproval(listing.id, subscription.id);
    return { listing: updatedListing, subscription: this.serialize(subscription) };
  }

  /** Ch.3 §10 — Osnovni/BASIC can't be picked for a listing whose model actually needs the booking system. */
  private async assertPackageCompatibleWithListing(listingId: string, packageId: string) {
    const [listing, pkg] = await Promise.all([
      this.prisma.listing.findUniqueOrThrow({ where: { id: listingId } }),
      this.prisma.package.findUniqueOrThrow({ where: { id: packageId } }),
    ]);
    if (listing.bookingModel !== 'NO_BOOKING' && !pkg.hasBookings) {
      throw new BadRequestException(this.i18n.t('errors.PACKAGE_INCOMPATIBLE_BOOKING_MODEL'));
    }
  }

  private async attachToExistingSubscription(userId: string, subscriptionId: string): Promise<Subscription> {
    const subscription = await this.prisma.subscription.findUniqueOrThrow({
      where: { id: subscriptionId },
      include: { package: true, listings: true },
    });
    if (subscription.userId !== userId) throw new ForbiddenException();
    if (subscription.package.key !== 'PRO') {
      throw new BadRequestException('Only Pro subscriptions can cover more than one listing');
    }
    if (subscription.status !== 'ACTIVE') {
      throw new BadRequestException('Subscription is not active');
    }
    const activeListingCount = subscription.listings.filter((l) => l.status !== 'DELETED').length;
    if (activeListingCount >= subscription.package.listingLimit) {
      throw new BadRequestException(this.i18n.t('errors.SUBSCRIPTION_LISTING_LIMIT'));
    }
    return subscription;
  }

  private async createProFormaSubscription(userId: string, packageId: string, billingCycle: 'MONTHLY' | 'YEARLY') {
    const pkg = await this.prisma.package.findUniqueOrThrow({ where: { id: packageId } });
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    // A person pays through the NestPay checkout (initCheckout). This path
    // "charged" the card through the mock provider, which always succeeds, so
    // calling it directly bought any package for free. Only a company's
    // pro-forma stays: nothing goes live until an admin sees the transfer.
    if (user.buyerType !== 'COMPANY') {
      throw new BadRequestException(this.i18n.t('errors.PACKAGE_CHECKOUT_REQUIRED'));
    }
    const price = billingCycle === 'YEARLY' ? pkg.priceYearly : pkg.priceMonthly;

    const subscription = await this.prisma.subscription.create({
      data: {
        userId,
        packageId,
        billingCycle,
        status: 'PENDING_ACTIVATION',
        priceAtPurchase: price,
      },
    });

    // R109/Ch.11.4 — pro-forma invoice, admin activates manually once the transfer clears.
    const transaction = await this.prisma.transaction.create({
      data: { userId, subscriptionId: subscription.id, amount: price, status: 'INITIATED', type: 'SUBSCRIPTION' },
    });
    const doc = await this.fiscalization.issueDocument({
      documentType: 'PRO_FORMA',
      amountRsd: paraToRsd(price) ?? 0,
      buyerName: user.companyName ?? `${user.firstName} ${user.lastName}`,
      buyerTaxId: user.taxId ?? undefined,
      description: `Rentaj — ${pkg.key} (${billingCycle})`,
    });
    await this.prisma.invoice.create({
      data: {
        transactionId: transaction.id,
        userId,
        documentType: 'PRO_FORMA',
        documentNumber: doc.documentNumber,
        amount: price,
        externalId: doc.externalId,
      },
    });
    this.events.emit('subscription.pro_forma_issued', { userId, subscriptionId: subscription.id });
    return subscription;
  }

  // -- Checkout (Banca Intesa NestPay "3D Pay Hosting") -------------------

  /**
   * Starts a real-money checkout: creates the Subscription in
   * AWAITING_PAYMENT (its id doubles as NestPay's `oid`, so the callback can
   * find it again) and returns the hidden-form fields the frontend posts to
   * NestPay's hosted payment page. Nothing about the listing changes yet —
   * that only happens once handleNestPaySuccess() verifies real payment.
   */
  async initCheckout(userId: string, dto: InitCheckoutDto) {
    const listing = await this.prisma.listing.findUniqueOrThrow({ where: { id: dto.listingId } });
    if (listing.userId !== userId) throw new ForbiddenException();
    assertCategoryAssigned(listing, this.i18n);
    // A renewal pays for the next period of a package the listing is already on;
    // everything else is a first package or a move to Pro.
    const renewed = dto.renewSubscriptionId ? await this.assertRenewable(userId, dto) : null;
    if (renewed) return this.startCheckout(userId, dto, renewed.id);

    // ACTIVE is allowed too: this is also the paid path for upgrading an
    // already-live listing to Pro (ADR-005); handleNestPaySuccess branches on
    // the listing's status to tell a fresh publish from an upgrade.
    if (!['DRAFT', 'REJECTED', 'ACTIVE'].includes(listing.status)) {
      throw new BadRequestException(this.i18n.t('errors.LISTING_PACKAGE_PURCHASE_NOT_ALLOWED'));
    }
    // R126's email-verified gate ultimately lives in ListingsService.markPendingApproval
    // (the actual DRAFT/REJECTED -> PENDING_APPROVAL transition, also reached from admin
    // activation), but checking only there means an unverified owner discovers this after
    // NestPay has already charged their card. Re-check it here too, before checkout even
    // starts, for the fresh-publish path — ACTIVE-listing upgrades skip it, since a listing
    // can't have gone ACTIVE in the first place without already clearing this gate once.
    if (listing.status !== 'ACTIVE') {
      const owner = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
      if (!owner.emailVerified) {
        throw new ForbiddenException(this.i18n.t('errors.EMAIL_NOT_VERIFIED'));
      }
    }
    await this.assertPackageCompatibleWithListing(listing.id, dto.packageId);
    if (listing.status === 'ACTIVE') await this.assertUpgradeToPro(listing.subscriptionId, dto.packageId);
    return this.startCheckout(userId, dto, null);
  }

  /** Saves the buyer's details, opens the AWAITING_PAYMENT subscription and builds NestPay's form. */
  private async startCheckout(userId: string, dto: InitCheckoutDto, renewsSubscriptionId: string | null) {
    const pkg = await this.prisma.package.findUniqueOrThrow({ where: { id: dto.packageId } });
    const price = dto.billingCycle === 'YEARLY' ? pkg.priceYearly : pkg.priceMonthly;

    // Save billing details to the profile too — the whole point of asking is
    // to not have to ask again next time (Task 1's explicit UX goal).
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        phone: dto.phone || undefined,
        buyerType: dto.isCompany ? 'COMPANY' : 'PERSON',
        ...(dto.isCompany
          ? {
              companyName: dto.companyName || undefined,
              taxId: dto.taxId || undefined,
              registrationNumber: dto.registrationNumber || undefined,
              billingAddress: dto.companyAddress || undefined,
            }
          : {}),
      },
    });

    const subscription = await this.prisma.subscription.create({
      data: {
        userId,
        packageId: dto.packageId,
        billingCycle: dto.billingCycle,
        status: 'AWAITING_PAYMENT',
        priceAtPurchase: price,
        pendingListingId: dto.listingId,
        renewsSubscriptionId,
        termsAcceptedAt: new Date(), // dto.termsAccepted is already validated true (@IsIn([true]))
      },
    });

    const { actionUrl, fields } = await this.nestpay.buildCheckoutForm({
      oid: subscription.id,
      amountRsd: paraToRsd(price) ?? 0,
      billing: {
        email: dto.email,
        phone: dto.phone,
        firstName: dto.firstName,
        lastName: dto.lastName,
        isCompany: dto.isCompany,
        companyName: dto.companyName,
        companyAddress: dto.companyAddress,
      },
      description: `Rentaj — ${pkg.key} (${dto.billingCycle})`,
    });

    return { actionUrl, fields };
  }

  /**
   * A live listing buys a package here only to move up to Pro (ADR-005). Buying
   * its own package again started a second period at once and threw away the
   * days left on the first, so the next period is bought as a renewal instead.
   */
  private async assertUpgradeToPro(currentSubscriptionId: string | null, packageId: string) {
    const [pkg, current] = await Promise.all([
      this.prisma.package.findUniqueOrThrow({ where: { id: packageId } }),
      currentSubscriptionId
        ? this.prisma.subscription.findUnique({ where: { id: currentSubscriptionId }, include: { package: true } })
        : null,
    ]);
    if (pkg.key !== 'PRO' || current?.package.key === 'PRO') {
      throw new BadRequestException(this.i18n.t('errors.SUBSCRIPTION_UPGRADE_PRO_ONLY'));
    }
  }

  // -- Renewal ------------------------------------------------------------
  // Packages never renew by themselves (see processSubscriptionExpiry); the owner
  // pays for the next period of the same package. Bought while the package still
  // runs, the new period waits as SCHEDULED and takes the listings over when the
  // old one ends; bought after it ended, it starts at payment and the listings are
  // back in search at once, without a new review (they were approved before, and
  // edits to live listings aren't reviewed either). A Pro renewal carries every
  // listing on the package.

  /** What the renewal page shows: the package, the listings it carries and when the new period starts. */
  async getRenewal(userId: string, subscriptionId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        package: true,
        listings: {
          where: { status: { not: 'DELETED' } },
          orderBy: { createdAt: 'asc' },
          select: { id: true, title: true, status: true, city: { select: { name: true } }, cityArea: { select: { name: true } } },
        },
      },
    });
    if (!subscription || subscription.userId !== userId) {
      throw new NotFoundException(this.i18n.t('errors.SUBSCRIPTION_NOT_FOUND'));
    }
    const block = await this.getRenewalBlock(subscription);
    const { package: pkg } = subscription;
    return {
      id: subscription.id,
      status: subscription.status,
      billingCycle: subscription.billingCycle,
      expiresAt: subscription.expiresAt,
      package: {
        id: pkg.id,
        key: pkg.key,
        listingLimit: pkg.listingLimit,
        priceMonthly: paraToRsd(pkg.priceMonthly),
        priceYearly: paraToRsd(pkg.priceYearly),
      },
      listings: subscription.listings.map((listing) => ({
        id: listing.id,
        title: listing.title,
        status: listing.status,
        place: listing.cityArea?.name ?? listing.city?.name ?? null,
      })),
      renewable: !block,
      reason: block,
      // null: the new period starts when the payment goes through.
      startsAt: isRunningPeriod(subscription) ? subscription.expiresAt : null,
    };
  }

  private async getRenewalBlock(subscription: Subscription & { listings: { id: string }[] }): Promise<RenewalBlock | null> {
    if (!RENEWABLE_SUBSCRIPTION_STATUSES.includes(subscription.status)) return 'NOT_RENEWABLE';
    if (!subscription.listings.length) return 'NO_LISTINGS';
    const scheduled = await this.prisma.subscription.count({
      where: { renewsSubscriptionId: subscription.id, status: 'SCHEDULED' },
    });
    return scheduled ? 'ALREADY_RENEWED' : null;
  }

  private async assertRenewable(userId: string, dto: InitCheckoutDto) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: dto.renewSubscriptionId },
      include: { listings: { where: { status: { not: 'DELETED' } }, select: { id: true } } },
    });
    if (!subscription || subscription.userId !== userId) {
      throw new NotFoundException(this.i18n.t('errors.SUBSCRIPTION_NOT_FOUND'));
    }
    const block = await this.getRenewalBlock(subscription);
    if (block === 'ALREADY_RENEWED') throw new BadRequestException(this.i18n.t('errors.SUBSCRIPTION_ALREADY_RENEWED'));
    if (block || !subscription.listings.some((listing) => listing.id === dto.listingId)) {
      throw new BadRequestException(this.i18n.t('errors.SUBSCRIPTION_RENEWAL_NOT_ALLOWED'));
    }
    if (subscription.packageId !== dto.packageId) {
      throw new BadRequestException(this.i18n.t('errors.SUBSCRIPTION_RENEWAL_SAME_PACKAGE'));
    }
    for (const listing of subscription.listings) {
      await this.assertPackageCompatibleWithListing(listing.id, dto.packageId);
    }
    return subscription;
  }

  /** The last paid period in a chain of renewals, the one a new renewal continues. */
  private async findRenewalTail(subscription: Subscription): Promise<Subscription> {
    let tail = subscription;
    for (let depth = 0; depth < 100; depth++) {
      const next = await this.prisma.subscription.findFirst({
        where: { renewsSubscriptionId: tail.id, status: 'SCHEDULED' },
        orderBy: { startsAt: 'desc' },
      });
      if (!next) break;
      tail = next;
    }
    return tail;
  }

  /** Right after a renewal is paid: queue it behind the running period, or start it and bring the listings back. */
  private async completeRenewal(renewal: Subscription): Promise<'scheduled' | 'active'> {
    const renewed = await this.prisma.subscription.findUniqueOrThrow({ where: { id: renewal.renewsSubscriptionId! } });
    const days = cycleLength(renewal.billingCycle);
    // Two checkouts paid for the same package line up one after the other.
    const tail = await this.findRenewalTail(renewed);

    if (isRunningPeriod(tail)) {
      await this.prisma.subscription.update({
        where: { id: renewal.id },
        data: {
          status: 'SCHEDULED',
          startsAt: tail.expiresAt,
          expiresAt: addDays(tail.expiresAt!, days),
          renewsSubscriptionId: tail.id,
          pendingListingId: null,
        },
      });
      return 'scheduled';
    }

    const now = new Date();
    await this.prisma.subscription.update({
      where: { id: renewal.id },
      data: { status: 'ACTIVE', startsAt: now, expiresAt: addDays(now, days), pendingListingId: null },
    });
    if (renewed.status === 'ACTIVE') {
      // Past its end; the nightly sweep just hasn't reached it yet.
      await this.prisma.subscription.update({ where: { id: renewed.id }, data: { status: 'EXPIRED' } });
    }
    await this.handOverListings(renewed.id, renewal.id, { reactivate: true });
    return 'active';
  }

  /**
   * Moves a package's listings onto the subscription that continues it. After a
   * gap (reactivate) the expired ones are back in search, and days carried over
   * from an earlier package that were already running are kept for later.
   */
  private async handOverListings(fromId: string, toId: string, { reactivate }: { reactivate: boolean }) {
    const listings = await this.prisma.listing.findMany({
      where: { subscriptionId: fromId, status: { not: 'DELETED' } },
      select: { id: true, status: true, publishedAt: true },
    });
    for (const listing of listings) {
      if (reactivate) await this.rebankRunningDays(listing.id);
      const approvedBefore = !!listing.publishedAt;
      await this.prisma.listing.update({
        where: { id: listing.id },
        data: {
          subscriptionId: toId,
          ...(reactivate && listing.status === 'EXPIRED' && approvedBefore ? { status: 'ACTIVE' } : {}),
        },
      });
      if (reactivate && listing.status === 'EXPIRED' && !approvedBefore) {
        // The sweep also expires listings still waiting for their first review;
        // those go back to review rather than straight into search.
        try {
          await this.listings.markPendingApproval(listing.id, toId);
        } catch (err) {
          this.logger.warn(`Renewed listing ${listing.id} could not go back to review: ${(err as Error).message}`);
        }
      }
    }
    if (reactivate && listings.some((listing) => listing.status === 'EXPIRED')) {
      await this.cache.del(LISTING_COUNTS_CACHE_KEY);
    }
  }

  /**
   * ADR-005: carried-over days are never lost. expireOverdueSubscriptions starts
   * all of a listing's rows as one window; when a new period starts inside that
   * window, what is left of it goes back to waiting for the new period to end.
   */
  private async rebankRunningDays(listingId: string) {
    const now = new Date();
    const running = await this.prisma.bankedDay.findMany({
      where: { listingId, usedAt: null, validUntil: { not: null } },
    });
    if (!running.length) return;
    await this.prisma.bankedDay.updateMany({ where: { id: { in: running.map((row) => row.id) } }, data: { usedAt: now } });
    const until = Math.max(...running.map((row) => row.validUntil!.getTime()));
    const left = Math.ceil((until - now.getTime()) / DAY_MS);
    if (left > 0) {
      await this.prisma.bankedDay.create({ data: { listingId, days: left, originPackageId: running[0].originPackageId } });
    }
  }

  /** okUrl target — NestPay POSTs the payment result here after 3D authentication. */
  async handleNestPaySuccess(body: Record<string, string>) {
    const frontendUrl = this.config.get<string>('frontendUrl');
    const verification = await this.nestpay.verifyCallback(body);

    if (!verification.valid) {
      this.logger.error(`Rejected NestPay success callback: ${verification.reason} (oid=${verification.oid})`);
      return `${frontendUrl}/kontrolna-tabla/pretplate?payment=invalid`;
    }

    const subscription = await this.prisma.subscription.findUnique({ where: { id: verification.oid } });
    if (!subscription || subscription.status !== 'AWAITING_PAYMENT' || !subscription.pendingListingId) {
      // Already processed (duplicate callback / user refresh) or unknown oid — safe no-op.
      return `${frontendUrl}/kontrolna-tabla/pretplate?payment=unknown`;
    }
    const listingId = subscription.pendingListingId;

    if (!verification.approved) {
      await this.prisma.subscription.delete({ where: { id: subscription.id } });
      await this.prisma.transaction.create({
        data: {
          userId: subscription.userId,
          amount: subscription.priceAtPurchase,
          status: 'FAILED',
          type: 'SUBSCRIPTION',
          errorMessage: verification.errMsg || `ProcReturnCode ${verification.procReturnCode}`,
        },
      });
      this.emitCheckoutFailed(subscription, listingId);
      return `${frontendUrl}${paymentFailedPath(listingId, subscription.renewsSubscriptionId)}`;
    }

    await this.prisma.transaction.create({
      data: {
        userId: subscription.userId,
        subscriptionId: subscription.id,
        amount: subscription.priceAtPurchase,
        status: 'SUCCESSFUL',
        type: 'SUBSCRIPTION',
        bankExternalId: verification.transId,
      },
    });

    const listing = await this.prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
    const isRenewal = !!subscription.renewsSubscriptionId;
    let redirectPath: string;
    if (isRenewal) {
      const outcome = await this.completeRenewal(subscription);
      redirectPath = `/kontrolna-tabla/pretplate?renewed=${outcome}`;
    } else if (listing.status === 'ACTIVE') {
      // ADR-005 upgrade path: the listing is already live, so there's no
      // moderation step to gate this on — bank whatever's left on the old
      // subscription, attach the new one, and start its clock immediately.
      const previousSubscription = listing.subscriptionId
        ? await this.prisma.subscription.findUnique({ where: { id: listing.subscriptionId }, include: { package: true } })
        : null;
      const newPackage = await this.prisma.package.findUniqueOrThrow({ where: { id: subscription.packageId } });
      if (previousSubscription && previousSubscription.package.key !== 'PRO' && newPackage.key === 'PRO') {
        await this.bankRemainingDays(listingId, previousSubscription);
      }
      const cycleDays = subscription.billingCycle === 'YEARLY' ? 365 : 30;
      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'ACTIVE',
          startsAt: new Date(),
          expiresAt: new Date(Date.now() + cycleDays * 86_400_000),
          pendingListingId: null,
        },
      });
      await this.prisma.listing.update({ where: { id: listingId }, data: { subscriptionId: subscription.id } });
      this.events.emit('subscription.listing_attached', { listingId, subscriptionId: subscription.id });
      redirectPath = `/kontrolna-tabla/pretplate?upgraded=1`;
    } else {
      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'PENDING_ACTIVATION', pendingListingId: null },
      });
      // The payment already succeeded and is recorded above regardless of what
      // happens next — initCheckout() is meant to catch an unverified owner
      // before they ever get charged, but if this still throws (e.g. email got
      // unverified mid-flow), bounce to a normal frontend page instead of
      // letting the exception fall through to a raw JSON error response, same
      // as the invalid/unknown cases above.
      try {
        await this.listings.markPendingApproval(listingId, subscription.id);
        redirectPath = `/oglasi/${listingId}/poslato?subscriptionId=${subscription.id}`;
      } catch {
        redirectPath = `/kontrolna-tabla/pretplate?payment=verify-email`;
      }
    }

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: subscription.userId } });
    const pkg = await this.prisma.package.findUniqueOrThrow({ where: { id: subscription.packageId } });
    const transaction = await this.prisma.transaction.findFirstOrThrow({
      where: { subscriptionId: subscription.id, status: 'SUCCESSFUL' },
      orderBy: { occurredAt: 'desc' },
    });
    const doc = await this.fiscalization.issueDocument({
      documentType: 'FISCAL_RECEIPT',
      amountRsd: paraToRsd(subscription.priceAtPurchase) ?? 0,
      buyerName: user.buyerType === 'COMPANY' && user.companyName ? user.companyName : `${user.firstName} ${user.lastName}`,
      buyerTaxId: user.taxId ?? undefined,
      description: `Rentaj — ${pkg.key} (${subscription.billingCycle})`,
    });
    await this.prisma.invoice.create({
      data: {
        transactionId: transaction.id,
        userId: subscription.userId,
        documentType: 'FISCAL_RECEIPT',
        documentNumber: doc.documentNumber,
        amount: subscription.priceAtPurchase,
        externalId: doc.externalId,
      },
    });

    this.events.emit(isRenewal ? 'subscription.renewed' : 'subscription.purchased', {
      userId: subscription.userId,
      subscriptionId: subscription.id,
    });
    return `${frontendUrl}${redirectPath}`;
  }

  /** failUrl target — NestPay POSTs here when the customer's payment did not go through. */
  async handleNestPayFail(body: Record<string, string>) {
    const frontendUrl = this.config.get<string>('frontendUrl');
    const verification = await this.nestpay.verifyCallback(body);
    const subscription = verification.oid
      ? await this.prisma.subscription.findUnique({ where: { id: verification.oid } })
      : null;

    if (!subscription || subscription.status !== 'AWAITING_PAYMENT') {
      return `${frontendUrl}/kontrolna-tabla/pretplate?payment=failed`;
    }
    const listingId = subscription.pendingListingId;
    await this.prisma.transaction.create({
      data: {
        userId: subscription.userId,
        amount: subscription.priceAtPurchase,
        status: 'FAILED',
        type: 'SUBSCRIPTION',
        errorMessage: verification.errMsg || 'Payment declined',
      },
    });
    await this.prisma.subscription.delete({ where: { id: subscription.id } });

    if (!listingId) return `${frontendUrl}/kontrolna-tabla/pretplate?payment=failed`;
    this.emitCheckoutFailed(subscription, listingId);
    return `${frontendUrl}${paymentFailedPath(listingId, subscription.renewsSubscriptionId)}`;
  }

  /**
   * A card payment that was declined or given up on, whatever it was for (a first
   * package, a move to Pro, a renewal). The checkout's subscription row is deleted
   * by now, so the event carries what the email needs.
   */
  private emitCheckoutFailed(subscription: Subscription, listingId: string) {
    this.events.emit('subscription.checkout_failed', {
      userId: subscription.userId,
      packageId: subscription.packageId,
      amount: subscription.priceAtPurchase,
      listingId,
      renewsSubscriptionId: subscription.renewsSubscriptionId,
    });
  }

  private async bankRemainingDays(listingId: string, oldSubscription: Subscription & { package: { id: string } }) {
    if (!oldSubscription.expiresAt) return;
    const remainingMs = oldSubscription.expiresAt.getTime() - Date.now();
    const remainingDays = Math.ceil(remainingMs / 86_400_000);
    if (remainingDays <= 0) return;

    await this.prisma.bankedDay.create({
      data: { listingId, days: remainingDays, originPackageId: oldSubscription.package.id },
    });
    await this.prisma.subscription.update({ where: { id: oldSubscription.id }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
  }

  /** Fires when the listing's *first* approval happens — the subscription clock starts here, not at payment (R28). */
  @OnEvent('listing.approved')
  async activateForListingApproval({ listingId }: { listingId: string }) {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing?.subscriptionId) return;
    const subscription = await this.prisma.subscription.findUnique({ where: { id: listing.subscriptionId } });
    if (!subscription || subscription.status !== 'PENDING_ACTIVATION') return;

    const cycleDays = subscription.billingCycle === 'YEARLY' ? 365 : 30;
    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'ACTIVE', startsAt: new Date(), expiresAt: new Date(Date.now() + cycleDays * 86_400_000) },
    });
  }

  // -- Featured listings ---------------------------------------------

  // There is no owner purchase of a featured slot. It "charged" the card
  // through the mock provider, which always succeeds, so any owner could
  // feature a listing for free. Until a real checkout covers featured slots,
  // an admin grants them (adminAssignFreeFeatured).

  /**
   * Rotates equally among all currently-featured listings in the category (R114) — call on every page render, not stored order.
   * A public endpoint, so a listing goes out as the same card search shows,
   * never the whole row with its address and iCal export token, and only
   * while it is live.
   */
  async getRotatedFeatured(categoryId: string, limit = 6) {
    const featured = await this.prisma.featuredListing.findMany({
      where: { listing: { categoryId, status: 'ACTIVE' }, expiresAt: { gt: new Date() } },
      include: { listing: { include: LISTING_CARD_INCLUDE } },
    });
    const picked = shuffle(featured).slice(0, Math.min(Math.max(limit, 0), 24));
    const rows = picked.map((f) => f.listing);
    const { categoryNames, optionNames } = await loadListingCardNames(this.taxonomy, rows);
    return rows.map((row) => serializeListingCard(row, categoryNames, optionNames));
  }

  @Cron(CronExpression.EVERY_HOUR)
  async expireFeaturedAndNotifyWaitlist() {
    // Only the slots that ran out since the last run (after a restart, the
    // last hour): every expired row ever used to count again each hour and
    // notify another waiter.
    const now = new Date();
    const since = this.featuredExpiryCheckedUntil ?? new Date(now.getTime() - 60 * 60 * 1000);
    this.featuredExpiryCheckedUntil = now;
    const expired = await this.prisma.featuredListing.findMany({
      where: { expiresAt: { gte: since, lt: now } },
    });
    for (const item of expired) {
      const waiting = await this.prisma.featuredWaitlist.findFirst({
        where: { categoryId: (await this.prisma.listing.findUnique({ where: { id: item.listingId } }))?.categoryId, notifiedAt: null },
        orderBy: { requestedAt: 'asc' },
      });
      if (waiting) {
        await this.prisma.featuredWaitlist.update({ where: { id: waiting.id }, data: { notifiedAt: new Date() } });
        this.events.emit('subscriptions.featured_slot_available', { listingId: waiting.listingId });
      }
    }
  }

  // -- Admin -----------------------------------------------------------

  async adminActivateSubscription(adminId: string, subscriptionId: string) {
    const subscription = await this.prisma.subscription.findUniqueOrThrow({ where: { id: subscriptionId } });
    const transaction = await this.prisma.transaction.findFirst({ where: { subscriptionId, status: 'INITIATED' } });
    if (transaction) {
      await this.prisma.transaction.update({ where: { id: transaction.id }, data: { status: 'SUCCESSFUL' } });
    }
    // Normally the clock only starts once the listing itself is approved
    // (R28, see activateForListingApproval below) — but this button only
    // ever appears next to a PENDING_ACTIVATION row specifically so an admin
    // can force it through by hand (e.g. the automated approval event never
    // fired). It used to silently no-op whenever the listing wasn't ACTIVE
    // yet, so the click looked like it worked (200) but the row never
    // changed — a manual override that only worked when it wasn't needed.
    if (subscription.status === 'PENDING_ACTIVATION') {
      const cycleDays = subscription.billingCycle === 'YEARLY' ? 365 : 30;
      await this.prisma.subscription.update({
        where: { id: subscriptionId },
        data: { status: 'ACTIVE', startsAt: new Date(), expiresAt: new Date(Date.now() + cycleDays * 86_400_000) },
      });
    }
    void adminId;
    return { message: this.i18n.t('common.SUCCESS') };
  }

  /** R174 — a price change never touches subscriptions already sold (priceAtPurchase is locked at creation). */
  async adminUpdatePackagePrice(packageId: string, dto: AdjustPriceDto) {
    await this.prisma.package.update({
      where: { id: packageId },
      data: { priceMonthly: rsdToPara(dto.priceMonthlyRsd), priceYearly: rsdToPara(dto.priceYearlyRsd) },
    });
    await this.cache.del('subscriptions:packages');
    return { message: this.i18n.t('common.SUCCESS') };
  }

  // Featured-listing prices (P7/R116, no longer hardcoded — see
  // getFeaturedPriceTable() below) are edited like every other Setting, via
  // the generic /admin/podesavanja panel (key "featured_listing_prices").

  async getFeaturedPrices() {
    return this.getFeaturedPriceTable();
  }

  /** R145 — administrator can hand out a featured slot for free, bypassing payment entirely. */
  async adminAssignFreeFeatured(adminId: string, listingId: string, durationDays: 7 | 15 | 30) {
    const listing = await this.prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
    const featured = await this.prisma.featuredListing.create({
      data: {
        listingId: listing.id,
        durationDays,
        price: 0n,
        startsAt: new Date(),
        expiresAt: new Date(Date.now() + durationDays * 86_400_000),
        free: true,
        assignedByUserId: adminId,
      },
    });
    // A free grant resolves the listing's own place in the queue, if any.
    await this.prisma.featuredWaitlist.deleteMany({ where: { listingId: listing.id } });
    this.events.emit('subscriptions.featured_assigned_free', { listingId: listing.id, adminId });
    return { ...featured, price: paraToRsd(featured.price) };
  }

  /** Feeds the admin "assign free featured" list — the concrete, already-expressed demand (R114 waitlist). */
  async adminGetFeaturedWaitlist() {
    const entries = await this.prisma.featuredWaitlist.findMany({
      orderBy: { requestedAt: 'asc' },
      include: {
        listing: { select: { id: true, title: true, slug: true } },
        category: { select: { id: true, slug: true } },
      },
    });
    return entries;
  }

  async adminListSubscriptions(status?: SubscriptionStatus) {
    const subscriptions = await this.prisma.subscription.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, buyerType: true } },
        package: true,
        listings: { select: { id: true, title: true, slug: true, status: true } }, // no .price — see money.ts note below
      },
    });
    // Every BigInt (para) field must be converted before this crosses into JSON (Node's
    // JSON.stringify throws on BigInt) — package prices too, since `package: true` pulls them in.
    return subscriptions.map((s) => ({
      ...s,
      priceAtPurchase: paraToRsd(s.priceAtPurchase),
      package: { ...s.package, priceMonthly: paraToRsd(s.package.priceMonthly), priceYearly: paraToRsd(s.package.priceYearly) },
    }));
  }

  // -- Reads ---------------------------------------------------------

  async getMySubscriptions(userId: string) {
    const subscriptions = await this.prisma.subscription.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        package: true,
        // A deleted listing keeps its subscriptionId but no longer takes a place on
        // the package (attachToExistingSubscription doesn't count it), so the free
        // Pro slot offers and Moje pretplate count the same listings the server does.
        listings: { where: { status: { not: 'DELETED' } }, select: { id: true, title: true, slug: true } },
      },
    });
    const listingIds = subscriptions.flatMap((s) => s.listings.map((l) => l.id));
    const bankedDays = listingIds.length
      ? await this.prisma.bankedDay.findMany({ where: { listingId: { in: listingIds }, usedAt: null } })
      : [];

    return subscriptions.map((s) => ({
      ...s,
      priceAtPurchase: paraToRsd(s.priceAtPurchase),
      package: { ...s.package, priceMonthly: paraToRsd(s.package.priceMonthly), priceYearly: paraToRsd(s.package.priceYearly) },
      bankedDays: bankedDays.filter((b) => s.listings.some((l) => l.id === b.listingId)),
    }));
  }

  /** Payment confirmation details for the post-checkout page — package, amount, when, and the bank/invoice references. */
  async getSubscriptionReceipt(userId: string, subscriptionId: string) {
    const subscription = await this.prisma.subscription.findUniqueOrThrow({
      where: { id: subscriptionId },
      include: { package: true },
    });
    if (subscription.userId !== userId) throw new ForbiddenException();

    const transaction = await this.prisma.transaction.findFirst({
      where: { subscriptionId, status: 'SUCCESSFUL' },
      orderBy: { occurredAt: 'desc' },
      include: { invoices: true },
    });

    return {
      package: subscription.package.key,
      billingCycle: subscription.billingCycle,
      amount: paraToRsd(subscription.priceAtPurchase),
      currency: 'RSD',
      purchasedAt: transaction?.occurredAt ?? subscription.createdAt,
      bankReference: transaction?.bankExternalId ?? null,
      documentNumber: transaction?.invoices[0]?.documentNumber ?? null,
    };
  }

  /**
   * T21 — self-service cleanup for abandoned checkout attempts: rows stuck at
   * AWAITING_PAYMENT (the NestPay redirect was never completed) have no real
   * money or fiscal document behind them yet, so deleting one outright is
   * safe. Deliberately scoped to that one status only — anything past it has
   * a real transaction/invoice and must not be deletable this way.
   */
  async deleteAwaitingPayment(userId: string, subscriptionId: string) {
    const subscription = await this.prisma.subscription.findUniqueOrThrow({ where: { id: subscriptionId } });
    if (subscription.userId !== userId) throw new ForbiddenException();
    if (subscription.status !== 'AWAITING_PAYMENT') {
      throw new BadRequestException('Only a subscription still awaiting payment can be deleted');
    }
    await this.prisma.subscription.delete({ where: { id: subscriptionId } });
    return { message: this.i18n.t('common.SUCCESS') };
  }

  // -- Expiry -------------------------------------------------------------
  // Packages don't auto-renew (no recurring charge is ever attempted — see
  // O22 in the Product Bible: card tokenization/recurring charges were never
  // contracted with Banca Intesa, and the real NestPay integration here is a
  // one-time 3D Pay Hosting checkout with no reusable card token). A
  // subscription simply runs until its expiresAt and then lapses.

  /** Daily sweep: takes expired subscriptions (and their listings) offline, and reminds owners before it happens. */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async processSubscriptionExpiry() {
    await this.expireOverdueSubscriptions();
    await this.sendExpiringSoonReminders();
  }

  /**
   * Ch.22.4 "Pretplata ističe (-7, -3, -1)", for packages whose end would take a
   * listing out of search: not once the next period is paid for, nor for a
   * package no listing depends on any more.
   */
  private async sendExpiringSoonReminders() {
    for (const daysLeft of [7, 3, 1]) {
      const target = addDays(new Date(), daysLeft);
      const subs = await this.prisma.subscription.findMany({
        where: { ...PACKAGE_ENDING_WITHOUT_RENEWAL, expiresAt: { gte: startOfDay(target), lt: endOfDay(target) } },
      });
      for (const sub of subs) {
        this.events.emit('subscription.expiring_soon', { subscriptionId: sub.id, daysLeft });
      }
    }
  }

  /**
   * Ch.17 §8.3 — a listing doesn't expire the instant its subscription does
   * if it's still sitting on unused banked days (ADR-005): those start
   * counting down *now* instead, and the listing stays ACTIVE for that
   * window under the package it originally banked them from. See
   * expireBankedDayCoverage() for when that window itself runs out.
   */
  private async expireOverdueSubscriptions() {
    const overdue = await this.prisma.subscription.findMany({ where: { status: 'ACTIVE', expiresAt: { lt: new Date() } } });
    for (const sub of overdue) {
      await this.prisma.subscription.update({ where: { id: sub.id }, data: { status: 'EXPIRED' } });

      // A renewal paid in advance takes the listings over without a gap; any
      // carried-over days keep waiting for that period to end.
      const renewal = await this.prisma.subscription.findFirst({
        where: { renewsSubscriptionId: sub.id, status: 'SCHEDULED' },
        orderBy: { startsAt: 'asc' },
      });
      if (renewal) {
        await this.prisma.subscription.update({ where: { id: renewal.id }, data: { status: 'ACTIVE' } });
        await this.handOverListings(sub.id, renewal.id, { reactivate: false });
        continue;
      }

      // A deleted listing keeps its subscriptionId, and stays deleted.
      const listings = await this.prisma.listing.findMany({ where: { subscriptionId: sub.id, status: { not: 'DELETED' } } });
      const leftSearch: string[] = [];
      for (const listing of listings) {
        const unused = await this.prisma.bankedDay.findMany({ where: { listingId: listing.id, usedAt: null } });
        const totalDays = unused.reduce((sum, b) => sum + b.days, 0);
        if (totalDays > 0) {
          const validUntil = addDays(new Date(), totalDays);
          await this.prisma.bankedDay.updateMany({
            where: { id: { in: unused.map((b) => b.id) } },
            data: { validFrom: new Date(), validUntil },
          });
        } else {
          await this.prisma.listing.update({ where: { id: listing.id }, data: { status: 'EXPIRED' } });
          if (listing.status === 'ACTIVE') leftSearch.push(listing.id);
        }
      }
      // The email says the listing is no longer visible, so it only goes out when one really left search.
      if (leftSearch.length) {
        this.events.emit('subscription.expired', { subscriptionId: sub.id, listingIds: leftSearch });
        await this.cache.del(LISTING_COUNTS_CACHE_KEY);
      }
    }
  }

  /** Sweeps listings whose banked-days coverage window (set above) has now itself run out. */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async expireBankedDayCoverage() {
    const expiredBankedDays = await this.prisma.bankedDay.findMany({
      where: { usedAt: null, validUntil: { lt: new Date() } },
    });
    for (const banked of expiredBankedDays) {
      await this.prisma.bankedDay.update({ where: { id: banked.id }, data: { usedAt: new Date() } });
      const stillCovered = await this.prisma.bankedDay.count({
        where: { listingId: banked.listingId, usedAt: null, validUntil: { gt: new Date() } },
      });
      if (stillCovered === 0) {
        // Only a live listing goes offline; a deleted one stays deleted.
        const { count } = await this.prisma.listing.updateMany({
          where: { id: banked.listingId, status: 'ACTIVE' },
          data: { status: 'EXPIRED' },
        });
        if (count) await this.cache.del(LISTING_COUNTS_CACHE_KEY);
      }
    }
  }

  private async getFeaturedPriceTable(): Promise<Record<7 | 15 | 30, number>> {
    const setting = await this.prisma.setting.findUnique({ where: { key: 'featured_listing_prices' } });
    const value = setting?.value as Record<string, number> | undefined;
    return {
      7: value?.['7'] ?? 890,
      15: value?.['15'] ?? 1590,
      30: value?.['30'] ?? 2490,
    };
  }

  private serialize(subscription: Subscription & { package?: any; listings?: any[] }) {
    return {
      ...subscription,
      priceAtPurchase: paraToRsd(subscription.priceAtPurchase),
      // attachToExistingSubscription()'s lookup includes these relations to
      // check free-slot capacity — both packages and listings carry their
      // own BigInt para fields that JSON.stringify can't serialize as-is.
      ...(subscription.package
        ? { package: { ...subscription.package, priceMonthly: paraToRsd(subscription.package.priceMonthly), priceYearly: paraToRsd(subscription.package.priceYearly) } }
        : {}),
      ...(subscription.listings
        ? {
            listings: subscription.listings.map((l: any) => ({
              ...l,
              price: paraToRsd(l.price),
              weekendPrice: paraToRsd(l.weekendPrice),
              pricePerGuest: paraToRsd(l.pricePerGuest),
            })),
          }
        : {}),
    };
  }
}

/**
 * T133: an "Otključaj svoju kategoriju" proposal stays a draft that takes no
 * package until an admin opens its category, so neither the card checkout
 * nor the company pro-forma path starts for it.
 */
function assertCategoryAssigned(listing: { pendingCategoryAssignment: boolean }, i18n: I18nService) {
  if (listing.pendingCategoryAssignment) {
    throw new BadRequestException(i18n.t('errors.LISTING_CATEGORY_PENDING'));
  }
}

/** Where a declined payment lands; a renewal keeps its package in the "try again" link. */
function paymentFailedPath(listingId: string, renewsSubscriptionId: string | null): string {
  const path = `/oglasi/${listingId}/placanje-neuspesno`;
  return renewsSubscriptionId ? `${path}?obnova=${renewsSubscriptionId}` : path;
}
function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}
function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}
function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
