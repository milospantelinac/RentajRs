<template>
  <div class="ds-editor">
    <p class="text-label mb-2">{{ t('listing.dsExistingSlots') }}</p>
    <ul v-if="slots.length" class="ds-list mb-3">
      <li v-for="s in slots" :key="s.id" class="ds-row">
        <span>{{ formatDateTime(s.startsAt) }} — {{ formatTime(s.endsAt) }}</span>
        <span>{{ s.price ? `${formatPrice(s.price)} RSD` : '—' }}</span>
        <button type="button" class="btn-link-danger" @click="removeSlot(s.id)">✕</button>
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
    // T75 — on an ACTIVE listing the slot goes to moderation instead of a
    // real row (createDefinedSlot returns { message, pending }, none of a
    // slot's own fields), so build the just-added row from what the owner
    // actually typed rather than trusting the response to look like one.
    slots.value.push({
      id: created.id ?? `pending-${Date.now()}`,
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
</style>
