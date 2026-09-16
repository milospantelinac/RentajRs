<template>
  <div class="booking-page">
    <a v-if="booking" :href="backLink.href" class="booking-back" @click="goBack">
      <img src="/images/icons/chevron-left-muted.svg" alt="" width="16" height="16" />
      <span class="booking-back-text">{{ backLink.label }}</span>
    </a>

    <div class="booking-center">
      <!-- T92: a foreign or nonexistent booking used to leave this whole page
           blank, with no way to tell whether the link, the account, or the
           platform was at fault. Dizajn 44 lays the message out. -->
      <section v-if="notFound" class="booking-panel booking-state">
        <DashboardNavIcon name="bookings" class="booking-state-icon" />
        <p class="booking-state-title">{{ t('bookingRequests.notFoundTitle') }}</p>
        <p class="booking-state-text">{{ t('booking.notFoundMessage') }}</p>
        <NuxtLink to="/kontrolna-tabla/rezervacije" class="booking-state-button">{{ t('booking.backToMyBookings') }}</NuxtLink>
      </section>

      <section v-else-if="loadError" class="booking-panel booking-state is-error">
        <DashboardNavIcon name="bookings" class="booking-state-icon" />
        <p class="booking-state-title">{{ t('bookingRequests.detailLoadErrorTitle') }}</p>
        <p class="booking-state-text">{{ t('bookingRequests.loadErrorText') }}</p>
        <button type="button" class="booking-state-button" @click="refresh()">{{ t('errorPage.tryAgain') }}</button>
      </section>

      <template v-else-if="booking">
        <OwnerRequestCard v-if="isOwner" :booking="booking" :busy="acting" :notice="ownerNotice" @action="act" />

        <!-- The guest's side keeps its content until Dizajn 39 (528:514) lays it out. -->
        <div v-else class="booking-guest">
          <h1 class="text-page-title mb-1">{{ booking.listing?.title }}</h1>
          <span class="badge mb-4" :class="guestBadgeClass">{{ getBookingStatusLabel(t, booking.status) }}</span>

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
              <div class="row mb-2">
                <div class="col-6 text-muted">{{ t('booking.totalAmount') }}</div>
                <div class="col-6">{{ formatRsd(booking.totalAmount) }}</div>
              </div>
              <!-- T76: the guest's choice on a "Oba" listing, as agreed. -->
              <div v-if="booking.paymentMethod" class="row mb-2">
                <div class="col-6 text-muted">{{ t('booking.paymentMethodLabel') }}</div>
                <div class="col-6">{{ booking.paymentMethod === 'CASH' ? t('booking.paymentMethodCash') : t('booking.paymentMethodOnline') }}</div>
              </div>
              <!-- T77: "Iznos za uplatu" only while payment is pending, what
                   was paid once paymentConfirmedAt is set. -->
              <div v-if="booking.status === 'AWAITING_PAYMENT'" class="row mb-2">
                <div class="col-6 text-muted">{{ t('booking.payAmount') }}</div>
                <div class="col-6">{{ formatRsd(booking.amountDue) }}</div>
              </div>
              <div v-else-if="booking.paymentConfirmedAt" class="row mb-2">
                <div class="col-6 text-muted">{{ t('booking.paidLabel') }}</div>
                <div class="col-6">
                  {{ formatRsd(booking.amountDue) }} ·
                  {{ t('booking.paidConfirmedOn', { date: formatBookingDate(booking.paymentConfirmedAt) }) }}
                </div>
              </div>
              <div v-if="booking.guestMessage" class="row mb-2">
                <div class="col-6 text-muted">{{ t('booking.guestMessage') }}</div>
                <div class="col-6">{{ booking.guestMessage }}</div>
              </div>
              <!-- T87: frozen at the moment the request was made (Booking.cancellationTermsSnapshot). -->
              <div v-if="booking.cancellationTermsSnapshot" class="row mb-2">
                <div class="col-6 text-muted">{{ t('booking.cancellationTerms') }}</div>
                <div class="col-6">{{ booking.cancellationTermsSnapshot }}</div>
              </div>
              <!-- T79: who cancelled/rejected and when. -->
              <div v-if="booking.cancellation" class="row mb-2">
                <div class="col-6 text-muted">{{ getBookingStatusLabel(t, booking.status) }}</div>
                <div class="col-6">{{ cancellationLabel }} · {{ formatBookingDateTime(booking.cancellation.at) }}</div>
              </div>
            </div>
          </div>

          <!-- T80: the guest only learns how to reach the owner once the stay
               is confirmed (backend gates this on phoneUnlocked). -->
          <div v-if="booking.ownerName" class="card mb-4">
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

          <!-- T47/T91: the QR and the same fields as copyable text. -->
          <div v-if="booking.status === 'AWAITING_PAYMENT'" class="card mb-4">
            <div class="card-body text-center">
              <p class="text-body mb-2">{{ t('booking.payInstructions') }}</p>
              <p class="text-muted mb-3">{{ t('booking.notMediating') }}</p>
              <p class="text-body mb-2">{{ t('booking.scanQr') }}</p>
              <img v-if="qrDataUrl" :src="qrDataUrl" :alt="t('booking.scanQr')" class="qr-image mb-3" />
              <p class="text-muted mb-3">{{ t('booking.payDeadline') }}: {{ formatBookingDateTime(booking.paymentDeadline) }}</p>
              <div v-if="booking.bankTransferDetails" class="pay-details text-start">
                <p class="text-label mb-2">{{ t('booking.manualPayTitle') }}</p>
                <div v-for="field in payDetailFields" :key="field.key" class="pay-detail-row">
                  <span class="pay-detail-label">{{ field.label }}</span>
                  <span class="pay-detail-value">{{ field.value }}</span>
                  <button type="button" class="btn btn-tertiary btn-sm" @click="copyField(field.key, field.value)">
                    {{ copiedField === field.key ? t('common.copied') : t('common.copy') }}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <!-- T49: cash bookings skip AWAITING_PAYMENT entirely. -->
          <div v-else-if="booking.paymentMethod === 'CASH' && ['CONFIRMED', 'COMPLETED'].includes(booking.status)" class="card mb-4">
            <div class="card-body text-center">
              <p class="text-body">{{ t('booking.cashPaymentNotice') }}</p>
            </div>
          </div>

          <div class="action-buttons">
            <!-- T78: "Povuci zahtev" while it's still just a request,
                 "Otkaži rezervaciju" once payment instructions went out. -->
            <button v-if="['REQUESTED', 'AWAITING_PAYMENT'].includes(booking.status)" class="btn btn-danger" :disabled="acting" @click="act('cancel')">
              {{ booking.status === 'REQUESTED' ? t('booking.withdrawRequest') : t('booking.cancelBooking') }}
            </button>
            <!-- T94: hidden until the guest has had long enough to pay. -->
            <button
              v-if="booking.status === 'AWAITING_PAYMENT' && disputePaymentAvailable"
              class="btn btn-tertiary"
              :disabled="acting"
              @click="act('dispute-payment')"
            >
              {{ t('booking.reportUnpaidConfirmed') }}
            </button>
            <button
              v-if="booking.status === 'NO_SHOW' && !booking.noShowDisputed && !disputingNoShow"
              class="btn btn-tertiary"
              @click="disputingNoShow = true"
            >{{ t('booking.disputeNoShow') }}</button>
          </div>

          <!-- T90: a dispute carries the guest's explanation for the admin. -->
          <div v-if="disputingNoShow" class="card mt-3">
            <div class="card-body">
              <div class="form-group mb-3">
                <label class="form-label">{{ t('booking.disputeExplanationLabel') }}</label>
                <textarea
                  v-model="disputeExplanation"
                  class="form-control"
                  rows="3"
                  :placeholder="t('booking.disputeExplanationPlaceholder')"
                  maxlength="1000"
                ></textarea>
              </div>
              <p v-if="disputeError" class="form-error mb-2">{{ disputeError }}</p>
              <div class="action-buttons">
                <button
                  class="btn btn-primary-flat btn-sm"
                  :disabled="!disputeExplanation.trim() || submittingDispute"
                  @click="submitDispute"
                >{{ t('booking.disputeSubmit') }}</button>
                <button class="btn btn-tertiary btn-sm" @click="disputingNoShow = false">{{ t('common.cancel') }}</button>
              </div>
            </div>
          </div>

          <p v-if="successMessage" class="form-success mt-3">{{ successMessage }}</p>
          <p v-if="actionError" class="form-error mt-3">{{ actionError }}</p>
        </div>

        <!-- Both sides review each other once the stay is over. -->
        <div v-if="booking.status === 'COMPLETED'" class="booking-panel booking-review">
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
      </template>
    </div>
  </div>
</template>

<script setup>
// One booking, for either side of it, inside the dashboard. Dizajn 34
// (359:406, 384:496, 565:657) draws the owner's card; the guest's side keeps
// its content for Dizajn 39. The address stays /rezervacije/:id, which the
// emails and notifications link to.
import {
  formatBookingDate,
  formatBookingDateTime,
  formatBookingMoment,
  formatRsd,
  getBookingStatusLabel,
} from '~/utils/bookingRequests'

definePageMeta({ middleware: ['auth', 'booking-menu'], layout: 'dashboard' })
const { t } = useI18n()
const api = useApi()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const { setActiveLink } = useDashboardActiveLink()
const bookingId = route.params.id
// Filled by middleware/booking-menu.js, and used once.
const prefetched = useState(`booking-prefetch-${bookingId}`, () => null)

const LIST_PATH = '/kontrolna-tabla/rezervacije'

const { data, error, refresh } = await useAsyncData(`booking-${bookingId}`, async () => {
  let booking = prefetched.value
  prefetched.value = null
  try {
    booking ||= await api.get(`/bookings/${bookingId}`)
  } catch (e) {
    // T92: a missing booking and someone else's both read "not found", so a
    // guesser can't tell which ids exist.
    if ([400, 403, 404].includes(e?.response?.status)) return { booking: null }
    throw e
  }
  const asGuest = booking.guestId === auth.user?.id
  const [qr, reviewStatus] = await Promise.all([
    asGuest && booking.status === 'AWAITING_PAYMENT' ? api.get(`/bookings/${bookingId}/qr`) : null,
    booking.status === 'COMPLETED' ? api.get(`/bookings/${bookingId}/reviews`) : null,
  ])
  return { booking, qrDataUrl: qr?.dataUrl ?? null, reviewStatus }
})

const booking = computed(() => data.value?.booking ?? null)
const qrDataUrl = computed(() => data.value?.qrDataUrl ?? null)
const reviewStatus = computed(() => data.value?.reviewStatus ?? null)
const notFound = computed(() => !error.value && !!data.value && !data.value.booking)
const loadError = computed(() => !!error.value)

const isOwner = computed(() => !!booking.value && booking.value.ownerId === auth.user?.id)
const role = computed(() => (isOwner.value ? 'owner' : 'guest'))
const listUrl = computed(() => `${LIST_PATH}?role=${role.value}`)

// 359:456: the owner is under "Zahtevi za rezervaciju", the guest under "Moje
// rezervacije". The middleware sets it before the menu renders; this covers a
// booking only the page managed to load, once the menu is hydrated.
onMounted(() => {
  watch(
    booking,
    (value) => {
      if (value) setActiveLink(listUrl.value)
    },
    { immediate: true },
  )
})

// 359:494: back to the list, the way it was left when the page came from it.
const backLink = computed(() => ({
  href: listUrl.value,
  label: isOwner.value ? t('dashboard.requests') : t('dashboard.myBookings'),
}))

function goBack(event) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
  event.preventDefault()
  const previous = typeof window !== 'undefined' ? window.history.state?.back : null
  const fromList = typeof previous === 'string' && previous.startsWith(LIST_PATH) && previous.includes('role=owner') === isOwner.value
  if (fromList) router.back()
  else router.push(listUrl.value)
}

// T79: a REJECTED status only ever comes from the owner; CANCELLED from either side.
const cancellationLabel = computed(() => {
  if (booking.value?.status === 'REJECTED') return t('booking.rejectedByOwner')
  return booking.value?.cancellation?.by === 'GUEST' ? t('booking.cancelledByGuest') : t('booking.cancelledByOwner')
})

const guestBadgeClass = computed(() => {
  const map = {
    REQUESTED: 'badge-warning',
    AWAITING_PAYMENT: 'badge-warning',
    CONFIRMED: 'badge-success',
    COMPLETED: 'badge-success',
    CANCELLED: 'badge-critical',
    REJECTED: 'badge-critical',
    EXPIRED: 'badge-critical',
    NO_SHOW: 'badge-critical',
  }
  return map[booking.value?.status] || 'badge-neutral'
})

// T82: a booking by whole days shows only the date.
function formatCheckDate(value) {
  return formatBookingMoment(booking.value, value)
}

// T94: "Prijavi da uplata nije potvrđena" shows from halfway through the
// payment window, when the deadline reminder also goes out
// (bookings.service.ts sendPaymentDeadlineReminders).
const disputePaymentAvailable = computed(() => {
  const b = booking.value
  if (!b?.awaitingPaymentSince || !b?.paymentDeadline) return false
  const start = new Date(b.awaitingPaymentSince).getTime()
  const end = new Date(b.paymentDeadline).getTime()
  return Date.now() >= start + (end - start) / 2
})

// T91: the fields the IPS QR code encodes, as copyable text.
const payDetailFields = computed(() => {
  const d = booking.value?.bankTransferDetails
  if (!d) return []
  return [
    { key: 'account', label: t('booking.bankAccountLabel'), value: d.recipientAccount },
    { key: 'recipient', label: t('booking.recipientLabel'), value: d.recipientName },
    { key: 'amount', label: t('booking.payAmount'), value: formatRsd(d.amountRsd) },
    { key: 'purpose', label: t('booking.paymentPurposeLabel'), value: d.purpose },
    { key: 'reference', label: t('booking.paymentReferenceLabel'), value: d.referenceNumber },
  ]
})
const copiedField = ref('')
let copiedTimer
async function copyField(key, value) {
  await navigator.clipboard.writeText(String(value))
  copiedField.value = key
  clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => (copiedField.value = ''), 2000)
}
onUnmounted(() => clearTimeout(copiedTimer))

const reviewForm = reactive({ rating: 0, comment: '', tags: [] })
const reviewError = ref('')
const submittingReview = ref(false)
const guestTags = ['ARRIVED_ON_TIME', 'RETURNED_NEATLY', 'COMMUNICATIVE', 'LATE', 'DAMAGE', 'NO_SHOW']

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
      bookingId,
      rating: reviewForm.rating,
      comment: reviewForm.comment || undefined,
      tags: reviewStatus.value?.direction === 'OWNER_TO_GUEST' && reviewForm.tags.length ? reviewForm.tags : undefined,
    })
    await refresh()
  } catch (e) {
    reviewError.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    submittingReview.value = false
  }
}

// T89: the actions that can't be undone, or that reach the other side at
// once, ask first and name the consequence. Approve doesn't: it is what the
// owner came to do.
const CANCELLATION_TERMS_FALLBACK = () => t('booking.noCancellationTermsSet')
const CONFIRM_MESSAGES = {
  reject: () => t('booking.confirmReject'),
  'confirm-payment': () => t('booking.confirmPaymentReceived'),
  'cancel-by-owner': () =>
    t('booking.confirmCancelOwner', { terms: booking.value.cancellationTermsSnapshot || CANCELLATION_TERMS_FALLBACK() }),
  cancel: () =>
    booking.value.status === 'REQUESTED'
      ? t('booking.confirmWithdraw')
      : t('booking.confirmCancelGuest', { terms: booking.value.cancellationTermsSnapshot || CANCELLATION_TERMS_FALLBACK() }),
  'no-show': () => t('booking.confirmNoShow'),
}

// Resolved from the state before the action, since the reload has already
// replaced the booking by the time this runs.
function successMessageFor(action, previousStatus) {
  switch (action) {
    case 'approve':
      return booking.value.status === 'CONFIRMED' ? t('booking.successApproveCash') : t('booking.successApproveBank')
    case 'reject':
      return t('booking.successReject')
    case 'confirm-payment':
      return t('booking.successPaymentConfirmed')
    case 'cancel-by-owner':
      return t('booking.successCancelOwner')
    case 'cancel':
      return previousStatus === 'REQUESTED' ? t('booking.successWithdraw') : t('booking.successCancelGuest')
    case 'no-show':
      return t('booking.successNoShow')
    case 'dispute-payment':
      return t('booking.successDisputePayment')
    default:
      return ''
  }
}

const acting = ref(false)
const successMessage = ref('')
const actionError = ref('')
const dashboardCounts = useDashboardCountsStore()

// The owner's card shows what just happened in place of its own note (565:800).
const ownerNotice = computed(() => {
  if (actionError.value) return { tone: 'danger', text: actionError.value }
  if (successMessage.value) return { tone: 'success', text: successMessage.value }
  return null
})

async function act(action) {
  actionError.value = ''
  successMessage.value = ''
  const confirmMessage = CONFIRM_MESSAGES[action]?.()
  if (confirmMessage && !window.confirm(confirmMessage)) return
  const previousStatus = booking.value.status
  acting.value = true
  try {
    await api.post(`/bookings/${bookingId}/${action}`, {})
    await refresh()
    successMessage.value = successMessageFor(action, previousStatus)
    // An answered request leaves the menu's "Zahtevi" counter (Dizajn 30).
    if (previousStatus === 'REQUESTED') dashboardCounts.refresh()
  } catch (e) {
    actionError.value = extractErrorMessage(e, t('auth.genericError'))
    // A request answered elsewhere in the meantime shows its real state.
    await refresh().catch(() => {})
  } finally {
    acting.value = false
  }
}

// T90: "Osporite oznaku" carries a required explanation.
const disputingNoShow = ref(false)
const disputeExplanation = ref('')
const disputeError = ref('')
const submittingDispute = ref(false)

async function submitDispute() {
  disputeError.value = ''
  successMessage.value = ''
  submittingDispute.value = true
  try {
    await api.post(`/bookings/${bookingId}/dispute-no-show`, { explanation: disputeExplanation.value.trim() })
    disputingNoShow.value = false
    disputeExplanation.value = ''
    await refresh()
    successMessage.value = t('booking.successDisputeNoShow')
  } catch (e) {
    disputeError.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    submittingDispute.value = false
  }
}

// T98: each booking's tab names its listing and day.
useSeoMeta({
  title: () => (booking.value ? `${booking.value.listing?.title} - ${formatCheckDate(booking.value.startsAt)}` : t('nav.dashboard')),
})
</script>

<style lang="scss" scoped>
// Dizajn 34, frame 359:493: the way back, then the card centred 18 below it.
// This frame's content column has none of the 4 / 8 padding 357:493 gives the
// dashboard's, so the page takes it back.
.booking-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
  margin: -4px -8px 0;
}

// 359:494
.booking-back {
  display: flex;
  align-self: flex-start;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  font-size: 13px;
  font-weight: 500;
  line-height: normal;
  color: $color-text-muted;
}

.booking-back img {
  display: block;
  flex-shrink: 0;
}

.booking-back-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.booking-back:hover {
  color: $color-primary;
}

// 359:498
.booking-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 8px;
}

.booking-panel,
.booking-guest {
  width: 560px;
  max-width: 100%;
}

.booking-panel {
  padding: 26px 28px;
  border-radius: $radius-card;
  background: $color-surface;
  box-shadow:
    0 1px 3px rgba(97, 115, 133, 0.05),
    0 8px 24px rgba(97, 115, 133, 0.05);
}

// Dizajn 44: an icon, a title, one sentence and one button.
.booking-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 24px;
  text-align: center;
}

.booking-state-icon {
  width: 48px;
  height: 48px;
  margin-bottom: 12px;
  color: $color-text-muted;
}

.booking-state-title {
  font-size: 17px;
  font-weight: 500;
  line-height: normal;
  color: $color-text;
}

.booking-state-text {
  max-width: 420px;
  margin-top: 4px;
  font-size: 13px;
  font-weight: 300;
  line-height: normal;
  color: $color-text-muted;
}

.booking-state.is-error .booking-state-icon,
.booking-state.is-error .booking-state-title {
  color: $color-error;
}

// 357:503, the home page's grey button.
.booking-state-button {
  display: inline-flex;
  align-items: center;
  margin-top: 16px;
  padding: 11px 20px;
  border: 0;
  border-radius: $radius-button;
  background: $color-background;
  font-size: 13px;
  font-weight: 500;
  line-height: normal;
  color: $color-text;
  white-space: nowrap;
  cursor: pointer;
}

.booking-state-button:hover {
  color: $color-primary;
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

// T91: copyable manual-payment fields, below the QR.
.pay-details {
  border-top: 1px solid $color-border;
  padding-top: 12px;
  margin-top: 4px;
}

.pay-detail-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  flex-wrap: wrap;
}

.pay-detail-label {
  flex: 0 0 120px;
  font-size: $font-size-label;
  color: $color-text-muted;
}

.pay-detail-value {
  flex: 1 1 auto;
  font-weight: 600;
  word-break: break-word;
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

@include mobile-only {
  .booking-page {
    margin: 0;
  }

  .booking-center {
    padding: 0;
  }

  .booking-panel {
    padding: 22px 16px;
  }
}
</style>
