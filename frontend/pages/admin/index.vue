<template>
  <div>
    <DashboardPageHeader :title="t('admin.queue')" :subtitle="t('admin.subtitle.queue')" />

    <!-- Dizajn 44: the queue loads in the shape of the cards that are coming,
         says so when it fails, and says so when there is nothing to moderate. -->
    <template v-if="pending">
      <div v-for="index in SKELETON_CARDS" :key="`loading-${index}`" class="admin-card queue-card" aria-hidden="true">
        <div class="queue-head">
          <SkeletonBox width="240px" height="17px" />
          <SkeletonBox width="96px" height="23px" radius="999px" />
        </div>
        <SkeletonBox width="60%" height="13px" />
        <div class="queue-thumbs">
          <SkeletonBox v-for="thumb in 4" :key="thumb" width="120px" height="60px" radius="12px" />
        </div>
        <SkeletonBox width="220px" height="36px" radius="12px" />
      </div>
    </template>

    <StateBlock
      v-else-if="error"
      card
      error
      icon="queue"
      :title="t('admin.loadErrorTitle')"
      :text="t('admin.loadErrorText')"
    >
      <button type="button" class="state-block-action" @click="refresh()">{{ t('errorPage.tryAgain') }}</button>
    </StateBlock>

    <StateBlock
      v-else-if="!listings.length"
      card
      icon="queue"
      :title="t('admin.empty.queue.title')"
      :text="t('admin.empty.queue.text')"
    >
      <button type="button" class="state-block-action" @click="refresh()">{{ t('admin.refresh') }}</button>
    </StateBlock>

    <template v-else>
      <p class="queue-hint">{{ t('admin.keyboardShortcutsHint') }}</p>

      <div
        v-for="(l, index) in listings"
        :key="l.id"
        class="admin-card queue-card"
        :class="{ 'queue-card-next': index === 0 }"
      >
        <div class="queue-head">
          <p class="admin-card-title">{{ l.title || t('listing.statusDraft') }}</p>
          <div class="admin-pills">
            <span v-if="index === 0" class="admin-pill admin-pill-info">{{ t('admin.nextInQueue') }}</span>
            <span class="admin-pill" :class="l.waitingHours > queue.slaHours ? 'admin-pill-critical' : 'admin-pill-warning'">
              {{ t('admin.waitingHours', { hours: l.waitingHours }) }}
            </span>
          </div>
        </div>

        <p class="queue-meta">{{ metaLine(l) }}</p>

        <div v-if="l.hasWarnings" class="admin-pills">
          <span v-for="check in warningChecks(l.checkResults)" :key="check" class="admin-pill admin-pill-warning">
            {{ t(`admin.checkWarning.${check}`) }}
          </span>
        </div>

        <div v-if="l.photos?.length" class="queue-thumbs">
          <img v-for="p in l.photos.slice(0, 4)" :key="p.id" :src="p.url" alt="" class="queue-thumb" />
        </div>

        <div class="queue-actions">
          <button class="btn btn-primary-flat btn-sm" @click="approveListing(l.id)">
            {{ t('admin.approve') }} <span class="queue-key">A</span>
          </button>
          <button class="btn btn-danger btn-sm" @click="openReject(l.id)">
            {{ t('admin.reject') }} <span class="queue-key">D</span>
          </button>
        </div>
      </div>
    </template>

    <div v-if="rejectTarget" class="admin-modal-backdrop" @click.self="rejectTarget = null">
      <div class="admin-modal admin-card">
        <div class="admin-card-body">
          <p class="admin-card-title mb-3">{{ t('admin.reject') }}</p>
          <div class="form-group mb-3">
            <label class="form-label">{{ t('admin.reason') }}</label>
            <select v-model="rejectForm.reason" class="form-control form-select">
              <option v-for="r in listingReasons" :key="r" :value="r">{{ t(`admin.rejectReasons.${r}`) }}</option>
            </select>
          </div>
          <div class="form-group mb-4">
            <label class="form-label">{{ t('admin.note') }}</label>
            <textarea v-model="rejectForm.note" class="form-control" rows="2"></textarea>
          </div>
          <div class="queue-actions">
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

const SKELETON_CARDS = 3

const { data: queue, pending, error, refresh } = await useAsyncData('admin-queue', () => api.get('/admin/listings/queue'))
const listings = computed(() => queue.value?.newListings || [])

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

// A listing parked without a category (T60) used to leave the separator
// hanging in front of the owner's name.
function metaLine(l) {
  const owner = [l.user?.firstName, l.user?.lastName].filter(Boolean).join(' ')
  return [l.category?.name, owner && l.user?.email ? `${owner} (${l.user.email})` : owner || l.user?.email]
    .filter(Boolean)
    .join(' · ')
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
  const first = listings.value[0]
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
// Dizajn 45: one card per listing waiting, built like the dashboard's own
// content cards (Dizajn 38): 22/24 of padding, 17 Medium title, Light 13
// under it, and the parts 14 apart.
.queue-hint {
  margin-bottom: 16px;
  font-size: 13px;
  font-weight: 300;
  line-height: normal;
  color: $color-text-muted;
}

.queue-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 14px;
  padding: 22px 24px;
}

// The oldest listing, the one the keyboard acts on. The ring is drawn inside
// the box so the card keeps its size.
.queue-card-next {
  box-shadow:
    0 1px 3px rgba(97, 115, 133, 0.05),
    0 6px 20px rgba(97, 115, 133, 0.08),
    inset 0 0 0 1.5px $color-primary;
}

.queue-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}

.queue-meta {
  font-size: 13px;
  font-weight: 300;
  line-height: 20px;
  color: $color-text-muted;
  overflow-wrap: anywhere;
}

// Full width, or the phone's half-width thumbs would be half of nothing:
// the card's items are flex-start, so a row shrinks to its contents.
.queue-thumbs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  width: 100%;
}

.queue-thumb {
  width: 120px;
  height: 60px;
  object-fit: cover;
  border-radius: $radius-input;
}

.queue-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

// The letter the shortcut listens for, on the button it belongs to.
.queue-key {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  padding: 0 5px;
  border-radius: $radius-badge;
  background: rgba(255, 255, 255, 0.22);
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
}

.btn-danger .queue-key {
  background: rgba(209, 41, 61, 0.1);
}

@include mobile-only {
  .queue-card {
    padding: 18px 16px;
  }

  .queue-thumb {
    width: calc(50% - 4px);
  }
}
</style>
