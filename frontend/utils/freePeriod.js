// Administracija > Oglasi: how long a listing an admin publishes without
// payment lasts, in months or in days (the user, 2026-10-22), or with no end.
// The dialogs preview the end the way the backend works it out
// (common/utils/free-listing-period.ts): the end of the Belgrade day N months
// or days after the day it counts from. The server decides; this only shows it.
import { formatListingDate } from './myListings'

const TIME_ZONE = 'Europe/Belgrade'

// The backend's MAX_PERIOD.
export const MAX_PERIOD = { MONTHS: 120, DAYS: 3650 }
export const QUICK_PERIODS = { MONTHS: [1, 2, 3, 6, 12], DAYS: [7, 15, 30, 60, 90] }
export const FEATURED_DAYS = [7, 15, 30]

/** Noon UTC on the Belgrade calendar day the period ends on, safe to format in Belgrade time. */
export function periodEndDay(from, amount, unit) {
  const [year, month, day] = new Date(from).toLocaleDateString('en-CA', { timeZone: TIME_ZONE }).split('-').map(Number)
  if (unit === 'DAYS') return new Date(Date.UTC(year, month - 1, day + amount, 12))
  // A month later is the same day of the month, or that month's last day (31. 1. + 1 month = 28. 2.).
  const lastDay = new Date(Date.UTC(year, month - 1 + amount + 1, 0)).getUTCDate()
  return new Date(Date.UTC(year, month - 1 + amount, Math.min(day, lastDay), 12))
}

/** "22. 11. 2026." for a period of `amount` months or days counted from `from`. */
export function formatPeriodEnd(from, amount, unit) {
  if (!Number.isInteger(amount) || amount < 1) return ''
  return formatListingDate(periodEndDay(from, amount, unit))
}

/** Whether a typed amount is one the server takes. */
export function isValidPeriod(amount, unit) {
  return Number.isInteger(amount) && amount >= 1 && amount <= MAX_PERIOD[unit]
}
