import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BookingStatus, Prisma } from '@prisma/client';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadsService } from '../../common/uploads/uploads.service';
import { containsContactInfo } from '../../common/utils/contact-detector';
import { shortName } from '../../common/utils/short-name';
import { StartConversationDto } from './dto/messaging.dto';

const ATTACHMENT_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

// Dizajn 37: a list row shows one line of the latest message, so it gets no
// more than this much of it.
const PREVIEW_LENGTH = 160;

// Bookings still under way, which the conversation header names first.
const OPEN_BOOKING_STATUSES: BookingStatus[] = ['REQUESTED', 'AWAITING_PAYMENT', 'CONFIRMED'];

// What the page shows of the other side: never the last name or the email.
const PERSON_SELECT = {
  firstName: true,
  lastName: true,
  avatarUrl: true,
  anonymizedAt: true,
} satisfies Prisma.UserSelect;

const LISTING_SELECT = {
  title: true,
  city: { select: { name: true } },
  cityArea: { select: { name: true } },
} satisfies Prisma.ListingSelect;

const BOOKING_SELECT = {
  id: true,
  status: true,
  startsAt: true,
  endsAt: true,
  priceUnit: true,
} satisfies Prisma.BookingSelect;

type Person = Prisma.UserGetPayload<{ select: typeof PERSON_SELECT }>;
type ListingPlace = Prisma.ListingGetPayload<{ select: typeof LISTING_SELECT }>;
type ConversationParties = { id: string; listingId: string; guestId: string; ownerId: string; bookingId: string | null };

/**
 * Dizajn 37: the other side as a row names it, "Milica J." with "MJ" for the
 * avatar. A deleted account (R141) keeps its threads but shows no name at all;
 * the page calls it "Uklonjen nalog".
 */
function serializePerson(person: Person) {
  if (person.anonymizedAt) return { name: null, initials: null, avatarUrl: null, removed: true };
  const initials = `${person.firstName.trim().charAt(0)}${person.lastName.trim().charAt(0)}`.toUpperCase();
  return { name: shortName(person), initials, avatarUrl: person.avatarUrl, removed: false };
}

// "Igraonica Balončići - Vračar" is built from these; the city stands in when
// the listing has no area.
function serializeListing(listing: ListingPlace) {
  return { title: listing.title, place: listing.cityArea?.name ?? listing.city?.name ?? null };
}

function previewText(content: string) {
  const text = content.replace(/\s+/g, ' ').trim();
  return text.length > PREVIEW_LENGTH ? text.slice(0, PREVIEW_LENGTH) : text;
}

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
      include: { subscription: { include: { package: true } }, user: { select: { anonymizedAt: true } } },
    });
    if (listing.userId === guestId) throw new BadRequestException('Cannot message your own listing');

    // A thread tied to a booking has to be the guest's own booking of this
    // listing; the conversation header shows that booking to both sides.
    if (dto.bookingId) {
      const booking = await this.prisma.booking.findFirst({
        where: { id: dto.bookingId, listingId: dto.listingId, guestId },
        select: { id: true },
      });
      if (!booking) throw new NotFoundException();
    }

    const existing = await this.prisma.conversation.findFirst({
      where: { listingId: dto.listingId, guestId, bookingId: dto.bookingId ?? null },
    });
    if (existing) {
      // Replying is never gated by package (R77 only limits *new* threads) —
      // a downgrade shouldn't strand an already-open conversation.
      return this.sendMessage(guestId, existing.id, dto.content);
    }

    // Checked before the thread exists, so a refused first message leaves no
    // empty conversation behind.
    if (listing.user.anonymizedAt) {
      throw new BadRequestException(this.i18n.t('errors.CONVERSATION_ACCOUNT_REMOVED'));
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
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { guest: { select: { anonymizedAt: true } }, owner: { select: { anonymizedAt: true } } },
    });
    if (!conversation) throw new NotFoundException();
    if (conversation.guestId !== userId && conversation.ownerId !== userId) throw new ForbiddenException();

    const isGuest = conversation.guestId === userId;
    // Dizajn 37: a deleted account (R141) keeps its threads for the record but
    // can't read anything new, and its email address no longer exists.
    const recipient = isGuest ? conversation.owner : conversation.guest;
    if (recipient.anonymizedAt) {
      throw new BadRequestException(this.i18n.t('errors.CONVERSATION_ACCOUNT_REMOVED'));
    }

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

  async addAttachment(userId: string, messageId: string, file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException(this.i18n.t('errors.FILE_REQUIRED'));
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

  /**
   * Dizajn 37 (519:588): one row per conversation, with the other side, the
   * listing and one line of the latest message. Only what the row shows.
   */
  async listConversations(userId: string) {
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

    // R82: unread conversations first; the sort is stable, so each group
    // keeps the newest first.
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

  /** Dizajn 37 (380:998): one open conversation. Reading it marks it read. */
  async getConversation(userId: string, conversationId: string) {
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
    if (!conversation) throw new NotFoundException();
    if (conversation.guestId !== userId && conversation.ownerId !== userId) throw new ForbiddenException();

    await this.clearUnread(conversation, userId);
    const isGuest = conversation.guestId === userId;
    const counterpart = serializePerson(isGuest ? conversation.owner : conversation.guest);
    return {
      id: conversation.id,
      role: isGuest ? 'guest' : 'owner',
      // T103: the header names who you're talking to.
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

  async markRead(userId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true, guestId: true, ownerId: true },
    });
    if (!conversation) throw new NotFoundException();
    if (conversation.guestId !== userId && conversation.ownerId !== userId) throw new ForbiddenException();
    await this.clearUnread(conversation, userId);
  }

  private async clearUnread(conversation: { id: string; guestId: string }, userId: string) {
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

  /**
   * Dizajn 37 (380:1002): the booking the conversation header names. A thread
   * started from a booking keeps that one; a question from the listing page
   * shows the guest's booking of that listing still under way with the
   * nearest term, else the one they made last. Only this guest's bookings of
   * this owner's listing ever qualify.
   */
  private async findHeaderBooking(conversation: ConversationParties) {
    const parties = { listingId: conversation.listingId, guestId: conversation.guestId, ownerId: conversation.ownerId };
    if (conversation.bookingId) {
      const own = await this.prisma.booking.findFirst({
        where: { id: conversation.bookingId, ...parties },
        select: BOOKING_SELECT,
      });
      if (own) return own;
    }
    const open = await this.prisma.booking.findFirst({
      where: { ...parties, status: { in: OPEN_BOOKING_STATUSES }, endsAt: { gt: new Date() } },
      orderBy: { startsAt: 'asc' },
      select: BOOKING_SELECT,
    });
    if (open) return open;
    return this.prisma.booking.findFirst({
      where: parties,
      orderBy: { createdAt: 'desc' },
      select: BOOKING_SELECT,
    });
  }
}
