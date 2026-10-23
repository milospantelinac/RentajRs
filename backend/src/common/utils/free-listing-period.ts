import { BillingCycle } from '@prisma/client';
import { BELGRADE_TZ, belgradeDayStart, endOfBelgradeDayAfter } from './timezone';

/**
 * Administracija > Oglasi: how long a listing an admin publishes without
 * payment stays online, in months or in days (the user, 2026-10-22), or with
 * no end at all. A period ends with the last instant of its Belgrade day, so
 * "do 22. 11." holds for all of that day; the nightly sweep takes the listing
 * out of search after it.
 */
export type PeriodUnit = 'MONTHS' | 'DAYS';

export const MAX_PERIOD: Record<PeriodUnit, number> = { MONTHS: 120, DAYS: 3650 };

/** The end of the Belgrade day `amount` months or days after the day `from` falls on. */
export function periodEnd(from: Date, amount: number, unit: PeriodUnit): Date {
  if (unit === 'DAYS') return endOfBelgradeDayAfter(from, amount);
  const [year, month, day] = from.toLocaleDateString('en-CA', { timeZone: BELGRADE_TZ }).split('-').map(Number);
  // A month later is the same day of the month, or that month's last day (31. 1. + 1 month = 28. 2.).
  const target = new Date(Date.UTC(year, month - 1 + amount, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  const next = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(day, lastDay) + 1));
  return new Date(belgradeDayStart(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate()).getTime() - 1);
}

/**
 * The billing cycle a free package is filed under. It only labels the row (an
 * owner who later pays to continue picks the cycle at checkout); a year or
 * more, or no end, reads as yearly.
 */
export function grantBillingCycle(amount: number | null, unit: PeriodUnit | null): BillingCycle {
  if (amount === null || unit === null) return 'YEARLY';
  return (unit === 'MONTHS' && amount >= 12) || (unit === 'DAYS' && amount >= 365) ? 'YEARLY' : 'MONTHLY';
}
