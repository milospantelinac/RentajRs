// Dizajn 39: what the guest's page of one booking says. The frames draw a
// confirmed booking (528:514) and a completed one with the review form
// (568:514) and with the review posted (568:698); the other states use the
// same parts. Dates are read in Belgrade time through bookingRequests.js.
import {
  formatBookingDate,
  formatBookingGuests,
  formatBookingListing,
  formatBookingPriceBreakdown,
  formatBookingTime,
  formatBookingWeekday,
  formatRsd,
  getAdultsFact,
  getBookingStatusLabel,
} from './bookingRequests'

// A booking by these starts and ends on whole days, with no hour of its own.
const DATE_ONLY_UNITS = ['NIGHT', 'DAY', 'MONTH', 'YEAR']

const OPEN_STATUSES = ['REQUESTED', 'AWAITING_PAYMENT']

// 528:719, 568:611: when the booking reached its state.
function getSubtitle(t, booking) {
  const { status } = booking
  if (status === 'REQUESTED') {
    return t('guestBooking.subtitle.REQUESTED', {
      date: formatBookingDate(booking.createdAt),
      time: formatBookingTime(booking.createdAt),
    })
  }
  if (status === 'COMPLETED') {
    const key = booking.guestUnit === 'people' ? 'COMPLETED_STAY' : 'COMPLETED'
    return t(`guestBooking.subtitle.${key}`, { date: formatBookingDate(booking.endsAt) })
  }
  const date = formatBookingDate(booking.statusChangedAt || booking.createdAt)
  if (status === 'AWAITING_PAYMENT') return t('guestBooking.subtitle.AWAITING_PAYMENT', { date })
  return t(`bookingRequests.subtitle.${status}`, { date })
}

// 528:731, 528:735: "subota, od 14:00". A booking by the hour or by a slot
// has its own times; a whole-day one only a vehicle's fixed pickup and return
// times (R71). A stay keeps no hour, so it names the day alone.
function getDayHint(t, booking, value, edge) {
  const day = formatBookingWeekday(t, value)
  const key = edge === 'start' ? 'guestBooking.dayFrom' : 'guestBooking.dayUntil'
  if (!DATE_ONLY_UNITS.includes(booking.priceUnit)) return t(key, { day, time: formatBookingTime(value) })
  const fixed = edge === 'start' ? booking.listing?.pickupTime : booking.listing?.returnTime
  return fixed ? t(key, { day, time: fixed }) : day
}

// 528:727: "Sobe · Kopaonik, Suvo Rudište"
function getListingHint(listing) {
  const place = [listing?.city, listing?.area].filter(Boolean).join(', ')
  return [listing?.categoryName, place].filter(Boolean).join(' · ')
}

function getPaymentFact(t, booking) {
  const cash = booking.paymentMethod === 'CASH'
  return {
    key: 'payment',
    label: t('booking.paymentMethodLabel'),
    value: cash ? t('guestBooking.paymentCash') : t('guestBooking.paymentTransfer'),
    hint: booking.listing?.acceptsBothPaymentMethods ? t(cash ? 'bookingRequests.guestChoseCash' : 'bookingRequests.guestChoseTransfer') : '',
  }
}

// 528:748: nothing is paid ahead for cash; a transfer shows what reached the
// owner, or what is still to be paid and by when.
function getMoneyFact(t, booking) {
  if (booking.paymentMethod === 'CASH') {
    return { key: 'paid', label: t('booking.paidLabel'), value: formatRsd(0), hint: t('guestBooking.noAdvance') }
  }
  if (booking.paymentConfirmedAt) {
    const rest = (booking.totalAmount || 0) - (booking.amountDue || 0)
    const date = formatBookingDate(booking.paymentConfirmedAt)
    return {
      key: 'paid',
      label: t('booking.paidLabel'),
      value: formatRsd(booking.amountDue),
      hint: rest > 0 ? t('guestBooking.paidAdvanceOn', { date, rest: formatRsd(rest) }) : t('guestBooking.paidOn', { date }),
    }
  }
  if (booking.status === 'AWAITING_PAYMENT') {
    return {
      key: 'due',
      label: t('booking.payAmount'),
      value: formatRsd(booking.amountDue),
      hint: booking.paymentDeadline
        ? t('bookingRequests.payBy', { date: formatBookingDate(booking.paymentDeadline), time: formatBookingTime(booking.paymentDeadline) })
        : '',
    }
  }
  if (booking.status === 'REQUESTED') {
    return { key: 'due', label: t('booking.payAmount'), value: formatRsd(booking.amountDue), hint: t('guestBooking.payAfterApproval') }
  }
  return null
}

// 528:755: the terms frozen with the booking, and what follows the free period.
function getTermsFact(t, booking) {
  const type = booking.cancellationPolicy?.type
  let hint = ''
  if (type === 'NO_CANCELLATION') hint = t('guestBooking.termsNone')
  else if (type === 'FREE_UNTIL_DAYS' || type === 'FREE_UNTIL_HOURS') {
    const advance = booking.paymentMethod !== 'CASH' && (booking.amountDue || 0) < (booking.totalAmount || 0)
    hint = t(advance ? 'guestBooking.termsAdvanceKept' : 'guestBooking.termsWithOwner')
  }
  return {
    key: 'terms',
    wide: true,
    label: t('booking.cancellationTerms'),
    value: booking.cancellationTermsSnapshot || t('guestBooking.noTerms'),
    hint,
  }
}

// 528:759: what the state means for the guest, in the blue note.
function getNoteText(t, booking) {
  const cash = booking.paymentMethod === 'CASH'
  switch (booking.status) {
    case 'REQUESTED':
      return t('guestBooking.note.requested')
    case 'AWAITING_PAYMENT':
      return t(booking.paymentDisputed ? 'guestBooking.note.paymentReported' : 'guestBooking.note.awaitingPayment')
    case 'CONFIRMED':
      if (cash) return t(booking.canCancel ? 'guestBooking.note.cash' : 'guestBooking.note.cashWithOwner')
      return t('guestBooking.note.transferWithOwner')
    case 'COMPLETED':
      return t(cash ? 'guestBooking.note.cash' : 'guestBooking.note.transfer')
    case 'CANCELLED':
      return t(booking.cancellation?.by === 'OWNER' ? 'guestBooking.note.cancelledByOwner' : 'guestBooking.note.cancelledByGuest')
    case 'REJECTED':
      return t('guestBooking.note.rejected')
    case 'EXPIRED':
      // Dizajn 41: a request nobody answered expires too.
      return t(booking.expiredFrom === 'REQUESTED' ? 'guestBooking.note.requestExpired' : 'guestBooking.note.expired')
    case 'NO_SHOW':
      if (!booking.noShowDisputed) return t('guestBooking.note.noShow')
      // T90: an overturned mark leaves NO_SHOW, so a decided one stood.
      return t(booking.noShowDisputeDecided ? 'guestBooking.note.noShowUpheld' : 'guestBooking.note.noShowDisputed')
    default:
      return ''
  }
}

// 528:761: the guest's own actions, the danger one first as the frame has it.
// T94: the unconfirmed payment can be reported from halfway through the
// payment window, when the deadline reminder also goes out, until the
// deadline (the server refuses it later), and not again while the admin
// still has the report open.
function getActions(t, booking, now) {
  const actions = []
  if (booking.canCancel) {
    actions.push({
      name: 'cancel',
      look: 'danger',
      label: booking.status === 'REQUESTED' ? t('booking.withdrawRequest') : t('booking.cancelBooking'),
    })
  }
  if (
    booking.status === 'AWAITING_PAYMENT' &&
    !booking.paymentDisputed &&
    booking.awaitingPaymentSince &&
    booking.paymentDeadline
  ) {
    const start = new Date(booking.awaitingPaymentSince).getTime()
    const end = new Date(booking.paymentDeadline).getTime()
    if (now >= start + (end - start) / 2 && now < end) {
      actions.push({ name: 'dispute-payment', look: 'plain', label: t('booking.reportUnpaidConfirmed') })
    }
  }
  if (booking.status === 'NO_SHOW' && !booking.noShowDisputed) {
    actions.push({ name: 'dispute-no-show', look: 'plain', label: t('booking.disputeNoShow') })
  }
  const messaging = booking.messaging
  if (messaging?.conversationId) {
    actions.push({ name: 'message', look: 'plain', label: t('guestBooking.sendMessage'), to: `/kontrolna-tabla/poruke/${messaging.conversationId}` })
  } else if (messaging?.canStart && booking.listing?.slug) {
    actions.push({
      name: 'message',
      look: 'plain',
      label: t('guestBooking.sendMessage'),
      to: { path: `/oglasi/${booking.listing.slug}/poruka`, query: { rezervacija: booking.id } },
    })
  }
  return actions
}

// 528:766: who the owner is. The full name, phone and address come with the
// confirmation (T80); before it the guest knows what the listing's page shows.
function getContact(t, booking) {
  const unlocked = !!booking.ownerName
  const rows = [{ key: 'name', label: t('guestBooking.contactName'), value: unlocked ? booking.ownerName : booking.ownerShortName }]
  if (unlocked && booking.ownerPhone) {
    rows.push({
      key: 'phone',
      label: t('guestBooking.contactPhone'),
      value: booking.ownerPhone,
      href: `tel:${booking.ownerPhone.replace(/[^\d+]/g, '')}`,
    })
  }
  if (unlocked && booking.listing?.address) {
    rows.push({ key: 'address', label: t('guestBooking.contactAddress'), value: booking.listing.address })
  }
  let footnote = ''
  if (unlocked && ['CONFIRMED', 'COMPLETED'].includes(booking.status)) footnote = t('guestBooking.contactVisible')
  else if (!unlocked && OPEN_STATUSES.includes(booking.status)) footnote = t('guestBooking.contactHidden')
  return {
    rows: rows.filter((row) => row.value),
    listingTo: booking.listing?.status === 'ACTIVE' && booking.listing?.slug ? `/oglasi/${booking.listing.slug}` : null,
    footnote,
  }
}

export function buildGuestBookingView(t, booking, now = Date.now()) {
  const guests = booking.guestCount ? formatBookingGuests(t, booking.guestUnit, booking.guestCount) : ''
  const facts = [
    {
      key: 'listing',
      wide: true,
      label: t('booking.listingTitle'),
      value: formatBookingListing(booking.listing),
      hint: getListingHint(booking.listing),
    },
    {
      key: 'checkIn',
      label: t('booking.checkIn'),
      value: formatBookingDate(booking.startsAt),
      hint: getDayHint(t, booking, booking.startsAt, 'start'),
    },
    {
      key: 'checkOut',
      label: t('booking.checkOut'),
      value: formatBookingDate(booking.endsAt),
      hint: getDayHint(t, booking, booking.endsAt, 'end'),
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
  // T127: the adults the guest said come along with the children.
  const adults = getAdultsFact(t, booking)
  if (adults) facts.push(adults)
  // Without a guest count the total takes the whole row, so the payment and
  // what was paid stay side by side as 528:744 has them.
  facts.push({
    key: 'total',
    wide: !guests,
    label: t('booking.totalAmount'),
    value: formatRsd(booking.totalAmount),
    hint: formatBookingPriceBreakdown(t, booking),
  })
  facts.push(getPaymentFact(t, booking))
  const money = getMoneyFact(t, booking)
  if (money) facts.push(money)
  if (booking.guestMessage) {
    facts.push({ key: 'message', wide: true, label: t('booking.guestMessage'), value: `„${booking.guestMessage}“`, hint: '' })
  }
  facts.push(getTermsFact(t, booking))

  return {
    title: formatBookingListing(booking.listing),
    subtitle: getSubtitle(t, booking),
    status: booking.status,
    statusText: getBookingStatusLabel(t, booking.status),
    facts,
    note: getNoteText(t, booking),
    actions: getActions(t, booking, now),
    contact: getContact(t, booking),
  }
}
