<template>
  <div>
    <h2 class="text-section-title mb-3">{{ t('admin.subscriptions') }}</h2>

    <div class="form-row-inline mb-4">
      <select v-model="statusFilter" class="form-control form-select" @change="load">
        <option value="">—</option>
        <option v-for="s in statuses" :key="s" :value="s">{{ statusLabel(s) }}</option>
      </select>
    </div>

    <table class="table table-responsive-cards mb-5">
      <thead>
        <tr>
          <th>{{ t('auth.email') }}</th>
          <th>{{ t('admin.statusLabel') }}</th>
          <th>{{ t('billing.expiresOn') }}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="s in subscriptions" :key="s.id">
          <td :data-label="t('auth.email')">{{ s.user?.firstName }} {{ s.user?.lastName }} — {{ s.user?.email }} ({{ s.package?.key }})</td>
          <td :data-label="t('admin.statusLabel')">
            <span class="badge" :class="statusBadge(s.status)">{{ statusLabel(s.status) }}</span>
          </td>
          <td :data-label="t('billing.expiresOn')">{{ s.expiresAt ? new Date(s.expiresAt).toLocaleDateString('sr-RS') : '—' }}</td>
          <td :data-label="''">
            <button v-if="s.status === 'PENDING_ACTIVATION'" class="btn btn-primary-flat btn-sm" @click="activate(s.id)">
              {{ t('admin.activateSubscription') }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <h2 class="text-section-title mb-3">{{ t('admin.updatePrice') }}</h2>
    <div v-for="pkg in packages" :key="pkg.id" class="card mb-3">
      <div class="card-body">
        <p class="text-body mb-2"><strong>{{ pkg.key }}</strong></p>
        <div class="row">
          <div class="col-6">
            <div class="form-group mb-2">
              <label class="form-label">{{ t('admin.priceMonthly') }}</label>
              <input v-model.number="priceForms[pkg.id].priceMonthlyRsd" type="number" class="form-control" />
            </div>
          </div>
          <div class="col-6">
            <div class="form-group mb-2">
              <label class="form-label">{{ t('admin.priceYearly') }}</label>
              <input v-model.number="priceForms[pkg.id].priceYearlyRsd" type="number" class="form-control" />
            </div>
          </div>
        </div>
        <button class="btn btn-primary-flat btn-sm" @click="updatePrice(pkg.id)">{{ t('common.save') }}</button>
      </div>
    </div>

    <h2 class="text-section-title mb-2">{{ t('admin.featuredWaitlist') }}</h2>
    <p class="text-muted mb-3">{{ t('admin.featuredWaitlistHint') }}</p>
    <p v-if="!waitlist?.length" class="text-muted mb-5">{{ t('admin.noItems') }}</p>
    <table v-else class="table table-responsive-cards mb-5">
      <thead>
        <tr>
          <th>{{ t('admin.newListings') }}</th>
          <th>{{ t('admin.categories') }}</th>
          <th>{{ t('admin.waitlistedSince') }}</th>
          <th>{{ t('admin.durationDays') }}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="entry in waitlist" :key="entry.id">
          <td :data-label="t('admin.newListings')">
            <NuxtLink :to="`/oglasi/${entry.listing.slug}`" target="_blank">{{ entry.listing.title }}</NuxtLink>
          </td>
          <td :data-label="t('admin.categories')">{{ entry.category?.slug }}</td>
          <td :data-label="t('admin.waitlistedSince')">{{ new Date(entry.requestedAt).toLocaleDateString('sr-RS') }}</td>
          <td :data-label="t('admin.durationDays')">
            <select v-model.number="durationForms[entry.id]" class="form-control form-select">
              <option :value="7">7</option>
              <option :value="15">15</option>
              <option :value="30">30</option>
            </select>
          </td>
          <td :data-label="''">
            <button class="btn btn-primary-flat btn-sm" @click="assignFree(entry)">{{ t('admin.assignFree') }}</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })
const { t } = useI18n()
const api = useApi()

const statuses = ['AWAITING_PAYMENT', 'PENDING_ACTIVATION', 'ACTIVE', 'GRACE', 'EXPIRED', 'CANCELLED']
const statusFilter = ref('')
const subscriptions = ref([])

async function load() {
  const query = statusFilter.value ? `?status=${statusFilter.value}` : ''
  subscriptions.value = await api.get(`/admin/subscriptions${query}`)
}

function statusBadge(status) {
  const map = { AWAITING_PAYMENT: 'badge-neutral', PENDING_ACTIVATION: 'badge-warning', ACTIVE: 'badge-success', GRACE: 'badge-warning', EXPIRED: 'badge-critical', CANCELLED: 'badge-neutral' }
  return map[status] || 'badge-neutral'
}

function statusLabel(status) {
  const map = {
    AWAITING_PAYMENT: 'AwaitingPayment',
    PENDING_ACTIVATION: 'PendingActivation',
    ACTIVE: 'Active',
    GRACE: 'Grace',
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

const { data: waitlist, refresh: refreshWaitlist } = await useAsyncData('admin-featured-waitlist', () =>
  api.get('/admin/featured/waitlist'),
)
const durationForms = reactive({})
for (const entry of waitlist.value || []) {
  durationForms[entry.id] = 7
}

async function assignFree(entry) {
  await api.post(`/admin/featured/${entry.listing.id}/assign-free`, {
    durationDays: durationForms[entry.id] || 7,
  })
  await refreshWaitlist()
}

onMounted(load)
useSeoMeta({ title: t('admin.subscriptions') })
</script>

<style lang="scss" scoped>
.form-row-inline {
  display: flex;
  gap: 8px;
}
</style>
