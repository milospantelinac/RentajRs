<template>
  <div>
    <h2 class="text-section-title mb-1">{{ t('admin.newListings') }}</h2>
    <p v-if="queue?.newListings?.length" class="text-muted mb-3">{{ t('admin.keyboardShortcutsHint') }}</p>
    <p v-if="!queue?.newListings?.length" class="text-muted mb-4">{{ t('admin.noItems') }}</p>
    <div
      v-for="(l, index) in queue?.newListings"
      :key="l.id"
      class="card mb-3"
      :class="{ 'queue-card-next': index === 0 }"
    >
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <NuxtLink :to="`/kontrolna-tabla/oglasi`" class="text-body"><strong>{{ l.title || t('listing.statusDraft') }}</strong></NuxtLink>
          <div class="d-flex reply-actions">
            <span v-if="index === 0" class="badge badge-neutral">{{ t('admin.nextInQueue') }}</span>
            <span class="badge" :class="l.waitingHours > queue.slaHours ? 'badge-critical' : 'badge-warning'">
              {{ t('admin.waitingHours', { hours: l.waitingHours }) }}
            </span>
          </div>
        </div>
        <p class="text-muted mb-2">{{ l.category?.name }} · {{ l.user?.firstName }} {{ l.user?.lastName }} ({{ l.user?.email }})</p>
        <div v-if="l.hasWarnings" class="queue-warnings mb-2">
          <span v-for="check in warningChecks(l.checkResults)" :key="check" class="badge badge-warning">
            ⚠ {{ t(`admin.checkWarning.${check}`) }}
          </span>
        </div>
        <div class="row mb-3" v-if="l.photos?.length">
          <div class="col-3 col-md-2" v-for="p in l.photos.slice(0, 4)" :key="p.id">
            <img :src="p.url" alt="" class="queue-thumb" />
          </div>
        </div>
        <div class="d-flex reply-actions">
          <button class="btn btn-primary-flat btn-sm" @click="approveListing(l.id)">{{ t('admin.approve') }} <span class="shortcut-key">A</span></button>
          <button class="btn btn-danger btn-sm" @click="openReject(l.id)">{{ t('admin.reject') }} <span class="shortcut-key">D</span></button>
        </div>
      </div>
    </div>

    <div v-if="rejectTarget" class="modal-backdrop" @click.self="rejectTarget = null">
      <div class="modal-panel card">
        <div class="card-body">
          <h3 class="text-section-title mb-3">{{ t('admin.reject') }}</h3>
          <div class="form-group mb-3">
            <label class="form-label">{{ t('admin.reason') }}</label>
            <select v-model="rejectForm.reason" class="form-control form-select">
              <option v-for="r in listingReasons" :key="r" :value="r">{{ t(`admin.rejectReasons.${r}`) }}</option>
            </select>
          </div>
          <div class="form-group mb-3">
            <label class="form-label">{{ t('admin.note') }}</label>
            <textarea v-model="rejectForm.note" class="form-control" rows="2"></textarea>
          </div>
          <div class="d-flex reply-actions">
            <button class="btn btn-danger btn-sm" @click="confirmReject">{{ t('admin.reject') }}</button>
            <button class="btn btn-tertiary btn-sm" @click="rejectTarget = null">{{ t('common.cancel') }}</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })
const { t } = useI18n()
const api = useApi()

const { data: queue, refresh } = await useAsyncData('admin-queue', () => api.get('/admin/listings/queue'))

const listingReasons = [
  'MISSING_PHOTOS', 'INAPPROPRIATE_CONTENT', 'CONTACT_INFO_IN_DESCRIPTION',
  'PRICE_OUT_OF_RANGE', 'INCOMPLETE_INFORMATION', 'SUSPECTED_FRAUD', 'DUPLICATE_LISTING', 'OTHER',
]

const rejectTarget = ref(null)
const rejectForm = reactive({ reason: '', note: '' })

function openReject(id) {
  rejectTarget.value = { id }
  rejectForm.reason = listingReasons[0]
  rejectForm.note = ''
}

async function approveListing(id) {
  await api.post(`/admin/listings/${id}/approve`, {})
  await refresh()
}

async function confirmReject() {
  await api.post(`/admin/listings/${rejectTarget.value.id}/reject`, { reason: rejectForm.reason, note: rejectForm.note || undefined })
  rejectTarget.value = null
  await refresh()
}

// Ch.12.4 — the admin should see only the WARNINGS an automated check
// raised, not the whole listing.
function warningChecks(checkResults) {
  if (!checkResults) return []
  return Object.entries(checkResults)
    .filter(([, status]) => status === 'WARNING')
    .map(([check]) => check)
}

// Ch.12.4's mock literally shows "[ODOBRI A] [ODBIJ D]" — a same keyboard
// shortcut acting on the oldest (first) item in the queue, so the admin
// never has to touch the mouse to burn through a long moderation session.
function handleQueueKeydown(e) {
  const tag = document.activeElement?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || rejectTarget.value) return
  const first = queue.value?.newListings?.[0]
  if (!first) return
  if (e.key === 'a' || e.key === 'A') {
    e.preventDefault()
    approveListing(first.id)
  } else if (e.key === 'd' || e.key === 'D') {
    e.preventDefault()
    openReject(first.id)
  }
}

onMounted(() => window.addEventListener('keydown', handleQueueKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', handleQueueKeydown))

useSeoMeta({ title: t('admin.queue') })
</script>

<style lang="scss" scoped>
.queue-thumb {
  width: 100%;
  height: 60px;
  object-fit: cover;
  border-radius: $radius-input;
}

.reply-actions {
  gap: 8px;
}

.queue-card-next {
  border-color: $color-primary;
}

.queue-warnings {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.shortcut-key {
  display: inline-block;
  margin-left: 4px;
  padding: 0 5px;
  border-radius: $radius-badge;
  background: rgba(255, 255, 255, 0.25);
  font-size: $font-size-label;
  font-weight: 700;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
}

.modal-panel {
  width: 100%;
  max-width: 420px;
}
</style>
