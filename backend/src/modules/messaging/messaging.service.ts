import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadsService } from '../../common/uploads/uploads.service';
import { containsContactInfo } from '../../common/utils/contact-detector';
import { paraToRsd } from '../../common/utils/money';
import { StartConversationDto } from './dto/messaging.dto';

const ATTACHMENT_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

@Injectable()
export class MessagingService {
  constructor(
    private prisma: PrismaService,
    private uploads: UploadsService,
    private i18n: I18nService,
    private events: EventEmitter2,
  ) {}

  /** R76/R77 — a fresh question-before-booking thread; daily new-conversation cap only applies here. */
  async startConversation(guestId: string, dto: StartConversationDto) {
    const listing = await this.prisma.listing.findUniqueOrThrow({
      where: { id: dto.listingId },
      include: { subscription: { include: { package: true } } },
    });
    if (listing.userId === guestId) throw new BadRequestException('Cannot message your own listing');

    const existing = await this.prisma.conversation.findFirst({
      where: { listingId: dto.listingId, guestId, bookingId: dto.bookingId ?? null },
    });
    if (existing) {
      // Replying is never gated by package (R77 only limits *new* threads) —
      // a downgrade shouldn't strand an already-open conversation.
      return this.sendMessage(guestId, existing.id, dto.content);
    }

    // R108 — Osnovni/BASIC doesn't include internal messaging; the owner's
    // phone number is the contact point instead.
    if (!listing.subscription?.package.hasMessaging) {
      throw new ForbiddenException(this.i18n.t('errors.PACKAGE_FEATURE_NOT_INCLUDED'));
    }

    await this.assertDailyLimitNotReached(guestId);

    const conversation = await this.prisma.conversation.create({
      data: { listingId: dto.listingId, guestId, ownerId: listing.userId, bookingId: dto.bookingId },
    });
    return this.sendMessage(guestId, conversation.id, dto.content);
  }

  /** R77: caps *new* conversations per day; replying in an existing one is never limited. */
  private async assertDailyLimitNotReached(guestId: string) {
    const setting = await this.prisma.setting.findUnique({ where: { key: 'daily_new_conversation_limit' } });
    const limit = (setting?.value as number) ?? 10;

    const since = new Date();
    since.setHours(0, 0, 0, 0);

    const newConversationsToday = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT c."id" FROM "Conversation" c
      JOIN "Message" m ON m."conversationId" = c."id"
      WHERE c."guestId" = ${guestId}::uuid
      GROUP BY c."id"
      HAVING MIN(m."sentAt") >= ${since}
    `;

    if (newConversationsToday.length >= limit) {
      throw new BadRequestException(this.i18n.t('errors.RATE_LIMITED'));
    }
  }

  async sendMessage(userId: string, conversationId: string, content: string) {
    const conversation = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation) throw new NotFoundException();
    if (conversation.guestId !== userId && conversation.ownerId !== userId) throw new ForbiddenException();

    const isGuest = conversation.guestId === userId;
    // R78/R80: contact info is only tracked before the booking is confirmed.
    const bookingConfirmed = conversation.bookingId
      ? await this.prisma.booking.count({ where: { id: conversation.bookingId, status: { in: ['CONFIRMED', 'COMPLETED'] } } })
      : 0;
    const flagContact = !bookingConfirmed && containsContactInfo(content);

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

  async addAttachment(userId: string, messageId: string, file: Express.Multer.File) {
    const message = await this.prisma.message.findUnique({ where: { id: messageId }, include: { conversation: true } });
    if (!message) throw new NotFoundException();
    if (message.senderId !== userId) throw new ForbiddenException();

    const { url } = file.mimetype === 'application/pdf'
      ? await this.uploads.saveRawFile(file, 'messages', ATTACHMENT_ALLOWED_TYPES, 5)
      : await this.uploads.saveImage(file, 'messages', { maxWidth: 1600, maxSizeMb: 5 });

    return this.prisma.messageAttachment.create({
      data: { messageId, url, type: file.mimetype, size: file.size, filename: file.originalname },
    });
  }

  async listConversations(userId: string) {
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

    // R82: unread conversations first.
    return conversations
      .map((c) => ({
        ...c,
        booking: c.booking ? { ...c.booking, totalAmount: paraToRsd(c.booking.totalAmount) } : null,
        unreadCount: c.guestId === userId ? c.unreadGuestCount : c.unreadOwnerCount,
        counterpart: c.guestId === userId ? c.owner : c.guest,
      }))
      .sort((a, b) => (b.unreadCount > 0 ? 1 : 0) - (a.unreadCount > 0 ? 1 : 0));
  }

  async getConversation(userId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        listing: { select: { id: true, title: true, slug: true } },
        booking: true,
        messages: {
          orderBy: { sentAt: 'asc' },
          include: { attachments: true, sender: { select: { id: true, firstName: true, avatarUrl: true } } },
        },
      },
    });
    if (!conversation) throw new NotFoundException();
    if (conversation.guestId !== userId && conversation.ownerId !== userId) throw new ForbiddenException();

    await this.markRead(userId, conversationId);
    return {
      ...conversation,
      booking: conversation.booking
        ? {
            ...conversation.booking,
            pricePerUnit: paraToRsd(conversation.booking.pricePerUnit),
            totalAmount: paraToRsd(conversation.booking.totalAmount),
            amountDue: paraToRsd(conversation.booking.amountDue),
          }
        : null,
    };
  }

  async markRead(userId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation) throw new NotFoundException();
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
}
