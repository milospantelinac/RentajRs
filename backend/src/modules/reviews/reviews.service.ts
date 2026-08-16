import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { I18nService } from 'nestjs-i18n';
import { ReviewDirection } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReviewDto, ReplyToReviewDto } from './dto/reviews.dto';

const DEFAULT_REVIEW_WINDOW_DAYS = 14;

@Injectable()
export class ReviewsService {
  constructor(
    private prisma: PrismaService,
    private i18n: I18nService,
    private events: EventEmitter2,
  ) {}

  /** R92: only the side of a COMPLETED booking may review, and only once per direction. */
  async createReview(authorId: string, dto: CreateReviewDto) {
    const booking = await this.prisma.booking.findUniqueOrThrow({ where: { id: dto.bookingId } });
    if (booking.status !== 'COMPLETED') {
      throw new BadRequestException('Reviews can only be left for a completed booking');
    }

    let direction: ReviewDirection;
    let recipientId: string;
    if (booking.guestId === authorId) {
      direction = 'GUEST_TO_OWNER';
      recipientId = booking.ownerId;
    } else if (booking.ownerId === authorId) {
      direction = 'OWNER_TO_GUEST';
      recipientId = booking.guestId;
    } else {
      throw new ForbiddenException();
    }

    const existing = await this.prisma.review.findUnique({
      where: { bookingId_direction: { bookingId: booking.id, direction } },
    });
    if (existing) throw new BadRequestException('You have already reviewed this booking');

    if (direction === 'OWNER_TO_GUEST' && dto.tags?.length) {
      // R100 — quick tags are guest-facing only; silently ignored for GUEST_TO_OWNER.
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

  /** R96: both publish together once the second side writes theirs, or after 14 days — whichever first. */
  private async tryPublishPair(bookingId: string) {
    const reviews = await this.prisma.review.findMany({ where: { bookingId } });
    if (reviews.length < 2) return;
    await this.publishReviews(reviews.map((r) => r.id));
  }

  private async publishReviews(reviewIds: string[]) {
    const now = new Date();
    await this.prisma.review.updateMany({
      where: { id: { in: reviewIds }, published: false },
      data: { published: true, publishedAt: now },
    });

    for (const reviewId of reviewIds) {
      const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
      if (!review) continue;
      await this.refreshListingRating(review.listingId);
    }
    this.events.emit('review.published', { reviewIds });
  }

  private async refreshListingRating(listingId: string) {
    const published = await this.prisma.review.findMany({
      where: { listingId, published: true, hiddenByAdmin: false, direction: 'GUEST_TO_OWNER' },
      select: { rating: true },
    });
    // R102 — average shown only from 3 reviews onward; below that just the count is exposed (handled client-side).
    const avg = published.length ? published.reduce((sum, r) => sum + r.rating, 0) / published.length : null;
    await this.prisma.listing.update({
      where: { id: listingId },
      data: { avgRating: avg, reviewCount: published.length },
    });
  }

  async replyToReview(ownerId: string, reviewId: string, dto: ReplyToReviewDto) {
    const review = await this.prisma.review.findUniqueOrThrow({ where: { id: reviewId } });
    if (review.direction !== 'GUEST_TO_OWNER' || review.recipientId !== ownerId) throw new ForbiddenException();
    if (!review.published) throw new BadRequestException('Review is not published yet');

    const existing = await this.prisma.reviewReply.findUnique({ where: { reviewId } });
    if (existing) throw new BadRequestException('This review already has a reply'); // R101 — one reply, never edited

    const reply = await this.prisma.reviewReply.create({ data: { reviewId, authorId: ownerId, content: dto.content } });
    this.events.emit('review.replied', { reviewId });
    return reply;
  }

  async getListingReviews(listingId: string) {
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

  /** Drives the "leave a review" panel on the booking detail page — never exposes an unpublished counterpart review (R96). */
  async getBookingReviewStatus(userId: string, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException();
    if (booking.guestId !== userId && booking.ownerId !== userId) throw new ForbiddenException();

    const myDirection: ReviewDirection = booking.guestId === userId ? 'GUEST_TO_OWNER' : 'OWNER_TO_GUEST';
    const counterpartDirection: ReviewDirection = myDirection === 'GUEST_TO_OWNER' ? 'OWNER_TO_GUEST' : 'GUEST_TO_OWNER';

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

  async getMyPendingReviews(userId: string) {
    // Bookings this user could review but hasn't yet (drives the dashboard "leave a review" nudge).
    const completed = await this.prisma.booking.findMany({
      where: { OR: [{ guestId: userId }, { ownerId: userId }], status: 'COMPLETED' },
      include: { listing: { select: { title: true, slug: true } }, reviews: true },
    });
    return completed
      .filter((b) => {
        const direction: ReviewDirection = b.guestId === userId ? 'GUEST_TO_OWNER' : 'OWNER_TO_GUEST';
        return !b.reviews.some((r) => r.direction === direction);
      })
      .map((b) => ({ bookingId: b.id, listing: b.listing }));
  }

  // -- Admin ---------------------------------------------------------

  async adminHideReview(adminId: string, reviewId: string) {
    await this.prisma.review.update({ where: { id: reviewId }, data: { hiddenByAdmin: true } });
    const review = await this.prisma.review.findUniqueOrThrow({ where: { id: reviewId } });
    await this.refreshListingRating(review.listingId);
    void adminId;
    return { message: this.i18n.t('common.SUCCESS') };
  }

  // -- Scheduled jobs --------------------------------------------------

  /** R96 fallback — publish solo once 14 days pass without the counterpart writing theirs. */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
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

  /** R171 — admin-editable in /admin/podesavanja (Setting.review_window_days). */
  private async getReviewWindowDays(): Promise<number> {
    const setting = await this.prisma.setting.findUnique({ where: { key: 'review_window_days' } });
    return typeof setting?.value === 'number' ? setting.value : DEFAULT_REVIEW_WINDOW_DAYS;
  }

  /**
   * Ch.8.4 — 7-day nudge for bookings that finished without a review yet.
   * Booking has no updatedAt column, so "completed 7 days ago" is read off
   * the automatic COMPLETED transition recorded in BookingHistory instead.
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
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
      if (!booking) continue;
      const reviews = await this.prisma.review.findMany({ where: { bookingId } });
      const guestReviewed = reviews.some((r) => r.direction === 'GUEST_TO_OWNER');
      const ownerReviewed = reviews.some((r) => r.direction === 'OWNER_TO_GUEST');
      if (!guestReviewed) this.events.emit('review.reminder', { bookingId, userId: booking.guestId });
      if (!ownerReviewed) this.events.emit('review.reminder', { bookingId, userId: booking.ownerId });
    }
  }
}
