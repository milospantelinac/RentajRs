<template>
  <!-- Dizajn 40 has no frame for a monthly stay; the request page builds it
       from the frame's own fields (375:417), side by side like 375:406. -->
  <div v-if="isRequest" class="month-request">
    <div class="month-request-row">
      <div class="month-request-field">
        <label class="month-request-label" :for="`${fieldId}-start`">{{ t('booking.monthStart') }}</label>
        <span class="month-request-select" :class="{ 'is-empty': !selectedMonth }">
          <select :id="`${fieldId}-start`" v-model="selectedMonth" class="month-request-control">
            <option value="" disabled>{{ t('bookingForm.monthPlaceholder') }}</option>
            <option v-for="m in availableMonths" :key="m.key" :value="m.key" :disabled="!m.free">{{ m.text }}</option>
          </select>
          <img src="/images/icons/chevron-down-18.svg" alt="" />
        </span>
      </div>
      <div class="month-request-field">
        <label class="month-request-label" :for="`${fieldId}-count`">{{ t('booking.monthCount') }}</label>
        <span class="month-request-select">
          <select :id="`${fieldId}-count`" v-model.number="monthCount" class="month-request-control">
            <option v-for="option in countOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
          <img src="/images/icons/chevron-down-18.svg" alt="" />
        </span>
      </div>
    </div>
    <p v-if="noneFreeMessage" class="month-request-error" role="alert">
      <img src="/images/icons/field-error.svg" alt="" />{{ noneFreeMessage }}
    </p>
    <p v-else-if="selectedMonth && spanBlocked" class="month-request-error" role="alert">
      <img src="/images/icons/field-error.svg" alt="" />{{ t('bookingForm.monthRangeBlocked') }}
    </p>
  </div>

  <!-- T128: the listing's booking card. Two fields like its Datum and Vreme:
       the start month as a real select that shows what was picked, and the
       count with its unit and the guests' -/+ buttons. -->
  <div v-else class="month-card">
    <div class="month-card-fields">
      <label class="month-card-field month-card-field-select">
        <span class="month-card-label">{{ t('booking.monthStart') }}</span>
        <select v-model="selectedMonth" class="month-card-native">
          <option value="" disabled>{{ t('booking.pickMonthPlaceholder') }}</option>
          <option v-for="m in availableMonths" :key="m.key" :value="m.key" :disabled="!m.free">{{ m.text }}</option>
        </select>
        <span class="month-card-value" :class="{ 'is-empty': !selectedMonth }">
          {{ startLabel || t('booking.pickMonthPlaceholder') }}
        </span>
        <img src="/images/icons/chevron-down.svg" alt="" class="month-card-chevron" />
      </label>
      <div class="month-card-field" role="group" :aria-labelledby="`${fieldId}-count`">
        <span :id="`${fieldId}-count`" class="month-card-label">{{ t('booking.monthCount') }}</span>
        <span class="month-card-count">
          <span class="month-card-value">{{ countLabel }}</span>
          <span class="month-card-steps">
            <button
              type="button"
              class="month-card-step"
              :disabled="monthCount <= minCount"
              :aria-label="t('booking.monthCountDecrease')"
              @click="stepCount(-1)"
            >
              &minus;
            </button>
            <button
              type="button"
              class="month-card-step"
              :disabled="monthCount >= maxCount"
              :aria-label="t('booking.monthCountIncrease')"
              @click="stepCount(1)"
            >
              +
            </button>
          </span>
        </span>
      </div>
    </div>
    <p v-if="noneFreeMessage" class="month-card-error" role="alert">
      <img src="/images/icons/field-error.svg" alt="" />{{ noneFreeMessage }}
    </p>
    <p v-else-if="selectedMonth && spanBlocked" class="month-card-error" role="alert">
      <img src="/images/icons/field-error.svg" alt="" />{{ t('bookingForm.monthRangeBlocked') }}
    </p>
  </div>

</template>

<script setup>
// "Po mesecu" (Dodavanje Oglasa spec §3/§4) — the guest picks a starting
// month and a count of whole calendar months rather than a date range;
// months already blocked by the owner are shown but unselectable.
const props = defineProps({
  listingId: { type: String, required: true },
  basePrice: { type: Number, default: 0 },
  minDuration: { type: Number, default: null },
  maxDuration: { type: Number, default: null },
  // Dizajn 23: the server holds a month's first instant to the notice. T118: not
  // to the horizon, since a month always starts on the 1st (Tamara, 2026-10-10).
  earliestBookingHours: { type: Number, default: null },
  // Dizajn 40: 'request' draws the request page's two fields; T128: 'card'
  // the listing page's booking card's.
  variant: { type: String, default: 'card' },
  // Dizajn 40: the choice the listing page's card handed over ("2026-10", 3).
  initialMonth: { type: String, default: '' },
  initialCount: { type: Number, default: 1 },
})

// `select` tells the page a month is picked but runs into a taken one, or that
// no month is free at all (T118), which the picker explains itself.
const emit = defineEmits(['update:range', 'select'])

const { t } = useI18n()
const api = useApi()
const isRequest = computed(() => props.variant === 'request')
const fieldId = useId()

const blocks = ref([])
const selectedMonth = ref(props.initialMonth || '')
const monthCount = ref(props.initialCount || 1)

// Whole months from the minimum to the maximum (24 without one), the count
// select of the request page.
const countOptions = computed(() => {
  const min = props.minDuration || 1
  const max = Math.max(min, props.maxDuration || 24)
  return Array.from({ length: max - min + 1 }, (_, index) => {
    const count = min + index
    return { value: count, label: t(`bookingRequests.units.MONTH${srPluralCategory(count)}`, { count }) }
  })
})
if (!countOptions.value.some((option) => option.value === monthCount.value)) {
  monthCount.value = countOptions.value[0].value
}

// T128: the card steps the count within the same bounds, "1 mesec", "2 meseca".
const minCount = computed(() => countOptions.value[0].value)
const maxCount = computed(() => countOptions.value[countOptions.value.length - 1].value)
const countLabel = computed(() =>
  t(`bookingRequests.units.MONTH${srPluralCategory(monthCount.value)}`, { count: monthCount.value }),
)
function stepCount(delta) {
  monthCount.value = Math.min(Math.max(monthCount.value + delta, minCount.value), maxCount.value)
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

// T88 — BlockedTerm boundaries are UTC instants; `date`/`nextMonth` below are
// LOCAL-midnight JS Dates, so comparing them directly shifted month
// boundaries by the local UTC offset and made the month right after a
// booking's end look blocked too. Re-anchor to UTC midnight of the same
// calendar month before comparing (see the identical fix in
// BookingDateRangePicker.vue's isBlocked()).
function monthStartUTC(date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), 1)
}

// T118: the months ahead, from the next one, since the current one has begun
// and the server takes no month after its 1st (Tamara, 2026-10-10).
const MONTHS_SHOWN = 18

const availableMonths = computed(() => {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return Array.from({ length: MONTHS_SHOWN }, (_, i) => {
    const date = new Date(start.getFullYear(), start.getMonth() + i, 1)
    const nextMonth = new Date(start.getFullYear(), start.getMonth() + i + 1, 1)
    const key = monthKey(date)
    const blocked = blocks.value.some(
      (b) => new Date(b.startsAt).getTime() < monthStartUTC(nextMonth) && new Date(b.endsAt).getTime() > monthStartUTC(date),
    )
    // Inside the owner's time to get ready ("Najkasnije se može rezervisati").
    const tooSoon = !!props.earliestBookingHours && monthStartUTC(date) < now.getTime() + props.earliestBookingHours * 3600_000
    const label = date.toLocaleDateString(t('listing.calendarLocale'), { month: 'long', year: 'numeric' })
    let text = label
    if (blocked) text = t('bookingForm.monthTaken', { month: label })
    else if (tooSoon) text = t('bookingForm.monthTooSoon', { month: label })
    return { key, label, text, blocked, tooSoon, free: !blocked && !tooSoon }
  })
})

// "30 dana", or the hours of a notice that isn't whole days.
const noticeText = computed(() => {
  const hours = props.earliestBookingHours || 0
  return hours % 24 === 0
    ? t(`listing.termDays${srPluralCategory(hours / 24)}`, { count: hours / 24 })
    : t(`listing.termHours${srPluralCategory(hours)}`, { count: hours })
})

// T118: when no month can be picked, the reason, instead of a list that won't open.
const noneFreeMessage = computed(() => {
  const months = availableMonths.value
  if (months.some((m) => m.free)) return ''
  const tooSoon = months.some((m) => m.tooSoon)
  if (tooSoon && months.some((m) => m.blocked)) return t('bookingForm.noMonthNoticeAndTaken', { notice: noticeText.value })
  if (tooSoon) return t('bookingForm.noMonthNotice', { notice: noticeText.value })
  return t('bookingForm.noMonthAllTaken', { count: MONTHS_SHOWN })
})

// T86 — the start month being free doesn't mean the whole span is: a longer
// monthCount can still run into a later blocked month, which previously went
// through with no warning at all.
const spanBlocked = computed(() => {
  if (!selectedMonth.value) return false
  const [y, m] = selectedMonth.value.split('-').map(Number)
  for (let i = 0; i < monthCount.value; i++) {
    const date = new Date(y, m - 1 + i, 1)
    const nextMonth = new Date(y, m - 1 + i + 1, 1)
    if (blocks.value.some((b) => new Date(b.startsAt).getTime() < monthStartUTC(nextMonth) && new Date(b.endsAt).getTime() > monthStartUTC(date))) return true
  }
  return false
})

const durationViolation = computed(() => {
  if (props.minDuration && monthCount.value < props.minDuration) return 'min'
  if (props.maxDuration && monthCount.value > props.maxDuration) return 'max'
  return null
})

const startLabel = computed(() => availableMonths.value.find((m) => m.key === selectedMonth.value)?.label || '')

async function loadAvailability() {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const to = new Date(now.getFullYear(), now.getMonth() + 1 + MONTHS_SHOWN, 1)
  const data = await api.get(`/listings/${props.listingId}/availability`, {
    query: { from: from.toISOString(), to: to.toISOString() },
  })
  blocks.value = data.blocked || []
}

// T118: a month handed over that has begun or falls inside the notice can't be
// asked for, so it isn't kept (a taken one stays, with its message).
watch(
  () => availableMonths.value.find((m) => m.key === selectedMonth.value) || null,
  (picked) => {
    if (selectedMonth.value && (!picked || picked.tooSoon)) selectedMonth.value = ''
  },
  { immediate: true },
)

// Dizajn 40: a month handed over by the listing page counts once the blocked
// months are known, so the request page's first quote uses it.
watch([selectedMonth, monthCount, blocks], () => {
  const valid = selectedMonth.value && !spanBlocked.value && !durationViolation.value
  emit('update:range', { monthStart: valid ? selectedMonth.value : null, monthCount: monthCount.value })
  emit('select', {
    monthStart: selectedMonth.value || null,
    blocked: !!selectedMonth.value && spanBlocked.value,
    noneFree: !!noneFreeMessage.value,
  })
})

onMounted(loadAvailability)
</script>

<style lang="scss" scoped>
// T128: ListingBookingPanel's own field look (.booking-panel-field): grey,
// rounded, the small capital label over the value. One under the other, so
// "12 meseci" and both buttons fit on a phone too.
.month-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.month-card-fields {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.month-card-field {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 5px;
  margin: 0;
  padding: 12px 16px;
  background: $color-background;
  border-radius: $radius-input;
}

.month-card-field-select {
  padding-right: 44px;
  cursor: pointer;
}

.month-card-field-select:has(.month-card-native:focus-visible) {
  box-shadow: inset 0 0 0 1.5px $color-primary;
}

.month-card-label {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  color: $color-text;
}

.month-card-value {
  max-width: 100%;
  overflow: hidden;
  font-size: 15px;
  color: $color-text;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.month-card-value.is-empty {
  color: $color-text-muted;
}

// The real select lies over the field (keyboard, a phone's own picker). Without
// its native look it takes the field's whole height (Safari keeps a native
// select at its own height), so a click anywhere opens it; 16px keeps iOS from
// zooming in on it.
.month-card-native {
  position: absolute;
  z-index: 1;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  font-size: 16px;
  appearance: none;
  cursor: pointer;
}

// The chevron is drawn on top; clicks go through it to the select (T127).
.month-card-chevron {
  position: absolute;
  top: 50%;
  right: 16px;
  width: 16px;
  height: 16px;
  transform: translateY(-50%);
  pointer-events: none;
}

.month-card-count {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}

// The guests' stepper buttons (.booking-panel-stepper-btn).
.month-card-steps {
  display: inline-flex;
  flex-shrink: 0;
  gap: 8px;
}

.month-card-step {
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid $color-border;
  border-radius: $radius-pill;
  background: $color-surface;
  color: $color-text;
  font-family: $font-family-base;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}

.month-card-step:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.month-card-error {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0;
  font-size: 13px;
  line-height: normal;
  color: $color-error;
}

.month-card-error img {
  flex-shrink: 0;
  width: 15px;
  height: 15px;
}

// Dizajn 40, the fields of 375:406: two columns 20 apart, label Medium 14 10
// above a 49 tall grey select (375:419) with the 18px chevron.
.month-request {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.month-request-row {
  display: flex;
  gap: 20px;
}

.month-request-field {
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.month-request-label {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  line-height: normal;
  color: $color-text;
}

.month-request-select {
  position: relative;
  display: block;
}

.month-request-control {
  width: 100%;
  height: 49px;
  margin: 0;
  padding: 0 44px 0 18px;
  border: 0;
  border-radius: $radius-input;
  outline: none;
  background: $color-background;
  color: $color-text;
  font-family: $font-family-base;
  font-size: 15px;
  font-weight: 400;
  line-height: normal;
  appearance: none;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    box-shadow 0.15s ease;
}

.month-request-control:focus-visible {
  background: $color-surface;
  box-shadow: inset 0 0 0 1.5px $color-primary;
}

.month-request-select.is-empty .month-request-control {
  color: $color-text-muted;
}

.month-request-select img {
  position: absolute;
  top: 50%;
  right: 16px;
  width: 18px;
  height: 18px;
  transform: translateY(-50%);
  pointer-events: none;
}

// Dizajn 6 (214:438)
.month-request-error {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0;
  font-size: 13px;
  font-weight: 400;
  line-height: normal;
  color: $color-error;
}

.month-request-error img {
  flex-shrink: 0;
  width: 15px;
  height: 15px;
}

@include respond-below(md) {
  .month-request-row {
    flex-direction: column;
    gap: 16px;
  }
}
</style>
