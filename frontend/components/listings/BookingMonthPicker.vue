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
            <option v-for="m in availableMonths" :key="m.key" :value="m.key" :disabled="m.blocked || m.outsideRules">
              {{ m.blocked ? t('bookingForm.monthTaken', { month: m.label }) : m.label }}
            </option>
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
    <p v-if="selectedMonth && spanBlocked" class="month-request-error" role="alert">
      <img src="/images/icons/field-error.svg" alt="" />{{ t('bookingForm.monthRangeBlocked') }}
    </p>
  </div>

  <div v-else class="month-picker">
    <div class="form-group mb-3">
      <label class="form-label">{{ t('booking.monthStart') }}</label>
      <select v-model="selectedMonth" class="form-control form-select">
        <option v-for="m in availableMonths" :key="m.key" :value="m.key" :disabled="m.blocked || m.outsideRules">
          {{ m.label }}{{ m.blocked ? ` (${t('listing.calendarBlocked')})` : m.price ? ` — ${formatPrice(m.price)} RSD` : '' }}
        </option>
      </select>
    </div>
    <div class="form-group mb-3">
      <label class="form-label">{{ t('booking.monthCount') }}</label>
      <input v-model.number="monthCount" type="number" :min="minDuration || 1" :max="maxDuration || 24" class="form-control" />
    </div>
    <p v-if="selectedMonth" class="text-muted">
      {{ t('booking.monthRangeSummary', { start: startLabel, end: endLabel }) }}
    </p>
    <p v-if="selectedMonth && spanBlocked" class="form-error mb-0">{{ t('booking.monthRangeBlocked') }}</p>
    <p v-else-if="selectedMonth && durationViolation" class="form-error mb-0">{{ durationViolationMessage }}</p>
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
  // Dizajn 23: the server holds a month's first instant to the notice and the horizon.
  earliestBookingHours: { type: Number, default: null },
  maxAdvanceBookingDays: { type: Number, default: null },
  // Dizajn 40: 'request' draws the request page's two fields; the listing
  // page's booking card keeps the default.
  variant: { type: String, default: 'default' },
  // Dizajn 40: the choice the listing page's card handed over ("2026-10", 3).
  initialMonth: { type: String, default: '' },
  initialCount: { type: Number, default: 1 },
})

// `select` tells the request page a month is picked but runs into a taken one,
// which the picker explains itself.
const emit = defineEmits(['update:range', 'select'])

const { t } = useI18n()
const api = useApi()
const isRequest = computed(() => props.variant === 'request')
const fieldId = useId()

const blocks = ref([])
const overrides = ref(new Map())
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
if (isRequest.value && !countOptions.value.some((option) => option.value === monthCount.value)) {
  monthCount.value = countOptions.value[0].value
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

const availableMonths = computed(() => {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  return Array.from({ length: 18 }, (_, i) => {
    const date = new Date(start.getFullYear(), start.getMonth() + i, 1)
    const nextMonth = new Date(start.getFullYear(), start.getMonth() + i + 1, 1)
    const key = monthKey(date)
    const blocked = blocks.value.some(
      (b) => new Date(b.startsAt).getTime() < monthStartUTC(nextMonth) && new Date(b.endsAt).getTime() > monthStartUTC(date),
    )
    const firstInstant = monthStartUTC(date)
    const outsideRules =
      (!!props.earliestBookingHours && firstInstant < now.getTime() + props.earliestBookingHours * 3600_000) ||
      (!!props.maxAdvanceBookingDays && firstInstant > now.getTime() + props.maxAdvanceBookingDays * 86_400_000)
    return {
      key,
      label: date.toLocaleDateString(t('listing.calendarLocale'), { month: 'long', year: 'numeric' }),
      blocked,
      outsideRules,
      price: overrides.value.get(key),
    }
  })
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
const durationViolationMessage = computed(() => {
  if (durationViolation.value === 'min') {
    return t('booking.minDurationMessage', { min: props.minDuration, unit: srDurationUnitWord('MONTH', props.minDuration) })
  }
  if (durationViolation.value === 'max') {
    return t('booking.maxDurationMessage', { max: props.maxDuration, unit: srDurationUnitWord('MONTH', props.maxDuration) })
  }
  return ''
})

const startLabel = computed(() => availableMonths.value.find((m) => m.key === selectedMonth.value)?.label || '')
const endLabel = computed(() => {
  if (!selectedMonth.value) return ''
  const [y, m] = selectedMonth.value.split('-').map(Number)
  const end = new Date(y, m - 1 + monthCount.value - 1, 1)
  return end.toLocaleDateString(t('listing.calendarLocale'), { month: 'long', year: 'numeric' })
})

function formatPrice(v) {
  return new Intl.NumberFormat('sr-Latn-RS').format(v)
}

async function loadAvailability() {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
  const to = new Date(now.getFullYear(), now.getMonth() + 19, 1)
  const data = await api.get(`/listings/${props.listingId}/availability`, {
    query: { from: from.toISOString(), to: to.toISOString() },
  })
  blocks.value = data.blocked || []
  overrides.value = new Map(
    (data.datePriceOverrides || []).map((o) => {
      const d = new Date(o.date)
      return [monthKey(d), o.price]
    }),
  )
}

// Dizajn 40: a month handed over by the listing page counts once the blocked
// months are known, so the request page's first quote uses it.
watch([selectedMonth, monthCount, blocks], () => {
  const valid = selectedMonth.value && !spanBlocked.value && !durationViolation.value
  emit('update:range', { monthStart: valid ? selectedMonth.value : null, monthCount: monthCount.value })
  emit('select', { monthStart: selectedMonth.value || null, blocked: !!selectedMonth.value && spanBlocked.value })
})

onMounted(loadAvailability)
</script>

<style lang="scss" scoped>
.month-picker {
  border: 1px solid $color-border;
  border-radius: 14px;
  padding: 16px;
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
