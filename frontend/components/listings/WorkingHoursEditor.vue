<template>
  <div class="wh-editor">
    <p class="text-label mb-2">{{ t('listing.whAvailableDays') }}</p>
    <div class="wh-days">
      <label v-for="d in DAYS" :key="d.value" class="wh-day" :class="{ 'wh-day-active': enabledDays.has(d.value) }">
        <input type="checkbox" class="d-none" :checked="enabledDays.has(d.value)" @change="toggleDay(d.value)" />
        {{ t(d.labelKey) }}
      </label>
    </div>

    <!-- T104 — one shared range for every active day (existing behavior), or
         each day gets its own "od-do" including the ability to cross
         midnight (e.g. 20:00–02:00: "do" <= "od" means the term runs into
         the next calendar day). -->
    <div class="form-group mt-3 mb-2">
      <label class="form-row-inline">
        <input v-model="perDayMode" type="checkbox" class="form-checkbox" />
        {{ t('listing.whPerDayToggle') }}
      </label>
    </div>

    <template v-if="!perDayMode">
      <div class="row">
        <div class="col-6">
          <div class="form-group mb-1">
            <label class="form-label">{{ t('listing.whFrom') }}</label>
            <input v-model="commonFrom" type="time" class="form-control" />
          </div>
        </div>
        <div class="col-6">
          <div class="form-group mb-1">
            <label class="form-label">{{ t('listing.whTo') }}</label>
            <input v-model="commonTo" type="time" class="form-control" />
          </div>
        </div>
      </div>
      <p class="text-muted mb-3">{{ t('listing.whMidnightCrossHint') }}</p>

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
    </template>

    <template v-else>
      <div v-for="day in enabledDaysList" :key="day.value" class="wh-day-panel mt-3">
        <p class="text-label mb-2">{{ t(day.labelKey) }}</p>
        <div class="row">
          <div class="col-6">
            <div class="form-group mb-1">
              <label class="form-label">{{ t('listing.whFrom') }}</label>
              <input v-model="dayTimes[day.value].from" type="time" class="form-control" />
            </div>
          </div>
          <div class="col-6">
            <div class="form-group mb-1">
              <label class="form-label">{{ t('listing.whTo') }}</label>
              <input v-model="dayTimes[day.value].to" type="time" class="form-control" />
            </div>
          </div>
        </div>
        <p class="text-muted mb-2">{{ t('listing.whMidnightCrossHint') }}</p>
        <button type="button" class="btn btn-tertiary btn-sm mb-2" @click="copyDayTimeToOthers(day.value)">
          {{ t('listing.whCopyToOtherDays') }}
        </button>

        <p class="text-label mb-2 mt-2">{{ t('listing.whHourlyRanges') }}</p>
        <div v-for="(r, i) in dayHourlyRanges[day.value]" :key="i" class="wh-range-row">
          <input v-model="r.startTime" type="time" class="form-control" />
          <span>—</span>
          <input v-model="r.endTime" type="time" class="form-control" />
          <input v-model.number="r.price" type="number" min="1" class="form-control" :placeholder="t('listing.pricePerHour')" />
          <button type="button" class="btn btn-tertiary btn-sm" @click="dayHourlyRanges[day.value].splice(i, 1)">✕</button>
        </div>
        <div class="wh-day-range-actions mb-3">
          <button type="button" class="btn btn-tertiary btn-sm" @click="addDayRange(day.value)">+ {{ t('listing.whAddRange') }}</button>
          <button
            v-if="dayHourlyRanges[day.value]?.length"
            type="button"
            class="btn btn-tertiary btn-sm"
            @click="copyDayRangesToOthers(day.value)"
          >{{ t('listing.whCopyToOtherDays') }}</button>
        </div>
      </div>
    </template>

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
const commonFrom = ref('10:00')
const commonTo = ref('22:00')
const hourlyRanges = ref([])
const busy = ref(false)
const saved = ref(false)
const editorError = ref('')

// T104 — "posebno radno vreme po danu": each active day gets its own
// from/to and its own hourly price ranges, instead of one shared range for
// every day. dayTimes/dayHourlyRanges are only populated while
// perDayMode is on; commonFrom/commonTo/hourlyRanges stay the source of
// truth otherwise (unchanged from before this feature).
const perDayMode = ref(false)
const dayTimes = ref({})
const dayHourlyRanges = ref({})
const enabledDaysList = computed(() => DAYS.filter((d) => enabledDays.value.has(d.value)))

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
  if (enabledDays.value.has(day)) {
    enabledDays.value.delete(day)
    return
  }
  enabledDays.value.add(day)
  // T104 — a day switched on while already in per-day mode needs its own
  // starting point; prefill from the shared values, same as the spec's
  // "prepopuniti iz dotadašnjeg zajedničkog radnog vremena" for the toggle
  // itself.
  if (perDayMode.value) {
    if (!dayTimes.value[day]) dayTimes.value[day] = { from: commonFrom.value, to: commonTo.value }
    if (!dayHourlyRanges.value[day]) dayHourlyRanges.value[day] = []
  }
}

function addRange() {
  hourlyRanges.value.push({ startTime: '10:00', endTime: '18:00', price: null })
}

function addDayRange(day) {
  if (!dayHourlyRanges.value[day]) dayHourlyRanges.value[day] = []
  dayHourlyRanges.value[day].push({ startTime: '10:00', endTime: '18:00', price: null })
}

function copyDayTimeToOthers(sourceDay) {
  const src = dayTimes.value[sourceDay]
  if (!src) return
  for (const day of enabledDays.value) {
    if (day !== sourceDay) dayTimes.value[day] = { from: src.from, to: src.to }
  }
}

function copyDayRangesToOthers(sourceDay) {
  const src = dayHourlyRanges.value[sourceDay] || []
  for (const day of enabledDays.value) {
    if (day !== sourceDay) dayHourlyRanges.value[day] = src.map((r) => ({ ...r }))
  }
}

// T104 — switching common → per-day prefills every already-active day from
// the shared values, so the owner isn't retyping from scratch; switching
// back leaves the shared fields exactly as they were.
watch(perDayMode, (isPerDay) => {
  if (!isPerDay) return
  for (const day of enabledDays.value) {
    if (!dayTimes.value[day]) dayTimes.value[day] = { from: commonFrom.value, to: commonTo.value }
    if (!dayHourlyRanges.value[day]) dayHourlyRanges.value[day] = hourlyRanges.value.map((r) => ({ ...r }))
  }
})

function formatPrice(v) {
  return new Intl.NumberFormat('sr-RS').format(v)
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('sr-RS')
}

async function load() {
  const from = new Date()
  const to = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365)
  const data = await api.get(`/listings/${props.listingId}/availability`, { query: { from: from.toISOString(), to: to.toISOString() } })
  const rows = data.workingHours || []
  const days = new Set(rows.map((h) => h.dayOfWeek))
  enabledDays.value = days
  const ranges = data.hourlyPriceRanges || []

  // T104 — no separate flag is stored for which mode the owner last used;
  // infer it from the data itself. Saved hours that differ across days, or
  // any hourly range tagged to a specific day, can only come from per-day
  // mode (save() never writes either shape any other way).
  const distinctTimes = new Set(rows.map((h) => `${h.startsAt}|${h.endsAt}`))
  const hasDaySpecificRanges = ranges.some((r) => r.dayOfWeek != null)
  perDayMode.value = distinctTimes.size > 1 || hasDaySpecificRanges

  if (rows.length) {
    commonFrom.value = rows[0].startsAt
    commonTo.value = rows[0].endsAt
  }
  if (perDayMode.value) {
    dayTimes.value = {}
    for (const h of rows) dayTimes.value[h.dayOfWeek] = { from: h.startsAt, to: h.endsAt }
    dayHourlyRanges.value = {}
    for (const day of days) dayHourlyRanges.value[day] = []
    for (const r of ranges) {
      if (r.dayOfWeek == null) continue
      if (!dayHourlyRanges.value[r.dayOfWeek]) dayHourlyRanges.value[r.dayOfWeek] = []
      dayHourlyRanges.value[r.dayOfWeek].push({ ...r })
    }
  } else {
    hourlyRanges.value = ranges.map((r) => ({ ...r }))
  }

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
    const hours = perDayMode.value
      ? Array.from(enabledDays.value).map((day) => ({
          dayOfWeek: day,
          startsAt: dayTimes.value[day]?.from || commonFrom.value,
          endsAt: dayTimes.value[day]?.to || commonTo.value,
        }))
      : Array.from(enabledDays.value).map((day) => ({ dayOfWeek: day, startsAt: commonFrom.value, endsAt: commonTo.value }))
    await api.post(`/listings/${props.listingId}/availability/working-hours`, { hours })

    // T72 — the backend rejected this whenever a range came from load()'s
    // spread of the stored rows (id/listingId included): this endpoint
    // fully replaces the set, it never took an id to update by.
    let ranges
    if (perDayMode.value) {
      ranges = []
      for (const day of enabledDays.value) {
        for (const r of dayHourlyRanges.value[day] || []) {
          if (r.startTime && r.endTime && r.price) {
            ranges.push({ dayOfWeek: day, startTime: r.startTime, endTime: r.endTime, price: r.price })
          }
        }
      }
    } else {
      ranges = hourlyRanges.value
        .filter((r) => r.startTime && r.endTime && r.price)
        .map((r) => ({ startTime: r.startTime, endTime: r.endTime, price: r.price }))
    }
    await api.post(`/listings/${props.listingId}/availability/hourly-price-ranges`, { ranges })

    saved.value = true
    setTimeout(() => { saved.value = false }, 2000)
  } catch (e) {
    editorError.value = extractErrorMessage(e, t('auth.genericError'))
    throw e
  } finally {
    busy.value = false
  }
}

// T72 — the wizard's main "Sačuvaj i nastavi" used to skip this step
// entirely (working hours/days/ranges only ever saved via this editor's own
// internal button), so an owner who never touched that button silently lost
// the edit. Exposed so the wizard can call this on its own save-and-continue.
defineExpose({ save })

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

.wh-day-panel {
  padding: 12px;
  border: 1px solid $color-border;
  border-radius: 10px;
}

.wh-day-range-actions {
  display: flex;
  gap: 8px;
}
</style>
