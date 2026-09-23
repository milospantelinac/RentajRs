// Dizajn 34: what "Zahtevi za rezervaciju" (378:505) and the card of one
// request (359:499, 384:589, 565:750) say about a booking, with dates read in
// Belgrade time so the server render and the browser agree.
import { srPluralCategory } from './pluralize'
import { formatUpcomingTimes } from './upcomingBooking'

const TIME_ZONE = 'Europe/Belgrade'
const DAY_MS = 86_400_000
const MINUTE_MS = 60_000

// The status select of 378:501, in the order a booking moves through them.
export const BOOKING_STATUSES = ['REQUESTED', 'AWAITING_PAYMENT', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'REJECTED', 'EXPIRED', 'NO_SHOW']

const STATUS_KEYS = {
  REQUESTED: 'Requested',
  AWAITING_PAYMENT: 'AwaitingPayment',
  CONFIRMED: 'Confirmed',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  REJECTED: 'Rejected',
  EXPIRED: 'Expired',
  NO_SHOW: 'NoShow',
}

// The price rules a booking keeps with its total (BookingsService.resolvePriceLines).
const PRICE_KIND_KEYS = { WEEKEND: 'weekend', RANGE: 'range', SPECIAL: 'special' }

// Units a duration or a price line can count in; GUEST counts people instead.
const COUNTED_UNITS = ['HOUR', 'NIGHT', 'DAY', 'MONTH', 'YEAR', 'SLOT']

// A booking by these starts and ends on whole days, with no time worth showing (T82).
const DATE_ONLY_UNITS = ['NIGHT', 'DAY', 'MONTH', 'YEAR']

const WEEKDAY_INDEX = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }

const formatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

// en-GB pads the day and month; the frames write "12. 9. 2026.".
function getParts(value) {
  const parts = Object.fromEntries(formatter.formatToParts(new Date(value)).map((part) => [part.type, part.value]))
  return { ...parts, day: String(Number(parts.day)), month: String(Number(parts.month)) }
}

export function getBookingStatusLabel(t, status) {
  return t(`booking.status${STATUS_KEYS[status] || STATUS_KEYS.REQUESTED}`)
}

export function getBookingStatus(value) {
  return BOOKING_STATUSES.includes(value) ? value : ''
}

// "12. 9. 2026."
export function formatBookingDate(value) {
  const { day, month, year } = getParts(value)
  return `${day}. ${month}. ${year}.`
}

// "16:00"
export function formatBookingTime(value) {
  const { hour, minute } = getParts(value)
  return `${hour}:${minute}`
}

// "12. 9. 2026. 16:00"
export function formatBookingDateTime(value) {
  return `${formatBookingDate(value)} ${formatBookingTime(value)}`
}

// The day a booking starts or ends, with its hour unless it books whole days.
export function formatBookingMoment(booking, value) {
  return DATE_ONLY_UNITS.includes(booking.priceUnit) ? formatBookingDate(value) : formatBookingDateTime(value)
}

// "subota", from the locale's Monday-first list.
export function formatBookingWeekday(t, value) {
  return t('bookingRequests.weekdays').split(',')[WEEKDAY_INDEX[getParts(value).weekday]]
}

// "19. 9. - 22. 9. 2026." (380:671), with the year once when both days share it.
export function formatBookingDays(startsAt, endsAt) {
  const from = getParts(startsAt)
  const to = getParts(endsAt)
  const start = from.year === to.year ? `${from.day}. ${from.month}.` : formatBookingDate(startsAt)
  return `${start} - ${formatBookingDate(endsAt)}`
}

export function formatRsd(value) {
  return `${new Intl.NumberFormat('sr-RS').format(value || 0)} RSD`
}

// "Igraonica Balončići - Vračar", the city when the listing has no area.
export function formatBookingListing(listing) {
  if (!listing) return ''
  return listing.place ? `${listing.title} - ${listing.place}` : listing.title
}

// "18 dece", "2 osobe" (a stay, Dizajn 39), "30 gostiju"
const GUEST_UNITS = ['children', 'people', 'guests']

export function formatBookingGuests(t, guestUnit, count) {
  const unit = GUEST_UNITS.includes(guestUnit) ? guestUnit : 'guests'
  return t(`dashboard.upcomingGuests.${unit}${srPluralCategory(count)}`, { count })
}

// "2 sata", "3 noći", "1 termin"; a booking priced per guest counts its guests.
export function formatUnits(t, booking, unit, count) {
  if (unit === 'GUEST') return formatBookingGuests(t, booking.guestUnit, count)
  const key = COUNTED_UNITS.includes(unit) ? unit : 'SLOT'
  return t(`bookingRequests.units.${key}${srPluralCategory(count)}`, { count })
}

// How long a booking runs: its months or years as booked, its nights or days
// between the two dates, otherwise its hours ("1 h 30 min" for a defined slot
// that doesn't last whole hours).
export function formatBookingDuration(t, booking) {
  if (booking.priceUnit === 'MONTH' || booking.priceUnit === 'YEAR') return formatUnits(t, booking, booking.priceUnit, booking.unitCount)
  const length = new Date(booking.endsAt) - new Date(booking.startsAt)
  if (booking.priceUnit === 'NIGHT' || booking.priceUnit === 'DAY') {
    return formatUnits(t, booking, booking.priceUnit, Math.max(1, Math.round(length / DAY_MS)))
  }
  const minutes = Math.max(0, Math.round(length / MINUTE_MS))
  if (minutes % 60 === 0) return formatUnits(t, booking, 'HOUR', minutes / 60)
  const hours = Math.floor(minutes / 60)
  return hours
    ? t('bookingRequests.durationHoursMinutes', { hours, minutes: minutes % 60 })
    : t('bookingRequests.durationMinutes', { minutes })
}

// 378:515: "12. 9. 2026." over "16:00 - 18:00". A booking by whole days, or
// one that runs a day or longer, shows its days over its length (380:671).
export function formatBookingTerm(t, booking) {
  const times = formatUpcomingTimes(booking)
  if (times) return { date: formatBookingDate(booking.startsAt), detail: times }
  return { date: formatBookingDays(booking.startsAt, booking.endsAt), detail: formatBookingDuration(t, booking) }
}

// 359:526: "2 sata × 4.200 RSD (vikend cena)", one part per price the booking
// kept, then what fees and extra services added. A booking made before the
// prices were kept names its units alone.
export function formatBookingPriceBreakdown(t, booking) {
  const breakdown = booking.priceBreakdown
  if (!breakdown?.lines?.length) return formatUnits(t, booking, booking.priceUnit, booking.unitCount)
  const parts = breakdown.lines.map((line) => formatPriceLine(t, booking, line))
  if (breakdown.extras) parts.push(t('bookingRequests.priceExtras', { amount: formatRsd(breakdown.extras) }))
  return parts.join(' + ')
}

// One of those parts, "2 dana × 9.000 RSD" on the request page too (369:424).
export function formatPriceLine(t, booking, line) {
  const text = `${formatUnits(t, booking, booking.priceUnit, line.count)} × ${formatRsd(line.price)}`
  const kind = PRICE_KIND_KEYS[line.kind]
  return kind ? `${text} ${t(`bookingRequests.priceKind.${kind}`)}` : text
}

// 378:511: the listing, who booked it and for how many, the day and hours,
// the total and the state of one booking. The guest's row (380:776) names
// the owner instead.
export function buildBookingRow(t, booking) {
  const term = formatBookingTerm(t, booking)
  const guests = booking.guestCount ? formatBookingGuests(t, booking.guestUnit, booking.guestCount) : ''
  return {
    id: booking.id,
    to: `/rezervacije/${booking.id}`,
    listing: formatBookingListing(booking.listing),
    meta: booking.ownerShortName
      ? t('bookingRequests.ownerMeta', { name: booking.ownerShortName })
      : [booking.guestShortName, guests].filter(Boolean).join(' · '),
    date: term.date,
    time: term.detail,
    amount: formatRsd(booking.totalAmount),
    status: booking.status,
    statusText: getBookingStatusLabel(t, booking.status),
  }
}

// The line under the card's title (359:503, 384:593): when the request came
// in while it is open, otherwise when it reached its state.
function getSubtitle(t, booking) {
  const { status } = booking
  if (status === 'REQUESTED' || status === 'AWAITING_PAYMENT') {
    return t('bookingRequests.subtitle.received', {
      date: formatBookingDate(booking.createdAt),
      time: formatBookingTime(booking.createdAt),
    })
  }
  const date = status === 'COMPLETED' ? booking.endsAt : booking.statusChangedAt || booking.createdAt
  return t(`bookingRequests.subtitle.${status}`, { date: formatBookingDate(date) })
}

// 359:518: the phone opens with a cash approval, or with the payment otherwise.
function getGuestHint(t, booking, guests) {
  if (booking.status === 'REQUESTED' && booking.paymentMethod === 'CASH') return t('bookingRequests.contactAfterApproval')
  if (booking.status === 'REQUESTED' || booking.status === 'AWAITING_PAYMENT') return t('bookingRequests.contactAfterPayment')
  return guests
}

function getPaymentFact(t, booking) {
  const cash = booking.paymentMethod === 'CASH'
  return {
    key: 'payment',
    label: t('booking.paymentMethodLabel'),
    value: cash ? t('booking.paymentMethodCash') : t('booking.paymentMethodOnline'),
    hint: booking.listing?.acceptsBothPaymentMethods ? t(cash ? 'bookingRequests.guestChoseCash' : 'bookingRequests.guestChoseTransfer') : '',
  }
}

// 384:628: what reached the owner. Cash is paid on arrival, outside Rentaj.
function getMoneyFact(t, booking) {
  if (booking.status === 'AWAITING_PAYMENT') {
    return {
      key: 'due',
      wide: true,
      label: t('booking.payAmount'),
      value: formatRsd(booking.amountDue),
      hint: booking.paymentDeadline
        ? t('bookingRequests.payBy', { date: formatBookingDate(booking.paymentDeadline), time: formatBookingTime(booking.paymentDeadline) })
        : '',
    }
  }
  if (!['CONFIRMED', 'COMPLETED', 'NO_SHOW'].includes(booking.status)) return null
  if (booking.paymentMethod === 'CASH') {
    return { key: 'paid', wide: true, label: t('booking.paidLabel'), value: formatRsd(0), hint: t('bookingRequests.paidInCash') }
  }
  if (!booking.paymentConfirmedAt) return null
  const rest = (booking.totalAmount || 0) - (booking.amountDue || 0)
  const date = formatBookingDate(booking.paymentConfirmedAt)
  return {
    key: 'paid',
    wide: true,
    label: t('booking.paidLabel'),
    value: formatRsd(booking.amountDue),
    hint: rest > 0 ? t('bookingRequests.paidAdvanceOn', { date, rest: formatRsd(rest) }) : t('bookingRequests.paidOn', { date }),
  }
}

// 565:796: who closed the request and when.
function getOutcomeFact(t, booking) {
  const at = booking.statusChangedAt ? formatBookingDateTime(booking.statusChangedAt) : ''
  const fact = (by, hint) => ({
    key: 'outcome',
    wide: true,
    label: getBookingStatusLabel(t, booking.status),
    value: [by, at].filter(Boolean).join(' · '),
    hint,
  })
  switch (booking.status) {
    case 'REJECTED':
      return fact(t('booking.rejectedByOwner'), t('bookingRequests.guestNotified'))
    case 'CANCELLED': {
      const by = booking.cancellation?.by
      if (by === 'GUEST') return fact(t('booking.cancelledByGuest'), t('bookingRequests.youWereNotified'))
      return fact(by === 'OWNER' ? t('booking.cancelledByOwner') : '', by === 'OWNER' ? t('bookingRequests.guestNotified') : '')
    }
    case 'EXPIRED': {
      // Dizajn 41: a request nobody answered expires too.
      const why = booking.expiredFrom === 'REQUESTED' ? 'bookingRequests.expiredUnanswered' : 'bookingRequests.expiredUnpaid'
      return fact(t(why), t('bookingRequests.termReleased'))
    }
    case 'NO_SHOW':
      return fact(t('bookingRequests.noShowMarked'), t(booking.noShowDisputed ? 'bookingRequests.noShowDisputed' : 'bookingRequests.noShowDisputable'))
    default:
      return null
  }
}

// What the card says below the facts about the state the request is in.
function getStateNote(t, booking) {
  switch (booking.status) {
    case 'REQUESTED':
      return { tone: 'warning', text: t('bookingRequests.noteRequested') }
    case 'AWAITING_PAYMENT':
      // T94: the guest reported the payment as sent; the booking waits past
      // its deadline while the admin has that report open.
      return {
        tone: 'warning',
        text: t(booking.paymentDisputed ? 'bookingRequests.notePaymentReported' : 'bookingRequests.noteAwaitingPayment'),
      }
    case 'REJECTED':
      return { tone: 'success', text: t('booking.successReject') }
    case 'CANCELLED':
      return booking.cancellation?.by === 'OWNER' ? { tone: 'success', text: t('booking.successCancelOwner') } : null
    case 'NO_SHOW':
      return { tone: 'success', text: t('booking.successNoShow') }
    default:
      return null
  }
}

// The owner's card for one booking (359:499 requested, 384:589 confirmed,
// 565:750 rejected); the states the frames don't draw follow the same parts.
export function buildRequestCard(t, booking, now = Date.now()) {
  const guests = booking.guestCount ? formatBookingGuests(t, booking.guestUnit, booking.guestCount) : ''
  const facts = [
    {
      key: 'checkIn',
      label: t('booking.checkIn'),
      value: formatBookingMoment(booking, booking.startsAt),
      hint: formatBookingWeekday(t, booking.startsAt),
    },
    {
      key: 'checkOut',
      label: t('booking.checkOut'),
      value: formatBookingMoment(booking, booking.endsAt),
      hint: formatBookingDuration(t, booking),
    },
    {
      key: 'guest',
      label: t('booking.guestNameLabel'),
      value: booking.guestShortName || '',
      hint: getGuestHint(t, booking, guests),
    },
  ]
  if (guests) {
    facts.push({
      key: 'guests',
      label: t('booking.guestCount'),
      value: guests,
      hint: booking.guestCapacity
        ? t('bookingRequests.capacity', { guests: formatBookingGuests(t, booking.guestUnit, booking.guestCapacity) })
        : '',
    })
  }
  facts.push(getPaymentFact(t, booking))
  if (booking.guestPhone) {
    facts.push({
      key: 'phone',
      label: t('booking.guestPhone'),
      value: booking.guestPhone,
      hint: t('bookingRequests.phoneUnlocked'),
      href: `tel:${booking.guestPhone.replace(/[^\d+]/g, '')}`,
    })
  }
  facts.push({
    key: 'total',
    wide: true,
    label: t('booking.totalAmount'),
    value: formatRsd(booking.totalAmount),
    hint: formatBookingPriceBreakdown(t, booking),
  })
  const money = getMoneyFact(t, booking)
  if (money) facts.push(money)
  if (booking.guestMessage) {
    facts.push({ key: 'message', wide: true, label: t('booking.guestMessage'), value: `„${booking.guestMessage}“`, hint: '' })
  }
  const outcome = getOutcomeFact(t, booking)
  if (outcome) facts.push(outcome)

  return {
    title: formatBookingListing(booking.listing),
    subtitle: getSubtitle(t, booking),
    status: booking.status,
    statusText: getBookingStatusLabel(t, booking.status),
    facts,
    note: getStateNote(t, booking),
    // The server refuses a no-show before the booking starts (T94).
    noShowAvailable: new Date(booking.startsAt).getTime() <= now,
  }
}
