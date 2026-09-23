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
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../prisma/prisma.service");
const review_window_1 = require("../../common/utils/review-window");
function reviewView(review, editDays, now = new Date()) {
    const editableUntil = (0, review_window_1.getReviewEditableUntil)(review.publishedAt, editDays);
    const editable = now <= editableUntil;
    return {
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        writtenAt: review.writtenAt,
        publishedAt: review.publishedAt,
        editable,
        editableUntil: editable ? editableUntil : null,
    };
}
let ReviewsService = class ReviewsService {
    constructor(prisma, i18n, events) {
        this.prisma = prisma;
        this.i18n = i18n;
        this.events = events;
    }
    async createReview(authorId, dto) {
        const booking = await this.prisma.booking.findUnique({ where: { id: dto.bookingId } });
        if (!booking)
            throw new common_1.NotFoundException();
        if (booking.guestId !== authorId)
            throw new common_1.ForbiddenException();
        if (booking.status !== 'COMPLETED') {
            throw new common_1.BadRequestException('Reviews can only be left for a completed booking');
        }
        const [existing, reviewBy, editDays] = await Promise.all([
            this.prisma.review.findUnique({ where: { bookingId: booking.id } }),
            (0, review_window_1.readReviewDeadline)(this.prisma, booking),
            (0, review_window_1.readReviewEditDays)(this.prisma),
        ]);
        if (existing)
            throw new common_1.BadRequestException(this.i18n.t('errors.REVIEW_ALREADY_EXISTS'));
        if (new Date() > reviewBy)
            throw new common_1.BadRequestException(this.i18n.t('errors.REVIEW_WINDOW_CLOSED'));
        let review;
        try {
            review = await this.prisma.review.create({
                data: {
                    bookingId: booking.id,
                    authorId,
                    recipientId: booking.ownerId,
                    listingId: booking.listingId,
                    rating: dto.rating,
                    comment: dto.comment?.trim() || null,
                },
            });
        }
        catch (err) {
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                throw new common_1.BadRequestException(this.i18n.t('errors.REVIEW_ALREADY_EXISTS'));
            }
            throw err;
        }
        await this.refreshListingRating(booking.listingId);
        this.events.emit('review.published', { reviewId: review.id });
        return reviewView(review, editDays);
    }
    async updateReview(authorId, reviewId, dto) {
        const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
        if (!review)
            throw new common_1.NotFoundException();
        if (review.authorId !== authorId)
            throw new common_1.ForbiddenException();
        const editDays = await (0, review_window_1.readReviewEditDays)(this.prisma);
        const now = new Date();
        if (now > (0, review_window_1.getReviewEditableUntil)(review.publishedAt, editDays)) {
            throw new common_1.BadRequestException(this.i18n.t('errors.REVIEW_EDIT_CLOSED'));
        }
        const updated = await this.prisma.review.update({
            where: { id: reviewId },
            data: { rating: dto.rating, comment: dto.comment?.trim() || null },
        });
        await this.refreshListingRating(review.listingId);
        return reviewView(updated, editDays, now);
    }
    async refreshListingRating(listingId) {
        const visible = await this.prisma.review.findMany({
            where: { listingId, hiddenByAdmin: false },
            select: { rating: true },
        });
        const avg = visible.length ? visible.reduce((sum, r) => sum + r.rating, 0) / visible.length : null;
        await this.prisma.listing.update({
            where: { id: listingId },
            data: { avgRating: avg, reviewCount: visible.length },
        });
    }
    async replyToReview(ownerId, reviewId, dto) {
        const review = await this.prisma.review.findUniqueOrThrow({ where: { id: reviewId } });
        if (review.recipientId !== ownerId)
            throw new common_1.ForbiddenException();
        const existing = await this.prisma.reviewReply.findUnique({ where: { reviewId } });
        if (existing)
            throw new common_1.BadRequestException('This review already has a reply');
        const reply = await this.prisma.reviewReply.create({ data: { reviewId, authorId: ownerId, content: dto.content } });
        this.events.emit('review.replied', { reviewId });
        return reply;
    }
    async getListingReviews(listingId) {
        const reviews = await this.prisma.review.findMany({
            where: { listingId, hiddenByAdmin: false },
            orderBy: { publishedAt: 'desc' },
            include: {
                author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
                reply: true,
            },
        });
        return reviews.map(({ author, reply, ...review }) => ({
            id: review.id,
            rating: review.rating,
            comment: review.comment,
            writtenAt: review.writtenAt,
            publishedAt: review.publishedAt,
            author: {
                id: author.id,
                firstName: author.firstName,
                lastInitial: author.lastName?.trim().charAt(0) || null,
                avatarUrl: author.avatarUrl,
            },
            reply: reply ? { content: reply.content, createdAt: reply.createdAt } : null,
        }));
    }
    async getBookingReviewStatus(userId, bookingId) {
        const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
        if (!booking)
            throw new common_1.NotFoundException();
        if (booking.guestId !== userId)
            throw new common_1.ForbiddenException();
        const completed = booking.status === 'COMPLETED';
        const [mine, reviewBy, editDays] = await Promise.all([
            this.prisma.review.findUnique({ where: { bookingId } }),
            completed ? (0, review_window_1.readReviewDeadline)(this.prisma, booking) : null,
            (0, review_window_1.readReviewEditDays)(this.prisma),
        ]);
        const now = new Date();
        return {
            canReview: !!reviewBy && !mine && now <= reviewBy,
            myReview: mine ? reviewView(mine, editDays, now) : null,
        };
    }
    async getMyPendingReviews(userId) {
        const [completed, windowDays] = await Promise.all([
            this.prisma.booking.findMany({
                where: { guestId: userId, status: 'COMPLETED', review: { is: null } },
                include: {
                    listing: { select: { title: true, slug: true } },
                    history: { where: { newStatus: 'COMPLETED' }, orderBy: { changedAt: 'desc' }, take: 1, select: { changedAt: true } },
                },
            }),
            (0, review_window_1.readReviewWindowDays)(this.prisma),
        ]);
        const now = new Date();
        return completed
            .filter((booking) => now <= (0, review_window_1.getReviewDeadline)(booking.history[0]?.changedAt ?? booking.endsAt, windowDays))
            .map((booking) => ({ bookingId: booking.id, listing: booking.listing }));
    }
    async adminHideReview(adminId, reviewId) {
        await this.prisma.review.update({ where: { id: reviewId }, data: { hiddenByAdmin: true } });
        const review = await this.prisma.review.findUniqueOrThrow({ where: { id: reviewId } });
        await this.refreshListingRating(review.listingId);
        void adminId;
        return { message: this.i18n.t('common.SUCCESS') };
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
            const booking = await this.prisma.booking.findUnique({ where: { id: bookingId }, include: { review: { select: { id: true } } } });
            if (!booking || booking.review)
                continue;
            const reviewBy = await (0, review_window_1.readReviewDeadline)(this.prisma, booking);
            if (new Date() > reviewBy)
                continue;
            this.events.emit('review.reminder', { bookingId, userId: booking.guestId, reviewBy });
        }
    }
};
exports.ReviewsService = ReviewsService;
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