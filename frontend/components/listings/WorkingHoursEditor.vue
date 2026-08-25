<template>
  <div class="wh-editor">
    <p class="text-label mb-2">{{ t('listing.whAvailableDays') }}</p>
    <div class="wh-days">
      <label v-for="d in DAYS" :key="d.value" class="wh-day" :class="{ 'wh-day-active': enabledDays.has(d.value) }">
        <input type="checkbox" class="d-none" :checked="enabledDays.has(d.value)" @change="toggleDay(d.value)" />
        {{ t(d.labelKey) }}
      </label>
    </div>

    <div class="row mt-3">
      <div class="col-6">
        <div class="form-group mb-3">
          <label class="form-label">{{ t('listing.whFrom') }}</label>
          <input v-model="rangeFrom" type="time" class="form-control" />
        </div>
      </div>
      <div class="col-6">
        <div class="form-group mb-3">
          <label class="form-label">{{ t('listing.whTo') }}</label>
          <input v-model="rangeTo" type="time" class="form-control" />
        </div>
      </div>
    </div>

    <p class="text-label mb-2 mt-3">{{ t('listing.whHourlyRanges') }}</p>
    <p class="text-muted mb-2">{{ t('listing.whHourlyRangesHint') }}</p>
    <div v-for="(r, i) in hourlyRanges" :key="i" class="wh-range-row">
      <input v-model="r.startTime" type="time" class="form-control" />
      <span>—</span>
      <input v-model="r.endTime" type="time" class="form-control" />
      <input v-model.number="r.price" type="number" min="1" class="form-control" :placeholder="t('listing.pricePerHour')" />
      <button type="button" class="btn btn-tertiary btn-sm" @click="hourlyRanges.splice(i, 1)">✕</button>
    </div>
    <button type="button" class="btn btn-tertiary btn-sm mb-3" @click="addRange">+ {{ t('listing.whAddRange') }}</button>

    <button type="button" class="btn btn-primary-flat btn-sm" :disabled="busy" @click="save">
      {{ busy ? t('common.loading') : t('common.save') }}
    </button>
    <p v-if="saved" class="text-success mt-2">{{ t('dashboard.changesSaved') }}</p>
    <p v-if="editorError" class="form-error mt-2">{{ editorError }}</p>

    <!-- Izuzeci — Dodavanje Oglasa spec §3: block a whole date, or set a
         one-off price for a specific date+time window. -->
    <div class="wh-exceptions mt-4">
      <p class="text-label mb-2">{{ t('listing.whExceptions') }}</p>
      <div class="wh-exception-row">
        <input v-model="blockDate" type="date" class="form-control" />
        <button type="button" class="btn btn-tertiary btn-sm" :disabled="!blockDate || blockingDate" @click="blockWholeDate">
          {{ blockDateSaved ? t('common.savedButton') : t('listing.whBlockDate') }}
        </button>
      </div>
      <ul v-if="blockedDates.length" class="wh-override-list mt-2">
        <li v-for="b in blockedDates" :key="b.id">
          {{ formatDate(b.startsAt) }}
          <button type="button" class="btn-link-danger" @click="removeBlockedDate(b.id)">✕</button>
        </li>
      </ul>
      <div class="wh-exception-row mt-2">
        <input v-model="overrideDate" type="date" class="form-control" />
        <input v-model="overrideFrom" type="time" class="form-control" />
        <input v-model="overrideTo" type="time" class="form-control" />
        <input v-model.number="overridePrice" type="number" min="1" class="form-control" :placeholder="t('listing.pricePerHour')" />
        <button type="button" class="btn btn-tertiary btn-sm" :disabled="!overrideDate || !overridePrice" @click="addOverride">
          {{ t('listing.whSetException') }}
        </button>
      </div>

      <ul v-if="slotPriceOverrides.length" class="wh-override-list mt-2">
        <li v-for="o in slotPriceOverrides" :key="o.id">
          {{ formatDate(o.date) }}, {{ o.startTime }}–{{ o.endTime }}: {{ formatPrice(o.price) }} RSD
          <button type="button" class="btn-link-danger" @click="removeOverride(o.id)">✕</button>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  listingId: { type: String, required: true },
})

const { t } = useI18n()
const api = useApi()

const DAYS = [
  { value: 1, labelKey: 'listing.dayMon' },
  { value: 2, labelKey: 'listing.dayTue' },
  { value: 3, labelKey: 'listing.dayWed' },
  { value: 4, labelKey: 'listing.dayThu' },
  { value: 5, labelKey: 'listing.dayFri' },
  { value: 6, labelKey: 'listing.daySat' },
  { value: 7, labelKey: 'listing.daySun' },
]

const enabledDays = ref(new Set())
const rangeFrom = ref('10:00')
const rangeTo = ref('22:00')
const hourlyRanges = ref([])
const busy = ref(false)
const saved = ref(false)
const editorError = ref('')

const blockDate = ref('')
const blockedDates = ref([])
const blockingDate = ref(false)
const blockDateSaved = ref(false)
const overrideDate = ref('')
const overrideFrom = ref('10:00')
const overrideTo = ref('12:00')
const overridePrice = ref(null)
const slotPriceOverrides = ref([])

function toggleDay(day) {
  if (enabledDays.value.has(day)) enabledDays.value.delete(day)
  else enabledDays.value.add(day)
}

function addRange() {
  hourlyRanges.value.push({ startTime: '10:00', endTime: '18:00', price: null })
}

function formatPrice(v) {
  return new Intl.NumberFormat('sr-RS').format(v)
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('sr-RS')
}

async function load() {
  const from = new Date()
  const to = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365)
  const data = await api.get(`/listings/${props.listingId}/availability`, {
    query: { from: from.toISOString(), to: to.toISOString() },
  })
  const days = new Set((data.workingHours || []).map((h) => h.dayOfWeek))
  enabledDays.value = days
  if (data.workingHours?.length) {
    rangeFrom.value = data.workingHours[0].startsAt
    rangeTo.value = data.workingHours[0].endsAt
  }
  hourlyRanges.value = (data.hourlyPriceRanges || []).map((r) => ({ ...r }))
  slotPriceOverrides.value = data.slotPriceOverrides || []
  // T34 — only MANUAL blocks are listed/removable here; BOOKING/GAP/ICAL
  // blocks come from elsewhere and aren't this editor's to touch (the
  // backend's own delete endpoint already refuses to remove them).
  blockedDates.value = (data.blocked || []).filter((b) => b.source === 'MANUAL')
}

async function save() {
  busy.value = true
  editorError.value = ''
  try {
    const hours = Array.from(enabledDays.value).map((dayOfWeek) => ({
      dayOfWeek,
      startsAt: rangeFrom.value,
      endsAt: rangeTo.value,
    }))
    await api.post(`/listings/${props.listingId}/availability/working-hours`, { hours })
    await api.post(`/listings/${props.listingId}/availability/hourly-price-ranges`, {
      ranges: hourlyRanges.value.filter((r) => r.startTime && r.endTime && r.price),
    })
    saved.value = true
    setTimeout(() => { saved.value = false }, 2000)
  } catch (e) {
    editorError.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    busy.value = false
  }
}

async function blockWholeDate() {
  if (!blockDate.value) return
  blockingDate.value = true
  try {
    const start = new Date(`${blockDate.value}T00:00:00`)
    const end = new Date(start.getTime() + 86400000)
    const created = await api.post(`/listings/${props.listingId}/availability/blocks`, {
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
    })
    blockedDates.value.push(created)
    blockedDates.value.sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
    blockDate.value = ''
    blockDateSaved.value = true
    setTimeout(() => { blockDateSaved.value = false }, 2000)
  } finally {
    blockingDate.value = false
  }
}

async function removeBlockedDate(id) {
  await api.delete(`/listings/${props.listingId}/availability/blocks/${id}`)
  blockedDates.value = blockedDates.value.filter((b) => b.id !== id)
}

async function addOverride() {
  const created = await api.post(`/listings/${props.listingId}/availability/slot-price-overrides`, {
    date: overrideDate.value,
    startTime: overrideFrom.value,
    endTime: overrideTo.value,
    price: overridePrice.value,
  })
  slotPriceOverrides.value.push(created)
  overrideDate.value = ''
  overridePrice.value = null
}

async function removeOverride(id) {
  await api.delete(`/listings/${props.listingId}/availability/slot-price-overrides/${id}`)
  slotPriceOverrides.value = slotPriceOverrides.value.filter((o) => o.id !== id)
}

onMounted(load)
</script>

<style lang="scss" scoped>
.wh-days {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.wh-day {
  padding: 8px 14px;
  border: 1px solid $color-border;
  border-radius: $radius-pill;
  font-size: $font-size-muted;
  cursor: pointer;
  color: $color-text-muted;
}

.wh-day-active {
  background: $color-primary;
  border-color: $color-primary;
  color: $color-surface;
}

.wh-range-row {
  display: grid;
  grid-template-columns: 1fr auto 1fr 1fr auto;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}

.wh-exception-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.wh-override-list {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: $font-size-muted;
}

.btn-link-danger {
  background: none;
  border: none;
  color: $color-error;
  cursor: pointer;
  font-size: 12px;
}
</style>
