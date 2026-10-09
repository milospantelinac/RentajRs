import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { I18nService } from 'nestjs-i18n';
import { Prisma, Review } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReviewDto, ReplyToReviewDto, UpdateReviewDto } from './dto/reviews.dto';
import {
  getReviewDeadline,
  getReviewEditableUntil,
  readReviewDeadline,
  readReviewEditDays,
  readReviewWindowDays,
} from '../../common/utils/review-window';

/**
 * What the booking page shows of the guest's own review: no author,
 * recipient or moderation fields. Dizajn 43 (585:515): it can change until
 * `editableUntil`, which the page names.
 */
function reviewView(review: Review, editDays: number, now = new Date()) {
  const editableUntil = getReviewEditableUntil(review.publishedAt, editDays);
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

@Injectable()
export class ReviewsService {
  constructor(
    private prisma: PrismaService,
    private i18n: I18nService,
    private events: EventEmitter2,
  ) {}

  /**
   * R92, Dizajn 43: only the guest of a COMPLETED booking reviews it, once and
   * within review_window_days of completion, and the review is public at
   * once. Owners no longer rate guests.
   */
  async createReview(authorId: string, dto: CreateReviewDto) {
    const booking = await this.prisma.booking.findUnique({ where: { id: dto.bookingId } });
    if (!booking) throw new NotFoundException();
    if (booking.guestId !== authorId) throw new ForbiddenException();
    if (booking.status !== 'COMPLETED') {
      throw new BadRequestException('Reviews can only be left for a completed booking');
    }

    const [existing, reviewBy, editDays] = await Promise.all([
      this.prisma.review.findUnique({ where: { bookingId: booking.id } }),
      readReviewDeadline(this.prisma, booking),
      readReviewEditDays(this.prisma),
    ]);
    if (existing) throw new BadRequestException(this.i18n.t('errors.REVIEW_ALREADY_EXISTS'));
    if (new Date() > reviewBy) throw new BadRequestException(this.i18n.t('errors.REVIEW_WINDOW_CLOSED'));

    let review: Review;
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
    } catch (err) {
      // A second send racing the first meets the one review per booking.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException(this.i18n.t('errors.REVIEW_ALREADY_EXISTS'));
      }
      throw err;
    }

    await this.refreshListingRating(booking.listingId);
    this.events.emit('review.published', { reviewId: review.id });
    return reviewView(review, editDays);
  }

  /**
   * Dizajn 43 (585:515): the author may change a review for review_edit_days
   * after it went public. The change is public at once and the listing's
   * rating follows it.
   */
  async updateReview(authorId: string, reviewId: string, dto: UpdateReviewDto) {
    const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundException();
    if (review.authorId !== authorId) throw new ForbiddenException();

    const editDays = await readReviewEditDays(this.prisma);
    const now = new Date();
    if (now > getReviewEditableUntil(review.publishedAt, editDays)) {
      throw new BadRequestException(this.i18n.t('errors.REVIEW_EDIT_CLOSED'));
    }

    const updated = await this.prisma.review.update({
      where: { id: reviewId },
      data: { rating: dto.rating, comment: dto.comment?.trim() || null },
    });
    await this.refreshListingRating(review.listingId);
    return reviewView(updated, editDays, now);
  }

  private async refreshListingRating(listingId: string) {
    const visible = await this.prisma.review.findMany({
      where: { listingId, hiddenByAdmin: false },
      select: { rating: true },
    });
    // T114: shown from the first review on (R102's three-review rule is gone).
    const avg = visible.length ? visible.reduce((sum, r) => sum + r.rating, 0) / visible.length : null;
    await this.prisma.listing.update({
      where: { id: listingId },
      data: { avgRating: avg, reviewCount: visible.length },
    });
  }

  async replyToReview(ownerId: string, reviewId: string, dto: ReplyToReviewDto) {
    const review = await this.prisma.review.findUniqueOrThrow({ where: { id: reviewId } });
    if (review.recipientId !== ownerId) throw new ForbiddenException();

    const existing = await this.prisma.reviewReply.findUnique({ where: { reviewId } });
    if (existing) throw new BadRequestException('This review already has a reply'); // R101 — one reply, never edited

    const reply = await this.prisma.reviewReply.create({ data: { reviewId, authorId: ownerId, content: dto.content } });
    this.events.emit('review.replied', { reviewId });
    return reply;
  }

  async getListingReviews(listingId: string) {
    const reviews = await this.prisma.review.findMany({
      where: { listingId, hiddenByAdmin: false },
      orderBy: { publishedAt: 'desc' },
      include: {
        // Dizajn 11 — a review card is signed "Miloš J.", so the surname's
        // initial has to come along; the full surname is never rendered.
        author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        reply: true,
      },
    });
    // Found in Dizajn 39: this public list used to send the whole row, with
    // the guest's full surname and the booking behind the review. It keeps
    // what the listing's page shows.
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

  /** Drives the review panel on the guest's booking page (Dizajn 39, 43); the owner has none. */
  async getBookingReviewStatus(userId: string, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException();
    if (booking.guestId !== userId) throw new ForbiddenException();

    const completed = booking.status === 'COMPLETED';
    const [mine, reviewBy, editDays] = await Promise.all([
      this.prisma.review.findUnique({ where: { bookingId } }),
      completed ? readReviewDeadline(this.prisma, booking) : null,
      readReviewEditDays(this.prisma),
    ]);
    const now = new Date();

    return {
      canReview: !!reviewBy && !mine && now <= reviewBy,
      myReview: mine ? reviewView(mine, editDays, now) : null,
    };
  }

  /** Dizajn 31, 43: the guest's completed bookings still open for a review (the dashboard's reminder). */
  async getMyPendingReviews(userId: string) {
    const [completed, windowDays] = await Promise.all([
      this.prisma.booking.findMany({
        where: { guestId: userId, status: 'COMPLETED', review: { is: null } },
        include: {
          listing: { select: { title: true, slug: true } },
          history: { where: { newStatus: 'COMPLETED' }, orderBy: { changedAt: 'desc' }, take: 1, select: { changedAt: true } },
        },
      }),
      readReviewWindowDays(this.prisma),
    ]);
    const now = new Date();
    return completed
      .filter((booking) => now <= getReviewDeadline(booking.history[0]?.changedAt ?? booking.endsAt, windowDays))
      .map((booking) => ({ bookingId: booking.id, listing: booking.listing }));
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

  /**
   * Ch.8.4: a 7-day nudge to the guest of a booking that finished without a
   * review yet, while the review window is still open (Dizajn 43).
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
      const booking = await this.prisma.booking.findUnique({ where: { id: bookingId }, include: { review: { select: { id: true } } } });
      if (!booking || booking.review) continue;
      const reviewBy = await readReviewDeadline(this.prisma, booking);
      if (new Date() > reviewBy) continue;
      this.events.emit('review.reminder', { bookingId, userId: booking.guestId, reviewBy });
    }
  }
}
