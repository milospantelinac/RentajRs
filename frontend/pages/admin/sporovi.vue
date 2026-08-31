<template>
  <div>
    <div class="form-row-inline mb-4">
      <button class="btn btn-sm" :class="tab === 'disputes' ? 'btn-primary-flat' : 'btn-tertiary'" @click="tab = 'disputes'">
        {{ t('admin.disputes') }}
      </button>
      <button class="btn btn-sm" :class="tab === 'reports' ? 'btn-primary-flat' : 'btn-tertiary'" @click="tab = 'reports'">
        {{ t('admin.reports') }}
      </button>
    </div>

    <template v-if="tab === 'disputes'">
      <p v-if="!disputes?.length" class="text-muted">{{ t('admin.noItems') }}</p>
      <div v-for="d in disputes" :key="d.id" class="card mb-3">
        <div class="card-body">
          <p class="text-body mb-1"><strong>{{ t('admin.disputeType') }}:</strong> {{ t(`admin.disputeTypes.${d.type}`) }}</p>
          <p class="text-muted mb-1">{{ t('admin.submittedAt') }}: {{ formatDateTime(d.createdAt) }}</p>
          <p class="text-muted mb-1">
            {{ t('admin.relatedBooking') }}:
            <NuxtLink v-if="d.booking?.id" :to="`/admin/rezervacije/${d.booking.id}`">{{ bookingSummary(d) }}</NuxtLink>
            <span v-else>{{ d.listing?.title || '—' }}</span>
          </p>
          <p class="text-muted mb-2">{{ t('admin.submittedBy') }}: {{ d.submittedByUser?.firstName }} {{ d.submittedByUser?.lastName }}</p>
          <p class="text-body mb-1"><strong>{{ t('admin.explanationLabel') }}:</strong></p>
          <p class="text-body mb-3">{{ d.description || t('admin.noExplanationGiven') }}</p>

          <div class="row">
            <div class="col-6">
              <div class="form-group mb-2">
                <label class="form-label">{{ t('admin.outcome') }}</label>
                <select v-model="resolveForms[d.id].outcome" class="form-control form-select">
                  <option value="NO_ACTION">{{ t('admin.outcomeNoAction') }}</option>
                  <option
                    v-if="d.type === 'DISPUTED_NO_SHOW' && d.booking?.status === 'NO_SHOW'"
                    value="OVERTURN_NO_SHOW"
                  >{{ t('admin.outcomeOverturnNoShow') }}</option>
                  <option value="WARNING">{{ t('admin.outcomeWarning') }}</option>
                  <option value="RESTRICTION">{{ t('admin.outcomeRestriction') }}</option>
                  <option value="BLOCK">{{ t('admin.outcomeBlock') }}</option>
                </select>
              </div>
            </div>
            <div class="col-6" v-if="!['NO_ACTION', 'OVERTURN_NO_SHOW'].includes(resolveForms[d.id].outcome)">
              <div class="form-group mb-2">
                <label class="form-label">{{ t('admin.targetUser') }}</label>
                <select v-model="resolveForms[d.id].targetUserId" class="form-control form-select">
                  <option :value="undefined">—</option>
                  <option :value="d.submittedByUser?.id">
                    {{ d.submittedByUser?.firstName }} {{ d.submittedByUser?.lastName }} ({{ t('admin.targetUserIsSubmitter') }})
                  </option>
                </select>
              </div>
            </div>
          </div>
          <p v-if="resolveForms[d.id].outcome === 'OVERTURN_NO_SHOW'" class="form-hint mb-2">{{ t('admin.outcomeOverturnNoShowHint') }}</p>
          <div class="form-group mb-2">
            <label class="form-label">{{ t('admin.note') }}</label>
            <textarea v-model="resolveForms[d.id].adminNote" class="form-control" rows="2"></textarea>
          </div>
          <p v-if="resolveErrors[d.id]" class="form-error mb-2">{{ resolveErrors[d.id] }}</p>
          <button class="btn btn-primary-flat btn-sm" @click="resolveDispute(d.id)">{{ t('admin.resolve') }}</button>
        </div>
      </div>
    </template>

    <template v-else>
      <p v-if="!reports?.length" class="text-muted">{{ t('admin.noItems') }}</p>
      <div v-for="r in reports" :key="r.id" class="card mb-3">
        <div class="card-body">
          <p class="text-body mb-1"><strong>{{ t('admin.reportedListing') }}:</strong> {{ r.listing?.title }}</p>
          <p class="text-muted mb-1">{{ t('admin.reportReason') }}: {{ t(`admin.reportReasons.${r.reason}`) }}</p>
          <p class="text-muted mb-2">{{ t('admin.reportedBy') }}: {{ r.reportedByUser?.firstName }} {{ r.reportedByUser?.lastName }}</p>
          <p v-if="r.description" class="text-body mb-3">{{ r.description }}</p>
          <div class="d-flex reply-actions">
            <button class="btn btn-primary-flat btn-sm" @click="resolveReport(r.id, 'RESOLVED')">{{ t('admin.resolve') }}</button>
            <button class="btn btn-tertiary btn-sm" @click="resolveReport(r.id, 'DISMISSED')">{{ t('admin.dismiss') }}</button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })
const { t } = useI18n()
const api = useApi()

const tab = ref('disputes')

const { data: disputes, refresh: refreshDisputes } = await useAsyncData('admin-disputes', () => api.get('/admin/disputes?status=NEW'))
const { data: reports, refresh: refreshReports } = await useAsyncData('admin-reports', () => api.get('/admin/reports?status=NEW'))

const resolveForms = reactive({})
const resolveErrors = reactive({})
for (const d of disputes.value || []) {
  resolveForms[d.id] = { outcome: 'NO_ACTION', targetUserId: undefined, adminNote: '' }
}

// T90 — dates + the guest's name disambiguate which of a listing's several
// bookings this dispute is about, without needing to click through first.
function bookingSummary(d) {
  const b = d.booking
  if (!b) return d.listing?.title || '—'
  const guest = b.guest ? `${b.guest.firstName} ${b.guest.lastName}` : ''
  const dates = b.startsAt && b.endsAt
    ? `${new Date(b.startsAt).toLocaleDateString('sr-RS')} – ${new Date(b.endsAt).toLocaleDateString('sr-RS')}`
    : ''
  return [d.listing?.title, dates, guest].filter(Boolean).join(' · ')
}

async function resolveDispute(id) {
  resolveErrors[id] = ''
  try {
    await api.post(`/admin/disputes/${id}/resolve`, resolveForms[id])
    await refreshDisputes()
  } catch (e) {
    resolveErrors[id] = extractErrorMessage(e, t('auth.genericError'))
  }
}

async function resolveReport(id, status) {
  await api.patch(`/admin/reports/${id}`, { status })
  await refreshReports()
}

useSeoMeta({ title: t('admin.disputes') })
</script>

<style lang="scss" scoped>
.form-row-inline {
  display: flex;
  gap: 8px;
}

.reply-actions {
  gap: 8px;
}
</style>
