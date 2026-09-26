<template>
  <div class="guestbook">
    <!-- 528:710 -->
    <a :href="backHref" class="guestbook-back" @click="emit('back', $event)">
      <img src="/images/icons/chevron-left-muted.svg" alt="" width="16" height="16" />
      <span class="guestbook-back-text">{{ t('dashboard.myBookings') }}</span>
    </a>

    <!-- 528:714 -->
    <header class="guestbook-head">
      <div class="guestbook-title-row">
        <h1 class="guestbook-title">{{ view.title }}</h1>
        <span class="guestbook-pill" :class="`guestbook-pill-${view.status}`">{{ view.statusText }}</span>
      </div>
      <p class="guestbook-subtitle">{{ view.subtitle }}</p>
    </header>

    <div class="guestbook-split">
      <!-- 528:721 -->
      <section class="guestbook-card guestbook-main" :aria-labelledby="`${uid}-details`">
        <h2 :id="`${uid}-details`" class="guestbook-card-title">{{ t('guestBooking.detailsTitle') }}</h2>

        <dl class="guestbook-facts">
          <div v-for="fact in view.facts" :key="fact.key" class="guestbook-fact" :class="{ 'is-wide': fact.wide }">
            <dt class="guestbook-label">{{ fact.label }}</dt>
            <dd class="guestbook-value">{{ fact.value }}</dd>
            <dd v-if="fact.hint" class="guestbook-hint">{{ fact.hint }}</dd>
          </div>
        </dl>

        <!-- 528:759, or what just happened in its place. -->
        <p v-if="note" class="guestbook-note" :class="`is-${note.tone}`" :role="note.tone === 'danger' ? 'alert' : 'status'">{{ note.text }}</p>

        <!-- T47/T91: the IPS QR and the same fields as copyable text. -->
        <div v-if="payDetails.length" class="guestbook-payment">
          <figure v-if="qrDataUrl" class="guestbook-qr">
            <img :src="qrDataUrl" :alt="t('booking.scanQr')" width="132" height="132" />
            <figcaption class="guestbook-hint">{{ t('booking.scanQr') }}</figcaption>
          </figure>
          <dl class="guestbook-pay-rows">
            <div v-for="field in payDetails" :key="field.key" class="guestbook-pay-row">
              <dt class="guestbook-label">{{ field.label }}</dt>
              <dd class="guestbook-value">{{ field.value }}</dd>
              <dd>
                <button type="button" class="guestbook-copy" @click="copyField(field.key, field.value)">
                  {{ copiedField === field.key ? t('common.copied') : t('common.copy') }}
                </button>
              </dd>
            </div>
          </dl>
        </div>

        <!-- 528:761 -->
        <div v-if="view.actions.length" class="guestbook-actions" :aria-busy="busy ? 'true' : undefined">
          <template v-for="action in view.actions" :key="action.name">
            <NuxtLink v-if="action.to" :to="action.to" class="guestbook-button" :class="`is-${action.look}`">{{ action.label }}</NuxtLink>
            <button
              v-else
              type="button"
              class="guestbook-button"
              :class="`is-${action.look}`"
              :disabled="busy"
              :aria-expanded="action.name === 'dispute-no-show' ? String(disputing) : undefined"
              @click="onAction(action.name)"
            >{{ action.label }}</button>
          </template>
        </div>

        <!-- T90: a dispute carries the guest's explanation for the admin. -->
        <section v-if="disputing" class="guestbook-panel" :aria-labelledby="`${uid}-dispute`">
          <h2 :id="`${uid}-dispute`" class="guestbook-card-title">{{ t('guestBooking.disputeTitle') }}</h2>
          <label :for="`${uid}-explanation`" class="guestbook-panel-label">{{ t('booking.disputeExplanationLabel') }}</label>
          <textarea
            :id="`${uid}-explanation`"
            v-model="explanation"
            class="guestbook-textarea"
            :placeholder="t('booking.disputeExplanationPlaceholder')"
            maxlength="1000"
          ></textarea>
          <p v-if="disputeError" class="guestbook-error" role="alert">{{ disputeError }}</p>
          <div class="guestbook-panel-buttons">
            <button type="button" class="guestbook-submit" :disabled="!explanation.trim() || busy" @click="submitDispute">
              {{ t('booking.disputeSubmit') }}
            </button>
            <button type="button" class="guestbook-link" @click="disputing = false">{{ t('common.cancel') }}</button>
          </div>
        </section>

        <!-- Dizajn 43: the form while the review window lasts, the review once posted. -->
        <GuestReviewPanel
          v-if="booking.status === 'COMPLETED' && (reviewStatus?.canReview || reviewStatus?.myReview)"
          :booking-id="booking.id"
          :status="reviewStatus"
          @saved="emit('review-saved')"
        />
      </section>

      <!-- 528:766 -->
      <aside class="guestbook-card guestbook-contact" :aria-labelledby="`${uid}-contact`">
        <h2 :id="`${uid}-contact`" class="guestbook-card-title">{{ t('booking.ownerContactTitle') }}</h2>
        <dl v-if="view.contact.rows.length" class="guestbook-contact-rows">
          <div v-for="row in view.contact.rows" :key="row.key" class="guestbook-contact-row">
            <dt class="guestbook-label">{{ row.label }}</dt>
            <dd class="guestbook-value">
              <a v-if="row.href" :href="row.href" class="guestbook-value-link">{{ row.value }}</a>
              <template v-else>{{ row.value }}</template>
            </dd>
          </div>
        </dl>
        <NuxtLink v-if="view.contact.listingTo" :to="view.contact.listingTo" class="guestbook-button is-plain is-block">
          {{ t('booking.viewListing') }}
        </NuxtLink>
        <p v-if="view.contact.footnote" class="guestbook-footnote">{{ view.contact.footnote }}</p>
      </aside>
    </div>
  </div>
</template>

<script setup>
// Dizajn 39: the guest's page of one booking. 528:514 draws a confirmed
// booking, 568:514 and 568:698 a completed one with its review; the page
// runs the actions and passes back what happened as `notice`.
import { formatRsd } from '~/utils/bookingRequests'
import { buildGuestBookingView } from '~/utils/guestBooking'

const props = defineProps({
  booking: { type: Object, required: true },
  reviewStatus: { type: Object, default: null },
  qrDataUrl: { type: String, default: null },
  backHref: { type: String, required: true },
  busy: { type: Boolean, default: false },
  notice: { type: Object, default: null },
})
const emit = defineEmits(['back', 'action', 'dispute-no-show', 'review-saved'])
const { t } = useI18n()
const uid = useId()

const view = computed(() => buildGuestBookingView(t, props.booking))

// What just happened wins over what the state itself says.
const note = computed(() => props.notice || (view.value.note ? { tone: 'info', text: view.value.note } : null))

// T91: the fields the IPS QR code encodes, while the payment is awaited.
const payDetails = computed(() => {
  const d = props.booking.status === 'AWAITING_PAYMENT' ? props.booking.bankTransferDetails : null
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
  await navigator.clipboard?.writeText(String(value)).catch(() => undefined)
  copiedField.value = key
  clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => (copiedField.value = ''), 2000)
}
onUnmounted(() => clearTimeout(copiedTimer))

const disputing = ref(false)
const explanation = ref('')
const disputeError = ref('')

function onAction(name) {
  if (name === 'dispute-no-show') {
    disputing.value = !disputing.value
    return
  }
  emit('action', name)
}

function submitDispute() {
  disputeError.value = ''
  emit('dispute-no-show', {
    explanation: explanation.value.trim(),
    done: () => {
      disputing.value = false
      explanation.value = ''
    },
    fail: (message) => (disputeError.value = message),
  })
}
</script>

<style lang="scss" scoped>
// Dizajn 39, frame 528:601: the way back, the title and the two cards, 20
// apart. The content column has none of the 4 / 8 padding 357:493 gives the
// dashboard's; the page takes it back.
$guestbook-success: #1db82b;
$guestbook-success-bg: #cdfad1;
$guestbook-success-note: #0f731f;
$guestbook-danger-bg: #fcd8e0;
$guestbook-danger-note-bg: #fdeff1;
$guestbook-closed-bg: #f0f2f5;

.guestbook {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

// 528:710
.guestbook-back {
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

.guestbook-back img {
  display: block;
  flex-shrink: 0;
}

.guestbook-back-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.guestbook-back:hover {
  color: $color-primary;
}

// 528:714
.guestbook-head {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.guestbook-title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.guestbook-title {
  min-width: 0;
  font-size: 26px;
  font-weight: 600;
  line-height: normal;
  color: $color-text;
  overflow-wrap: anywhere;
}

// 528:717, 568:609: both frames draw the green pill; the other states take
// the list's colours (380:785), on a grey that shows against the page.
.guestbook-pill {
  flex-shrink: 0;
  padding: 6px 12px;
  border-radius: $radius-pill;
  font-size: 13px;
  font-weight: 500;
  line-height: normal;
  white-space: nowrap;
}

.guestbook-pill-CONFIRMED,
.guestbook-pill-COMPLETED {
  background: $guestbook-success-bg;
  color: $guestbook-success;
}

.guestbook-pill-REQUESTED,
.guestbook-pill-AWAITING_PAYMENT {
  background: $color-warning-bg;
  color: $color-warning;
}

.guestbook-pill-REJECTED,
.guestbook-pill-NO_SHOW {
  background: $guestbook-danger-bg;
  color: $color-error;
}

.guestbook-pill-CANCELLED,
.guestbook-pill-EXPIRED {
  background: $guestbook-closed-bg;
  color: $color-text-muted;
}

.guestbook-subtitle {
  font-size: 14px;
  font-weight: 300;
  line-height: normal;
  color: $color-text-muted;
}

// 528:720: 692 and 360, 20 apart.
.guestbook-split {
  display: flex;
  align-items: flex-start;
  gap: 20px;
}

// 528:721, 528:766: white, a 1px line drawn inside, 26 / 28 inside.
.guestbook-card {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 0;
  padding: 26px 28px;
  border-radius: 20px;
  background: $color-surface;
  box-shadow: inset 0 0 0 1px $color-border;
}

.guestbook-main {
  flex: 0 1 692px;
}

.guestbook-contact {
  flex: 0 0 360px;
}

.guestbook-card-title {
  font-size: 17px;
  font-weight: 600;
  line-height: normal;
  color: $color-text;
}

// 528:723: two columns of 312, a wide fact across both.
.guestbook-facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin: 0;
}

.guestbook-fact {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  padding: 12px 16px;
  border-radius: $radius-input;
  background: $color-background;
  overflow-wrap: anywhere;
}

.guestbook-fact.is-wide {
  grid-column: 1 / -1;
}

.guestbook-fact dd,
.guestbook-contact-row dd,
.guestbook-pay-row dd {
  margin: 0;
}

// 528:725
.guestbook-label {
  font-size: 10px;
  font-weight: 500;
  line-height: normal;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: $color-text-muted;
}

// 528:726
.guestbook-value {
  font-size: 15px;
  font-weight: 500;
  line-height: normal;
  color: $color-text;
}

.guestbook-value-link {
  color: inherit;
}

.guestbook-value-link:hover {
  color: $color-primary;
}

// 528:727
.guestbook-hint {
  font-size: 12px;
  font-weight: 300;
  line-height: normal;
  color: $color-text-muted;
}

// 528:759, and the owner card's colours (565:800) for what just happened.
.guestbook-note {
  padding: 14px 16px;
  border-radius: $radius-input;
  font-size: 13px;
  font-weight: 400;
  line-height: 20px;
}

.guestbook-note.is-info {
  background: $color-accent-tint;
  color: $color-primary;
}

.guestbook-note.is-success {
  background: $guestbook-success-bg;
  color: $guestbook-success-note;
}

.guestbook-note.is-danger {
  background: $guestbook-danger-note-bg;
  color: $color-error;
}

// The payment while it is awaited: the QR and its fields on the facts' grey.
.guestbook-payment {
  display: flex;
  align-items: flex-start;
  gap: 20px;
  padding: 16px;
  border-radius: $radius-input;
  background: $color-background;
}

.guestbook-qr {
  display: flex;
  flex: 0 0 132px;
  flex-direction: column;
  gap: 8px;
  margin: 0;
}

.guestbook-qr img {
  display: block;
  width: 132px;
  height: 132px;
  border-radius: 8px;
  background: $color-surface;
}

.guestbook-pay-rows {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  margin: 0;
}

.guestbook-pay-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas:
    'label copy'
    'value copy';
  align-items: center;
  column-gap: 12px;
  row-gap: 3px;
  overflow-wrap: anywhere;
}

.guestbook-pay-row dt {
  grid-area: label;
}

.guestbook-pay-row .guestbook-value {
  grid-area: value;
}

.guestbook-pay-row dd:last-child {
  grid-area: copy;
}

.guestbook-copy {
  padding: 0;
  border: 0;
  background: none;
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  line-height: normal;
  color: $color-primary;
  cursor: pointer;
}

.guestbook-copy:hover {
  text-decoration: underline;
}

// 528:761: white buttons with the line inside, 12 apart.
.guestbook-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.guestbook-actions[aria-busy] {
  cursor: progress;
}

.guestbook-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 13px 20px;
  border: 0;
  border-radius: $radius-button;
  background: $color-surface;
  box-shadow: inset 0 0 0 1px $color-border;
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  line-height: normal;
  color: $color-text;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.guestbook-button:disabled {
  opacity: 0.6;
  cursor: inherit;
}

.guestbook-button.is-plain:hover {
  color: $color-primary;
}

// 528:762
.guestbook-button.is-danger {
  box-shadow: inset 0 0 0 1px $color-error;
  color: $color-error;
}

.guestbook-button.is-danger:not(:disabled):hover {
  background: $guestbook-danger-note-bg;
}

// 528:778
.guestbook-button.is-block {
  width: 100%;
}

// The dispute form, in the review panel's parts (568:673).
.guestbook-panel {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 18px;
  padding: 26px 28px;
  border-radius: 20px;
  background: $color-surface;
  box-shadow: inset 0 0 0 1px $color-border;
}

.guestbook-panel-label {
  font-size: 14px;
  font-weight: 500;
  line-height: normal;
  color: $color-text;
}

.guestbook-textarea {
  display: block;
  width: 100%;
  height: 110px;
  padding: 14px 16px;
  border: 0;
  border-radius: $radius-input;
  background: $color-background;
  box-shadow: inset 0 0 0 1px $color-border;
  font-family: inherit;
  font-size: 15px;
  font-weight: 400;
  line-height: normal;
  color: $color-text;
  resize: none;
}

.guestbook-textarea::placeholder {
  color: $color-text-muted;
  opacity: 1;
}

.guestbook-textarea:focus {
  outline: none;
  box-shadow: inset 0 0 0 1.5px $color-primary;
}

.guestbook-panel-buttons {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 18px;
}

.guestbook-submit {
  padding: 14px 28px;
  border: 0;
  border-radius: $radius-pill;
  background: $color-primary;
  font-family: inherit;
  font-size: 15px;
  font-weight: 500;
  line-height: normal;
  color: $color-surface;
  cursor: pointer;
}

.guestbook-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.guestbook-link {
  padding: 0;
  border: 0;
  background: none;
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  line-height: normal;
  color: $color-primary;
  cursor: pointer;
}

.guestbook-error {
  font-size: 13px;
  line-height: 20px;
  color: $color-error;
}

// 528:768: the owner's details, 12 apart.
.guestbook-contact-rows {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0;
}

.guestbook-contact-row {
  display: flex;
  flex-direction: column;
  gap: 3px;
  overflow-wrap: anywhere;
}

// 528:780
.guestbook-footnote {
  font-size: 12px;
  font-weight: 300;
  line-height: 18px;
  color: $color-text-muted;
}

// Below xl the owner's card goes under the booking's.
@include respond-below(xl) {
  .guestbook-split {
    flex-direction: column;
    align-items: stretch;
  }

  .guestbook-main,
  .guestbook-contact {
    flex: none;
  }
}

@include mobile-only {
  .guestbook-title {
    font-size: 22px;
  }

  .guestbook-card,
  .guestbook-panel {
    padding: 22px 16px;
  }

  .guestbook-facts {
    grid-template-columns: minmax(0, 1fr);
  }

  .guestbook-payment {
    flex-direction: column;
  }

  .guestbook-actions {
    flex-direction: column;
  }

  .guestbook-button {
    width: 100%;
    white-space: normal;
  }
}
</style>
