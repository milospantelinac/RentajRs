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
const short_name_1 = require("../../common/utils/short-name");
const ATTACHMENT_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const PREVIEW_LENGTH = 160;
const OPEN_BOOKING_STATUSES = ['REQUESTED', 'AWAITING_PAYMENT', 'CONFIRMED'];
const PERSON_SELECT = {
    firstName: true,
    lastName: true,
    avatarUrl: true,
    anonymizedAt: true,
};
const LISTING_SELECT = {
    title: true,
    city: { select: { name: true } },
    cityArea: { select: { name: true } },
};
const BOOKING_SELECT = {
    id: true,
    status: true,
    startsAt: true,
    endsAt: true,
    priceUnit: true,
};
function serializePerson(person) {
    if (person.anonymizedAt)
        return { name: null, initials: null, avatarUrl: null, removed: true };
    const initials = `${person.firstName.trim().charAt(0)}${person.lastName.trim().charAt(0)}`.toUpperCase();
    return { name: (0, short_name_1.shortName)(person), initials, avatarUrl: person.avatarUrl, removed: false };
}
function serializeListing(listing) {
    return { title: listing.title, place: listing.cityArea?.name ?? listing.city?.name ?? null };
}
function previewText(content) {
    const text = content.replace(/\s+/g, ' ').trim();
    return text.length > PREVIEW_LENGTH ? text.slice(0, PREVIEW_LENGTH) : text;
}
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
            include: { subscription: { include: { package: true } }, user: { select: { anonymizedAt: true } } },
        });
        if (listing.userId === guestId)
            throw new common_1.BadRequestException('Cannot message your own listing');
        if (dto.bookingId) {
            const booking = await this.prisma.booking.findFirst({
                where: { id: dto.bookingId, listingId: dto.listingId, guestId },
                select: { id: true },
            });
            if (!booking)
                throw new common_1.NotFoundException();
        }
        const existing = await this.prisma.conversation.findFirst({
            where: { listingId: dto.listingId, guestId, bookingId: dto.bookingId ?? null },
        });
        if (existing) {
            return this.sendMessage(guestId, existing.id, dto.content);
        }
        if (listing.user.anonymizedAt) {
            throw new common_1.BadRequestException(this.i18n.t('errors.CONVERSATION_ACCOUNT_REMOVED'));
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
        const conversation = await this.prisma.conversation.findUnique({
            where: { id: conversationId },
            include: { guest: { select: { anonymizedAt: true } }, owner: { select: { anonymizedAt: true } } },
        });
        if (!conversation)
            throw new common_1.NotFoundException();
        if (conversation.guestId !== userId && conversation.ownerId !== userId)
            throw new common_1.ForbiddenException();
        const isGuest = conversation.guestId === userId;
        const recipient = isGuest ? conversation.owner : conversation.guest;
        if (recipient.anonymizedAt) {
            throw new common_1.BadRequestException(this.i18n.t('errors.CONVERSATION_ACCOUNT_REMOVED'));
        }
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
        if (!file)
            throw new common_1.BadRequestException(this.i18n.t('errors.FILE_REQUIRED'));
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
            orderBy: { lastMessageAt: { sort: 'desc', nulls: 'last' } },
            select: {
                id: true,
                guestId: true,
                unreadGuestCount: true,
                unreadOwnerCount: true,
                listing: { select: LISTING_SELECT },
                guest: { select: PERSON_SELECT },
                owner: { select: PERSON_SELECT },
                messages: {
                    orderBy: { sentAt: 'desc' },
                    take: 1,
                    select: {
                        content: true,
                        sentAt: true,
                        senderId: true,
                        attachments: { select: { filename: true }, take: 1 },
                    },
                },
            },
        });
        return conversations
            .map((c) => {
            const isGuest = c.guestId === userId;
            const [last] = c.messages;
            return {
                id: c.id,
                role: isGuest ? 'guest' : 'owner',
                counterpart: serializePerson(isGuest ? c.owner : c.guest),
                listing: serializeListing(c.listing),
                lastMessage: last
                    ? {
                        text: previewText(last.content),
                        sentAt: last.sentAt,
                        mine: last.senderId === userId,
                        attachment: last.attachments[0]?.filename ?? null,
                    }
                    : null,
                unreadCount: isGuest ? c.unreadGuestCount : c.unreadOwnerCount,
            };
        })
            .sort((a, b) => (b.unreadCount > 0 ? 1 : 0) - (a.unreadCount > 0 ? 1 : 0));
    }
    async getConversation(userId, conversationId) {
        const conversation = await this.prisma.conversation.findUnique({
            where: { id: conversationId },
            select: {
                id: true,
                listingId: true,
                guestId: true,
                ownerId: true,
                bookingId: true,
                listing: { select: LISTING_SELECT },
                guest: { select: PERSON_SELECT },
                owner: { select: PERSON_SELECT },
                messages: {
                    orderBy: { sentAt: 'asc' },
                    select: {
                        id: true,
                        content: true,
                        sentAt: true,
                        senderId: true,
                        attachments: { select: { id: true, url: true, type: true, filename: true } },
                    },
                },
            },
        });
        if (!conversation)
            throw new common_1.NotFoundException();
        if (conversation.guestId !== userId && conversation.ownerId !== userId)
            throw new common_1.ForbiddenException();
        await this.clearUnread(conversation, userId);
        const isGuest = conversation.guestId === userId;
        const counterpart = serializePerson(isGuest ? conversation.owner : conversation.guest);
        return {
            id: conversation.id,
            role: isGuest ? 'guest' : 'owner',
            counterpart,
            listing: serializeListing(conversation.listing),
            booking: await this.findHeaderBooking(conversation),
            canReply: !counterpart.removed,
            messages: conversation.messages.map((m) => ({
                id: m.id,
                text: m.content,
                sentAt: m.sentAt,
                mine: m.senderId === userId,
                attachments: m.attachments,
            })),
        };
    }
    async markRead(userId, conversationId) {
        const conversation = await this.prisma.conversation.findUnique({
            where: { id: conversationId },
            select: { id: true, guestId: true, ownerId: true },
        });
        if (!conversation)
            throw new common_1.NotFoundException();
        if (conversation.guestId !== userId && conversation.ownerId !== userId)
            throw new common_1.ForbiddenException();
        await this.clearUnread(conversation, userId);
    }
    async clearUnread(conversation, userId) {
        const isGuest = conversation.guestId === userId;
        await this.prisma.$transaction([
            this.prisma.conversation.update({
                where: { id: conversation.id },
                data: isGuest ? { unreadGuestCount: 0 } : { unreadOwnerCount: 0 },
            }),
            this.prisma.message.updateMany({
                where: { conversationId: conversation.id, senderId: { not: userId }, readAt: null },
                data: { readAt: new Date() },
            }),
        ]);
    }
    async findHeaderBooking(conversation) {
        const parties = { listingId: conversation.listingId, guestId: conversation.guestId, ownerId: conversation.ownerId };
        if (conversation.bookingId) {
            const own = await this.prisma.booking.findFirst({
                where: { id: conversation.bookingId, ...parties },
                select: BOOKING_SELECT,
            });
            if (own)
                return own;
        }
        const open = await this.prisma.booking.findFirst({
            where: { ...parties, status: { in: OPEN_BOOKING_STATUSES }, endsAt: { gt: new Date() } },
            orderBy: { startsAt: 'asc' },
            select: BOOKING_SELECT,
        });
        if (open)
            return open;
        return this.prisma.booking.findFirst({
            where: parties,
            orderBy: { createdAt: 'desc' },
            select: BOOKING_SELECT,
        });
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