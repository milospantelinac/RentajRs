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
exports.DashboardService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const reviews_service_1 = require("../reviews/reviews.service");
const money_1 = require("../../common/utils/money");
let DashboardService = class DashboardService {
    constructor(prisma, reviews) {
        this.prisma = prisma;
        this.reviews = reviews;
    }
    async getDashboard(userId) {
        const isOwner = await this.isOwner(userId);
        const [ownerAttention, guestAttention, stats, onboarding, upcoming] = await Promise.all([
            isOwner ? this.getOwnerAttention(userId) : [],
            this.getGuestAttention(userId),
            this.getStats(userId, isOwner),
            isOwner ? this.getOnboarding(userId) : null,
            this.getUpcoming(userId),
        ]);
        return {
            isOwner,
            attentionItems: [...ownerAttention, ...guestAttention],
            stats,
            onboarding,
            upcomingBookings: upcoming,
        };
    }
    async isOwner(userId) {
        const count = await this.prisma.listing.count({ where: { userId, status: 'ACTIVE' } });
        return count > 0;
    }
    async getOwnerAttention(userId) {
        const items = [];
        const awaitingConfirmation = await this.prisma.booking.count({
            where: { ownerId: userId, status: 'AWAITING_PAYMENT' },
        });
        if (awaitingConfirmation) {
            items.push({ urgency: 'critical', title: 'payment_confirmation', actionUrl: '/kontrolna-tabla/rezervacije?status=AWAITING_PAYMENT', count: awaitingConfirmation });
        }
        const termConflicts = await this.prisma.dispute.count({ where: { type: 'TERM_CONFLICT', status: 'NEW', listing: { userId } } });
        if (termConflicts) {
            items.push({ urgency: 'critical', title: 'term_conflict', actionUrl: '/kontrolna-tabla/kalendar', count: termConflicts });
        }
        const newRequests = await this.prisma.booking.count({ where: { ownerId: userId, status: 'REQUESTED' } });
        if (newRequests) {
            items.push({ urgency: 'decision', title: 'new_requests', actionUrl: '/kontrolna-tabla/rezervacije?status=REQUESTED', count: newRequests });
        }
        const expiringSoon = await this.prisma.subscription.count({
            where: { userId, status: 'ACTIVE', expiresAt: { lt: new Date(Date.now() + 7 * 86_400_000) } },
        });
        if (expiringSoon) {
            items.push({ urgency: 'decision', title: 'subscription_expiring', actionUrl: '/kontrolna-tabla/pretplate', count: expiringSoon });
        }
        const rejectedListings = await this.prisma.listing.count({ where: { userId, status: 'REJECTED' } });
        if (rejectedListings) {
            items.push({ urgency: 'decision', title: 'rejected_listings', actionUrl: '/kontrolna-tabla/oglasi', count: rejectedListings });
        }
        const unreadAsOwner = await this.prisma.conversation.count({ where: { ownerId: userId, unreadOwnerCount: { gt: 0 } } });
        if (unreadAsOwner) {
            items.push({ urgency: 'info', title: 'unread_messages_owner', actionUrl: '/kontrolna-tabla/poruke', count: unreadAsOwner });
        }
        return items;
    }
    async getGuestAttention(userId) {
        const items = [];
        const awaitingPayment = await this.prisma.booking.count({ where: { guestId: userId, status: 'AWAITING_PAYMENT' } });
        if (awaitingPayment) {
            items.push({ urgency: 'critical', title: 'payment_deadline', actionUrl: '/kontrolna-tabla/rezervacije', count: awaitingPayment });
        }
        const pendingReviews = await this.reviews.getMyPendingReviews(userId);
        if (pendingReviews.length) {
            items.push({ urgency: 'info', title: 'pending_reviews', actionUrl: '/kontrolna-tabla/rezervacije', count: pendingReviews.length });
        }
        const unreadAsGuest = await this.prisma.conversation.count({ where: { guestId: userId, unreadGuestCount: { gt: 0 } } });
        if (unreadAsGuest) {
            items.push({ urgency: 'info', title: 'unread_messages_guest', actionUrl: '/kontrolna-tabla/poruke', count: unreadAsGuest });
        }
        return items;
    }
    async getStats(userId, isOwner) {
        if (!isOwner) {
            const bookingCount = await this.prisma.booking.count({ where: { guestId: userId } });
            return { listingCount: 0, bookingCount, confirmedValue: 0, avgRating: null };
        }
        const [listingCount, bookings, listings] = await Promise.all([
            this.prisma.listing.count({ where: { userId, status: { not: 'DELETED' } } }),
            this.prisma.booking.findMany({ where: { ownerId: userId, status: { in: ['CONFIRMED', 'COMPLETED'] } }, select: { totalAmount: true } }),
            this.prisma.listing.findMany({ where: { userId, reviewCount: { gt: 0 } }, select: { avgRating: true, reviewCount: true } }),
        ]);
        const confirmedValue = bookings.reduce((sum, b) => sum + Number((0, money_1.paraToRsd)(b.totalAmount)), 0);
        const totalReviews = listings.reduce((sum, l) => sum + l.reviewCount, 0);
        const avgRating = totalReviews
            ? listings.reduce((sum, l) => sum + (Number(l.avgRating) || 0) * l.reviewCount, 0) / totalReviews
            : null;
        return { listingCount, bookingCount: bookings.length, confirmedValue, avgRating };
    }
    async getOnboarding(userId) {
        const [listingCount, workingHoursCount, blockedTermCount, icalCount, user] = await Promise.all([
            this.prisma.listing.count({ where: { userId, status: { not: 'DELETED' } } }),
            this.prisma.workingHours.count({ where: { listing: { userId } } }),
            this.prisma.blockedTerm.count({ where: { listing: { userId } } }),
            this.prisma.icalSource.count({ where: { listing: { userId } } }),
            this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
        ]);
        const hasListing = listingCount > 0;
        const hasAvailability = workingHoursCount > 0 || blockedTermCount > 0;
        const hasIcal = icalCount > 0;
        const hasBankAccount = !!user.bankAccount;
        return {
            hasListing,
            hasAvailability,
            hasIcal,
            hasBankAccount,
            allDone: hasListing && hasAvailability && hasIcal && hasBankAccount,
        };
    }
    async getUpcoming(userId) {
        const bookings = await this.prisma.booking.findMany({
            where: {
                OR: [{ guestId: userId }, { ownerId: userId }],
                status: 'CONFIRMED',
                startsAt: { gte: new Date(), lt: new Date(Date.now() + 7 * 86_400_000) },
            },
            orderBy: { startsAt: 'asc' },
            include: { listing: { select: { title: true, slug: true } } },
            take: 10,
        });
        return bookings.map((b) => ({
            ...b,
            pricePerUnit: (0, money_1.paraToRsd)(b.pricePerUnit),
            totalAmount: (0, money_1.paraToRsd)(b.totalAmount),
            amountDue: (0, money_1.paraToRsd)(b.amountDue),
        }));
    }
};
exports.DashboardService = DashboardService;
exports.DashboardService = DashboardService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        reviews_service_1.ReviewsService])
], DashboardService);
//# sourceMappingURL=dashboard.service.js.map