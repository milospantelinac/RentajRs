<template>
  <div class="booking-panel">
    <div class="booking-panel-price">
      <!-- T121: "Od 60.000 RSD / termin" on defined slots, no "0 RSD" without one ahead. -->
      <p class="booking-panel-price-main">
        <template v-if="headPrice">
          <span class="booking-panel-amount">{{ headPrice }}</span>
          <span class="booking-panel-unit">{{ unitSuffix }}</span>
        </template>
        <span v-else class="booking-panel-unit">{{ t('listing.noUpcomingSlots') }}</span>
      </p>
      <!-- T114: "Novo" until the first review. -->
      <span class="booking-panel-rating">
        <img src="/images/icons/star-solid.svg" alt="" class="booking-panel-star" />
        {{ hasRating(listing) ? formatRating(listing.avgRating) : t('listing.ratingNew') }}
      </span>
    </div>

    <!-- Dizajn 11 — the card carries the same term picker the request page
         uses, so what a guest chooses here is exactly what gets carried over
         (and priced) rather than a second, looser implementation of it. -->
    <template v-if="bookable">
      <div v-if="isDefinedSlots" class="booking-panel-fields">
        <button type="button" class="booking-panel-field booking-panel-field-full" @click="togglePicker">
          <span class="booking-panel-field-label">{{ t('booking.slotLabel') }}</span>
          <span class="booking-panel-field-value">{{ slotLabel || t('booking.pickSlotPlaceholder') }}</span>
          <img src="/images/icons/chevron-down.svg" alt="" class="booking-panel-field-chevron" />
        </button>
      </div>

      <!-- T128: the start month and the number of months are two fields of
           the card's own kind, always in view, rather than a box that opened
           under one. -->
      <BookingMonthPicker
        v-else-if="isMonthly"
        variant="card"
        :listing-id="listing.id"
        :base-price="listing.price"
        :min-duration="listing.minDuration"
        :max-duration="listing.maxDuration"
        :earliest-booking-hours="listing.earliestBookingHours"
        :max-advance-booking-days="listing.maxAdvanceBookingDays"
        :initial-month="monthStart"
        :initial-count="monthCount"
        @update:range="onMonthRangeUpdate"
      />

      <!-- T127: the day, then the start and the length, as on the request page.
           Both selects only offer what fits before closing and is still free. -->
      <template v-else-if="isWorkingHours">
        <div class="booking-panel-fields">
          <button
            type="button"
            class="booking-panel-field booking-panel-field-full"
            :aria-expanded="pickerOpen"
            @click="togglePicker"
          >
            <span class="booking-panel-field-label">{{ t('booking.dateLabel') }}</span>
            <span class="booking-panel-field-value" :class="{ 'is-empty': !startsAt }">
              {{ startLabel || t('booking.pickDatePlaceholder') }}
            </span>
            <img src="/images/icons/chevron-down.svg" alt="" class="booking-panel-field-chevron" />
          </button>
        </div>

        <div v-if="pickerOpen" class="booking-panel-picker">
          <BookingDateRangePicker
            :listing-id="listing.id"
            :show-pricing="false"
            :earliest-booking-hours="listing.earliestBookingHours"
            :max-advance-booking-days="listing.maxAdvanceBookingDays"
            :available-days-of-week="availableDaysOfWeek"
            :whole-day-blocking="false"
            :single-date="true"
            :initial-start="startsAt"
            @update:range="onSingleDateUpdate"
          />
        </div>

        <div class="booking-panel-fields">
          <label v-if="hourStarts.length" class="booking-panel-field booking-panel-field-select">
            <span class="booking-panel-field-label">{{ t('booking.startLabel') }}</span>
            <select v-model="slotStartTime" class="booking-panel-native-select">
              <option value="" disabled>{{ t('booking.pickTimePlaceholder') }}</option>
              <option v-for="time in hourStarts" :key="time" :value="time">{{ time }}</option>
            </select>
            <span class="booking-panel-field-value" :class="{ 'is-empty': !slotStartTime }">
              {{ slotStartTime || t('booking.pickTimePlaceholder') }}
            </span>
            <img src="/images/icons/chevron-down.svg" alt="" class="booking-panel-field-chevron" />
          </label>
          <!-- Without a day there is nothing to offer yet, so the field opens the calendar. -->
          <button v-else type="button" class="booking-panel-field" @click="openPicker">
            <span class="booking-panel-field-label">{{ t('booking.startLabel') }}</span>
            <span class="booking-panel-field-value is-empty">{{ t('booking.pickTimePlaceholder') }}</span>
            <img src="/images/icons/chevron-down.svg" alt="" class="booking-panel-field-chevron" />
          </button>
          <label class="booking-panel-field booking-panel-field-select">
            <span class="booking-panel-field-label">{{ t('bookingForm.duration') }}</span>
            <select v-model.number="slotDurationHours" class="booking-panel-native-select" :disabled="!hourLengths.length">
              <option v-for="hours in hourLengths" :key="hours" :value="hours">{{ hoursText(hours) }}</option>
            </select>
            <span class="booking-panel-field-value">{{ hoursText(slotDurationHours) }}</span>
            <img src="/images/icons/chevron-down.svg" alt="" class="booking-panel-field-chevron" />
          </label>
        </div>
        <p v-if="startsAt && !hourStarts.length" class="booking-panel-hint booking-panel-hours-hint">
          {{ t('booking.noWorkingHoursForDay') }}
        </p>
      </template>

      <!-- T117: a vehicle or a machine is picked up and returned. -->
      <div v-else class="booking-panel-fields">
        <button type="button" class="booking-panel-field" :aria-expanded="pickerOpen" @click="togglePicker">
          <span class="booking-panel-field-label">{{ t(pickupReturn ? 'booking.pickup' : 'booking.checkInLabel') }}</span>
          <span class="booking-panel-field-value" :class="{ 'is-empty': !startsAt }">{{ startLabel || t('booking.pickDatePlaceholder') }}</span>
        </button>
        <button type="button" class="booking-panel-field" :aria-expanded="pickerOpen" @click="togglePicker">
          <span class="booking-panel-field-label">{{ t(pickupReturn ? 'booking.dropoff' : 'booking.checkOutLabel') }}</span>
          <span class="booking-panel-field-value" :class="{ 'is-empty': !endsAt }">{{ endLabel || t('booking.pickDatePlaceholder') }}</span>
        </button>
      </div>

      <div v-if="pickerOpen && !isWorkingHours" class="booking-panel-picker">
        <div v-if="isDefinedSlots" class="booking-panel-slot-list">
          <button
            v-for="slot in slots"
            :key="slot.id"
            type="button"
            class="booking-panel-slot"
            :class="{ 'booking-panel-slot-active': definedSlotId === slot.id }"
            @click="pickSlot(slot)"
          >
            <span>{{ formatDateTime(slot.startsAt) }} — {{ formatDateTime(slot.endsAt) }}</span>
            <!-- T138: a hall priced per guest says so under every slot's price. -->
            <span class="booking-panel-slot-price">
              {{ formatPrice(slot.price ?? listing.price) }}
              <span v-if="listing.priceUnit === 'GUEST'" class="booking-panel-slot-unit">{{ t('listing.pricePerGuestSuffix') }}</span>
            </span>
          </button>
          <p v-if="!slots.length" class="booking-panel-hint">{{ t('booking.noSlots') }}</p>
        </div>

        <!-- T127: it opens on the dates already picked instead of handing an
             empty range back and wiping them. -->
        <BookingDateRangePicker
          v-else
          :listing-id="listing.id"
          :base-price="listing.price"
          :weekend-price="listing.weekendPrice"
          :show-pricing="true"
          :price-unit="listing.priceUnit"
          :min-duration="listing.minDuration"
          :max-duration="listing.maxDuration"
          :earliest-booking-hours="listing.earliestBookingHours"
          :max-advance-booking-days="listing.maxAdvanceBookingDays"
          :initial-start="startsAt"
          :initial-end="endsAt"
          :pickup-return="pickupReturn"
          @update:range="onRangeUpdate"
        />
      </div>

      <!-- T125: only where the guests shape the stay or the price; the request
           page asks for them everywhere else. Typed or stepped, a number past
           the listing's limit is never cut, it is pointed out. -->
      <div v-if="showGuests" class="booking-panel-guests-wrap">
        <button
          type="button"
          class="booking-panel-field booking-panel-field-full"
          :class="{ 'is-invalid': guestErrorShown }"
          :aria-expanded="guestsOpen"
          @click="guestsOpen = !guestsOpen"
        >
          <span class="booking-panel-field-label">{{ t('booking.guestsLabel') }}</span>
          <span class="booking-panel-field-value">{{ guestLabel }}</span>
          <img src="/images/icons/chevron-down.svg" alt="" class="booking-panel-field-chevron" />
        </button>

        <div v-if="guestsOpen" class="booking-panel-guests-popover">
          <div class="booking-panel-guests-row">
            <label :for="guestInputId" class="booking-panel-guests-caption">{{ guestCapCaption }}</label>
            <span class="booking-panel-stepper" :class="{ 'is-invalid': guestErrorShown }">
              <button
                type="button"
                class="booking-panel-stepper-btn"
                :disabled="guestCount <= minGuests"
                :aria-label="t('booking.guestCountDecrease')"
                @click="stepGuests(-1)"
              >
                &minus;
              </button>
              <input
                :id="guestInputId"
                ref="guestInputEl"
                v-model="guestInput"
                class="booking-panel-stepper-input"
                type="text"
                inputmode="numeric"
                autocomplete="off"
                maxlength="4"
                :aria-invalid="guestErrorShown"
                :aria-describedby="guestErrorShown ? guestErrorId : undefined"
                @input="onGuestInput"
                @blur="guestTouched = true"
              />
              <button
                type="button"
                class="booking-panel-stepper-btn"
                :disabled="maxGuests !== null && guestCount >= maxGuests"
                :aria-label="t('booking.guestCountIncrease')"
                @click="stepGuests(1)"
              >
                +
              </button>
            </span>
          </div>
          <p v-if="guestErrorShown" :id="guestErrorId" class="booking-panel-guests-error" role="alert">
            <img src="/images/icons/field-error.svg" alt="" />{{ guestError }}
          </p>
        </div>
      </div>

      <template v-if="quote">
        <div class="booking-panel-divider" />
        <div class="booking-panel-breakdown">
          <!-- T127: one line per price the term is charged at, as the request page shows it. -->
          <div v-for="row in priceRows" :key="row.key" class="booking-panel-row">
            <span class="booking-panel-row-label">
              {{ row.label }}
              <span v-if="row.note" class="booking-panel-row-note">{{ row.note }}</span>
            </span>
            <span class="booking-panel-row-value">{{ row.value }}</span>
          </div>
          <div class="booking-panel-row-divider" />
          <div class="booking-panel-total">
            <span class="booking-panel-total-label">{{ t('booking.totalAmount') }}</span>
            <span class="booking-panel-total-value">{{ formatPrice(quote.totalAmount) }}</span>
          </div>
        </div>
      </template>

      <div class="booking-panel-commission">
        <span class="booking-panel-commission-pill">{{ t('booking.commissionPill', { amount: formatPrice(commission) }) }}</span>
      </div>

      <span v-if="preview" class="booking-panel-cta booking-panel-cta-inert">{{ t('listing.sendRequest') }}</span>
      <!-- T125: a guest count the listing can't take goes nowhere until fixed;
           the button shows why instead. -->
      <button v-else-if="guestError" type="button" class="booking-panel-cta" @click="revealGuestError">
        {{ t('listing.sendRequest') }}
      </button>
      <NuxtLink v-else :to="requestLink" class="booking-panel-cta">{{ t('listing.sendRequest') }}</NuxtLink>
      <p class="booking-panel-note">{{ t('booking.requestGoesToOwner') }}</p>
    </template>

    <!-- Ch.11.2/R108 — a package without the booking system never offers a
         request CTA; the owner's own contact route takes its place. -->
    <template v-else>
      <p class="booking-panel-note booking-panel-note-left">{{ t('booking.noOnlineBooking') }}</p>
    </template>

    <template v-if="preview">
      <span v-if="listing.canMessage" class="booking-panel-secondary booking-panel-cta-inert">{{ t('listing.messageOwner') }}</span>
    </template>
    <NuxtLink v-else-if="listing.canMessage" :to="`/oglasi/${listing.slug}/poruka`" class="booking-panel-secondary">
      {{ t('listing.messageOwner') }}
    </NuxtLink>
    <a v-else-if="listing.owner?.phone" :href="`tel:${listing.owner.phone}`" class="booking-panel-secondary">
      {{ t('listing.callOwner') }}: {{ listing.owner.phone }}
    </a>
  </div>
</template>

<script setup>
// Dizajn 11 — the sticky booking card (Figma 113:2). It reuses the request
// page's own pickers and the existing /bookings/quote endpoint rather than
// re-deriving prices client-side, and the CTA hands the chosen term over to
// that page through the query string, so nothing about how a request is
// validated, priced or sent changes here.
const props = defineProps({
  listing: { type: Object, required: true },
  // Loaded once by the page and shared with the "Radno vreme" table, so the
  // two can't disagree about which terms are open.
  availability: { type: Object, default: null },
  preview: { type: Boolean, default: false },
})

const { t } = useI18n()
const api = useApi()

const bookable = computed(() => props.listing.bookingModel !== 'NO_BOOKING' && props.listing.canBook)
const isDefinedSlots = computed(
  () => props.listing.bookingModel === 'PER_SLOT' && props.listing.slotSubmode === 'DEFINED_SLOTS',
)
const isMonthly = computed(() => props.listing.priceUnit === 'MONTH')
const isWorkingHours = computed(
  () => props.listing.bookingModel === 'PER_SLOT' && props.listing.slotSubmode === 'WORKING_HOURS',
)

// T117: a vehicle or a machine is picked up and returned.
const pickupReturn = computed(() => usesPickupAndReturn(props.listing))

const pickerOpen = ref(false)
const guestsOpen = ref(false)
const startsAt = ref('')
const endsAt = ref('')
const monthStart = ref('')
const monthCount = ref(1)
const definedSlotId = ref(null)
const slotStartTime = ref('')
// T127: from the shortest term allowed, as the request page starts.
const slotDurationHours = ref(props.listing.minDuration || 1)
// Dizajn 22: like the request page (T74), never offer a slot that overlaps a
// blocked term: a booking on it, a blocked date or an imported calendar event.
// Dizajn 23: nor one inside the notice or past the horizon.
const slots = computed(() =>
  (props.availability?.definedSlots ?? []).filter(
    (s) => !overlapsBlocked(new Date(s.startsAt), new Date(s.endsAt)) && isStartWithinRules(props.listing, s.startsAt),
  ),
)
const workingHours = computed(() => props.availability?.workingHours ?? [])
const blocked = computed(() => props.availability?.blocked ?? [])

// Mirrors the request page. Dizajn 23: "Maks. broj gostiju" and the capacity from
// step Detalji ("Kapacitet ljudi" or "Kapacitet dece") both apply, so the lower one does.
const maxGuests = computed(() => getGuestCap(props.listing))
const minGuests = computed(() => props.listing.minGuests || 1)
// T125: a stay (every model) and a price per guest ask here; the rest only on the request page.
const showGuests = computed(() => hasGuestPill(props.listing))
const guestInput = ref(String(minGuests.value))
const guestCount = computed(() => (/^\d+$/.test(guestInput.value) ? Number(guestInput.value) : 0))
const guestTouched = ref(false)
const guestInputEl = ref(null)
const guestInputId = useId()
const guestErrorId = useId()
// Tamara, 2026-10-09: the request page's rule. Too many shows at once, too few
// once the field is left; the number is never changed for the guest.
const overCap = computed(() => maxGuests.value !== null && guestCount.value > maxGuests.value)
const guestError = computed(() => {
  if (!showGuests.value) return ''
  if (overCap.value) return formatGuestLimit(t, props.listing, maxGuests.value)
  if (guestCount.value < minGuests.value) return formatGuestMinimum(t, props.listing, minGuests.value)
  return ''
})
const guestErrorShown = computed(() => !!guestError.value && (overCap.value || guestTouched.value))
// The price always follows a count the listing takes.
const quoteGuests = computed(() =>
  showGuests.value ? Math.min(Math.max(guestCount.value, minGuests.value), maxGuests.value ?? Infinity) : minGuests.value,
)

const availableDaysOfWeek = computed(() =>
  workingHours.value.length ? [...new Set(workingHours.value.map((h) => h.dayOfWeek))] : null,
)

// T127: a calendar opened again hands the dates it was opened on straight
// back; that first answer keeps them (it used to wipe the date and the time),
// anything picked after it counts.
let pickerOpening = false
function togglePicker() {
  pickerOpen.value = !pickerOpen.value
  pickerOpening = pickerOpen.value
}
function openPicker() {
  if (!pickerOpen.value) togglePicker()
}
function pickerAnswered() {
  const first = pickerOpening
  pickerOpening = false
  return !first
}

function onRangeUpdate(range) {
  if (!pickerAnswered()) return
  startsAt.value = range.startsAt || ''
  endsAt.value = range.endsAt || ''
  if (startsAt.value && endsAt.value) pickerOpen.value = false
}
function onSingleDateUpdate(range) {
  if (!pickerAnswered()) return
  if ((range.startsAt || '') !== startsAt.value) slotStartTime.value = ''
  startsAt.value = range.startsAt || ''
  if (startsAt.value) pickerOpen.value = false
}
function onMonthRangeUpdate(range) {
  monthStart.value = range.monthStart || ''
  monthCount.value = range.monthCount || 1
}
function pickSlot(slot) {
  definedSlotId.value = slot.id
  pickerOpen.value = false
}
function onGuestInput() {
  guestInput.value = guestInput.value.replace(/\D/g, '').slice(0, 4)
}
function stepGuests(delta) {
  guestInput.value = String(Math.min(Math.max(guestCount.value + delta, minGuests.value), maxGuests.value ?? Infinity))
}
async function revealGuestError() {
  guestTouched.value = true
  guestsOpen.value = true
  await nextTick()
  guestInputEl.value?.focus()
}

function overlapsBlocked(from, to) {
  const start = from.getTime()
  const end = to.getTime()
  return blocked.value.some((b) => new Date(b.startsAt).getTime() < end && new Date(b.endsAt).getTime() > start)
}

// T127: the request page's own choice (utils/bookingRequestForm.js): starts on
// the hour where the shortest term fits before closing, lengths from the
// minimum up to closing or the next taken term, in Belgrade time.
const hourStarts = computed(() =>
  isWorkingHours.value ? getHourStarts(props.listing, props.availability, startsAt.value) : [],
)
const hourLengths = computed(() =>
  isWorkingHours.value ? getHourLengths(props.listing, props.availability, startsAt.value, slotStartTime.value) : [],
)
watch(hourStarts, (times) => {
  if (slotStartTime.value && !times.includes(slotStartTime.value)) slotStartTime.value = ''
})
watch(hourLengths, (lengths) => {
  slotDurationHours.value = keepHourLength(lengths, slotDurationHours.value)
})
// "2 sata"
function hoursText(hours) {
  return formatUnits(t, {}, 'HOUR', hours)
}

const selectedSlot = computed(() => slots.value.find((s) => s.id === definedSlotId.value) || null)

// 'sr-RS' alone resolves to Cyrillic — the platform is Latin throughout.
const dateFormatter = new Intl.DateTimeFormat('sr-Latn-RS', { day: 'numeric', month: 'short', year: 'numeric' })
function formatShortDate(value) {
  return value ? dateFormatter.format(new Date(`${value}T00:00:00`)) : ''
}
function formatDateTime(value) {
  return new Date(value).toLocaleString('sr-Latn-RS', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
function formatPrice(value) {
  return `${new Intl.NumberFormat('sr-RS').format(Math.round(value || 0))} RSD`
}

const startLabel = computed(() => formatShortDate(startsAt.value))
const endLabel = computed(() => formatShortDate(endsAt.value))
const slotLabel = computed(() =>
  selectedSlot.value ? `${formatDateTime(selectedSlot.value.startsAt)} — ${formatDateTime(selectedSlot.value.endsAt)}` : '',
)
const guestLabel = computed(
  () => `${guestCount.value} ${t(`booking.guestNoun${srPluralCategory(guestCount.value)}`)}`,
)

const guestCapCaption = computed(() =>
  maxGuests.value
    ? t('booking.guestCapCaption', { guests: formatBookingGuests(t, props.listing.guestUnit, maxGuests.value) })
    : t('booking.guestsLabel'),
)

const unitSuffix = computed(() =>
  props.listing.priceUnit === 'GUEST'
    ? t('listing.pricePerGuestSuffix')
    : `/ ${t(`listing.unit${props.listing.priceUnit.charAt(0)}${props.listing.priceUnit.slice(1).toLowerCase()}`)}`,
)
const headPrice = computed(() => formatListingPrice(props.listing, t))

// T127: "2 sata × 1.200 RSD (cena za deo radnog vremena)", the request page's lines.
const priceRows = computed(() => buildCardPriceRows(t, props.listing, quote.value))

// The exact shape /bookings/quote expects, built the same way the request page
// builds it so the number shown here is the number that page will show too.
function buildQuotePayload() {
  const base = { guestCount: quoteGuests.value }
  if (definedSlotId.value) return { ...base, definedSlotId: definedSlotId.value }
  if (isMonthly.value) {
    if (!monthStart.value) return null
    return { ...base, monthStart: monthStart.value, monthCount: monthCount.value }
  }
  if (isWorkingHours.value) {
    if (!startsAt.value || !slotStartTime.value) return null
    // T127: Belgrade wall-clock time, as the request page and the server read it.
    const from = belgradeInstant(startsAt.value, slotStartTime.value)
    return {
      ...base,
      startsAt: from.toISOString(),
      endsAt: new Date(from.getTime() + slotDurationHours.value * 3600_000).toISOString(),
    }
  }
  if (!startsAt.value || !endsAt.value) return null
  return {
    ...base,
    startsAt: new Date(`${startsAt.value}T00:00:00.000Z`).toISOString(),
    endsAt: new Date(`${endsAt.value}T00:00:00.000Z`).toISOString(),
  }
}

const quote = ref(null)
let quoteRequest = 0
async function refreshQuote() {
  const payload = buildQuotePayload()
  const request = ++quoteRequest
  if (!payload) {
    quote.value = null
    return
  }
  const result = await api.post(`/listings/${props.listing.id}/bookings/quote`, payload).catch(() => null)
  // A slower answer for an older choice never replaces a newer one.
  if (request === quoteRequest) quote.value = result
}
watch(() => JSON.stringify(buildQuotePayload()), refreshQuote)

// R55 — Rentaj never takes a cut of a booking; the pill states that outright
// rather than leaving a guest to wonder, and still reads the real figure the
// quote returns so it can never claim zero if that ever changes.
const commission = computed(() => quote.value?.guestFee ?? 0)

// Whatever the guest picked here carries over to the request page, so they
// don't choose the same term twice.
const requestLink = computed(() => {
  const query = new URLSearchParams()
  if (definedSlotId.value) query.set('definedSlotId', definedSlotId.value)
  if (startsAt.value) query.set('startsAt', startsAt.value)
  if (endsAt.value) query.set('endsAt', endsAt.value)
  if (monthStart.value) query.set('monthStart', monthStart.value)
  if (monthCount.value > 1) query.set('monthCount', String(monthCount.value))
  if (slotStartTime.value) query.set('startTime', slotStartTime.value)
  if (isWorkingHours.value) query.set('hours', String(slotDurationHours.value))
  if (showGuests.value) query.set('guests', String(guestCount.value))
  return `/oglasi/${props.listing.slug}/rezervisi?${query.toString()}`
})
</script>

<style lang="scss" scoped>
.booking-panel {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 24px;
  background: $color-surface;
  border: 1px solid $color-border;
  border-radius: $radius-card;
  box-shadow: 0 6px 18px rgba(97, 115, 133, 0.08);
}

.booking-panel-price {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.booking-panel-price-main {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.booking-panel-amount {
  font-size: 26px;
  font-weight: 500;
  color: $color-text;
}

.booking-panel-unit {
  font-size: 16px;
  color: $color-text-muted;
}

.booking-panel-rating {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 500;
  color: $color-text;
}

.booking-panel-star {
  width: 14px;
  height: 14px;
}

.booking-panel-fields {
  display: flex;
  gap: 10px;
}

.booking-panel-field {
  position: relative;
  flex: 1 0 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 5px;
  padding: 12px 16px;
  background: $color-background;
  border: 0;
  border-radius: $radius-input;
  text-align: left;
  cursor: pointer;
}

.booking-panel-field-full {
  width: 100%;
  flex: none;
}

.booking-panel-field-label {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  color: $color-text;
}

.booking-panel-field-value {
  font-size: 15px;
  color: $color-text;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

// T127: a field that still waits for a choice reads as one.
.booking-panel-field-value.is-empty {
  color: $color-text-muted;
}

// T125: Dizajn 6's field with an error (214:429), as on the request page.
.booking-panel-field.is-invalid {
  background: #fcd8e0;
  box-shadow: inset 0 0 0 1.5px #f43f5e;
}

// T127: a half-width field keeps its value clear of the chevron on a narrow phone.
.booking-panel-field:has(.booking-panel-field-chevron) {
  padding-right: 40px;
}

.booking-panel-field-chevron {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 16px;
}

// The native <select> stays the real control (keyboard, mobile pickers) but is
// laid over the styled field rather than replacing it.
.booking-panel-native-select {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

.booking-panel-native-select:disabled {
  cursor: default;
}

// The select is invisible, so its keyboard focus shows on the field.
.booking-panel-field-select:has(.booking-panel-native-select:focus-visible) {
  box-shadow: inset 0 0 0 1.5px $color-primary;
}

.booking-panel-guests-wrap {
  position: relative;
}

// Figma shows the guests field with a chevron, i.e. a control that opens
// something — this is that something, rather than a chevron that does nothing.
.booking-panel-guests-popover {
  position: absolute;
  z-index: $z-dropdown;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px;
  background: $color-surface;
  border: 1px solid $color-border;
  border-radius: $radius-input;
  box-shadow: 0 6px 18px rgba(97, 115, 133, 0.08);
}

.booking-panel-guests-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.booking-panel-guests-caption {
  font-size: 14px;
  color: $color-text-muted;
}

.booking-panel-stepper {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
}

// T125: the number can be typed too (a hall's 150 guests), 16px so a phone
// doesn't zoom in on it.
.booking-panel-stepper-input {
  width: 56px;
  height: 32px;
  margin: 0;
  padding: 0 6px;
  border: 0;
  border-radius: 8px;
  outline: none;
  background: $color-background;
  color: $color-text;
  font-family: $font-family-base;
  font-size: 16px;
  font-weight: 500;
  text-align: center;
}

.booking-panel-stepper-input:focus {
  box-shadow: inset 0 0 0 1.5px $color-primary;
}

.booking-panel-stepper.is-invalid .booking-panel-stepper-input {
  background: #fcd8e0;
  box-shadow: inset 0 0 0 1.5px #f43f5e;
}

// Dizajn 6 (214:438): the error under the field.
.booking-panel-guests-error {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0;
  font-size: 13px;
  line-height: normal;
  color: $color-error;
}

.booking-panel-guests-error img {
  flex-shrink: 0;
  width: 15px;
  height: 15px;
}

.booking-panel-stepper-btn {
  width: 28px;
  height: 28px;
  border: 1px solid $color-border;
  border-radius: $radius-pill;
  background: $color-surface;
  color: $color-text;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}

.booking-panel-stepper-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.booking-panel-picker {
  padding: 16px;
  background: $color-background;
  border-radius: $radius-input;
}

.booking-panel-slot-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 280px;
  overflow-y: auto;
}

.booking-panel-slot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  background: $color-surface;
  border: 1px solid $color-border;
  border-radius: $radius-input;
  font-size: $font-size-body;
  color: $color-text;
  cursor: pointer;
}

.booking-panel-slot-active {
  border-color: $color-primary;
  background: $color-accent-tint;
}

.booking-panel-slot-price {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  font-weight: 500;
  white-space: nowrap;
}

// T138: under the price, so the term keeps its one line.
.booking-panel-slot-unit {
  font-size: 12px;
  font-weight: 400;
  color: $color-text-muted;
}

.booking-panel-hint {
  font-size: $font-size-body;
  color: $color-text-muted;
}

.booking-panel-hours-hint {
  margin: 0;
}

.booking-panel-divider {
  height: 1px;
  background: $color-border;
}

.booking-panel-breakdown {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.booking-panel-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 15px;
}

.booking-panel-row-label {
  color: $color-text-muted;
}

// T127: "(cena za deo radnog vremena)" under its line.
.booking-panel-row-note {
  display: block;
  margin-top: 2px;
  font-size: 13px;
}

.booking-panel-row-value {
  color: $color-text;
  white-space: nowrap;
}

.booking-panel-row-divider {
  height: 1px;
  background: $color-border;
}

.booking-panel-total {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-weight: 500;
  color: $color-text;
}

.booking-panel-total-label {
  font-size: 16px;
}

.booking-panel-total-value {
  font-size: 20px;
  white-space: nowrap;
}

.booking-panel-commission-pill {
  display: inline-flex;
  padding: 6px 14px;
  border-radius: $radius-pill;
  background: $color-accent-tint;
  color: $color-primary;
  font-size: 14px;
  font-weight: 500;
}

.booking-panel-cta {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 54px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: linear-gradient(90deg, $color-gradient-start 0%, $color-gradient-mid 55%, $color-gradient-end 100%);
  color: $color-surface;
  font-family: $font-family-base;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
}

.booking-panel-cta-inert {
  opacity: 0.55;
  cursor: default;
  pointer-events: none;
}

.booking-panel-note {
  font-size: 13px;
  line-height: 19px;
  color: $color-text-muted;
  text-align: center;
}

.booking-panel-note-left {
  text-align: left;
}

.booking-panel-secondary {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 48px;
  border-radius: 8px;
  background: $color-background;
  color: $color-text;
  font-size: 14px;
  font-weight: 500;
}
</style>
