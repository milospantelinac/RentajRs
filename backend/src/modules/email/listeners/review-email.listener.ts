import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmailService } from '../../../common/email/email.service';
import { readReviewDeadline } from '../../../common/utils/review-window';
import { formatDate, localeFor } from '../format';

@Injectable()
export class ReviewEmailListener {
  private readonly frontendUrl: string;

  constructor(
    private prisma: PrismaService,
    private email: EmailService,
    config: ConfigService,
  ) {
    this.frontendUrl = config.get<string>('frontendUrl')!;
  }

  /**
   * Ch.22.4 "Poziv za ocenu": fires once a booking is realized. Since
   * Dizajn 43 only the guest reviews; {rok} is the last day to do it.
   */
  @OnEvent('booking.completed')
  async onBookingCompleted({ bookingId }: { bookingId: string }) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { listing: { select: { title: true } }, guest: true },
    });
    if (!booking) return;
    const reviewBy = await readReviewDeadline(this.prisma, booking);
    await this.email.send({
      key: 'review_invitation',
      to: booking.guest.email,
      language: booking.guest.language,
      userId: booking.guest.id,
      context: { oglas: booking.listing.title, rok: formatDate(reviewBy, localeFor(booking.guest.language)) },
      buttonUrl: `${this.frontendUrl}/rezervacije/${booking.id}`,
    });
  }

  /** Dizajn 43: a guest's review is public the moment it is sent, and its owner hears of it. */
  @OnEvent('review.published')
  async onPublished({ reviewId }: { reviewId: string }) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      include: { listing: { select: { title: true, slug: true } }, recipient: true },
    });
    if (!review) return;
    await this.email.send({
      key: 'reviews_published',
      to: review.recipient.email,
      language: review.recipient.language,
      userId: review.recipient.id,
      context: { oglas: review.listing.title },
      buttonUrl: `${this.frontendUrl}/oglasi/${review.listing.slug}`,
    });
  }

  /** {rok}: the last day of the review window (Dizajn 43). */
  @OnEvent('review.reminder')
  async onReminder({ bookingId, userId, reviewBy }: { bookingId: string; userId: string; reviewBy: Date }) {
    const [booking, user] = await Promise.all([
      this.prisma.booking.findUnique({ where: { id: bookingId }, include: { listing: { select: { title: true } } } }),
      this.prisma.user.findUnique({ where: { id: userId } }),
    ]);
    if (!booking || !user) return;
    await this.email.send({
      key: 'review_reminder_7d',
      to: user.email,
      language: user.language,
      userId,
      context: { oglas: booking.listing.title, rok: formatDate(reviewBy, localeFor(user.language)) },
      buttonUrl: `${this.frontendUrl}/rezervacije/${bookingId}`,
    });
  }

  @OnEvent('review.replied')
  async onReplied({ reviewId }: { reviewId: string }) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      include: { listing: { select: { title: true, slug: true } }, author: true },
    });
    if (!review) return;
    await this.email.send({
      key: 'review_replied',
      to: review.author.email,
      language: review.author.language,
      userId: review.author.id,
      context: { oglas: review.listing.title },
      buttonUrl: `${this.frontendUrl}/oglasi/${review.listing.slug}`,
    });
  }
}
