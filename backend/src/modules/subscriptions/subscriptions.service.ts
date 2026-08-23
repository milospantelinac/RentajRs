import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';
import { Prisma, Subscription, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../common/cache/cache.service';
import { ListingsService } from '../listings/listings.service';
import { PaymentProvider } from '../../common/payment/payment-provider.interface';
import { NestPayCheckoutService } from '../../common/payment/nestpay/nestpay-checkout.service';
import { FiscalizationProvider } from '../../common/fiscalization/fiscalization-provider.interface';
import { paraToRsd, rsdToPara } from '../../common/utils/money';
import {
  PurchaseSubscriptionDto,
  PurchaseFeaturedDto,
  CancelSubscriptionDto,
  AdjustPriceDto,
  InitCheckoutDto,
} from './dto/subscriptions.dto';

const DEFAULT_GRACE_PERIOD_DAYS = 7;
const RETRY_DAYS = [0, 3, 6];

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
    private listings: ListingsService,
    private payment: PaymentProvider,
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
      subscription = await this.createAndChargeSubscription(userId, dto.packageId, dto.billingCycle);
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

  private async createAndChargeSubscription(userId: string, packageId: string, billingCycle: 'MONTHLY' | 'YEARLY') {
    const pkg = await this.prisma.package.findUniqueOrThrow({ where: { id: packageId } });
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const price = billingCycle === 'YEARLY' ? pkg.priceYearly : pkg.priceMonthly;

    const subscription = await this.prisma.subscription.create({
      data: {
        userId,
        packageId,
        billingCycle,
        status: 'PENDING_ACTIVATION',
        priceAtPurchase: price,
        autoRenew: user.buyerType !== 'COMPANY', // R109 — legal entities renew manually
      },
    });

    if (user.buyerType === 'COMPANY') {
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

    // Individual — card charged immediately (Banca Intesa e-commerce in production, mocked here).
    const charge = await this.payment.chargeCard({
      amountRsd: paraToRsd(price) ?? 0,
      description: `Rentaj — ${pkg.key} (${billingCycle})`,
    });
    const transaction = await this.prisma.transaction.create({
      data: {
        userId,
        subscriptionId: subscription.id,
        amount: price,
        status: charge.success ? 'SUCCESSFUL' : 'FAILED',
        type: 'SUBSCRIPTION',
        bankExternalId: charge.externalTransactionId,
        errorMessage: charge.errorMessage,
      },
    });
    if (!charge.success) {
      await this.prisma.subscription.delete({ where: { id: subscription.id } });
      throw new BadRequestException('Payment failed');
    }

    await this.prisma.subscription.update({ where: { id: subscription.id }, data: { cardToken: charge.cardToken } });

    const doc = await this.fiscalization.issueDocument({
      documentType: 'FISCAL_RECEIPT',
      amountRsd: paraToRsd(price) ?? 0,
      buyerName: `${user.firstName} ${user.lastName}`,
      description: `Rentaj — ${pkg.key} (${billingCycle})`,
    });
    await this.prisma.invoice.create({
      data: {
        transactionId: transaction.id,
        userId,
        documentType: 'FISCAL_RECEIPT',
        documentNumber: doc.documentNumber,
        amount: price,
        externalId: doc.externalId,
      },
    });

    this.events.emit('subscription.purchased', { userId, subscriptionId: subscription.id });
    return this.prisma.subscription.findUniqueOrThrow({ where: { id: subscription.id } });
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
    // ACTIVE is allowed too — this is also the paid path for upgrading an
    // already-live listing to a bigger package (ADR-005); handleNestPaySuccess
    // branches on the listing's status to tell a fresh publish from an upgrade.
    if (!['DRAFT', 'REJECTED', 'ACTIVE'].includes(listing.status)) {
      throw new BadRequestException('Listing is not eligible for a package purchase');
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
    const pkg = await this.prisma.package.findUniqueOrThrow({ where: { id: dto.packageId } });
    await this.assertPackageCompatibleWithListing(listing.id, dto.packageId);
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
        autoRenew: !dto.isCompany, // R109 — legal entities renew manually
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
      return `${frontendUrl}/oglasi/${listingId}/placanje-neuspesno`;
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
    let redirectPath: string;
    if (listing.status === 'ACTIVE') {
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

    this.events.emit('subscription.purchased', { userId: subscription.userId, subscriptionId: subscription.id });
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

    return listingId ? `${frontendUrl}/oglasi/${listingId}/placanje-neuspesno` : `${frontendUrl}/kontrolna-tabla/pretplate?payment=failed`;
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

  async purchaseFeatured(userId: string, dto: PurchaseFeaturedDto) {
    const listing = await this.prisma.listing.findUniqueOrThrow({ where: { id: dto.listingId } });
    if (listing.userId !== userId) throw new ForbiddenException();

    const priceTable = await this.getFeaturedPriceTable();
    const price = rsdToPara(priceTable[dto.durationDays]);

    const maxSetting = await this.prisma.setting.findUnique({ where: { key: 'max_featured_per_category' } });
    const maxPerCategory = (maxSetting?.value as number) ?? 10;
    const activeCount = await this.prisma.featuredListing.count({
      where: { listing: { categoryId: listing.categoryId }, expiresAt: { gt: new Date() } },
    });

    if (activeCount >= maxPerCategory) {
      await this.prisma.featuredWaitlist.create({ data: { listingId: listing.id, categoryId: listing.categoryId } });
      return { waitlisted: true };
    }

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const charge = await this.payment.chargeCard({ amountRsd: paraToRsd(price) ?? 0, description: `Rentaj — istaknut oglas ${dto.durationDays}d` });
    const transaction = await this.prisma.transaction.create({
      data: { userId, amount: price, status: charge.success ? 'SUCCESSFUL' : 'FAILED', type: 'FEATURED', bankExternalId: charge.externalTransactionId },
    });
    if (!charge.success) throw new BadRequestException('Payment failed');

    const featured = await this.prisma.featuredListing.create({
      data: {
        listingId: listing.id,
        transactionId: transaction.id,
        durationDays: dto.durationDays,
        price,
        startsAt: new Date(),
        expiresAt: new Date(Date.now() + dto.durationDays * 86_400_000),
      },
    });
    void user;
    return { waitlisted: false, featured: { ...featured, price: paraToRsd(featured.price) } };
  }

  /** Rotates equally among all currently-featured listings in the category (R114) — call on every page render, not stored order. */
  async getRotatedFeatured(categoryId: string, limit = 6) {
    const featured = await this.prisma.featuredListing.findMany({
      where: { listing: { categoryId }, expiresAt: { gt: new Date() } },
      include: { listing: { include: { photos: { where: { isCover: true }, take: 1 } } } },
    });
    return shuffle(featured)
      .slice(0, limit)
      .map((f) => ({
        ...f,
        price: paraToRsd(f.price),
        listing: {
          ...f.listing,
          price: paraToRsd(f.listing.price),
          weekendPrice: paraToRsd(f.listing.weekendPrice),
          pricePerGuest: paraToRsd(f.listing.pricePerGuest),
        },
      }));
  }

  @Cron(CronExpression.EVERY_HOUR)
  async expireFeaturedAndNotifyWaitlist() {
    const expired = await this.prisma.featuredListing.findMany({ where: { expiresAt: { lt: new Date() } } });
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
    // If the listing is already ACTIVE (approved before the transfer cleared), activate now; otherwise
    // activateForListingApproval() will pick it up when moderation completes.
    const listing = await this.prisma.listing.findFirst({ where: { subscriptionId } });
    if (listing?.status === 'ACTIVE' && subscription.status === 'PENDING_ACTIVATION') {
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
      include: { package: true, listings: { select: { id: true, title: true, slug: true } } },
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

  async cancelSubscription(userId: string, subscriptionId: string, dto: CancelSubscriptionDto) {
    const subscription = await this.prisma.subscription.findUniqueOrThrow({ where: { id: subscriptionId } });
    if (subscription.userId !== userId) throw new ForbiddenException();
    await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { autoRenew: false, cancelledAt: new Date() },
    });
    void dto;
    return { message: this.i18n.t('common.SUCCESS') };
  }

  // -- Renewal / dunning -------------------------------------------------

  /** R107/R110/R113 — daily renewal attempt + 7-day grace period with retries on day 0/3/6. */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async processRenewalsAndDunning() {
    await this.sendPreChargeReminders();
    await this.attemptRenewals();
    await this.processGracePeriod();
    await this.expireOverdueSubscriptions();
    await this.sendExpiringSoonReminders();
  }

  /**
   * Ch.22.4 "Pretplata ističe (-7, -3, -1)" — only for subscriptions that will
   * actually lapse (autoRenew off, e.g. legal entities managing manually);
   * auto-renewing ones are handled silently by attemptRenewals() instead.
   */
  private async sendExpiringSoonReminders() {
    for (const daysLeft of [7, 3, 1]) {
      const target = addDays(new Date(), daysLeft);
      const subs = await this.prisma.subscription.findMany({
        where: {
          status: 'ACTIVE',
          autoRenew: false,
          expiresAt: { gte: startOfDay(target), lt: endOfDay(target) },
        },
      });
      for (const sub of subs) {
        this.events.emit('subscription.expiring_soon', { subscriptionId: sub.id, daysLeft });
      }
    }
  }

  private async sendPreChargeReminders() {
    const inThreeDays = addDays(new Date(), 3);
    const subs = await this.prisma.subscription.findMany({
      where: { status: 'ACTIVE', autoRenew: true, expiresAt: { gte: startOfDay(inThreeDays), lt: endOfDay(inThreeDays) } },
    });
    for (const sub of subs) this.events.emit('subscription.renewal_reminder', { subscriptionId: sub.id });
  }

  private async attemptRenewals() {
    const dueToday = await this.prisma.subscription.findMany({
      where: { status: 'ACTIVE', autoRenew: true, expiresAt: { lte: new Date() } },
      include: { package: true },
    });
    const gracePeriodDays = await this.getGracePeriodDays();
    for (const sub of dueToday) {
      const charge = await this.payment.chargeCard({
        amountRsd: paraToRsd(sub.priceAtPurchase) ?? 0,
        description: `Rentaj — obnova (${sub.package.key})`,
        cardToken: sub.cardToken ?? undefined,
      });
      await this.prisma.transaction.create({
        data: {
          userId: sub.userId,
          subscriptionId: sub.id,
          amount: sub.priceAtPurchase,
          status: charge.success ? 'SUCCESSFUL' : 'FAILED',
          type: 'RENEWAL',
          bankExternalId: charge.externalTransactionId,
          errorMessage: charge.errorMessage,
        },
      });

      if (charge.success) {
        const cycleDays = sub.billingCycle === 'YEARLY' ? 365 : 30;
        await this.prisma.subscription.update({
          where: { id: sub.id },
          data: { expiresAt: new Date(Date.now() + cycleDays * 86_400_000), paymentAttemptCount: 0 },
        });
        this.events.emit('subscription.renewed', { subscriptionId: sub.id });
      } else {
        await this.prisma.subscription.update({
          where: { id: sub.id },
          data: { status: 'GRACE', graceUntil: addDays(new Date(), gracePeriodDays), paymentAttemptCount: 1 },
        });
        this.events.emit('subscription.payment_failed', { subscriptionId: sub.id, attempt: 0 });
      }
    }
  }

  private async processGracePeriod() {
    const inGrace = await this.prisma.subscription.findMany({ where: { status: 'GRACE' }, include: { package: true } });
    const gracePeriodDays = await this.getGracePeriodDays();
    for (const sub of inGrace) {
      const daysSinceGraceStart = gracePeriodDays - Math.ceil(((sub.graceUntil?.getTime() ?? 0) - Date.now()) / 86_400_000);
      if (!RETRY_DAYS.includes(daysSinceGraceStart)) continue;

      const charge = await this.payment.chargeCard({
        amountRsd: paraToRsd(sub.priceAtPurchase) ?? 0,
        description: `Rentaj — pokušaj naplate (${sub.package.key})`,
        cardToken: sub.cardToken ?? undefined,
      });
      await this.prisma.transaction.create({
        data: {
          userId: sub.userId,
          subscriptionId: sub.id,
          amount: sub.priceAtPurchase,
          status: charge.success ? 'SUCCESSFUL' : 'FAILED',
          type: 'RENEWAL',
        },
      });

      if (charge.success) {
        const cycleDays = sub.billingCycle === 'YEARLY' ? 365 : 30;
        await this.prisma.subscription.update({
          where: { id: sub.id },
          data: { status: 'ACTIVE', expiresAt: new Date(Date.now() + cycleDays * 86_400_000), graceUntil: null, paymentAttemptCount: 0 },
        });
        this.events.emit('subscription.renewed', { subscriptionId: sub.id });
      } else {
        await this.prisma.subscription.update({ where: { id: sub.id }, data: { paymentAttemptCount: { increment: 1 } } });
        this.events.emit('subscription.payment_failed', { subscriptionId: sub.id, attempt: daysSinceGraceStart });
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
    const overdue = await this.prisma.subscription.findMany({ where: { status: 'GRACE', graceUntil: { lt: new Date() } } });
    for (const sub of overdue) {
      const listings = await this.prisma.listing.findMany({ where: { subscriptionId: sub.id } });
      await this.prisma.subscription.update({ where: { id: sub.id }, data: { status: 'EXPIRED' } });

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
        }
      }
      this.events.emit('subscription.expired', { subscriptionId: sub.id });
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
        await this.prisma.listing.update({ where: { id: banked.listingId }, data: { status: 'EXPIRED' } });
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

  /** R171 — admin-editable in /admin/podesavanja (Setting.grace_period_days). */
  private async getGracePeriodDays(): Promise<number> {
    const setting = await this.prisma.setting.findUnique({ where: { key: 'grace_period_days' } });
    return typeof setting?.value === 'number' ? setting.value : DEFAULT_GRACE_PERIOD_DAYS;
  }

  private serialize(subscription: Subscription) {
    return { ...subscription, priceAtPurchase: paraToRsd(subscription.priceAtPurchase) };
  }
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
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
