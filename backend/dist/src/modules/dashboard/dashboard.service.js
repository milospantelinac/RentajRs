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
const users_service_1 = require("../users/users.service");
const taxonomy_service_1 = require("../taxonomy/taxonomy.service");
const money_1 = require("../../common/utils/money");
const ical_availability_1 = require("../../common/utils/ical-availability");
const NEW_LISTING_URL = '/oglasi/novi';
const MY_LISTINGS_URL = '/kontrolna-tabla/oglasi';
const UPCOMING_STATUSES = ['REQUESTED', 'AWAITING_PAYMENT', 'CONFIRMED'];
function availabilityUrl(listingIds, emptyUrl = NEW_LISTING_URL) {
    if (!listingIds.length)
        return emptyUrl;
    return listingIds.length === 1 ? `/oglasi/${listingIds[0]}/uredi?korak=availability` : MY_LISTINGS_URL;
}
function icalUrl(listingIds, emptyUrl = NEW_LISTING_URL) {
    if (!listingIds.length)
        return emptyUrl;
    return listingIds.length === 1 ? `${MY_LISTINGS_URL}/${listingIds[0]}/ical` : MY_LISTINGS_URL;
}
function shortName(person) {
    if (!person)
        return null;
    const initial = person.lastName?.trim().charAt(0);
    return initial ? `${person.firstName} ${initial}.` : person.firstName;
}
let DashboardService = class DashboardService {
    constructor(prisma, reviews, users, taxonomy) {
        this.prisma = prisma;
        this.reviews = reviews;
        this.users = users;
        this.taxonomy = taxonomy;
    }
    async getDashboard(userId) {
        const isOwner = await this.users.isOwner(userId);
        const [ownerAttention, guestAttention, stats, onboarding, upcoming] = await Promise.all([
            isOwner ? this.getOwnerAttention(userId) : [],
            this.getGuestAttention(userId),
            this.getStats(userId, isOwner),
            this.getOnboarding(userId),
            this.getUpcoming(userId),
        ]);
        return {
            isOwner,
            attentionItems: [...ownerAttention, ...guestAttention],
            stats,
            onboarding: onboarding.allDone ? null : onboarding,
            upcomingBookings: upcoming,
        };
    }
    async getCounts(userId) {
        const [bookingRequests, unreadConversations] = await Promise.all([
            this.prisma.booking.count({ where: { ownerId: userId, status: 'REQUESTED' } }),
            this.prisma.conversation.count({
                where: {
                    OR: [
                        { ownerId: userId, unreadOwnerCount: { gt: 0 } },
                        { guestId: userId, unreadGuestCount: { gt: 0 } },
                    ],
                },
            }),
        ]);
        return { bookingRequests, unreadConversations };
    }
    async getOwnerAttention(userId) {
        const items = [];
        const awaitingConfirmation = await this.prisma.booking.count({
            where: { ownerId: userId, status: 'AWAITING_PAYMENT' },
        });
        if (awaitingConfirmation) {
            items.push({ urgency: 'critical', title: 'payment_confirmation', actionUrl: '/kontrolna-tabla/rezervacije?role=owner&status=AWAITING_PAYMENT', count: awaitingConfirmation });
        }
        const termConflicts = await this.prisma.dispute.findMany({
            where: { type: 'TERM_CONFLICT', status: 'NEW', listing: { userId } },
            select: { listingId: true },
        });
        if (termConflicts.length) {
            const listingIds = [...new Set(termConflicts.map((d) => d.listingId))];
            items.push({ urgency: 'critical', title: 'term_conflict', actionUrl: availabilityUrl(listingIds, MY_LISTINGS_URL), count: termConflicts.length });
        }
        const failingFeeds = await this.prisma.icalSource.findMany({
            where: { active: true, failureCount: { gte: ical_availability_1.ICAL_FAILURE_ALERT_THRESHOLD }, listing: { userId, status: { not: 'DELETED' } } },
            select: { listingId: true },
        });
        if (failingFeeds.length) {
            const listingIds = [...new Set(failingFeeds.map((feed) => feed.listingId))];
            items.push({ urgency: 'critical', title: 'ical_sync_failed', actionUrl: icalUrl(listingIds, MY_LISTINGS_URL), count: failingFeeds.length });
        }
        const newRequests = await this.prisma.booking.count({ where: { ownerId: userId, status: 'REQUESTED' } });
        if (newRequests) {
            items.push({ urgency: 'decision', title: 'new_requests', actionUrl: '/kontrolna-tabla/rezervacije?role=owner&status=REQUESTED', count: newRequests });
        }
        const expiringSoon = await this.prisma.subscription.count({
            where: { userId, status: 'ACTIVE', expiresAt: { lt: new Date(Date.now() + 7 * 86_400_000) } },
        });
        if (expiringSoon) {
            items.push({ urgency: 'decision', title: 'subscription_expiring', actionUrl: '/kontrolna-tabla/pretplate', count: expiringSoon });
        }
        const rejectedListings = await this.prisma.listing.count({ where: { userId, status: 'REJECTED' } });
        if (rejectedListings) {
            items.push({ urgency: 'decision', title: 'rejected_listings', actionUrl: `${MY_LISTINGS_URL}?status=REJECTED`, count: rejectedListings });
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
            items.push({ urgency: 'critical', title: 'payment_deadline', actionUrl: '/kontrolna-tabla/rezervacije?role=guest&status=AWAITING_PAYMENT', count: awaitingPayment });
        }
        const pendingReviews = await this.reviews.getMyPendingReviews(userId);
        const ownerReviews = pendingReviews.filter((r) => r.direction === 'OWNER_TO_GUEST').length;
        const guestReviews = pendingReviews.length - ownerReviews;
        if (ownerReviews) {
            items.push({ urgency: 'info', title: 'pending_reviews_owner', actionUrl: '/kontrolna-tabla/rezervacije?role=owner&status=COMPLETED', count: ownerReviews });
        }
        if (guestReviews) {
            items.push({ urgency: 'info', title: 'pending_reviews_guest', actionUrl: '/kontrolna-tabla/rezervacije?role=guest&status=COMPLETED', count: guestReviews });
        }
        const unreadAsGuest = await this.prisma.conversation.count({ where: { guestId: userId, unreadGuestCount: { gt: 0 } } });
        if (unreadAsGuest) {
            items.push({ urgency: 'info', title: 'unread_messages_guest', actionUrl: '/kontrolna-tabla/poruke', count: unreadAsGuest });
        }
        return items;
    }
    async getStats(userId, isOwner) {
        const guestBookingCount = await this.prisma.booking.count({
            where: { guestId: userId, status: { in: ['CONFIRMED', 'COMPLETED'] } },
        });
        if (!isOwner) {
            return { listingCount: 0, bookingCount: guestBookingCount, confirmedValue: 0, avgRating: null };
        }
        const [listingCount, bookings, listings] = await Promise.all([
            this.prisma.listing.count({ where: { userId, status: 'ACTIVE' } }),
            this.prisma.booking.findMany({ where: { ownerId: userId, status: { in: ['CONFIRMED', 'COMPLETED'] } }, select: { totalAmount: true } }),
            this.prisma.listing.findMany({ where: { userId, reviewCount: { gt: 0 } }, select: { avgRating: true, reviewCount: true } }),
        ]);
        const confirmedValue = bookings.reduce((sum, b) => sum + Number((0, money_1.paraToRsd)(b.totalAmount)), 0);
        const totalReviews = listings.reduce((sum, l) => sum + l.reviewCount, 0);
        const avgRating = totalReviews
            ? listings.reduce((sum, l) => sum + (Number(l.avgRating) || 0) * l.reviewCount, 0) / totalReviews
            : null;
        return { listingCount, bookingCount: bookings.length + guestBookingCount, confirmedValue, avgRating };
    }
    async getOnboarding(userId) {
        const [listings, workingHoursCount, definedSlotCount, blockedTermCount, icalCount, user] = await Promise.all([
            this.prisma.listing.findMany({
                where: { userId, status: { not: 'DELETED' } },
                orderBy: { createdAt: 'asc' },
                select: { id: true, bookingModel: true, priceUnit: true },
            }),
            this.prisma.workingHours.count({ where: { listing: { userId } } }),
            this.prisma.definedSlot.count({ where: { listing: { userId } } }),
            this.prisma.blockedTerm.count({ where: { listing: { userId } } }),
            this.prisma.icalSource.count({ where: { listing: { userId } } }),
            this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { bankAccount: true } }),
        ]);
        const bookable = listings.filter((l) => l.bookingModel !== 'NO_BOOKING').map((l) => l.id);
        const icalCapable = listings.filter((l) => l.bookingModel === 'PER_STAY' && l.priceUnit !== 'MONTH').map((l) => l.id);
        const noListing = listings.length === 0;
        const steps = [{ key: 'listing', done: !noListing, actionUrl: NEW_LISTING_URL }];
        if (noListing || bookable.length) {
            const done = workingHoursCount + definedSlotCount + blockedTermCount > 0;
            steps.push({ key: 'availability', done, actionUrl: availabilityUrl(bookable) });
        }
        if (noListing || icalCapable.length) {
            steps.push({ key: 'ical', done: icalCount > 0, actionUrl: icalUrl(icalCapable) });
        }
        steps.push({ key: 'bankAccount', done: !!user.bankAccount, actionUrl: '/kontrolna-tabla/podesavanja' });
        return { steps, allDone: steps.every((step) => step.done) };
    }
    async getUpcoming(userId) {
        const now = Date.now();
        const bookings = await this.prisma.booking.findMany({
            where: {
                OR: [{ guestId: userId }, { ownerId: userId }],
                status: { in: UPCOMING_STATUSES },
                startsAt: { lt: new Date(now + 7 * 86_400_000) },
                endsAt: { gte: new Date(now) },
            },
            orderBy: { startsAt: 'asc' },
            select: {
                id: true,
                status: true,
                startsAt: true,
                endsAt: true,
                priceUnit: true,
                guestCount: true,
                guestId: true,
                listing: {
                    select: {
                        title: true,
                        slug: true,
                        categoryId: true,
                        city: { select: { name: true } },
                        cityArea: { select: { name: true } },
                    },
                },
                guest: { select: { firstName: true, lastName: true } },
                owner: { select: { firstName: true, lastName: true } },
            },
            take: 10,
        });
        const categoryIds = [...new Set(bookings.map((b) => b.listing.categoryId))];
        const countsChildren = new Map(await Promise.all(categoryIds.map(async (id) => {
            const attributes = await this.taxonomy.resolveAttributesForCategory(id);
            return [id, attributes.some((a) => a.key === 'kapacitet_dece')];
        })));
        return bookings.map((b) => {
            const asGuest = b.guestId === userId;
            return {
                id: b.id,
                status: b.status,
                startsAt: b.startsAt,
                endsAt: b.endsAt,
                priceUnit: b.priceUnit,
                guestCount: b.guestCount,
                guestUnit: countsChildren.get(b.listing.categoryId) ? 'children' : 'guests',
                role: asGuest ? 'guest' : 'owner',
                listing: {
                    title: b.listing.title,
                    slug: b.listing.slug,
                    place: b.listing.cityArea?.name ?? b.listing.city?.name ?? null,
                },
                counterpartName: shortName(asGuest ? b.owner : b.guest),
            };
        });
    }
};
exports.DashboardService = DashboardService;
exports.DashboardService = DashboardService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        reviews_service_1.ReviewsService,
        users_service_1.UsersService,
        taxonomy_service_1.TaxonomyService])
], DashboardService);
//# sourceMappingURL=dashboard.service.js.map