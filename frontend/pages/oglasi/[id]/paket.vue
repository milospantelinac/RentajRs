<template>
  <div class="package-page">
    <div class="container">
      <!-- T110 — reached both from the listing wizard and from Pretplate's
           "nadogradnja" — real history-back, not a fixed destination. -->
      <BackLink fallback="/kontrolna-tabla" />

      <header class="package-page-head">
        <p class="package-page-eyebrow">{{ copy.eyebrow }}</p>
        <h1 class="package-page-title">
          {{ copy.lead }}
          <span class="package-page-title-muted">{{ t('billing.choosePackageMuted') }}</span>
        </h1>
        <p v-if="copy.subtitle" class="package-page-subtitle">{{ copy.subtitle }}</p>
      </header>

      <!-- A renewal names the listings it carries, or says why this package can't be renewed. -->
      <div v-if="mode === 'renew'" class="package-page-info">
        <img src="/images/icons/info-circle.svg" alt="" class="package-page-info-icon" />
        <div class="package-page-info-body">
          <p class="package-page-info-text">{{ canRenew ? renewalCopy.covers : renewalBlockedText }}</p>
          <NuxtLink v-if="!canRenew" to="/kontrolna-tabla/pretplate" class="package-page-info-action">
            {{ t('billing.mySubscriptions') }}
          </NuxtLink>
        </div>
      </div>

      <!-- Ticket §5 — the owner already has a PRO package with a free slot, so
           buying another one isn't the only way forward; same rule and same
           attach call as the wizard's "Objavi oglas" (T42) and Pretplate. -->
      <div v-if="freeSlotSubscription" class="package-page-info">
        <img src="/images/icons/info-circle.svg" alt="" class="package-page-info-icon" />
        <div class="package-page-info-body">
          <p class="package-page-info-text">
            {{ t('billing.freeSlotNotice', { used: freeSlotSubscription.listings?.length || 0, limit: freeSlotSubscription.package.listingLimit }) }}
          </p>
          <button type="button" class="package-page-info-action" :disabled="attaching" @click="attachToFreeSlot">
            {{ attaching ? t('common.loading') : t('billing.freeSlotAction') }}
          </button>
          <p v-if="attachError" class="form-error mb-0">{{ attachError }}</p>
        </div>
      </div>

      <PackagePricingCards
        v-if="mode !== 'renew' || canRenew"
        v-model:cycle="cycle"
        :packages="packages || []"
        :highlight-key="highlightKey"
        :disabled-keys="disabledKeys"
        :disabled-reason="disabledReason"
        class="package-page-cards"
      >
        <template #cta="{ pkg }">
          <button type="button" class="package-cta-btn" @click="goToCheckout(pkg)">
            {{ mode === 'renew' ? t('billing.renewAction') : t('billing.selectPackage') }}
          </button>
        </template>
      </PackagePricingCards>

      <!-- Ticket §4 — which listing this purchase is for. -->
      <!-- A renewal names its listings above instead. -->
      <p v-if="listing?.title && mode !== 'renew'" class="package-page-context">
        {{ t('billing.packageForListing') }} <strong>{{ listing.title }}</strong>
      </p>
    </div>
  </div>
</template>

<script setup>
// Dizajn 13 (Figma "Izaberite paket · Desktop 1440", node 563:514) — the same
// offer as Cenovnik, so the same PackagePricingCards; only the framing around
// it (back button, "korak pre objave" heading, listing context) is this page's.
import { getPackagePurchaseMode, getRenewalCopy } from '~/utils/subscriptions'

// The query decides what is being bought, so a new one builds the page again.
definePageMeta({ middleware: 'auth', key: (route) => route.fullPath })
const { t } = useI18n()
const api = useApi()
const route = useRoute()

const { data: packages } = await useAsyncData('packages', () => api.get('/packages'))
const { data: listing } = await useAsyncData(`listing-${route.params.id}`, () => api.get(`/listings/${route.params.id}`))

// T42 — an active PRO subscription with fewer listings than its limit has a
// free slot. Only offered for a listing that isn't on a package yet — the
// same condition the wizard and Pretplate already use.
const { data: mySubscriptions } = await useAsyncData('my-subscriptions-for-package', () =>
  api.get('/subscriptions/mine').catch(() => []),
)

// ?obnova=<subscription>: paying the next period of a package the listing is on.
const renewId = typeof route.query.obnova === 'string' ? route.query.obnova : ''
const { data: renewal } = await useAsyncData(`package-renewal-${renewId}`, () =>
  renewId
    ? api.get(`/subscriptions/${renewId}/renewal`).catch(() => ({ renewable: false, reason: 'NOT_FOUND', listings: [] }))
    : Promise.resolve(false),
)

const currentPackageKey = computed(
  () => (mySubscriptions.value || []).find((s) => s.id === listing.value?.subscriptionId)?.package?.key,
)
// An expired listing, or a live one already on Pro, has nothing to buy here but its package's next period.
if (!renewId && listing.value?.subscriptionId && (listing.value.status === 'EXPIRED' || (listing.value.status === 'ACTIVE' && currentPackageKey.value === 'PRO'))) {
  await navigateTo({ path: route.path, query: { obnova: listing.value.subscriptionId } }, { replace: true })
}

const mode = computed(() => getPackagePurchaseMode(listing.value, renewal.value || null))
const canRenew = computed(() => !!renewal.value?.renewable)
const renewalCopy = computed(() => (canRenew.value ? getRenewalCopy(t, renewal.value) : null))
const renewalBlockedText = computed(() =>
  t(renewal.value?.reason === 'ALREADY_RENEWED' ? 'billing.renewAlreadyPaid' : 'billing.renewNotAllowed'),
)

const copy = computed(() => {
  if (mode.value === 'renew') {
    return { eyebrow: t('billing.renewEyebrow'), lead: t('billing.renewLead'), subtitle: renewalCopy.value?.subtitle || '' }
  }
  if (mode.value === 'upgrade') {
    return { eyebrow: t('billing.upgradeEyebrow'), lead: t('billing.choosePackageLead'), subtitle: t('billing.upgradeSubtitle') }
  }
  return { eyebrow: t('billing.choosePackageEyebrow'), lead: t('billing.choosePackageLead'), subtitle: t('billing.choosePackageSubtitle') }
})

const cycle = ref(renewal.value?.billingCycle === 'YEARLY' ? 'YEARLY' : 'MONTHLY')

const highlightKey = computed(() => {
  if (mode.value === 'renew') return renewal.value?.package?.key
  return mode.value === 'upgrade' ? 'PRO' : 'STANDARD'
})

// DODATNA LOGIKA za pakete — Osnovni (paketi bez rezervacionog sistema) nije
// dostupan za oglase koji koriste online rezervacije (PER_STAY/PER_SLOT).
const bookingDisabledKeys = computed(() => {
  if (!listing.value || listing.value.bookingModel === 'NO_BOOKING') return []
  return (packages.value || []).filter((p) => !p.hasBookings).map((p) => p.key)
})

// A renewal keeps its package; a live listing only moves up to Pro here.
const disabledKeys = computed(() => {
  const keys = (packages.value || []).map((p) => p.key)
  if (mode.value === 'renew') return keys.filter((key) => key !== renewal.value?.package?.key)
  if (mode.value === 'upgrade') return keys.filter((key) => key !== 'PRO')
  return bookingDisabledKeys.value
})

const disabledReason = computed(() => {
  if (mode.value === 'renew') return t('billing.renewSamePackage')
  if (mode.value === 'upgrade') return t('billing.upgradeProOnly')
  return t('billing.osnovniDisabledForOnlineBooking')
})
const freeSlotSubscription = computed(() => {
  if (!listing.value || listing.value.subscriptionId) return null
  return (mySubscriptions.value || []).find(
    (s) => s.status === 'ACTIVE' && s.package?.key === 'PRO' && (s.listings?.length || 0) < (s.package?.listingLimit || 0),
  )
})

const attaching = ref(false)
const attachError = ref('')
async function attachToFreeSlot() {
  attachError.value = ''
  attaching.value = true
  try {
    await api.post('/subscriptions/purchase', {
      listingId: route.params.id,
      existingSubscriptionId: freeSlotSubscription.value.id,
    })
    await navigateTo(`/oglasi/${route.params.id}/poslato`)
  } catch (e) {
    attachError.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    attaching.value = false
  }
}

function goToCheckout(pkg) {
  navigateTo({
    path: `/oglasi/${route.params.id}/checkout`,
    query: { packageId: pkg.id, billingCycle: cycle.value, ...(mode.value === 'renew' ? { obnova: renewId } : {}) },
  })
}

useSeoMeta({ title: mode.value === 'renew' ? t('billing.renewEyebrow') : t('billing.choosePackage') })
</script>

<style lang="scss" scoped>
// Figma 563:545 — the column starts 40px under the header and ends 80px
// above the footer.
.package-page {
  padding: 40px 0 80px;
}

// 593:517 — eyebrow, title, subtitle 10 apart, 28px under the back button.
.package-page-head {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  margin-top: 28px;
  text-align: center;
}

.package-page-eyebrow {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.66px;
  text-transform: uppercase;
  color: $color-primary;
}

.package-page-title {
  font-size: 52px;
  font-weight: 400;
  line-height: 65px;
  color: $color-text;
}

.package-page-title-muted {
  color: $color-text-muted;
}

.package-page-subtitle {
  font-size: 16px;
  line-height: 26px;
  color: $color-text-muted;
}

// The switch sits 42px under the subtitle (28 between frames + the Period
// frame's own 14 top padding) and the cards 44px under the switch.
.package-page-cards {
  --package-grid-offset: 44px;
  margin-top: 42px;
}

// Info block as drawn on the payment step (563:737): #ECF2FC, 12 radius,
// 16px (i) icon, brand-blue 13/20 text.
.package-page-info {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  max-width: 760px;
  margin: 32px auto 0;
  padding: 12px 14px;
  border-radius: $radius-input;
  background: $color-accent-tint;
}

.package-page-info-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  margin-top: 2px;
}

.package-page-info-body {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}

.package-page-info-text {
  font-size: 13px;
  line-height: 20px;
  color: $color-primary;
}

.package-page-info-action {
  padding: 0;
  border: 0;
  background: none;
  color: $color-primary;
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

.package-page-info-action:disabled {
  opacity: 0.6;
  cursor: default;
}

.package-page-context {
  margin-top: 32px;
  font-size: 14px;
  color: $color-text-muted;
  text-align: center;
}

.package-page-context strong {
  font-weight: 500;
  color: $color-text;
}

@include respond-below(md) {
  .package-page {
    padding: 24px 0 56px;
  }

  .package-page-title {
    font-size: 34px;
    line-height: 42px;
  }

  .package-page-subtitle {
    font-size: 15px;
    line-height: 24px;
  }
}
</style>
