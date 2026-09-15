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

// Working hours are booked by the hour, also when the price is per guest.
export function getDurationUnit(listing) {
  return listing?.bookingModel === 'PER_SLOT' && !isDefinedSlotsListing(listing) ? 'HOUR' : listing?.priceUnit
}

// The notice before the start and the horizon, both checked against the start instant.
export function isStartWithinRules(listing, startsAt, now = Date.now()) {
  const start = new Date(startsAt).getTime()
  if (listing?.earliestBookingHours && start < now + listing.earliestBookingHours * 3600_000) return false
  if (listing?.maxAdvanceBookingDays && start > now + listing.maxAdvanceBookingDays * 86_400_000) return false
  return true
}

// Whole hours from the minimum to the maximum, or up to 12 when there's no maximum.
export function getHourlyDurationOptions(listing) {
  const min = listing?.minDuration || 1
  const max = Math.max(min, listing?.maxDuration || 12)
  return Array.from({ length: max - min + 1 }, (_, index) => min + index)
}
