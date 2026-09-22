import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ReviewsService } from './reviews.service';

// Dizajn 43: only the guest reviews, the review is public at once, it can be
// written within review_window_days of completion and changed for
// review_edit_days after it went public. Belgrade is on UTC+2 in September,
// so a Belgrade day ends at 21:59:59.999 UTC.

function review(overrides: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    bookingId: 'b1',
    authorId: 'g1',
    recipientId: 'o1',
    listingId: 'l1',
    rating: 2,
    comment: 'Grejanje je radilo slabo.',
    writtenAt: new Date('2026-09-21T10:00:00Z'),
    publishedAt: new Date('2026-09-21T10:00:00Z'),
    hiddenByAdmin: false,
    ...overrides,
  };
}

const completedBooking = {
  id: 'b1',
  guestId: 'g1',
  ownerId: 'o1',
  listingId: 'l1',
  status: 'COMPLETED',
  endsAt: new Date('2026-09-19T09:00:00Z'),
};

function settings(values: Record<string, number> = {}) {
  return {
    findUnique: jest.fn(({ where }: { where: { key: string } }) =>
      Promise.resolve(where.key in values ? { key: where.key, value: values[where.key] } : null),
    ),
  };
}

function completedAt(changedAt: string | null) {
  return { findFirst: jest.fn().mockResolvedValue(changedAt ? { changedAt: new Date(changedAt) } : null) };
}

function makeService(prisma: Record<string, unknown>) {
  const i18n = { t: jest.fn((key: string) => key) };
  const events = { emit: jest.fn() };
  return { service: new ReviewsService(prisma as any, i18n as any, events as any), events };
}

afterEach(() => jest.useRealTimers());

describe('ReviewsService#createReview (Dizajn 43)', () => {
  function prismaFor(overrides: Record<string, unknown> = {}) {
    return {
      booking: { findUnique: jest.fn().mockResolvedValue(completedBooking) },
      bookingHistory: completedAt('2026-09-20T09:05:00Z'),
      setting: settings(),
      review: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(({ data }: { data: Record<string, unknown> }) => Promise.resolve(review({ ...data, id: 'r9' }))),
        findMany: jest.fn().mockResolvedValue([{ rating: 5 }, { rating: 2 }]),
      },
      listing: { update: jest.fn().mockResolvedValue({}) },
      ...overrides,
    };
  }

  it("publishes the guest's review at once and recounts the listing", async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-22T12:00:00Z'));
    const prisma = prismaFor();
    const { service, events } = makeService(prisma);

    const created = await service.createReview('g1', { bookingId: 'b1', rating: 2, comment: '  Grejanje je radilo slabo.  ' });
    expect(prisma.review.create).toHaveBeenCalledWith({
      data: { bookingId: 'b1', authorId: 'g1', recipientId: 'o1', listingId: 'l1', rating: 2, comment: 'Grejanje je radilo slabo.' },
    });
    expect(prisma.review.findMany).toHaveBeenCalledWith({ where: { listingId: 'l1', hiddenByAdmin: false }, select: { rating: true } });
    expect(prisma.listing.update).toHaveBeenCalledWith({ where: { id: 'l1' }, data: { avgRating: 3.5, reviewCount: 2 } });
    expect(events.emit).toHaveBeenCalledWith('review.published', { reviewId: 'r9' });
    expect(created).toMatchObject({ id: 'r9', rating: 2, editable: true });
    expect(created).not.toHaveProperty('authorId');
  });

  it("refuses the owner, anyone else, a missing booking and one that isn't completed", async () => {
    await expect(makeService(prismaFor()).service.createReview('o1', { bookingId: 'b1', rating: 5 })).rejects.toThrow(ForbiddenException);
    await expect(makeService(prismaFor()).service.createReview('x1', { bookingId: 'b1', rating: 5 })).rejects.toThrow(ForbiddenException);

    const missing = prismaFor({ booking: { findUnique: jest.fn().mockResolvedValue(null) } });
    await expect(makeService(missing).service.createReview('g1', { bookingId: 'b1', rating: 5 })).rejects.toThrow(NotFoundException);

    const confirmed = prismaFor({ booking: { findUnique: jest.fn().mockResolvedValue({ ...completedBooking, status: 'CONFIRMED' }) } });
    await expect(makeService(confirmed).service.createReview('g1', { bookingId: 'b1', rating: 5 })).rejects.toThrow(BadRequestException);
    expect(confirmed.review.create).not.toHaveBeenCalled();
  });

  it('holds the window to the end of its last Belgrade day, counted from completion', async () => {
    // Completed 20. 9. at 11:05 Belgrade time, so 14 days run to the end of 4. 10.
    jest.useFakeTimers().setSystemTime(new Date('2026-10-04T21:59:00Z'));
    const open = prismaFor();
    await expect(makeService(open).service.createReview('g1', { bookingId: 'b1', rating: 4 })).resolves.toMatchObject({ rating: 4 });

    jest.setSystemTime(new Date('2026-10-04T22:00:00Z'));
    const closed = prismaFor();
    await expect(makeService(closed).service.createReview('g1', { bookingId: 'b1', rating: 4 })).rejects.toThrow('errors.REVIEW_WINDOW_CLOSED');
    expect(closed.review.create).not.toHaveBeenCalled();
  });

  it('reads the window from the setting and counts from the end when the history is missing', async () => {
    // Ended 19. 9., window of 3 days: open through 22. 9.
    jest.useFakeTimers().setSystemTime(new Date('2026-09-22T21:00:00Z'));
    const prisma = prismaFor({ bookingHistory: completedAt(null), setting: settings({ review_window_days: 3 }) });
    await expect(makeService(prisma).service.createReview('g1', { bookingId: 'b1', rating: 3 })).resolves.toBeTruthy();

    jest.setSystemTime(new Date('2026-09-22T22:00:00Z'));
    const late = prismaFor({ bookingHistory: completedAt(null), setting: settings({ review_window_days: 3 }) });
    await expect(makeService(late).service.createReview('g1', { bookingId: 'b1', rating: 3 })).rejects.toThrow('errors.REVIEW_WINDOW_CLOSED');
  });

  it('keeps one review per booking, also when two sends race', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-22T12:00:00Z'));
    const again = prismaFor({ review: { findUnique: jest.fn().mockResolvedValue(review()), create: jest.fn() } });
    await expect(makeService(again).service.createReview('g1', { bookingId: 'b1', rating: 5 })).rejects.toThrow('errors.REVIEW_ALREADY_EXISTS');
    expect(again.review.create).not.toHaveBeenCalled();

    const duplicate = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' });
    const raced = prismaFor({ review: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockRejectedValue(duplicate) } });
    const { service, events } = makeService(raced);
    await expect(service.createReview('g1', { bookingId: 'b1', rating: 5 })).rejects.toThrow('errors.REVIEW_ALREADY_EXISTS');
    expect(events.emit).not.toHaveBeenCalled();
  });
});

describe('ReviewsService#updateReview (Dizajn 43, 585:515)', () => {
  function prismaFor(found: unknown = review()) {
    return {
      setting: settings(),
      review: {
        findUnique: jest.fn().mockResolvedValue(found),
        update: jest.fn(({ data }: { data: Record<string, unknown> }) => Promise.resolve(review(data))),
        findMany: jest.fn().mockResolvedValue([{ rating: 4 }]),
      },
      listing: { update: jest.fn().mockResolvedValue({}) },
    };
  }

  it('lets the author change it through the 7th Belgrade day after it went public', async () => {
    // Public 21. 9. at 12:00 Belgrade time: editable to the end of 28. 9.
    jest.useFakeTimers().setSystemTime(new Date('2026-09-28T21:30:00Z'));
    const prisma = prismaFor();
    const { service } = makeService(prisma);

    const updated = await service.updateReview('g1', 'r1', { rating: 4, comment: '  Sve je bilo u redu.  ' });
    expect(prisma.review.update).toHaveBeenCalledWith({ where: { id: 'r1' }, data: { rating: 4, comment: 'Sve je bilo u redu.' } });
    expect(prisma.listing.update).toHaveBeenCalledWith({ where: { id: 'l1' }, data: { avgRating: 4, reviewCount: 1 } });
    expect(updated).toMatchObject({ rating: 4, editable: true, editableUntil: new Date('2026-09-28T21:59:59.999Z') });
  });

  it('clears the comment when it is left empty', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-22T12:00:00Z'));
    const prisma = prismaFor();
    await makeService(prisma).service.updateReview('g1', 'r1', { rating: 3, comment: '   ' });
    expect(prisma.review.update.mock.calls[0][0].data).toEqual({ rating: 3, comment: null });
  });

  it('refuses a change once the window has closed', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-28T22:00:00Z'));
    const prisma = prismaFor();
    await expect(makeService(prisma).service.updateReview('g1', 'r1', { rating: 5 })).rejects.toThrow('errors.REVIEW_EDIT_CLOSED');
    expect(prisma.review.update).not.toHaveBeenCalled();
  });

  it('counts the window from when a review went public, and reads its length from the setting', async () => {
    // Written while waiting for the owner (R96), public from 22. 9. at the migration.
    jest.useFakeTimers().setSystemTime(new Date('2026-09-24T12:00:00Z'));
    const waited = prismaFor(review({ writtenAt: new Date('2026-09-01T10:00:00Z'), publishedAt: new Date('2026-09-22T16:00:00Z') }));
    await expect(makeService(waited).service.updateReview('g1', 'r1', { rating: 5 })).resolves.toMatchObject({ editable: true });

    const short = { ...prismaFor(), setting: settings({ review_edit_days: 2 }) };
    await expect(makeService(short).service.updateReview('g1', 'r1', { rating: 5 })).rejects.toThrow('errors.REVIEW_EDIT_CLOSED');
  });

  it("refuses someone else's review and a missing one", async () => {
    const prisma = prismaFor();
    await expect(makeService(prisma).service.updateReview('o1', 'r1', { rating: 5 })).rejects.toThrow(ForbiddenException);
    expect(prisma.review.update).not.toHaveBeenCalled();

    await expect(makeService(prismaFor(null)).service.updateReview('g1', 'r1', { rating: 5 })).rejects.toThrow(NotFoundException);
  });
});

describe('ReviewsService#getBookingReviewStatus (Dizajn 39, 43)', () => {
  function prismaFor(booking: unknown, mine: unknown = null, history = '2026-09-20T09:05:00Z') {
    return {
      booking: { findUnique: jest.fn().mockResolvedValue(booking) },
      bookingHistory: completedAt(history),
      setting: settings(),
      review: { findUnique: jest.fn().mockResolvedValue(mine) },
    };
  }

  it('offers the form while the window is open, and not after', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-04T12:00:00Z'));
    await expect(makeService(prismaFor(completedBooking)).service.getBookingReviewStatus('g1', 'b1')).resolves.toEqual({
      canReview: true,
      myReview: null,
    });

    jest.setSystemTime(new Date('2026-10-05T12:00:00Z'));
    await expect(makeService(prismaFor(completedBooking)).service.getBookingReviewStatus('g1', 'b1')).resolves.toEqual({
      canReview: false,
      myReview: null,
    });
  });

  it('shows the posted review with the day its change closes, then without it', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-22T12:00:00Z'));
    const status = await makeService(prismaFor(completedBooking, review())).service.getBookingReviewStatus('g1', 'b1');
    expect(status.canReview).toBe(false);
    expect(status.myReview).toMatchObject({ id: 'r1', rating: 2, editable: true, editableUntil: new Date('2026-09-28T21:59:59.999Z') });
    expect(status.myReview).not.toHaveProperty('recipientId');

    jest.setSystemTime(new Date('2026-09-29T08:00:00Z'));
    const later = await makeService(prismaFor(completedBooking, review())).service.getBookingReviewStatus('g1', 'b1');
    expect(later.myReview).toMatchObject({ editable: false, editableUntil: null });
  });

  it("doesn't look for a window before the booking is completed", async () => {
    const prisma = prismaFor({ ...completedBooking, status: 'CONFIRMED' });
    await expect(makeService(prisma).service.getBookingReviewStatus('g1', 'b1')).resolves.toEqual({ canReview: false, myReview: null });
    expect(prisma.bookingHistory.findFirst).not.toHaveBeenCalled();
  });

  it('keeps the panel to the guest: the owner no longer reviews', async () => {
    await expect(makeService(prismaFor(completedBooking)).service.getBookingReviewStatus('o1', 'b1')).rejects.toThrow(ForbiddenException);
    await expect(makeService(prismaFor(completedBooking)).service.getBookingReviewStatus('x1', 'b1')).rejects.toThrow(ForbiddenException);
    await expect(makeService(prismaFor(null)).service.getBookingReviewStatus('g1', 'b1')).rejects.toThrow(NotFoundException);
  });
});

describe('ReviewsService#getMyPendingReviews (Dizajn 31, 43)', () => {
  it("lists the guest's completed bookings without a review while their window is open", async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-04T12:00:00Z'));
    const listing = { title: 'Soba 22', slug: 'soba-22' };
    const prisma = {
      booking: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'open', endsAt: new Date('2026-09-19T09:00:00Z'), listing, history: [{ changedAt: new Date('2026-09-20T09:05:00Z') }] },
          { id: 'closed', endsAt: new Date('2026-09-10T09:00:00Z'), listing, history: [{ changedAt: new Date('2026-09-11T09:05:00Z') }] },
          { id: 'noHistory', endsAt: new Date('2026-09-25T09:00:00Z'), listing, history: [] },
        ]),
      },
      setting: settings(),
    };
    await expect(makeService(prisma).service.getMyPendingReviews('g1')).resolves.toEqual([
      { bookingId: 'open', listing },
      { bookingId: 'noHistory', listing },
    ]);
    expect(prisma.booking.findMany.mock.calls[0][0].where).toEqual({ guestId: 'g1', status: 'COMPLETED', review: { is: null } });
  });
});

describe('ReviewsService#getListingReviews (found in Dizajn 39)', () => {
  it('signs each review "Miloš J." and leaves out the booking and moderation fields', async () => {
    const publishedAt = new Date('2026-09-10T02:00:00Z');
    const replyAt = new Date('2026-09-11T08:00:00Z');
    const prisma = {
      review: {
        findMany: jest.fn().mockResolvedValue([
          {
            ...review({ publishedAt, rating: 5, comment: 'Sjajno.' }),
            author: { id: 'g1', firstName: 'Miloš', lastName: 'Jovanović', avatarUrl: null },
            reply: { id: 'rp1', reviewId: 'r1', authorId: 'o1', content: 'Hvala!', createdAt: replyAt },
          },
        ]),
      },
    };
    const reviews = await makeService(prisma).service.getListingReviews('l1');
    expect(prisma.review.findMany.mock.calls[0][0].where).toEqual({ listingId: 'l1', hiddenByAdmin: false });
    expect(reviews).toEqual([
      {
        id: 'r1',
        rating: 5,
        comment: 'Sjajno.',
        writtenAt: expect.any(Date),
        publishedAt,
        author: { id: 'g1', firstName: 'Miloš', lastInitial: 'J', avatarUrl: null },
        reply: { content: 'Hvala!', createdAt: replyAt },
      },
    ]);
    expect(JSON.stringify(reviews)).not.toContain('Jovanović');
  });
});

describe('ReviewsService#sendReviewReminders (Dizajn 43)', () => {
  it('nudges only the guest, and only while the review window is open', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-27T07:00:00Z'));
    const bookings: Record<string, unknown> = {
      b1: { ...completedBooking, id: 'b1', review: null },
      b2: { ...completedBooking, id: 'b2', review: { id: 'r2' } },
    };
    const prisma = {
      bookingHistory: {
        findMany: jest.fn().mockResolvedValue([{ bookingId: 'b1' }, { bookingId: 'b2' }]),
        findFirst: jest.fn().mockResolvedValue({ changedAt: new Date('2026-09-20T09:05:00Z') }),
      },
      booking: { findUnique: jest.fn(({ where }: { where: { id: string } }) => Promise.resolve(bookings[where.id])) },
      setting: settings(),
    };
    const { service, events } = makeService(prisma);
    await service.sendReviewReminders();
    expect(events.emit).toHaveBeenCalledTimes(1);
    expect(events.emit).toHaveBeenCalledWith('review.reminder', { bookingId: 'b1', userId: 'g1', reviewBy: new Date('2026-10-04T21:59:59.999Z') });

    // An admin who shortens the window to 5 days leaves nothing to remind of.
    const shortWindow = { ...prisma, setting: settings({ review_window_days: 5 }) };
    const quiet = makeService(shortWindow);
    await quiet.service.sendReviewReminders();
    expect(quiet.events.emit).not.toHaveBeenCalled();
  });
});
