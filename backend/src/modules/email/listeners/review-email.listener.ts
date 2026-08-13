import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmailService } from '../../../common/email/email.service';

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

  /** Ch.22.4 "Poziv za ocenu" — fires once a booking is realized, to both sides. */
  @OnEvent('booking.completed')
  async onBookingCompleted({ bookingId }: { bookingId: string }) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { listing: { select: { title: true } }, guest: true, owner: true },
    });
    if (!booking) return;
    await Promise.all(
      [booking.guest, booking.owner].map((recipient) =>
        this.email.send({
          key: 'review_invitation',
          to: recipient.email,
          language: recipient.language,
          userId: recipient.id,
          context: { oglas: booking.listing.title },
          buttonUrl: `${this.frontendUrl}/rezervacije/${booking.id}`,
        }),
      ),
    );
  }

  @OnEvent('review.published')
  async onPublished({ reviewIds }: { reviewIds: string[] }) {
    const reviews = await this.prisma.review.findMany({
      where: { id: { in: reviewIds } },
      include: { listing: { select: { title: true, slug: true } }, author: true, recipient: true },
    });
    for (const review of reviews) {
      await this.email.send({
        key: 'reviews_published',
        to: review.recipient.email,
        language: review.recipient.language,
        userId: review.recipient.id,
        context: { oglas: review.listing.title },
        buttonUrl: `${this.frontendUrl}/oglasi/${review.listing.slug}`,
      });
    }
  }

  @OnEvent('review.reminder')
  async onReminder({ bookingId, userId }: { bookingId: string; userId: string }) {
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
      context: { oglas: booking.listing.title },
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
