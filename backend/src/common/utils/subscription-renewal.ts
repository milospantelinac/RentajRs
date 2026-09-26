import { BillingCycle, Prisma, Subscription, SubscriptionStatus } from '@prisma/client';

export const DAY_MS = 86_400_000;

/** A package runs for 30 or 365 days from the moment its clock starts. */
export function cycleLength(billingCycle: BillingCycle): number {
  return billingCycle === 'YEARLY' ? 365 : 30;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** Packages an owner can renew: the one that runs now, or one that already ended. */
export const RENEWABLE_SUBSCRIPTION_STATUSES: SubscriptionStatus[] = ['ACTIVE', 'EXPIRED'];

/** Still paying for its listings: a renewal bought now waits for this period to end. */
export function isRunningPeriod(subscription: Pick<Subscription, 'status' | 'expiresAt'>, now = new Date()): boolean {
  if (subscription.status === 'SCHEDULED') return true;
  return subscription.status === 'ACTIVE' && !!subscription.expiresAt && subscription.expiresAt > now;
}

/**
 * A listing that leaves search when its package ends: not deleted, and with no
 * carried-over days waiting to start (ADR-005, see expireOverdueSubscriptions).
 */
export const LISTING_LEAVES_SEARCH_AT_END: Prisma.ListingWhereInput = {
  status: { not: 'DELETED' },
  bankedDays: { none: { usedAt: null, validUntil: null } },
};

/**
 * Running packages whose end would take a listing out of search: nothing paid
 * for the next period yet. The reminders, the home task and Moje pretplate's
 * red cards all mean these.
 */
export const PACKAGE_ENDING_WITHOUT_RENEWAL: Prisma.SubscriptionWhereInput = {
  status: 'ACTIVE',
  renewals: { none: { status: 'SCHEDULED' } },
  listings: { some: LISTING_LEAVES_SEARCH_AT_END },
};
