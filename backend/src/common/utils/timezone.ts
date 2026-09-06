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
