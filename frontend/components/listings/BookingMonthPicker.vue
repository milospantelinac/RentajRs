<template>
  <div class="month-picker">
    <div class="form-group mb-3">
      <label class="form-label">{{ t('booking.monthStart') }}</label>
      <select v-model="selectedMonth" class="form-control form-select">
        <option v-for="m in availableMonths" :key="m.key" :value="m.key" :disabled="m.blocked">
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
})

const emit = defineEmits(['update:range'])

const { t } = useI18n()
const api = useApi()

const blocks = ref([])
const overrides = ref(new Map())
const selectedMonth = ref('')
const monthCount = ref(1)

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
    return {
      key,
      label: date.toLocaleDateString(t('listing.calendarLocale'), { month: 'long', year: 'numeric' }),
      blocked,
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

watch([selectedMonth, monthCount], () => {
  const valid = selectedMonth.value && !spanBlocked.value && !durationViolation.value
  emit('update:range', { monthStart: valid ? selectedMonth.value : null, monthCount: monthCount.value })
})

onMounted(loadAvailability)
</script>

<style lang="scss" scoped>
.month-picker {
  border: 1px solid $color-border;
  border-radius: 14px;
  padding: 16px;
}
</style>
