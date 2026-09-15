<template>
  <div class="booking-panel">
    <div class="booking-panel-price">
      <p class="booking-panel-price-main">
        <span class="booking-panel-amount">{{ formatPrice(listing.price) }}</span>
        <span class="booking-panel-unit">{{ unitSuffix }}</span>
      </p>
      <span v-if="showRating" class="booking-panel-rating">
        <img src="/images/icons/star-solid.svg" alt="" class="booking-panel-star" />
        {{ Number(listing.avgRating).toFixed(2) }}
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

      <div v-else-if="isMonthly" class="booking-panel-fields">
        <button type="button" class="booking-panel-field booking-panel-field-full" @click="togglePicker">
          <span class="booking-panel-field-label">{{ t('booking.monthLabel') }}</span>
          <span class="booking-panel-field-value">{{ monthLabel || t('booking.pickMonthPlaceholder') }}</span>
          <img src="/images/icons/chevron-down.svg" alt="" class="booking-panel-field-chevron" />
        </button>
      </div>

      <div v-else-if="isWorkingHours" class="booking-panel-fields">
        <button type="button" class="booking-panel-field" @click="togglePicker">
          <span class="booking-panel-field-label">{{ t('booking.dateLabel') }}</span>
          <span class="booking-panel-field-value">{{ startLabel || t('booking.pickDatePlaceholder') }}</span>
        </button>
        <label class="booking-panel-field booking-panel-field-select">
          <span class="booking-panel-field-label">{{ t('booking.timeLabel') }}</span>
          <select v-model="slotStartTime" class="booking-panel-native-select">
            <option value="" disabled>{{ t('booking.pickTimePlaceholder') }}</option>
            <option v-for="time in dayTimeOptions" :key="time" :value="time">{{ time }}</option>
          </select>
          <span class="booking-panel-field-value">{{ slotStartTime || t('booking.pickTimePlaceholder') }}</span>
          <img src="/images/icons/chevron-down.svg" alt="" class="booking-panel-field-chevron" />
        </label>
      </div>

      <div v-else class="booking-panel-fields">
        <button type="button" class="booking-panel-field" @click="togglePicker">
          <span class="booking-panel-field-label">{{ t('booking.checkInLabel') }}</span>
          <span class="booking-panel-field-value">{{ startLabel || t('booking.pickDatePlaceholder') }}</span>
        </button>
        <button type="button" class="booking-panel-field" @click="togglePicker">
          <span class="booking-panel-field-label">{{ t('booking.checkOutLabel') }}</span>
          <span class="booking-panel-field-value">{{ endLabel || t('booking.pickDatePlaceholder') }}</span>
        </button>
      </div>

      <div v-if="pickerOpen" class="booking-panel-picker">
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
            <span class="booking-panel-slot-price">{{ formatPrice(slot.price ?? listing.price) }}</span>
          </button>
          <p v-if="!slots.length" class="booking-panel-hint">{{ t('booking.noSlots') }}</p>
        </div>

        <BookingMonthPicker
          v-else-if="isMonthly"
          :listing-id="listing.id"
          :base-price="listing.price"
          :min-duration="listing.minDuration"
          :max-duration="listing.maxDuration"
          :earliest-booking-hours="listing.earliestBookingHours"
          :max-advance-booking-days="listing.maxAdvanceBookingDays"
          @update:range="onMonthRangeUpdate"
        />

        <BookingDateRangePicker
          v-else-if="isWorkingHours"
          :listing-id="listing.id"
          :show-pricing="false"
          :earliest-booking-hours="listing.earliestBookingHours"
          :max-advance-booking-days="listing.maxAdvanceBookingDays"
          :available-days-of-week="availableDaysOfWeek"
          :whole-day-blocking="false"
          :single-date="true"
          @update:range="onSingleDateUpdate"
        />

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
          @update:range="onRangeUpdate"
        />
      </div>

      <div class="booking-panel-guests-wrap">
        <button
          type="button"
          class="booking-panel-field booking-panel-field-full"
          :aria-expanded="guestsOpen"
          @click="guestsOpen = !guestsOpen"
        >
          <span class="booking-panel-field-label">{{ t('booking.guestsLabel') }}</span>
          <span class="booking-panel-field-value">{{ guestLabel }}</span>
          <img src="/images/icons/chevron-down.svg" alt="" class="booking-panel-field-chevron" />
        </button>

        <div v-if="guestsOpen" class="booking-panel-guests-popover">
          <span class="booking-panel-guests-caption">{{ guestCapCaption }}</span>
          <span class="booking-panel-stepper">
            <button
              type="button"
              class="booking-panel-stepper-btn"
              :disabled="guestCount <= minGuests"
              :aria-label="t('booking.guestCountDecrease')"
              @click="stepGuests(-1)"
            >
              &minus;
            </button>
            <span class="booking-panel-stepper-value">{{ guestCount }}</span>
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
      </div>

      <template v-if="quote">
        <div class="booking-panel-divider" />
        <div class="booking-panel-breakdown">
          <div class="booking-panel-row">
            <span class="booking-panel-row-label">{{ unitLineLabel }}</span>
            <span class="booking-panel-row-value">{{ formatPrice(quote.unitPriceTotal) }}</span>
          </div>
          <div v-if="quote.guestFee > 0" class="booking-panel-row">
            <span class="booking-panel-row-label">{{ t('booking.guestFeeLine') }}</span>
            <span class="booking-panel-row-value">{{ formatPrice(quote.guestFee) }}</span>
          </div>
          <div v-if="quote.mandatoryFeesTotal > 0" class="booking-panel-row">
            <span class="booking-panel-row-label">{{ t('booking.mandatoryFeesLine') }}</span>
            <span class="booking-panel-row-value">{{ formatPrice(quote.mandatoryFeesTotal) }}</span>
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
// R102 — an average is only meaningful (and only shown) from three reviews on.
const showRating = computed(() => Number(props.listing.reviewCount) >= 3 && props.listing.avgRating != null)
const isDefinedSlots = computed(
  () => props.listing.bookingModel === 'PER_SLOT' && props.listing.slotSubmode === 'DEFINED_SLOTS',
)
const isMonthly = computed(() => props.listing.priceUnit === 'MONTH')
const isWorkingHours = computed(
  () => props.listing.bookingModel === 'PER_SLOT' && props.listing.slotSubmode === 'WORKING_HOURS',
)

const pickerOpen = ref(false)
const guestsOpen = ref(false)
const startsAt = ref('')
const endsAt = ref('')
const monthStart = ref('')
const monthCount = ref(1)
const definedSlotId = ref(null)
const slotStartTime = ref('')
// Dizajn 23: the card has no length field, so it prices the shortest term allowed.
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
const guestCount = ref(1)

onMounted(() => {
  guestCount.value = minGuests.value
})

const availableDaysOfWeek = computed(() =>
  workingHours.value.length ? [...new Set(workingHours.value.map((h) => h.dayOfWeek))] : null,
)

function togglePicker() {
  pickerOpen.value = !pickerOpen.value
}

function onRangeUpdate(range) {
  startsAt.value = range.startsAt || ''
  endsAt.value = range.endsAt || ''
  if (startsAt.value && endsAt.value) pickerOpen.value = false
}
function onSingleDateUpdate(range) {
  startsAt.value = range.startsAt || ''
  slotStartTime.value = ''
  if (startsAt.value) pickerOpen.value = false
}
function onMonthRangeUpdate(range) {
  monthStart.value = range.monthStart || ''
  monthCount.value = range.monthCount || 1
  if (monthStart.value) pickerOpen.value = false
}
function pickSlot(slot) {
  definedSlotId.value = slot.id
  pickerOpen.value = false
}
function stepGuests(delta) {
  const next = guestCount.value + delta
  if (next < minGuests.value) return
  if (maxGuests.value !== null && next > maxGuests.value) return
  guestCount.value = next
}

function slotInstant(dateStr, timeStr) {
  return new Date(`${dateStr}T${timeStr}:00`)
}
function overlapsBlocked(from, to) {
  const start = from.getTime()
  const end = to.getTime()
  return blocked.value.some((b) => new Date(b.startsAt).getTime() < end && new Date(b.endsAt).getTime() > start)
}

// Same derivation as the request page — a start time is only offered inside the
// owner's configured working hours for that weekday, and never one whose term
// would collide with an existing booking.
const dayTimeOptions = computed(() => {
  if (!startsAt.value) return []
  const dayOfWeek = ((new Date(`${startsAt.value}T00:00:00`).getDay() + 6) % 7) + 1
  const times = []
  for (const range of workingHours.value.filter((h) => h.dayOfWeek === dayOfWeek)) {
    const [sh, sm] = range.startsAt.split(':').map(Number)
    const [eh, em] = range.endsAt.split(':').map(Number)
    const startTotal = sh * 60 + sm
    let endTotal = eh * 60 + em
    if (endTotal <= startTotal) endTotal += 24 * 60
    for (let minute = startTotal; minute < Math.min(endTotal, 24 * 60); minute += 60) {
      times.push(`${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`)
    }
  }
  // Dizajn 23: nor one inside the notice or past the horizon.
  return times.filter((time) => {
    const from = slotInstant(startsAt.value, time)
    return (
      isStartWithinRules(props.listing, from) &&
      !overlapsBlocked(from, new Date(from.getTime() + slotDurationHours.value * 3600_000))
    )
  })
})

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
const monthLabel = computed(() =>
  monthStart.value
    ? `${new Intl.DateTimeFormat('sr-Latn-RS', { month: 'long', year: 'numeric' }).format(new Date(`${monthStart.value}-01T00:00:00`))} · ${monthCount.value}`
    : '',
)
const slotLabel = computed(() =>
  selectedSlot.value ? `${formatDateTime(selectedSlot.value.startsAt)} — ${formatDateTime(selectedSlot.value.endsAt)}` : '',
)
const guestLabel = computed(
  () => `${guestCount.value} ${t(`booking.guestNoun${srPluralCategory(guestCount.value)}`)}`,
)

const guestCapCaption = computed(() =>
  maxGuests.value ? t('booking.guestCapCaption', { count: maxGuests.value }) : t('booking.guestsLabel'),
)

const unitSuffix = computed(() =>
  props.listing.priceUnit === 'GUEST'
    ? t('listing.pricePerGuestSuffix')
    : `/ ${t(`listing.unit${props.listing.priceUnit.charAt(0)}${props.listing.priceUnit.slice(1).toLowerCase()}`)}`,
)

const unitLineLabel = computed(() => {
  if (!quote.value) return ''
  return `${formatPrice(quote.value.pricePerUnit)} × ${quote.value.unitCount} ${srDurationUnitWord(props.listing.priceUnit, quote.value.unitCount)}`
})

// The exact shape /bookings/quote expects, built the same way the request page
// builds it so the number shown here is the number that page will show too.
function buildQuotePayload() {
  const base = { guestCount: guestCount.value }
  if (definedSlotId.value) return { ...base, definedSlotId: definedSlotId.value }
  if (isMonthly.value) {
    if (!monthStart.value) return null
    return { ...base, monthStart: monthStart.value, monthCount: monthCount.value }
  }
  if (isWorkingHours.value) {
    if (!startsAt.value || !slotStartTime.value) return null
    const from = slotInstant(startsAt.value, slotStartTime.value)
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
async function refreshQuote() {
  const payload = buildQuotePayload()
  if (!payload) {
    quote.value = null
    return
  }
  quote.value = await api.post(`/listings/${props.listing.id}/bookings/quote`, payload).catch(() => null)
}
watch([startsAt, endsAt, monthStart, monthCount, definedSlotId, slotStartTime, slotDurationHours, guestCount], refreshQuote)

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
  query.set('guests', String(guestCount.value))
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
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  background: $color-surface;
  border: 1px solid $color-border;
  border-radius: $radius-input;
  box-shadow: 0 6px 18px rgba(97, 115, 133, 0.08);
}

.booking-panel-guests-caption {
  font-size: 14px;
  color: $color-text-muted;
}

.booking-panel-stepper {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

.booking-panel-stepper-value {
  min-width: 16px;
  text-align: center;
  font-size: 15px;
  font-weight: 500;
  color: $color-text;
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
  font-weight: 500;
  white-space: nowrap;
}

.booking-panel-hint {
  font-size: $font-size-body;
  color: $color-text-muted;
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
  height: 54px;
  border-radius: 8px;
  background: linear-gradient(90deg, $color-gradient-start 0%, $color-gradient-mid 55%, $color-gradient-end 100%);
  color: $color-surface;
  font-size: 16px;
  font-weight: 500;
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
