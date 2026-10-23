<template>
  <div>
    <div class="feat-toolbar">
      <div class="admin-switch admin-switch-sm" role="tablist">
        <button
          v-for="key in FILTERS"
          :key="key"
          type="button"
          role="tab"
          class="admin-switch-btn"
          :class="{ 'is-active': filter === key }"
          :aria-selected="filter === key"
          @click="filter = key"
        >{{ t(`admin.featured.requestFilter.${key}`) }}</button>
      </div>
    </div>
    <p class="admin-card-note feat-intro">{{ t('admin.featured.requestsIntro') }}</p>

    <p v-if="message" class="form-success feat-message" role="status">{{ message }}</p>
    <p v-if="actionError" class="form-error feat-message" role="alert">{{ actionError }}</p>

    <StateBlock v-if="failed" card error icon="featured" :title="t('admin.loadErrorTitle')" :text="t('admin.loadErrorText')">
      <button type="button" class="state-block-action" @click="load">{{ t('errorPage.tryAgain') }}</button>
    </StateBlock>

    <StateBlock
      v-else-if="!loading && !requests.length"
      card
      icon="featured"
      :title="t(`admin.featured.emptyRequests.${filter}.title`)"
      :text="t(`admin.featured.emptyRequests.${filter}.text`)"
    />

    <div v-else class="admin-card admin-card-table">
      <div class="feat-table-scroll">
      <table class="admin-table admin-table-tight feat-table">
        <thead>
          <tr>
            <th>{{ t('admin.featured.col.listing') }}</th>
            <th>{{ t('admin.featured.col.category') }}</th>
            <th>{{ t('admin.featured.col.requested') }}</th>
            <th>{{ t('admin.featured.col.status') }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="request in requests" :key="request.id">
            <td :data-label="t('admin.featured.col.listing')">
              <div class="admin-cell-pair">
                <NuxtLink :to="`/oglasi/${request.listing.slug}`" target="_blank" class="admin-cell-name feat-link">
                  {{ request.listing.title }}
                </NuxtLink>
                <span class="admin-cell-sub">{{ personLabel(request.owner) }}</span>
                <span v-if="request.owner.leader" class="feat-leader-line">
                  <span class="admin-pill admin-pill-success">{{ t('admin.featured.leaderPill') }}</span>
                  <span class="admin-cell-sub">
                    {{ request.owner.benefitUsed ? t('admin.featured.leaderBenefitUsed') : t('admin.featured.leaderBenefitFree') }}
                  </span>
                </span>
              </div>
            </td>
            <td :data-label="t('admin.featured.col.category')">
              <div class="admin-cell-pair">
                <span>{{ request.listing.categoryName || '-' }}</span>
                <span class="admin-cell-sub" :class="{ 'feat-warning': request.category.taken >= request.category.limit }">
                  {{ t('admin.featured.capacityCount', { taken: request.category.taken, limit: request.category.limit }) }}
                </span>
              </div>
            </td>
            <td :data-label="t('admin.featured.col.requested')">{{ formatFeaturedDay(request.requestedAt) }}</td>
            <td :data-label="t('admin.featured.col.status')">
              <div class="admin-cell-pair">
                <span class="admin-pill feat-status" :class="statusPill(request.status)">
                  {{
                    request.status === 'WAITING'
                      ? t('admin.featured.requestStatus.WAITING', { position: request.queuePosition })
                      : t(`admin.featured.requestStatus.${request.status}`)
                  }}
                </span>
                <span v-if="request.decisionNote" class="admin-cell-sub">{{ request.decisionNote }}</span>
                <span v-if="request.decidedBy" class="admin-cell-sub">{{ t('admin.featured.decidedBy', { name: request.decidedBy }) }}</span>
              </div>
            </td>
            <td class="admin-cell-actions">
              <div class="admin-actions">
                <button v-if="request.status === 'PENDING'" type="button" class="admin-action" @click="openApprove(request)">
                  {{ t('admin.featured.approve') }}
                </button>
                <button
                  v-if="request.status === 'PENDING' || request.status === 'WAITING'"
                  type="button"
                  class="admin-action admin-action-danger"
                  @click="openReject(request)"
                >
                  {{ request.status === 'WAITING' ? t('admin.featured.removeFromQueue') : t('admin.featured.reject') }}
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>

    <div v-if="approveForm.request" class="admin-modal-backdrop" @click.self="approveForm.request = null">
      <form class="admin-modal admin-card" @submit.prevent="submitApprove">
        <div class="admin-card-body feat-form">
          <p class="admin-card-title">{{ t('admin.featured.approveTitle') }}</p>
          <p class="admin-card-note">{{ approveForm.request.listing.title }} · {{ approveForm.request.owner.name }}</p>
          <label v-if="approveForm.request.owner.leader && !approveForm.request.owner.benefitUsed" class="admin-check-row">
            <input v-model="approveForm.asLeader" type="checkbox" class="admin-check" />
            {{ t('admin.featured.useLeaderBenefit', { count: leaderDays }) }}
          </label>
          <div v-if="!approveForm.asLeader" class="form-group">
            <label class="form-label" for="feat-approve-days">{{ t('admin.featured.daysLabel') }}</label>
            <input id="feat-approve-days" v-model.number="approveForm.days" type="number" min="1" max="365" class="form-control feat-days-input" required />
          </div>
          <p v-if="approveForm.request.category.taken >= approveForm.request.category.limit" class="admin-card-note feat-warning">
            {{ t('admin.featured.categoryFullNote', approveForm.request.category) }}
          </p>
          <p v-if="approveForm.error" class="form-error">{{ approveForm.error }}</p>
          <div class="feat-actions">
            <button type="submit" class="btn btn-primary-flat btn-sm" :disabled="approveForm.saving">{{ t('admin.featured.approve') }}</button>
            <button type="button" class="btn btn-tertiary btn-sm" @click="approveForm.request = null">{{ t('common.cancel') }}</button>
          </div>
        </div>
      </form>
    </div>

    <div v-if="rejectForm.request" class="admin-modal-backdrop" @click.self="rejectForm.request = null">
      <form class="admin-modal admin-card" @submit.prevent="submitReject">
        <div class="admin-card-body feat-form">
          <p class="admin-card-title">{{ t('admin.featured.rejectTitle') }}</p>
          <p class="admin-card-note">{{ rejectForm.request.listing.title }} · {{ rejectForm.request.owner.name }}</p>
          <div class="form-group">
            <label class="form-label" for="feat-reject-reason">{{ t('admin.featured.rejectReason') }}</label>
            <textarea id="feat-reject-reason" v-model="rejectForm.reason" class="form-control" rows="3" maxlength="500" required />
            <p class="admin-card-note feat-hint">{{ t('admin.featured.rejectReasonHint') }}</p>
          </div>
          <p v-if="rejectForm.error" class="form-error">{{ rejectForm.error }}</p>
          <div class="feat-actions">
            <button type="submit" class="btn btn-danger btn-sm" :disabled="rejectForm.saving || !rejectForm.reason.trim()">
              {{ t('admin.featured.reject') }}
            </button>
            <button type="button" class="btn btn-tertiary btn-sm" @click="rejectForm.request = null">{{ t('common.cancel') }}</button>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
// Zahtevi: what owners asked for ("Istakni oglas") and the queue of full
// categories. Approving starts the period, or puts it in the queue when the
// category is full; a leader's first request can use their free period.
import { formatFeaturedDay, personLabel } from '~/utils/featuredAdmin'

const emit = defineEmits(['changed'])
const { t } = useI18n()
const api = useApi()

const FILTERS = ['open', 'APPROVED', 'REJECTED', 'CANCELLED']
const STATUS_PILLS = {
  PENDING: 'admin-pill-warning',
  WAITING: 'admin-pill-info',
  APPROVED: 'admin-pill-success',
  REJECTED: 'admin-pill-critical',
  CANCELLED: 'admin-pill-neutral',
}

const filter = ref('open')
const requests = ref([])
const loading = ref(true)
const failed = ref(false)
const message = ref('')
const actionError = ref('')
const leaderDays = ref(30)
const defaultDays = ref(30)

const statusPill = (status) => STATUS_PILLS[status] || 'admin-pill-neutral'

async function load() {
  loading.value = true
  failed.value = false
  try {
    requests.value = await api.get('/admin/featured/requests', {
      query: filter.value === 'open' ? {} : { status: filter.value },
    })
  } catch {
    requests.value = []
    failed.value = true
  } finally {
    loading.value = false
  }
}

watch(filter, load)
onMounted(async () => {
  await load()
  try {
    const settings = await api.get('/admin/featured/settings')
    leaderDays.value = settings.leaders.days
    defaultDays.value = settings.rules.defaultDays
  } catch {
    // The defaults stand.
  }
})

const approveForm = reactive({ request: null, days: 30, asLeader: false, error: '', saving: false })

function openApprove(request) {
  Object.assign(approveForm, {
    request,
    days: request.durationDays || defaultDays.value,
    asLeader: !!request.owner.leader && !request.owner.benefitUsed,
    error: '',
    saving: false,
  })
}

async function submitApprove() {
  approveForm.saving = true
  approveForm.error = ''
  try {
    const outcome = await api.post(`/admin/featured/requests/${approveForm.request.id}/approve`, {
      ...(approveForm.asLeader ? { asLeader: true } : { days: approveForm.days }),
    })
    message.value =
      outcome.status === 'STARTED'
        ? t('admin.featured.grantStarted', { title: approveForm.request.listing.title, date: formatFeaturedDay(outcome.expiresAt) })
        : t('admin.featured.grantWaiting', { title: approveForm.request.listing.title })
    actionError.value = ''
    approveForm.request = null
    await load()
    emit('changed')
  } catch (e) {
    approveForm.error = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    approveForm.saving = false
  }
}

const rejectForm = reactive({ request: null, reason: '', error: '', saving: false })

function openReject(request) {
  Object.assign(rejectForm, { request, reason: '', error: '', saving: false })
}

async function submitReject() {
  rejectForm.saving = true
  rejectForm.error = ''
  try {
    await api.post(`/admin/featured/requests/${rejectForm.request.id}/reject`, { reason: rejectForm.reason.trim() })
    message.value = t('admin.featured.rejected', { title: rejectForm.request.listing.title })
    actionError.value = ''
    rejectForm.request = null
    await load()
    emit('changed')
  } catch (e) {
    rejectForm.error = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    rejectForm.saving = false
  }
}
</script>

<style lang="scss" scoped>
.feat-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.feat-intro {
  margin: 0 0 16px;
}

.feat-message {
  margin-bottom: 16px;
}

.feat-link:hover {
  color: $color-primary;
}

// A tablet scrolls the table sideways rather than squeezing its words.
@include respond-above(md) {
  .feat-table-scroll {
    overflow-x: auto;
  }

  .feat-table {
    min-width: 720px;
  }

  .feat-table td:first-child {
    min-width: 220px;
  }
}

.feat-warning {
  color: $color-warning;
}

// The pill keeps its own width inside the cell's column.
.feat-status {
  align-self: flex-start;
}

.feat-leader-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
}

.feat-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.feat-form .form-group {
  margin-bottom: 0;
}

.feat-hint {
  margin-top: 6px;
}

.feat-days-input {
  width: 110px;
}

.feat-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
</style>
