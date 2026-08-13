<template>
  <div>
    <h2 class="text-section-title mb-3">{{ t('admin.newListings') }}</h2>
    <p v-if="!queue?.newListings?.length" class="text-muted mb-4">{{ t('admin.noItems') }}</p>
    <div v-for="l in queue?.newListings" :key="l.id" class="card mb-3">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <NuxtLink :to="`/kontrolna-tabla/oglasi`" class="text-body"><strong>{{ l.title || t('listing.statusDraft') }}</strong></NuxtLink>
          <span class="badge" :class="l.waitingHours > queue.slaHours ? 'badge-critical' : 'badge-warning'">
            {{ t('admin.waitingHours', { hours: l.waitingHours }) }}
          </span>
        </div>
        <p class="text-muted mb-2">{{ l.category?.name }} · {{ l.user?.firstName }} {{ l.user?.lastName }} ({{ l.user?.email }})</p>
        <div class="row mb-3" v-if="l.photos?.length">
          <div class="col-3 col-md-2" v-for="p in l.photos.slice(0, 4)" :key="p.id">
            <img :src="p.url" alt="" class="queue-thumb" />
          </div>
        </div>
        <div class="d-flex reply-actions">
          <button class="btn btn-primary-flat btn-sm" @click="approveListing(l.id)">{{ t('admin.approve') }}</button>
          <button class="btn btn-danger btn-sm" @click="openReject('listing', l.id)">{{ t('admin.reject') }}</button>
        </div>
      </div>
    </div>

    <h2 class="text-section-title mb-3 mt-4">{{ t('admin.pendingEdits') }}</h2>
    <p v-if="!queue?.pendingEdits?.length" class="text-muted">{{ t('admin.noItems') }}</p>
    <div v-for="v in queue?.pendingEdits" :key="v.id" class="card mb-3">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <strong>{{ v.listing?.title }}</strong>
          <span class="badge" :class="v.waitingHours > queue.slaHours ? 'badge-critical' : 'badge-warning'">
            {{ t('admin.waitingHours', { hours: v.waitingHours }) }}
          </span>
        </div>
        <p class="text-muted mb-2">{{ v.listing?.user?.firstName }} {{ v.listing?.user?.lastName }}</p>
        <pre class="changed-fields">{{ JSON.stringify(v.changedFields, null, 2) }}</pre>
        <div class="d-flex reply-actions mt-2">
          <button class="btn btn-primary-flat btn-sm" @click="approveVersion(v.id)">{{ t('admin.approve') }}</button>
          <button class="btn btn-danger btn-sm" @click="openReject('version', v.id)">{{ t('admin.reject') }}</button>
        </div>
      </div>
    </div>

    <div v-if="rejectTarget" class="modal-backdrop" @click.self="rejectTarget = null">
      <div class="modal-panel card">
        <div class="card-body">
          <h3 class="text-section-title mb-3">{{ t('admin.reject') }}</h3>
          <div v-if="rejectTarget.type === 'listing'" class="form-group mb-3">
            <label class="form-label">{{ t('admin.reason') }}</label>
            <select v-model="rejectForm.reason" class="form-control form-select">
              <option v-for="r in listingReasons" :key="r" :value="r">{{ t(`admin.rejectReasons.${r}`) }}</option>
            </select>
          </div>
          <div v-else class="form-group mb-3">
            <label class="form-label">{{ t('admin.reason') }}</label>
            <input v-model="rejectForm.reason" type="text" class="form-control" />
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

function openReject(type, id) {
  rejectTarget.value = { type, id }
  rejectForm.reason = type === 'listing' ? listingReasons[0] : ''
  rejectForm.note = ''
}

async function approveListing(id) {
  await api.post(`/admin/listings/${id}/approve`, {})
  await refresh()
}

async function approveVersion(id) {
  await api.post(`/admin/listings/versions/${id}/approve`, {})
  await refresh()
}

async function confirmReject() {
  if (rejectTarget.value.type === 'listing') {
    await api.post(`/admin/listings/${rejectTarget.value.id}/reject`, { reason: rejectForm.reason, note: rejectForm.note || undefined })
  } else {
    await api.post(`/admin/listings/versions/${rejectTarget.value.id}/reject`, { reason: rejectForm.reason })
  }
  rejectTarget.value = null
  await refresh()
}

useSeoMeta({ title: t('admin.queue') })
</script>

<style lang="scss" scoped>
.queue-thumb {
  width: 100%;
  height: 60px;
  object-fit: cover;
  border-radius: $radius-input;
}

.changed-fields {
  background: $color-background;
  padding: 8px;
  border-radius: $radius-input;
  font-size: $font-size-muted;
  overflow-x: auto;
  max-height: 160px;
}

.reply-actions {
  gap: 8px;
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
