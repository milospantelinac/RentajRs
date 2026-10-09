import { BookingModel, PriceUnit, Prisma, SlotSubmode } from '@prisma/client';

/** The listing fields that name its booking model. */
type BookingSetup = { bookingModel: BookingModel; slotSubmode: SlotSubmode | null };

/**
 * T126: "Po satu" (a stay billed by the hour) is gone, so a stay is priced by
 * the night, the day or the month. Hourly pricing is "Po radnom vremenu".
 */
export const STAY_PRICE_UNITS: PriceUnit[] = ['NIGHT', 'DAY', 'MONTH'];

/**
 * T138: a party hall is booked by its own defined slots only, priced per slot
 * or per guest (Tamara, 2026-10-09). Konferencijske sale wait for T129.
 */
export const DEFINED_SLOTS_ONLY_CATEGORY_SLUGS = ['sale-za-proslave'];

export function isDefinedSlotsSetup(listing: BookingSetup): boolean {
  return listing.bookingModel === 'PER_SLOT' && listing.slotSubmode === 'DEFINED_SLOTS';
}

export function isWorkingHoursSetup(listing: BookingSetup): boolean {
  return listing.bookingModel === 'PER_SLOT' && listing.slotSubmode === 'WORKING_HOURS';
}

/**
 * T140: a date's own price means a night or a day, or a whole month when it
 * sits on the first. Switching between the two would read every one of them
 * the other way, so such a switch drops them.
 */
export function changesDatePriceMeaning(from: PriceUnit, to: PriceUnit): boolean {
  return (from === 'MONTH') !== (to === 'MONTH');
}

/**
 * T121: a listing on defined slots shows "Od X RSD", the lowest price among
 * its slots still ahead; 0 when it has none, which the card and the booking
 * card read as "Trenutno nema termina". Kept in Listing.price so search
 * sorts, filters and maps it like any other listing's price.
 */
export async function lowestUpcomingSlotPrice(
  prisma: Pick<Prisma.TransactionClient, 'definedSlot'>,
  listingId: string,
  now = new Date(),
): Promise<bigint> {
  const { _min } = await prisma.definedSlot.aggregate({
    where: { listingId, startsAt: { gt: now }, price: { not: null } },
    _min: { price: true },
  });
  return _min.price ?? 0n;
}
