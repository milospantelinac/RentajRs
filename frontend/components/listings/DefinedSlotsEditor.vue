<template>
  <!-- Dizajn 22: the Forma column of 532:514 (Definisani termini). -->
  <div class="avail avail-ds">
    <!-- 532:789 -->
    <section class="avail-section">
      <p class="avail-eyebrow">{{ t('listing.dsExistingSlots') }}</p>
      <div class="avail-slots">
        <template v-for="s in slots" :key="s.id">
          <div class="avail-slot">
            <span class="avail-slot-date">{{ formatNumericDate(s.startsAt) }}</span>
            <span class="avail-slot-time">{{ formatTime(s.startsAt) }} - {{ formatTime(s.endsAt) }}</span>
            <span class="avail-slot-price">{{ s.price ? `${formatPrice(s.price)} RSD` : '-' }}</span>
            <!-- T105's copy, kept as a link beside the frame's delete icon. -->
            <button type="button" class="avail-link" :aria-expanded="copyingSlotId === s.id" @click="toggleCopyPanel(s)">
              {{ t('listing.dsCopySlot') }}
            </button>
            <button type="button" class="avail-icon-btn" :aria-label="t('listing.dsRemoveSlot')" @click="removeSlot(s.id)">
              <img src="/images/icons/remove-x-danger.svg" alt="" />
            </button>
          </div>

          <!-- T105: copy this exact term (same time + price) onto more
               dates: manual multi-select, or a weekly "Ponavljaj" shortcut
               that just precomputes which dates a manual pick would need.
               Each result is its own independent DefinedSlot row, same as
               adding one by hand; nothing here tracks "the series" once
               created. -->
          <div v-if="copyingSlotId === s.id" class="avail-copy">
            <div class="avail-copy-row">
              <button type="button" class="avail-btn" :class="{ 'is-active': copyMode === 'manual' }" @click="copyMode = 'manual'">
                {{ t('listing.dsCopyManual') }}
              </button>
              <button type="button" class="avail-btn" :class="{ 'is-active': copyMode === 'repeat' }" @click="copyMode = 'repeat'">
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
                <button type="button" class="avail-link" @click="copyDates.push('')">+ {{ t('listing.dsCopyAddDate') }}</button>
              </div>
            </template>

            <template v-else>
              <div class="avail-copy-row">
                <label :for="`ds-repeat-day-${s.id}`">{{ t('listing.dsCopyRepeatDay') }}</label>
                <span class="avail-select avail-copy-select">
                  <select :id="`ds-repeat-day-${s.id}`" v-model.number="repeatDayOfWeek" class="avail-select-control">
                    <option v-for="d in WEEKDAYS" :key="d.value" :value="d.value">{{ t(d.labelKey) }}</option>
                  </select>
                  <img src="/images/icons/chevron-down.svg" alt="" />
                </span>
              </div>
              <div class="avail-copy-row">
                <input :id="`ds-repeat-count-${s.id}`" v-model="repeatEndMode" type="radio" value="count" />
                <label :for="`ds-repeat-count-${s.id}`">{{ t('listing.dsCopyRepeatCountLabel') }}</label>
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
                <input :id="`ds-repeat-until-${s.id}`" v-model="repeatEndMode" type="radio" value="until" />
                <label :for="`ds-repeat-until-${s.id}`">{{ t('listing.dsCopyRepeatUntilLabel') }}</label>
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
              <button type="button" class="avail-btn avail-btn-soft" :disabled="copying" @click="confirmCopy(s)">
                {{ copying ? t('common.loading') : t('listing.dsCopyConfirm') }}
              </button>
              <button type="button" class="avail-btn" @click="copyingSlotId = null">{{ t('common.cancel') }}</button>
            </div>

            <p v-if="copyError" class="avail-error"><img src="/images/icons/field-error.svg" alt="" />{{ copyError }}</p>
            <template v-if="copyResult">
              <p v-if="copyResult.created" class="avail-success">{{ t('listing.dsCopyResultCreated', { count: copyResult.created }) }}</p>
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
    </section>

    <!-- 532:822 -->
    <section class="avail-section">
      <p class="avail-eyebrow">{{ t('listing.dsAddTitle') }}</p>
      <div class="avail-add">
        <div class="avail-add-field avail-add-date">
          <label for="ds-date" class="avail-add-label">{{ t('listing.dsDate') }}<span class="avail-add-required">*</span></label>
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
          <label for="ds-from" class="avail-add-label">{{ t('listing.dsFrom') }}<span class="avail-add-required">*</span></label>
          <AvailabilityTimeSelect id="ds-from" v-model="form.from" variant="boxed" />
        </div>
        <div class="avail-add-field avail-add-time">
          <label for="ds-to" class="avail-add-label">{{ t('listing.dsTo') }}<span class="avail-add-required">*</span></label>
          <AvailabilityTimeSelect id="ds-to" v-model="form.to" variant="boxed" />
        </div>
        <div class="avail-add-field avail-add-price">
          <label for="ds-price" class="avail-add-label">{{ t('listing.price') }} (RSD)<span class="avail-add-required">*</span></label>
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
      <p v-if="addError" class="avail-error"><img src="/images/icons/field-error.svg" alt="" />{{ addError }}</p>
      <button type="button" class="avail-btn avail-btn-outline" :disabled="busy" @click="addSlot">+ {{ t('listing.dsAddSlot') }}</button>
      <p class="avail-note">{{ t('listing.dsNote') }}</p>
    </section>

    <!-- 532:684: Dodavanje Oglasa spec §3, block a whole date. -->
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
      <p v-if="blockError" class="avail-error"><img src="/images/icons/field-error.svg" alt="" />{{ blockError }}</p>
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
          <button type="button" class="avail-link" @click="removeBlockedDate(b.id)">{{ t('listing.whRemove') }}</button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
const props = defineProps({
  listingId: { type: String, required: true },
})

const { t } = useI18n()
const api = useApi()

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

// T105 — "Kopiraj termin"
const WEEKDAYS = [
  { value: 1, labelKey: 'listing.dayMon' },
  { value: 2, labelKey: 'listing.dayTue' },
  { value: 3, labelKey: 'listing.dayWed' },
  { value: 4, labelKey: 'listing.dayThu' },
  { value: 5, labelKey: 'listing.dayFri' },
  { value: 6, labelKey: 'listing.daySat' },
  { value: 7, labelKey: 'listing.daySun' },
]
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
    copyMode.value === 'manual' ? copyDates.value.filter(Boolean) : computeRepeatDates(new Date(slot.startsAt))
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
        slots.value.push({ id: createdSlot.id, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), price: slot.price ?? null })
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

// 532:793 "12. 9. 2026.", 532:794 "09:00", 532:795 "4.500 RSD".
const numericDateFormatter = new Intl.DateTimeFormat('sr-Latn-RS', { day: 'numeric', month: 'numeric', year: 'numeric' })
const longDateFormatter = new Intl.DateTimeFormat('sr-Latn-RS', { day: 'numeric', month: 'long', year: 'numeric' })
const weekdayFormatter = new Intl.DateTimeFormat('sr-Latn-RS', { weekday: 'long', day: 'numeric', month: 'long' })
const rsdFormatter = new Intl.NumberFormat('sr-RS')

function formatNumericDate(v) {
  return numericDateFormatter.format(new Date(v))
}
function formatLongDate(v) {
  return longDateFormatter.format(new Date(v))
}
function formatTime(v) {
  return timeOf(new Date(v))
}
function formatPrice(v) {
  return rsdFormatter.format(v)
}

function onPriceInput(event) {
  form.price = applyRsdInput(event)
  addError.value = ''
}

async function load() {
  const from = new Date()
  const to = new Date(Date.now() + 1000 * 60 * 60 * 24 * 180)
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
}

// 532:694 looks ready before a date is picked, so a click says what is missing.
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
    return start > now && !allBlocked.value.some((b) => new Date(b.startsAt).getTime() < end && new Date(b.endsAt).getTime() > start)
  })
  if (!open.length) return null
  const firstDay = dateInputValue(new Date(open[0].startsAt))
  const daySlots = open.filter((s) => dateInputValue(new Date(s.startsAt)) === firstDay).slice(0, 3)
  const label = weekdayFormatter.format(new Date(open[0].startsAt))
  return {
    date: label.charAt(0).toUpperCase() + label.slice(1),
    selectedIndex: daySlots.length > 1 ? 1 : 0,
    slots: daySlots.map((s) => ({
      id: s.id,
      time: `${formatTime(s.startsAt)} - ${formatTime(s.endsAt)}`,
      price: s.price ? `${formatPrice(s.price)} RSD` : '-',
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
