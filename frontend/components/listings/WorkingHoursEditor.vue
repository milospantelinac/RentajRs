<template>
  <!-- Dizajn 22: the Forma column of 239:287 (Radno vreme, drawn for Igraonice). -->
  <div class="avail">
    <!-- 252:287 -->
    <section class="avail-section">
      <p id="wh-days-label" class="avail-label">{{ t('listing.whAvailableDays') }} <span class="avail-required">*</span></p>
      <div class="avail-days" role="group" aria-labelledby="wh-days-label">
        <label v-for="d in DAYS" :key="d.value" class="avail-day" :class="{ 'is-on': enabledDays.has(d.value) }">
          <input type="checkbox" class="visually-hidden" :checked="enabledDays.has(d.value)" @change="toggleDay(d.value)" />
          <span class="avail-day-box" aria-hidden="true">
            <img v-if="enabledDays.has(d.value)" src="/images/icons/day-check.svg" alt="" />
          </span>
          {{ t(d.labelKey) }}
        </label>
      </div>
      <p v-if="daysError" class="avail-error"><img src="/images/icons/field-error.svg" alt="" />{{ daysError }}</p>
    </section>

    <!-- 252:324 -->
    <section class="avail-section avail-section-tight">
      <p class="avail-label">{{ t('listing.whWorkingHours') }} <span class="avail-required">*</span></p>
      <template v-if="!perDayMode">
        <div class="avail-hours">
          <div class="avail-hours-field">
            <label for="wh-from" class="avail-sublabel">{{ t('listing.whFrom') }}</label>
            <AvailabilityTimeSelect id="wh-from" v-model="commonFrom" />
          </div>
          <div class="avail-hours-field">
            <label for="wh-to" class="avail-sublabel">{{ t('listing.whTo') }}</label>
            <AvailabilityTimeSelect id="wh-to" v-model="commonTo" />
          </div>
        </div>
        <!-- T104: hours that end at or before they start run into the next day. -->
        <p v-if="crossesMidnight(commonFrom, commonTo)" class="avail-hint">{{ t('listing.whMidnightCrossHint') }}</p>
      </template>

      <!-- 252:340 -->
      <label class="avail-toggle-row">
        <input v-model="perDayMode" type="checkbox" role="switch" class="visually-hidden" />
        <span class="avail-toggle" :class="{ 'is-on': perDayMode }" aria-hidden="true" />
        <span class="avail-toggle-text">
          <span class="avail-toggle-title">
            {{ t('listing.whPerDayToggle') }}
            <img src="/images/icons/info-circle.svg" alt="" />
          </span>
          <span class="avail-toggle-caption">{{ t(perDayMode ? 'listing.whPerDayCaptionOn' : 'listing.whPerDayCaptionOff') }}</span>
        </span>
      </label>

      <template v-if="perDayMode">
        <div v-for="day in enabledDaysList" :key="day.value" class="avail-day-block">
          <p class="avail-day-name">{{ t(day.labelKey) }}</p>
          <div class="avail-hours">
            <div class="avail-hours-field">
              <label :for="`wh-from-${day.value}`" class="avail-sublabel">{{ t('listing.whFrom') }}</label>
              <AvailabilityTimeSelect :id="`wh-from-${day.value}`" v-model="dayTimes[day.value].from" />
            </div>
            <div class="avail-hours-field">
              <label :for="`wh-to-${day.value}`" class="avail-sublabel">{{ t('listing.whTo') }}</label>
              <AvailabilityTimeSelect :id="`wh-to-${day.value}`" v-model="dayTimes[day.value].to" />
            </div>
          </div>
          <p v-if="crossesMidnight(dayTimes[day.value].from, dayTimes[day.value].to)" class="avail-hint">
            {{ t('listing.whMidnightCrossHint') }}
          </p>
          <div v-if="enabledDaysList.length > 1" class="avail-actions">
            <button type="button" class="avail-link" @click="copyDayTimeToOthers(day.value)">{{ t('listing.whCopyToOtherDays') }}</button>
          </div>
        </div>
      </template>
    </section>

    <!-- 252:349 -->
    <section class="avail-section avail-section-tight">
      <p class="avail-label">
        {{ t('listing.whHourlyRanges') }}
        <span class="avail-label-note">{{ t('common.optional') }}</span>
      </p>
      <p class="avail-hint">{{ rangesHint }}</p>

      <div v-for="group in rangeGroups" :key="group.key" class="avail-day-block">
        <p v-if="group.label" class="avail-day-name">{{ group.label }}</p>
        <div v-if="group.ranges.length" class="avail-ranges">
          <div v-for="(r, i) in group.ranges" :key="i" class="avail-range">
            <AvailabilityTimeSelect v-model="r.startTime" class="avail-range-time" :aria-label="t('listing.whFrom')" />
            <span class="avail-range-dash" aria-hidden="true">-</span>
            <AvailabilityTimeSelect v-model="r.endTime" class="avail-range-time" :aria-label="t('listing.whTo')" />
            <span class="avail-price">
              <input
                type="text"
                inputmode="numeric"
                autocomplete="off"
                class="avail-price-input"
                :aria-label="t('listing.price')"
                :value="formatRsdInput(r.price)"
                @input="r.price = applyRsdInput($event)"
              />
              <span class="avail-price-suffix">{{ priceSuffix }}</span>
            </span>
            <button type="button" class="avail-icon-btn" :aria-label="t('listing.whRemoveRange')" @click="group.ranges.splice(i, 1)">
              <img src="/images/icons/remove-x-muted.svg" alt="" />
            </button>
          </div>
        </div>
        <div v-if="group.key !== 'all'" class="avail-actions">
          <button type="button" class="avail-btn" @click="addRange(group.key)">+ {{ t('listing.whAddRange') }}</button>
          <button
            v-if="group.ranges.length && enabledDaysList.length > 1"
            type="button"
            class="avail-link"
            @click="copyDayRangesToOthers(group.key)"
          >
            {{ t('listing.whCopyToOtherDays') }}
          </button>
        </div>
      </div>

      <!-- 252:385: the frame's note about the button is left out, the button says it itself. -->
      <div class="avail-actions">
        <button v-if="!perDayMode" type="button" class="avail-btn" @click="addRange('all')">+ {{ t('listing.whAddRange') }}</button>
        <button type="button" class="avail-btn avail-btn-soft" :disabled="busy" @click="save">
          {{ saved ? t('common.savedButton') : busy ? t('common.loading') : t('common.save') }}
        </button>
      </div>
      <p v-if="editorError" class="avail-error"><img src="/images/icons/field-error.svg" alt="" />{{ editorError }}</p>
    </section>

    <!-- 252:394: Dodavanje Oglasa spec §3, block a whole date or price one date's window. -->
    <section class="avail-section">
      <p class="avail-label">
        {{ t('listing.whExceptions') }}
        <span class="avail-label-note">{{ t('listing.whExceptionsCaption') }}</span>
      </p>
      <!-- 252:398 -->
      <div class="avail-exception-row">
        <span class="avail-exception-label">{{ t('listing.whBlockDate') }}</span>
        <AvailabilityDateField
          v-model="blockDate"
          class="avail-exception-date"
          :listing-id="listingId"
          :placeholder="t('listing.datePlaceholder')"
          :aria-label="t('listing.whBlockDate')"
        />
        <button type="button" class="avail-btn" :disabled="blockingDate" @click="blockWholeDate">
          {{ blockDateSaved ? t('common.savedButton') : t('listing.whBlockDate') }}
        </button>
      </div>
      <!-- 252:406 -->
      <div class="avail-exception-row">
        <span class="avail-exception-label">{{ t('listing.whSpecialPrice') }}</span>
        <AvailabilityDateField
          v-model="overrideDate"
          class="avail-exception-date-sm"
          :listing-id="listingId"
          :placeholder="t('listing.datePlaceholder')"
          :aria-label="t('listing.whSpecialPrice')"
        />
        <AvailabilityTimeSelect v-model="overrideFrom" class="avail-exception-time" :aria-label="t('listing.whFrom')" />
        <AvailabilityTimeSelect v-model="overrideTo" class="avail-exception-time" :aria-label="t('listing.whTo')" />
        <input
          type="text"
          inputmode="numeric"
          autocomplete="off"
          class="avail-exception-price"
          :aria-label="t('listing.price')"
          :placeholder="priceSuffix"
          :value="formatRsdInput(overridePrice)"
          @input="overridePrice = applyRsdInput($event)"
        />
        <button type="button" class="avail-btn" :disabled="settingOverride" @click="addOverride">
          {{ t('listing.whSetException') }}
        </button>
      </div>
      <p v-if="exceptionsError" class="avail-error"><img src="/images/icons/field-error.svg" alt="" />{{ exceptionsError }}</p>

      <!-- 252:424: both kinds of exception in one list, by date. -->
      <div v-if="exceptions.length" class="avail-list">
        <p class="avail-list-head">
          {{ t('listing.whExceptionsListTitle') }}
          <img src="/images/icons/info-circle.svg" alt="" />
        </p>
        <div v-for="item in exceptions" :key="item.key" class="avail-list-row">
          <span class="avail-list-text">
            <span class="avail-list-title">{{ item.title }}</span>
            <span class="avail-list-sub">{{ item.subtitle }}</span>
          </span>
          <button type="button" class="avail-link" @click="item.remove">{{ t('listing.whRemove') }}</button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
const props = defineProps({
  listingId: { type: String, required: true },
  // Step 2's values, for the hints and the live preview beside the form.
  basePrice: { type: Number, default: 0 },
  weekendPrice: { type: Number, default: null },
  priceUnit: { type: String, default: 'HOUR' },
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
const daysError = ref('')

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
const settingOverride = ref(false)
const slotPriceOverrides = ref([])
const exceptionsError = ref('')

// 252:367: the rate step 2 set, per hour or (T111, Sale za proslave) per guest.
const unitKey = computed(() => (props.priceUnit === 'GUEST' ? 'GUEST' : 'HOUR'))
const priceSuffix = computed(() => `RSD / ${t(unitKey.value === 'GUEST' ? 'listing.unitGuest' : 'listing.unitHour')}`)
// resolveHourlyPrice only applies the weekend price to the hourly rate.
const weekendApplies = computed(() => unitKey.value === 'HOUR' && Number(props.weekendPrice) > 0)
const rangesHint = computed(() =>
  t(weekendApplies.value ? 'listing.whHourlyRangesHintWeekend' : 'listing.whHourlyRangesHint', {
    unit: t(`listing.whPriceUnitPhrase.${unitKey.value}`),
  }),
)

// Common mode edits one list for every day; per-day mode one list per active day.
const rangeGroups = computed(() =>
  perDayMode.value
    ? enabledDaysList.value.map((d) => ({ key: d.value, label: t(d.labelKey), ranges: dayHourlyRanges.value[d.value] || [] }))
    : [{ key: 'all', label: '', ranges: hourlyRanges.value }],
)

function crossesMidnight(from, to) {
  return !!from && !!to && to <= from
}

function toggleDay(day) {
  daysError.value = ''
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

function addRange(groupKey) {
  const range = { startTime: '10:00', endTime: '18:00', price: null }
  if (groupKey === 'all') {
    hourlyRanges.value.push(range)
    return
  }
  if (!dayHourlyRanges.value[groupKey]) dayHourlyRanges.value[groupKey] = []
  dayHourlyRanges.value[groupKey].push(range)
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

const rsdFormatter = new Intl.NumberFormat('sr-RS')
function formatPrice(v) {
  return rsdFormatter.format(v)
}

// 252:431 "1. januar 2027.", 254:295 "Subota, 12. septembar".
const longDateFormatter = new Intl.DateTimeFormat('sr-Latn-RS', { day: 'numeric', month: 'long', year: 'numeric' })
const weekdayFormatter = new Intl.DateTimeFormat('sr-Latn-RS', { weekday: 'long', day: 'numeric', month: 'long' })

function dateFromKey(key) {
  const [year, month, day] = key.slice(0, 10).split('-').map(Number)
  return new Date(year, month - 1, day)
}
function localDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const exceptions = computed(() => {
  const blocked = blockedDates.value.map((b) => {
    const start = new Date(b.startsAt)
    return {
      key: `block-${b.id}`,
      sortKey: `${localDateKey(start)} 00:00`,
      title: longDateFormatter.format(start),
      subtitle: t('listing.whExceptionBlocked'),
      remove: () => removeBlockedDate(b.id),
    }
  })
  const priced = slotPriceOverrides.value.map((o) => ({
    key: `price-${o.id}`,
    sortKey: `${o.date.slice(0, 10)} ${o.startTime}`,
    title: `${longDateFormatter.format(dateFromKey(o.date))} · ${o.startTime}-${o.endTime}`,
    subtitle: t('listing.whExceptionPrice', { price: `${formatPrice(o.price)} ${priceSuffix.value}` }),
    remove: () => removeOverride(o.id),
  }))
  return [...blocked, ...priced].sort((a, b) => a.sortKey.localeCompare(b.sortKey))
})

function isDateBlocked(date) {
  const dayStart = date.getTime()
  const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime()
  return blockedDates.value.some((b) => new Date(b.startsAt).getTime() < dayEnd && new Date(b.endsAt).getTime() > dayStart)
}

function addHours(time, hours) {
  const [h, m] = time.split(':').map(Number)
  const total = (h * 60 + m + hours * 60) % (24 * 60)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

// The order AvailabilityService.resolveHourlyPrice uses: the date's special
// price, then the range the start falls in, then the weekend, then the base.
function resolvePreviewPrice(date, dayOfWeek, startTime, ranges) {
  const key = localDateKey(date)
  const override = slotPriceOverrides.value.find((o) => o.date.slice(0, 10) === key && o.startTime <= startTime && o.endTime > startTime)
  if (override) return Number(override.price)
  const range = ranges.find((r) => r.startTime <= startTime && r.endTime > startTime)
  if (range) return Number(range.price)
  if (weekendApplies.value && (dayOfWeek === 5 || dayOfWeek === 6)) return Number(props.weekendPrice)
  return Number(props.basePrice) || 0
}

// 254:292: the next open day, two hours from the start of its last price range
// (or of its working hours), priced the way a booking would be.
const preview = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let offset = 1; offset <= 62; offset++) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset)
    const dayOfWeek = ((date.getDay() + 6) % 7) + 1
    if (!enabledDays.value.has(dayOfWeek) || isDateBlocked(date)) continue
    const hours = perDayMode.value && dayTimes.value[dayOfWeek] ? dayTimes.value[dayOfWeek] : { from: commonFrom.value, to: commonTo.value }
    const ranges = (perDayMode.value ? dayHourlyRanges.value[dayOfWeek] || [] : hourlyRanges.value)
      .filter((r) => r.startTime && r.endTime && r.price)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
    const from = ranges.length ? ranges[ranges.length - 1].startTime : hours.from
    const count = unitKey.value === 'GUEST' ? 1 : 2
    const unitPrice = resolvePreviewPrice(date, dayOfWeek, from, ranges)
    const label = weekdayFormatter.format(date)
    return {
      date: label.charAt(0).toUpperCase() + label.slice(1),
      from,
      to: addHours(from, 2),
      line: `${count} ${srDurationUnitWord(unitKey.value, count)} × ${formatPrice(unitPrice)} RSD`,
      total: `${formatPrice(unitPrice * count)} RSD`,
    }
  }
  return null
})

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

// Dizajn 22: "Dostupni dani *" needs at least one day. Returns false without
// saving when it has none, so the wizard stays on the step.
async function save() {
  editorError.value = ''
  if (!enabledDays.value.size) {
    daysError.value = t('listing.whDaysRequired')
    return false
  }
  busy.value = true
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

    // 252:391: the button reads "Sačuvano" for a moment.
    saved.value = true
    setTimeout(() => {
      saved.value = false
    }, 2000)
    return true
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
defineExpose({ save, preview })

// 252:404 and 252:422 look ready before anything is filled in, so a click says what is missing.
async function blockWholeDate() {
  if (!blockDate.value) {
    exceptionsError.value = t('listing.whExceptionDateRequired')
    return
  }
  blockingDate.value = true
  exceptionsError.value = ''
  try {
    const start = new Date(`${blockDate.value}T00:00:00`)
    const end = new Date(start.getTime() + 86400000)
    const created = await api.post(`/listings/${props.listingId}/availability/blocks`, {
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
    })
    blockedDates.value.push(created)
    blockDate.value = ''
    blockDateSaved.value = true
    setTimeout(() => {
      blockDateSaved.value = false
    }, 2000)
  } catch (e) {
    exceptionsError.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    blockingDate.value = false
  }
}

async function removeBlockedDate(id) {
  exceptionsError.value = ''
  try {
    await api.delete(`/listings/${props.listingId}/availability/blocks/${id}`)
    blockedDates.value = blockedDates.value.filter((b) => b.id !== id)
  } catch (e) {
    exceptionsError.value = extractErrorMessage(e, t('auth.genericError'))
  }
}

async function addOverride() {
  if (!overrideDate.value || !overridePrice.value) {
    exceptionsError.value = t('listing.whSpecialPriceIncomplete')
    return
  }
  settingOverride.value = true
  exceptionsError.value = ''
  try {
    const created = await api.post(`/listings/${props.listingId}/availability/slot-price-overrides`, {
      date: overrideDate.value,
      startTime: overrideFrom.value,
      endTime: overrideTo.value,
      price: overridePrice.value,
    })
    slotPriceOverrides.value.push(created)
    overrideDate.value = ''
    overridePrice.value = null
  } catch (e) {
    exceptionsError.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    settingOverride.value = false
  }
}

async function removeOverride(id) {
  exceptionsError.value = ''
  try {
    await api.delete(`/listings/${props.listingId}/availability/slot-price-overrides/${id}`)
    slotPriceOverrides.value = slotPriceOverrides.value.filter((o) => o.id !== id)
  } catch (e) {
    exceptionsError.value = extractErrorMessage(e, t('auth.genericError'))
  }
}

onMounted(load)
</script>

<style lang="scss" scoped>
@use '@/assets/scss/availability-editor';
</style>
