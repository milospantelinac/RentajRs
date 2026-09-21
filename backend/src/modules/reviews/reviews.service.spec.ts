import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ReviewsService } from './reviews.service';

const DAY = 86_400_000;

function review(overrides: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    bookingId: 'b1',
    authorId: 'g1',
    recipientId: 'o1',
    listingId: 'l1',
    direction: 'GUEST_TO_OWNER',
    rating: 2,
    comment: 'Grejanje je radilo slabo.',
    published: false,
    publishedAt: null,
    writtenAt: new Date('2026-09-21T10:00:00Z'),
    hiddenByAdmin: false,
    tags: [],
    ...overrides,
  };
}

function makeService(prisma: Record<string, unknown>) {
  const i18n = { t: jest.fn((key: string) => key) };
  return new ReviewsService(prisma as any, i18n as any, { emit: jest.fn() } as any);
}

describe('ReviewsService#updateReview (Dizajn 39)', () => {
  it('lets the author change an unpublished review', async () => {
    const prisma = {
      review: {
        findUnique: jest.fn().mockResolvedValue(review()),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(review({ rating: 4, comment: 'Sve je bilo u redu.' })),
      },
    };
    const service = makeService(prisma);

    const updated = await service.updateReview('g1', 'r1', { rating: 4, comment: '  Sve je bilo u redu.  ' });
    expect(prisma.review.updateMany).toHaveBeenCalledWith({
      where: { id: 'r1', published: false },
      data: { rating: 4, comment: 'Sve je bilo u redu.' },
    });
    expect(updated).toEqual(expect.objectContaining({ id: 'r1', rating: 4, comment: 'Sve je bilo u redu.', published: false }));
    expect(updated).not.toHaveProperty('authorId');
  });

  it('clears the comment when it is left empty', async () => {
    const prisma = {
      review: {
        findUnique: jest.fn().mockResolvedValue(review()),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(review({ comment: null })),
      },
    };
    await makeService(prisma).updateReview('g1', 'r1', { rating: 3, comment: '   ' });
    expect(prisma.review.updateMany.mock.calls[0][0].data).toEqual({ rating: 3, comment: null });
  });

  it('refuses a published review, also one published between the read and the write', async () => {
    const published = { review: { findUnique: jest.fn().mockResolvedValue(review({ published: true })), updateMany: jest.fn().mockResolvedValue({ count: 0 }) } };
    await expect(makeService(published).updateReview('g1', 'r1', { rating: 5 })).rejects.toThrow(BadRequestException);

    const raced = { review: { findUnique: jest.fn().mockResolvedValue(review()), updateMany: jest.fn().mockResolvedValue({ count: 0 }) } };
    await expect(makeService(raced).updateReview('g1', 'r1', { rating: 5 })).rejects.toThrow('errors.REVIEW_ALREADY_PUBLISHED');
  });

  it("refuses someone else's review and a missing one", async () => {
    const prisma = { review: { findUnique: jest.fn().mockResolvedValue(review()), updateMany: jest.fn() } };
    await expect(makeService(prisma).updateReview('o1', 'r1', { rating: 5 })).rejects.toThrow(ForbiddenException);
    expect(prisma.review.updateMany).not.toHaveBeenCalled();

    const missing = { review: { findUnique: jest.fn().mockResolvedValue(null) } };
    await expect(makeService(missing).updateReview('g1', 'r1', { rating: 5 })).rejects.toThrow(NotFoundException);
  });
});

describe('ReviewsService#getBookingReviewStatus (Dizajn 39)', () => {
  const booking = { id: 'b1', guestId: 'g1', ownerId: 'o1', status: 'COMPLETED' };

  it('says until when an unpublished review can change and when it goes public at the latest', async () => {
    const prisma = {
      booking: { findUnique: jest.fn().mockResolvedValue(booking) },
      review: { findMany: jest.fn().mockResolvedValue([review(), review({ id: 'r2', authorId: 'o1', direction: 'OWNER_TO_GUEST' })]) },
      setting: { findUnique: jest.fn().mockResolvedValue({ value: 14 }) },
    };
    const status = await makeService(prisma).getBookingReviewStatus('g1', 'b1');
    expect(status.canReview).toBe(false);
    expect(status.myReview).toMatchObject({ id: 'r1', rating: 2, editable: true });
    expect(status.myReview!.publishesBy).toEqual(new Date(new Date('2026-09-21T10:00:00Z').getTime() + 15 * DAY));
    // The owner's review stays hidden until the pair is published (R96).
    expect(status.counterpartHasReviewed).toBe(true);
    expect(status.counterpartReview).toBeNull();
  });

  it('shows both once published and no longer offers the change', async () => {
    const publishedAt = new Date('2026-09-23T02:00:00Z');
    const prisma = {
      booking: { findUnique: jest.fn().mockResolvedValue(booking) },
      review: {
        findMany: jest.fn().mockResolvedValue([
          review({ published: true, publishedAt }),
          review({ id: 'r2', authorId: 'o1', direction: 'OWNER_TO_GUEST', rating: 5, comment: 'Uredan gost.', published: true, publishedAt, tags: [{ reviewId: 'r2', tag: 'COMMUNICATIVE' }] }),
        ]),
      },
      setting: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const status = await makeService(prisma).getBookingReviewStatus('g1', 'b1');
    expect(status.myReview).toMatchObject({ editable: false, publishesBy: null, published: true });
    expect(status.counterpartReview).toEqual({
      id: 'r2',
      rating: 5,
      comment: 'Uredan gost.',
      tags: ['COMMUNICATIVE'],
      writtenAt: expect.any(Date),
      published: true,
      publishedAt,
    });
  });

  it('keeps the booking to its two sides', async () => {
    const prisma = { booking: { findUnique: jest.fn().mockResolvedValue(booking) } };
    await expect(makeService(prisma).getBookingReviewStatus('x1', 'b1')).rejects.toThrow(ForbiddenException);
  });
});
