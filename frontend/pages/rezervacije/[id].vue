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
              <div class="col-6">{{ formatCheckDate(booking.startsAt) }}</div>
            </div>
            <div class="row mb-2">
              <div class="col-6 text-muted">{{ t('booking.checkOut') }}</div>
              <div class="col-6">{{ formatCheckDate(booking.endsAt) }}</div>
            </div>
            <div v-if="booking.guestCount" class="row mb-2">
              <div class="col-6 text-muted">{{ t('booking.guestCount') }}</div>
              <div class="col-6">{{ booking.guestCount }}</div>
            </div>
            <!-- T78 — the owner was always meant to see the guest's name
                 (only the phone stays gated behind phoneUnlocked). -->
            <div v-if="isOwner && booking.guestName" class="row mb-2">
              <div class="col-6 text-muted">{{ t('booking.guestNameLabel') }}</div>
              <div class="col-6">{{ booking.guestName }}</div>
            </div>
            <div class="row mb-2">
              <div class="col-6 text-muted">{{ t('booking.totalAmount') }}</div>
              <div class="col-6">{{ formatPrice(booking.totalAmount) }}</div>
            </div>
            <!-- T77 — "Iznos za uplatu" only makes sense while payment is
                 actually pending; once paymentConfirmedAt is set (any status
                 reached after that point), show what was actually paid
                 instead of repeating a due amount that's no longer due. -->
            <div v-if="booking.status === 'AWAITING_PAYMENT'" class="row mb-2">
              <div class="col-6 text-muted">{{ t('booking.payAmount') }}</div>
              <div class="col-6">{{ formatPrice(booking.amountDue) }}</div>
            </div>
            <div v-else-if="booking.paymentConfirmedAt" class="row mb-2">
              <div class="col-6 text-muted">{{ t('booking.paidLabel') }}</div>
              <div class="col-6">
                {{ formatPrice(booking.amountDue) }} ·
                {{ t('booking.paidConfirmedOn', { date: new Date(booking.paymentConfirmedAt).toLocaleDateString('sr-RS') }) }}
              </div>
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
            <!-- T79 — who cancelled/rejected and when, for both sides. -->
            <div v-if="booking.cancellation" class="row mb-2">
              <div class="col-6 text-muted">{{ t(`booking.status${statusKey}`) }}</div>
              <div class="col-6">{{ cancellationLabel }} · {{ new Date(booking.cancellation.at).toLocaleString('sr-RS') }}</div>
            </div>
          </div>
        </div>

        <!-- T80 — symmetric to the owner getting the guest's phone: the
             guest only learns how to reach/find the owner once the stay is
             actually confirmed (backend gates this on phoneUnlocked), never
             on a bare request. -->
        <div v-if="!isOwner && booking.ownerName" class="card mb-4">
          <div class="card-body">
            <h2 class="text-section-title mb-3">{{ t('booking.ownerContactTitle') }}</h2>
            <div class="row mb-2">
              <div class="col-6 text-muted">{{ t('booking.ownerNameLabel') }}</div>
              <div class="col-6">{{ booking.ownerName }}</div>
            </div>
            <div v-if="booking.ownerPhone" class="row mb-2">
              <div class="col-6 text-muted">{{ t('booking.ownerPhoneLabel') }}</div>
              <div class="col-6"><a :href="`tel:${booking.ownerPhone}`">{{ booking.ownerPhone }}</a></div>
            </div>
            <div v-if="booking.listing?.address" class="row mb-2">
              <div class="col-6 text-muted">{{ t('booking.listingAddressLabel') }}</div>
              <div class="col-6">{{ booking.listing.address }}</div>
            </div>
            <NuxtLink v-if="booking.listing?.slug" :to="`/oglasi/${booking.listing.slug}`" class="btn btn-tertiary btn-sm mt-2">
              {{ t('booking.viewListing') }}
            </NuxtLink>
          </div>
        </div>

        <!-- T78/T93 — the owner gets no card at all in the pending state
             today: no sense of when the request came in, and no explanation
             of why the calendar looks blocked for a request they haven't
             acted on yet. -->
        <div v-if="booking.status === 'REQUESTED' && isOwner" class="card mb-4">
          <div class="card-body">
            <p class="text-body mb-2">{{ t('booking.ownerPendingNotice') }}</p>
            <p class="text-muted mb-0">{{ t('booking.requestReceivedAt') }}: {{ new Date(booking.createdAt).toLocaleString('sr-RS') }}</p>
          </div>
        </div>

        <!-- T47/T93 — role-aware: the guest sees the QR/pay instructions
             they need to act on; the owner gets a status confirmation plus
             the same deadline the guest sees (T93 — it's the deadline the
             owner set themselves in the wizard, so hiding it made no sense). -->
        <div v-if="booking.status === 'AWAITING_PAYMENT'" class="card mb-4">
          <div class="card-body text-center">
            <template v-if="isOwner">
              <p class="text-body mb-2">{{ t('booking.ownerAwaitingPaymentNotice') }}</p>
              <p class="text-muted mb-0">{{ t('booking.payDeadline') }}: {{ new Date(booking.paymentDeadline).toLocaleString('sr-RS') }}</p>
            </template>
            <template v-else>
              <p class="text-body mb-2">{{ t('booking.payInstructions') }}</p>
              <p class="text-muted mb-3">{{ t('booking.notMediating') }}</p>
              <img v-if="qrDataUrl" :src="qrDataUrl" :alt="t('booking.scanQr')" class="qr-image mb-3" />
              <p class="text-muted">{{ t('booking.payDeadline') }}: {{ new Date(booking.paymentDeadline).toLocaleString('sr-RS') }}</p>
            </template>
          </div>
        </div>
        <!-- T49/T78 — cash bookings skip AWAITING_PAYMENT entirely (confirmed
             immediately, see BookingsService.approveRequest); this used to
             show the guest's own text ("sent to YOUR email") to the owner
             too, verbatim. -->
        <div v-else-if="booking.paymentMethod === 'CASH' && ['CONFIRMED', 'COMPLETED'].includes(booking.status)" class="card mb-4">
          <div class="card-body text-center">
            <p class="text-body">{{ isOwner ? t('booking.cashPaymentNoticeOwner') : t('booking.cashPaymentNotice') }}</p>
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
            <!-- T78 — a REQUESTED booking is never "cancelled" by the owner,
                 it's rejected (Odbij, above) — a third button here just
                 confused which action actually applies before approval. -->
            <button v-if="['AWAITING_PAYMENT','CONFIRMED'].includes(booking.status)" class="btn btn-danger" @click="act('cancel-by-owner')">
              {{ t('booking.cancelBooking') }}
            </button>
          </template>
          <template v-else>
            <!-- T78 — "Povuci zahtev" while it's still just a request the
                 owner hasn't acted on; "Otkaži rezervaciju" once it's more
                 than that (payment instructions already issued). -->
            <button v-if="['REQUESTED','AWAITING_PAYMENT'].includes(booking.status)" class="btn btn-danger" @click="act('cancel')">
              {{ booking.status === 'REQUESTED' ? t('booking.withdrawRequest') : t('booking.cancelBooking') }}
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
    COMPLETED: 'Completed', CANCELLED: 'Cancelled', REJECTED: 'Rejected', EXPIRED: 'Expired', NO_SHOW: 'NoShow',
  }
  return map[booking.value?.status] || 'Requested'
})
const statusBadgeClass = computed(() => {
  const map = {
    REQUESTED: 'badge-warning', AWAITING_PAYMENT: 'badge-warning', CONFIRMED: 'badge-success',
    COMPLETED: 'badge-success', CANCELLED: 'badge-critical', REJECTED: 'badge-critical', EXPIRED: 'badge-critical', NO_SHOW: 'badge-critical',
  }
  return map[booking.value?.status] || 'badge-neutral'
})
// T79 — the REJECTED status only ever results from the owner rejecting a
// request (no "who" to disambiguate); CANCELLED can come from either side.
const cancellationLabel = computed(() => {
  if (booking.value?.status === 'REJECTED') return t('booking.rejectedByOwner')
  return booking.value?.cancellation?.by === 'GUEST' ? t('booking.cancelledByGuest') : t('booking.cancelledByOwner')
})

function formatPrice(value) {
  return `${new Intl.NumberFormat('sr-RS').format(value || 0)} RSD`
}

// T82 — a NIGHT/DAY/MONTH booking's startsAt/endsAt are calendar-day
// boundaries with no meaningful time component (always midnight); showing
// the time rendered it as "02:00:00" (midnight UTC read back in the local
// Belgrade offset), implying check-in happens at 2am. A PER_SLOT/HOUR
// booking's timestamps are a real time of day and must keep showing it.
const DATE_ONLY_UNITS = ['NIGHT', 'DAY', 'MONTH']
function formatCheckDate(value) {
  const d = new Date(value)
  return DATE_ONLY_UNITS.includes(booking.value?.priceUnit) ? d.toLocaleDateString('sr-RS') : d.toLocaleString('sr-RS')
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
