import { BookingModel, PriceUnit, Prisma, SlotSubmode } from '@prisma/client';

/** The listing fields that name its booking model. */
type BookingSetup = { bookingModel: BookingModel; slotSubmode: SlotSubmode | null };

/**
 * T126: "Po satu" (a stay billed by the hour) is gone, so a stay is priced by
 * the night, the day or the month. Hourly pricing is "Po radnom vremenu".
 */
export const STAY_PRICE_UNITS: PriceUnit[] = ['NIGHT', 'DAY', 'MONTH'];

/**
 * T129 parts 3 and 4: the booking models the admin panel names, describes,
 * switches on and off and assigns to categories (BookingModelSetting,
 * CategoryBookingModel). What each one does stays here, in code: the listing
 * fields it sets, which the calendars, the slot templates and the booking
 * widgets read as before. Before T129 the same rules were spread over the
 * category's defaultBookingModel and slug lists (T111, T126, T138).
 */
export const BOOKING_MODEL_KEYS = [
  'DEFINED_SLOTS',
  'WORKING_HOURS',
  'WORKING_HOURS_GUEST',
  'DAY',
  'NIGHT',
  'MONTH',
  'CONTACT',
] as const;
export type BookingModelKey = (typeof BOOKING_MODEL_KEYS)[number];

/** The listing fields each model sets, and the price units it can carry (the admin may narrow them). */
export const BOOKING_MODEL_SETUPS: Record<
  BookingModelKey,
  { bookingModel: BookingModel; slotSubmode: SlotSubmode | null; priceUnits: PriceUnit[] }
> = {
  DEFINED_SLOTS: { bookingModel: 'PER_SLOT', slotSubmode: 'DEFINED_SLOTS', priceUnits: ['SLOT', 'GUEST'] },
  WORKING_HOURS: { bookingModel: 'PER_SLOT', slotSubmode: 'WORKING_HOURS', priceUnits: ['HOUR'] },
  WORKING_HOURS_GUEST: { bookingModel: 'PER_SLOT', slotSubmode: 'WORKING_HOURS', priceUnits: ['GUEST'] },
  DAY: { bookingModel: 'PER_STAY', slotSubmode: null, priceUnits: ['DAY'] },
  NIGHT: { bookingModel: 'PER_STAY', slotSubmode: null, priceUnits: ['NIGHT'] },
  MONTH: { bookingModel: 'PER_STAY', slotSubmode: null, priceUnits: ['MONTH'] },
  // Samo kontakt: no booking at all; the unit only labels the price on the card.
  CONTACT: { bookingModel: 'NO_BOOKING', slotSubmode: null, priceUnits: [] },
};

/** The model a listing is booked by, or null for a combination no model stands for (a stay by the hour, T126). */
export function bookingModelKeyOf(listing: {
  bookingModel: BookingModel;
  slotSubmode: SlotSubmode | null;
  priceUnit: PriceUnit;
}): BookingModelKey | null {
  if (listing.bookingModel === 'NO_BOOKING') return 'CONTACT';
  if (listing.bookingModel === 'PER_SLOT') {
    if (listing.slotSubmode === 'DEFINED_SLOTS') return 'DEFINED_SLOTS';
    if (listing.slotSubmode === 'WORKING_HOURS') return listing.priceUnit === 'GUEST' ? 'WORKING_HOURS_GUEST' : 'WORKING_HOURS';
    return null;
  }
  return listing.priceUnit === 'DAY' || listing.priceUnit === 'NIGHT' || listing.priceUnit === 'MONTH' ? listing.priceUnit : null;
}

/**
 * The models a category offered before they were data, read from its old
 * fields, for the seed and for a category created with those fields. Party
 * halls had defined slots only (T138), Konferencijske sale working hours only
 * (their defined slots failed on save, Tamara 2026-10-10), every category
 * "Samo kontakt". Migration 20261010190000_booking_models does the same in SQL.
 */
export function modelKeysForCategory(category: {
  slug: string;
  defaultBookingModel: BookingModel;
  allowedPriceUnits: PriceUnit[];
}): BookingModelKey[] {
  const keys: BookingModelKey[] = [];
  const units = category.allowedPriceUnits;
  if (category.defaultBookingModel === 'PER_STAY') {
    for (const key of ['DAY', 'NIGHT', 'MONTH'] as const) if (units.includes(key)) keys.push(key);
  } else if (category.defaultBookingModel === 'PER_SLOT') {
    if (units.includes('SLOT') && category.slug !== 'konferencijske-sale') keys.push('DEFINED_SLOTS');
    if (units.includes('HOUR') && category.slug !== 'sale-za-proslave') keys.push('WORKING_HOURS');
  }
  keys.push('CONTACT');
  return keys;
}

/**
 * Category.defaultBookingModel, which a new listing starts on: the model of
 * the category's default unit, else its first online model, else no booking.
 */
export function defaultBookingModelFor(modelKeys: string[], defaultPriceUnit: PriceUnit): BookingModel {
  const online = modelKeys.filter((key): key is BookingModelKey => key !== 'CONTACT' && key in BOOKING_MODEL_SETUPS);
  const byUnit = online.find((key) => BOOKING_MODEL_SETUPS[key].priceUnits.includes(defaultPriceUnit));
  const key = byUnit ?? online[0];
  return key ? BOOKING_MODEL_SETUPS[key].bookingModel : 'NO_BOOKING';
}

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
