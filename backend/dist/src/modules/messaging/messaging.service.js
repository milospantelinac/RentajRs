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
exports.MessagingService = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const nestjs_i18n_1 = require("nestjs-i18n");
const prisma_service_1 = require("../../prisma/prisma.service");
const uploads_service_1 = require("../../common/uploads/uploads.service");
const contact_detector_1 = require("../../common/utils/contact-detector");
const money_1 = require("../../common/utils/money");
const ATTACHMENT_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
let MessagingService = class MessagingService {
    constructor(prisma, uploads, i18n, events) {
        this.prisma = prisma;
        this.uploads = uploads;
        this.i18n = i18n;
        this.events = events;
    }
    async startConversation(guestId, dto) {
        const listing = await this.prisma.listing.findUniqueOrThrow({
            where: { id: dto.listingId },
            include: { subscription: { include: { package: true } } },
        });
        if (listing.userId === guestId)
            throw new common_1.BadRequestException('Cannot message your own listing');
        const existing = await this.prisma.conversation.findFirst({
            where: { listingId: dto.listingId, guestId, bookingId: dto.bookingId ?? null },
        });
        if (existing) {
            return this.sendMessage(guestId, existing.id, dto.content);
        }
        if (!listing.subscription?.package.hasMessaging) {
            throw new common_1.ForbiddenException(this.i18n.t('errors.PACKAGE_FEATURE_NOT_INCLUDED'));
        }
        await this.assertDailyLimitNotReached(guestId);
        const conversation = await this.prisma.conversation.create({
            data: { listingId: dto.listingId, guestId, ownerId: listing.userId, bookingId: dto.bookingId },
        });
        return this.sendMessage(guestId, conversation.id, dto.content);
    }
    async assertDailyLimitNotReached(guestId) {
        const setting = await this.prisma.setting.findUnique({ where: { key: 'daily_new_conversation_limit' } });
        const limit = setting?.value ?? 10;
        const since = new Date();
        since.setHours(0, 0, 0, 0);
        const newConversationsToday = await this.prisma.$queryRaw `
      SELECT c."id" FROM "Conversation" c
      JOIN "Message" m ON m."conversationId" = c."id"
      WHERE c."guestId" = ${guestId}::uuid
      GROUP BY c."id"
      HAVING MIN(m."sentAt") >= ${since}
    `;
        if (newConversationsToday.length >= limit) {
            throw new common_1.BadRequestException(this.i18n.t('errors.RATE_LIMITED'));
        }
    }
    async sendMessage(userId, conversationId, content) {
        const conversation = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
        if (!conversation)
            throw new common_1.NotFoundException();
        if (conversation.guestId !== userId && conversation.ownerId !== userId)
            throw new common_1.ForbiddenException();
        const isGuest = conversation.guestId === userId;
        const bookingConfirmed = conversation.bookingId
            ? await this.prisma.booking.count({ where: { id: conversation.bookingId, status: { in: ['CONFIRMED', 'COMPLETED'] } } })
            : 0;
        const flagContact = !bookingConfirmed && (0, contact_detector_1.containsContactInfo)(content);
        const message = await this.prisma.message.create({
            data: { conversationId, senderId: userId, content, containsContact: flagContact },
        });
        await this.prisma.conversation.update({
            where: { id: conversationId },
            data: {
                lastMessageAt: new Date(),
                ...(isGuest ? { unreadOwnerCount: { increment: 1 } } : { unreadGuestCount: { increment: 1 } }),
            },
        });
        this.events.emit('messaging.new_message', { conversationId, messageId: message.id, senderId: userId });
        return message;
    }
    async addAttachment(userId, messageId, file) {
        const message = await this.prisma.message.findUnique({ where: { id: messageId }, include: { conversation: true } });
        if (!message)
            throw new common_1.NotFoundException();
        if (message.senderId !== userId)
            throw new common_1.ForbiddenException();
        const { url } = file.mimetype === 'application/pdf'
            ? await this.uploads.saveRawFile(file, 'messages', ATTACHMENT_ALLOWED_TYPES, 5)
            : await this.uploads.saveImage(file, 'messages', { maxWidth: 1600, maxSizeMb: 5 });
        return this.prisma.messageAttachment.create({
            data: { messageId, url, type: file.mimetype, size: file.size, filename: file.originalname },
        });
    }
    async listConversations(userId) {
        const conversations = await this.prisma.conversation.findMany({
            where: { OR: [{ guestId: userId }, { ownerId: userId }] },
            orderBy: { lastMessageAt: 'desc' },
            include: {
                listing: { select: { id: true, title: true, slug: true } },
                booking: { select: { id: true, status: true, startsAt: true, endsAt: true, totalAmount: true } },
                guest: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
                owner: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
            },
        });
        return conversations
            .map((c) => ({
            ...c,
            booking: c.booking ? { ...c.booking, totalAmount: (0, money_1.paraToRsd)(c.booking.totalAmount) } : null,
            unreadCount: c.guestId === userId ? c.unreadGuestCount : c.unreadOwnerCount,
            counterpart: c.guestId === userId ? c.owner : c.guest,
        }))
            .sort((a, b) => (b.unreadCount > 0 ? 1 : 0) - (a.unreadCount > 0 ? 1 : 0));
    }
    async getConversation(userId, conversationId) {
        const conversation = await this.prisma.conversation.findUnique({
            where: { id: conversationId },
            include: {
                listing: { select: { id: true, title: true, slug: true } },
                booking: true,
                guest: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
                owner: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
                messages: {
                    orderBy: { sentAt: 'asc' },
                    include: { attachments: true, sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
                },
            },
        });
        if (!conversation)
            throw new common_1.NotFoundException();
        if (conversation.guestId !== userId && conversation.ownerId !== userId)
            throw new common_1.ForbiddenException();
        await this.markRead(userId, conversationId);
        return {
            ...conversation,
            counterpart: conversation.guestId === userId ? conversation.owner : conversation.guest,
            booking: conversation.booking
                ? {
                    ...conversation.booking,
                    pricePerUnit: (0, money_1.paraToRsd)(conversation.booking.pricePerUnit),
                    totalAmount: (0, money_1.paraToRsd)(conversation.booking.totalAmount),
                    amountDue: (0, money_1.paraToRsd)(conversation.booking.amountDue),
                }
                : null,
        };
    }
    async markRead(userId, conversationId) {
        const conversation = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
        if (!conversation)
            throw new common_1.NotFoundException();
        const isGuest = conversation.guestId === userId;
        await this.prisma.$transaction([
            this.prisma.conversation.update({
                where: { id: conversationId },
                data: isGuest ? { unreadGuestCount: 0 } : { unreadOwnerCount: 0 },
            }),
            this.prisma.message.updateMany({
                where: { conversationId, senderId: { not: userId }, readAt: null },
                data: { readAt: new Date() },
            }),
        ]);
    }
};
exports.MessagingService = MessagingService;
exports.MessagingService = MessagingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        uploads_service_1.UploadsService,
        nestjs_i18n_1.I18nService,
        event_emitter_1.EventEmitter2])
], MessagingService);
//# sourceMappingURL=messaging.service.js.map