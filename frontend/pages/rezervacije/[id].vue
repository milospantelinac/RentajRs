<template>
  <div v-if="booking" class="container booking-detail py-4">
    <div class="row justify-content-center">
      <div class="col-12 col-md-7">
        <h1 class="text-page-title mb-1">{{ booking.listing?.title }}</h1>
        <span class="badge mb-4" :class="statusBadgeClass">{{ t(`booking.status${statusKey}`) }}</span>

        <div class="card mb-4">
          <div class="card-body">
            <div class="row mb-2">
              <div class="col-6 text-muted">{{ t('booking.listingTitle') }}</div>
              <div class="col-6">{{ booking.listing?.title }}</div>
            </div>
            <div class="row mb-2">
              <div class="col-6 text-muted">{{ t('booking.checkIn') }}</div>
              <div class="col-6">{{ new Date(booking.startsAt).toLocaleString('sr-RS') }}</div>
            </div>
            <div class="row mb-2">
              <div class="col-6 text-muted">{{ t('booking.checkOut') }}</div>
              <div class="col-6">{{ new Date(booking.endsAt).toLocaleString('sr-RS') }}</div>
            </div>
            <div v-if="booking.guestCount" class="row mb-2">
              <div class="col-6 text-muted">{{ t('booking.guestCount') }}</div>
              <div class="col-6">{{ booking.guestCount }}</div>
            </div>
            <div class="row mb-2">
              <div class="col-6 text-muted">{{ t('booking.totalAmount') }}</div>
              <div class="col-6">{{ formatPrice(booking.totalAmount) }}</div>
            </div>
            <div class="row mb-2">
              <div class="col-6 text-muted">{{ t('booking.payAmount') }}</div>
              <div class="col-6">{{ formatPrice(booking.amountDue) }}</div>
            </div>
            <div v-if="isOwner && booking.guestPhone" class="row mb-2">
              <div class="col-6 text-muted">{{ t('booking.guestPhone') }}</div>
              <div class="col-6"><a :href="`tel:${booking.guestPhone}`">{{ booking.guestPhone }}</a></div>
            </div>
            <div v-if="booking.guestMessage" class="row mb-2">
              <div class="col-6 text-muted">{{ t('booking.guestMessage') }}</div>
              <div class="col-6">{{ booking.guestMessage }}</div>
            </div>
            <!-- T87 — frozen at the moment the request was made (Booking.cancellationTermsSnapshot),
                 not regenerated from the listing's current settings — a later policy edit must
                 never rewrite what applied to a booking already made under the old one. -->
            <div v-if="booking.cancellationTermsSnapshot" class="row mb-2">
              <div class="col-6 text-muted">{{ t('booking.cancellationTerms') }}</div>
              <div class="col-6">{{ booking.cancellationTermsSnapshot }}</div>
            </div>
          </div>
        </div>

        <!-- T47 — role-aware: the guest sees the QR/pay instructions they
             need to act on; the owner would only ever be scanning their own
             collection code here, so they get a status confirmation instead. -->
        <div v-if="booking.status === 'AWAITING_PAYMENT'" class="card mb-4">
          <div class="card-body text-center">
            <template v-if="isOwner">
              <p class="text-body mb-2">{{ t('booking.ownerAwaitingPaymentNotice') }}</p>
            </template>
            <template v-else>
              <p class="text-body mb-2">{{ t('booking.payInstructions') }}</p>
              <p class="text-muted mb-3">{{ t('booking.notMediating') }}</p>
              <img v-if="qrDataUrl" :src="qrDataUrl" :alt="t('booking.scanQr')" class="qr-image mb-3" />
              <p class="text-muted">{{ t('booking.payDeadline') }}: {{ new Date(booking.paymentDeadline).toLocaleString('sr-RS') }}</p>
            </template>
          </div>
        </div>
        <!-- T49 — cash bookings skip AWAITING_PAYMENT entirely (confirmed
             immediately, see BookingsService.approveRequest), so without this
             they got no payment-related messaging at all. -->
        <div v-else-if="booking.paymentMethod === 'CASH' && ['CONFIRMED', 'COMPLETED'].includes(booking.status)" class="card mb-4">
          <div class="card-body text-center">
            <p class="text-body">{{ t('booking.cashPaymentNotice') }}</p>
          </div>
        </div>

        <div class="action-buttons">
          <template v-if="isOwner">
            <button v-if="booking.status === 'REQUESTED'" class="btn btn-primary-flat" @click="act('approve')">{{ t('booking.approve') }}</button>
            <button v-if="booking.status === 'REQUESTED'" class="btn btn-danger" @click="act('reject')">{{ t('booking.reject') }}</button>
            <button v-if="booking.status === 'AWAITING_PAYMENT'" class="btn btn-primary-flat" @click="act('confirm-payment')">
              {{ t('booking.confirmPayment') }}
            </button>
            <button v-if="booking.status === 'CONFIRMED'" class="btn btn-tertiary" @click="act('no-show')">{{ t('booking.markNoShow') }}</button>
            <button v-if="['REQUESTED','AWAITING_PAYMENT','CONFIRMED'].includes(booking.status)" class="btn btn-danger" @click="act('cancel-by-owner')">
              {{ t('booking.cancelBooking') }}
            </button>
          </template>
          <template v-else>
            <button v-if="['REQUESTED','AWAITING_PAYMENT'].includes(booking.status)" class="btn btn-danger" @click="act('cancel')">
              {{ t('booking.cancelBooking') }}
            </button>
            <button v-if="booking.status === 'AWAITING_PAYMENT'" class="btn btn-tertiary" @click="act('dispute-payment')">
              {{ t('booking.reportUnpaidConfirmed') }}
            </button>
            <button v-if="booking.status === 'NO_SHOW' && !booking.noShowDisputed" class="btn btn-tertiary" @click="act('dispute-no-show')">
              {{ t('booking.disputeNoShow') }}
            </button>
          </template>
        </div>

        <p v-if="error" class="form-error mt-3">{{ error }}</p>

        <div v-if="booking.status === 'COMPLETED'" class="card mt-4">
          <div class="card-body">
            <template v-if="reviewStatus?.canReview">
              <h2 class="text-section-title mb-3">{{ t('reviews.leaveReview') }}</h2>
              <div class="form-group mb-3">
                <label class="form-label">{{ t('reviews.rating') }}</label>
                <div class="rating-stars">
                  <button
                    v-for="n in 5"
                    :key="n"
                    type="button"
                    class="rating-star"
                    :class="{ 'rating-star-filled': n <= reviewForm.rating }"
                    @click="reviewForm.rating = n"
                  >★</button>
                </div>
              </div>
              <div v-if="reviewStatus.direction === 'OWNER_TO_GUEST'" class="form-group mb-3">
                <label class="form-label">{{ t('reviews.tagsTitle') }}</label>
                <div class="tag-options">
                  <button
                    v-for="tag in guestTags"
                    :key="tag"
                    type="button"
                    class="btn btn-sm"
                    :class="reviewForm.tags.includes(tag) ? 'btn-primary-flat' : 'btn-tertiary'"
                    @click="toggleTag(tag)"
                  >{{ t(`reviews.tags.${tag}`) }}</button>
                </div>
              </div>
              <div class="form-group mb-3">
                <label class="form-label">{{ t('reviews.comment') }}</label>
                <textarea v-model="reviewForm.comment" class="form-control" rows="3" :placeholder="t('reviews.commentPlaceholder')" maxlength="2000"></textarea>
              </div>
              <p v-if="reviewError" class="form-error mb-2">{{ reviewError }}</p>
              <button class="btn btn-primary-flat" :disabled="!reviewForm.rating || submittingReview" @click="submitReview">
                {{ t('reviews.submit') }}
              </button>
            </template>
            <template v-else-if="reviewStatus?.myReview">
              <h2 class="text-section-title mb-2">{{ t('reviews.yourReview') }}</h2>
              <p class="rating-display mb-2">{{ '★'.repeat(reviewStatus.myReview.rating) }}{{ '☆'.repeat(5 - reviewStatus.myReview.rating) }}</p>
              <p v-if="reviewStatus.myReview.comment" class="text-body mb-3">{{ reviewStatus.myReview.comment }}</p>
              <p v-if="!reviewStatus.counterpartReview" class="text-muted">{{ t('reviews.waitingForCounterpart') }}</p>
              <template v-else>
                <h3 class="text-label mt-3 mb-1">{{ t('reviews.counterpartReview') }}</h3>
                <p class="rating-display mb-2">{{ '★'.repeat(reviewStatus.counterpartReview.rating) }}{{ '☆'.repeat(5 - reviewStatus.counterpartReview.rating) }}</p>
                <p v-if="reviewStatus.counterpartReview.comment" class="text-body">{{ reviewStatus.counterpartReview.comment }}</p>
              </template>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ middleware: 'auth' })
const { t } = useI18n()
const api = useApi()
const route = useRoute()
const auth = useAuthStore()

const booking = ref(null)
const qrDataUrl = ref(null)
const error = ref('')

const reviewStatus = ref(null)
const reviewForm = reactive({ rating: 0, comment: '', tags: [] })
const reviewError = ref('')
const submittingReview = ref(false)
const guestTags = ['ARRIVED_ON_TIME', 'RETURNED_NEATLY', 'COMMUNICATIVE', 'LATE', 'DAMAGE', 'NO_SHOW']

const isOwner = computed(() => booking.value?.ownerId === auth.user?.id)
const statusKey = computed(() => {
  const map = {
    REQUESTED: 'Requested', AWAITING_PAYMENT: 'AwaitingPayment', CONFIRMED: 'Confirmed',
    COMPLETED: 'Completed', CANCELLED: 'Cancelled', EXPIRED: 'Expired', NO_SHOW: 'NoShow',
  }
  return map[booking.value?.status] || 'Requested'
})
const statusBadgeClass = computed(() => {
  const map = {
    REQUESTED: 'badge-warning', AWAITING_PAYMENT: 'badge-warning', CONFIRMED: 'badge-success',
    COMPLETED: 'badge-success', CANCELLED: 'badge-critical', EXPIRED: 'badge-critical', NO_SHOW: 'badge-critical',
  }
  return map[booking.value?.status] || 'badge-neutral'
})

function formatPrice(value) {
  return `${new Intl.NumberFormat('sr-RS').format(value || 0)} RSD`
}

async function load() {
  booking.value = await api.get(`/bookings/${route.params.id}`)
  if (booking.value.status === 'AWAITING_PAYMENT') {
    const qr = await api.get(`/bookings/${route.params.id}/qr`)
    qrDataUrl.value = qr.dataUrl
  }
  if (booking.value.status === 'COMPLETED') {
    reviewStatus.value = await api.get(`/bookings/${route.params.id}/reviews`)
  }
}

function toggleTag(tag) {
  const i = reviewForm.tags.indexOf(tag)
  if (i === -1) reviewForm.tags.push(tag)
  else reviewForm.tags.splice(i, 1)
}

async function submitReview() {
  reviewError.value = ''
  submittingReview.value = true
  try {
    await api.post('/reviews', {
      bookingId: route.params.id,
      rating: reviewForm.rating,
      comment: reviewForm.comment || undefined,
      tags: reviewStatus.value?.direction === 'OWNER_TO_GUEST' && reviewForm.tags.length ? reviewForm.tags : undefined,
    })
    reviewStatus.value = await api.get(`/bookings/${route.params.id}/reviews`)
  } catch (e) {
    reviewError.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    submittingReview.value = false
  }
}

async function act(action) {
  error.value = ''
  try {
    await api.post(`/bookings/${route.params.id}/${action}`, {})
    await load()
  } catch (e) {
    error.value = extractErrorMessage(e, t('auth.genericError'))
  }
}

onMounted(load)
useSeoMeta({ title: t('nav.dashboard') })
</script>

<style lang="scss" scoped>
.booking-detail {
  padding: 32px 0 64px;
}

.qr-image {
  width: 220px;
  height: 220px;
  margin: 0 auto;
}

.action-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.rating-stars {
  display: flex;
  gap: 4px;
}

.rating-star {
  font-size: 28px;
  line-height: 1;
  color: $color-border;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}

.rating-star-filled {
  color: $color-warning;
}

.rating-display {
  font-size: 20px;
  color: $color-warning;
  letter-spacing: 2px;
}

.tag-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
