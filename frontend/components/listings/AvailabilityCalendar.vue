<template>
  <div class="availability-calendar">
    <div class="calendar-nav">
      <button type="button" class="btn btn-tertiary btn-sm" @click="shiftMonth(-1)">←</button>
      <span class="calendar-month-label">{{ monthLabel }}</span>
      <button type="button" class="btn btn-tertiary btn-sm" @click="shiftMonth(1)">→</button>
    </div>

    <div class="calendar-grid">
      <span v-for="d in weekdayLabels" :key="d" class="calendar-weekday">{{ d }}</span>
      <span v-for="n in leadingBlanks" :key="`b${n}`" class="calendar-cell calendar-cell-empty"></span>
      <button
        v-for="cell in days"
        :key="cell.key"
        type="button"
        class="calendar-cell"
        :class="{
          'calendar-cell-blocked': cell.status === 'MANUAL',
          'calendar-cell-taken': cell.status && cell.status !== 'MANUAL',
          'calendar-cell-selected': selectedDate === cell.key,
          'calendar-cell-past': cell.past,
        }"
        :disabled="cell.past || (cell.status && cell.status !== 'MANUAL')"
        @click="selectDay(cell)"
      >
        <span class="calendar-cell-day">{{ cell.day }}</span>
        <span v-if="cell.status === 'MANUAL'" class="calendar-cell-tag">{{ t('listing.calendarBlocked') }}</span>
        <span v-else-if="cell.status" class="calendar-cell-tag">{{ t('listing.calendarTaken') }}</span>
        <span v-else-if="showPricing && cell.price" class="calendar-cell-price">{{ formatPrice(cell.price) }}</span>
      </button>
    </div>

    <div class="calendar-legend">
      <span><i class="legend-dot legend-dot-blocked"></i>{{ t('listing.calendarBlocked') }}</span>
      <span><i class="legend-dot legend-dot-taken"></i>{{ t('listing.calendarTaken') }}</span>
    </div>

    <div v-if="selectedCell" class="calendar-editor">
      <p class="calendar-editor-date">{{ formatSelectedDate }}</p>

      <button type="button" class="btn btn-tertiary btn-sm" :disabled="busy" @click="toggleBlock">
        {{ selectedCell.status === 'MANUAL' ? t('listing.calendarUnblock') : t('listing.calendarBlock') }}
      </button>

      <div v-if="showPricing" class="calendar-price-editor">
        <label class="form-label">{{ t('listing.calendarCustomPrice') }}</label>
        <div class="calendar-price-row">
          <input v-model.number="priceInput" type="number" min="1" class="form-control" :placeholder="String(defaultPriceForSelected)" />
          <button type="button" class="btn btn-primary-flat btn-sm" :disabled="busy || !priceInput" @click="savePrice">
            {{ t('common.save') }}
          </button>
          <button
            v-if="selectedCell.hasOverride"
            type="button"
            class="btn btn-tertiary btn-sm"
            :disabled="busy"
            @click="clearPrice"
          >
            {{ t('listing.calendarRemoveCustomPrice') }}
          </button>
        </div>
      </div>

      <p v-if="editorError" class="form-error mt-2">{{ editorError }}</p>
    </div>
  </div>
</template>

<script setup>
// RNT-029 — the owner's audit decision: "svaki datum posebno u kalendaru
// mozes setovati cenu ili blokirati" (like other listing platforms, every
// date in the calendar can individually have a price or be blocked). Manual
// blocking reuses the pre-existing BlockedTerm/MANUAL endpoints; per-date
// pricing is new (DatePriceOverride) and only makes sense for PER_STAY
// (night/day) listings — PER_SLOT pricing lives on the slot itself.
const props = defineProps({
  listingId: { type: String, required: true },
  basePrice: { type: Number, default: 0 },
  weekendPrice: { type: Number, default: null },
  showPricing: { type: Boolean, default: true },
})

const { t } = useI18n()
const api = useApi()

const today = new Date()
today.setHours(0, 0, 0, 0)
const viewMonth = ref(new Date(today.getFullYear(), today.getMonth(), 1))
const blocks = ref([]) // [{id, startsAt, endsAt, source}]
const overrides = ref(new Map()) // 'YYYY-MM-DD' -> price
const selectedDate = ref(null)
const priceInput = ref(null)
const busy = ref(false)
const editorError = ref('')

function toKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const weekdayLabels = computed(() => t('listing.calendarWeekdays').split(','))

const monthLabel = computed(() =>
  viewMonth.value.toLocaleDateString(t('listing.calendarLocale'), { month: 'long', year: 'numeric' }),
)

const leadingBlanks = computed(() => {
  const jsDay = viewMonth.value.getDay() // 0=Sun
  return (jsDay + 6) % 7 // Monday-first
})

function statusForDay(date) {
  const dayStart = date.getTime()
  const dayEnd = dayStart + 86400000
  for (const b of blocks.value) {
    const s = new Date(b.startsAt).getTime()
    const e = new Date(b.endsAt).getTime()
    if (s < dayEnd && e > dayStart) return { status: b.source, id: b.id }
  }
  return { status: null, id: null }
}

const days = computed(() => {
  const year = viewMonth.value.getFullYear()
  const month = viewMonth.value.getMonth()
  const count = new Date(year, month + 1, 0).getDate()
  const list = []
  for (let day = 1; day <= count; day++) {
    const date = new Date(year, month, day)
    const key = toKey(date)
    const { status, id } = statusForDay(date)
    const override = overrides.value.get(key)
    const isWeekend = date.getDay() === 5 || date.getDay() === 6
    list.push({
      key,
      day,
      date,
      status,
      blockId: id,
      hasOverride: override !== undefined,
      price: override ?? (isWeekend && props.weekendPrice ? props.weekendPrice : props.basePrice),
      past: date < today,
    })
  }
  return list
})

const selectedCell = computed(() => days.value.find((d) => d.key === selectedDate.value) || null)
const defaultPriceForSelected = computed(() => {
  if (!selectedCell.value) return props.basePrice
  const isWeekend = selectedCell.value.date.getDay() === 5 || selectedCell.value.date.getDay() === 6
  return isWeekend && props.weekendPrice ? props.weekendPrice : props.basePrice
})

const formatSelectedDate = computed(() =>
  selectedCell.value ? selectedCell.value.date.toLocaleDateString(t('listing.calendarLocale'), { weekday: 'long', day: 'numeric', month: 'long' }) : '',
)

function formatPrice(v) {
  return `${new Intl.NumberFormat('sr-RS').format(v)}`
}

function selectDay(cell) {
  if (cell.past || (cell.status && cell.status !== 'MANUAL')) return
  editorError.value = ''
  selectedDate.value = selectedDate.value === cell.key ? null : cell.key
  priceInput.value = null
}

async function loadAvailability() {
  const year = viewMonth.value.getFullYear()
  const month = viewMonth.value.getMonth()
  const from = new Date(year, month, 1)
  const to = new Date(year, month + 1, 1)
  const data = await api.get(`/listings/${props.listingId}/availability`, {
    query: { from: from.toISOString(), to: to.toISOString() },
  })
  blocks.value = data.blocked || []
  overrides.value = new Map((data.datePriceOverrides || []).map((o) => [toKey(new Date(o.date)), o.price]))
}

function shiftMonth(delta) {
  const d = new Date(viewMonth.value)
  d.setMonth(d.getMonth() + delta)
  viewMonth.value = d
  selectedDate.value = null
}

async function toggleBlock() {
  if (!selectedCell.value) return
  busy.value = true
  editorError.value = ''
  try {
    if (selectedCell.value.status === 'MANUAL') {
      await api.delete(`/listings/${props.listingId}/availability/blocks/${selectedCell.value.blockId}`)
    } else {
      const start = selectedCell.value.date
      const end = new Date(start.getTime() + 86400000)
      await api.post(`/listings/${props.listingId}/availability/blocks`, {
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
      })
    }
    await loadAvailability()
  } catch (e) {
    editorError.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    busy.value = false
  }
}

async function savePrice() {
  if (!selectedCell.value || !priceInput.value) return
  busy.value = true
  editorError.value = ''
  try {
    await api.post(`/listings/${props.listingId}/availability/date-price`, {
      date: selectedCell.value.key,
      price: priceInput.value,
    })
    await loadAvailability()
  } catch (e) {
    editorError.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    busy.value = false
  }
}

async function clearPrice() {
  if (!selectedCell.value) return
  busy.value = true
  editorError.value = ''
  try {
    await api.delete(`/listings/${props.listingId}/availability/date-price/${selectedCell.value.key}`)
    await loadAvailability()
  } catch (e) {
    editorError.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    busy.value = false
  }
}

watch(viewMonth, loadAvailability, { immediate: true })
</script>

<style lang="scss" scoped>
.availability-calendar {
  border: 1px solid $color-border;
  border-radius: 14px;
  padding: 16px;
}

.calendar-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.calendar-month-label {
  font-weight: 600;
  text-transform: capitalize;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.calendar-weekday {
  text-align: center;
  font-size: 12px;
  color: $color-text-muted;
  padding-bottom: 4px;
}

.calendar-cell {
  aspect-ratio: 1;
  border: 1px solid $color-border;
  border-radius: 8px;
  background: transparent;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 2px;
  min-height: 46px;
}

.calendar-cell-empty {
  border: none;
  cursor: default;
}

.calendar-cell-day {
  font-size: 13px;
}

.calendar-cell-price {
  font-size: 10px;
  color: $color-text-muted;
}

.calendar-cell-tag {
  font-size: 9px;
}

.calendar-cell-past {
  opacity: 0.35;
  cursor: default;
}

.calendar-cell-blocked {
  background: rgba(220, 53, 69, 0.1);
  border-color: rgba(220, 53, 69, 0.4);
}

.calendar-cell-taken {
  background: rgba(0, 0, 0, 0.06);
  cursor: default;
}

.calendar-cell-selected {
  border-color: $color-primary;
  border-width: 2px;
}

.calendar-legend {
  display: flex;
  gap: 16px;
  margin-top: 10px;
  font-size: 12px;
  color: $color-text-muted;
}

.legend-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 3px;
  margin-right: 4px;
}

.legend-dot-blocked {
  background: rgba(220, 53, 69, 0.4);
}

.legend-dot-taken {
  background: rgba(0, 0, 0, 0.15);
}

.calendar-editor {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid $color-border;
}

.calendar-editor-date {
  font-weight: 600;
  text-transform: capitalize;
  margin-bottom: 8px;
}

.calendar-price-editor {
  margin-top: 12px;
}

.calendar-price-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
</style>
