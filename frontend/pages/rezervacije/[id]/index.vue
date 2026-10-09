<template>
  <div class="booking-page">
    <!-- Dizajn 39 (528:514): the guest's page has its own way back. -->
    <GuestBookingView
      v-if="booking && !isOwner"
      :booking="booking"
      :review-status="reviewStatus"
      :qr-data-url="qrDataUrl"
      :back-href="backLink.href"
      :busy="acting"
      :notice="actionNotice"
      @back="goBack"
      @action="act"
      @dispute-no-show="submitDispute"
      @review-saved="refresh()"
    />

    <a v-if="booking && isOwner" :href="backLink.href" class="booking-back" @click="goBack">
      <img src="/images/icons/chevron-left-muted.svg" alt="" width="16" height="16" />
      <span class="booking-back-text">{{ backLink.label }}</span>
    </a>

    <div v-if="!booking || isOwner" class="booking-center">
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

      <!-- Dizajn 43: owners no longer rate guests, so a completed booking
           shows the card alone. -->
      <OwnerRequestCard v-else-if="booking" :booking="booking" :busy="acting" :notice="actionNotice" @action="act" />
    </div>
  </div>
</template>

<script setup>
// One booking, for either side of it, inside the dashboard. Dizajn 34
// (359:406, 384:496, 565:657) draws the owner's card, Dizajn 39 (528:514,
// 568:514, 568:698) the guest's page. The address stays /rezervacije/:id,
// which the emails and notifications link to.
import { formatBookingMoment } from '~/utils/bookingRequests'

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
    // T142: no code for an account banks would refuse; the details stay as text.
    asGuest && booking.status === 'AWAITING_PAYMENT' ? api.get(`/bookings/${bookingId}/qr`).catch(() => null) : null,
    // Dizajn 43: only the guest reviews.
    asGuest && booking.status === 'COMPLETED' ? api.get(`/bookings/${bookingId}/reviews`) : null,
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

// T82: a booking by whole days shows only the date.
function formatCheckDate(value) {
  return formatBookingMoment(booking.value, value)
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

// Both sides' cards show what just happened in place of their own note (565:800).
const actionNotice = computed(() => {
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

// T90: "Osporite oznaku" carries a required explanation, written in the
// guest's page (GuestBookingView), which closes its form when this succeeds.
async function submitDispute({ explanation, done, fail }) {
  actionError.value = ''
  successMessage.value = ''
  acting.value = true
  try {
    await api.post(`/bookings/${bookingId}/dispute-no-show`, { explanation })
    done()
    await refresh()
    successMessage.value = t('booking.successDisputeNoShow')
  } catch (e) {
    fail(extractErrorMessage(e, t('auth.genericError')))
  } finally {
    acting.value = false
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

.booking-panel {
  width: 560px;
  max-width: 100%;
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
