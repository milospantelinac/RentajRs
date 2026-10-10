<template>
  <!-- T141: the Forma column of 1701:3269 (Definisani termini, simplified);
       Dizajn 22's 532:514 for the parts it keeps (adding one slot, blocking a date). -->
  <div class="avail avail-ds">
    <!-- 1701:3879: the days and the slots of each of them, made from once. -->
    <section class="avail-section">
      <!-- 1701:3881: the asterisk in the title's own colour. -->
      <p id="ds-days-label" class="avail-label">{{ t('listing.dsTemplateTitle') }} *</p>
      <div class="avail-days" role="group" aria-labelledby="ds-days-label">
        <label
          v-for="d in WEEKDAYS"
          :key="d.value"
          class="avail-day"
          :class="{ 'is-on': templateDays.has(d.value) }"
        >
          <input
            type="checkbox"
            class="visually-hidden"
            :checked="templateDays.has(d.value)"
            @change="toggleTemplateDay(d.value)"
          />
          <span class="avail-day-box" aria-hidden="true">
            <img v-if="templateDays.has(d.value)" src="/images/icons/day-check.svg" alt="" />
          </span>
          {{ t(d.labelKey) }}
        </label>
      </div>
      <p class="avail-hint">{{ t('listing.dsTemplateHint') }}</p>
      <div v-if="templateRows.length" class="avail-periods">
        <div v-for="(row, i) in templateRows" :key="row.key" class="avail-period">
          <AvailabilityTimeSelect
            v-model="row.from"
            class="avail-period-time"
            :aria-label="t('listing.dsFrom')"
          />
          <span class="avail-range-dash" aria-hidden="true">-</span>
          <AvailabilityTimeSelect
            v-model="row.to"
            class="avail-period-time"
            :aria-label="t('listing.dsTo')"
          />
          <span class="avail-price">
            <input
              type="text"
              inputmode="numeric"
              autocomplete="off"
              class="avail-price-input"
              :aria-label="priceLabel"
              :value="formatRsdInput(row.price)"
              @input="row.price = applyRsdInput($event)"
            />
            <span class="avail-price-suffix">{{ priceSuffix }}</span>
          </span>
          <button
            type="button"
            class="avail-icon-btn"
            :aria-label="t('listing.dsRemoveTemplateSlot')"
            @click="templateRows.splice(i, 1)"
          >
            <img src="/images/icons/remove-x-muted.svg" alt="" />
          </button>
        </div>
      </div>
      <button type="button" class="avail-link avail-add-link" @click="addTemplateRow">
        + {{ t('listing.dsAddTemplateSlot') }}
      </button>
    </section>

    <!-- 1701:3968: the dates the slots above are made for. -->
    <section class="avail-section">
      <p class="avail-label">{{ t('listing.dsRangeTitle') }}</p>
      <div class="avail-range-row">
        <div class="avail-add-field avail-add-date">
          <label for="ds-range-from" class="avail-add-label"
            >{{ t('listing.dsRangeFrom') }}<span class="avail-add-required">*</span></label
          >
          <AvailabilityDateField
            id="ds-range-from"
            v-model="rangeFrom"
            variant="boxed"
            :listing-id="listingId"
            :placeholder="t('listing.datePlaceholder')"
          />
        </div>
        <div class="avail-add-field avail-add-date">
          <label for="ds-range-to" class="avail-add-label"
            >{{ t('listing.dsRangeTo') }}<span class="avail-add-required">*</span></label
          >
          <AvailabilityDateField
            id="ds-range-to"
            v-model="rangeTo"
            variant="boxed"
            :listing-id="listingId"
            :placeholder="t('listing.datePlaceholder')"
          />
        </div>
        <button
          type="button"
          class="avail-btn avail-btn-outline"
          :disabled="generating"
          @click="generate"
        >
          {{ generating ? t('common.loading') : t('listing.dsGenerate') }}
        </button>
      </div>
      <p v-if="generateError" class="avail-error">
        <img src="/images/icons/field-error.svg" alt="" />{{ generateError }}
      </p>
      <p v-if="generateResult" :class="generateResult.created ? 'avail-success' : 'avail-hint'">
        {{ generateResultText }}
      </p>
      <!-- 1701:3989 -->
      <p class="avail-note">{{ plannedText }}</p>
    </section>

    <!-- 1701:3332 -->
    <section class="avail-section">
      <p class="avail-eyebrow">{{ t('listing.dsMadeTitle', { count: slots.length }) }}</p>
      <p class="avail-hint">{{ t('listing.dsMadeHint') }}</p>
      <div class="avail-slots">
        <template v-for="s in visibleSlots" :key="s.id">
          <div class="avail-slot">
            <span class="avail-slot-date">{{ formatNumericDate(s.startsAt) }}</span>
            <span class="avail-slot-time"
              >{{ formatTime(s.startsAt) }} - {{ formatTime(s.endsAt) }}</span
            >
            <span class="avail-slot-price">{{ s.price ? slotPriceText(s.price) : '-' }}</span>
            <span class="avail-slot-actions">
              <!-- 1704:3269 -->
              <button
                type="button"
                class="avail-link"
                :aria-expanded="editingSlotId === s.id"
                @click="toggleEdit(s)"
              >
                {{ t('listing.dsEditSlot') }}
              </button>
              <!-- T105's copy, kept beside "Izmeni" (T141 point 2b). -->
              <button
                type="button"
                class="avail-link"
                :aria-expanded="copyingSlotId === s.id"
                @click="toggleCopyPanel(s)"
              >
                {{ t('listing.dsCopySlot') }}
              </button>
              <button
                type="button"
                class="avail-icon-btn"
                :aria-label="t('listing.dsRemoveSlot')"
                @click="removeSlot(s.id)"
              >
                <img src="/images/icons/remove-x-danger.svg" alt="" />
              </button>
            </span>
          </div>

          <!-- T141 "Izmeni": this one slot's date, times and price; no other slot changes. -->
          <div v-if="editingSlotId === s.id" class="avail-copy">
            <div class="avail-copy-row">
              <AvailabilityDateField
                v-model="editForm.date"
                class="avail-copy-date"
                variant="boxed"
                :listing-id="listingId"
                :placeholder="t('listing.datePlaceholder')"
                :aria-label="t('listing.dsDate')"
              />
              <AvailabilityTimeSelect
                v-model="editForm.from"
                class="avail-copy-time"
                variant="boxed"
                :aria-label="t('listing.dsFrom')"
              />
              <AvailabilityTimeSelect
                v-model="editForm.to"
                class="avail-copy-time"
                variant="boxed"
                :aria-label="t('listing.dsTo')"
              />
              <input
                type="text"
                inputmode="numeric"
                autocomplete="off"
                class="avail-add-input avail-copy-price"
                :aria-label="priceLabel"
                :value="formatRsdInput(editForm.price)"
                @input="editForm.price = applyRsdInput($event)"
              />
            </div>
            <div class="avail-copy-row">
              <button
                type="button"
                class="avail-btn avail-btn-soft"
                :disabled="savingEdit"
                @click="saveEdit(s)"
              >
                {{ savingEdit ? t('common.loading') : t('common.save') }}
              </button>
              <button type="button" class="avail-btn" @click="editingSlotId = null">
                {{ t('common.cancel') }}
              </button>
            </div>
            <p v-if="editError" class="avail-error">
              <img src="/images/icons/field-error.svg" alt="" />{{ editError }}
            </p>
          </div>

          <!-- T105: copy this exact term (same time + price) onto more
               dates: manual multi-select, or a weekly "Ponavljaj" shortcut
               that just precomputes which dates a manual pick would need.
               Each result is its own independent DefinedSlot row, same as
               adding one by hand; nothing here tracks "the series" once
               created. -->
          <div v-if="copyingSlotId === s.id" class="avail-copy">
            <div class="avail-copy-row">
              <button
                type="button"
                class="avail-btn"
                :class="{ 'is-active': copyMode === 'manual' }"
                @click="copyMode = 'manual'"
              >
                {{ t('listing.dsCopyManual') }}
              </button>
              <button
                type="button"
                class="avail-btn"
                :class="{ 'is-active': copyMode === 'repeat' }"
                @click="copyMode = 'repeat'"
              >
                {{ t('listing.dsCopyRepeat') }}
              </button>
            </div>

            <template v-if="copyMode === 'manual'">
              <div v-for="(d, i) in copyDates" :key="i" class="avail-copy-row">
                <AvailabilityDateField
                  v-model="copyDates[i]"
                  class="avail-copy-date"
                  variant="boxed"
                  :listing-id="listingId"
                  :placeholder="t('listing.datePlaceholder')"
                  :aria-label="t('listing.dsDate')"
                />
                <button
                  type="button"
                  class="avail-icon-btn"
                  :disabled="copyDates.length === 1"
                  :aria-label="t('listing.whRemove')"
                  @click="copyDates.splice(i, 1)"
                >
                  <img src="/images/icons/remove-x-muted.svg" alt="" />
                </button>
              </div>
              <div class="avail-copy-row">
                <button type="button" class="avail-link" @click="copyDates.push('')">
                  + {{ t('listing.dsCopyAddDate') }}
                </button>
              </div>
            </template>

            <template v-else>
              <div class="avail-copy-row">
                <label :for="`ds-repeat-day-${s.id}`">{{ t('listing.dsCopyRepeatDay') }}</label>
                <span class="avail-select avail-copy-select">
                  <select
                    :id="`ds-repeat-day-${s.id}`"
                    v-model.number="repeatDayOfWeek"
                    class="avail-select-control"
                  >
                    <option v-for="d in WEEKDAYS" :key="d.value" :value="d.value">
                      {{ t(d.labelKey) }}
                    </option>
                  </select>
                  <img src="/images/icons/chevron-down.svg" alt="" />
                </span>
              </div>
              <div class="avail-copy-row">
                <input
                  :id="`ds-repeat-count-${s.id}`"
                  v-model="repeatEndMode"
                  type="radio"
                  value="count"
                />
                <label :for="`ds-repeat-count-${s.id}`">{{
                  t('listing.dsCopyRepeatCountLabel')
                }}</label>
                <input
                  v-model.number="repeatCount"
                  type="number"
                  min="1"
                  :max="MAX_REPEAT_DATES"
                  class="avail-add-input avail-copy-count"
                  :aria-label="t('listing.dsCopyRepeatCountLabel')"
                  :disabled="repeatEndMode !== 'count'"
                />
              </div>
              <div class="avail-copy-row">
                <input
                  :id="`ds-repeat-until-${s.id}`"
                  v-model="repeatEndMode"
                  type="radio"
                  value="until"
                />
                <label :for="`ds-repeat-until-${s.id}`">{{
                  t('listing.dsCopyRepeatUntilLabel')
                }}</label>
                <AvailabilityDateField
                  v-model="repeatUntilDate"
                  class="avail-copy-date"
                  variant="boxed"
                  :listing-id="listingId"
                  :placeholder="t('listing.datePlaceholder')"
                  :aria-label="t('listing.dsCopyRepeatUntilLabel')"
                />
              </div>
            </template>

            <div class="avail-copy-row">
              <button
                type="button"
                class="avail-btn avail-btn-soft"
                :disabled="copying"
                @click="confirmCopy(s)"
              >
                {{ copying ? t('common.loading') : t('listing.dsCopyConfirm') }}
              </button>
              <button type="button" class="avail-btn" @click="copyingSlotId = null">
                {{ t('common.cancel') }}
              </button>
            </div>

            <p v-if="copyError" class="avail-error">
              <img src="/images/icons/field-error.svg" alt="" />{{ copyError }}
            </p>
            <template v-if="copyResult">
              <p v-if="copyResult.created" class="avail-success">
                {{ t('listing.dsCopyResultCreated', { count: copyResult.created }) }}
              </p>
              <template v-if="copyResult.skipped.length">
                <p class="avail-error">{{ t('listing.dsCopyResultSkippedIntro') }}</p>
                <ul class="avail-copy-list">
                  <li v-for="(msg, i) in copyResult.skipped" :key="i">{{ msg }}</li>
                </ul>
              </template>
            </template>
          </div>
        </template>
        <p v-if="!slots.length" class="avail-slots-empty">{{ t('listing.dsNoSlots') }}</p>
      </div>
      <button
        v-if="hiddenSlotCount"
        type="button"
        class="avail-link avail-add-link"
        @click="shownSlots += SLOT_PAGE"
      >
        {{ t('listing.dsShowMore', { count: hiddenSlotCount }) }}
      </button>
    </section>

    <!-- 532:822: one slot by hand, kept beside the generator (T141 point 2b). -->
    <section class="avail-section">
      <p class="avail-eyebrow">{{ t('listing.dsAddTitle') }}</p>
      <div class="avail-add">
        <div class="avail-add-field avail-add-date">
          <label for="ds-date" class="avail-add-label"
            >{{ t('listing.dsDate') }}<span class="avail-add-required">*</span></label
          >
          <AvailabilityDateField
            id="ds-date"
            v-model="form.date"
            variant="boxed"
            :listing-id="listingId"
            :placeholder="t('listing.datePlaceholder')"
            @update:model-value="addError = ''"
          />
        </div>
        <div class="avail-add-field avail-add-time">
          <label for="ds-from" class="avail-add-label"
            >{{ t('listing.dsFrom') }}<span class="avail-add-required">*</span></label
          >
          <AvailabilityTimeSelect id="ds-from" v-model="form.from" variant="boxed" />
        </div>
        <div class="avail-add-field avail-add-time">
          <label for="ds-to" class="avail-add-label"
            >{{ t('listing.dsTo') }}<span class="avail-add-required">*</span></label
          >
          <AvailabilityTimeSelect id="ds-to" v-model="form.to" variant="boxed" />
        </div>
        <div class="avail-add-field avail-add-price">
          <label for="ds-price" class="avail-add-label"
            >{{ priceLabel }}<span class="avail-add-required">*</span></label
          >
          <input
            id="ds-price"
            type="text"
            inputmode="numeric"
            autocomplete="off"
            class="avail-add-input"
            :class="{ 'is-invalid': addError && !form.price }"
            :value="formatRsdInput(form.price)"
            @input="onPriceInput"
          />
        </div>
      </div>
      <p v-if="addError" class="avail-error">
        <img src="/images/icons/field-error.svg" alt="" />{{ addError }}
      </p>
      <button type="button" class="avail-btn avail-btn-outline" :disabled="busy" @click="addSlot">
        + {{ t('listing.dsAddSlot') }}
      </button>
    </section>

    <!-- 1701:3402: Dodavanje Oglasa spec §3, block a whole date. -->
    <section class="avail-section">
      <p class="avail-label">
        {{ t('listing.whExceptions') }}
        <span class="avail-label-note">{{ t('listing.dsExceptionsCaption') }}</span>
      </p>
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
      <p v-if="blockError" class="avail-error">
        <img src="/images/icons/field-error.svg" alt="" />{{ blockError }}
      </p>
      <!-- 239:287's exception list (252:424), which 532:514 leaves out. -->
      <div v-if="blockedDates.length" class="avail-list">
        <p class="avail-list-head">
          {{ t('listing.whExceptionsListTitle') }}
          <img src="/images/icons/info-circle.svg" alt="" />
        </p>
        <div v-for="b in blockedDates" :key="b.id" class="avail-list-row">
          <span class="avail-list-text">
            <span class="avail-list-title">{{ formatLongDate(b.startsAt) }}</span>
            <span class="avail-list-sub">{{ t('listing.whExceptionBlocked') }}</span>
          </span>
          <button type="button" class="avail-link" @click="removeBlockedDate(b.id)">
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
  // T138: SLOT or GUEST, step 2's choice of what a slot's price is for.
  priceUnit: { type: String, default: 'SLOT' },
  // T141: what the slots were last made from (Listing.slotTemplate).
  template: { type: Object, default: null },
})
// T141: the wizard keeps the template a generation saved, for when the step opens again.
const emit = defineEmits(['template-saved'])

const { t } = useI18n()
const api = useApi()

// T138 (with T141's wording): "Cena (RSD / termin)" or "Cena (RSD / gost)",
// and a slot priced per guest says so in the list too.
const perGuest = computed(() => props.priceUnit === 'GUEST')
const priceLabel = computed(() =>
  t('listing.dsPriceLabel', { unit: t(perGuest.value ? 'listing.unitGuest' : 'listing.unitSlot') }),
)
const priceSuffix = computed(
  () => `RSD / ${t(perGuest.value ? 'listing.unitGuest' : 'listing.unitSlot')}`,
)
function slotPriceText(price) {
  return perGuest.value
    ? `${formatPrice(price)} RSD / ${t('listing.unitGuest')}`
    : `${formatPrice(price)} RSD`
}

const WEEKDAYS = [
  { value: 1, labelKey: 'listing.dayMon' },
  { value: 2, labelKey: 'listing.dayTue' },
  { value: 3, labelKey: 'listing.dayWed' },
  { value: 4, labelKey: 'listing.dayThu' },
  { value: 5, labelKey: 'listing.dayFri' },
  { value: 6, labelKey: 'listing.daySat' },
  { value: 7, labelKey: 'listing.daySun' },
]

const slots = ref([])
// Every blocked term, bookings included, so the preview offers what a guest would see.
const allBlocked = ref([])
const busy = ref(false)
const addError = ref('')
const blockDate = ref('')
const blockedDates = ref([])
const blockingDate = ref(false)
const blockDateSaved = ref(false)
const blockError = ref('')

const form = reactive({ date: '', from: '10:00', to: '12:00', price: null })

// -- T141: the template and "Napravi termine" ---------------------------------

let rowKeys = 0
function makeRow({ from, to, price = null }) {
  rowKeys += 1
  return { key: rowKeys, from, to, price }
}

const todayKey = belgradeDayKey(new Date())
// A template whose dates have passed starts again today, as long as it ran before.
function initialRange(template) {
  if (!template?.from || !template?.to) return { from: todayKey, to: addDaysToKey(todayKey, 90) }
  const from = template.from < todayKey ? todayKey : template.from
  const to =
    template.to >= from
      ? template.to
      : addDaysToKey(from, daysBetweenKeys(template.from, template.to))
  return { from, to }
}

const templateDays = ref(new Set(props.template?.days || []))
const templateRows = ref(
  (props.template?.slots?.length
    ? props.template.slots
    : [{ startTime: '10:00', endTime: '12:00', price: null }]
  ).map((row) => makeRow({ from: row.startTime, to: row.endTime, price: row.price })),
)
const range = initialRange(props.template)
const rangeFrom = ref(range.from)
const rangeTo = ref(range.to)
const generating = ref(false)
const generateError = ref('')
const generateResult = ref(null)

function toggleTemplateDay(day) {
  generateError.value = ''
  if (templateDays.value.has(day)) templateDays.value.delete(day)
  else templateDays.value.add(day)
}

function addTemplateRow() {
  templateRows.value.push(makeRow(nextPeriod(templateRows.value)))
}

// What "Napravi termine" sends, or why it can't yet.
function templateProblem() {
  if (!templateDays.value.size) return t('listing.dsTemplateDaysRequired')
  if (!templateRows.value.length || templateRows.value.some((row) => !row.price))
    return t('listing.dsTemplatePriceRequired')
  if (templateRows.value.some((row) => row.from === row.to))
    return t('listing.dsTemplateTimesEqual')
  const overlap = findOverlap(templateRows.value)
  if (overlap) {
    return t('listing.dsTemplateOverlap', {
      first: `${overlap[0].from}-${overlap[0].to}`,
      second: `${overlap[1].from}-${overlap[1].to}`,
    })
  }
  if (!rangeFrom.value || !rangeTo.value) return t('listing.dsRangeRequired')
  if (rangeTo.value < rangeFrom.value) return t('listing.dsRangeBackwards')
  if (daysBetweenKeys(rangeFrom.value, rangeTo.value) > MAX_RANGE_DAYS)
    return t('listing.dsRangeTooLong')
  return ''
}
const MAX_RANGE_DAYS = 365

// The slots already there, by their start's day, so the count below only looks at neighbours.
const takenByDay = computed(() => {
  const map = new Map()
  for (const slot of slots.value) {
    const key = belgradeDayKey(slot.startsAt)
    if (!map.has(key)) map.set(key, [])
    map.get(key).push([new Date(slot.startsAt).getTime(), new Date(slot.endsAt).getTime()])
  }
  return map
})

// How many slots "Napravi termine" would add, the way the backend counts
// them: nothing already past, nothing overlapping a slot that is there.
const plannedCount = computed(() => {
  if (templateProblem()) return null
  const now = Date.now()
  let count = 0
  const span = daysBetweenKeys(rangeFrom.value, rangeTo.value)
  for (let i = 0; i <= span; i++) {
    const key = addDaysToKey(rangeFrom.value, i)
    if (!templateDays.value.has(isoWeekdayOfKey(key))) continue
    const near = [addDaysToKey(key, -1), key, addDaysToKey(key, 1)].flatMap(
      (day) => takenByDay.value.get(day) || [],
    )
    for (const row of templateRows.value) {
      const start = belgradeInstant(key, row.from).getTime()
      if (start <= now) continue
      const end = belgradeInstant(row.to <= row.from ? addDaysToKey(key, 1) : key, row.to).getTime()
      if (!near.some(([takenStart, takenEnd]) => takenStart < end && takenEnd > start)) count += 1
    }
  }
  return count
})

const DAY_SHORT_KEYS = [
  'dsDayMon',
  'dsDayTue',
  'dsDayWed',
  'dsDayThu',
  'dsDayFri',
  'dsDaySat',
  'dsDaySun',
]
// "sub i ned", "pon, sre i pet", "svaki dan".
const templateDaysText = computed(() => {
  const days = [...templateDays.value]
    .sort((a, b) => a - b)
    .map((day) => t(`listing.${DAY_SHORT_KEYS[day - 1]}`))
  if (days.length === 7) return t('listing.dsEveryDay')
  return days.length > 1
    ? `${days.slice(0, -1).join(', ')} ${t('listing.dsAnd')} ${days.at(-1)}`
    : days[0] || ''
})

// 1701:3990
const plannedText = computed(() => {
  const count = plannedCount.value
  if (count === null) return t('listing.dsPlannedIdle')
  if (!count) return t('listing.dsPlannedNone')
  const perDay = templateRows.value.length
  const head = t(`listing.dsPlanned${srPluralCategory(count)}`, { count })
  const each = t(`listing.dsPlannedPerDay${srPluralCategory(perDay)}`, { count: perDay })
  return `${head} (${templateDaysText.value}, ${each}). ${t('listing.dsPlannedTail')}`
})

const generateResultText = computed(() => {
  const result = generateResult.value
  if (!result) return ''
  const made = result.created
    ? t(`listing.dsCreated${srPluralCategory(result.created)}`, { count: result.created })
    : t('listing.dsCreatedNone')
  return result.skipped
    ? `${made} ${t('listing.dsSkippedOverlap', { count: result.skipped })}`
    : made
})

async function generate() {
  generateError.value = ''
  generateResult.value = null
  const problem = templateProblem()
  if (problem) {
    generateError.value = problem
    return
  }
  generating.value = true
  try {
    const result = await api.post(`/listings/${props.listingId}/availability/slots/generate`, {
      days: [...templateDays.value].sort((a, b) => a - b),
      slots: templateRows.value.map((row) => ({
        startTime: row.from,
        endTime: row.to,
        price: row.price,
      })),
      from: rangeFrom.value,
      to: rangeTo.value,
    })
    generateResult.value = result
    emit('template-saved', result.template)
    await load()
  } catch (e) {
    generateError.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    generating.value = false
  }
}

// -- The list of slots --------------------------------------------------------

// A year of weekend slots is a long list; it opens a page at a time.
const SLOT_PAGE = 20
const shownSlots = ref(SLOT_PAGE)
const visibleSlots = computed(() => slots.value.slice(0, shownSlots.value))
const hiddenSlotCount = computed(() => Math.max(0, slots.value.length - shownSlots.value))

const editingSlotId = ref(null)
const editForm = reactive({ date: '', from: '', to: '', price: null })
const editError = ref('')
const savingEdit = ref(false)

function toggleEdit(slot) {
  if (editingSlotId.value === slot.id) {
    editingSlotId.value = null
    return
  }
  copyingSlotId.value = null
  editingSlotId.value = slot.id
  editError.value = ''
  Object.assign(editForm, {
    date: belgradeDayKey(slot.startsAt),
    from: formatTime(slot.startsAt),
    to: formatTime(slot.endsAt),
    price: slot.price,
  })
}

async function saveEdit(slot) {
  editError.value = ''
  if (!editForm.date || !editForm.price) {
    editError.value = t('listing.dsAddIncomplete')
    return
  }
  savingEdit.value = true
  try {
    const updated = await api.patch(`/listings/${props.listingId}/availability/slots/${slot.id}`, {
      date: editForm.date,
      startTime: editForm.from,
      endTime: editForm.to,
      price: editForm.price,
    })
    Object.assign(slot, {
      startsAt: updated.startsAt,
      endsAt: updated.endsAt,
      price: updated.price,
    })
    slots.value.sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
    editingSlotId.value = null
  } catch (e) {
    editError.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    savingEdit.value = false
  }
}

// T105 — "Kopiraj termin"
// A runaway "Ponovi do datuma" (e.g. a decade out) would otherwise fire that
// many sequential create requests; 52 covers a full year of weekly repeats,
// already far beyond anything this feature is meant for.
const MAX_REPEAT_DATES = 52

const copyingSlotId = ref(null)
const copyMode = ref('manual')
const copyDates = ref([''])
const repeatDayOfWeek = ref(1)
const repeatEndMode = ref('count')
const repeatCount = ref(4)
const repeatUntilDate = ref('')
const copying = ref(false)
const copyError = ref('')
const copyResult = ref(null)

function toggleCopyPanel(slot) {
  if (copyingSlotId.value === slot.id) {
    copyingSlotId.value = null
    return
  }
  editingSlotId.value = null
  copyingSlotId.value = slot.id
  copyMode.value = 'manual'
  copyDates.value = ['']
  repeatDayOfWeek.value = ((new Date(slot.startsAt).getDay() + 6) % 7) + 1 // ISO Monday=1
  repeatEndMode.value = 'count'
  repeatCount.value = 4
  repeatUntilDate.value = ''
  copyError.value = ''
  copyResult.value = null
}

function timeOf(d) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
function dateInputValue(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Every date strictly after the original that falls on repeatDayOfWeek, up
// to whichever end condition the owner picked — capped at MAX_REPEAT_DATES.
function computeRepeatDates(originalStartsAt) {
  const dates = []
  const cursor = new Date(originalStartsAt)
  cursor.setHours(0, 0, 0, 0)
  cursor.setDate(cursor.getDate() + 1)
  while (((cursor.getDay() + 6) % 7) + 1 !== repeatDayOfWeek.value) {
    cursor.setDate(cursor.getDate() + 1)
  }
  if (repeatEndMode.value === 'count') {
    const count = Math.min(Math.max(1, repeatCount.value || 0), MAX_REPEAT_DATES)
    for (let i = 0; i < count; i++) {
      dates.push(dateInputValue(cursor))
      cursor.setDate(cursor.getDate() + 7)
    }
  } else if (repeatUntilDate.value) {
    const until = new Date(`${repeatUntilDate.value}T00:00:00`)
    while (cursor <= until && dates.length < MAX_REPEAT_DATES) {
      dates.push(dateInputValue(cursor))
      cursor.setDate(cursor.getDate() + 7)
    }
  }
  return dates
}

async function confirmCopy(slot) {
  copyError.value = ''
  copyResult.value = null

  const targetDates =
    copyMode.value === 'manual'
      ? copyDates.value.filter(Boolean)
      : computeRepeatDates(new Date(slot.startsAt))
  if (!targetDates.length) {
    copyError.value = t('listing.dsCopyNoDatesError')
    return
  }

  copying.value = true
  try {
    const fromTime = timeOf(new Date(slot.startsAt))
    const toTime = timeOf(new Date(slot.endsAt))
    let created = 0
    const skipped = []
    for (const dateStr of targetDates) {
      const startsAt = new Date(`${dateStr}T${fromTime}:00`)
      const endsAt = new Date(`${dateStr}T${toTime}:00`)
      try {
        const createdSlot = await api.post(`/listings/${props.listingId}/availability/slots`, {
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          price: slot.price || undefined,
        })
        slots.value.push({
          id: createdSlot.id,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          price: slot.price ?? null,
        })
        created++
      } catch (e) {
        // T105 — one colliding date must not stop the rest of the batch;
        // the backend's own message already names the exact date/time.
        skipped.push(extractErrorMessage(e, t('auth.genericError')))
      }
    }
    slots.value.sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
    copyResult.value = { created, skipped }
  } finally {
    copying.value = false
  }
}

// 1701:3336 "12. 9. 2026.", 1701:3337 "09:00", 1701:3338 "4.500 RSD", in Belgrade time.
const numericDateFormatter = new Intl.DateTimeFormat('sr-Latn-RS', {
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
  timeZone: 'Europe/Belgrade',
})
const longDateFormatter = new Intl.DateTimeFormat('sr-Latn-RS', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})
const weekdayFormatter = new Intl.DateTimeFormat('sr-Latn-RS', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'Europe/Belgrade',
})
const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Europe/Belgrade',
})
const rsdFormatter = new Intl.NumberFormat('sr-RS')

function formatNumericDate(v) {
  return numericDateFormatter.format(new Date(v))
}
function formatLongDate(v) {
  return longDateFormatter.format(new Date(v))
}
function formatTime(v) {
  return timeFormatter.format(new Date(v))
}
function formatPrice(v) {
  return rsdFormatter.format(v)
}

function onPriceInput(event) {
  form.price = applyRsdInput(event)
  addError.value = ''
}

// Every slot ahead, a year and a bit, so the count above sees what is there.
async function load() {
  const from = new Date()
  const to = new Date(Date.now() + 1000 * 60 * 60 * 24 * 400)
  const data = await api.get(`/listings/${props.listingId}/availability`, {
    query: { from: from.toISOString(), to: to.toISOString() },
  })
  slots.value = data.definedSlots || []
  allBlocked.value = data.blocked || []
  // T34 — only MANUAL blocks are listed/removable here; BOOKING/GAP/ICAL
  // blocks come from elsewhere and aren't this editor's to touch (the
  // backend's own delete endpoint already refuses to remove them).
  blockedDates.value = allBlocked.value.filter((b) => b.source === 'MANUAL')
}

// Dizajn 22: 532:852 marks the price as required too; a slot without one used
// to be booked at the listing's price, which is 0 for defined slots.
async function addSlot() {
  addError.value = ''
  if (!form.date || !form.price) {
    addError.value = t('listing.dsAddIncomplete')
    return
  }
  busy.value = true
  try {
    const startsAt = new Date(`${form.date}T${form.from}:00`)
    const endsAt = new Date(`${form.date}T${form.to}:00`)
    const created = await api.post(`/listings/${props.listingId}/availability/slots`, {
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      price: form.price,
    })
    // T75 — build the just-added row from what the owner actually typed
    // rather than the raw response, so it renders correctly before the
    // round-trip completes.
    slots.value.push({
      id: created.id,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      price: form.price,
    })
    slots.value.sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
    form.price = null
  } catch (e) {
    addError.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    busy.value = false
  }
}

async function removeSlot(id) {
  await api.delete(`/listings/${props.listingId}/availability/slots/${id}`)
  slots.value = slots.value.filter((s) => s.id !== id)
  if (copyingSlotId.value === id) copyingSlotId.value = null
  if (editingSlotId.value === id) editingSlotId.value = null
}

// 1701:3412 looks ready before a date is picked, so a click says what is missing.
async function blockWholeDate() {
  if (!blockDate.value) {
    blockError.value = t('listing.whExceptionDateRequired')
    return
  }
  blockingDate.value = true
  blockError.value = ''
  try {
    const start = new Date(`${blockDate.value}T00:00:00`)
    const end = new Date(start.getTime() + 86400000)
    const created = await api.post(`/listings/${props.listingId}/availability/blocks`, {
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
    })
    blockedDates.value.push(created)
    blockedDates.value.sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
    allBlocked.value.push(created)
    blockDate.value = ''
    blockDateSaved.value = true
    setTimeout(() => {
      blockDateSaved.value = false
    }, 2000)
  } catch (e) {
    blockError.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    blockingDate.value = false
  }
}

async function removeBlockedDate(id) {
  blockError.value = ''
  try {
    await api.delete(`/listings/${props.listingId}/availability/blocks/${id}`)
    blockedDates.value = blockedDates.value.filter((b) => b.id !== id)
    allBlocked.value = allBlocked.value.filter((b) => b.id !== id)
  } catch (e) {
    blockError.value = extractErrorMessage(e, t('auth.genericError'))
  }
}

// 534:515: the first day a guest could book, up to three of its slots, the
// frame's second one shown as picked.
const preview = computed(() => {
  const now = Date.now()
  const open = slots.value.filter((s) => {
    const start = new Date(s.startsAt).getTime()
    const end = new Date(s.endsAt).getTime()
    return (
      start > now &&
      !allBlocked.value.some(
        (b) => new Date(b.startsAt).getTime() < end && new Date(b.endsAt).getTime() > start,
      )
    )
  })
  if (!open.length) return null
  const firstDay = belgradeDayKey(open[0].startsAt)
  const daySlots = open.filter((s) => belgradeDayKey(s.startsAt) === firstDay).slice(0, 3)
  const label = weekdayFormatter.format(new Date(open[0].startsAt))
  return {
    date: label.charAt(0).toUpperCase() + label.slice(1),
    selectedIndex: daySlots.length > 1 ? 1 : 0,
    slots: daySlots.map((s) => ({
      id: s.id,
      time: `${formatTime(s.startsAt)} - ${formatTime(s.endsAt)}`,
      price: s.price ? slotPriceText(s.price) : '-',
    })),
  }
})

onMounted(load)

// T26 — the wizard's step validation needs to know whether at least one
// slot exists before letting the owner move past this step; `slots` is
// otherwise local to this component.
defineExpose({ slots, preview })
</script>

<style lang="scss" scoped>
@use '@/assets/scss/availability-editor';
</style>
