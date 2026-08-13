"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionsService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const event_emitter_1 = require("@nestjs/event-emitter");
const nestjs_i18n_1 = require("nestjs-i18n");
const prisma_service_1 = require("../../prisma/prisma.service");
const cache_service_1 = require("../../common/cache/cache.service");
const listings_service_1 = require("../listings/listings.service");
const payment_provider_interface_1 = require("../../common/payment/payment-provider.interface");
const fiscalization_provider_interface_1 = require("../../common/fiscalization/fiscalization-provider.interface");
const money_1 = require("../../common/utils/money");
const GRACE_PERIOD_DAYS = 7;
const RETRY_DAYS = [0, 3, 6];
let SubscriptionsService = class SubscriptionsService {
    constructor(prisma, cache, listings, payment, fiscalization, i18n, events) {
        this.prisma = prisma;
        this.cache = cache;
        this.listings = listings;
        this.payment = payment;
        this.fiscalization = fiscalization;
        this.i18n = i18n;
        this.events = events;
    }
    async listPackages() {
        return this.cache.getOrSet('subscriptions:packages', 300, async () => {
            const packages = await this.prisma.package.findMany({ where: { active: true }, orderBy: { displayOrder: 'asc' } });
            return packages.map((p) => ({
                ...p,
                priceMonthly: (0, money_1.paraToRsd)(p.priceMonthly),
                priceYearly: (0, money_1.paraToRsd)(p.priceYearly),
            }));
        });
    }
    async purchaseForListing(userId, dto) {
        const listing = await this.prisma.listing.findUniqueOrThrow({ where: { id: dto.listingId } });
        if (listing.userId !== userId)
            throw new common_1.ForbiddenException();
        if (!['DRAFT', 'REJECTED'].includes(listing.status)) {
            throw new common_1.BadRequestException('Listing is not awaiting a package');
        }
        const previousSubscription = listing.subscriptionId
            ? await this.prisma.subscription.findUnique({ where: { id: listing.subscriptionId }, include: { package: true } })
            : null;
        let subscription;
        if (dto.existingSubscriptionId) {
            subscription = await this.attachToExistingSubscription(userId, dto.existingSubscriptionId);
        }
        else {
            if (!dto.packageId || !dto.billingCycle) {
                throw new common_1.BadRequestException('packageId and billingCycle are required to buy a new subscription');
            }
            subscription = await this.createAndChargeSubscription(userId, dto.packageId, dto.billingCycle);
        }
        const newPackage = await this.prisma.package.findUniqueOrThrow({ where: { id: subscription.packageId } });
        if (previousSubscription && previousSubscription.package.key !== 'PRO' && newPackage.key === 'PRO') {
            await this.bankRemainingDays(listing.id, previousSubscription);
        }
        const updatedListing = await this.listings.markPendingApproval(listing.id, subscription.id);
        return { listing: updatedListing, subscription: this.serialize(subscription) };
    }
    async attachToExistingSubscription(userId, subscriptionId) {
        const subscription = await this.prisma.subscription.findUniqueOrThrow({
            where: { id: subscriptionId },
            include: { package: true, listings: true },
        });
        if (subscription.userId !== userId)
            throw new common_1.ForbiddenException();
        if (subscription.package.key !== 'PRO') {
            throw new common_1.BadRequestException('Only Pro subscriptions can cover more than one listing');
        }
        if (subscription.status !== 'ACTIVE') {
            throw new common_1.BadRequestException('Subscription is not active');
        }
        const activeListingCount = subscription.listings.filter((l) => l.status !== 'DELETED').length;
        if (activeListingCount >= subscription.package.listingLimit) {
            throw new common_1.BadRequestException(this.i18n.t('errors.SUBSCRIPTION_LISTING_LIMIT'));
        }
        return subscription;
    }
    async createAndChargeSubscription(userId, packageId, billingCycle) {
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
                autoRenew: user.buyerType !== 'COMPANY',
            },
        });
        if (user.buyerType === 'COMPANY') {
            const transaction = await this.prisma.transaction.create({
                data: { userId, subscriptionId: subscription.id, amount: price, status: 'INITIATED', type: 'SUBSCRIPTION' },
            });
            const doc = await this.fiscalization.issueDocument({
                documentType: 'PRO_FORMA',
                amountRsd: (0, money_1.paraToRsd)(price) ?? 0,
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
        const charge = await this.payment.chargeCard({
            amountRsd: (0, money_1.paraToRsd)(price) ?? 0,
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
            throw new common_1.BadRequestException('Payment failed');
        }
        await this.prisma.subscription.update({ where: { id: subscription.id }, data: { cardToken: charge.cardToken } });
        const doc = await this.fiscalization.issueDocument({
            documentType: 'FISCAL_RECEIPT',
            amountRsd: (0, money_1.paraToRsd)(price) ?? 0,
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
    async bankRemainingDays(listingId, oldSubscription) {
        if (!oldSubscription.expiresAt)
            return;
        const remainingMs = oldSubscription.expiresAt.getTime() - Date.now();
        const remainingDays = Math.ceil(remainingMs / 86_400_000);
        if (remainingDays <= 0)
            return;
        await this.prisma.bankedDay.create({
            data: { listingId, days: remainingDays, originPackageId: oldSubscription.package.id },
        });
        await this.prisma.subscription.update({ where: { id: oldSubscription.id }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
    }
    async activateForListingApproval({ listingId }) {
        const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
        if (!listing?.subscriptionId)
            return;
        const subscription = await this.prisma.subscription.findUnique({ where: { id: listing.subscriptionId } });
        if (!subscription || subscription.status !== 'PENDING_ACTIVATION')
            return;
        const cycleDays = subscription.billingCycle === 'YEARLY' ? 365 : 30;
        await this.prisma.subscription.update({
            where: { id: subscription.id },
            data: { status: 'ACTIVE', startsAt: new Date(), expiresAt: new Date(Date.now() + cycleDays * 86_400_000) },
        });
    }
    async purchaseFeatured(userId, dto) {
        const listing = await this.prisma.listing.findUniqueOrThrow({ where: { id: dto.listingId } });
        if (listing.userId !== userId)
            throw new common_1.ForbiddenException();
        const priceTable = { 7: 89_000, 15: 159_000, 30: 249_000 };
        const price = BigInt(priceTable[dto.durationDays]);
        const maxSetting = await this.prisma.setting.findUnique({ where: { key: 'max_featured_per_category' } });
        const maxPerCategory = maxSetting?.value ?? 10;
        const activeCount = await this.prisma.featuredListing.count({
            where: { listing: { categoryId: listing.categoryId }, expiresAt: { gt: new Date() } },
        });
        if (activeCount >= maxPerCategory) {
            await this.prisma.featuredWaitlist.create({ data: { listingId: listing.id, categoryId: listing.categoryId } });
            return { waitlisted: true };
        }
        const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
        const charge = await this.payment.chargeCard({ amountRsd: (0, money_1.paraToRsd)(price) ?? 0, description: `Rentaj — istaknut oglas ${dto.durationDays}d` });
        const transaction = await this.prisma.transaction.create({
            data: { userId, amount: price, status: charge.success ? 'SUCCESSFUL' : 'FAILED', type: 'FEATURED', bankExternalId: charge.externalTransactionId },
        });
        if (!charge.success)
            throw new common_1.BadRequestException('Payment failed');
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
        return { waitlisted: false, featured: { ...featured, price: (0, money_1.paraToRsd)(featured.price) } };
    }
    async getRotatedFeatured(categoryId, limit = 6) {
        const featured = await this.prisma.featuredListing.findMany({
            where: { listing: { categoryId }, expiresAt: { gt: new Date() } },
            include: { listing: { include: { photos: { where: { isCover: true }, take: 1 } } } },
        });
        return shuffle(featured)
            .slice(0, limit)
            .map((f) => ({
            ...f,
            price: (0, money_1.paraToRsd)(f.price),
            listing: {
                ...f.listing,
                price: (0, money_1.paraToRsd)(f.listing.price),
                weekendPrice: (0, money_1.paraToRsd)(f.listing.weekendPrice),
                pricePerGuest: (0, money_1.paraToRsd)(f.listing.pricePerGuest),
            },
        }));
    }
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
    async adminActivateSubscription(adminId, subscriptionId) {
        const subscription = await this.prisma.subscription.findUniqueOrThrow({ where: { id: subscriptionId } });
        const transaction = await this.prisma.transaction.findFirst({ where: { subscriptionId, status: 'INITIATED' } });
        if (transaction) {
            await this.prisma.transaction.update({ where: { id: transaction.id }, data: { status: 'SUCCESSFUL' } });
        }
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
    async adminUpdatePackagePrice(packageId, dto) {
        await this.prisma.package.update({
            where: { id: packageId },
            data: { priceMonthly: (0, money_1.rsdToPara)(dto.priceMonthlyRsd), priceYearly: (0, money_1.rsdToPara)(dto.priceYearlyRsd) },
        });
        await this.cache.del('subscriptions:packages');
        return { message: this.i18n.t('common.SUCCESS') };
    }
    async adminListSubscriptions(status) {
        const subscriptions = await this.prisma.subscription.findMany({
            where: status ? { status } : undefined,
            orderBy: { createdAt: 'desc' },
            include: {
                user: { select: { id: true, firstName: true, lastName: true, email: true, buyerType: true } },
                package: true,
                listings: { select: { id: true, title: true, slug: true, status: true } },
            },
        });
        return subscriptions.map((s) => ({
            ...s,
            priceAtPurchase: (0, money_1.paraToRsd)(s.priceAtPurchase),
            package: { ...s.package, priceMonthly: (0, money_1.paraToRsd)(s.package.priceMonthly), priceYearly: (0, money_1.paraToRsd)(s.package.priceYearly) },
        }));
    }
    async getMySubscriptions(userId) {
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
            priceAtPurchase: (0, money_1.paraToRsd)(s.priceAtPurchase),
            package: { ...s.package, priceMonthly: (0, money_1.paraToRsd)(s.package.priceMonthly), priceYearly: (0, money_1.paraToRsd)(s.package.priceYearly) },
            bankedDays: bankedDays.filter((b) => s.listings.some((l) => l.id === b.listingId)),
        }));
    }
    async cancelSubscription(userId, subscriptionId, dto) {
        const subscription = await this.prisma.subscription.findUniqueOrThrow({ where: { id: subscriptionId } });
        if (subscription.userId !== userId)
            throw new common_1.ForbiddenException();
        await this.prisma.subscription.update({
            where: { id: subscriptionId },
            data: { autoRenew: false, cancelledAt: new Date() },
        });
        void dto;
        return { message: this.i18n.t('common.SUCCESS') };
    }
    async processRenewalsAndDunning() {
        await this.sendPreChargeReminders();
        await this.attemptRenewals();
        await this.processGracePeriod();
        await this.expireOverdueSubscriptions();
        await this.sendExpiringSoonReminders();
    }
    async sendExpiringSoonReminders() {
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
    async sendPreChargeReminders() {
        const inThreeDays = addDays(new Date(), 3);
        const subs = await this.prisma.subscription.findMany({
            where: { status: 'ACTIVE', autoRenew: true, expiresAt: { gte: startOfDay(inThreeDays), lt: endOfDay(inThreeDays) } },
        });
        for (const sub of subs)
            this.events.emit('subscription.renewal_reminder', { subscriptionId: sub.id });
    }
    async attemptRenewals() {
        const dueToday = await this.prisma.subscription.findMany({
            where: { status: 'ACTIVE', autoRenew: true, expiresAt: { lte: new Date() } },
            include: { package: true },
        });
        for (const sub of dueToday) {
            const charge = await this.payment.chargeCard({
                amountRsd: (0, money_1.paraToRsd)(sub.priceAtPurchase) ?? 0,
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
            }
            else {
                await this.prisma.subscription.update({
                    where: { id: sub.id },
                    data: { status: 'GRACE', graceUntil: addDays(new Date(), GRACE_PERIOD_DAYS), paymentAttemptCount: 1 },
                });
                this.events.emit('subscription.payment_failed', { subscriptionId: sub.id, attempt: 0 });
            }
        }
    }
    async processGracePeriod() {
        const inGrace = await this.prisma.subscription.findMany({ where: { status: 'GRACE' }, include: { package: true } });
        for (const sub of inGrace) {
            const daysSinceGraceStart = GRACE_PERIOD_DAYS - Math.ceil(((sub.graceUntil?.getTime() ?? 0) - Date.now()) / 86_400_000);
            if (!RETRY_DAYS.includes(daysSinceGraceStart))
                continue;
            const charge = await this.payment.chargeCard({
                amountRsd: (0, money_1.paraToRsd)(sub.priceAtPurchase) ?? 0,
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
            }
            else {
                await this.prisma.subscription.update({ where: { id: sub.id }, data: { paymentAttemptCount: { increment: 1 } } });
                this.events.emit('subscription.payment_failed', { subscriptionId: sub.id, attempt: daysSinceGraceStart });
            }
        }
    }
    async expireOverdueSubscriptions() {
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
                }
                else {
                    await this.prisma.listing.update({ where: { id: listing.id }, data: { status: 'EXPIRED' } });
                }
            }
            this.events.emit('subscription.expired', { subscriptionId: sub.id });
        }
    }
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
    serialize(subscription) {
        return { ...subscription, priceAtPurchase: (0, money_1.paraToRsd)(subscription.priceAtPurchase) };
    }
};
exports.SubscriptionsService = SubscriptionsService;
__decorate([
    (0, event_emitter_1.OnEvent)('listing.approved'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SubscriptionsService.prototype, "activateForListingApproval", null);
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_HOUR),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SubscriptionsService.prototype, "expireFeaturedAndNotifyWaitlist", null);
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_DAY_AT_3AM),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SubscriptionsService.prototype, "processRenewalsAndDunning", null);
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_DAY_AT_4AM),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SubscriptionsService.prototype, "expireBankedDayCoverage", null);
exports.SubscriptionsService = SubscriptionsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        cache_service_1.CacheService,
        listings_service_1.ListingsService,
        payment_provider_interface_1.PaymentProvider,
        fiscalization_provider_interface_1.FiscalizationProvider,
        nestjs_i18n_1.I18nService,
        event_emitter_1.EventEmitter2])
], SubscriptionsService);
function addDays(date, days) {
    return new Date(date.getTime() + days * 86_400_000);
}
function startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}
function endOfDay(date) {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
}
function shuffle(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}
//# sourceMappingURL=subscriptions.service.js.map