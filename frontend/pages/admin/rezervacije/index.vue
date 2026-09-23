<template>
  <div>
    <DashboardPageHeader :title="t('admin.bookings')" :subtitle="t('admin.subtitle.bookings')" />

    <div class="admin-filters">
      <input
        v-model="search"
        type="search"
        class="admin-field admin-field-search"
        :placeholder="t('admin.searchBookings')"
        @keyup.enter="load"
      />
      <select v-model="status" class="admin-field" :aria-label="t('admin.statusLabel')" @change="load">
        <option value="">{{ t('admin.allStatuses') }}</option>
        <option v-for="s in STATUSES" :key="s" :value="s">{{ t(`booking.status${statusKey(s)}`) }}</option>
      </select>
      <button class="btn btn-tertiary btn-sm" @click="load">{{ t('common.search') }}</button>
    </div>

    <StateBlock
      v-if="failed"
      card
      error
      icon="bookings"
      :title="t('admin.loadErrorTitle')"
      :text="t('admin.loadErrorText')"
    >
      <button type="button" class="state-block-action" @click="load">{{ t('errorPage.tryAgain') }}</button>
    </StateBlock>

    <!-- Dizajn 44: a search that found nothing suggests dropping a filter. -->
    <StateBlock
      v-else-if="!loading && !bookings.length"
      card
      icon="bookings"
      :title="t(filtered ? 'admin.empty.bookingsSearch.title' : 'admin.empty.bookings.title')"
      :text="t(filtered ? 'admin.empty.bookingsSearch.text' : 'admin.empty.bookings.text')"
    >
      <button v-if="filtered" type="button" class="state-block-action" @click="clearFilters">{{ t('search.clearAllFilters') }}</button>
    </StateBlock>

    <div v-else class="admin-card admin-card-table">
      <table class="admin-table admin-table-tight">
        <thead>
          <tr>
            <th>{{ t('booking.listingTitle') }}</th>
            <th>{{ t('booking.guestNameLabel') }}</th>
            <th>{{ t('admin.bookingOwnerLabel') }}</th>
            <th>{{ t('booking.checkIn') }}</th>
            <th>{{ t('booking.totalAmount') }}</th>
            <th>{{ t('admin.statusLabel') }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <template v-if="loading">
            <tr v-for="index in SKELETON_ROWS" :key="`loading-${index}`" aria-hidden="true">
              <td><SkeletonBox width="82%" height="15px" /></td>
              <td><SkeletonBox width="70%" height="15px" /></td>
              <td><SkeletonBox width="70%" height="15px" /></td>
              <td><SkeletonBox width="76px" height="15px" /></td>
              <td><SkeletonBox width="88px" height="15px" /></td>
              <td><SkeletonBox width="86px" height="21px" radius="999px" /></td>
              <td><SkeletonBox width="54px" height="15px" /></td>
            </tr>
          </template>
          <template v-else>
            <tr v-for="b in bookings" :key="b.id" class="admin-row-link" @click="navigateTo(`/admin/rezervacije/${b.id}`)">
              <td :data-label="t('booking.listingTitle')">
                <span class="admin-cell-name">{{ b.listingTitle }}</span>
              </td>
              <td :data-label="t('booking.guestNameLabel')">{{ b.guestName }}</td>
              <td :data-label="t('admin.bookingOwnerLabel')">{{ b.ownerName }}</td>
              <td :data-label="t('booking.checkIn')">{{ new Date(b.startsAt).toLocaleDateString('sr-RS') }}</td>
              <td :data-label="t('booking.totalAmount')">{{ new Intl.NumberFormat('sr-RS').format(b.totalAmount || 0) }} RSD</td>
              <td :data-label="t('admin.statusLabel')">
                <span class="admin-pill" :class="statusPillClass(b.status)">{{ t(`booking.status${statusKey(b.status)}`) }}</span>
              </td>
              <td class="admin-cell-actions">
                <div class="admin-actions">
                  <NuxtLink :to="`/admin/rezervacije/${b.id}`" class="admin-action" @click.stop>{{ t('admin.viewDetails') }}</NuxtLink>
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
// T99 — read-only search so support can find the booking a guest/owner is
// calling about; no status-changing actions here by design (that stays a
// separate, later ticket per the scope note).
definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })
const { t } = useI18n()
const api = useApi()

const SKELETON_ROWS = 6

const STATUSES = ['REQUESTED', 'AWAITING_PAYMENT', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'REJECTED', 'EXPIRED', 'NO_SHOW']
const STATUS_KEY_MAP = {
  REQUESTED: 'Requested', AWAITING_PAYMENT: 'AwaitingPayment', CONFIRMED: 'Confirmed', COMPLETED: 'Completed',
  CANCELLED: 'Cancelled', REJECTED: 'Rejected', EXPIRED: 'Expired', NO_SHOW: 'NoShow',
}
function statusKey(s) {
  return STATUS_KEY_MAP[s] || 'Requested'
}
// Dizajn 31's colours: live green, waiting blue, over in grey, gone wrong red.
function statusPillClass(s) {
  if (['CONFIRMED', 'COMPLETED'].includes(s)) return 'admin-pill-success'
  if (['CANCELLED', 'REJECTED', 'EXPIRED', 'NO_SHOW'].includes(s)) return 'admin-pill-critical'
  if (s === 'AWAITING_PAYMENT') return 'admin-pill-warning'
  return 'admin-pill-info'
}

const search = ref('')
const status = ref('')
const bookings = ref([])
const loading = ref(true)
const failed = ref(false)
const filtered = ref(false)

async function load() {
  loading.value = true
  failed.value = false
  filtered.value = !!(search.value || status.value)
  try {
    const params = new URLSearchParams()
    if (search.value) params.set('search', search.value)
    if (status.value) params.set('status', status.value)
    const query = params.toString() ? `?${params.toString()}` : ''
    bookings.value = await api.get(`/admin/bookings${query}`)
  } catch {
    bookings.value = []
    failed.value = true
  } finally {
    loading.value = false
  }
}

function clearFilters() {
  search.value = ''
  status.value = ''
  return load()
}

onMounted(load)
useSeoMeta({ title: t('admin.bookings') })
</script>
