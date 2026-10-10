<template>
  <!-- T141: the Forma column of 1700:3269 (Radno vreme, simplified); Dizajn
       22's 239:287 for what that frame keeps (days, toggle, exceptions list). -->
  <div class="avail">
    <!-- 1700:3332 -->
    <section class="avail-section">
      <p id="wh-days-label" class="avail-label">
        {{ t('listing.whAvailableDays') }} <span class="avail-required">*</span>
      </p>
      <div class="avail-days" role="group" aria-labelledby="wh-days-label">
        <label
          v-for="d in DAYS"
          :key="d.value"
          class="avail-day"
          :class="{ 'is-on': enabledDays.has(d.value) }"
        >
          <input
            type="checkbox"
            class="visually-hidden"
            :checked="enabledDays.has(d.value)"
            @change="toggleDay(d.value)"
          />
          <span class="avail-day-box" aria-hidden="true">
            <img v-if="enabledDays.has(d.value)" src="/images/icons/day-check.svg" alt="" />
          </span>
          {{ t(d.labelKey) }}
        </label>
      </div>
      <p v-if="daysError" class="avail-error">
        <img src="/images/icons/field-error.svg" alt="" />{{ daysError }}
      </p>
    </section>

    <!-- 1700:3958: the hours and their prices are one list of periods, saved
         with "Sačuvaj i nastavi" (no button of their own any more). -->
    <section class="avail-section">
      <!-- 1700:3960: the asterisk in the title's own colour. -->
      <p class="avail-label">{{ scheduleTitle }} *</p>
      <p class="avail-hint">{{ t('listing.whScheduleHint') }}</p>

      <template v-if="!perDayMode">
        <div v-if="commonPeriods.length" class="avail-periods">
          <div v-for="(period, i) in commonPeriods" :key="period.key" class="avail-period">
            <AvailabilityTimeSelect
              v-model="period.from"
              class="avail-period-time"
              :aria-label="t('listing.whFrom')"
            />
            <span class="avail-range-dash" aria-hidden="true">-</span>
            <AvailabilityTimeSelect
              v-model="period.to"
              class="avail-period-time"
              :aria-label="t('listing.whTo')"
            />
            <span class="avail-price">
              <input
                type="text"
                inputmode="numeric"
                autocomplete="off"
                class="avail-price-input"
                :aria-label="t('listing.whPeriodPrice')"
                :value="formatRsdInput(period.price)"
                @input="period.price = applyRsdInput($event)"
              />
              <span class="avail-price-suffix">{{ priceSuffix }}</span>
            </span>
            <button
              type="button"
              class="avail-icon-btn"
              :aria-label="t('listing.whRemovePeriod')"
              @click="commonPeriods.splice(i, 1)"
            >
              <img src="/images/icons/remove-x-muted.svg" alt="" />
            </button>
          </div>
        </div>
        <button type="button" class="avail-link avail-add-link" @click="addPeriod(commonPeriods)">
          + {{ t('listing.whAddPeriod') }}
        </button>
      </template>

      <!-- 1700:3995 -->
      <label class="avail-toggle-row">
        <input v-model="perDayMode" type="checkbox" role="switch" class="visually-hidden" />
        <span class="avail-toggle" :class="{ 'is-on': perDayMode }" aria-hidden="true" />
        <span class="avail-toggle-text">
          <span class="avail-toggle-title">
            {{ t('listing.whPerDayToggle') }}
            <img src="/images/icons/info-circle.svg" alt="" />
          </span>
          <span class="avail-toggle-caption">{{
            t(perDayMode ? 'listing.whPerDayCaptionOn' : 'listing.whPerDayCaptionOff')
          }}</span>
        </span>
      </label>

      <!-- T104: each day its own periods, the frame's rows under the day's name. -->
      <template v-if="perDayMode">
        <div v-for="day in enabledDaysList" :key="day.value" class="avail-day-block">
          <p class="avail-day-name">{{ t(day.labelKey) }}</p>
          <div v-if="dayPeriods[day.value]?.length" class="avail-periods">
            <div
              v-for="(period, i) in dayPeriods[day.value]"
              :key="period.key"
              class="avail-period"
            >
              <AvailabilityTimeSelect
                v-model="period.from"
                class="avail-period-time"
                :aria-label="t('listing.whFrom')"
              />
              <span class="avail-range-dash" aria-hidden="true">-</span>
              <AvailabilityTimeSelect
                v-model="period.to"
                class="avail-period-time"
                :aria-label="t('listing.whTo')"
              />
              <span class="avail-price">
                <input
                  type="text"
                  inputmode="numeric"
                  autocomplete="off"
                  class="avail-price-input"
                  :aria-label="t('listing.whPeriodPrice')"
                  :value="formatRsdInput(period.price)"
                  @input="period.price = applyRsdInput($event)"
                />
                <span class="avail-price-suffix">{{ priceSuffix }}</span>
              </span>
              <button
                type="button"
                class="avail-icon-btn"
                :aria-label="t('listing.whRemovePeriod')"
                @click="dayPeriods[day.value].splice(i, 1)"
              >
                <img src="/images/icons/remove-x-muted.svg" alt="" />
              </button>
            </div>
          </div>
          <div class="avail-actions">
            <button type="button" class="avail-link" @click="addPeriod(dayPeriods[day.value])">
              + {{ t('listing.whAddPeriod') }}
            </button>
            <button
              v-if="enabledDaysList.length > 1"
              type="button"
              class="avail-link"
              @click="copyDayToOthers(day.value)"
            >
              {{ t('listing.whCopyToOtherDays') }}
            </button>
          </div>
        </div>
      </template>

      <p v-if="crossesMidnightAny" class="avail-hint">{{ t('listing.whMidnightCrossHint') }}</p>
      <p v-if="hasBreakAny" class="avail-hint">{{ t('listing.whBreakHint') }}</p>
      <!-- 1700:4006, without the frame's note about the removed button. -->
      <p class="avail-hint">{{ emptyPriceNote }}</p>
      <p v-if="editorError" class="avail-error">
        <img src="/images/icons/field-error.svg" alt="" />{{ editorError }}
      </p>
    </section>

    <!-- 1700:4007: blocking a date and pricing a date's window are one choice with two tabs. -->
    <section class="avail-section avail-section-exceptions">
      <p class="avail-label">
        {{ t('listing.whExceptions') }}
        <span class="avail-label-note">{{ t('listing.whExceptionsCaption') }}</span>
      </p>
      <!-- 1700:4013 -->
      <div class="avail-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          class="avail-tab"
          :class="{ 'is-active': exceptionTab === 'block' }"
          :aria-selected="exceptionTab === 'block'"
          @click="selectExceptionTab('block')"
        >
          {{ t('listing.whExceptionTabBlock') }}
        </button>
        <button
          type="button"
          role="tab"
          class="avail-tab"
          :class="{ 'is-active': exceptionTab === 'price' }"
          :aria-selected="exceptionTab === 'price'"
          @click="selectExceptionTab('price')"
        >
          {{ t('listing.whSpecialPrice') }}
        </button>
      </div>
      <div v-if="exceptionTab === 'block'" class="avail-exception-row">
        <AvailabilityDateField
          v-model="blockDate"
          class="avail-exception-date-sm"
          :listing-id="listingId"
          :placeholder="t('listing.datePlaceholder')"
          :aria-label="t('listing.whExceptionTabBlock')"
        />
        <button type="button" class="avail-btn" :disabled="blockingDate" @click="blockWholeDate">
          {{ blockDateSaved ? t('common.savedButton') : t('listing.whAddException') }}
        </button>
      </div>
      <!-- 1700:4018 -->
      <div v-else class="avail-exception-row">
        <AvailabilityDateField
          v-model="overrideDate"
          class="avail-exception-date-sm"
          :listing-id="listingId"
          :placeholder="t('listing.datePlaceholder')"
          :aria-label="t('listing.whSpecialPrice')"
        />
        <AvailabilityTimeSelect
          v-model="overrideFrom"
          class="avail-exception-time"
          :aria-label="t('listing.whFrom')"
        />
        <AvailabilityTimeSelect
          v-model="overrideTo"
          class="avail-exception-time"
          :aria-label="t('listing.whTo')"
        />
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
          {{ t('listing.whAddException') }}
        </button>
      </div>
      <p v-if="exceptionsError" class="avail-error">
        <img src="/images/icons/field-error.svg" alt="" />{{ exceptionsError }}
      </p>

      <!-- 1700:4036: both kinds of exception in one list, by date. -->
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
          <button type="button" class="avail-link" @click="item.remove">
            {{ t('listing.whRemove') }}
          </button>
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

let periodKeys = 0
function makePeriod({ from, to, price = null }) {
  periodKeys += 1
  return { key: periodKeys, from, to, price }
}
function copyPeriods(periods) {
  return periods.map((period) => makePeriod(period))
}

const enabledDays = ref(new Set())
// One list of periods for every open day, or (T104) one per day.
const perDayMode = ref(false)
const commonPeriods = ref([makePeriod({ from: '10:00', to: '22:00' })])
const dayPeriods = ref({})
const enabledDaysList = computed(() => DAYS.filter((d) => enabledDays.value.has(d.value)))
const busy = ref(false)
const editorError = ref('')
const daysError = ref('')

const exceptionTab = ref('block')
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

// The rate step 2 set, per hour or (T111) per guest.
const unitKey = computed(() => (props.priceUnit === 'GUEST' ? 'GUEST' : 'HOUR'))
const priceSuffix = computed(
  () => `RSD / ${t(unitKey.value === 'GUEST' ? 'listing.unitGuest' : 'listing.unitHour')}`,
)
const unitPhrase = computed(() => t(`listing.whPriceUnitPhrase.${unitKey.value}`))
// The weekend price only applies to the hourly rate (pickHourlyPrice).
const weekendApplies = computed(() => unitKey.value === 'HOUR' && Number(props.weekendPrice) > 0)
const scheduleTitle = computed(() => t('listing.whScheduleTitle', { unit: unitPhrase.value }))
const emptyPriceNote = computed(() =>
  t(weekendApplies.value ? 'listing.whEmptyPriceNoteWeekend' : 'listing.whEmptyPriceNote', {
    unit: unitPhrase.value,
  }),
)

// The periods each open day has, as they stand on the form.
const periodsByDay = computed(() =>
  enabledDaysList.value.map((day) => ({
    day,
    periods: perDayMode.value ? dayPeriods.value[day.value] || [] : commonPeriods.value,
  })),
)
const crossesMidnightAny = computed(() =>
  periodsByDay.value.some(({ periods }) => periods.some(crossesMidnight)),
)
const hasBreakAny = computed(() => periodsByDay.value.some(({ periods }) => hasBreak(periods)))

function toggleDay(day) {
  daysError.value = ''
  if (enabledDays.value.has(day)) {
    enabledDays.value.delete(day)
    return
  }
  enabledDays.value.add(day)
  // A day switched on in per-day mode starts from the shared periods.
  if (perDayMode.value && !dayPeriods.value[day])
    dayPeriods.value[day] = copyPeriods(commonPeriods.value)
}

function addPeriod(periods) {
  periods.push(makePeriod(nextPeriod(periods)))
}

function copyDayToOthers(sourceDay) {
  for (const day of enabledDays.value) {
    if (day !== sourceDay) dayPeriods.value[day] = copyPeriods(dayPeriods.value[sourceDay] || [])
  }
}

// T104: switching to per-day mode gives every open day the shared periods to
// start from; switching back leaves the shared ones as they were.
watch(perDayMode, (isPerDay) => {
  if (!isPerDay) return
  for (const day of enabledDays.value) {
    if (!dayPeriods.value[day]) dayPeriods.value[day] = copyPeriods(commonPeriods.value)
  }
})

const rsdFormatter = new Intl.NumberFormat('sr-RS')
function formatPrice(v) {
  return rsdFormatter.format(v)
}

// 1700:4045 "1. januar 2027.", 254:295 "Subota, 12. septembar".
const longDateFormatter = new Intl.DateTimeFormat('sr-Latn-RS', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})
const weekdayFormatter = new Intl.DateTimeFormat('sr-Latn-RS', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

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
    subtitle: t('listing.whExceptionPrice', {
      price: `${formatPrice(o.price)} ${priceSuffix.value}`,
    }),
    remove: () => removeOverride(o.id),
  }))
  return [...blocked, ...priced].sort((a, b) => a.sortKey.localeCompare(b.sortKey))
})

function isDateBlocked(date) {
  const dayStart = date.getTime()
  const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime()
  return blockedDates.value.some(
    (b) => new Date(b.startsAt).getTime() < dayEnd && new Date(b.endsAt).getTime() > dayStart,
  )
}

function addHours(time, hours) {
  return timeOfMinutes(minutesOfTime(time) + hours * 60)
}

function coversTime(from, to, time) {
  return from < to ? from <= time && time < to : time >= from || time < to
}

// The order a booking is priced in: the date's special price, then the
// period's own price, then the weekend price, then the base price.
function resolvePreviewPrice(date, dayOfWeek, startTime, periods) {
  const key = localDateKey(date)
  const override = slotPriceOverrides.value.find(
    (o) => o.date.slice(0, 10) === key && coversTime(o.startTime, o.endTime, startTime),
  )
  if (override) return Number(override.price)
  const period = periods.find((p) => Number(p.price) > 0 && coversTime(p.from, p.to, startTime))
  if (period) return Number(period.price)
  if (weekendApplies.value && (dayOfWeek === 5 || dayOfWeek === 6))
    return Number(props.weekendPrice)
  return Number(props.basePrice) || 0
}

// 254:292 / 1700:3498: the next open day, two hours from the start of its
// last priced period (or of its first period), priced the way a booking would be.
const preview = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let offset = 1; offset <= 62; offset++) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset)
    const dayOfWeek = ((date.getDay() + 6) % 7) + 1
    if (!enabledDays.value.has(dayOfWeek) || isDateBlocked(date)) continue
    const periods = (perDayMode.value ? dayPeriods.value[dayOfWeek] || [] : commonPeriods.value)
      .filter((p) => p.from && p.to)
      .sort((a, b) => a.from.localeCompare(b.from))
    if (!periods.length) continue
    const priced = periods.filter((p) => Number(p.price) > 0)
    const from = priced.length ? priced[priced.length - 1].from : periods[0].from
    const count = unitKey.value === 'GUEST' ? 1 : 2
    const unitPrice = resolvePreviewPrice(date, dayOfWeek, from, periods)
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
  const data = await api.get(`/listings/${props.listingId}/availability`, {
    query: { from: from.toISOString(), to: to.toISOString() },
  })
  const rows = data.workingHours || []
  const ranges = data.hourlyPriceRanges || []
  const days = [...new Set(rows.map((h) => h.dayOfWeek))].sort((a, b) => a - b)
  enabledDays.value = new Set(days)

  // No flag says which mode the owner last used (T104): days whose windows
  // differ, or a price set for one weekday, can only come from per-day mode.
  const windowsOf = (day) =>
    rows.filter((h) => h.dayOfWeek === day).map((h) => ({ startsAt: h.startsAt, endsAt: h.endsAt }))
  const signature = (day) =>
    windowsOf(day)
      .map((w) => `${w.startsAt}-${w.endsAt}`)
      .sort()
      .join(',')
  perDayMode.value =
    new Set(days.map(signature)).size > 1 || ranges.some((r) => r.dayOfWeek != null)

  if (perDayMode.value) {
    dayPeriods.value = Object.fromEntries(
      days.map((day) => [day, copyPeriods(scheduleToPeriods(windowsOf(day), ranges, day))]),
    )
    if (days.length) commonPeriods.value = copyPeriods(dayPeriods.value[days[0]])
  } else if (days.length) {
    commonPeriods.value = copyPeriods(scheduleToPeriods(windowsOf(days[0]), ranges))
  }

  slotPriceOverrides.value = data.slotPriceOverrides || []
  // T34 — only MANUAL blocks are listed/removable here; BOOKING/GAP/ICAL
  // blocks come from elsewhere and aren't this editor's to touch (the
  // backend's own delete endpoint already refuses to remove them).
  blockedDates.value = (data.blocked || []).filter((b) => b.source === 'MANUAL')
}

// The hours and prices the form describes, or the reason they can't be saved.
function buildSchedule() {
  const describe = (period) => `${period.from}-${period.to}`
  const check = (periods, day) => {
    const prefix = day ? 'Day' : ''
    const args = day ? { day: t(day.labelKey) } : {}
    if (!periods.length) return t(`listing.whPeriodsRequired${prefix}`, args)
    const overlap = findOverlap(periods)
    if (overlap) {
      return t(`listing.whPeriodsOverlap${prefix}`, {
        ...args,
        first: describe(overlap[0]),
        second: describe(overlap[1]),
      })
    }
    return ''
  }
  const hours = []
  const ranges = []
  if (!perDayMode.value) {
    const error = check(commonPeriods.value)
    if (error) return { error }
    ranges.push(...periodsToRanges(commonPeriods.value))
  }
  for (const day of enabledDaysList.value) {
    const periods = perDayMode.value ? dayPeriods.value[day.value] || [] : commonPeriods.value
    if (perDayMode.value) {
      const error = check(periods, day)
      if (error) return { error }
      ranges.push(...periodsToRanges(periods, day.value))
    }
    for (const window of periodsToWindows(periods)) hours.push({ dayOfWeek: day.value, ...window })
  }
  return { hours, ranges }
}

// Dizajn 22: "Dostupni dani *" needs at least one day. Returns false without
// saving when something is missing, so the wizard stays on the step.
async function save() {
  editorError.value = ''
  if (!enabledDays.value.size) {
    daysError.value = t('listing.whDaysRequired')
    return false
  }
  const schedule = buildSchedule()
  if (schedule.error) {
    editorError.value = schedule.error
    return false
  }
  busy.value = true
  try {
    await api.post(`/listings/${props.listingId}/availability/working-schedule`, schedule)
    return true
  } catch (e) {
    editorError.value = extractErrorMessage(e, t('auth.genericError'))
    throw e
  } finally {
    busy.value = false
  }
}

// T72: the wizard's main "Sačuvaj i nastavi" saves this step (T141: it is
// the only way it saves); the preview beside the form reads the same periods.
defineExpose({ save, preview })

function selectExceptionTab(tab) {
  exceptionTab.value = tab
  exceptionsError.value = ''
}

// 1700:4034 looks ready before anything is filled in, so a click says what is missing.
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
    const created = await api.post(
      `/listings/${props.listingId}/availability/slot-price-overrides`,
      {
        date: overrideDate.value,
        startTime: overrideFrom.value,
        endTime: overrideTo.value,
        price: overridePrice.value,
      },
    )
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
