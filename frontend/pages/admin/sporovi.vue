<template>
  <div>
    <DashboardPageHeader :title="t('admin.disputes')" :subtitle="t('admin.subtitle.disputes')" />

    <div class="admin-switch mb-4">
      <button class="admin-switch-btn" :class="{ 'is-active': tab === 'disputes' }" @click="tab = 'disputes'">
        {{ t('admin.disputes') }}
      </button>
      <button class="admin-switch-btn" :class="{ 'is-active': tab === 'reports' }" @click="tab = 'reports'">
        {{ t('admin.reports') }}
      </button>
    </div>

    <template v-if="tab === 'disputes'">
      <div v-if="disputesPending" class="admin-card dispute-card" aria-hidden="true">
        <SkeletonBox width="240px" height="17px" />
        <SkeletonBox width="62%" height="13px" />
        <SkeletonBox width="48%" height="13px" />
        <SkeletonBox width="100%" height="51px" radius="12px" />
        <SkeletonBox width="136px" height="36px" radius="12px" />
      </div>

      <StateBlock
        v-else-if="disputesError"
        card
        error
        icon="disputes"
        :title="t('admin.loadErrorTitle')"
        :text="t('admin.loadErrorText')"
      >
        <button type="button" class="state-block-action" @click="refreshDisputes()">{{ t('errorPage.tryAgain') }}</button>
      </StateBlock>

      <StateBlock
        v-else-if="!disputes?.length"
        card
        icon="disputes"
        :title="t('admin.empty.disputes.title')"
        :text="t('admin.empty.disputes.text')"
      />

      <template v-else>
        <div v-for="d in disputes" :key="d.id" class="admin-card dispute-card">
          <div class="dispute-head">
            <p class="admin-card-title">{{ t(`admin.disputeTypes.${d.type}`) }}</p>
            <span class="admin-pill admin-pill-warning">{{ formatDateTime(d.createdAt) }}</span>
          </div>

          <dl class="dispute-facts">
            <div class="dispute-fact">
              <dt class="dispute-label">{{ t('admin.relatedBooking') }}</dt>
              <dd class="dispute-value">
                <NuxtLink v-if="d.booking?.id" :to="`/admin/rezervacije/${d.booking.id}`" class="admin-action">{{ bookingSummary(d) }}</NuxtLink>
                <span v-else>{{ d.listing?.title || '-' }}</span>
              </dd>
            </div>
            <div class="dispute-fact">
              <dt class="dispute-label">{{ t('admin.submittedBy') }}</dt>
              <dd class="dispute-value">{{ d.submittedByUser?.firstName }} {{ d.submittedByUser?.lastName }}</dd>
            </div>
            <!-- T94: an open payment report holds the unpaid booking past its deadline. -->
            <div v-if="d.paymentHeldUntil" class="dispute-fact">
              <dt class="dispute-label">{{ t('admin.paymentDeadline') }}</dt>
              <dd class="dispute-value">{{ formatDateTime(d.booking.paymentDeadline) }}</dd>
            </div>
          </dl>

          <p v-if="d.paymentHeldUntil" class="dispute-hold">{{ t('admin.paymentReportHold', { date: formatDateTime(d.paymentHeldUntil) }) }}</p>

          <div class="dispute-explanation">
            <p class="dispute-label">{{ t('admin.explanationLabel') }}</p>
            <p class="dispute-text">{{ d.description || t('admin.noExplanationGiven') }}</p>
          </div>

          <div class="dispute-form">
            <div class="form-group">
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
            <div v-if="!['NO_ACTION', 'OVERTURN_NO_SHOW'].includes(resolveForms[d.id].outcome)" class="form-group">
              <label class="form-label">{{ t('admin.targetUser') }}</label>
              <select v-model="resolveForms[d.id].targetUserId" class="form-control form-select">
                <option :value="undefined">-</option>
                <option :value="d.submittedByUser?.id">
                  {{ d.submittedByUser?.firstName }} {{ d.submittedByUser?.lastName }} ({{ t('admin.targetUserIsSubmitter') }})
                </option>
              </select>
            </div>
          </div>

          <p v-if="resolveForms[d.id].outcome === 'OVERTURN_NO_SHOW'" class="form-hint">{{ t('admin.outcomeOverturnNoShowHint') }}</p>

          <div class="form-group dispute-note">
            <label class="form-label">{{ t('admin.note') }}</label>
            <textarea v-model="resolveForms[d.id].adminNote" class="form-control" rows="2"></textarea>
          </div>

          <p v-if="resolveErrors[d.id]" class="form-error">{{ resolveErrors[d.id] }}</p>
          <button class="btn btn-primary-flat btn-sm" @click="resolveDispute(d.id)">{{ t('admin.resolve') }}</button>
        </div>
      </template>
    </template>

    <template v-else>
      <div v-if="reportsPending" class="admin-card dispute-card" aria-hidden="true">
        <SkeletonBox width="240px" height="17px" />
        <SkeletonBox width="52%" height="13px" />
        <SkeletonBox width="68%" height="13px" />
        <SkeletonBox width="180px" height="36px" radius="12px" />
      </div>

      <StateBlock
        v-else-if="reportsError"
        card
        error
        icon="disputes"
        :title="t('admin.loadErrorTitle')"
        :text="t('admin.loadErrorText')"
      >
        <button type="button" class="state-block-action" @click="refreshReports()">{{ t('errorPage.tryAgain') }}</button>
      </StateBlock>

      <StateBlock
        v-else-if="!reports?.length"
        card
        icon="disputes"
        :title="t('admin.empty.reports.title')"
        :text="t('admin.empty.reports.text')"
      />

      <template v-else>
        <div v-for="r in reports" :key="r.id" class="admin-card dispute-card">
          <div class="dispute-head">
            <p class="admin-card-title">{{ r.listing?.title }}</p>
            <span class="admin-pill admin-pill-critical">{{ t(`admin.reportReasons.${r.reason}`) }}</span>
          </div>

          <dl class="dispute-facts">
            <div class="dispute-fact">
              <dt class="dispute-label">{{ t('admin.reportedBy') }}</dt>
              <dd class="dispute-value">{{ r.reportedByUser?.firstName }} {{ r.reportedByUser?.lastName }}</dd>
            </div>
          </dl>

          <div v-if="r.description" class="dispute-explanation">
            <p class="dispute-label">{{ t('admin.explanationLabel') }}</p>
            <p class="dispute-text">{{ r.description }}</p>
          </div>

          <div class="dispute-actions">
            <button class="btn btn-primary-flat btn-sm" @click="resolveReport(r.id, 'RESOLVED')">{{ t('admin.resolve') }}</button>
            <button class="btn btn-tertiary btn-sm" @click="resolveReport(r.id, 'DISMISSED')">{{ t('admin.dismiss') }}</button>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup>
definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })
const { t } = useI18n()
const api = useApi()

const tab = ref('disputes')

const {
  data: disputes,
  pending: disputesPending,
  error: disputesError,
  refresh: refreshDisputes,
} = await useAsyncData('admin-disputes', () => api.get('/admin/disputes?status=NEW'))
const {
  data: reports,
  pending: reportsPending,
  error: reportsError,
  refresh: refreshReports,
} = await useAsyncData('admin-reports', () => api.get('/admin/reports?status=NEW'))

const resolveForms = reactive({})
const resolveErrors = reactive({})
// A refreshed list can bring rows this page has no form for yet.
watch(
  disputes,
  (rows) => {
    for (const d of rows || []) {
      if (!resolveForms[d.id]) resolveForms[d.id] = { outcome: 'NO_ACTION', targetUserId: undefined, adminNote: '' }
    }
  },
  { immediate: true },
)

// T90 — dates + the guest's name disambiguate which of a listing's several
// bookings this dispute is about, without needing to click through first.
function bookingSummary(d) {
  const b = d.booking
  if (!b) return d.listing?.title || '-'
  const guest = b.guest ? `${b.guest.firstName} ${b.guest.lastName}` : ''
  const dates = b.startsAt && b.endsAt
    ? `${new Date(b.startsAt).toLocaleDateString('sr-RS')} - ${new Date(b.endsAt).toLocaleDateString('sr-RS')}`
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
// Dizajn 45: one card per open case, built like the dashboard's own content
// cards (Dizajn 38): 22/24 of padding, a 17 Medium title, and 14 between the
// parts inside.
.dispute-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 14px;
  padding: 22px 24px;
}

.dispute-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}

.dispute-facts {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  margin: 0;
}

.dispute-fact {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
}

.dispute-label {
  flex: 0 0 168px;
  font-size: 13px;
  font-weight: 500;
  line-height: normal;
  color: $color-text-muted;
}

.dispute-value {
  flex: 1 1 200px;
  margin: 0;
  font-size: 14px;
  font-weight: 400;
  line-height: normal;
  color: $color-text;
  overflow-wrap: anywhere;
}

.dispute-hold {
  width: 100%;
  padding: 12px 16px;
  border-radius: $radius-input;
  background: $color-warning-bg;
  font-size: 13px;
  font-weight: 400;
  line-height: 20px;
  color: $color-warning;
}

.dispute-explanation {
  width: 100%;
  padding: 14px 16px;
  border-radius: $radius-input;
  background: $color-background;
}

.dispute-text {
  margin-top: 6px;
  font-size: 14px;
  font-weight: 400;
  line-height: 21px;
  color: $color-text;
  overflow-wrap: anywhere;
}

.dispute-form {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  width: 100%;
}

.dispute-form .form-group {
  flex: 1 1 260px;
  min-width: 0;
}

.dispute-note {
  width: 100%;
}

.dispute-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

@include mobile-only {
  .dispute-card {
    padding: 18px 16px;
  }

  .dispute-label {
    flex-basis: 100%;
  }
}
</style>
