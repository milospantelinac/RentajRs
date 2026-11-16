<template>
  <div>
    <DashboardPageHeader :title="t('admin.invoices.title')" :subtitle="t('admin.invoices.subtitle')" />

    <!-- The connection to the fiscal service: a live check with the key the server holds. -->
    <div class="admin-card">
      <div class="admin-card-head">
        <div>
          <p class="admin-card-title">{{ t('admin.invoices.connectionTitle') }}</p>
          <p class="admin-card-note">{{ t('admin.invoices.connectionNote') }}</p>
        </div>
        <button type="button" class="btn btn-primary-flat btn-sm" :disabled="checking" @click="checkConnection">
          {{ checking ? t('admin.invoices.checking') : t('admin.invoices.checkConnection') }}
        </button>
      </div>
      <div v-if="connection" class="admin-card-body inv-connection">
        <p v-if="connection.provider === 'mock'" class="admin-card-note">{{ t('admin.invoices.mock') }}</p>
        <template v-else>
          <p class="inv-connection-state" :class="connection.ok ? 'is-ok' : 'is-problem'" :role="connection.ok ? 'status' : 'alert'">
            {{ connection.ok ? t('admin.invoices.connectionOk') : t('admin.invoices.connectionProblem') }}
          </p>
          <p v-if="connection.error" class="form-error mb-0">{{ connection.error }}</p>
          <dl class="inv-facts">
            <div class="inv-fact">
              <dt>{{ t('admin.invoices.receiptType') }}</dt>
              <dd>{{ connection.invoiceType === 'normal' ? t('admin.invoices.typeNormal') : t('admin.invoices.typeTraining') }}</dd>
            </div>
            <div v-if="connection.company" class="inv-fact">
              <dt>{{ t('admin.invoices.company') }}</dt>
              <dd>{{ connection.company }}</dd>
            </div>
            <div v-if="connection.shop" class="inv-fact">
              <dt>{{ t('admin.invoices.shop') }}</dt>
              <dd>{{ connection.shop }}</dd>
            </div>
            <div class="inv-fact">
              <dt>{{ t('admin.invoices.taxLabel') }}</dt>
              <dd>{{ connection.taxLabel }}</dd>
            </div>
            <div v-if="connection.taxLabels?.length" class="inv-fact">
              <dt>{{ t('admin.invoices.taxLabels') }}</dt>
              <dd>{{ connection.taxLabels.join(', ') }}</dd>
            </div>
          </dl>
        </template>
      </div>
    </div>

    <div class="admin-filters">
      <select v-model="statusFilter" class="admin-field" :aria-label="t('admin.statusLabel')" @change="load">
        <option value="">{{ t('admin.allStatuses') }}</option>
        <option v-for="s in statuses" :key="s" :value="s">{{ t(`admin.invoices.status${s}`) }}</option>
      </select>
    </div>

    <p v-if="notice" class="inv-notice" :class="`is-${notice.tone}`" :role="notice.tone === 'success' ? 'status' : 'alert'">{{ notice.text }}</p>

    <StateBlock
      v-if="failed"
      card
      error
      icon="receipts"
      :title="t('admin.loadErrorTitle')"
      :text="t('admin.loadErrorText')"
    >
      <button type="button" class="state-block-action" @click="load">{{ t('errorPage.tryAgain') }}</button>
    </StateBlock>

    <StateBlock
      v-else-if="!loading && !invoices.length"
      card
      icon="receipts"
      :title="t(statusFilter ? 'admin.invoices.emptyFilterTitle' : 'admin.invoices.emptyTitle')"
      :text="t(statusFilter ? 'admin.invoices.emptyFilterText' : 'admin.invoices.emptyText')"
    >
      <button v-if="statusFilter" type="button" class="state-block-action" @click="clearFilter">{{ t('search.clearAllFilters') }}</button>
    </StateBlock>

    <div v-else class="admin-card admin-card-table">
      <table class="admin-table">
        <thead>
          <tr>
            <th>{{ t('admin.invoices.colReceipt') }}</th>
            <th>{{ t('admin.invoices.colBuyer') }}</th>
            <th>{{ t('admin.invoices.colAmount') }}</th>
            <th>{{ t('admin.statusLabel') }}</th>
            <th>{{ t('admin.invoices.colNumber') }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <template v-if="loading">
            <tr v-for="index in SKELETON_ROWS" :key="`loading-${index}`" aria-hidden="true">
              <td>
                <SkeletonBox width="60%" height="15px" />
                <SkeletonBox class="admin-skeleton-sub" width="80%" height="13px" />
              </td>
              <td>
                <SkeletonBox width="46%" height="15px" />
                <SkeletonBox class="admin-skeleton-sub" width="62%" height="13px" />
              </td>
              <td><SkeletonBox width="72px" height="15px" /></td>
              <td><SkeletonBox width="86px" height="21px" radius="999px" /></td>
              <td><SkeletonBox width="120px" height="15px" /></td>
              <td><SkeletonBox width="60px" height="15px" /></td>
            </tr>
          </template>
          <template v-else>
            <tr v-for="invoice in invoices" :key="invoice.id">
              <td :data-label="t('admin.invoices.colReceipt')">
                <div class="admin-cell-pair">
                  <span class="admin-cell-name">{{ invoice.orderNumber || `#${invoice.number}` }}</span>
                  <span class="admin-cell-sub">{{ formatWhen(invoice.createdAt) }}</span>
                </div>
              </td>
              <td :data-label="t('admin.invoices.colBuyer')">
                <div class="admin-cell-pair">
                  <span class="admin-cell-name">{{ invoice.user?.firstName }} {{ invoice.user?.lastName }}</span>
                  <span class="admin-cell-sub">{{ invoice.user?.email }}</span>
                </div>
              </td>
              <td :data-label="t('admin.invoices.colAmount')">{{ formatAmount(invoice.amount) }}</td>
              <td :data-label="t('admin.statusLabel')">
                <div class="admin-cell-pair">
                  <span class="admin-pill" :class="pillClass(invoice.status)">{{ t(`admin.invoices.status${invoice.status}`) }}</span>
                  <span v-if="invoice.status === 'PENDING' && invoice.nextAttemptAt" class="admin-cell-sub">
                    {{ t('admin.invoices.nextTry', { time: formatWhen(invoice.nextAttemptAt) }) }}
                  </span>
                </div>
              </td>
              <td :data-label="t('admin.invoices.colNumber')">
                <div class="admin-cell-pair">
                  <template v-if="invoice.status === 'ISSUED'">
                    <span class="inv-number">{{ invoice.documentNumber }}</span>
                    <span class="admin-cell-sub inv-links">
                      <a v-if="invoice.pdfUrl" :href="invoice.pdfUrl" target="_blank" rel="noopener noreferrer" class="admin-cell-link">{{ t('admin.invoices.pdf') }}</a>
                      <a v-if="invoice.verificationUrl" :href="invoice.verificationUrl" target="_blank" rel="noopener noreferrer" class="admin-cell-link">{{ t('admin.invoices.check') }}</a>
                    </span>
                  </template>
                  <span v-else-if="invoice.lastError" class="inv-error" :title="invoice.lastError">{{ invoice.lastError }}</span>
                  <span v-if="invoice.status !== 'ISSUED'" class="admin-cell-sub">{{ t('admin.invoices.colTries') }}: {{ invoice.attempts }}</span>
                </div>
              </td>
              <td class="admin-cell-actions">
                <div class="admin-actions">
                  <button v-if="invoice.status !== 'ISSUED'" class="admin-action" :disabled="retryingId === invoice.id" @click="retry(invoice)">
                    {{ retryingId === invoice.id ? t('admin.invoices.retrying') : t('admin.invoices.retry') }}
                  </button>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })
const { t } = useI18n()
const api = useApi()

const SKELETON_ROWS = 5
const statuses = ['PENDING', 'FAILED', 'ISSUED']

const statusFilter = ref('')
const invoices = ref([])
const loading = ref(true)
const failed = ref(false)
const notice = ref(null)
const retryingId = ref(null)

async function load() {
  loading.value = true
  failed.value = false
  try {
    const query = statusFilter.value ? `?status=${statusFilter.value}` : ''
    invoices.value = await api.get(`/admin/invoices${query}`)
  } catch {
    invoices.value = []
    failed.value = true
  } finally {
    loading.value = false
  }
}

function clearFilter() {
  statusFilter.value = ''
  return load()
}

// The same colours as Pretplate: waiting amber, issued green, needs a person red.
function pillClass(status) {
  return { PENDING: 'admin-pill-warning', ISSUED: 'admin-pill-success', FAILED: 'admin-pill-critical' }[status] || 'admin-pill-neutral'
}

function formatAmount(amount) {
  return `${new Intl.NumberFormat('sr-RS').format(amount)} RSD`
}

function formatWhen(value) {
  return value ? new Date(value).toLocaleString('sr-RS', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''
}

async function retry(invoice) {
  retryingId.value = invoice.id
  notice.value = null
  try {
    const result = await api.post(`/admin/invoices/${invoice.id}/retry`, {})
    notice.value =
      result.status === 'ISSUED'
        ? { tone: 'success', text: t('admin.invoices.retried') }
        : { tone: 'error', text: t('admin.invoices.retryStillFailing', { error: result.lastError || '' }) }
  } catch (e) {
    notice.value = { tone: 'error', text: extractErrorMessage(e, t('admin.invoices.retryNotPossible')) }
  } finally {
    retryingId.value = null
    await load()
  }
}

const connection = ref(null)
const checking = ref(false)

async function checkConnection() {
  checking.value = true
  try {
    connection.value = await api.get('/admin/fiscalization/status')
  } catch (e) {
    connection.value = { provider: 'fiscomm', ok: false, error: extractErrorMessage(e, t('auth.genericError')), taxLabel: '' }
  } finally {
    checking.value = false
  }
}

onMounted(() => {
  load()
  checkConnection()
})
useSeoMeta({ title: t('admin.invoices.title') })
</script>

<style lang="scss" scoped>
.inv-connection {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 18px;
}

.inv-connection-state {
  margin: 0;
  font-size: 15px;
  font-weight: 500;
}

.inv-connection-state.is-ok {
  color: $color-success;
}

.inv-connection-state.is-problem {
  color: $color-error;
}

.inv-facts {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px 24px;
  margin: 0;
}

@include respond-above(md) {
  .inv-facts {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.inv-fact {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 13px;
}

.inv-fact dt {
  font-weight: 300;
  color: $color-text-muted;
}

.inv-fact dd {
  margin: 0;
  overflow-wrap: anywhere;
  color: $color-text;
}

.inv-notice {
  margin: 0 0 16px;
  padding: 12px 16px;
  border-radius: $radius-input;
  font-size: 14px;
}

.inv-notice.is-success {
  background: $color-background;
  color: $color-success;
}

.inv-notice.is-error {
  background: $color-background;
  color: $color-error;
}

.inv-number {
  overflow-wrap: anywhere;
}

.inv-links {
  display: flex;
  gap: 12px;
}

// The reason a receipt could not be issued, cut to a line; the whole text is the tooltip.
.inv-error {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  max-width: 340px;
  overflow: hidden;
  font-size: 12px;
  line-height: 1.4;
  color: $color-error;
}

.admin-cell-link {
  color: $color-primary;
}

.admin-cell-link:hover {
  text-decoration: underline;
}
</style>
