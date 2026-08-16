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
exports.ReviewsService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const event_emitter_1 = require("@nestjs/event-emitter");
const nestjs_i18n_1 = require("nestjs-i18n");
const prisma_service_1 = require("../../prisma/prisma.service");
const DEFAULT_REVIEW_WINDOW_DAYS = 14;
let ReviewsService = class ReviewsService {
    constructor(prisma, i18n, events) {
        this.prisma = prisma;
        this.i18n = i18n;
        this.events = events;
    }
    async createReview(authorId, dto) {
        const booking = await this.prisma.booking.findUniqueOrThrow({ where: { id: dto.bookingId } });
        if (booking.status !== 'COMPLETED') {
            throw new common_1.BadRequestException('Reviews can only be left for a completed booking');
        }
        let direction;
        let recipientId;
        if (booking.guestId === authorId) {
            direction = 'GUEST_TO_OWNER';
            recipientId = booking.ownerId;
        }
        else if (booking.ownerId === authorId) {
            direction = 'OWNER_TO_GUEST';
            recipientId = booking.guestId;
        }
        else {
            throw new common_1.ForbiddenException();
        }
        const existing = await this.prisma.review.findUnique({
            where: { bookingId_direction: { bookingId: booking.id, direction } },
        });
        if (existing)
            throw new common_1.BadRequestException('You have already reviewed this booking');
        if (direction === 'OWNER_TO_GUEST' && dto.tags?.length) {
        }
        const review = await this.prisma.review.create({
            data: {
                bookingId: booking.id,
                authorId,
                recipientId,
                listingId: booking.listingId,
                direction,
                rating: dto.rating,
                comment: dto.comment,
            },
        });
        if (direction === 'OWNER_TO_GUEST' && dto.tags?.length) {
            await this.prisma.reviewTagRow.createMany({
                data: dto.tags.map((tag) => ({ reviewId: review.id, tag })),
            });
        }
        await this.tryPublishPair(booking.id);
        this.events.emit('review.written', { reviewId: review.id, bookingId: booking.id, direction });
        return review;
    }
    async tryPublishPair(bookingId) {
        const reviews = await this.prisma.review.findMany({ where: { bookingId } });
        if (reviews.length < 2)
            return;
        await this.publishReviews(reviews.map((r) => r.id));
    }
    async publishReviews(reviewIds) {
        const now = new Date();
        await this.prisma.review.updateMany({
            where: { id: { in: reviewIds }, published: false },
            data: { published: true, publishedAt: now },
        });
        for (const reviewId of reviewIds) {
            const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
            if (!review)
                continue;
            await this.refreshListingRating(review.listingId);
        }
        this.events.emit('review.published', { reviewIds });
    }
    async refreshListingRating(listingId) {
        const published = await this.prisma.review.findMany({
            where: { listingId, published: true, hiddenByAdmin: false, direction: 'GUEST_TO_OWNER' },
            select: { rating: true },
        });
        const avg = published.length ? published.reduce((sum, r) => sum + r.rating, 0) / published.length : null;
        await this.prisma.listing.update({
            where: { id: listingId },
            data: { avgRating: avg, reviewCount: published.length },
        });
    }
    async replyToReview(ownerId, reviewId, dto) {
        const review = await this.prisma.review.findUniqueOrThrow({ where: { id: reviewId } });
        if (review.direction !== 'GUEST_TO_OWNER' || review.recipientId !== ownerId)
            throw new common_1.ForbiddenException();
        if (!review.published)
            throw new common_1.BadRequestException('Review is not published yet');
        const existing = await this.prisma.reviewReply.findUnique({ where: { reviewId } });
        if (existing)
            throw new common_1.BadRequestException('This review already has a reply');
        const reply = await this.prisma.reviewReply.create({ data: { reviewId, authorId: ownerId, content: dto.content } });
        this.events.emit('review.replied', { reviewId });
        return reply;
    }
    async getListingReviews(listingId) {
        return this.prisma.review.findMany({
            where: { listingId, published: true, hiddenByAdmin: false, direction: 'GUEST_TO_OWNER' },
            orderBy: { publishedAt: 'desc' },
            include: {
                author: { select: { id: true, firstName: true, avatarUrl: true } },
                tags: true,
                reply: true,
            },
        });
    }
    async getBookingReviewStatus(userId, bookingId) {
        const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
        if (!booking)
            throw new common_1.NotFoundException();
        if (booking.guestId !== userId && booking.ownerId !== userId)
            throw new common_1.ForbiddenException();
        const myDirection = booking.guestId === userId ? 'GUEST_TO_OWNER' : 'OWNER_TO_GUEST';
        const counterpartDirection = myDirection === 'GUEST_TO_OWNER' ? 'OWNER_TO_GUEST' : 'GUEST_TO_OWNER';
        const reviews = await this.prisma.review.findMany({ where: { bookingId }, include: { tags: true } });
        const mine = reviews.find((r) => r.direction === myDirection) ?? null;
        const counterpart = reviews.find((r) => r.direction === counterpartDirection) ?? null;
        return {
            canReview: booking.status === 'COMPLETED' && !mine,
            direction: myDirection,
            myReview: mine,
            counterpartHasReviewed: !!counterpart,
            counterpartReview: counterpart?.published ? counterpart : null,
        };
    }
    async getMyPendingReviews(userId) {
        const completed = await this.prisma.booking.findMany({
            where: { OR: [{ guestId: userId }, { ownerId: userId }], status: 'COMPLETED' },
            include: { listing: { select: { title: true, slug: true } }, reviews: true },
        });
        return completed
            .filter((b) => {
            const direction = b.guestId === userId ? 'GUEST_TO_OWNER' : 'OWNER_TO_GUEST';
            return !b.reviews.some((r) => r.direction === direction);
        })
            .map((b) => ({ bookingId: b.id, listing: b.listing }));
    }
    async adminHideReview(adminId, reviewId) {
        await this.prisma.review.update({ where: { id: reviewId }, data: { hiddenByAdmin: true } });
        const review = await this.prisma.review.findUniqueOrThrow({ where: { id: reviewId } });
        await this.refreshListingRating(review.listingId);
        void adminId;
        return { message: this.i18n.t('common.SUCCESS') };
    }
    async publishOverdueReviews() {
        const windowDays = await this.getReviewWindowDays();
        const cutoff = new Date(Date.now() - windowDays * 86_400_000);
        const overdue = await this.prisma.review.findMany({
            where: { published: false, writtenAt: { lt: cutoff } },
        });
        for (const review of overdue) {
            await this.publishReviews([review.id]);
        }
    }
    async getReviewWindowDays() {
        const setting = await this.prisma.setting.findUnique({ where: { key: 'review_window_days' } });
        return typeof setting?.value === 'number' ? setting.value : DEFAULT_REVIEW_WINDOW_DAYS;
    }
    async sendReviewReminders() {
        const start = new Date(Date.now() - 7 * 86_400_000);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setHours(23, 59, 59, 999);
        const candidates = await this.prisma.bookingHistory.findMany({
            where: { newStatus: 'COMPLETED', automatic: true, changedAt: { gte: start, lte: end } },
            select: { bookingId: true },
        });
        for (const { bookingId } of candidates) {
            const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
            if (!booking)
                continue;
            const reviews = await this.prisma.review.findMany({ where: { bookingId } });
            const guestReviewed = reviews.some((r) => r.direction === 'GUEST_TO_OWNER');
            const ownerReviewed = reviews.some((r) => r.direction === 'OWNER_TO_GUEST');
            if (!guestReviewed)
                this.events.emit('review.reminder', { bookingId, userId: booking.guestId });
            if (!ownerReviewed)
                this.events.emit('review.reminder', { bookingId, userId: booking.ownerId });
        }
    }
};
exports.ReviewsService = ReviewsService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_DAY_AT_2AM),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ReviewsService.prototype, "publishOverdueReviews", null);
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_DAY_AT_9AM),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ReviewsService.prototype, "sendReviewReminders", null);
exports.ReviewsService = ReviewsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        nestjs_i18n_1.I18nService,
        event_emitter_1.EventEmitter2])
], ReviewsService);
//# sourceMappingURL=reviews.service.js.map