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
exports.ReviewEmailListener = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const event_emitter_1 = require("@nestjs/event-emitter");
const prisma_service_1 = require("../../../prisma/prisma.service");
const email_service_1 = require("../../../common/email/email.service");
let ReviewEmailListener = class ReviewEmailListener {
    constructor(prisma, email, config) {
        this.prisma = prisma;
        this.email = email;
        this.frontendUrl = config.get('frontendUrl');
    }
    async onBookingCompleted({ bookingId }) {
        const booking = await this.prisma.booking.findUnique({
            where: { id: bookingId },
            include: { listing: { select: { title: true } }, guest: true, owner: true },
        });
        if (!booking)
            return;
        await Promise.all([booking.guest, booking.owner].map((recipient) => this.email.send({
            key: 'review_invitation',
            to: recipient.email,
            language: recipient.language,
            userId: recipient.id,
            context: { oglas: booking.listing.title },
            buttonUrl: `${this.frontendUrl}/rezervacije/${booking.id}`,
        })));
    }
    async onPublished({ reviewIds }) {
        const reviews = await this.prisma.review.findMany({
            where: { id: { in: reviewIds } },
            include: { listing: { select: { title: true, slug: true } }, author: true, recipient: true },
        });
        for (const review of reviews) {
            await this.email.send({
                key: 'reviews_published',
                to: review.recipient.email,
                language: review.recipient.language,
                userId: review.recipient.id,
                context: { oglas: review.listing.title },
                buttonUrl: `${this.frontendUrl}/oglasi/${review.listing.slug}`,
            });
        }
    }
    async onReminder({ bookingId, userId }) {
        const [booking, user] = await Promise.all([
            this.prisma.booking.findUnique({ where: { id: bookingId }, include: { listing: { select: { title: true } } } }),
            this.prisma.user.findUnique({ where: { id: userId } }),
        ]);
        if (!booking || !user)
            return;
        await this.email.send({
            key: 'review_reminder_7d',
            to: user.email,
            language: user.language,
            userId,
            context: { oglas: booking.listing.title },
            buttonUrl: `${this.frontendUrl}/rezervacije/${bookingId}`,
        });
    }
    async onReplied({ reviewId }) {
        const review = await this.prisma.review.findUnique({
            where: { id: reviewId },
            include: { listing: { select: { title: true, slug: true } }, author: true },
        });
        if (!review)
            return;
        await this.email.send({
            key: 'review_replied',
            to: review.author.email,
            language: review.author.language,
            userId: review.author.id,
            context: { oglas: review.listing.title },
            buttonUrl: `${this.frontendUrl}/oglasi/${review.listing.slug}`,
        });
    }
};
exports.ReviewEmailListener = ReviewEmailListener;
__decorate([
    (0, event_emitter_1.OnEvent)('booking.completed'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ReviewEmailListener.prototype, "onBookingCompleted", null);
__decorate([
    (0, event_emitter_1.OnEvent)('review.published'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ReviewEmailListener.prototype, "onPublished", null);
__decorate([
    (0, event_emitter_1.OnEvent)('review.reminder'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ReviewEmailListener.prototype, "onReminder", null);
__decorate([
    (0, event_emitter_1.OnEvent)('review.replied'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ReviewEmailListener.prototype, "onReplied", null);
exports.ReviewEmailListener = ReviewEmailListener = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        email_service_1.EmailService,
        config_1.ConfigService])
], ReviewEmailListener);
//# sourceMappingURL=review-email.listener.js.map