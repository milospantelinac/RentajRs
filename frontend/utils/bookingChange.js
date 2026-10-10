// T136: a guest's request to move a booking to another term, as the guest's
// page, the owner's card and the change screen write it. The booking's
// `change` comes from GET /bookings/:id (pending, last, canRequest,
// deadlinePassed, deadlineHours); money is in RSD.
import { formatBookingDate, formatBookingDateTime, formatBookingTerm, formatRsd, formatUnits } from './bookingRequests'

const MONTH_UNITS = ['MONTH', 'YEAR']

// Whole months between two firsts of a month, for a monthly term's length.
function monthsBetween(startsAt, endsAt) {
  const from = new Date(startsAt)
  const to = new Date(endsAt)
  return Math.max(1, (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth()))
}

/** "10. - 13. 11. 2026. · 3 noći", "15. 10. 2026. · 13:00 - 16:00": a term of the booking's own kind. */
export function formatChangeTerm(t, booking, startsAt, endsAt) {
  const unitCount = MONTH_UNITS.includes(booking.priceUnit) ? monthsBetween(startsAt, endsAt) : booking.unitCount
  const term = formatBookingTerm(t, { ...booking, startsAt, endsAt, unitCount })
  return [term.date, term.detail].filter(Boolean).join(' · ')
}

/**
 * Whether the booking's advance stays as it is through a change: a transfer
 * asked for or paid does; cash is paid on arrival, and a request still
 * waiting for the owner takes the new term's advance (user decision).
 */
export function keepsAdvance(booking) {
  return booking.status !== 'REQUESTED' && booking.paymentMethod !== 'CASH'
}

/** The new price, and what it means for the money: the advance stays, the difference is the two sides' to settle. */
export function formatChangePrice(t, change, booking) {
  const value = formatRsd(change.newTotalAmount)
  if (change.newTotalAmount === change.oldTotalAmount) return { value, hint: t('bookingChange.priceSame') }
  return {
    value,
    hint: t(keepsAdvance(booking) ? 'bookingChange.priceWasAdvanceKept' : 'bookingChange.priceWas', {
      price: formatRsd(change.oldTotalAmount),
      advance: formatRsd(booking.amountDue),
    }),
  }
}

/** "Izmena termina se traži najkasnije 48 sati pre početka. ..." */
export function formatChangeDeadline(t, change) {
  return t('bookingChange.deadlinePassed', { hours: formatUnits(t, {}, 'HOUR', change.deadlineHours) })
}

/** The rows of a change waiting for the owner: the term now, the one asked for, the new price. */
export function buildChangeRows(t, booking, change) {
  const price = formatChangePrice(t, change, booking)
  return [
    { key: 'old', label: t('bookingChange.currentTerm'), value: formatChangeTerm(t, booking, change.oldStartsAt, change.oldEndsAt) },
    { key: 'new', label: t('bookingChange.newTerm'), value: formatChangeTerm(t, booking, change.newStartsAt, change.newEndsAt) },
    { key: 'price', label: t('bookingChange.newPrice'), value: price.value, hint: price.hint, wide: true },
  ]
}

/** What the guest's page says about another term: the request waiting, the last answer, or why none can be asked for. */
export function buildGuestChangeView(t, booking) {
  const change = booking.change
  if (!change) return { pending: null, note: '', hint: '' }
  if (change.pending) {
    return {
      pending: {
        rows: buildChangeRows(t, booking, change.pending),
        sent: t('bookingChange.pendingSent', { date: formatBookingDateTime(change.pending.createdAt) }),
        message: change.pending.guestMessage,
      },
      note: '',
      hint: '',
    }
  }
  let note = ''
  const last = change.last
  if (last?.status === 'REJECTED') {
    // The old term stands; the guest may still give the booking up (card T136, point 4).
    note = [
      t('bookingChange.lastRejected'),
      t(booking.status === 'REQUESTED' ? 'bookingChange.rejectedWithdraw' : 'bookingChange.rejectedCancel'),
      last.ownerReason ? t('bookingChange.ownerWrote', { reason: last.ownerReason }) : '',
    ]
      .filter(Boolean)
      .join(' ')
  } else if (last?.status === 'EXPIRED') {
    note = t('bookingChange.lastExpired')
  } else if (last?.status === 'APPROVED') {
    note = t('bookingChange.lastApproved', { date: formatBookingDate(last.decidedAt || last.createdAt) })
  }
  return {
    pending: null,
    note,
    // Past the deadline the guest agrees another term with the owner (card T136, point 5).
    hint: change.deadlinePassed ? formatChangeDeadline(t, change) : '',
  }
}
