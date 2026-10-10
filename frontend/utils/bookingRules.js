// Dizajn 23: the booking rules the way assertTermRules (bookings.service.ts)
// applies them, shared by the wizard's rules step, the listing page, its booking
// card and the request page, so none of them offers a term the server refuses.

const GUEST_CAPACITY_KEYS = ['kapacitet_ljudi', 'kapacitet_dece']

// "Kapacitet ljudi" or "Kapacitet dece" from wizard step Detalji.
export function isGuestCapacityKey(key) {
  return GUEST_CAPACITY_KEYS.includes(key)
}

// The lower of "Maks. broj gostiju" and the capacity, or null when neither is set.
export function getGuestCap(listing) {
  const values = [listing?.maxGuests]
  for (const attribute of listing?.attributes || []) {
    if (isGuestCapacityKey(attribute.key)) values.push(attribute.value?.valueNumber)
  }
  const caps = values
    .filter((value) => value !== null && value !== undefined && value !== '')
    .map(Number)
    .filter((value) => value > 0)
  return caps.length ? Math.min(...caps) : null
}

// A defined slot has its own length, so the duration and gap rules skip it.
export function isDefinedSlotsListing(listing) {
  return listing?.bookingModel === 'PER_SLOT' && listing?.slotSubmode === 'DEFINED_SLOTS'
}

// T140: the weekly hours only describe a listing booked by working hours.
export function isWorkingHoursListing(listing) {
  return listing?.bookingModel === 'PER_SLOT' && listing?.slotSubmode === 'WORKING_HOURS'
}

// T117: a day booking (Po danu) has no gap after it, the pickup and return
// times do that job (Tamara, 2026-10-09).
export function isDayStay(listing) {
  return listing?.bookingModel === 'PER_STAY' && listing?.priceUnit === 'DAY'
}

// T117: vehicles and machines are picked up and returned; the wizard asks for
// both times and the listing names the two days that way.
const PICKUP_RETURN_CATEGORY_SLUGS = ['putnicka-vozila', 'dostavna-vozila', 'gradjevinske-masine']

export function usesPickupAndReturn(listing) {
  return PICKUP_RETURN_CATEGORY_SLUGS.includes(listing?.category?.slug)
}

// T36/T37: rented as a whole, so no step asks how many guests come (T125).
const NO_GUEST_COUNT_CATEGORY_SLUGS = ['putnicka-vozila', 'dostavna-vozila', 'gradjevinske-masine', 'magacini-i-skladista']

export function asksGuestCount(listing) {
  return !NO_GUEST_COUNT_CATEGORY_SLUGS.includes(listing?.category?.slug)
}

// T125: the listing's booking card asks for guests only where they shape the
// stay or the price: a stay (Nekretnine, every model) and a price per guest.
// Everywhere else the request page asks for them.
export function hasGuestPill(listing) {
  return asksGuestCount(listing) && (listing?.guestUnit === 'people' || listing?.priceUnit === 'GUEST')
}

// Working hours are booked by the hour, also when the price is per guest.
export function getDurationUnit(listing) {
  return listing?.bookingModel === 'PER_SLOT' && !isDefinedSlotsListing(listing) ? 'HOUR' : listing?.priceUnit
}

// T118 (Tamara, 2026-10-10): a month always starts on the 1st, so "Najranije se
// može rezervisati" doesn't apply to it, and its "Najkasnije se može rezervisati"
// is the owner's time to get ready, set and shown in days (kept in hours).
export function isMonthlyListing(listing) {
  return listing?.priceUnit === 'MONTH'
}

// The horizon in days that holds for the listing, or null.
export function getBookingHorizonDays(listing) {
  return isMonthlyListing(listing) ? null : listing?.maxAdvanceBookingDays || null
}

// A notice kept in hours, in whole days (an odd hour counts as a day).
export function noticeHoursToDays(hours) {
  return Math.ceil(hours / 24)
}

// The notice before the start and the horizon, both checked against the start instant.
export function isStartWithinRules(listing, startsAt, now = Date.now()) {
  const start = new Date(startsAt).getTime()
  const horizonDays = getBookingHorizonDays(listing)
  if (listing?.earliestBookingHours && start < now + listing.earliestBookingHours * 3600_000) return false
  if (horizonDays && start > now + horizonDays * 86_400_000) return false
  return true
}

// Whole hours from the minimum to the maximum, or up to 12 when there's no maximum.
export function getHourlyDurationOptions(listing) {
  const min = listing?.minDuration || 1
  const max = Math.max(min, listing?.maxDuration || 12)
  return Array.from({ length: max - min + 1 }, (_, index) => min + index)
}
