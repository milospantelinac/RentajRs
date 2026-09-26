import { BookingModel, ListingStatus, PriceUnit } from '@prisma/client';

/**
 * Dizajn 33: whether an owner can connect other calendars to a listing, and
 * if not, why. One rule for the iCal page, the Moji oglasi menu and the API:
 * iCal only fits stays booked by the night or the day (R67, Dodavanje Oglasa
 * spec §3), only once the listing is published, and only on a package that
 * includes it (Ch.11.2: STANDARD and PRO, not BASIC).
 */
export type IcalAvailability = 'AVAILABLE' | 'NOT_STAY' | 'NOT_PUBLISHED' | 'NO_ICAL_PACKAGE';

export function getIcalAvailability(
  listing: { status: ListingStatus; bookingModel: BookingModel; priceUnit: PriceUnit },
  packageHasIcal: boolean,
): IcalAvailability {
  if (listing.bookingModel !== 'PER_STAY' || listing.priceUnit === 'MONTH') return 'NOT_STAY';
  if (listing.status !== 'ACTIVE') return 'NOT_PUBLISHED';
  return packageHasIcal ? 'AVAILABLE' : 'NO_ICAL_PACKAGE';
}

/** Failed hourly syncs in a row before the owner is told (availability.ical_sync_failed). */
export const ICAL_FAILURE_ALERT_THRESHOLD = 3;
