<template>
  <div v-if="booking" class="change-page">
    <!-- Dizajn 39 (528:710): the way back, to the booking this screen changes. -->
    <a :href="bookingHref" class="change-back" @click="goBack">
      <img src="/images/icons/chevron-left-muted.svg" alt="" width="16" height="16" />
      <span class="change-back-text">{{ t('bookingChange.backToBooking') }}</span>
    </a>

    <!-- 528:714 -->
    <header class="change-head">
      <h1 class="change-title">{{ t('bookingChange.pageTitle') }}</h1>
      <p class="change-subtitle">{{ listingName }}</p>
    </header>

    <!-- A link opened once the request was sent, the deadline passed or the
         booking closed: what stands in the way, and the way back. -->
    <section v-if="closedState" class="change-card change-state">
      <DashboardNavIcon name="bookings" class="change-state-icon" />
      <p class="change-state-title">{{ closedState.title }}</p>
      <p class="change-state-text">{{ closedState.text }}</p>
      <NuxtLink :to="bookingHref" class="change-state-button">{{ t('bookingChange.backToBooking') }}</NuxtLink>
    </section>

    <!-- 528:720: the new term in the booking's card, the summary in the owner's. -->
    <div v-else class="change-split">
      <form class="change-card change-main" novalidate @submit.prevent="submit">
        <h2 class="change-card-title">{{ t('bookingChange.pickTitle') }}</h2>

        <!-- The request page's fields (Dizajn 40), with the booking's own term left free. -->
        <RequestTermFields :term="term" :listing="listing" :error="termError" :availability-path="availabilityPath" />

        <!-- 375:424 -->
        <div class="request-field">
          <div class="request-label-row">
            <label class="request-label" :for="messageId">{{ t('booking.message') }}</label>
            <span class="request-optional">{{ t('common.optional') }}</span>
          </div>
          <textarea :id="messageId" v-model="guestMessage" class="request-textarea" rows="3" maxlength="1000" />
        </div>

        <p v-if="error" class="request-error" role="alert">
          <img src="/images/icons/field-error.svg" alt="" />{{ error }}
        </p>

        <!-- 375:430, 375:432 -->
        <button type="submit" class="request-submit" :disabled="submitting || term.termUnavailable">
          {{ submitting ? t('bookingForm.sending') : t('bookingChange.submit') }}
        </button>
        <p class="request-note">{{ t('bookingChange.submitNote') }}</p>
      </form>

      <!-- 528:766 -->
      <aside class="change-card change-aside" :aria-labelledby="`${uid}-summary`">
        <h2 :id="`${uid}-summary`" class="change-card-title">{{ t('bookingChange.summaryTitle') }}</h2>
        <dl class="change-facts">
          <div v-for="row in summaryRows" :key="row.key" class="change-fact">
            <dt class="change-label">{{ row.label }}</dt>
            <dd class="change-value">{{ row.value }}</dd>
            <dd v-if="row.hint" class="change-hint">{{ row.hint }}</dd>
          </div>
        </dl>
        <p class="change-note">{{ t('bookingChange.summaryNote') }}</p>
        <p v-if="advanceKept" class="change-hint">{{ t('bookingChange.summaryAdvance') }}</p>
      </aside>
    </div>
  </div>
</template>

<script setup>
// T136: the guest picks another term for a booking, and the owner approves or
// rejects it from the booking's card. No frame: the booking's own page (Dizajn
// 39) gives the layout and the request page (Dizajn 40) the term fields, which
// follow the same rules as a new request (composables/useRequestTerm.js); the
// calendars read the listing's terms with this booking's own term left free.
import { formatBookingListing } from '~/utils/bookingRequests'
import { formatChangeDeadline, formatChangePrice, formatChangeTerm, keepsAdvance } from '~/utils/bookingChange'

definePageMeta({ middleware: ['auth', 'booking-menu'], layout: 'dashboard' })
const { t } = useI18n()
const api = useApi()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const nuxtApp = useNuxtApp()
const uid = useId()
const messageId = useId()
const bookingId = route.params.id
// Filled by middleware/booking-menu.js, and used once.
const prefetched = useState(`booking-prefetch-${bookingId}`, () => null)

const { data } = await useAsyncData(`booking-change-${bookingId}`, async () => {
  let booking = prefetched.value
  prefetched.value = null
  try {
    booking ||= await api.get(`/bookings/${bookingId}`)
  } catch (e) {
    if ([400, 403, 404].includes(e?.response?.status)) return { booking: null }
    throw e
  }
  // Only the guest asks for another term.
  if (booking.guestId !== auth.user?.id) return { booking: null }
  // The listing's booking rules, without counting a view.
  const listing = booking.change?.canRequest
    ? await api.get(`/listings/public/${booking.listing.slug}`, { query: { view: 0 } }).catch(() => null)
    : null
  return { booking, listing }
})

// The booking's own page says "not found" the way T92 wants it, and an error.
if (!data.value?.booking) await navigateTo(`/rezervacije/${bookingId}`, { replace: true })

const booking = computed(() => data.value?.booking ?? null)
const listing = computed(() => data.value?.listing ?? null)
const bookingHref = `/rezervacije/${bookingId}`
const availabilityPath = `/bookings/${bookingId}/change/availability`

function goBack(event) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
  event.preventDefault()
  const previous = typeof window !== 'undefined' ? window.history.state?.back : null
  if (previous === bookingHref) router.back()
  else router.push(bookingHref)
}

const listingName = computed(() => formatBookingListing(booking.value?.listing))

// Why no new term can be asked for (card T136, points 5 and 6).
const closedState = computed(() => {
  const change = booking.value?.change
  if (change?.canRequest && listing.value) return null
  if (change?.pending) return { title: t('bookingChange.closed.pendingTitle'), text: t('bookingChange.closed.pendingText') }
  if (change?.deadlinePassed) return { title: t('bookingChange.closed.deadlineTitle'), text: formatChangeDeadline(t, change) }
  return { title: t('bookingChange.closed.title'), text: t('bookingChange.closed.text') }
})

// One clock for the server render and the browser, as on the request page.
const now = useState('booking-change-now', () => Date.now())
if (import.meta.client && !nuxtApp.isHydrating) now.value = Date.now()

const model = computed(() => getRequestModel(listing.value))

// Defined slots and working hours need the listing's terms before the page
// renders; stays and months load theirs in the calendar.
const { data: availability, refresh: refreshAvailability } = await useAsyncData(`booking-change-availability-${bookingId}`, () => {
  if (!listing.value || !['slots', 'hours'].includes(model.value)) return Promise.resolve(null)
  const days = listing.value.maxAdvanceBookingDays || 365
  return api.get(availabilityPath, {
    query: { from: new Date(now.value).toISOString(), to: new Date(now.value + days * 86_400_000).toISOString() },
  })
})

// The new term starts as long as the booked one: its hours, or its months.
function bookedLength() {
  const b = booking.value
  if (!b || !listing.value) return {}
  if (model.value === 'hours') return { hours: String(Math.round((new Date(b.endsAt) - new Date(b.startsAt)) / 3_600_000)) }
  if (model.value === 'months') return { monthCount: String(b.unitCount || 1) }
  return {}
}
const term = useRequestTerm({ listing, availability, now, initial: bookedLength() })

const guestMessage = ref('')
const errors = reactive({ term: '' })
const error = ref('')
const submitting = ref(false)

// Every selection clears what was said about the previous one.
watch(
  () => [term.form.startsAt, term.form.endsAt, term.form.monthStart, term.form.monthCount, term.form.definedSlotId, term.slotStartTime],
  () => {
    errors.term = ''
    error.value = ''
  },
)

// The new term checked and priced at once: a taken term, the same one or one
// against the listing's rules says so under the calendar (card T136, point 1).
const quote = ref(null)
const quoteError = ref('')
let quoteRequest = 0
async function refreshQuote() {
  const payload = term.payload
  const request = ++quoteRequest
  quoteError.value = ''
  if (!payload) {
    quote.value = null
    return
  }
  try {
    const result = await api.post(`/bookings/${bookingId}/change/quote`, payload)
    if (request === quoteRequest) quote.value = result
  } catch (e) {
    if (request !== quoteRequest) return
    quote.value = null
    quoteError.value = extractErrorMessage(e, t('auth.genericError'))
  }
}
watch(() => JSON.stringify(term.payload), refreshQuote)
onMounted(() => {
  if (!closedState.value) refreshQuote()
})

const termError = computed(() => errors.term || quoteError.value)

// The term now, the one picked and its price; the advance stays as it was
// asked for or paid (user decision).
const summaryRows = computed(() => {
  const b = booking.value
  const rows = [{ key: 'old', label: t('bookingChange.currentTerm'), value: formatChangeTerm(t, b, b.startsAt, b.endsAt) }]
  if (!quote.value) {
    rows.push({ key: 'new', label: t('bookingChange.newTerm'), value: '-', hint: t('bookingChange.pickHint') })
    return rows
  }
  const price = formatChangePrice(t, quote.value, b)
  rows.push(
    { key: 'new', label: t('bookingChange.newTerm'), value: formatChangeTerm(t, b, quote.value.newStartsAt, quote.value.newEndsAt) },
    { key: 'price', label: t('bookingChange.newPrice'), value: price.value, hint: price.hint },
  )
  return rows
})
const advanceKept = computed(() => keepsAdvance(booking.value))

async function submit() {
  if (term.termUnavailable) return
  error.value = ''
  errors.term = term.missingTermMessage()
  const payload = term.payload
  if (!payload) {
    await nextTick()
    document.querySelector('.change-main .request-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    return
  }
  submitting.value = true
  try {
    await api.post(`/bookings/${bookingId}/change`, { ...payload, guestMessage: guestMessage.value.trim() || undefined })
    // The booking's page shows the request waiting for the owner, and the
    // browser's back button skips this screen.
    await navigateTo(bookingHref, { replace: true })
  } catch (e) {
    const message = extractErrorMessage(e, t('auth.genericError'))
    // A term taken meanwhile turns grey (and is dropped) before the message shows.
    if (model.value === 'slots' || model.value === 'hours') {
      await refreshAvailability().catch(() => {})
      await nextTick()
    }
    error.value = message
  } finally {
    submitting.value = false
  }
}

useSeoMeta({
  title: () => (booking.value ? `${t('bookingChange.pageTitle')} - ${booking.value.listing?.title}` : t('bookingChange.pageTitle')),
})
</script>

<style lang="scss" scoped>
// The term fields, the message and the send button of the request page.
@use '@/assets/scss/request-form' as *;

// Dizajn 39, frame 528:601: the way back, the title and the two cards, 20
// apart. The content column has none of the 4 / 8 padding 357:493 gives the
// dashboard's; the page takes it back, as the booking's own page does.
.change-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin: -4px -8px 0;
}

// 528:710
.change-back {
  display: flex;
  align-self: flex-start;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  font-size: 14px;
  font-weight: 400;
  line-height: normal;
  color: $color-text-muted;
}

.change-back img {
  display: block;
  flex-shrink: 0;
}

.change-back-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.change-back:hover {
  color: $color-primary;
}

// 528:714
.change-head {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.change-title {
  min-width: 0;
  font-size: 26px;
  font-weight: 600;
  line-height: normal;
  color: $color-text;
  overflow-wrap: anywhere;
}

.change-subtitle {
  font-size: 14px;
  font-weight: 300;
  line-height: normal;
  color: $color-text-muted;
}

// 528:720: 692 and 360, 20 apart.
.change-split {
  display: flex;
  align-items: flex-start;
  gap: 20px;
}

// 528:721, 528:766: white, a 1px line drawn inside, 26 / 28 inside.
.change-card {
  display: flex;
  flex-direction: column;
  gap: 22px;
  min-width: 0;
  margin: 0;
  padding: 26px 28px;
  border-radius: 20px;
  background: $color-surface;
  box-shadow: inset 0 0 0 1px $color-border;
}

.change-main {
  flex: 0 1 692px;
}

.change-aside {
  flex: 0 0 360px;
  gap: 16px;
}

.change-card-title {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  line-height: normal;
  color: $color-text;
}

// 528:723: the facts on the page grey, one under the other.
.change-facts {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0;
}

.change-fact {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  padding: 12px 16px;
  border-radius: $radius-input;
  background: $color-background;
  overflow-wrap: anywhere;
}

.change-fact dd {
  margin: 0;
}

// 528:725
.change-label {
  font-size: 10px;
  font-weight: 500;
  line-height: normal;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: $color-text-muted;
}

// 528:726
.change-value {
  font-size: 15px;
  font-weight: 500;
  line-height: normal;
  color: $color-text;
}

// 528:727
.change-hint {
  margin: 0;
  font-size: 12px;
  font-weight: 300;
  line-height: normal;
  color: $color-text-muted;
}

// 528:759
.change-note {
  margin: 0;
  padding: 14px 16px;
  border-radius: $radius-input;
  background: $color-accent-tint;
  font-size: 13px;
  font-weight: 400;
  line-height: 20px;
  color: $color-primary;
}

// Dizajn 44: an icon, a title, one sentence and one button.
.change-state {
  align-items: center;
  gap: 0;
  padding: 48px 24px;
  text-align: center;
}

.change-state-icon {
  width: 48px;
  height: 48px;
  margin-bottom: 12px;
  color: $color-text-muted;
}

.change-state-title {
  font-size: 17px;
  font-weight: 500;
  line-height: normal;
  color: $color-text;
}

.change-state-text {
  max-width: 420px;
  margin-top: 4px;
  font-size: 13px;
  font-weight: 300;
  line-height: normal;
  color: $color-text-muted;
}

// 357:503, the home page's grey button.
.change-state-button {
  display: inline-flex;
  align-items: center;
  margin-top: 16px;
  padding: 11px 20px;
  border-radius: $radius-button;
  background: $color-background;
  font-size: 13px;
  font-weight: 500;
  line-height: normal;
  color: $color-text;
  white-space: nowrap;
}

.change-state-button:hover {
  color: $color-primary;
}

// Below xl the summary goes under the form, as the owner's card does.
@include respond-below(xl) {
  .change-split {
    flex-direction: column;
    align-items: stretch;
  }

  .change-main,
  .change-aside {
    flex: none;
  }
}

@include mobile-only {
  .change-page {
    margin: 0;
  }

  .change-title {
    font-size: 22px;
  }

  .change-card {
    padding: 22px 16px;
  }
}
</style>
