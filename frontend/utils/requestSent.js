// Dizajn 41: what the guest reads right after sending a request. 391:496
// draws a cash request, 391:589 a transfer the owner approves first and
// 990:2248 a playroom slot paid in cash. A transfer the listing takes without
// approval waits for the payment at once and shows the QR code as well (no
// frame; the ticket's QR block, user decision). Instants are read in
// Belgrade time through bookingRequests.js.
import { belgradeDayKey, formatTermValue, isoWeekdayOfKey } from './bookingRequestForm'
import { formatBookingDate, formatBookingListing, formatBookingTime, formatRsd, formatUnits } from './bookingRequests'
import { formatUpcomingTimes } from './upcomingBooking'

// R59: the hours to pay when the listing sets none (BookingsService).
const DEFAULT_PAYMENT_DEADLINE_HOURS = 48

// Which confirmation a booking gets: a request still waiting for the owner,
// paid in cash or by transfer, or one waiting for the guest's payment. Null
// once it moved on (answered, withdrawn, expired) or while the guest has a
// payment reported; its own page tells those apart.
export function getRequestSentVariant(booking) {
  if (booking?.status === 'REQUESTED') return booking.paymentMethod === 'CASH' ? 'cash' : 'transfer'
  if (booking?.status === 'AWAITING_PAYMENT' && !booking.paymentDisputed) return 'payment'
  return null
}

// 391:549 "12. - 13. 9. 2026." for whole days (months as the request page
// names them), 990:2301 "sub, 12. sep 2026. · 11:00 - 12:30" for a slot or hours.
export function formatSentTerm(t, booking) {
  const times = formatUpcomingTimes(booking)
  const startKey = belgradeDayKey(booking.startsAt)
  if (!times) {
    if (booking.priceUnit === 'MONTH') {
      return formatTermValue(t, 'months', { monthStart: startKey.slice(0, 7), monthCount: booking.unitCount || 1 })
    }
    return formatTermValue(t, 'stay', { startsAt: startKey, endsAt: belgradeDayKey(booking.endsAt) })
  }
  const [year, month, day] = startKey.split('-').map(Number)
  return t('requestSent.termSlot', {
    weekday: t('bookingForm.weekdaysShort').split(',')[isoWeekdayOfKey(startKey) - 1],
    day,
    month: t('requestSent.monthsShort').split(',')[month - 1],
    year,
    times,
  })
}

// 391:541: the term, the guests, how the guest pays, the advance a transfer
// asks for (391:682) and the total.
function buildRows(t, booking) {
  const transfer = booking.paymentMethod !== 'CASH'
  const rows = [{ key: 'term', label: t('bookingForm.term'), value: formatSentTerm(t, booking) }]
  if (booking.guestCount) {
    rows.push({
      key: 'guests',
      label: booking.guestUnit === 'children' ? t('bookingForm.childrenCount') : t('booking.guestCount'),
      value: String(booking.guestCount),
    })
  }
  rows.push({
    key: 'payment',
    label: t('booking.paymentMethodLabel'),
    value: transfer ? t('guestBooking.paymentTransfer') : t('booking.paymentMethodCash'),
  })
  if (hasAdvance(booking)) {
    rows.push({
      key: 'advance',
      label: t('requestSent.advance'),
      value: t('requestSent.advanceValue', {
        amount: formatRsd(booking.amountDue),
        percent: Math.round((booking.amountDue / booking.totalAmount) * 100),
      }),
    })
  }
  rows.push({ key: 'total', label: t('booking.totalAmount'), value: formatRsd(booking.totalAmount) })
  return rows
}

// A transfer pays part of the total up front; cash pays nothing ahead.
function hasAdvance(booking) {
  return booking.paymentMethod !== 'CASH' && booking.amountDue > 0 && booking.amountDue < booking.totalAmount
}

// 391:561 and 391:654: the three steps after the request, as this booking runs them.
function buildSteps(t, booking, variant) {
  const step = (title, text, params) => ({ title: t(`requestSent.steps.${title}`), text: t(`requestSent.steps.${text}`, params) })
  const answer = step('answerTitle', 'answerText')
  const confirmed = step('confirmedTitle', 'confirmedText')
  const part = hasAdvance(booking) ? 'Advance' : 'Full'
  if (variant === 'cash') return [answer, confirmed, step('cashTitle', 'cashText')]
  if (variant === 'transfer') {
    const hours = formatUnits(t, {}, 'HOUR', booking.listing?.paymentDeadlineHours || DEFAULT_PAYMENT_DEADLINE_HOURS)
    return [answer, step(`qr${part}Title`, 'qrText', { hours }), step('ownerConfirmsTitle', 'ownerConfirmsText')]
  }
  // The deadline itself stands in the QR block.
  return [step(`pay${part}Title`, 'payText'), step('ownerConfirmsTitle', 'ownerConfirmsPaymentText'), confirmed]
}

// "23. 9. 2026. u 14:30"
function formatDeadline(t, booking) {
  if (!booking.paymentDeadline) return ''
  return t('requestSent.deadlineValue', {
    date: formatBookingDate(booking.paymentDeadline),
    time: formatBookingTime(booking.paymentDeadline),
  })
}

// 391:585, 391:587: follow the request, or go back to the listing while it is
// live (search otherwise, the ticket's second button).
function getBackLink(t, listing) {
  if (listing?.status === 'ACTIVE' && listing.slug) return { to: `/oglasi/${listing.slug}`, label: t('requestSent.backToListing') }
  return { to: '/pretraga', label: t('requestSent.backToSearch') }
}

export function buildRequestSentView(t, booking) {
  const variant = getRequestSentVariant(booking)
  if (!variant) return null
  const listing = booking.listing || {}
  const payment = variant === 'payment'
  return {
    variant,
    subtitle: t(payment ? 'requestSent.subtitlePayment' : 'requestSent.subtitle'),
    listing: formatBookingListing(listing),
    // 391:546 "Prostori za proslave · Beograd"
    meta: [listing.categoryName, listing.city].filter(Boolean).join(' · '),
    photo: listing.coverPhotoUrl || '',
    rows: buildRows(t, booking),
    // The QR block: what to pay and by when (T47's QR, T91's amount).
    pay: payment ? { amount: formatRsd(booking.amountDue), deadline: formatDeadline(t, booking) } : null,
    // 391:559: the frame's note while the owner decides, the deadline's while the guest pays.
    note: t(payment ? 'requestSent.notePayment' : 'guestBooking.note.requested'),
    steps: buildSteps(t, booking, variant),
    tip: t(payment ? 'bookingForm.tips.flowInstant' : 'bookingForm.tips.flow'),
    track: `/rezervacije/${booking.id}`,
    back: getBackLink(t, listing),
  }
}
