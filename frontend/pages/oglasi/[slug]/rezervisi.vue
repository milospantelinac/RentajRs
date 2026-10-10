<template>
  <div v-if="listing" class="request-page">
    <div class="container">
      <header class="request-head">
        <h1 class="request-title">{{ listingName }}</h1>
        <p class="request-subtitle">{{ subtitle }}</p>
      </header>

      <div v-if="isOwnListing" class="request-split">
        <p class="request-card request-own">{{ t('booking.ownListingNotice') }}</p>
      </div>

      <div v-else class="request-split">
        <form class="request-card" novalidate @submit.prevent="submit">
          <!-- The term: a defined slot, months, a stay's dates or a day on working
               hours (components/bookings/RequestTermFields.vue, T136). -->
          <RequestTermFields :term="term" :listing="listing" :error="errors.term" />

          <!-- 375:406. T127: a playroom's adults sit next to its children and
               the payment moves under them; T125: a vehicle, a machine or a
               warehouse asks for no guests at all. -->
          <div class="request-grid">
            <div v-if="askGuests" class="request-field">
              <label class="request-label" for="request-guests">{{ guestLabel }}</label>
              <div class="request-stepper" :class="{ 'is-invalid': guestErrorShown }">
                <input
                  id="request-guests"
                  v-model="guestInput"
                  class="request-stepper-input"
                  type="text"
                  inputmode="numeric"
                  autocomplete="off"
                  maxlength="4"
                  :aria-invalid="guestErrorShown"
                  :aria-describedby="guestNoteId"
                  @input="onGuestInput"
                  @blur="guestTouched = true"
                />
                <span class="request-stepper-buttons">
                  <button
                    type="button"
                    class="request-stepper-button"
                    :disabled="guestCount <= minGuests"
                    :aria-label="t('booking.guestCountDecrease')"
                    @click="stepGuests(-1)"
                  >
                    &minus;
                  </button>
                  <button
                    type="button"
                    class="request-stepper-button"
                    :disabled="guestCap !== null && guestCount >= guestCap"
                    :aria-label="t('booking.guestCountIncrease')"
                    @click="stepGuests(1)"
                  >
                    +
                  </button>
                </span>
              </div>
              <p v-if="guestErrorShown" :id="guestNoteId" class="request-error">
                <img src="/images/icons/field-error.svg" alt="" />{{ guestError }}
              </p>
              <p v-else-if="guestHint" :id="guestNoteId" class="request-hint">{{ guestHint }}</p>
            </div>

            <div v-if="askAdults" class="request-field">
              <label class="request-label" for="request-adults">{{ t('bookingForm.adultsCount') }}</label>
              <div class="request-stepper">
                <input
                  id="request-adults"
                  v-model="adultInput"
                  class="request-stepper-input"
                  type="text"
                  inputmode="numeric"
                  autocomplete="off"
                  maxlength="4"
                  :aria-describedby="adultNoteId"
                  @input="onAdultInput"
                  @blur="onAdultBlur"
                />
                <span class="request-stepper-buttons">
                  <button
                    type="button"
                    class="request-stepper-button"
                    :disabled="adultCount <= 0"
                    :aria-label="t('booking.adultCountDecrease')"
                    @click="stepAdults(-1)"
                  >
                    &minus;
                  </button>
                  <button
                    type="button"
                    class="request-stepper-button"
                    :disabled="adultCount >= 9999"
                    :aria-label="t('booking.adultCountIncrease')"
                    @click="stepAdults(1)"
                  >
                    +
                  </button>
                </span>
              </div>
              <p :id="adultNoteId" class="request-hint">{{ t('bookingForm.adultsHint') }}</p>
            </div>

            <div class="request-field">
              <template v-if="flow.accepts === 'BOTH'">
                <label class="request-label" for="request-payment">{{ t('booking.paymentMethodLabel') }}</label>
                <span class="request-select" :class="{ 'is-empty': !form.paymentMethod, 'is-invalid': errors.payment }">
                  <select
                    id="request-payment"
                    v-model="form.paymentMethod"
                    class="request-select-control"
                    :aria-invalid="!!errors.payment"
                    :aria-describedby="paymentNoteId"
                  >
                    <option value="" disabled>{{ t('booking.paymentMethodChoose') }}</option>
                    <option value="CASH">{{ t('booking.paymentMethodCash') }}</option>
                    <option value="BANK_TRANSFER">{{ t('booking.paymentMethodOnline') }}</option>
                  </select>
                  <img src="/images/icons/chevron-down-18.svg" alt="" />
                </span>
              </template>
              <template v-else>
                <p class="request-label">{{ t('booking.paymentMethodLabel') }}</p>
                <p class="request-fixed">
                  {{ flow.accepts === 'BANK_TRANSFER' ? t('booking.paymentMethodOnline') : t('booking.paymentMethodCash') }}
                </p>
              </template>
              <p v-if="errors.payment" :id="paymentNoteId" class="request-error">
                <img src="/images/icons/field-error.svg" alt="" />{{ errors.payment }}
              </p>
              <p v-else :id="paymentNoteId" class="request-hint">{{ paymentHint }}</p>
            </div>
          </div>

          <!-- No frame: extra services an older listing still carries. -->
          <div v-if="extraServiceItems.length" class="request-extras" role="group" :aria-labelledby="extrasLabelId">
            <p :id="extrasLabelId" class="request-label">{{ t('listing.extraServices') }}</p>
            <div class="request-extras-list">
              <label
                v-for="service in extraServiceItems"
                :key="service.id"
                class="request-extra"
                :class="{ 'is-selected': service.selected }"
              >
                <input
                  type="checkbox"
                  class="visually-hidden"
                  :checked="service.selected"
                  @change="toggleService(service.id, $event.target.checked)"
                />
                <span class="request-extra-name">{{ service.name }}</span>
                <span class="request-extra-price">{{ service.price }}</span>
              </label>
            </div>
          </div>

          <!-- 375:424 -->
          <div class="request-field">
            <div class="request-label-row">
              <label class="request-label" for="request-message">{{ t('booking.message') }}</label>
              <span class="request-optional">{{ t('common.optional') }}</span>
            </div>
            <textarea id="request-message" v-model="form.guestMessage" class="request-textarea" rows="3" />
          </div>

          <p v-if="error" class="request-error" role="alert">
            <img src="/images/icons/field-error.svg" alt="" />{{ error }}
          </p>

          <!-- 375:430, 375:432 -->
          <button type="submit" class="request-submit" :disabled="submitting || term.termUnavailable">
            {{ submitting ? t('bookingForm.sending') : t('listing.sendRequest') }}
          </button>
          <p class="request-note">{{ submitNote }}</p>
        </form>

        <aside class="request-aside">
          <!-- 369:408 -->
          <section class="request-panel request-summary">
            <div class="request-listing">
              <div class="request-listing-photo">
                <img v-if="coverUrl" :src="coverUrl" alt="" />
              </div>
              <div class="request-listing-text">
                <p class="request-listing-title">{{ listingName }}</p>
                <p class="request-listing-meta">{{ listingMeta }}</p>
                <p v-if="ratingLine" class="request-listing-meta">{{ ratingLine }}</p>
              </div>
            </div>

            <div class="request-bill">
              <p class="request-bill-row">
                <span class="request-bill-label">{{ t('bookingForm.term') }}</span>
                <span class="request-bill-value">{{ term.termValue }}</span>
              </p>
              <p v-if="askGuests" class="request-bill-row">
                <span class="request-bill-label">{{ guestLabel }}</span>
                <span class="request-bill-value">{{ guestValue }}</span>
              </p>
              <p v-if="askAdults" class="request-bill-row">
                <span class="request-bill-label">{{ t('bookingForm.adultsCount') }}</span>
                <span class="request-bill-value">{{ adultCount }}</span>
              </p>
              <p v-for="row in priceRows" :key="row.key" class="request-bill-row">
                <span class="request-bill-label">{{ row.label }}</span>
                <span class="request-bill-value">{{ row.value }}</span>
              </p>
              <span class="request-bill-line" aria-hidden="true" />
              <p class="request-bill-row request-bill-total">
                <span class="request-bill-label">{{ t('bookingForm.total') }}</span>
                <span class="request-bill-value">{{ totalValue }}</span>
              </p>
              <p v-if="advanceRow" class="request-bill-row">
                <span class="request-bill-label">{{ advanceRow.label }}</span>
                <span class="request-bill-value">{{ advanceRow.value }}</span>
              </p>
            </div>

            <div class="request-summary-note">
              <p>{{ t('bookingForm.amountNote') }}</p>
              <InfoHint :text="t('bookingForm.tips.amount')" align="end" />
            </div>
          </section>

          <!-- 369:433 -->
          <section class="request-panel request-flow">
            <div class="request-panel-head">
              <h2 class="request-panel-title">{{ t('bookingForm.flowTitle') }}</h2>
              <InfoHint :text="flowTip" />
            </div>
            <ol class="request-steps">
              <li v-for="(step, index) in flowSteps" :key="index" class="request-step">
                <span class="request-step-number">{{ index + 1 }}</span>
                <span class="request-step-text">
                  <span class="request-step-title">{{ step.title }}</span>
                  <span class="request-step-detail">{{ step.text }}</span>
                </span>
              </li>
            </ol>
          </section>

          <!-- 369:456 -->
          <section class="request-panel request-cancel">
            <div class="request-panel-head">
              <h2 class="request-panel-title">{{ t('bookingForm.cancelTitle') }}</h2>
              <InfoHint :text="t('bookingForm.tips.cancel')" />
            </div>
            <p class="request-cancel-text">{{ cancellationText }}</p>
          </section>
        </aside>
      </div>
    </div>
  </div>
</template>

<script setup>
// Dizajn 40: the guest's request page, frames 363:406 (a stay picked on the
// calendar) and 538:514 (a day and one of its defined slots). Working hours
// and monthly stays have no frame and are built from the same parts. What
// the calendar and the slots offer, how the term is priced and what a sent
// request does are unchanged (T74, T83, T86, Dizajn 23); the steps after the
// request follow what the listing really does (user decision).
definePageMeta({ middleware: 'auth' })
const { t } = useI18n()
const api = useApi()
const route = useRoute()
const auth = useAuthStore()
const nuxtApp = useNuxtApp()

const { data: listing } = await useAsyncData(`booking-listing-${route.params.slug}`, () =>
  api.get(`/listings/public/${route.params.slug}`),
)

if (listing.value && (listing.value.bookingModel === 'NO_BOOKING' || !listing.value.canBook)) {
  await navigateTo(`/oglasi/${listing.value.slug}`)
}

const model = computed(() => getRequestModel(listing.value))

// T86 — the server already refuses this (errors.CANNOT_BOOK_OWN_LISTING),
// but the form let an owner fill the whole thing in first and only found out
// on submit; gate it up front instead.
const isOwnListing = computed(() => !!listing.value && auth.user?.id === listing.value.userId)

// One clock for the server render and the browser, so both offer the same
// slots and start times; a later visit in the same tab reads it again.
const now = useState('booking-request-now', () => Date.now())
if (import.meta.client && !nuxtApp.isHydrating) now.value = Date.now()

// Defined slots and working hours need the listing's terms before the page
// renders; stays and months load theirs in the calendar.
const { data: availability, refresh: refreshAvailability } = await useAsyncData(`booking-availability-${route.params.slug}`, () => {
  if (!listing.value || !['slots', 'hours'].includes(model.value)) return Promise.resolve(null)
  const days = listing.value.maxAdvanceBookingDays || 365
  return api.get(`/listings/${listing.value.id}/availability`, {
    query: { from: new Date(now.value).toISOString(), to: new Date(now.value + days * 86_400_000).toISOString() },
  })
})

const form = reactive({
  guestMessage: '',
  extraServices: [],
  paymentMethod: '',
})
const errors = reactive({ term: '', payment: '' })
const error = ref('')
const submitting = ref(false)

// ---- The term ------------------------------------------------------------

// Dizajn 11: the listing page's booking card hands its selection over in the
// query string; the slot, the months, the dates or the hours and what they
// allow are composables/useRequestTerm.js (shared with the T136 change screen).
const term = useRequestTerm({ listing, availability, now, initial: route.query })

// T86 — a stale server-rejection message used to sit above the button
// forever, even after the guest fixed the very thing it complained about;
// every selection change clears it instead of waiting for the next submit.
watch(
  () => [term.form.startsAt, term.form.endsAt, term.form.monthStart, term.form.monthCount, term.form.definedSlotId, term.slotStartTime],
  () => {
    errors.term = ''
    error.value = ''
  },
)

// ---- Guests --------------------------------------------------------------

// Mirrors the backend's cap (bookings.service.ts createRequest). Dizajn 23:
// "Maks. broj gostiju" and the capacity from step Detalji both apply.
const guestCap = computed(() => (listing.value ? getGuestCap(listing.value) : null))
const minGuests = computed(() => listing.value?.minGuests || 1)
const guestInput = ref(String(Math.max(Number(route.query.guests) || 1, listing.value?.minGuests || 1)))
const guestCount = computed(() => (/^\d+$/.test(guestInput.value) ? Number(guestInput.value) : 0))
const guestTouched = ref(false)
const guestNoteId = useId()
const paymentNoteId = useId()
const extrasLabelId = useId()

const guestLabel = computed(() => getGuestLabel(t, listing.value))
const guestHint = computed(() => formatGuestLimit(t, listing.value, guestCap.value))
// T125: a vehicle, a machine or a warehouse is rented whole, with no guests.
const askGuests = computed(() => asksGuestCount(listing.value))
const overCap = computed(() => guestCap.value !== null && guestCount.value > guestCap.value)
const guestError = computed(() => {
  if (!askGuests.value) return ''
  if (overCap.value) return guestHint.value
  if (guestCount.value < minGuests.value) return formatGuestMinimum(t, listing.value, minGuests.value)
  return ''
})
// The ticket: too many shows under the field at once; too few once it is left.
const guestErrorShown = computed(() => !!guestError.value && (overCap.value || guestTouched.value))
// The price always follows a count the listing takes.
const quoteGuests = computed(() => Math.min(Math.max(guestCount.value, minGuests.value), guestCap.value ?? Infinity))
const guestValue = computed(() => formatGuestValue(t, listing.value, guestCount.value || minGuests.value))

function onGuestInput() {
  guestInput.value = guestInput.value.replace(/\D/g, '').slice(0, 4)
  error.value = ''
}
function stepGuests(delta) {
  guestInput.value = String(Math.min(Math.max(guestCount.value + delta, minGuests.value), guestCap.value ?? Infinity))
  error.value = ''
}

// T127: the adults coming with the children to a playroom, 1 to start with,
// from 0 and without a limit; the owner's information, never in the price.
const askAdults = computed(() => asksAdults(listing.value))
const adultInput = ref('1')
const adultCount = computed(() => (/^\d+$/.test(adultInput.value) ? Number(adultInput.value) : 0))
const adultNoteId = useId()
function onAdultInput() {
  adultInput.value = adultInput.value.replace(/\D/g, '').slice(0, 4)
  error.value = ''
}
function onAdultBlur() {
  adultInput.value = String(adultCount.value)
}
function stepAdults(delta) {
  adultInput.value = String(Math.min(Math.max(adultCount.value + delta, 0), 9999))
  error.value = ''
}

// ---- Payment, extras and what follows ------------------------------------

const flow = computed(() => getRequestFlow(listing.value, form.paymentMethod))
const paymentHint = computed(() => getPaymentHint(t, flow.value))
const flowSteps = computed(() => buildFlowSteps(t, listing.value, flow.value))
const flowTip = computed(() => getFlowTip(t, flow.value))
const submitNote = computed(() => getSubmitNote(t, flow.value))
const cancellationText = computed(() => getCancellationText(t, listing.value, flow.value))

watch(
  () => form.paymentMethod,
  () => {
    errors.payment = ''
    error.value = ''
  },
)

const extraServiceItems = computed(() =>
  (listing.value?.extraServices || []).map((service) => ({
    id: service.id,
    name: service.name,
    price: `+${formatRsd(service.price)}`,
    selected: form.extraServices.some((selection) => selection.serviceId === service.id),
  })),
)
function toggleService(serviceId, checked) {
  form.extraServices = checked
    ? [...form.extraServices, { serviceId, quantity: 1 }]
    : form.extraServices.filter((selection) => selection.serviceId !== serviceId)
  error.value = ''
}

// ---- The summary -----------------------------------------------------------

const listingName = computed(() =>
  formatBookingListing({ title: listing.value.title, place: listing.value.cityArea?.name || listing.value.city?.name }),
)
const subtitle = computed(() => t(`bookingForm.subtitle.${model.value === 'slots' || model.value === 'hours' ? model.value : 'stay'}`))
// 538:793: "Igraonice · Beograd, Vračar"
const listingMeta = computed(() => {
  const place = [listing.value.city?.name, listing.value.cityArea?.name].filter(Boolean).join(', ')
  return [listing.value.category?.name, place].filter(Boolean).join(' · ')
})
// 369:414: "★ 4.8 · 26 recenzija", from the first review on (T114).
const ratingLine = computed(() => {
  const count = Number(listing.value.reviewCount) || 0
  if (!count) return ''
  const reviews = t(`listing.reviewsCount${srPluralCategory(count)}`, { count })
  return hasRating(listing.value) ? `★ ${formatRating(listing.value.avgRating)} · ${reviews}` : reviews
})
const coverUrl = computed(() => {
  const photos = (listing.value.photos || []).filter((photo) => !photo.pendingRemoval)
  return (photos.find((photo) => photo.isCover) || photos[0])?.url || ''
})

// T83: the exact shape /bookings and /bookings/quote both expect, so the
// price shown is never computed for a different term than the one sent.
function buildTermPayload() {
  const base = {
    guestCount: askGuests.value ? quoteGuests.value : undefined,
    extraServices: form.extraServices.length ? form.extraServices : undefined,
  }
  return term.payload ? { ...base, ...term.payload } : null
}

const quote = ref(null)
let quoteRequest = 0
async function refreshQuote() {
  const payload = buildTermPayload()
  const request = ++quoteRequest
  if (!payload) {
    quote.value = null
    return
  }
  const result = await api.post(`/listings/${listing.value.id}/bookings/quote`, payload).catch(() => null)
  if (request === quoteRequest) quote.value = result
}
watch(() => JSON.stringify(buildTermPayload()), refreshQuote)
onMounted(() => {
  if (listing.value && !isOwnListing.value) refreshQuote()
})

const priceRows = computed(() => buildPriceRows(t, listing.value, quote.value, model.value === 'slots' ? term.selectedSlot : null))
const totalValue = computed(() => (quote.value ? formatRsd(quote.value.totalAmount) : '-'))
const advanceRow = computed(() => getAdvanceRow(t, quote.value, flow.value))

// ---- Sending -----------------------------------------------------------------

async function submit() {
  if (term.termUnavailable) return
  error.value = ''
  guestTouched.value = true
  const payload = buildTermPayload()
  errors.term = term.missingTermMessage()
  errors.payment = flow.value.accepts === 'BOTH' && !form.paymentMethod ? t('bookingForm.paymentRequired') : ''
  if (!payload || errors.payment || guestError.value) {
    await nextTick()
    document.querySelector('.request-card .request-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    return
  }
  submitting.value = true
  try {
    const booking = await api.post(`/listings/${listing.value.id}/bookings`, {
      ...payload,
      guestCount: askGuests.value ? guestCount.value : undefined,
      adultCount: askAdults.value ? adultCount.value : undefined,
      // T76: a listing that takes both methods books the one the guest picked.
      paymentMethod: flow.value.accepts === 'BOTH' ? form.paymentMethod : undefined,
      guestMessage: form.guestMessage.trim() || undefined,
    })
    // Dizajn 41: the confirmation, before the booking's own page.
    await navigateTo(`/rezervacije/${booking.id}/poslato`)
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

useSeoMeta({ title: () => (listing.value ? `${t('listing.sendRequest')} - ${listing.value.title}` : t('listing.sendRequest')) })
</script>

<style lang="scss" scoped>
// The term fields, the message and the send button (and the error colours the
// steppers share) are shared with the booking change screen (T136).
@use '@/assets/scss/request-form' as *;

// Dizajn 40, 363:443: the page grey under the header, 48 above the title
// and 72 below the cards.
.request-page {
  padding: 48px 0 72px;
  background: $color-background;
}

// 363:444
.request-head {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.request-title {
  margin: 0;
  font-size: 30px;
  font-weight: 400;
  line-height: 38px;
  letter-spacing: -0.9px;
  color: $color-text;
}

.request-subtitle {
  margin: 0;
  font-size: 15px;
  font-weight: 300;
  line-height: normal;
  color: $color-text-muted;
}

// 369:406: the form (800) and the summary (392), 24 apart and 22 under the title.
.request-split {
  display: flex;
  align-items: flex-start;
  gap: 24px;
  margin-top: 22px;
}

// 363:447: white, radius 16, the frame's single shadow, 28 inside, 22 between parts.
.request-card {
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  gap: 22px;
  min-width: 0;
  margin: 0;
  padding: 28px;
  border-radius: 16px;
  background: $color-surface;
  box-shadow: 0 8px 24px rgba(97, 115, 133, 0.1);
}

.request-own {
  font-size: 15px;
  line-height: 22px;
  color: $color-text-muted;
}

// The guests and the payment (375:406), two columns 20 apart. T127: a
// playroom's adults take the payment's place and it goes a row down, still
// one column wide.
.request-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
  gap: 22px 20px;
}

// 375:409: 54 tall, 18 in on the left, the steppers 12 from the right.
.request-stepper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: 54px;
  padding: 0 12px 0 18px;
  border-radius: 12px;
  background: $color-background;
  transition:
    background-color 0.15s ease,
    box-shadow 0.15s ease;
}

.request-stepper:focus-within {
  background: $color-surface;
  box-shadow: inset 0 0 0 1.5px $color-primary;
}

.request-stepper.is-invalid {
  background: $request-danger-bg;
  box-shadow: inset 0 0 0 1.5px $request-danger-border;
}

.request-stepper-input {
  flex: 1 1 auto;
  min-width: 0;
  height: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  outline: none;
  background: transparent;
  color: $color-text;
  font-family: $font-family-base;
  font-size: 15px;
  font-weight: 400;
  line-height: normal;
}

// 375:411: 28px white squares, 6 apart.
.request-stepper-buttons {
  display: flex;
  flex-shrink: 0;
  gap: 6px;
}

.request-stepper-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid $color-border;
  border-radius: 8px;
  background: $color-surface;
  color: $color-text;
  font-family: $font-family-base;
  font-size: 15px;
  font-weight: 400;
  line-height: 1;
  cursor: pointer;
  transition: border-color 0.15s ease;
}

.request-stepper-button:hover:not(:disabled) {
  border-color: $color-primary;
}

.request-stepper-button:disabled {
  opacity: 0.4;
  cursor: default;
}

// A listing that takes one method shows it without a choice.
.request-fixed {
  display: flex;
  align-items: center;
  height: 49px;
  margin: 0;
  padding: 0 18px;
  border-radius: 12px;
  background: $color-background;
  font-size: 15px;
  font-weight: 400;
  line-height: normal;
  color: $color-text;
}

// Extra services take the slot cards' look (538:875).
.request-extras {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.request-extras-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.request-extra {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 180px;
  padding: 12px 16px;
  border-radius: 12px;
  background: $color-surface;
  box-shadow: inset 0 0 0 1px $color-border;
  line-height: normal;
  cursor: pointer;
}

.request-extra.is-selected {
  background: $color-accent-tint;
  box-shadow: inset 0 0 0 1.5px $color-primary;
}

.request-extra:focus-within {
  outline: 2px solid $color-primary;
  outline-offset: 2px;
}

.request-extra-name {
  font-size: 15px;
  font-weight: 500;
  color: $color-text;
}

.request-extra-price {
  font-size: 13px;
  font-weight: 300;
  color: $color-text-muted;
}

// 369:407: three cards 20 apart.
.request-aside {
  display: flex;
  flex: 0 0 392px;
  flex-direction: column;
  gap: 20px;
  min-width: 0;
}

.request-panel {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 22px;
  border-radius: 16px;
  background: $color-surface;
  box-shadow: 0 8px 24px rgba(97, 115, 133, 0.1);
}

// 369:408
.request-summary {
  gap: 16px;
}

// 369:409
.request-listing {
  display: flex;
  align-items: center;
  gap: 14px;
}

.request-listing-photo {
  flex-shrink: 0;
  width: 74px;
  height: 60px;
  overflow: hidden;
  border-radius: 12px;
  background: $color-background;
}

.request-listing-photo img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.request-listing-text {
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.request-listing-title {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  color: $color-text;
}

.request-listing-meta {
  margin: 0;
  font-size: 12px;
  font-weight: 300;
  line-height: normal;
  color: $color-text-muted;
}

// 369:415: rows 10 apart on page grey.
.request-bill {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px;
  border-radius: 12px;
  background: $color-background;
}

.request-bill-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 0;
  font-size: 13px;
  line-height: normal;
}

.request-bill-label {
  flex-shrink: 0;
  font-weight: 300;
  color: $color-text-muted;
}

.request-bill-value {
  min-width: 0;
  font-weight: 400;
  color: $color-text;
  text-align: right;
}

// 369:425
.request-bill-line {
  display: block;
  height: 1px;
  background: $color-border;
}

// 369:426
.request-bill-total .request-bill-label {
  color: $color-text;
}

.request-bill-total .request-bill-value {
  font-size: 16px;
  font-weight: 600;
}

// 369:429
.request-summary-note {
  display: flex;
  align-items: center;
  gap: 8px;
}

.request-summary-note p {
  flex: 1 1 0;
  margin: 0;
  font-size: 12px;
  font-weight: 300;
  line-height: 18px;
  color: $color-text-muted;
}

// 369:433: the heading and the steps 14 apart.
.request-flow {
  gap: 14px;
}

.request-panel-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.request-panel-title {
  margin: 0;
  font-size: 15px;
  font-weight: 500;
  line-height: normal;
  color: $color-text;
}

.request-steps {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}

// 369:438
.request-step {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.request-step-number {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: $radius-pill;
  background: $color-accent-tint;
  color: $color-primary;
  font-size: 11px;
  font-weight: 500;
  line-height: normal;
}

.request-step-text {
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.request-step-title {
  font-size: 13px;
  font-weight: 500;
  line-height: normal;
  color: $color-text;
}

.request-step-detail {
  font-size: 12px;
  font-weight: 300;
  line-height: 18px;
  color: $color-text-muted;
}

// 369:456: 20 22 inside, 8 between the heading and the text.
.request-cancel {
  gap: 8px;
  padding: 20px 22px;
}

.request-cancel-text {
  margin: 0;
  font-size: 12px;
  font-weight: 300;
  line-height: 18px;
  color: $color-text-muted;
}

// The frames are 1440 wide. Below xl the summary follows the form.
@include respond-below(xl) {
  .request-split {
    flex-direction: column;
    align-items: stretch;
  }

  .request-aside {
    flex: none;
  }
}

@include respond-below(md) {
  .request-page {
    padding: 32px 0 56px;
  }

  .request-title {
    font-size: 26px;
    line-height: 32px;
    letter-spacing: -0.6px;
  }

  .request-card {
    padding: 20px;
  }

  .request-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
