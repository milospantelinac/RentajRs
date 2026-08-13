import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { I18nService } from 'nestjs-i18n';
import { Prisma, Subscription, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../common/cache/cache.service';
import { ListingsService } from '../listings/listings.service';
import { PaymentProvider } from '../../common/payment/payment-provider.interface';
import { FiscalizationProvider } from '../../common/fiscalization/fiscalization-provider.interface';
import { paraToRsd, rsdToPara } from '../../common/utils/money';
import {
  PurchaseSubscriptionDto,
  PurchaseFeaturedDto,
  CancelSubscriptionDto,
  AdjustPriceDto,
} from './dto/subscriptions.dto';

const GRACE_PERIOD_DAYS = 7;
const RETRY_DAYS = [0, 3, 6];

@Injectable()
export class SubscriptionsService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
    private listings: ListingsService,
    private payment: PaymentProvider,
    private fiscalization: FiscalizationProvider,
    private i18n: I18nService,
    private events: EventEmitter2,
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

  /** Korak 11 of the listing wizard — the moment a subscription actually gets attached to a listing. */
  async purchaseForListing(userId: string, dto: PurchaseSubscriptionDto) {
    const listing = await this.prisma.listing.findUniqueOrThrow({ where: { id: dto.listingId } });
    if (listing.userId !== userId) throw new ForbiddenException();
    if (!['DRAFT', 'REJECTED'].includes(listing.status)) {
      throw new BadRequestException('Listing is not awaiting a package');
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
      subscription = await this.createAndChargeSubscription(userId, dto.packageId, dto.billingCycle);
    }

    // ADR-005: moving to Pro banks whatever's left on the old package rather than losing it.
    const newPackage = await this.prisma.package.findUniqueOrThrow({ where: { id: subscription.packageId } });
    if (previousSubscription && previousSubscription.package.key !== 'PRO' && newPackage.key === 'PRO') {
      await this.bankRemainingDays(listing.id, previousSubscription);
    }

    const updatedListing = await this.listings.markPendingApproval(listing.id, subscription.id);
    return { listing: updatedListing, subscription: this.serialize(subscription) };
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

    const priceTable: Record<number, number> = { 7: 89_000, 15: 159_000, 30: 249_000 };
    const price = BigInt(priceTable[dto.durationDays]);

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
          data: { status: 'GRACE', graceUntil: addDays(new Date(), GRACE_PERIOD_DAYS), paymentAttemptCount: 1 },
        });
        this.events.emit('subscription.payment_failed', { subscriptionId: sub.id, attempt: 0 });
      }
    }
  }

  private async processGracePeriod() {
    const inGrace = await this.prisma.subscription.findMany({ where: { status: 'GRACE' }, include: { package: true } });
    for (const sub of inGrace) {
      const daysSinceGraceStart = GRACE_PERIOD_DAYS - Math.ceil(((sub.graceUntil?.getTime() ?? 0) - Date.now()) / 86_400_000);
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
