<template>
  <div>
    <h1 class="text-page-title mb-4">{{ role === 'owner' ? t('dashboard.requests') : t('dashboard.myBookings') }}</h1>

    <div class="form-row-inline mb-4">
      <button class="btn btn-sm" :class="role === 'guest' ? 'btn-primary-flat' : 'btn-tertiary'" @click="setRole('guest')">
        {{ t('dashboard.bookingsAsGuest') }}
      </button>
      <button class="btn btn-sm" :class="role === 'owner' ? 'btn-primary-flat' : 'btn-tertiary'" @click="setRole('owner')">
        {{ t('dashboard.bookingsAsOwner') }}
      </button>
      <select v-model="status" class="form-control form-select status-filter" @change="load">
        <option value="">{{ t('common.all') }}</option>
        <option v-for="s in statuses" :key="s" :value="s">{{ t(`booking.status${statusLabel(s)}`) }}</option>
      </select>
    </div>

    <p v-if="!bookings?.length" class="text-muted">{{ status ? t('dashboard.noBookingsFiltered') : t('dashboard.noBookingsAll') }}</p>

    <table v-else class="table table-responsive-cards">
      <thead>
        <tr>
          <th>{{ t('listing.title') }}</th>
          <th>{{ t('booking.dateTime') }}</th>
          <th>{{ t('booking.totalAmount') }}</th>
          <th>{{ t('common.status') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="b in bookings" :key="b.id" class="booking-row" @click="navigateTo(`/rezervacije/${b.id}`)">
          <td :data-label="t('listing.title')">{{ b.listing?.title }}</td>
          <td :data-label="t('booking.dateTime')">{{ new Date(b.startsAt).toLocaleDateString('sr-RS') }}</td>
          <td :data-label="t('booking.totalAmount')">{{ new Intl.NumberFormat('sr-RS').format(b.totalAmount || 0) }} RSD</td>
          <td :data-label="t('common.status')">
            <span class="badge" :class="statusBadge(b.status)">{{ t(`booking.status${statusLabel(b.status)}`) }}</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
definePageMeta({ middleware: 'auth', layout: 'dashboard' })
const { t } = useI18n()
const api = useApi()
const route = useRoute()
const router = useRouter()

const statuses = ['REQUESTED', 'AWAITING_PAYMENT', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'REJECTED', 'EXPIRED', 'NO_SHOW']
const role = ref(route.query.role === 'owner' ? 'owner' : 'guest')
// Deep links from the dashboard's "needs your attention" cards carry a
// status too (e.g. ?role=owner&status=REQUESTED) — this used to be silently
// ignored, landing the owner on an unfiltered list instead of the one item
// the card was actually about.
const status = ref(statuses.includes(route.query.status) ? route.query.status : '')
const bookings = ref([])

async function load() {
  const query = status.value ? `role=${role.value}&status=${status.value}` : `role=${role.value}`
  bookings.value = await api.get(`/bookings/mine?${query}`)
}

// T96 — this only ever updated local state, so the URL kept saying whatever
// role the page had opened with; refreshing (or sharing the link) silently
// dropped the user back into that original role instead of the one they'd
// switched to.
function setRole(r) {
  role.value = r
  router.replace({ query: { ...route.query, role: r } })
  load()
}

function statusLabel(status) {
  const map = {
    REQUESTED: 'Requested', AWAITING_PAYMENT: 'AwaitingPayment', CONFIRMED: 'Confirmed',
    COMPLETED: 'Completed', CANCELLED: 'Cancelled', REJECTED: 'Rejected', EXPIRED: 'Expired', NO_SHOW: 'NoShow',
  }
  return map[status] || 'Requested'
}
function statusBadge(status) {
  const map = {
    REQUESTED: 'badge-warning', AWAITING_PAYMENT: 'badge-warning', CONFIRMED: 'badge-success',
    COMPLETED: 'badge-success', CANCELLED: 'badge-critical', REJECTED: 'badge-critical', EXPIRED: 'badge-critical', NO_SHOW: 'badge-critical',
  }
  return map[status] || 'badge-neutral'
}

onMounted(load)
// T96 — both nav links landed on this same page with the tab title always
// reading "Moje rezervacije", even for the owner's "Zahtevi za rezervaciju".
useSeoMeta({ title: () => (role.value === 'owner' ? t('dashboard.requests') : t('dashboard.myBookings')) })
</script>

<style lang="scss" scoped>
.booking-row {
  cursor: pointer;
}

.status-filter {
  max-width: 220px;
}
</style>
