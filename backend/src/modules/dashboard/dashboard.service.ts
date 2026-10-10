import { Injectable } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ReviewsService } from '../reviews/reviews.service';
import { UsersService } from '../users/users.service';
import { TaxonomyService } from '../taxonomy/taxonomy.service';
import { paraToRsd } from '../../common/utils/money';
import { ICAL_FAILURE_ALERT_THRESHOLD } from '../../common/utils/ical-availability';
import { PACKAGE_ENDING_WITHOUT_RENEWAL } from '../../common/utils/subscription-renewal';
import { getGuestUnits } from '../../common/utils/guest-capacity';
import { shortName } from '../../common/utils/short-name';
import { normalizeBankAccount } from '../../common/utils/ips-qr';
import { OPEN_PAYMENT_REPORT } from '../../common/utils/payment-report';

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
 * termini" (its calendar, hours and slots); several open Moji oglasi.
 */
function availabilityUrl(listingIds: string[], emptyUrl = NEW_LISTING_URL): string {
  if (!listingIds.length) return emptyUrl;
  return listingIds.length === 1 ? `/oglasi/${listingIds[0]}/uredi?korak=availability` : MY_LISTINGS_URL;
}

/** Dizajn 33: connected calendars have their own page per listing. */
function icalUrl(listingIds: string[], emptyUrl = NEW_LISTING_URL): string {
  if (!listingIds.length) return emptyUrl;
  return listingIds.length === 1 ? `${MY_LISTINGS_URL}/${listingIds[0]}/ical` : MY_LISTINGS_URL;
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
   * Requests are the ones still waiting for this owner's answer (T136: a
   * guest's request for another term too), and messages count conversations
   * (as owner or guest) with anything unread, the same rows the attention
   * items above count.
   */
  async getCounts(userId: string) {
    const [newRequests, changeRequests, unreadConversations] = await Promise.all([
      this.prisma.booking.count({ where: { ownerId: userId, status: 'REQUESTED' } }),
      this.prisma.bookingChangeRequest.count({ where: { status: 'PENDING', booking: { ownerId: userId } } }),
      this.prisma.conversation.count({
        where: {
          OR: [
            { ownerId: userId, unreadOwnerCount: { gt: 0 } },
            { guestId: userId, unreadGuestCount: { gt: 0 } },
          ],
        },
      }),
    ]);
    return { bookingRequests: newRequests + changeRequests, unreadConversations };
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

    // Dizajn 33: a connected calendar that keeps failing (availability.ical_sync_failed)
    // no longer brings the other platform's busy dates over.
    const failingFeeds = await this.prisma.icalSource.findMany({
      where: { active: true, failureCount: { gte: ICAL_FAILURE_ALERT_THRESHOLD }, listing: { userId, status: { not: 'DELETED' } } },
      select: { listingId: true },
    });
    if (failingFeeds.length) {
      const listingIds = [...new Set(failingFeeds.map((feed) => feed.listingId))];
      items.push({ urgency: 'critical', title: 'ical_sync_failed', actionUrl: icalUrl(listingIds, MY_LISTINGS_URL), count: failingFeeds.length });
    }

    const newRequests = await this.prisma.booking.count({ where: { ownerId: userId, status: 'REQUESTED' } });
    if (newRequests) {
      items.push({ urgency: 'decision', title: 'new_requests', actionUrl: '/kontrolna-tabla/rezervacije?role=owner&status=REQUESTED', count: newRequests });
    }

    // T136: guests waiting for an answer about another term.
    const changeRequests = await this.prisma.bookingChangeRequest.count({ where: { status: 'PENDING', booking: { ownerId: userId } } });
    if (changeRequests) {
      items.push({ urgency: 'decision', title: 'change_requests', actionUrl: '/kontrolna-tabla/rezervacije?role=owner', count: changeRequests });
    }

    // The same packages Moje pretplate marks red: renewed ones and ones no listing depends on don't count.
    const expiringSoon = await this.prisma.subscription.count({
      where: { ...PACKAGE_ENDING_WITHOUT_RENEWAL, userId, expiresAt: { lt: new Date(Date.now() + 7 * 86_400_000) } },
    });
    if (expiringSoon) {
      items.push({ urgency: 'decision', title: 'subscription_expiring', actionUrl: '/kontrolna-tabla/pretplate', count: expiringSoon });
    }

    // Dizajn 32: straight to the "Odbijeni" tab of Moji oglasi.
    const rejectedListings = await this.prisma.listing.count({ where: { userId, status: 'REJECTED' } });
    if (rejectedListings) {
      items.push({ urgency: 'decision', title: 'rejected_listings', actionUrl: `${MY_LISTINGS_URL}?status=REJECTED`, count: rejectedListings });
    }

    const unreadAsOwner = await this.prisma.conversation.count({ where: { ownerId: userId, unreadOwnerCount: { gt: 0 } } });
    if (unreadAsOwner) {
      items.push({ urgency: 'info', title: 'unread_messages_owner', actionUrl: '/kontrolna-tabla/poruke', count: unreadAsOwner });
    }

    return items;
  }

  private async getGuestAttention(userId: string): Promise<AttentionItem[]> {
    const items: AttentionItem[] = [];

    // "Uplatite pre isteka roka" is wrong once the guest has reported the
    // payment as sent: the booking waits past its deadline while that is open.
    const awaitingPayment = await this.prisma.booking.count({
      where: { guestId: userId, status: 'AWAITING_PAYMENT', disputes: { none: OPEN_PAYMENT_REPORT } },
    });
    if (awaitingPayment) {
      items.push({ urgency: 'critical', title: 'payment_deadline', actionUrl: '/kontrolna-tabla/rezervacije?role=guest&status=AWAITING_PAYMENT', count: awaitingPayment });
    }

    // Dizajn 31, 43: only guests review, so the reminder opens the completed
    // bookings on the guest side of the bookings list, and a booking leaves
    // it once its review window closes.
    const pendingReviews = await this.reviews.getMyPendingReviews(userId);
    if (pendingReviews.length) {
      items.push({ urgency: 'info', title: 'pending_reviews_guest', actionUrl: '/kontrolna-tabla/rezervacije?role=guest&status=COMPLETED', count: pendingReviews.length });
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
      steps.push({ key: 'ical', done: icalCount > 0, actionUrl: icalUrl(icalCapable) });
    }
    steps.push({ key: 'bankAccount', done: !!normalizeBankAccount(user.bankAccount), actionUrl: '/kontrolna-tabla/podesavanja' });

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

    const guestUnits = await getGuestUnits(this.taxonomy, bookings.map((b) => b.listing.categoryId));

    return bookings.map((b) => {
      const asGuest = b.guestId === userId;
      return {
        id: b.id,
        status: b.status,
        startsAt: b.startsAt,
        endsAt: b.endsAt,
        priceUnit: b.priceUnit,
        guestCount: b.guestCount,
        guestUnit: guestUnits.get(b.listing.categoryId),
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
