<template>
  <div class="range-picker">
    <div class="range-picker-months">
      <div v-for="(m, i) in visibleMonths" :key="i" class="range-picker-month">
        <div class="range-picker-nav">
          <button v-if="i === 0" type="button" class="btn btn-tertiary btn-sm" :disabled="!canGoBack" @click="shiftMonth(-1)">←</button>
          <span v-else />
          <span class="range-picker-month-label">{{ m.label }}</span>
          <button v-if="i === visibleMonths.length - 1" type="button" class="btn btn-tertiary btn-sm" @click="shiftMonth(1)">→</button>
          <span v-else />
        </div>
        <div class="range-picker-grid">
          <span v-for="d in weekdayLabels" :key="d" class="range-picker-weekday">{{ d }}</span>
          <span v-for="n in m.leadingBlanks" :key="`b${n}`" class="range-picker-cell range-picker-cell-empty" />
          <button
            v-for="cell in m.days"
            :key="cell.key"
            type="button"
            class="range-picker-cell"
            :class="cellClasses(cell)"
            :disabled="cell.disabled"
            @click="selectDate(cell)"
          >
            <span class="range-picker-cell-day">{{ cell.day }}</span>
            <span v-if="showPricing && cell.price && !cell.disabled" class="range-picker-cell-price">{{ formatPrice(cell.price) }}</span>
          </button>
        </div>
      </div>
    </div>

    <div class="range-picker-legend">
      <span><i class="rp-legend-dot rp-legend-dot-taken"></i>{{ t('booking.rangePickerUnavailable') }}</span>
      <span><i class="rp-legend-dot rp-legend-dot-selected"></i>{{ t('booking.rangePickerSelected') }}</span>
    </div>

    <p class="range-picker-summary">
      <template v-if="rangeStart && rangeEnd">
        {{ formatDate(rangeStart) }} → {{ formatDate(rangeEnd) }} · {{ nightCount }} {{ t('booking.rangePickerNights') }}
      </template>
      <template v-else-if="rangeStart">{{ t('booking.rangePickerPickEnd') }}</template>
      <template v-else>{{ t('booking.rangePickerPickStart') }}</template>
    </p>
  </div>
</template>

<script setup>
// Airbnb/Booking-style range picker — replaces plain <input type="date">
// so a guest sees real availability (blocked/taken dates greyed out and
// unclickable) instead of guessing a date and finding out it's taken only
// after submitting the request.
const props = defineProps({
  listingId: { type: String, required: true },
  basePrice: { type: Number, default: 0 },
  weekendPrice: { type: Number, default: null },
  showPricing: { type: Boolean, default: true },
})

const emit = defineEmits(['update:range'])

const { t } = useI18n()
const api = useApi()

const today = new Date()
today.setHours(0, 0, 0, 0)
const baseMonth = ref(new Date(today.getFullYear(), today.getMonth(), 1))
const blocks = ref([])
const overrides = ref(new Map())
const rangeStart = ref(null)
const rangeEnd = ref(null)

function toKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const weekdayLabels = computed(() => t('listing.calendarWeekdays').split(','))
const canGoBack = computed(() => baseMonth.value.getFullYear() > today.getFullYear() || baseMonth.value.getMonth() > today.getMonth())

function isBlocked(date) {
  const dayStart = date.getTime()
  const dayEnd = dayStart + 86400000
  return blocks.value.some((b) => new Date(b.startsAt).getTime() < dayEnd && new Date(b.endsAt).getTime() > dayStart)
}

// A range can't be selected across a blocked date in the middle — the stay
// itself would be impossible to actually book.
function hasBlockedDateBetween(start, end) {
  for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
    if (isBlocked(d)) return true
  }
  return false
}

function buildMonth(monthDate) {
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  const count = new Date(year, month + 1, 0).getDate()
  const days = []
  for (let day = 1; day <= count; day++) {
    const date = new Date(year, month, day)
    const key = toKey(date)
    const past = date < today
    const blocked = isBlocked(date)
    const isWeekend = date.getDay() === 5 || date.getDay() === 6
    const override = overrides.value.get(key)
    days.push({
      key,
      day,
      date,
      disabled: past || blocked,
      price: override ?? (isWeekend && props.weekendPrice ? props.weekendPrice : props.basePrice),
    })
  }
  const leadingBlanks = (new Date(year, month, 1).getDay() + 6) % 7
  return {
    label: monthDate.toLocaleDateString(t('listing.calendarLocale'), { month: 'long', year: 'numeric' }),
    days,
    leadingBlanks,
  }
}

const visibleMonths = computed(() => [
  buildMonth(baseMonth.value),
  buildMonth(new Date(baseMonth.value.getFullYear(), baseMonth.value.getMonth() + 1, 1)),
])

function cellClasses(cell) {
  const inRange =
    rangeStart.value && rangeEnd.value && cell.date > rangeStart.value && cell.date < rangeEnd.value
  return {
    'range-picker-cell-taken': cell.disabled,
    'range-picker-cell-selected': (rangeStart.value && cell.key === toKey(rangeStart.value)) || (rangeEnd.value && cell.key === toKey(rangeEnd.value)),
    'range-picker-cell-in-range': inRange,
  }
}

function formatDate(d) {
  return d.toLocaleDateString(t('listing.calendarLocale'), { day: 'numeric', month: 'short' })
}
function formatPrice(v) {
  return new Intl.NumberFormat('sr-RS').format(v)
}

const nightCount = computed(() => {
  if (!rangeStart.value || !rangeEnd.value) return 0
  return Math.round((rangeEnd.value.getTime() - rangeStart.value.getTime()) / 86400000)
})

function selectDate(cell) {
  if (cell.disabled) return
  if (!rangeStart.value || (rangeStart.value && rangeEnd.value)) {
    rangeStart.value = cell.date
    rangeEnd.value = null
    return
  }
  // Picking a second date before the first flips them instead of erroring.
  if (cell.date <= rangeStart.value) {
    rangeStart.value = cell.date
    return
  }
  if (hasBlockedDateBetween(rangeStart.value, cell.date)) {
    // Can't span a blocked date — restart the selection from this date.
    rangeStart.value = cell.date
    rangeEnd.value = null
    return
  }
  rangeEnd.value = cell.date
}

watch([rangeStart, rangeEnd], () => {
  emit('update:range', {
    startsAt: rangeStart.value ? toKey(rangeStart.value) : null,
    endsAt: rangeEnd.value ? toKey(rangeEnd.value) : null,
  })
})

async function loadAvailability() {
  const from = new Date(baseMonth.value)
  const to = new Date(baseMonth.value.getFullYear(), baseMonth.value.getMonth() + 2, 1)
  const data = await api.get(`/listings/${props.listingId}/availability`, {
    query: { from: from.toISOString(), to: to.toISOString() },
  })
  blocks.value = data.blocked || []
  overrides.value = new Map((data.datePriceOverrides || []).map((o) => [toKey(new Date(o.date)), o.price]))
}

function shiftMonth(delta) {
  baseMonth.value = new Date(baseMonth.value.getFullYear(), baseMonth.value.getMonth() + delta, 1)
}

watch(baseMonth, loadAvailability, { immediate: true })
</script>

<style lang="scss" scoped>
.range-picker {
  border: 1px solid $color-border;
  border-radius: 14px;
  padding: 16px;
}

.range-picker-months {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

@include respond-above(md) {
  .range-picker-months {
    flex-direction: row;
  }

  .range-picker-month {
    flex: 1;
    min-width: 0;
  }
}

.range-picker-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.range-picker-month-label {
  font-weight: 600;
  text-transform: capitalize;
  font-size: $font-size-body;
}

.range-picker-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 3px;
}

.range-picker-weekday {
  text-align: center;
  font-size: 11px;
  color: $color-text-muted;
  padding-bottom: 4px;
}

.range-picker-cell {
  aspect-ratio: 1;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 2px;
  min-height: 40px;
}

.range-picker-cell:hover:not(:disabled) {
  border-color: $color-primary;
}

.range-picker-cell-empty {
  cursor: default;
}

.range-picker-cell-day {
  font-size: 12.5px;
}

.range-picker-cell-price {
  font-size: 9.5px;
  color: $color-text-muted;
}

.range-picker-cell-taken {
  color: $color-text-muted;
  text-decoration: line-through;
  cursor: not-allowed;
  opacity: 0.5;
}

.range-picker-cell-in-range {
  background: rgba($color-primary, 0.12);
  border-radius: 0;
}

.range-picker-cell-selected {
  background: $color-primary;
  border-color: $color-primary;
}

.range-picker-cell-selected .range-picker-cell-day,
.range-picker-cell-selected .range-picker-cell-price {
  color: $color-surface;
}

.range-picker-legend {
  display: flex;
  gap: 16px;
  margin-top: 12px;
  font-size: 12px;
  color: $color-text-muted;
}

.rp-legend-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 3px;
  margin-right: 4px;
}

.rp-legend-dot-taken {
  background: rgba(0, 0, 0, 0.15);
}

.rp-legend-dot-selected {
  background: $color-primary;
}

.range-picker-summary {
  margin: 12px 0 0;
  font-weight: 600;
  font-size: $font-size-body;
}
</style>
