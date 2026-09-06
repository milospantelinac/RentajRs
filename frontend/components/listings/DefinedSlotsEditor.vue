<template>
  <div class="ds-editor">
    <p class="text-label mb-2">{{ t('listing.dsExistingSlots') }}</p>
    <ul v-if="slots.length" class="ds-list mb-3">
      <li v-for="s in slots" :key="s.id">
        <div class="ds-row">
          <span>{{ formatDateTime(s.startsAt) }} — {{ formatTime(s.endsAt) }}</span>
          <span>{{ s.price ? `${formatPrice(s.price)} RSD` : '—' }}</span>
          <span class="ds-row-actions">
            <button type="button" class="btn-link" @click="toggleCopyPanel(s)">{{ t('listing.dsCopySlot') }}</button>
            <button type="button" class="btn-link-danger" @click="removeSlot(s.id)">✕</button>
          </span>
        </div>

        <!-- T105 — copy this exact term (same time + price) onto more
             dates: manual multi-select, or a weekly "Ponavljaj" shortcut
             that just precomputes which dates a manual pick would need.
             Each result is its own independent DefinedSlot row, same as
             adding one by hand — nothing here tracks "the series" once
             created. -->
        <div v-if="copyingSlotId === s.id" class="ds-copy-panel">
          <div class="ds-copy-mode-toggle">
            <button
              type="button"
              class="btn btn-tertiary btn-sm"
              :class="{ 'ds-copy-mode-active': copyMode === 'manual' }"
              @click="copyMode = 'manual'"
            >{{ t('listing.dsCopyManual') }}</button>
            <button
              type="button"
              class="btn btn-tertiary btn-sm"
              :class="{ 'ds-copy-mode-active': copyMode === 'repeat' }"
              @click="copyMode = 'repeat'"
            >{{ t('listing.dsCopyRepeat') }}</button>
          </div>

          <template v-if="copyMode === 'manual'">
            <div v-for="(d, i) in copyDates" :key="i" class="ds-copy-date-row">
              <input v-model="copyDates[i]" type="date" class="form-control" />
              <button type="button" class="btn-link-danger" :disabled="copyDates.length === 1" @click="copyDates.splice(i, 1)">✕</button>
            </div>
            <button type="button" class="btn btn-tertiary btn-sm mt-1" @click="copyDates.push('')">+ {{ t('listing.dsCopyAddDate') }}</button>
          </template>

          <template v-else>
            <div class="form-group mb-2">
              <label class="form-label">{{ t('listing.dsCopyRepeatDay') }}</label>
              <select v-model.number="repeatDayOfWeek" class="form-control form-select">
                <option v-for="d in WEEKDAYS" :key="d.value" :value="d.value">{{ t(d.labelKey) }}</option>
              </select>
            </div>
            <div class="ds-copy-repeat-end">
              <label class="form-row-inline">
                <input v-model="repeatEndMode" type="radio" value="count" />
                {{ t('listing.dsCopyRepeatCountLabel') }}
                <input
                  v-model.number="repeatCount"
                  type="number"
                  min="1"
                  :max="MAX_REPEAT_DATES"
                  class="form-control ds-copy-repeat-count"
                  :disabled="repeatEndMode !== 'count'"
                />
              </label>
              <label class="form-row-inline mt-2">
                <input v-model="repeatEndMode" type="radio" value="until" />
                {{ t('listing.dsCopyRepeatUntilLabel') }}
                <input
                  v-model="repeatUntilDate"
                  type="date"
                  class="form-control ds-copy-repeat-until"
                  :disabled="repeatEndMode !== 'until'"
                />
              </label>
            </div>
          </template>

          <div class="ds-copy-actions mt-2">
            <button type="button" class="btn btn-primary-flat btn-sm" :disabled="copying" @click="confirmCopy(s)">
              {{ copying ? t('common.loading') : t('listing.dsCopyConfirm') }}
            </button>
            <button type="button" class="btn btn-tertiary btn-sm" @click="copyingSlotId = null">{{ t('common.cancel') }}</button>
          </div>

          <p v-if="copyError" class="form-error mt-2">{{ copyError }}</p>
          <div v-if="copyResult" class="ds-copy-result mt-2">
            <p v-if="copyResult.created" class="text-success mb-1">
              {{ t('listing.dsCopyResultCreated', { count: copyResult.created }) }}
            </p>
            <template v-if="copyResult.skipped.length">
              <p class="form-error mb-1">{{ t('listing.dsCopyResultSkippedIntro') }}</p>
              <ul class="ds-copy-skipped-list">
                <li v-for="(msg, i) in copyResult.skipped" :key="i">{{ msg }}</li>
              </ul>
            </template>
          </div>
        </div>
      </li>
    </ul>
    <p v-else class="text-muted mb-3">{{ t('listing.dsNoSlots') }}</p>

    <div class="ds-form">
      <div class="form-group mb-2">
        <label class="form-label">{{ t('listing.dsDate') }}</label>
        <input v-model="form.date" type="date" class="form-control" />
      </div>
      <div class="row">
        <div class="col-6">
          <div class="form-group mb-2">
            <label class="form-label">{{ t('listing.dsFrom') }}</label>
            <input v-model="form.from" type="time" class="form-control" />
          </div>
        </div>
        <div class="col-6">
          <div class="form-group mb-2">
            <label class="form-label">{{ t('listing.dsTo') }}</label>
            <input v-model="form.to" type="time" class="form-control" />
          </div>
        </div>
      </div>
      <div class="form-group mb-3">
        <label class="form-label">{{ t('listing.price') }} (RSD) *</label>
        <input v-model.number="form.price" type="number" min="1" class="form-control" />
      </div>
      <button type="button" class="btn btn-primary-flat btn-sm" :disabled="busy || !canAdd" @click="addSlot">
        + {{ t('listing.dsAddSlot') }}
      </button>
      <p v-if="editorError" class="form-error mt-2">{{ editorError }}</p>
    </div>

    <!-- Izuzeci — blokirati ceo datum (Dodavanje Oglasa spec §3). -->
    <div class="mt-4">
      <p class="text-label mb-2">{{ t('listing.whExceptions') }}</p>
      <div class="wh-exception-row">
        <input v-model="blockDate" type="date" class="form-control" />
        <button type="button" class="btn btn-tertiary btn-sm" :disabled="!blockDate || blockingDate" @click="blockWholeDate">
          {{ blockDateSaved ? t('common.savedButton') : t('listing.whBlockDate') }}
        </button>
      </div>
      <ul v-if="blockedDates.length" class="ds-list mt-2">
        <li v-for="b in blockedDates" :key="b.id" class="ds-row">
          <span>{{ formatDate(b.startsAt) }}</span>
          <button type="button" class="btn-link-danger" @click="removeBlockedDate(b.id)">✕</button>
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

const slots = ref([])
const busy = ref(false)
const editorError = ref('')
const blockDate = ref('')
const blockedDates = ref([])
const blockingDate = ref(false)
const blockDateSaved = ref(false)

const form = reactive({ date: '', from: '10:00', to: '12:00', price: null })

const canAdd = computed(() => form.date && form.from && form.to)

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

function formatDateTime(v) {
  return new Date(v).toLocaleString('sr-RS', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function formatTime(v) {
  return new Date(v).toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' })
}
function formatPrice(v) {
  return new Intl.NumberFormat('sr-RS').format(v)
}
function formatDate(v) {
  return new Date(v).toLocaleDateString('sr-RS')
}

async function load() {
  const from = new Date()
  const to = new Date(Date.now() + 1000 * 60 * 60 * 24 * 180)
  const data = await api.get(`/listings/${props.listingId}/availability`, {
    query: { from: from.toISOString(), to: to.toISOString() },
  })
  slots.value = data.definedSlots || []
  // T34 — only MANUAL blocks are listed/removable here; BOOKING/GAP/ICAL
  // blocks come from elsewhere and aren't this editor's to touch (the
  // backend's own delete endpoint already refuses to remove them).
  blockedDates.value = (data.blocked || []).filter((b) => b.source === 'MANUAL')
}

async function addSlot() {
  busy.value = true
  editorError.value = ''
  try {
    const startsAt = new Date(`${form.date}T${form.from}:00`)
    const endsAt = new Date(`${form.date}T${form.to}:00`)
    const created = await api.post(`/listings/${props.listingId}/availability/slots`, {
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      price: form.price || undefined,
    })
    // T75 — build the just-added row from what the owner actually typed
    // rather than the raw response, so it renders correctly before the
    // round-trip completes.
    slots.value.push({
      id: created.id,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      price: form.price || null,
    })
    slots.value.sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
    form.price = null
  } catch (e) {
    editorError.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    busy.value = false
  }
}

async function removeSlot(id) {
  await api.delete(`/listings/${props.listingId}/availability/slots/${id}`)
  slots.value = slots.value.filter((s) => s.id !== id)
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

onMounted(load)

// T26 — the wizard's step validation needs to know whether at least one
// slot exists before letting the owner move past this step; `slots` is
// otherwise local to this component.
defineExpose({ slots })
</script>

<style lang="scss" scoped>
.ds-list {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ds-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  font-size: $font-size-muted;
  padding: 8px 10px;
  border: 1px solid $color-border;
  border-radius: 8px;
}

.wh-exception-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.btn-link-danger {
  background: none;
  border: none;
  color: $color-error;
  cursor: pointer;
  font-size: 12px;
}

.ds-row-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.btn-link {
  background: none;
  border: none;
  color: $color-primary;
  cursor: pointer;
  font-size: 12px;
  padding: 0;
}

.ds-copy-panel {
  margin-top: 6px;
  padding: 12px;
  border: 1px dashed $color-border;
  border-radius: 8px;
  font-size: $font-size-muted;
}

.ds-copy-mode-toggle {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.ds-copy-mode-active {
  border-color: $color-primary;
  color: $color-primary;
}

.ds-copy-date-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.ds-copy-repeat-end {
  display: flex;
  flex-direction: column;
}

.ds-copy-repeat-count,
.ds-copy-repeat-until {
  width: auto;
  display: inline-block;
  margin-left: 6px;
}

.ds-copy-actions {
  display: flex;
  gap: 8px;
}

.ds-copy-skipped-list {
  margin: 0;
  padding-left: 18px;
  color: $color-error;
}
</style>
