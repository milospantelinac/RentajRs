// Rentaj is a single-timezone (Serbia) product: WorkingHours, HourlyPriceRange
// and SlotPriceOverride store literal Belgrade wall-clock strings/dates with
// no timezone info of their own (Dodavanje Oglasa spec §2/§3 — the owner
// types "17:00" meaning 5pm Belgrade time, nothing more). A Booking's
// startsAt/endsAt, by contrast, is a genuine timezone-aware instant — reading
// its clock time back to compare against those stored strings requires
// converting through the real IANA zone, not raw UTC getters (T72: raw
// getUTCHours() read a booking made at "17:00" Belgrade time as 15:00/16:00
// depending on DST, so it silently missed the owner's configured hourly
// price window and fell back to the base price).
export const BELGRADE_TZ = 'Europe/Belgrade';

/** HH:MM (24h) for `date`'s clock time in Belgrade — matches how WorkingHours/HourlyPriceRange store it. */
export function toBelgradeHHMM(date: Date): string {
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: BELGRADE_TZ });
}

/** Midnight-UTC Date for `date`'s calendar day in Belgrade — matches how date-only columns (e.g. SlotPriceOverride.date) are stored. */
export function toBelgradeDateOnly(date: Date): Date {
  const [year, month, day] = date.toLocaleDateString('en-CA', { timeZone: BELGRADE_TZ }).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/** ISO day of week (1-7, Monday=1) for `date`'s calendar day in Belgrade — matches WorkingHours/HourlyPriceRange.dayOfWeek. */
export function toBelgradeISODayOfWeek(date: Date): number {
  return ((toBelgradeDateOnly(date).getUTCDay() + 6) % 7) + 1;
}

/**
 * The instant Belgrade's calendar day year-month-day begins. Belgrade runs
 * on UTC+1 in winter and UTC+2 in summer and never changes its clock at
 * midnight, so exactly one of the two offsets reads 00:00 there.
 */
export function belgradeDayStart(year: number, month: number, day: number): Date {
  const utcMidnight = Date.UTC(year, month - 1, day);
  for (const offsetHours of [1, 2]) {
    const candidate = new Date(utcMidnight - offsetHours * 3_600_000);
    if (toBelgradeHHMM(candidate) === '00:00') return candidate;
  }
  return new Date(utcMidnight - 3_600_000);
}

/**
 * T127: the instant a Belgrade wall-clock time ("16:00", as WorkingHours keeps
 * it) names on a Belgrade calendar day, `day` being that day's UTC midnight
 * as toBelgradeDateOnly returns it. The frontend's belgradeInstant reads the
 * same time the same way.
 */
export function belgradeWallClock(day: Date, hhmm: string): Date {
  const [hours, minutes] = hhmm.split(':').map(Number);
  const wall = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hours, minutes);
  for (const offsetHours of [2, 1]) {
    const candidate = new Date(wall - offsetHours * 3_600_000);
    if (toBelgradeHHMM(candidate) === hhmm && toBelgradeDateOnly(candidate).getTime() === day.getTime()) return candidate;
  }
  return new Date(wall - 3_600_000);
}

/**
 * The last instant of the Belgrade calendar day `days` days after the one
 * `from` falls on, so a window "until 29. 9." holds for all of that day.
 */
export function endOfBelgradeDayAfter(from: Date, days: number): Date {
  const [year, month, day] = from.toLocaleDateString('en-CA', { timeZone: BELGRADE_TZ }).split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days + 1));
  return new Date(belgradeDayStart(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate()).getTime() - 1);
}
