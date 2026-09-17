import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { MessagingService } from './messaging.service';

const i18n = { t: jest.fn((key: string) => key) };

function makeService(prisma: any, events = { emit: jest.fn() }) {
  return new MessagingService(prisma, {} as any, i18n as any, events as any);
}

const person = (firstName: string, lastName: string, extra: Record<string, any> = {}) => ({
  firstName,
  lastName,
  avatarUrl: null,
  anonymizedAt: null,
  ...extra,
});

const listing = { title: 'Igraonica Balončići', city: { name: 'Beograd' }, cityArea: { name: 'Vračar' } };

// The conversation row the page reads, the way the select hands it over.
function conversationRow(overrides: Record<string, any> = {}) {
  return {
    id: 'c1',
    listingId: 'l1',
    guestId: 'guest-1',
    ownerId: 'owner-1',
    bookingId: null,
    listing,
    guest: person('Milica', 'Jovanović'),
    owner: person('Ivana', 'Marković', { avatarUrl: 'ivana.png' }),
    messages: [
      { id: 'm1', content: 'Dobar dan', sentAt: new Date('2026-09-17T08:24:00Z'), senderId: 'guest-1', attachments: [] },
      { id: 'm2', content: 'Može', sentAt: new Date('2026-09-17T08:31:00Z'), senderId: 'owner-1', attachments: [] },
    ],
    ...overrides,
  };
}

function readPrisma(row: any, bookings: { own?: any; open?: any; latest?: any } = {}) {
  const prisma: any = {
    conversation: {
      findUnique: jest.fn().mockResolvedValue(row),
      update: jest.fn().mockReturnValue('conversation-update'),
    },
    message: { updateMany: jest.fn().mockReturnValue('message-update') },
    booking: {
      findFirst: jest.fn().mockImplementation(({ where }) => {
        if (where.id) return Promise.resolve(bookings.own ?? null);
        if (where.status) return Promise.resolve(bookings.open ?? null);
        return Promise.resolve(bookings.latest ?? null);
      }),
    },
    $transaction: jest.fn().mockResolvedValue([]),
  };
  return prisma;
}

describe('MessagingService#listConversations (Dizajn 37)', () => {
  const rows = [
    {
      id: 'c-read',
      guestId: 'guest-2',
      unreadGuestCount: 0,
      unreadOwnerCount: 0,
      listing: { title: 'Sala za proslave', city: { name: 'Beograd' }, cityArea: null },
      guest: person('Jelena', 'Kostić'),
      owner: person('Ivana', 'Marković'),
      messages: [{ content: 'Hvala,\n  vidimo se   u sredu.', sentAt: new Date('2026-09-16T09:40:00Z'), senderId: 'guest-2', attachments: [] }],
    },
    {
      id: 'c-unread',
      guestId: 'guest-1',
      unreadGuestCount: 3,
      unreadOwnerCount: 2,
      listing,
      guest: person('Milica', 'Jovanović'),
      owner: person('Ivana', 'Marković'),
      messages: [{ content: '📎', sentAt: new Date('2026-09-17T08:24:00Z'), senderId: 'guest-1', attachments: [{ filename: 'ugovor.pdf' }] }],
    },
    {
      id: 'c-guest',
      guestId: 'owner-1',
      unreadGuestCount: 0,
      unreadOwnerCount: 5,
      listing,
      guest: person('Ivana', 'Marković'),
      owner: person('Uklonjen', 'nalog', { anonymizedAt: new Date(), avatarUrl: 'old.png' }),
      messages: [{ content: 'x'.repeat(300), sentAt: new Date('2026-09-10T08:00:00Z'), senderId: 'owner-1', attachments: [] }],
    },
  ];

  it('asks for the latest message only and keeps conversations without one last', async () => {
    const prisma = { conversation: { findMany: jest.fn().mockResolvedValue([]) } };
    await makeService(prisma).listConversations('owner-1');

    const query = prisma.conversation.findMany.mock.calls[0][0];
    expect(query.where).toEqual({ OR: [{ guestId: 'owner-1' }, { ownerId: 'owner-1' }] });
    expect(query.orderBy).toEqual({ lastMessageAt: { sort: 'desc', nulls: 'last' } });
    expect(query.select.messages).toMatchObject({ orderBy: { sentAt: 'desc' }, take: 1 });
    expect(query.select.guest.select).not.toHaveProperty('email');
  });

  it('returns what a row shows, unread first, and nothing private', async () => {
    const prisma = { conversation: { findMany: jest.fn().mockResolvedValue(rows) } };
    const list = await makeService(prisma).listConversations('owner-1');

    expect(list.map((c) => c.id)).toEqual(['c-unread', 'c-read', 'c-guest']);
    expect(list[0]).toEqual({
      id: 'c-unread',
      role: 'owner',
      counterpart: { name: 'Milica J.', initials: 'MJ', avatarUrl: null, removed: false },
      listing: { title: 'Igraonica Balončići', place: 'Vračar' },
      lastMessage: { text: '📎', sentAt: new Date('2026-09-17T08:24:00Z'), mine: false, attachment: 'ugovor.pdf' },
      unreadCount: 2,
    });
    // The city stands in for a missing area; the preview is one tidy line.
    expect(list[1].listing).toEqual({ title: 'Sala za proslave', place: 'Beograd' });
    expect(list[1].lastMessage?.text).toBe('Hvala, vidimo se u sredu.');
    const serialized = JSON.stringify(list);
    expect(serialized).not.toContain('Jovanović');
    expect(serialized).not.toContain('guestId');
  });

  it('reads the guest side of a conversation and hides a deleted account', async () => {
    const prisma = { conversation: { findMany: jest.fn().mockResolvedValue(rows) } };
    const list = await makeService(prisma).listConversations('owner-1');
    const asGuest = list.find((c) => c.id === 'c-guest')!;

    expect(asGuest.role).toBe('guest');
    expect(asGuest.unreadCount).toBe(0);
    expect(asGuest.counterpart).toEqual({ name: null, initials: null, avatarUrl: null, removed: true });
    expect(asGuest.lastMessage).toMatchObject({ mine: true });
    expect(asGuest.lastMessage?.text).toHaveLength(160);
  });
});

describe('MessagingService#getConversation (Dizajn 37)', () => {
  it('refuses a missing conversation and a stranger without marking anything read', async () => {
    const missing = readPrisma(null);
    await expect(makeService(missing).getConversation('owner-1', 'c1')).rejects.toBeInstanceOf(NotFoundException);

    const prisma = readPrisma(conversationRow());
    await expect(makeService(prisma).getConversation('stranger', 'c1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.booking.findFirst).not.toHaveBeenCalled();
  });

  it('marks the reader side read and returns the thread with short names', async () => {
    const booking = { id: 'b-open', status: 'REQUESTED', startsAt: new Date('2026-10-03T10:00:00Z'), endsAt: new Date('2026-10-03T12:00:00Z'), priceUnit: 'HOUR' };
    const prisma = readPrisma(conversationRow(), { open: booking });
    const result = await makeService(prisma).getConversation('owner-1', 'c1');

    expect(prisma.conversation.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { unreadOwnerCount: 0 } });
    expect(prisma.message.updateMany).toHaveBeenCalledWith({
      where: { conversationId: 'c1', senderId: { not: 'owner-1' }, readAt: null },
      data: { readAt: expect.any(Date) },
    });
    expect(result).toEqual({
      id: 'c1',
      role: 'owner',
      counterpart: { name: 'Milica J.', initials: 'MJ', avatarUrl: null, removed: false },
      listing: { title: 'Igraonica Balončići', place: 'Vračar' },
      booking,
      canReply: true,
      messages: [
        { id: 'm1', text: 'Dobar dan', sentAt: new Date('2026-09-17T08:24:00Z'), mine: false, attachments: [] },
        { id: 'm2', text: 'Može', sentAt: new Date('2026-09-17T08:31:00Z'), mine: true, attachments: [] },
      ],
    });
  });

  it('shows the guest the owner by short name and clears the guest counter', async () => {
    const prisma = readPrisma(conversationRow());
    const result = await makeService(prisma).getConversation('guest-1', 'c1');

    expect(prisma.conversation.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { unreadGuestCount: 0 } });
    expect(result.role).toBe('guest');
    expect(result.counterpart).toEqual({ name: 'Ivana M.', initials: 'IM', avatarUrl: 'ivana.png', removed: false });
    expect(result.booking).toBeNull();
  });

  it('prefers the booking the thread was started from when it belongs to this pair', async () => {
    const own = { id: 'b-own' };
    const prisma = readPrisma(conversationRow({ bookingId: 'b-own' }), { own, open: { id: 'b-open' } });
    const result = await makeService(prisma).getConversation('owner-1', 'c1');

    expect(result.booking).toBe(own);
    expect(prisma.booking.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.booking.findFirst.mock.calls[0][0].where).toEqual({ id: 'b-own', listingId: 'l1', guestId: 'guest-1', ownerId: 'owner-1' });
  });

  it('ignores a booking id of someone else and falls back to the open one, then the latest', async () => {
    const latest = { id: 'b-latest' };
    const prisma = readPrisma(conversationRow({ bookingId: 'b-foreign' }), { own: null, open: null, latest });
    const result = await makeService(prisma).getConversation('owner-1', 'c1');

    expect(result.booking).toBe(latest);
    const [, openQuery, latestQuery] = prisma.booking.findFirst.mock.calls.map((call: any[]) => call[0]);
    expect(openQuery.where).toEqual({
      listingId: 'l1',
      guestId: 'guest-1',
      ownerId: 'owner-1',
      status: { in: ['REQUESTED', 'AWAITING_PAYMENT', 'CONFIRMED'] },
      endsAt: { gt: expect.any(Date) },
    });
    expect(openQuery.orderBy).toEqual({ startsAt: 'asc' });
    expect(latestQuery).toMatchObject({ where: { listingId: 'l1', guestId: 'guest-1', ownerId: 'owner-1' }, orderBy: { createdAt: 'desc' } });
  });

  it('closes the reply box for a deleted account', async () => {
    const prisma = readPrisma(conversationRow({ guest: person('Uklonjen', 'nalog', { anonymizedAt: new Date() }) }));
    const result = await makeService(prisma).getConversation('owner-1', 'c1');

    expect(result.canReply).toBe(false);
    expect(result.counterpart.removed).toBe(true);
  });
});

describe('MessagingService#markRead (Dizajn 37)', () => {
  it('refuses someone who is not in the conversation', async () => {
    const prisma = readPrisma({ id: 'c1', guestId: 'guest-1', ownerId: 'owner-1' });
    await expect(makeService(prisma).markRead('stranger', 'c1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.conversation.update).not.toHaveBeenCalled();
  });

  it('clears the guest side for the guest', async () => {
    const prisma = readPrisma({ id: 'c1', guestId: 'guest-1', ownerId: 'owner-1' });
    await makeService(prisma).markRead('guest-1', 'c1');
    expect(prisma.conversation.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { unreadGuestCount: 0 } });
    expect(prisma.$transaction).toHaveBeenCalledWith(['conversation-update', 'message-update']);
  });

  it('answers 404 for a missing conversation', async () => {
    await expect(makeService(readPrisma(null)).markRead('owner-1', 'c1')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('MessagingService#sendMessage (Dizajn 37)', () => {
  function sendPrisma(guestRemoved: boolean) {
    return {
      conversation: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'c1',
          guestId: 'guest-1',
          ownerId: 'owner-1',
          bookingId: null,
          guest: { anonymizedAt: guestRemoved ? new Date() : null },
          owner: { anonymizedAt: null },
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      message: { create: jest.fn().mockResolvedValue({ id: 'm9', conversationId: 'c1' }) },
      booking: { count: jest.fn().mockResolvedValue(0) },
    };
  }

  it('refuses a message to a deleted account', async () => {
    const prisma = sendPrisma(true);
    const events = { emit: jest.fn() };
    await expect(makeService(prisma, events).sendMessage('owner-1', 'c1', 'Da li ste tu?')).rejects.toBeInstanceOf(BadRequestException);
    expect(i18n.t).toHaveBeenCalledWith('errors.CONVERSATION_ACCOUNT_REMOVED');
    expect(prisma.message.create).not.toHaveBeenCalled();
    expect(events.emit).not.toHaveBeenCalled();
  });

  it('refuses a stranger before looking at the recipient', async () => {
    const prisma = sendPrisma(true);
    await expect(makeService(prisma).sendMessage('stranger', 'c1', 'x')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('sends to a live account and counts it unread for the other side', async () => {
    const prisma = sendPrisma(false);
    const events = { emit: jest.fn() };
    await makeService(prisma, events).sendMessage('owner-1', 'c1', 'Može');
    expect(prisma.message.create).toHaveBeenCalled();
    expect(prisma.conversation.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { lastMessageAt: expect.any(Date), unreadGuestCount: { increment: 1 } },
    });
    expect(events.emit).toHaveBeenCalledWith('messaging.new_message', { conversationId: 'c1', messageId: 'm9', senderId: 'owner-1' });
  });
});

describe('MessagingService#startConversation (Dizajn 37)', () => {
  function startPrisma({ ownerRemoved = false, booking = null as any } = {}) {
    return {
      listing: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'l1',
          userId: 'owner-1',
          subscription: { package: { hasMessaging: true } },
          user: { anonymizedAt: ownerRemoved ? new Date() : null },
        }),
      },
      booking: { findFirst: jest.fn().mockResolvedValue(booking) },
      conversation: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
    };
  }

  it('refuses a booking that is not this guest booking this listing', async () => {
    const prisma = startPrisma();
    await expect(
      makeService(prisma).startConversation('guest-1', { listingId: 'l1', bookingId: 'b-other', content: 'Zdravo' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.booking.findFirst.mock.calls[0][0].where).toEqual({ id: 'b-other', listingId: 'l1', guestId: 'guest-1' });
    expect(prisma.conversation.create).not.toHaveBeenCalled();
  });

  it('refuses a deleted owner before any conversation exists', async () => {
    const prisma = startPrisma({ ownerRemoved: true });
    await expect(makeService(prisma).startConversation('guest-1', { listingId: 'l1', content: 'Zdravo' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.conversation.create).not.toHaveBeenCalled();
  });
});

describe('MessagingService#addAttachment (Dizajn 37)', () => {
  it('asks for a file instead of failing on a missing one', async () => {
    const prisma = { message: { findUnique: jest.fn() } };
    await expect(makeService(prisma).addAttachment('owner-1', 'm1', undefined)).rejects.toBeInstanceOf(BadRequestException);
    expect(i18n.t).toHaveBeenCalledWith('errors.FILE_REQUIRED');
    expect(prisma.message.findUnique).not.toHaveBeenCalled();
  });
});
