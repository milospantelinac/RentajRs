<template>
  <article class="request" :class="`request-${card.status}`">
    <header class="request-head">
      <div class="request-heading">
        <h1 class="request-title">{{ card.title }}</h1>
        <p class="request-subtitle">{{ card.subtitle }}</p>
      </div>
      <span class="request-pill" :class="`request-pill-${card.status}`">{{ card.statusText }}</span>
    </header>

    <dl class="request-facts">
      <div v-for="fact in card.facts" :key="fact.key" class="request-fact" :class="{ 'is-wide': fact.wide }">
        <dt class="request-fact-label">{{ fact.label }}</dt>
        <dd class="request-fact-value">
          <a v-if="fact.href" :href="fact.href" class="request-fact-link">{{ fact.value }}</a>
          <template v-else>{{ fact.value }}</template>
        </dd>
        <dd v-if="fact.hint" class="request-fact-hint">{{ fact.hint }}</dd>
      </div>
    </dl>

    <p v-if="note" class="request-note" :class="`is-${note.tone}`" :role="note.tone === 'danger' ? 'alert' : 'status'">{{ note.text }}</p>

    <!-- T136: the guest asks for another term; the owner decides. -->
    <section v-if="pendingChange" class="request-change" :aria-label="t('bookingChange.ownerTitle')">
      <p class="request-change-title">{{ t('bookingChange.ownerTitle') }}</p>
      <dl class="request-facts">
        <div v-for="row in changeRows" :key="row.key" class="request-fact is-wide">
          <dt class="request-fact-label">{{ row.label }}</dt>
          <dd class="request-fact-value">{{ row.value }}</dd>
          <dd v-if="row.hint" class="request-fact-hint">{{ row.hint }}</dd>
        </div>
        <div v-if="pendingChange.guestMessage" class="request-fact is-wide">
          <dt class="request-fact-label">{{ t('bookingChange.guestMessage') }}</dt>
          <dd class="request-fact-value">„{{ pendingChange.guestMessage }}“</dd>
        </div>
      </dl>
      <p class="request-change-note">{{ changeNote }}</p>
      <div class="request-actions is-raised" :aria-busy="busy ? 'true' : undefined">
        <button type="button" class="request-button request-button-primary" :disabled="busy" @click="emit('action', 'change-approve')">
          {{ t('bookingChange.approve') }}
        </button>
        <button type="button" class="request-button request-button-danger" :disabled="busy" @click="emit('action', 'change-reject')">
          {{ t('bookingChange.reject') }}
        </button>
      </div>
    </section>

    <div v-if="actions" class="request-actions" :class="{ 'is-raised': actions.raised }" :aria-busy="busy ? 'true' : undefined">
      <button
        v-for="action in actions.buttons"
        :key="action.name"
        type="button"
        class="request-button"
        :class="[`request-button-${action.look}`, { 'is-unavailable': action.unavailable }]"
        :disabled="busy || action.unavailable"
        @click="emit('action', action.name)"
      >{{ action.label }}</button>
    </div>

    <p v-if="footnote" class="request-footnote">{{ footnote }}</p>
  </article>
</template>

<script setup>
// Dizajn 34: the owner's card for one booking, centred on its page. The
// frames draw a new request (359:499), a confirmed booking (384:589) and a
// declined request (565:750); a booking waiting for payment and the closed
// states use the same parts. The page runs the actions and passes back what
// happened as `notice`.
import { buildRequestCard } from '~/utils/bookingRequests'
import { buildChangeRows, keepsAdvance } from '~/utils/bookingChange'

const props = defineProps({
  booking: { type: Object, required: true },
  busy: { type: Boolean, default: false },
  notice: { type: Object, default: null },
})
const emit = defineEmits(['action'])
const { t } = useI18n()

const card = computed(() => buildRequestCard(t, props.booking))

// What just happened wins over what the state itself says.
const note = computed(() => props.notice || card.value.note)

// T136: a guest's request for another term, with the term now, the new one and the price.
const pendingChange = computed(() => props.booking.change?.pending || null)
const changeRows = computed(() => (pendingChange.value ? buildChangeRows(t, props.booking, pendingChange.value) : []))
// The advance only where one stays as it is.
const changeNote = computed(() => t(keepsAdvance(props.booking) ? 'bookingChange.ownerNote' : 'bookingChange.ownerNoteNoAdvance'))

const actions = computed(() => {
  switch (props.booking.status) {
    // 359:529
    case 'REQUESTED':
      return {
        raised: true,
        buttons: [
          { name: 'approve', label: t('booking.approve'), look: 'primary' },
          { name: 'reject', label: t('booking.reject'), look: 'danger' },
        ],
      }
    case 'AWAITING_PAYMENT':
      return {
        raised: true,
        buttons: [
          { name: 'confirm-payment', label: t('booking.confirmPayment'), look: 'primary' },
          { name: 'cancel-by-owner', label: t('booking.cancelBooking'), look: 'danger' },
        ],
      }
    // 384:619
    case 'CONFIRMED':
      return {
        raised: false,
        buttons: [
          { name: 'no-show', label: t('booking.markNoShow'), look: 'muted', unavailable: !card.value.noShowAvailable },
          { name: 'cancel-by-owner', label: t('booking.cancelBooking'), look: 'danger' },
        ],
      }
    default:
      return null
  }
})

// 384:636
const footnote = computed(() =>
  props.booking.status === 'CONFIRMED' && !card.value.noShowAvailable ? t('booking.noShowTooEarlyHint') : '',
)
</script>

<style lang="scss" scoped>
// 359:499: 560 wide, 26 / 28 inside, its parts 20 apart.
$request-success: #178c24;
$request-success-bg: #cdfad1;
$request-success-note: #0f731f;
$request-danger-bg: #fdeff1;
$request-closed-bg: #f0f2f5;
$request-brand-shadow: 0 8px 18px rgba(9, 87, 223, 0.28);

.request {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 560px;
  max-width: 100%;
  padding: 26px 28px;
  border-radius: $radius-card;
  background: $color-surface;
  box-shadow:
    0 1px 3px rgba(97, 115, 133, 0.05),
    0 8px 24px rgba(97, 115, 133, 0.05);
}

// 359:499 casts the deeper shadow the other two frames don't.
.request-REQUESTED {
  box-shadow: $shadow-card;
}

// 359:500
.request-head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.request-heading {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
  overflow-wrap: anywhere;
}

.request-title {
  font-size: 20px;
  font-weight: 500;
  line-height: 28px;
  letter-spacing: -0.4px;
  color: $color-text;
}

.request-subtitle {
  font-size: 12px;
  font-weight: 300;
  line-height: normal;
  color: $color-text-muted;
}

// 359:504, 384:594, 565:755
.request-pill {
  flex-shrink: 0;
  padding: 6px 12px;
  border-radius: $radius-pill;
  font-size: 12px;
  font-weight: 500;
  line-height: normal;
  white-space: nowrap;
}

.request-pill-REQUESTED,
.request-pill-AWAITING_PAYMENT {
  background: $color-warning-bg;
  color: $color-warning;
}

.request-pill-CONFIRMED {
  background: $request-success-bg;
  color: $request-success;
}

.request-pill-REJECTED,
.request-pill-NO_SHOW {
  background: $request-danger-bg;
  color: $color-error;
}

// The list's colours (378:572, 378:585, 483:415) for the states no card draws.
.request-pill-COMPLETED,
.request-pill-EXPIRED {
  background: $color-background;
  color: $color-text-muted;
}

.request-pill-CANCELLED {
  background: $request-closed-bg;
  color: $color-text-muted;
}

// 359:506: two columns of 246, a wide fact across both.
.request-facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin: 0;
}

// 359:507
.request-fact {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  padding: 13px 16px;
  border-radius: $radius-input;
  background: $color-background;
  overflow-wrap: anywhere;
}

.request-fact.is-wide {
  grid-column: 1 / -1;
}

.request-fact dd {
  margin: 0;
}

.request-fact-label {
  font-size: 10px;
  font-weight: 500;
  line-height: normal;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: $color-text-muted;
}

.request-fact-value {
  font-size: 15px;
  font-weight: 500;
  line-height: normal;
  color: $color-text;
}

.request-fact-link {
  color: inherit;
}

.request-fact-link:hover {
  color: $color-primary;
}

.request-fact-hint {
  font-size: 12px;
  font-weight: 300;
  line-height: normal;
  color: $color-text-muted;
}

// 359:527 for a state that waits on the owner, 565:800 for one they closed.
.request-note {
  padding: 13px 16px;
  border-radius: $radius-input;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.request-note.is-warning {
  background: $color-warning-bg;
  color: $color-warning;
}

.request-note.is-success,
.request-note.is-danger {
  padding: 14px 16px;
  font-size: 13px;
  line-height: 20px;
}

.request-note.is-success {
  background: $request-success-bg;
  color: $request-success-note;
}

.request-note.is-danger {
  background: $request-danger-bg;
  color: $color-error;
}

// T136: no frame; the request for another term in the accent tint, its own buttons under it.
.request-change {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px 20px;
  border-radius: $radius-input;
  background: $color-accent-tint;
}

.request-change-title {
  margin: 0;
  font-size: 15px;
  font-weight: 500;
  line-height: normal;
  color: $color-primary;
}

.request-change-note {
  margin: 0;
  font-size: 12px;
  font-weight: 300;
  line-height: 18px;
  color: $color-text-muted;
}

// 384:619, and 359:529 with room for the primary button's shadow.
.request-actions {
  display: flex;
  gap: 12px;
}

.request-actions.is-raised {
  padding: 4px 8px 8px;
}

.request-actions[aria-busy] {
  cursor: progress;
}

.request-button {
  flex: 1 1 0;
  min-width: 0;
  padding: 15px 12px;
  border: 0;
  border-radius: $radius-button;
  background: $color-background;
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  line-height: normal;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    opacity 0.15s ease;
}

.request-button:disabled {
  cursor: inherit;
}

.is-raised .request-button {
  font-size: 15px;
}

// 359:530
.request-button-primary {
  background: linear-gradient(90deg, $color-gradient-start 0%, $color-gradient-mid 100%);
  box-shadow: $request-brand-shadow;
  color: $color-surface;
}

.request-button-primary:not(:disabled):hover {
  opacity: 0.92;
}

// 359:532, 384:634
.request-button-danger {
  color: $color-error;
}

.request-button-danger:not(:disabled):hover {
  background: $request-danger-bg;
}

// 384:632, at 60% until the booking starts.
.request-button-muted {
  color: $color-text-muted;
}

.request-button-muted:not(:disabled):hover {
  color: $color-text;
}

.request-button.is-unavailable {
  opacity: 0.6;
  cursor: not-allowed;
}

// 384:636
.request-footnote {
  font-size: 12px;
  font-weight: 300;
  line-height: normal;
  color: $color-text-muted;
}

@include mobile-only {
  .request {
    padding: 22px 16px;
  }

  .request-head {
    flex-wrap: wrap;
  }

  .request-facts {
    grid-template-columns: minmax(0, 1fr);
  }

  .request-actions {
    flex-direction: column;
  }

  .request-actions.is-raised {
    padding: 4px 0 8px;
  }
}
</style>
