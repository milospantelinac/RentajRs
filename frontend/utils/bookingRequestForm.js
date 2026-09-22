// Dizajn 40: what the guest's request page says about the term, the guests,
// the price and what follows the request. 363:406 draws a stay picked on the
// calendar and 538:514 a day and one of its defined slots; working hours and
// monthly stays have no frame and reuse their parts. Instants are read in
// Belgrade time through bookingRequests.js; calendar days travel as
// "2026-09-12" keys, which name the same day in any time zone.
import { srPluralCategory } from './pluralize'
import { isStartWithinRules } from './bookingRules'
import {
  formatBookingDate,
  formatBookingDuration,
  formatBookingGuests,
  formatBookingTime,
  formatPriceLine,
  formatRsd,
  formatUnits,
} from './bookingRequests'

const TIME_ZONE = 'Europe/Belgrade'
const DAY_MS = 86_400_000

// The guest-limit sentence under "Broj gostiju" (375:416, 538:770), by leaf category.
const GUEST_LIMIT_KIND = {
  igraonice: 'playroom',
  'sale-za-proslave': 'venue',
  'konferencijske-sale': 'venue',
  stanovi: 'stay',
  'kuce-i-vikendice': 'stay',
  sobe: 'stay',
}

// How the guest picks the term: a stay's dates, a defined slot, a day and its
// hours, or whole months.
export function getRequestModel(listing) {
  if (listing?.bookingModel === 'PER_SLOT' && listing?.slotSubmode === 'DEFINED_SLOTS') return 'slots'
  if (listing?.priceUnit === 'MONTH') return 'months'
  if (listing?.bookingModel === 'PER_SLOT') return 'hours'
  return 'stay'
}

// ---- Calendar day keys ----------------------------------------------------

function keyParts(key) {
  const [year, month, day] = key.split('-').map(Number)
  return { year, month, day }
}

function keyToUtcNoon(key) {
  const { year, month, day } = keyParts(key)
  return new Date(Date.UTC(year, month - 1, day, 12))
}

// Monday 0 to Sunday 6.
function keyWeekday(key) {
  return (keyToUtcNoon(key).getUTCDay() + 6) % 7
}

export function addDaysToKey(key, days) {
  const date = new Date(keyToUtcNoon(key).getTime() + days * DAY_MS)
  return date.toISOString().slice(0, 10)
}

export function daysBetweenKeys(from, to) {
  return Math.round((keyToUtcNoon(to) - keyToUtcNoon(from)) / DAY_MS)
}

// ISO weekday of a key, Monday 1 to Sunday 7 (WorkingHours.dayOfWeek).
export function isoWeekdayOfKey(key) {
  return keyWeekday(key) + 1
}

const belgradeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

function belgradeParts(value) {
  return Object.fromEntries(belgradeFormatter.formatToParts(new Date(value)).map((part) => [part.type, part.value]))
}

// The Belgrade day an instant falls on, as a key.
export function belgradeDayKey(value) {
  const parts = belgradeParts(value)
  return `${parts.year}-${parts.month}-${parts.day}`
}

// The instant a Belgrade wall-clock time names ("2026-09-12", "16:00"), the
// way the server reads working hours (toBelgradeHHMM), whatever zone the
// browser or the server render is in.
export function belgradeInstant(key, time) {
  const { year, month, day } = keyParts(key)
  const [hour, minute] = time.split(':').map(Number)
  const wall = Date.UTC(year, month - 1, day, hour, minute)
  const offsetAt = (instant) => {
    const p = belgradeParts(instant)
    return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute)) - instant
  }
  const first = wall - offsetAt(wall)
  return new Date(wall - offsetAt(first))
}

function formatKey(t, key, options) {
  return new Intl.DateTimeFormat(t('listing.calendarLocale'), { timeZone: 'UTC', ...options }).format(keyToUtcNoon(key))
}

// "12. septembar 2026."
export function formatLongDay(t, key) {
  return formatKey(t, key, { day: 'numeric', month: 'long', year: 'numeric' })
}

function weekdayWord(t, listKey, key) {
  return t(listKey).split(',')[keyWeekday(key)]
}

// "12. 9."
function formatShortKey(key) {
  const { month, day } = keyParts(key)
  return `${day}. ${month}.`
}

// ---- The chosen term --------------------------------------------------------

// 373:606: "12. - 13. septembar 2026.", the month and year once when they repeat.
export function formatStayRangeTitle(t, startKey, endKey) {
  const from = keyParts(startKey)
  const to = keyParts(endKey)
  const month = (key) => formatKey(t, key, { month: 'long' })
  if (from.year === to.year && from.month === to.month) {
    return t('bookingForm.rangeSameMonth', { from: from.day, to: to.day, month: month(endKey), year: to.year })
  }
  if (from.year === to.year) {
    return t('bookingForm.rangeSameYear', { from: from.day, fromMonth: month(startKey), to: to.day, toMonth: month(endKey), year: to.year })
  }
  return t('bookingForm.rangeFull', { from: formatLongDay(t, startKey), to: formatLongDay(t, endKey) })
}

// 373:604: what the box under the calendar says about the dates picked so far.
export function buildStayBox(t, listing, selection) {
  const { startsAt, endsAt } = selection || {}
  if (!startsAt) return null
  if (!endsAt) return { title: formatLongDay(t, startsAt), detail: t('booking.rangePickerPickEnd') }
  const count = Math.max(1, daysBetweenKeys(startsAt, endsAt))
  // Nights, or days for anything else a stay is priced by (the price rows count those).
  const unit = listing?.priceUnit === 'NIGHT' ? 'NIGHT' : 'DAY'
  return {
    title: formatStayRangeTitle(t, startsAt, endsAt),
    detail: t('bookingForm.rangeDays', {
      from: weekdayWord(t, 'bookingRequests.weekdays', startsAt),
      to: weekdayWord(t, 'bookingForm.weekdaysGenitive', endsAt),
      length: formatUnits(t, {}, unit, count),
    }),
  }
}

// The same box for a day of working hours: "subota, 12. septembar 2026." over
// "16:00 - 18:00 · 2 sata".
export function buildHoursBox(t, dateKey, startTime, hours) {
  if (!dateKey) return null
  const title = `${weekdayWord(t, 'bookingRequests.weekdays', dateKey)}, ${formatLongDay(t, dateKey)}`
  if (!startTime) return { title, detail: t('bookingForm.pickStartTime') }
  return {
    title,
    detail: `${formatHoursRange(startTime, hours)} · ${formatUnits(t, {}, 'HOUR', hours)}`,
  }
}

// "16:00 - 18:00", past midnight too.
function formatHoursRange(startTime, hours) {
  const [h, m] = startTime.split(':').map(Number)
  const end = (h * 60 + m + hours * 60) % (24 * 60)
  const pad = (value) => String(value).padStart(2, '0')
  return `${startTime} - ${pad(Math.floor(end / 60))}:${pad(end % 60)}`
}

// 369:418 / 538:798: "12. - 13. 9. 2026.", "12. 9. 2026. 11:00 - 12:30".
export function formatTermValue(t, model, term) {
  if (!term) return '-'
  if (model === 'stay') {
    const from = keyParts(term.startsAt)
    const to = keyParts(term.endsAt)
    if (from.year !== to.year) return `${formatShortKey(term.startsAt)} ${from.year}. - ${formatShortKey(term.endsAt)} ${to.year}.`
    if (from.month !== to.month) return `${formatShortKey(term.startsAt)} - ${formatShortKey(term.endsAt)} ${to.year}.`
    return `${from.day}. - ${formatShortKey(term.endsAt)} ${to.year}.`
  }
  if (model === 'months') {
    const first = `${term.monthStart}-01`
    const last = addMonthsToKey(first, term.monthCount - 1)
    const month = (key) => formatKey(t, key, { month: 'long' })
    const firstYear = keyParts(first).year
    const lastYear = keyParts(last).year
    if (term.monthCount <= 1) return `${month(first)} ${firstYear}.`
    if (firstYear === lastYear) return `${month(first)} - ${month(last)} ${lastYear}.`
    return `${month(first)} ${firstYear}. - ${month(last)} ${lastYear}.`
  }
  return `${formatBookingDate(term.startsAt)} ${formatBookingTime(term.startsAt)} - ${formatBookingTime(term.endsAt)}`
}

function addMonthsToKey(key, months) {
  const { year, month } = keyParts(key)
  const date = new Date(Date.UTC(year, month - 1 + months, 1, 12))
  return date.toISOString().slice(0, 10)
}

// ---- Guests -------------------------------------------------------------------

export function getGuestLabel(t, listing) {
  return listing?.guestUnit === 'children' ? t('bookingForm.childrenCount') : t('booking.guestCount')
}

// 369:421 "30" and 538:801 "18 dece": the frames name the children only.
export function formatGuestValue(t, listing, count) {
  return listing?.guestUnit === 'children' ? formatBookingGuests(t, 'children', count) : String(count)
}

// 375:416: "Maksimum za ovaj prostor je 60 gostiju."
export function formatGuestLimit(t, listing, cap) {
  if (!cap) return ''
  const kind = GUEST_LIMIT_KIND[listing?.category?.slug] || 'default'
  return t(`bookingForm.guestLimit.${kind}`, { guests: formatBookingGuests(t, listing?.guestUnit, cap) })
}

export function formatGuestMinimum(t, listing, min) {
  return t('bookingForm.guestMinimum', { guests: formatBookingGuests(t, listing?.guestUnit, min) })
}

// ---- Payment and what follows the request -------------------------------------

// What the listing takes, and what the booking will be once the guest picks.
// R52: a transfer on a listing that doesn't ask for approval goes straight
// to the QR code.
export function getRequestFlow(listing, chosenMethod) {
  const accepts = listing?.paymentMethod === 'BOTH' || listing?.paymentMethod === 'BANK_TRANSFER' ? listing.paymentMethod : 'CASH'
  const method = accepts === 'BOTH' ? chosenMethod || null : accepts
  return { accepts, method, instant: method === 'BANK_TRANSFER' && !listing?.requiresApproval }
}

// 375:423: "Vlasnik prima keš i uplatu na račun."
export function getPaymentHint(t, flow) {
  if (flow.accepts === 'BOTH') return t('bookingForm.paymentHint.both')
  return t(flow.accepts === 'BANK_TRANSFER' ? 'bookingForm.paymentHint.transfer' : 'bookingForm.paymentHint.cash')
}

// 369:433: the three steps after "Pošalji", as the listing really runs them.
export function buildFlowSteps(t, listing, flow) {
  const hours = formatUnits(t, {}, 'HOUR', listing?.paymentDeadlineHours || 48)
  if (flow.instant) {
    return [
      { title: t('bookingForm.flow.qrNowTitle'), text: t('bookingForm.flow.qrNowText', { hours }) },
      { title: t('bookingForm.flow.payTitle'), text: t('bookingForm.flow.payText') },
      { title: t('bookingForm.flow.confirmTitle'), text: t('bookingForm.flow.confirmText') },
    ]
  }
  const payment = {
    BOTH: { title: t('bookingForm.flow.bothTitle'), text: t('bookingForm.flow.bothText') },
    CASH: { title: t('bookingForm.flow.cashTitle'), text: t('bookingForm.flow.cashText') },
    BANK_TRANSFER: { title: t('bookingForm.flow.transferTitle'), text: t('bookingForm.flow.transferText', { hours }) },
  }[flow.accepts]
  return [
    {
      title: t('bookingForm.flow.requestTitle'),
      // 369:443 and 538:823 word it apart; each frame keeps its own.
      text: t(listing?.bookingModel === 'PER_SLOT' ? 'bookingForm.flow.requestTextSlot' : 'bookingForm.flow.requestText'),
    },
    { title: t('bookingForm.flow.answerTitle'), text: t('bookingForm.flow.answerText') },
    payment,
  ]
}

// 375:432, and without the approval a QR listing never asks for.
export function getSubmitNote(t, flow) {
  return t(flow.instant ? 'bookingForm.noteInstant' : 'bookingForm.note')
}

export function getFlowTip(t, flow) {
  return t(flow.instant ? 'bookingForm.tips.flowInstant' : 'bookingForm.tips.flow')
}

// 369:461: the listing's terms and what follows them. A transfer with an
// advance keeps it after the free period (Dizajn 39).
export function getCancellationText(t, listing, flow) {
  const type = listing?.cancellationPolicyType
  const threshold = listing?.cancellationThreshold
  if (type === 'NO_CANCELLATION') return t('bookingForm.cancel.none')
  let head = ''
  if (type === 'FREE_UNTIL_DAYS' && threshold) head = t(`bookingForm.cancel.days${srPluralCategory(threshold)}`, { count: threshold })
  else if (type === 'FREE_UNTIL_HOURS' && threshold) head = t(`bookingForm.cancel.hours${srPluralCategory(threshold)}`, { count: threshold })
  else return t('bookingForm.cancel.unset')
  const advance = flow.method === 'BANK_TRANSFER' && listing.advancePercent > 0 && listing.advancePercent < 100
  return `${head} ${t(advance ? 'bookingForm.cancel.afterAdvance' : 'bookingForm.cancel.afterOwner')}`
}

// ---- The price ------------------------------------------------------------------

// 369:422 and 538:802: one "Cena" row per price the term is charged at, then
// what fees and extra services add. A defined slot names its length instead.
export function buildPriceRows(t, listing, quote, slot) {
  const label = t('bookingForm.price')
  if (!quote) return [{ key: 'price', label, value: '-' }]
  const booking = { priceUnit: listing.priceUnit, guestUnit: listing.guestUnit }
  let rows
  if (slot && listing.priceUnit !== 'GUEST') {
    const length = formatBookingDuration(t, { priceUnit: 'SLOT', startsAt: slot.startsAt, endsAt: slot.endsAt })
    rows = [{ key: 'price', label, value: t('bookingForm.slotPrice', { length }) }]
  } else {
    const lines = quote.priceLines?.length ? quote.priceLines : [{ count: quote.unitCount, price: quote.pricePerUnit, kind: 'BASE' }]
    rows = lines.map((line, index) => ({ key: `price${index}`, label: index === 0 ? label : '', value: formatPriceLine(t, booking, line) }))
  }
  if (quote.guestFee > 0) rows.push({ key: 'guestFee', label: t('booking.guestFeeLine'), value: formatRsd(quote.guestFee) })
  if (quote.mandatoryFeesTotal > 0) rows.push({ key: 'fees', label: t('booking.mandatoryFeesLine'), value: formatRsd(quote.mandatoryFeesTotal) })
  if (quote.extraServicesTotal > 0) rows.push({ key: 'extras', label: t('listing.extraServices'), value: formatRsd(quote.extraServicesTotal) })
  return rows
}

// The part paid by QR up front, when it is less than the total.
export function getAdvanceRow(t, quote, flow) {
  if (!quote || flow.method !== 'BANK_TRANSFER' || !(quote.amountDue < quote.totalAmount)) return null
  return { label: t('booking.payAmount'), value: formatRsd(quote.amountDue) }
}

// ---- Defined slots (538:843, 538:874) ---------------------------------------------

// The slots a guest may still pick, each marked taken when a booking, a
// blocked date or an imported event covers it (T74).
export function buildSlotEntries(t, listing, availability, now) {
  const blocked = availability?.blocked || []
  const overlaps = (slot) =>
    blocked.some((b) => new Date(b.startsAt) < new Date(slot.endsAt) && new Date(b.endsAt) > new Date(slot.startsAt))
  return (availability?.definedSlots || [])
    .filter((slot) => new Date(slot.startsAt).getTime() > now && isStartWithinRules(listing, slot.startsAt, now))
    .map((slot) => {
      const price = slot.price ?? listing.price
      return {
        id: slot.id,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        day: belgradeDayKey(slot.startsAt),
        time: `${formatBookingTime(slot.startsAt)} - ${formatBookingTime(slot.endsAt)}`,
        price: listing.priceUnit === 'GUEST' ? `${formatRsd(price)} ${t('listing.pricePerGuestSuffix')}` : formatRsd(price),
        taken: overlaps(slot),
      }
    })
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
}

// 538:844: seven days from `start`, each with its free slots counted.
export function buildSlotDays(t, entries, start, count = 7) {
  return Array.from({ length: count }, (_, index) => {
    const key = addDaysToKey(start, index)
    const slots = entries.filter((entry) => entry.day === key)
    const free = slots.filter((entry) => !entry.taken).length
    let note = t('bookingForm.dayNoSlots')
    if (free) note = t(`bookingForm.daySlots${srPluralCategory(free)}`, { count: free })
    else if (slots.length) note = t('bookingForm.dayFull')
    return {
      key,
      weekday: weekdayWord(t, 'bookingForm.weekdaysShort', key),
      date: formatShortKey(key),
      note,
      free,
      slots,
    }
  })
}

// 538:873: "Slobodni termini: subota, 12. septembar"
export function formatSlotsHeading(t, key) {
  return t('bookingForm.slotsFor', {
    day: weekdayWord(t, 'bookingRequests.weekdays', key),
    date: formatKey(t, key, { day: 'numeric', month: 'long' }),
  })
}
