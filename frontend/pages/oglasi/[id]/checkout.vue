<template>
  <div v-if="listing && pkg" class="checkout-page">
    <div class="container">
      <BackLink :fallback="packagesUrl" />

      <header class="checkout-head">
        <p class="checkout-eyebrow">{{ copy.eyebrow }}</p>
        <h1 class="checkout-title">{{ t('billing.checkoutTitle') }}</h1>
        <p v-if="copy.subtitle" class="checkout-subtitle">{{ copy.subtitle }}</p>
      </header>

      <div class="checkout-split">
        <!-- Figma 563:697 -->
        <section class="checkout-card checkout-details">
          <h2 class="checkout-card-title">{{ t('billing.billingDetails') }}</h2>

          <div class="checkout-row">
            <label class="checkout-field">
              <span class="checkout-label">{{ t('auth.firstName') }}</span>
              <input v-model="form.firstName" type="text" class="checkout-input" autocomplete="given-name" required />
            </label>
            <label class="checkout-field">
              <span class="checkout-label">{{ t('auth.lastName') }}</span>
              <input v-model="form.lastName" type="text" class="checkout-input" autocomplete="family-name" required />
            </label>
          </div>

          <label class="checkout-field">
            <span class="checkout-label">{{ t('auth.email') }}</span>
            <input v-model="form.email" type="email" class="checkout-input" autocomplete="email" required />
          </label>

          <label class="checkout-check">
            <input v-model="form.isCompany" type="checkbox" class="checkout-checkbox" />
            <span class="checkout-check-label">{{ t('billing.wantCompanyInvoice') }}</span>
          </label>

          <template v-if="form.isCompany">
            <div class="checkout-row">
              <label class="checkout-field">
                <span class="checkout-label">{{ t('dashboard.taxId') }}</span>
                <input v-model="form.taxId" type="text" class="checkout-input" required />
              </label>
              <label class="checkout-field">
                <span class="checkout-label">{{ t('billing.registrationNumber') }}</span>
                <input v-model="form.registrationNumber" type="text" class="checkout-input" required />
              </label>
            </div>
            <label class="checkout-field">
              <span class="checkout-label">{{ t('dashboard.companyName') }}</span>
              <input v-model="form.companyName" type="text" class="checkout-input" autocomplete="organization" required />
            </label>
            <label class="checkout-field">
              <span class="checkout-label">{{ t('billing.companyAddress') }}</span>
              <input v-model="form.companyAddress" type="text" class="checkout-input" autocomplete="street-address" required />
            </label>
          </template>
        </section>

        <!-- Figma 563:715 -->
        <section class="checkout-card checkout-summary">
          <h2 class="checkout-card-title">{{ t('billing.yourOrder') }}</h2>

          <div class="checkout-item">
            <span class="checkout-item-name">{{ pkg.key }} — {{ cycle === 'YEARLY' ? t('billing.yearly') : t('billing.monthly') }}</span>
            <span class="checkout-item-price">{{ formatPrice(priceForCycle) }}</span>
          </div>

          <div class="checkout-item-meta">
            <p>{{ t('billing.pricePerListing') }}</p>
            <!-- Ticket §3 — which listing the package is for. -->
            <p>{{ copy.forListing }} <span class="checkout-item-listing">{{ copy.listings }}</span></p>
          </div>

          <div class="checkout-divider" />

          <p class="checkout-note">{{ t('billing.notVatRegistered') }}</p>

          <div class="checkout-secure">
            <img src="/images/icons/lock.svg" alt="" class="checkout-secure-icon" />
            <span>{{ t('billing.securePaymentNote') }}</span>
          </div>

          <p class="checkout-note">{{ t('billing.threeDSecureNotice') }}</p>
          <p v-if="copy.afterPayment" class="checkout-note">{{ copy.afterPayment }}</p>

          <label class="checkout-check checkout-check-terms">
            <input v-model="termsAccepted" type="checkbox" class="checkout-checkbox" />
            <span class="checkout-terms">
              {{ t('billing.termsAcceptPrefix') }}
              <NuxtLink to="/uslovi-koriscenja" target="_blank">{{ t('billing.termsLinkTerms') }}</NuxtLink>
              {{ t('billing.termsAcceptMiddle') }}
              <NuxtLink to="/politika-privatnosti" target="_blank">{{ t('billing.termsLinkPrivacy') }}</NuxtLink>
              {{ t('billing.termsAcceptSuffix') }}
            </span>
          </label>

          <p v-if="error" class="form-error mb-0">{{ error }}</p>

          <button type="button" class="checkout-pay" :disabled="submitting || !termsAccepted || renewalBlocked" @click="submitCheckout">
            {{ submitting ? t('common.loading') : copy.pay }}
          </button>
          <NuxtLink :to="packagesUrl" class="checkout-back">
            ← {{ t('billing.backToPackages') }}
          </NuxtLink>

          <div v-if="!termsAccepted" class="checkout-info">
            <img src="/images/icons/info-circle.svg" alt="" class="checkout-info-icon" />
            <span>{{ t('billing.payButtonDisabledNote') }}</span>
          </div>
        </section>

        <!-- Under the summary: the bank wants the card marks on the payment page itself (Dizajn 14 review). -->
        <div class="checkout-cards">
          <img src="/images/payment/maestro.svg" alt="Maestro" class="checkout-cards-logo checkout-cards-maestro" />
          <img src="/images/payment/mastercard.svg" alt="Mastercard" class="checkout-cards-logo checkout-cards-mastercard" />
          <img src="/images/payment/dinacard.png" alt="DinaCard" class="checkout-cards-logo checkout-cards-dinacard" />
          <img src="/images/payment/visa.png" alt="Visa" class="checkout-cards-logo checkout-cards-visa" />
          <img src="/images/payment/amex.png" alt="American Express" class="checkout-cards-logo checkout-cards-amex" />
          <a href="https://www.bancaintesa.rs" target="_blank" rel="noopener" class="checkout-cards-link">
            <img src="/images/payment/banca-intesa.png" alt="Banca Intesa" class="checkout-cards-logo checkout-cards-intesa" />
          </a>
          <a href="https://www.mastercard.rs/sr-rs/korisnici/pronadite-karticu.html" target="_blank" rel="noopener" class="checkout-cards-link">
            <img src="/images/payment/mastercard-id-check.png" alt="Mastercard ID Check" class="checkout-cards-logo checkout-cards-idcheck" />
          </a>
          <a
            href="https://rs.visa.com/pay-with-visa/security-and-assistance/protected-everywhere.html"
            target="_blank"
            rel="noopener"
            class="checkout-cards-link"
          >
            <img src="/images/payment/visa-secure.png" alt="Visa Secure" class="checkout-cards-logo checkout-cards-visasecure" />
          </a>
        </div>
      </div>

      <form v-if="nestpayForm" ref="nestpayFormEl" :action="nestpayForm.actionUrl" method="POST" class="checkout-hidden-form">
        <input v-for="(value, key) in nestpayForm.fields" :key="key" type="hidden" :name="key" :value="value" />
      </form>
    </div>
  </div>
</template>

<script setup>
// Dizajn 14 (Figma "Plaćanje paketa · Desktop 1440", node 563:660). Layout
// only — the fields sent to /subscriptions/checkout/init, the validation and
// the NestPay hand-off below are unchanged.
import { getPackagePurchaseMode, getRenewalCopy } from '~/utils/subscriptions'

// The query decides what is being paid for, so a new one builds the page again.
definePageMeta({ middleware: 'auth', key: (route) => route.fullPath })
const { t } = useI18n()
const api = useApi()
const auth = useAuthStore()
const route = useRoute()

const cycle = route.query.billingCycle === 'YEARLY' ? 'YEARLY' : 'MONTHLY'
const packageId = route.query.packageId

const { data: listing } = await useAsyncData(`checkout-listing-${route.params.id}`, () => api.get(`/listings/${route.params.id}`))
const { data: packages } = await useAsyncData('checkout-packages', () => api.get('/packages'))
const pkg = computed(() => packages.value?.find((p) => p.id === packageId))

// ?obnova=<subscription>: the next period of a package the listing is already on.
const renewId = typeof route.query.obnova === 'string' ? route.query.obnova : ''
const { data: renewal } = await useAsyncData(`checkout-renewal-${renewId}`, () =>
  renewId
    ? api.get(`/subscriptions/${renewId}/renewal`).catch(() => ({ renewable: false, reason: 'NOT_FOUND', listings: [] }))
    : Promise.resolve(false),
)
const mode = computed(() => getPackagePurchaseMode(listing.value, renewal.value || null))
const renewalBlocked = computed(() => mode.value === 'renew' && !renewal.value?.renewable)
const packagesUrl = computed(() => `/oglasi/${route.params.id}/paket${renewId ? `?obnova=${renewId}` : ''}`)

// What the order says depends on what the payment does: publish, move up to Pro, or renew.
const copy = computed(() => {
  if (mode.value === 'renew') {
    const renewalCopy = renewal.value?.renewable ? getRenewalCopy(t, renewal.value) : null
    return {
      eyebrow: t('billing.renewEyebrow'),
      subtitle: renewalCopy?.subtitle || '',
      forListing: renewalCopy?.forListing || t('billing.packageForListing'),
      listings: renewalCopy?.listings || listing.value?.title,
      afterPayment: renewalCopy?.afterPayment || '',
      pay: t('billing.payAndRenew'),
    }
  }
  const base = { forListing: t('billing.packageForListing'), listings: listing.value?.title }
  if (mode.value === 'upgrade') {
    return {
      ...base,
      eyebrow: t('billing.upgradeEyebrow'),
      subtitle: t('billing.upgradeSubtitle'),
      afterPayment: t('billing.upgradeAfterPayment'),
      pay: t('billing.payAndUpgrade'),
    }
  }
  return {
    ...base,
    eyebrow: t('billing.choosePackageEyebrow'),
    subtitle: t('billing.checkoutSubtitle'),
    afterPayment: t('billing.afterPaymentNotice'),
    pay: t('billing.payAndPublish'),
  }
})
const priceForCycle = computed(() => (pkg.value ? (cycle === 'YEARLY' ? pkg.value.priceYearly : pkg.value.priceMonthly) : 0))

const form = reactive({
  firstName: auth.user?.firstName || '',
  lastName: auth.user?.lastName || '',
  email: auth.user?.email || '',
  isCompany: auth.user?.buyerType === 'COMPANY',
  taxId: auth.user?.taxId || '',
  registrationNumber: auth.user?.registrationNumber || '',
  companyName: auth.user?.companyName || '',
  companyAddress: auth.user?.billingAddress || '',
})

const submitting = ref(false)
// A renewal that can no longer be paid says why instead of sending the owner to the bank.
const error = ref(
  renewalBlocked.value ? t(renewal.value?.reason === 'ALREADY_RENEWED' ? 'billing.renewAlreadyPaid' : 'billing.renewNotAllowed') : '',
)
const nestpayForm = ref(null)
const nestpayFormEl = ref(null)
const termsAccepted = ref(false)

function formatPrice(value) {
  return `${new Intl.NumberFormat('sr-RS').format(value || 0)} RSD`
}

function validate() {
  if (!form.firstName || !form.lastName || !form.email) return t('billing.checkoutValidationRequired')
  if (form.isCompany && (!form.taxId || !form.registrationNumber || !form.companyName || !form.companyAddress)) {
    return t('billing.checkoutValidationCompanyRequired')
  }
  if (!termsAccepted.value) return t('billing.termsRequired')
  return ''
}

async function submitCheckout() {
  error.value = validate()
  if (error.value) return

  submitting.value = true
  try {
    const result = await api.post('/subscriptions/checkout/init', {
      listingId: route.params.id,
      packageId,
      billingCycle: cycle,
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      phone: auth.user?.phone || undefined,
      isCompany: form.isCompany,
      taxId: form.isCompany ? form.taxId : undefined,
      registrationNumber: form.isCompany ? form.registrationNumber : undefined,
      companyName: form.isCompany ? form.companyName : undefined,
      companyAddress: form.isCompany ? form.companyAddress : undefined,
      termsAccepted: termsAccepted.value,
      renewSubscriptionId: renewId || undefined,
    })
    nestpayForm.value = result
    await nextTick()
    nestpayFormEl.value.submit()
  } catch (e) {
    error.value = extractErrorMessage(e, t('auth.genericError'))
    submitting.value = false
  }
}

useSeoMeta({ title: t('billing.checkoutTitle') })
</script>

<style lang="scss" scoped>
// Figma 563:691 — column 40px under the header, 80px above the footer.
.checkout-page {
  padding: 40px 0 80px;
}

// 597:514 — left-aligned here (unlike the centred package picker), 24px under
// the back button, items 10 apart.
.checkout-head {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  margin-top: 24px;
}

.checkout-eyebrow {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.66px;
  text-transform: uppercase;
  color: $color-primary;
}

.checkout-title {
  font-size: 52px;
  font-weight: 400;
  line-height: 65px;
  color: $color-text;
}

.checkout-subtitle {
  max-width: 760px;
  font-size: 16px;
  line-height: 26px;
  color: $color-text-muted;
}

// 563:696 — 720 | 24 | 472, both cards top-aligned.
.checkout-split {
  display: grid;
  grid-template-columns: 720fr 472fr;
  gap: 24px;
  align-items: start;
  margin-top: 24px;
}

// Both cards: white, 1px #E4EBF2, 20 radius, 30/32 padding (stroke inside in
// Figma, so the border comes off the padding here), children 20 apart.
.checkout-card {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 0;
  padding: 29px 31px;
  background: $color-surface;
  border: 1px solid $color-border;
  border-radius: 20px;
}

.checkout-card-title {
  font-size: 20px;
  font-weight: 600;
  line-height: 25px;
  color: $color-text;
}

// -- Billing details ----------------------------------------------------------

.checkout-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.checkout-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.checkout-label {
  font-size: 14px;
  font-weight: 500;
  line-height: 18px;
  color: $color-text;
}

// 563:702 — #F9FAFD, 1px #E4EBF2, 12 radius, 16/15 padding → 49px tall.
.checkout-input {
  width: 100%;
  height: 49px;
  padding: 0 15px;
  border: 1px solid $color-border;
  border-radius: $radius-input;
  background: $color-background;
  color: $color-text;
  font-family: $font-family-base;
  font-size: 15px;
  transition: border-color 0.15s ease;
}

.checkout-input:focus {
  outline: none;
  border-color: $color-primary;
}

.checkout-check {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}

// 563:713 — 18px box, white, 1.5px #E4EBF2, 5 radius; checked fills with the
// brand blue and carries the same white tick the filter panel uses.
.checkout-checkbox {
  appearance: none;
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  margin: 0;
  border: 1.5px solid $color-border;
  border-radius: 5px;
  background: $color-surface center / 12px no-repeat;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease;
}

.checkout-checkbox:checked {
  border-color: $color-primary;
  background-color: $color-primary;
  background-image: url('/images/icons/check-small.svg');
}

.checkout-checkbox:focus-visible {
  outline: 2px solid rgba(9, 87, 223, 0.35);
  outline-offset: 2px;
}

.checkout-check-label {
  font-size: 15px;
  color: $color-text;
}

// -- Order summary ------------------------------------------------------------

.checkout-item {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 16px;
  line-height: 20px;
  color: $color-text;
}

.checkout-item-name {
  flex: 1;
  min-width: 0;
  font-weight: 500;
}

.checkout-item-price {
  font-weight: 600;
  white-space: nowrap;
}

.checkout-item-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
  font-weight: 300;
  line-height: 16px;
  color: $color-text-muted;
}

.checkout-item-listing {
  font-weight: 400;
  color: $color-text;
}

.checkout-divider {
  height: 1px;
  background: $color-border;
}

.checkout-note {
  font-size: 13px;
  line-height: 20px;
  color: $color-text-muted;
}

.checkout-secure {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: $radius-input;
  background: $color-background;
  font-size: 13px;
  color: $color-text;
}

.checkout-secure-icon,
.checkout-info-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.checkout-check-terms {
  align-items: center;
}

.checkout-terms {
  font-size: 13px;
  line-height: 20px;
  color: $color-text;
}

.checkout-terms a {
  color: inherit;
}

.checkout-terms a:hover {
  text-decoration: underline;
}

// 563:733 — brand fill, full pill, 51px; at 50% until terms are accepted.
.checkout-pay {
  width: 100%;
  height: 51px;
  border: 0;
  border-radius: $radius-pill;
  background: $color-primary;
  color: $color-surface;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.checkout-pay:hover:not(:disabled) {
  background: $color-dark;
}

.checkout-pay:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

// 563:735 — white, 1px #E4EBF2, full pill, 49px.
.checkout-back {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 49px;
  border: 1px solid $color-border;
  border-radius: $radius-pill;
  background: $color-surface;
  color: $color-text;
  font-size: 15px;
  font-weight: 500;
  transition: border-color 0.15s ease;
}

.checkout-back:hover {
  border-color: $color-primary;
}

// 563:737 — the same info block as the package picker's.
.checkout-info {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border-radius: $radius-input;
  background: $color-accent-tint;
  font-size: 13px;
  line-height: 20px;
  color: $color-primary;
}

.checkout-info-icon {
  margin-top: 2px;
}

// -- Card marks ---------------------------------------------------------------

// Dizajn 14 review: the strip goes under the summary, in its column. 563:660
// draws none there, so this is the phone footer's strip (26:3352, 26:3353)
// with the footer's files and links, in full colour as in Figma. At the
// frame's 343 it wraps into the same two rows: the five cards, then the bank
// and the two checks.
.checkout-cards {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 23.5px 30px;
  justify-self: center;
  width: 100%;
  max-width: 343px;
}

@include respond-above(lg) {
  .checkout-cards {
    grid-column: 2;
  }
}

.checkout-cards-link {
  display: flex;
  align-items: center;
}

.checkout-cards-logo {
  display: block;
  width: auto;
}

// The heights the phone footer gives each mark to match 26:3352 and 26:3353.
// The Visa, ID Check and Visa Secure files carry transparent padding, so
// their boxes are taller than the marks.
.checkout-cards-maestro { height: 27px; }
.checkout-cards-mastercard { height: 27px; }
.checkout-cards-dinacard { height: 25.5px; }
.checkout-cards-visa { height: 25px; }
.checkout-cards-amex { height: 28px; }
.checkout-cards-intesa { height: 29.2px; }
.checkout-cards-idcheck { height: 21px; }
.checkout-cards-visasecure { height: 28px; }

.checkout-hidden-form {
  display: none;
}

@include respond-below(lg) {
  .checkout-split {
    grid-template-columns: minmax(0, 1fr);
  }
}

@include respond-below(md) {
  .checkout-page {
    padding: 24px 0 56px;
  }

  .checkout-title {
    font-size: 34px;
    line-height: 42px;
  }

  .checkout-card {
    padding: 23px 19px;
  }

  .checkout-row {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
