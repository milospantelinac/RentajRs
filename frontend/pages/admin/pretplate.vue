<template>
  <div>
    <DashboardPageHeader :title="t('admin.subscriptions')" :subtitle="t('admin.subtitle.subscriptions')" />

    <div class="admin-filters">
      <select v-model="statusFilter" class="admin-field" :aria-label="t('admin.statusLabel')" @change="load">
        <option value="">{{ t('admin.allStatuses') }}</option>
        <option v-for="s in statuses" :key="s" :value="s">{{ statusLabel(s) }}</option>
      </select>
    </div>

    <StateBlock
      v-if="failed"
      card
      error
      icon="packages"
      :title="t('admin.loadErrorTitle')"
      :text="t('admin.loadErrorText')"
    >
      <button type="button" class="state-block-action" @click="load">{{ t('errorPage.tryAgain') }}</button>
    </StateBlock>

    <StateBlock
      v-else-if="!loading && !subscriptions.length"
      card
      icon="packages"
      :title="t(statusFilter ? 'admin.empty.subscriptionsFilter.title' : 'admin.empty.subscriptions.title')"
      :text="t(statusFilter ? 'admin.empty.subscriptionsFilter.text' : 'admin.empty.subscriptions.text')"
    >
      <button v-if="statusFilter" type="button" class="state-block-action" @click="clearFilter">{{ t('search.clearAllFilters') }}</button>
    </StateBlock>

    <div v-else class="admin-card admin-card-table">
      <table class="admin-table">
        <thead>
          <tr>
            <th>{{ t('admin.userLabel') }}</th>
            <th>{{ t('billing.receiptPackage') }}</th>
            <th>{{ t('admin.statusLabel') }}</th>
            <th>{{ t('billing.expiresOn') }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <template v-if="loading">
            <tr v-for="index in SKELETON_ROWS" :key="`loading-${index}`" aria-hidden="true">
              <td>
                <SkeletonBox width="46%" height="15px" />
                <SkeletonBox class="admin-skeleton-sub" width="62%" height="13px" />
              </td>
              <td><SkeletonBox width="72px" height="15px" /></td>
              <td><SkeletonBox width="86px" height="21px" radius="999px" /></td>
              <td><SkeletonBox width="82px" height="15px" /></td>
              <td><SkeletonBox width="60px" height="15px" /></td>
            </tr>
          </template>
          <template v-else>
            <tr v-for="s in subscriptions" :key="s.id">
              <td :data-label="t('admin.userLabel')">
                <div class="admin-cell-pair">
                  <span class="admin-cell-name">{{ s.user?.firstName }} {{ s.user?.lastName }}</span>
                  <span class="admin-cell-sub">{{ s.user?.email }}</span>
                </div>
              </td>
              <td :data-label="t('billing.receiptPackage')">
                <!-- Administracija > Oglasi: a package an admin gave without payment, and who gave it. -->
                <div class="admin-cell-pair">
                  <span>{{ s.package?.key }}</span>
                  <span v-if="s.grantedByAdmin" class="admin-cell-sub">
                    {{ t('adminListings.grantedByShort', { name: `${s.grantedByAdmin.firstName} ${s.grantedByAdmin.lastName}`.trim() }) }}
                  </span>
                </div>
              </td>
              <td :data-label="t('admin.statusLabel')">
                <span class="admin-pill" :class="statusPillClass(s.status)">{{ statusLabel(s.status) }}</span>
              </td>
              <td :data-label="t('billing.expiresOn')">
                {{
                  s.expiresAt
                    ? new Date(s.expiresAt).toLocaleDateString('sr-RS')
                    : s.grantedByAdmin && s.status === 'ACTIVE'
                      ? t('adminListings.endsNeverShort')
                      : '-'
                }}
              </td>
              <td class="admin-cell-actions">
                <div class="admin-actions">
                  <button v-if="s.status === 'PENDING_ACTIVATION'" class="admin-action" @click="activate(s.id)">
                    {{ t('admin.activateSubscription') }}
                  </button>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <div class="admin-card">
      <div class="admin-card-head">
        <p class="admin-card-title">{{ t('admin.updatePrice') }}</p>
      </div>
      <div class="admin-card-body">
        <div v-for="pkg in packages" :key="pkg.id" class="price-row">
          <p class="price-key">{{ pkg.key }}</p>
          <div class="form-group price-field">
            <label class="form-label">{{ t('admin.priceMonthly') }}</label>
            <input v-model.number="priceForms[pkg.id].priceMonthlyRsd" type="number" class="form-control" />
          </div>
          <div class="form-group price-field">
            <label class="form-label">{{ t('admin.priceYearly') }}</label>
            <input v-model.number="priceForms[pkg.id].priceYearlyRsd" type="number" class="form-control" />
          </div>
          <button class="btn btn-primary-flat btn-sm price-save" @click="updatePrice(pkg.id)">{{ t('common.save') }}</button>
        </div>
      </div>
    </div>

    <!-- T129: featured listings, their requests and queue have their own page. -->
    <p class="admin-card-note subs-featured-link">
      {{ t('admin.featured.movedNote') }}
      <NuxtLink to="/admin/istaknuti-oglasi" class="admin-cell-link">{{ t('admin.featured.title') }}</NuxtLink>
    </p>
  </div>
</template>

<script setup>
definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })
const { t } = useI18n()
const api = useApi()

const SKELETON_ROWS = 5

const statuses = ['AWAITING_PAYMENT', 'PENDING_ACTIVATION', 'SCHEDULED', 'ACTIVE', 'EXPIRED', 'CANCELLED']
const statusFilter = ref('')
const subscriptions = ref([])
const loading = ref(true)
const failed = ref(false)

async function load() {
  loading.value = true
  failed.value = false
  try {
    const query = statusFilter.value ? `?status=${statusFilter.value}` : ''
    subscriptions.value = await api.get(`/admin/subscriptions${query}`)
  } catch {
    subscriptions.value = []
    failed.value = true
  } finally {
    loading.value = false
  }
}

function clearFilter() {
  statusFilter.value = ''
  return load()
}

// Dizajn 31's colours: live green, waiting on the owner amber, paid ahead
// blue, over in grey.
function statusPillClass(status) {
  const map = {
    AWAITING_PAYMENT: 'admin-pill-warning',
    PENDING_ACTIVATION: 'admin-pill-warning',
    SCHEDULED: 'admin-pill-info',
    ACTIVE: 'admin-pill-success',
    EXPIRED: 'admin-pill-critical',
    CANCELLED: 'admin-pill-neutral',
  }
  return map[status] || 'admin-pill-neutral'
}

function statusLabel(status) {
  const map = {
    AWAITING_PAYMENT: 'AwaitingPayment',
    PENDING_ACTIVATION: 'PendingActivation',
    SCHEDULED: 'Scheduled',
    ACTIVE: 'Active',
    EXPIRED: 'Expired',
    CANCELLED: 'Cancelled',
  }
  return t(`billing.status${map[status] || 'AwaitingPayment'}`)
}

async function activate(id) {
  await api.post(`/admin/subscriptions/${id}/activate`, {})
  await load()
}

const { data: packages } = await useAsyncData('admin-packages', () => api.get('/packages'))
const priceForms = reactive({})
for (const pkg of packages.value || []) {
  priceForms[pkg.id] = { priceMonthlyRsd: pkg.priceMonthly, priceYearlyRsd: pkg.priceYearly }
}

async function updatePrice(packageId) {
  await api.post(`/admin/packages/${packageId}/price`, priceForms[packageId])
}

onMounted(load)
useSeoMeta({ title: t('admin.subscriptions') })
</script>

<style lang="scss" scoped>
// A package's two prices and its save button on one line, parted the way the
// table's rows are.
.price-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 16px;
  padding: 18px 0;
  border-bottom: 1px solid $color-border;
}

.price-row:first-child {
  padding-top: 0;
}

.price-row:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.price-key {
  flex: 0 0 110px;
  padding-bottom: 14px;
  font-size: 15px;
  font-weight: 500;
  line-height: normal;
  color: $color-text;
}

.price-field {
  flex: 1 1 180px;
  min-width: 0;
}

.price-save {
  margin-bottom: 7px;
}

.subs-featured-link {
  margin-top: 20px;
}

.admin-cell-link {
  color: $color-primary;
}

.admin-cell-link:hover {
  text-decoration: underline;
}

@include mobile-only {
  .price-key {
    flex-basis: 100%;
    padding-bottom: 0;
  }

  .price-save {
    margin-bottom: 0;
  }
}
</style>
