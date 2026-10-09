<template>
  <div>
    <BackLink fallback="/admin/rezervacije" class="mb-4" />

    <template v-if="loading">
      <div class="admin-card" aria-hidden="true">
        <div class="admin-card-body">
          <SkeletonBox width="46%" height="17px" />
          <div v-for="index in SKELETON_ROWS" :key="`loading-${index}`" class="detail-row">
            <SkeletonBox width="120px" height="14px" />
            <SkeletonBox width="180px" height="14px" />
          </div>
        </div>
      </div>
    </template>

    <StateBlock
      v-else-if="notFound || failed"
      card
      error
      icon="bookings"
      :title="notFound ? t('admin.bookingNotFoundTitle') : t('admin.loadErrorTitle')"
      :text="notFound ? t('admin.bookingNotFound') : t('admin.loadErrorText')"
    >
      <NuxtLink v-if="notFound" to="/admin/rezervacije" class="state-block-action">{{ t('admin.bookings') }}</NuxtLink>
      <button v-else type="button" class="state-block-action" @click="load">{{ t('errorPage.tryAgain') }}</button>
    </StateBlock>

    <div v-else-if="booking" class="admin-card">
      <div class="admin-card-body">
        <div class="detail-head">
          <p class="admin-card-title">{{ booking.listingTitle }}</p>
          <span class="admin-pill" :class="statusPillClass">{{ t(`booking.status${statusKey}`) }}</span>
        </div>

        <dl class="detail-list">
          <div v-for="row in rows" :key="row.label" class="detail-row">
            <dt class="detail-label">{{ row.label }}</dt>
            <dd class="detail-value">{{ row.value }}</dd>
          </div>
        </dl>
      </div>
    </div>
  </div>
</template>

<script setup>
// T90 — read-only admin view of a single booking, linked from a dispute
// card so the admin can tell which of a listing's several bookings a
// dispute actually concerns. Deliberately separate from the guest/owner
// rezervacije/[id]/index.vue page (gated to those two parties) rather than
// weakening that page's access control for admins.
definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })
const { t } = useI18n()
const api = useApi()
const route = useRoute()

const SKELETON_ROWS = 6

const booking = ref(null)
const notFound = ref(false)
const failed = ref(false)
const loading = ref(true)

const STATUS_KEY_MAP = {
  REQUESTED: 'Requested', AWAITING_PAYMENT: 'AwaitingPayment', CONFIRMED: 'Confirmed',
  COMPLETED: 'Completed', CANCELLED: 'Cancelled', REJECTED: 'Rejected', EXPIRED: 'Expired', NO_SHOW: 'NoShow',
}
const statusKey = computed(() => STATUS_KEY_MAP[booking.value?.status] || 'Requested')
const statusPillClass = computed(() => {
  const status = booking.value?.status
  if (['CONFIRMED', 'COMPLETED'].includes(status)) return 'admin-pill-success'
  if (['CANCELLED', 'REJECTED', 'EXPIRED', 'NO_SHOW'].includes(status)) return 'admin-pill-critical'
  if (status === 'AWAITING_PAYMENT') return 'admin-pill-warning'
  return 'admin-pill-info'
})

// Dizajn 45: the same label-and-value rows the dashboard draws, built from a
// list so an absent field simply leaves no row behind.
const rows = computed(() => {
  const b = booking.value
  if (!b) return []
  const date = (value) => new Date(value).toLocaleDateString('sr-RS')
  const money = (value) => `${new Intl.NumberFormat('sr-RS').format(value || 0)} RSD`
  return [
    { label: t('booking.checkIn'), value: date(b.startsAt) },
    { label: t('booking.checkOut'), value: date(b.endsAt) },
    { label: t('admin.submittedAt'), value: formatDateTime(b.createdAt) },
    { label: t('booking.guestNameLabel'), value: `${b.guestName} · ${b.guestEmail}` },
    { label: t('admin.bookingOwnerLabel'), value: `${b.ownerName} · ${b.ownerEmail}` },
    // T127: a playroom's children and the adults who come with them.
    b.guestCount && {
      label: b.guestUnit === 'children' ? t('bookingForm.childrenCount') : t('booking.guestCount'),
      value: String(b.guestCount),
    },
    b.adultCount !== null && b.adultCount !== undefined && { label: t('bookingForm.adultsCount'), value: String(b.adultCount) },
    { label: t('booking.totalAmount'), value: money(b.totalAmount) },
    b.paymentMethod && {
      label: t('booking.paymentMethodLabel'),
      value: b.paymentMethod === 'CASH' ? t('booking.paymentMethodCash') : t('booking.paymentMethodOnline'),
    },
    b.cancellationTermsSnapshot && { label: t('booking.cancellationTerms'), value: b.cancellationTermsSnapshot },
  ].filter(Boolean)
})

async function load() {
  loading.value = true
  notFound.value = false
  failed.value = false
  try {
    booking.value = await api.get(`/admin/bookings/${route.params.id}`)
  } catch (e) {
    if (e?.response?.status === 404) notFound.value = true
    else failed.value = true
  } finally {
    loading.value = false
  }
}

onMounted(load)
useSeoMeta({ title: t('admin.bookings') })
</script>

<style lang="scss" scoped>
.detail-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 4px;
}

.detail-list {
  margin: 0;
}

// A line per field, parted the way the table's rows are.
.detail-row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  padding: 13px 0;
  border-bottom: 1px solid $color-border;
}

.detail-row:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}

.detail-label {
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 500;
  line-height: normal;
  color: $color-text-muted;
}

.detail-value {
  margin: 0;
  font-size: 15px;
  font-weight: 400;
  line-height: normal;
  color: $color-text;
  text-align: right;
  overflow-wrap: anywhere;
}
</style>
