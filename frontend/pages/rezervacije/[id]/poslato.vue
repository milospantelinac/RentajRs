<template>
  <div v-if="view" class="sent-page">
    <div class="container">
      <!-- 391:534 -->
      <section class="sent-card" :aria-labelledby="`${uid}-title`">
        <!-- 391:535 -->
        <header class="sent-head">
          <span class="sent-check">
            <img src="/images/icons/check-success-64.svg" alt="" width="64" height="64" />
          </span>
          <h1 :id="`${uid}-title`" class="sent-title">{{ t('requestSent.title') }}</h1>
          <p class="sent-subtitle">{{ view.subtitle }}</p>
        </header>

        <!-- 391:541 -->
        <div class="sent-summary">
          <div class="sent-listing">
            <div class="sent-photo">
              <img v-if="view.photo" :src="view.photo" alt="" />
            </div>
            <div class="sent-listing-text">
              <p class="sent-listing-title">{{ view.listing }}</p>
              <p v-if="view.meta" class="sent-listing-meta">{{ view.meta }}</p>
            </div>
          </div>
          <dl class="sent-rows">
            <div v-for="row in view.rows" :key="row.key" class="sent-row" :class="`is-${row.key}`">
              <dt class="sent-row-label">{{ row.label }}</dt>
              <dd class="sent-row-value">{{ row.value }}</dd>
            </div>
          </dl>
        </div>

        <!-- No frame: a transfer the listing takes without approval already
             waits for the payment, so its QR code comes with the confirmation. -->
        <div v-if="view.pay" class="sent-pay">
          <div v-if="qrDataUrl" class="sent-qr">
            <img :src="qrDataUrl" :alt="t('requestSent.qrAlt')" width="116" height="116" />
          </div>
          <div class="sent-pay-text">
            <dl class="sent-pay-facts">
              <div class="sent-pay-fact">
                <dt class="sent-pay-label">{{ t('booking.payAmount') }}</dt>
                <dd class="sent-pay-amount">{{ view.pay.amount }}</dd>
              </div>
              <div class="sent-pay-fact">
                <dt class="sent-pay-label">{{ t('requestSent.deadline') }}</dt>
                <dd class="sent-pay-deadline">{{ view.pay.deadline }}</dd>
              </div>
            </dl>
            <p class="sent-pay-note">{{ t('booking.scanQr') }}</p>
          </div>
        </div>

        <!-- 391:559 -->
        <p class="sent-note">{{ view.note }}</p>

        <!-- 391:561 -->
        <section class="sent-flow" :aria-labelledby="`${uid}-flow`">
          <div class="sent-flow-head">
            <h2 :id="`${uid}-flow`" class="sent-flow-title">{{ t('bookingForm.flowTitle') }}</h2>
            <InfoHint :text="view.tip" />
          </div>
          <ol class="sent-steps">
            <li v-for="(step, index) in view.steps" :key="index" class="sent-step">
              <span class="sent-step-number">{{ index + 1 }}</span>
              <span class="sent-step-text">
                <span class="sent-step-title">{{ step.title }}</span>
                <span class="sent-step-detail">{{ step.text }}</span>
              </span>
            </li>
          </ol>
        </section>

        <!-- 391:584 -->
        <div class="sent-actions">
          <NuxtLink :to="view.track" class="sent-button is-primary">{{ t('requestSent.track') }}</NuxtLink>
          <NuxtLink :to="view.back.to" class="sent-button is-plain">{{ view.back.label }}</NuxtLink>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
// Dizajn 41: the guest's confirmation once a request is sent, 391:496 (cash),
// 391:589 (a transfer the owner approves first) and 990:2248 (a playroom slot).
// A transfer taken without approval already waits for the payment and adds
// its QR code (no frame, user decision). The request page opens this page;
// a booking that moved on, or anyone but its guest, gets /rezervacije/:id,
// which tells every state apart (user decision).
import { buildRequestSentView } from '~/utils/requestSent'

definePageMeta({ middleware: 'auth' })
const { t } = useI18n()
const api = useApi()
const route = useRoute()
const auth = useAuthStore()
const uid = useId()
const bookingId = route.params.id

const { data } = await useAsyncData(`booking-sent-${bookingId}`, async () => {
  let booking
  try {
    booking = await api.get(`/bookings/${bookingId}`)
  } catch (e) {
    // The booking's own page says "not found" the way T92 wants it.
    if ([400, 403, 404].includes(e?.response?.status)) return { booking: null }
    throw e
  }
  if (booking.guestId !== auth.user?.id) return { booking: null }
  // T47: the QR code only exists once the booking waits for the payment.
  const qr = booking.status === 'AWAITING_PAYMENT' ? await api.get(`/bookings/${bookingId}/qr`).catch(() => null) : null
  return { booking, qrDataUrl: qr?.dataUrl ?? null }
})

const booking = computed(() => data.value?.booking ?? null)
const view = computed(() => (booking.value ? buildRequestSentView(t, booking.value) : null))
const qrDataUrl = computed(() => data.value?.qrDataUrl ?? null)

if (!view.value) await navigateTo(`/rezervacije/${bookingId}`, { replace: true })

useSeoMeta({
  title: () => (booking.value ? t('requestSent.pageTitle', { listing: booking.value.listing?.title }) : t('requestSent.title')),
})
</script>

<style lang="scss" scoped>
// 391:536: the green of a success (the dashboard's CONFIRMED pill).
$sent-success-bg: #cdfad1;

// Dizajn 41, 391:533: the page grey from the header down, the card centred
// 56 below it and 72 above the footer.
.sent-page {
  padding: 56px 0 72px;
  background: $color-background;
}

// 391:534: white, radius 24, elevation/4, 36 inside (32 at the bottom), 24 between parts.
.sent-card {
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 640px;
  max-width: 100%;
  margin: 0 auto;
  padding: 36px 36px 32px;
  border-radius: $radius-panel;
  background: $color-surface;
  box-shadow: 0 8px 24px rgba(97, 115, 133, 0.1);
}

// 391:535: the check, the title and one line, 12 apart.
.sent-head {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  text-align: center;
}

.sent-check {
  display: flex;
  flex-shrink: 0;
  width: 64px;
  height: 64px;
  overflow: hidden;
  border-radius: $radius-pill;
  background: $sent-success-bg;
}

.sent-check img {
  display: block;
  width: 64px;
  height: 64px;
}

.sent-title {
  margin: 0;
  font-size: 28px;
  font-weight: 400;
  line-height: 36px;
  letter-spacing: -0.7px;
  color: $color-text;
}

.sent-subtitle {
  margin: 0;
  font-size: 14px;
  font-weight: 300;
  line-height: 22px;
  color: $color-text-muted;
}

// 391:541: page grey, radius 16, the listing and then a row a fact.
.sent-summary {
  overflow: hidden;
  border-radius: $radius-card;
  background: $color-background;
}

// 391:542
.sent-listing {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
}

.sent-photo {
  flex-shrink: 0;
  width: 64px;
  height: 52px;
  overflow: hidden;
  border-radius: 12px;
  background: $color-border;
}

.sent-photo img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.sent-listing-text {
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.sent-listing-title {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  line-height: normal;
  color: $color-text;
}

.sent-listing-meta {
  margin: 0;
  font-size: 12px;
  font-weight: 300;
  line-height: normal;
  color: $color-text-muted;
}

.sent-rows {
  margin: 0;
}

// 391:547: 12 / 18 with the line on top inside the row, as Figma draws it.
.sent-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 18px;
  box-shadow: inset 0 1px 0 $color-border;
  font-size: 13px;
  line-height: normal;
}

.sent-row-label {
  flex-shrink: 0;
  margin: 0;
  font-weight: 300;
  color: $color-text-muted;
}

.sent-row-value {
  min-width: 0;
  margin: 0;
  font-weight: 400;
  color: $color-text;
  text-align: right;
}

// 391:558
.sent-row.is-total .sent-row-value {
  font-size: 15px;
  font-weight: 600;
}

// No frame: the QR code beside what to pay and by when, on the summary's grey.
.sent-pay {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 16px 18px;
  border-radius: $radius-card;
  background: $color-background;
}

.sent-qr {
  flex-shrink: 0;
  width: 132px;
  height: 132px;
  padding: 8px;
  border-radius: 12px;
  background: $color-surface;
}

.sent-qr img {
  display: block;
  width: 116px;
  height: 116px;
}

.sent-pay-text {
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.sent-pay-facts {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
}

.sent-pay-fact {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sent-pay-label {
  font-size: 13px;
  font-weight: 300;
  line-height: normal;
  color: $color-text-muted;
}

.sent-pay-amount {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  line-height: normal;
  color: $color-text;
}

.sent-pay-deadline {
  margin: 0;
  font-size: 13px;
  font-weight: 400;
  line-height: normal;
  color: $color-text;
}

.sent-pay-note {
  margin: 0;
  font-size: 12px;
  font-weight: 300;
  line-height: 18px;
  color: $color-text-muted;
}

// 391:559
.sent-note {
  margin: 0;
  padding: 13px 16px;
  border-radius: 12px;
  background: $color-warning-bg;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  color: $color-warning;
}

// 391:561: the heading with its (i), then the steps 14 apart.
.sent-flow {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.sent-flow-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sent-flow-title {
  margin: 0;
  font-size: 15px;
  font-weight: 500;
  line-height: normal;
  color: $color-text;
}

.sent-steps {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}

// 391:566
.sent-step {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.sent-step-number {
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

.sent-step-text {
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.sent-step-title {
  font-size: 13px;
  font-weight: 500;
  line-height: normal;
  color: $color-text;
}

.sent-step-detail {
  font-size: 12px;
  font-weight: 300;
  line-height: 18px;
  color: $color-text-muted;
}

// 391:584: two halves 12 apart, 49 tall.
.sent-actions {
  display: flex;
  gap: 12px;
}

.sent-button {
  display: flex;
  flex: 1 1 0;
  align-items: center;
  justify-content: center;
  min-width: 0;
  padding: 15px 16px;
  border-radius: $radius-button;
  font-size: 15px;
  font-weight: 500;
  line-height: normal;
  text-align: center;
  text-decoration: none;
  transition:
    opacity 0.15s ease,
    color 0.15s ease;
}

// 391:585: the gradient CTA. Its elevation/brand-hover never shows, since the
// frame's button row (391:584) clips it, so none is drawn here either.
.sent-button.is-primary {
  background: linear-gradient(90deg, $color-gradient-start 0%, $color-primary 100%);
  color: $color-surface;
}

.sent-button.is-primary:hover {
  opacity: 0.92;
}

// 391:587
.sent-button.is-plain {
  background: $color-background;
  color: $color-text;
}

.sent-button.is-plain:hover {
  color: $color-primary;
}

.sent-button:focus-visible {
  outline: 2px solid $color-primary;
  outline-offset: 3px;
}

@include respond-below(md) {
  .sent-page {
    padding: 32px 0 56px;
  }

  .sent-card {
    gap: 20px;
    padding: 28px 20px 24px;
  }

  .sent-listing,
  .sent-row {
    padding-right: 16px;
    padding-left: 16px;
  }
}

@include respond-below(sm) {
  .sent-actions {
    flex-direction: column;
  }

  .sent-button {
    flex: none;
  }

  .sent-pay {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
