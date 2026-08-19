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
      <input v-model.number="monthCount" type="number" min="1" max="24" class="form-control" />
    </div>
    <p v-if="selectedMonth" class="text-muted">
      {{ t('booking.monthRangeSummary', { start: startLabel, end: endLabel }) }}
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

const availableMonths = computed(() => {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  return Array.from({ length: 18 }, (_, i) => {
    const date = new Date(start.getFullYear(), start.getMonth() + i, 1)
    const nextMonth = new Date(start.getFullYear(), start.getMonth() + i + 1, 1)
    const key = monthKey(date)
    const blocked = blocks.value.some((b) => new Date(b.startsAt) < nextMonth && new Date(b.endsAt) > date)
    return {
      key,
      label: date.toLocaleDateString(t('listing.calendarLocale'), { month: 'long', year: 'numeric' }),
      blocked,
      price: overrides.value.get(key),
    }
  })
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
  emit('update:range', { monthStart: selectedMonth.value || null, monthCount: monthCount.value })
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
