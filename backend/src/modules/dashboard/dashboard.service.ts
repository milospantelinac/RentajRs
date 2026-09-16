import { Injectable } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ReviewsService } from '../reviews/reviews.service';
import { UsersService } from '../users/users.service';
import { TaxonomyService } from '../taxonomy/taxonomy.service';
import { paraToRsd } from '../../common/utils/money';

interface AttentionItem {
  urgency: 'critical' | 'decision' | 'info';
  title: string;
  actionUrl: string;
  count?: number;
}

interface OnboardingStep {
  key: 'listing' | 'availability' | 'ical' | 'bankAccount';
  done: boolean;
  actionUrl: string;
}

const NEW_LISTING_URL = '/oglasi/novi';
const MY_LISTINGS_URL = '/kontrolna-tabla/oglasi';

// Dizajn 31: requests and bookings waiting for payment already hold their
// term, so "Sledećih 7 dana" lists them next to the confirmed ones.
const UPCOMING_STATUSES: BookingStatus[] = ['REQUESTED', 'AWAITING_PAYMENT', 'CONFIRMED'];

/**
 * Dizajn 31: where a step or a card about some of the owner's listings leads.
 * There is no calendar page, so one listing opens its wizard at "Dostupnost i
 * termini" (its calendar, hours, slots and iCal feeds); several open Moji oglasi.
 */
function availabilityUrl(listingIds: string[], emptyUrl = NEW_LISTING_URL): string {
  if (!listingIds.length) return emptyUrl;
  return listingIds.length === 1 ? `/oglasi/${listingIds[0]}/uredi?korak=availability` : MY_LISTINGS_URL;
}

/** "Milica J.": a row names the other side by first name and initial only. */
function shortName(person: { firstName: string; lastName: string } | null): string | null {
  if (!person) return null;
  const initial = person.lastName?.trim().charAt(0);
  return initial ? `${person.firstName} ${initial}.` : person.firstName;
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
    private taxonomy: TaxonomyService,
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

  /**
   * Dizajn 30: the red counters in the dashboard menu, polled by the layout.
   * Requests are the ones still waiting for this owner's answer, and messages
   * count conversations (as owner or guest) with anything unread, the same
   * rows the attention items above count.
   */
  async getCounts(userId: string) {
    const [bookingRequests, unreadConversations] = await Promise.all([
      this.prisma.booking.count({ where: { ownerId: userId, status: 'REQUESTED' } }),
      this.prisma.conversation.count({
        where: {
          OR: [
            { ownerId: userId, unreadOwnerCount: { gt: 0 } },
            { guestId: userId, unreadGuestCount: { gt: 0 } },
          ],
        },
      }),
    ]);
    return { bookingRequests, unreadConversations };
  }

  private async getOwnerAttention(userId: string): Promise<AttentionItem[]> {
    const items: AttentionItem[] = [];

    const awaitingConfirmation = await this.prisma.booking.count({
      where: { ownerId: userId, status: 'AWAITING_PAYMENT' },
    });
    if (awaitingConfirmation) {
      items.push({ urgency: 'critical', title: 'payment_confirmation', actionUrl: '/kontrolna-tabla/rezervacije?role=owner&status=AWAITING_PAYMENT', count: awaitingConfirmation });
    }

    // Dizajn 31: this used to link to /kontrolna-tabla/kalendar, a page that
    // never existed; the conflicting listing's own calendar is the place to look.
    const termConflicts = await this.prisma.dispute.findMany({
      where: { type: 'TERM_CONFLICT', status: 'NEW', listing: { userId } },
      select: { listingId: true },
    });
    if (termConflicts.length) {
      const listingIds = [...new Set(termConflicts.map((d) => d.listingId as string))];
      items.push({ urgency: 'critical', title: 'term_conflict', actionUrl: availabilityUrl(listingIds, MY_LISTINGS_URL), count: termConflicts.length });
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

    // Dizajn 31: one reminder per side, like the unread messages below. Each
    // opens the completed bookings on its own side of the bookings list (the
    // plain link used to land an owner on the guest tab).
    const pendingReviews = await this.reviews.getMyPendingReviews(userId);
    const ownerReviews = pendingReviews.filter((r) => r.direction === 'OWNER_TO_GUEST').length;
    const guestReviews = pendingReviews.length - ownerReviews;
    if (ownerReviews) {
      items.push({ urgency: 'info', title: 'pending_reviews_owner', actionUrl: '/kontrolna-tabla/rezervacije?role=owner&status=COMPLETED', count: ownerReviews });
    }
    if (guestReviews) {
      items.push({ urgency: 'info', title: 'pending_reviews_guest', actionUrl: '/kontrolna-tabla/rezervacije?role=guest&status=COMPLETED', count: guestReviews });
    }

    const unreadAsGuest = await this.prisma.conversation.count({ where: { guestId: userId, unreadGuestCount: { gt: 0 } } });
    if (unreadAsGuest) {
      items.push({ urgency: 'info', title: 'unread_messages_guest', actionUrl: '/kontrolna-tabla/poruke', count: unreadAsGuest });
    }

    return items;
  }

  /**
   * T97 — "bookingCount" used to mean "bookings as owner" for anyone with a
   * listing, and "bookings as guest" otherwise, silently dropping whichever
   * side the account didn't currently match — an owner with a confirmed
   * booking as a GUEST saw "Rezervacija 0". It now always counts both (a
   * reservation is a reservation regardless of which side of it you were
   * on), consistent with Ch.10's "nothing hidden by role" note above.
   * "confirmedValue" stays owner-earnings-only when isOwner (mixing in a
   * guest's own spend would conflate money coming in with money going out).
   */
  private async getStats(userId: string, isOwner: boolean) {
    const guestBookingCount = await this.prisma.booking.count({
      where: { guestId: userId, status: { in: ['CONFIRMED', 'COMPLETED'] } },
    });

    if (!isOwner) {
      return { listingCount: 0, bookingCount: guestBookingCount, confirmedValue: 0, avgRating: null };
    }

    const [listingCount, bookings, listings] = await Promise.all([
      // Dizajn 31: "Trenutno aktivni oglasi", as the card and its tooltip say
      // (this used to count drafts, rejected and expired listings too).
      this.prisma.listing.count({ where: { userId, status: 'ACTIVE' } }),
      this.prisma.booking.findMany({ where: { ownerId: userId, status: { in: ['CONFIRMED', 'COMPLETED'] } }, select: { totalAmount: true } }),
      this.prisma.listing.findMany({ where: { userId, reviewCount: { gt: 0 } }, select: { avgRating: true, reviewCount: true } }),
    ]);

    const confirmedValue = bookings.reduce((sum, b) => sum + Number(paraToRsd(b.totalAmount)), 0);
    const totalReviews = listings.reduce((sum, l) => sum + l.reviewCount, 0);
    const avgRating = totalReviews
      ? listings.reduce((sum, l) => sum + (Number(l.avgRating) || 0) * l.reviewCount, 0) / totalReviews
      : null;

    return { listingCount, bookingCount: bookings.length + guestBookingCount, confirmedValue, avgRating };
  }

  /**
   * R106: a brand new owner sees a checklist instead of an empty dashboard.
   * Dizajn 31: the steps follow the listings, so the card can always be
   * finished. Availability only applies to listings that take bookings, and
   * iCal only to ones booked by the night or the day (addIcalSource refuses
   * the rest); someone with no listing yet sees all four. Defined slots count
   * as availability next to working hours and calendar blocks.
   */
  private async getOnboarding(userId: string) {
    const [listings, workingHoursCount, definedSlotCount, blockedTermCount, icalCount, user] = await Promise.all([
      this.prisma.listing.findMany({
        where: { userId, status: { not: 'DELETED' } },
        orderBy: { createdAt: 'asc' },
        select: { id: true, bookingModel: true, priceUnit: true },
      }),
      this.prisma.workingHours.count({ where: { listing: { userId } } }),
      this.prisma.definedSlot.count({ where: { listing: { userId } } }),
      this.prisma.blockedTerm.count({ where: { listing: { userId } } }),
      this.prisma.icalSource.count({ where: { listing: { userId } } }),
      this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { bankAccount: true } }),
    ]);
    const bookable = listings.filter((l) => l.bookingModel !== 'NO_BOOKING').map((l) => l.id);
    const icalCapable = listings.filter((l) => l.bookingModel === 'PER_STAY' && l.priceUnit !== 'MONTH').map((l) => l.id);
    const noListing = listings.length === 0;

    const steps: OnboardingStep[] = [{ key: 'listing', done: !noListing, actionUrl: NEW_LISTING_URL }];
    if (noListing || bookable.length) {
      const done = workingHoursCount + definedSlotCount + blockedTermCount > 0;
      steps.push({ key: 'availability', done, actionUrl: availabilityUrl(bookable) });
    }
    if (noListing || icalCapable.length) {
      steps.push({ key: 'ical', done: icalCount > 0, actionUrl: availabilityUrl(icalCapable) });
    }
    steps.push({ key: 'bankAccount', done: !!user.bankAccount, actionUrl: '/kontrolna-tabla/podesavanja' });

    return { steps, allDone: steps.every((step) => step.done) };
  }

  /**
   * T97 — "startsAt >= now" only ever matched bookings that hadn't started
   * yet, so a booking already under way (checked in, ends later this week)
   * silently fell out of "Sledećih 7 dana" the moment it started. A booking
   * belongs here whenever any part of it still overlaps the next 7 days —
   * i.e. it hasn't ended yet, and it starts within that window.
   *
   * Dizajn 31: a row carries what 357:531 prints: the state, the listing and
   * its part of town, the other side's short name and the guest count, with
   * the count's noun ("dece" where the category counts children).
   */
  private async getUpcoming(userId: string) {
    const now = Date.now();
    const bookings = await this.prisma.booking.findMany({
      where: {
        OR: [{ guestId: userId }, { ownerId: userId }],
        status: { in: UPCOMING_STATUSES },
        startsAt: { lt: new Date(now + 7 * 86_400_000) },
        endsAt: { gte: new Date(now) },
      },
      orderBy: { startsAt: 'asc' },
      select: {
        id: true,
        status: true,
        startsAt: true,
        endsAt: true,
        priceUnit: true,
        guestCount: true,
        guestId: true,
        listing: {
          select: {
            title: true,
            slug: true,
            categoryId: true,
            city: { select: { name: true } },
            cityArea: { select: { name: true } },
          },
        },
        guest: { select: { firstName: true, lastName: true } },
        owner: { select: { firstName: true, lastName: true } },
      },
      take: 10,
    });

    const categoryIds = [...new Set(bookings.map((b) => b.listing.categoryId))];
    const countsChildren = new Map(
      await Promise.all(
        categoryIds.map(async (id) => {
          const attributes = await this.taxonomy.resolveAttributesForCategory(id);
          return [id, attributes.some((a) => a.key === 'kapacitet_dece')] as const;
        }),
      ),
    );

    return bookings.map((b) => {
      const asGuest = b.guestId === userId;
      return {
        id: b.id,
        status: b.status,
        startsAt: b.startsAt,
        endsAt: b.endsAt,
        priceUnit: b.priceUnit,
        guestCount: b.guestCount,
        guestUnit: countsChildren.get(b.listing.categoryId) ? 'children' : 'guests',
        role: asGuest ? 'guest' : 'owner',
        listing: {
          title: b.listing.title,
          slug: b.listing.slug,
          place: b.listing.cityArea?.name ?? b.listing.city?.name ?? null,
        },
        counterpartName: shortName(asGuest ? b.owner : b.guest),
      };
    });
  }
}
