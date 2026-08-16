import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ReviewsService } from '../reviews/reviews.service';
import { UsersService } from '../users/users.service';
import { paraToRsd } from '../../common/utils/money';

interface AttentionItem {
  urgency: 'critical' | 'decision' | 'info';
  title: string;
  actionUrl: string;
  count?: number;
}

/**
 * Ch.10 — one screen, same structure for everyone; which sections have
 * content depends purely on the facts (R13/R104/R105: a guest-only account
 * simply never has an "IZDAVANJE" section, an owner-only account never has
 * "REZERVISANJE" — nothing is hidden by role because there is no role).
 */
@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private reviews: ReviewsService,
    private users: UsersService,
  ) {}

  async getDashboard(userId: string) {
    const isOwner = await this.users.isOwner(userId);
    const [ownerAttention, guestAttention, stats, onboarding, upcoming] = await Promise.all([
      isOwner ? this.getOwnerAttention(userId) : [],
      this.getGuestAttention(userId),
      this.getStats(userId, isOwner),
      this.getOnboarding(userId),
      this.getUpcoming(userId),
    ]);

    return {
      isOwner,
      attentionItems: [...ownerAttention, ...guestAttention],
      stats,
      // R106 — this is aimed at exactly the user who *isn't* an owner yet
      // (that's the whole point of "objavi svoj prvi oglas"), so it must
      // never be gated on isOwner; it disappears on its own once allDone.
      onboarding: onboarding.allDone ? null : onboarding,
      upcomingBookings: upcoming,
    };
  }

  private async getOwnerAttention(userId: string): Promise<AttentionItem[]> {
    const items: AttentionItem[] = [];

    const awaitingConfirmation = await this.prisma.booking.count({
      where: { ownerId: userId, status: 'AWAITING_PAYMENT' },
    });
    if (awaitingConfirmation) {
      items.push({ urgency: 'critical', title: 'payment_confirmation', actionUrl: '/kontrolna-tabla/rezervacije?role=owner&status=AWAITING_PAYMENT', count: awaitingConfirmation });
    }

    const termConflicts = await this.prisma.dispute.count({ where: { type: 'TERM_CONFLICT', status: 'NEW', listing: { userId } } });
    if (termConflicts) {
      items.push({ urgency: 'critical', title: 'term_conflict', actionUrl: '/kontrolna-tabla/kalendar', count: termConflicts });
    }

    const newRequests = await this.prisma.booking.count({ where: { ownerId: userId, status: 'REQUESTED' } });
    if (newRequests) {
      items.push({ urgency: 'decision', title: 'new_requests', actionUrl: '/kontrolna-tabla/rezervacije?role=owner&status=REQUESTED', count: newRequests });
    }

    const expiringSoon = await this.prisma.subscription.count({
      where: { userId, status: 'ACTIVE', expiresAt: { lt: new Date(Date.now() + 7 * 86_400_000) } },
    });
    if (expiringSoon) {
      items.push({ urgency: 'decision', title: 'subscription_expiring', actionUrl: '/kontrolna-tabla/pretplate', count: expiringSoon });
    }

    const rejectedListings = await this.prisma.listing.count({ where: { userId, status: 'REJECTED' } });
    if (rejectedListings) {
      items.push({ urgency: 'decision', title: 'rejected_listings', actionUrl: '/kontrolna-tabla/oglasi', count: rejectedListings });
    }

    const unreadAsOwner = await this.prisma.conversation.count({ where: { ownerId: userId, unreadOwnerCount: { gt: 0 } } });
    if (unreadAsOwner) {
      items.push({ urgency: 'info', title: 'unread_messages_owner', actionUrl: '/kontrolna-tabla/poruke', count: unreadAsOwner });
    }

    return items;
  }

  private async getGuestAttention(userId: string): Promise<AttentionItem[]> {
    const items: AttentionItem[] = [];

    const awaitingPayment = await this.prisma.booking.count({ where: { guestId: userId, status: 'AWAITING_PAYMENT' } });
    if (awaitingPayment) {
      items.push({ urgency: 'critical', title: 'payment_deadline', actionUrl: '/kontrolna-tabla/rezervacije?role=guest&status=AWAITING_PAYMENT', count: awaitingPayment });
    }

    const pendingReviews = await this.reviews.getMyPendingReviews(userId);
    if (pendingReviews.length) {
      items.push({ urgency: 'info', title: 'pending_reviews', actionUrl: '/kontrolna-tabla/rezervacije', count: pendingReviews.length });
    }

    const unreadAsGuest = await this.prisma.conversation.count({ where: { guestId: userId, unreadGuestCount: { gt: 0 } } });
    if (unreadAsGuest) {
      items.push({ urgency: 'info', title: 'unread_messages_guest', actionUrl: '/kontrolna-tabla/poruke', count: unreadAsGuest });
    }

    return items;
  }

  private async getStats(userId: string, isOwner: boolean) {
    if (!isOwner) {
      const bookingCount = await this.prisma.booking.count({ where: { guestId: userId } });
      return { listingCount: 0, bookingCount, confirmedValue: 0, avgRating: null };
    }

    const [listingCount, bookings, listings] = await Promise.all([
      this.prisma.listing.count({ where: { userId, status: { not: 'DELETED' } } }),
      this.prisma.booking.findMany({ where: { ownerId: userId, status: { in: ['CONFIRMED', 'COMPLETED'] } }, select: { totalAmount: true } }),
      this.prisma.listing.findMany({ where: { userId, reviewCount: { gt: 0 } }, select: { avgRating: true, reviewCount: true } }),
    ]);

    const confirmedValue = bookings.reduce((sum, b) => sum + Number(paraToRsd(b.totalAmount)), 0);
    const totalReviews = listings.reduce((sum, l) => sum + l.reviewCount, 0);
    const avgRating = totalReviews
      ? listings.reduce((sum, l) => sum + (Number(l.avgRating) || 0) * l.reviewCount, 0) / totalReviews
      : null;

    return { listingCount, bookingCount: bookings.length, confirmedValue, avgRating };
  }

  /** R106 — a brand new owner sees a checklist instead of an empty dashboard. */
  private async getOnboarding(userId: string) {
    const [listingCount, workingHoursCount, blockedTermCount, icalCount, user] = await Promise.all([
      this.prisma.listing.count({ where: { userId, status: { not: 'DELETED' } } }),
      this.prisma.workingHours.count({ where: { listing: { userId } } }),
      this.prisma.blockedTerm.count({ where: { listing: { userId } } }),
      this.prisma.icalSource.count({ where: { listing: { userId } } }),
      this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    ]);
    const hasListing = listingCount > 0;
    const hasAvailability = workingHoursCount > 0 || blockedTermCount > 0;
    const hasIcal = icalCount > 0;
    const hasBankAccount = !!user.bankAccount;
    return {
      hasListing,
      hasAvailability,
      hasIcal,
      hasBankAccount,
      allDone: hasListing && hasAvailability && hasIcal && hasBankAccount,
    };
  }

  private async getUpcoming(userId: string) {
    const bookings = await this.prisma.booking.findMany({
      where: {
        OR: [{ guestId: userId }, { ownerId: userId }],
        status: 'CONFIRMED',
        startsAt: { gte: new Date(), lt: new Date(Date.now() + 7 * 86_400_000) },
      },
      orderBy: { startsAt: 'asc' },
      include: { listing: { select: { title: true, slug: true } } },
      take: 10,
    });
    return bookings.map((b) => ({
      ...b,
      pricePerUnit: paraToRsd(b.pricePerUnit),
      totalAmount: paraToRsd(b.totalAmount),
      amountDue: paraToRsd(b.amountDue),
    }));
  }
}
