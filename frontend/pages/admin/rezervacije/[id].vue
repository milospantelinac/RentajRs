<template>
  <div>
    <NuxtLink to="/admin/sporovi" class="btn btn-tertiary btn-sm mb-3">&larr; {{ t('admin.disputes') }}</NuxtLink>

    <p v-if="notFound" class="text-muted">{{ t('admin.bookingNotFound') }}</p>
    <div v-else-if="booking" class="card">
      <div class="card-body">
        <h1 class="text-section-title mb-3">{{ booking.listingTitle }}</h1>
        <div class="row mb-2">
          <div class="col-6 text-muted">{{ t('admin.statusLabel') }}</div>
          <div class="col-6">{{ t(`booking.status${statusKey}`) }}</div>
        </div>
        <div class="row mb-2">
          <div class="col-6 text-muted">{{ t('booking.checkIn') }}</div>
          <div class="col-6">{{ new Date(booking.startsAt).toLocaleDateString('sr-RS') }}</div>
        </div>
        <div class="row mb-2">
          <div class="col-6 text-muted">{{ t('booking.checkOut') }}</div>
          <div class="col-6">{{ new Date(booking.endsAt).toLocaleDateString('sr-RS') }}</div>
        </div>
        <div class="row mb-2">
          <div class="col-6 text-muted">{{ t('admin.submittedAt') }}</div>
          <div class="col-6">{{ formatDateTime(booking.createdAt) }}</div>
        </div>
        <div class="row mb-2">
          <div class="col-6 text-muted">{{ t('booking.guestNameLabel') }}</div>
          <div class="col-6">{{ booking.guestName }} · {{ booking.guestEmail }}</div>
        </div>
        <div class="row mb-2">
          <div class="col-6 text-muted">{{ t('admin.bookingOwnerLabel') }}</div>
          <div class="col-6">{{ booking.ownerName }} · {{ booking.ownerEmail }}</div>
        </div>
        <div class="row mb-2">
          <div class="col-6 text-muted">{{ t('booking.totalAmount') }}</div>
          <div class="col-6">{{ new Intl.NumberFormat('sr-RS').format(booking.totalAmount || 0) }} RSD</div>
        </div>
        <div v-if="booking.cancellationTermsSnapshot" class="row mb-2">
          <div class="col-6 text-muted">{{ t('booking.cancellationTerms') }}</div>
          <div class="col-6">{{ booking.cancellationTermsSnapshot }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
// T90 — read-only admin view of a single booking, linked from a dispute
// card so the admin can tell which of a listing's several bookings a
// dispute actually concerns. Deliberately separate from the guest/owner
// rezervacije/[id].vue page (gated to those two parties) rather than
// weakening that page's access control for admins.
definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })
const { t } = useI18n()
const api = useApi()
const route = useRoute()

const booking = ref(null)
const notFound = ref(false)

const statusKey = computed(() => {
  const map = {
    REQUESTED: 'Requested', AWAITING_PAYMENT: 'AwaitingPayment', CONFIRMED: 'Confirmed',
    COMPLETED: 'Completed', CANCELLED: 'Cancelled', REJECTED: 'Rejected', EXPIRED: 'Expired', NO_SHOW: 'NoShow',
  }
  return map[booking.value?.status] || 'Requested'
})

onMounted(async () => {
  try {
    booking.value = await api.get(`/admin/bookings/${route.params.id}`)
  } catch (e) {
    if (e?.response?.status === 404) notFound.value = true
    else throw e
  }
})

useSeoMeta({ title: t('admin.disputes') })
</script>
