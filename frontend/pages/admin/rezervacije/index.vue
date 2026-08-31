<template>
  <div>
    <h1 class="text-page-title mb-4">{{ t('admin.bookings') }}</h1>

    <div class="form-row-inline mb-4">
      <input v-model="search" type="text" class="form-control" :placeholder="t('admin.searchBookings')" @keyup.enter="load" />
      <select v-model="status" class="form-control form-select" @change="load">
        <option value="">{{ t('admin.allStatuses') }}</option>
        <option v-for="s in STATUSES" :key="s" :value="s">{{ t(`booking.status${statusKey(s)}`) }}</option>
      </select>
      <button class="btn btn-tertiary btn-sm" @click="load">{{ t('common.search') }}</button>
    </div>

    <p v-if="!bookings?.length" class="text-muted">{{ t('admin.noItems') }}</p>
    <table v-else class="table table-responsive-cards">
      <thead>
        <tr>
          <th>{{ t('booking.listingTitle') }}</th>
          <th>{{ t('booking.guestNameLabel') }}</th>
          <th>{{ t('admin.bookingOwnerLabel') }}</th>
          <th>{{ t('booking.checkIn') }}</th>
          <th>{{ t('booking.totalAmount') }}</th>
          <th>{{ t('admin.statusLabel') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="b in bookings" :key="b.id" class="booking-row" @click="navigateTo(`/admin/rezervacije/${b.id}`)">
          <td :data-label="t('booking.listingTitle')">{{ b.listingTitle }}</td>
          <td :data-label="t('booking.guestNameLabel')">{{ b.guestName }}</td>
          <td :data-label="t('admin.bookingOwnerLabel')">{{ b.ownerName }}</td>
          <td :data-label="t('booking.checkIn')">{{ new Date(b.startsAt).toLocaleDateString('sr-RS') }}</td>
          <td :data-label="t('booking.totalAmount')">{{ new Intl.NumberFormat('sr-RS').format(b.totalAmount || 0) }} RSD</td>
          <td :data-label="t('admin.statusLabel')">
            <span class="badge" :class="statusBadgeClass(b.status)">{{ t(`booking.status${statusKey(b.status)}`) }}</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
// T99 — read-only search so support can find the booking a guest/owner is
// calling about; no status-changing actions here by design (that stays a
// separate, later ticket per the scope note).
definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })
const { t } = useI18n()
const api = useApi()

const STATUSES = ['REQUESTED', 'AWAITING_PAYMENT', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'REJECTED', 'EXPIRED', 'NO_SHOW']
const STATUS_KEY_MAP = {
  REQUESTED: 'Requested', AWAITING_PAYMENT: 'AwaitingPayment', CONFIRMED: 'Confirmed', COMPLETED: 'Completed',
  CANCELLED: 'Cancelled', REJECTED: 'Rejected', EXPIRED: 'Expired', NO_SHOW: 'NoShow',
}
function statusKey(s) {
  return STATUS_KEY_MAP[s] || 'Requested'
}
function statusBadgeClass(s) {
  if (['CONFIRMED', 'COMPLETED'].includes(s)) return 'badge-success'
  if (['CANCELLED', 'REJECTED', 'EXPIRED', 'NO_SHOW'].includes(s)) return 'badge-critical'
  return 'badge-info'
}

const search = ref('')
const status = ref('')
const bookings = ref([])

async function load() {
  const params = new URLSearchParams()
  if (search.value) params.set('search', search.value)
  if (status.value) params.set('status', status.value)
  const query = params.toString() ? `?${params.toString()}` : ''
  bookings.value = await api.get(`/admin/bookings${query}`)
}

onMounted(load)
useSeoMeta({ title: t('admin.bookings') })
</script>

<style lang="scss" scoped>
.form-row-inline {
  display: flex;
  gap: 8px;
}

.booking-row {
  cursor: pointer;
}
</style>
