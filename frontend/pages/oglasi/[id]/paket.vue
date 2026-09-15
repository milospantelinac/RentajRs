<template>
  <div class="package-page">
    <div class="container">
      <!-- T110 — reached both from the listing wizard and from Pretplate's
           "nadogradnja" — real history-back, not a fixed destination. -->
      <BackLink fallback="/kontrolna-tabla" />

      <header class="package-page-head">
        <p class="package-page-eyebrow">{{ t('billing.choosePackageEyebrow') }}</p>
        <h1 class="package-page-title">
          {{ t('billing.choosePackageLead') }}
          <span class="package-page-title-muted">{{ t('billing.choosePackageMuted') }}</span>
        </h1>
        <p class="package-page-subtitle">{{ t('billing.choosePackageSubtitle') }}</p>
      </header>

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
        v-model:cycle="cycle"
        :packages="packages || []"
        highlight-key="STANDARD"
        :disabled-keys="disabledKeys"
        :disabled-reason="t('billing.osnovniDisabledForOnlineBooking')"
        class="package-page-cards"
      >
        <template #cta="{ pkg }">
          <button type="button" class="package-cta-btn" @click="goToCheckout(pkg)">
            {{ t('billing.selectPackage') }}
          </button>
        </template>
      </PackagePricingCards>

      <!-- Ticket §4 — which listing this purchase is for. -->
      <p v-if="listing?.title" class="package-page-context">
        {{ t('billing.packageForListing') }} <strong>{{ listing.title }}</strong>
      </p>
    </div>
  </div>
</template>

<script setup>
// Dizajn 13 (Figma "Izaberite paket · Desktop 1440", node 563:514) — the same
// offer as Cenovnik, so the same PackagePricingCards; only the framing around
// it (back button, "korak pre objave" heading, listing context) is this page's.
definePageMeta({ middleware: 'auth' })
const { t } = useI18n()
const api = useApi()
const route = useRoute()

const { data: packages } = await useAsyncData('packages', () => api.get('/packages'))
const { data: listing } = await useAsyncData(`listing-${route.params.id}`, () => api.get(`/listings/${route.params.id}`))
const cycle = ref('MONTHLY')

// DODATNA LOGIKA za pakete — Osnovni (paketi bez rezervacionog sistema) nije
// dostupan za oglase koji koriste online rezervacije (PER_STAY/PER_SLOT).
const disabledKeys = computed(() => {
  if (!listing.value || listing.value.bookingModel === 'NO_BOOKING') return []
  return (packages.value || []).filter((p) => !p.hasBookings).map((p) => p.key)
})

// T42 — an active PRO subscription with fewer listings than its limit has a
// free slot. Only offered for a listing that isn't on a package yet — the
// same condition the wizard and Pretplate already use.
const { data: mySubscriptions } = await useAsyncData('my-subscriptions-for-package', () =>
  api.get('/subscriptions/mine').catch(() => []),
)
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
    query: { packageId: pkg.id, billingCycle: cycle.value },
  })
}

useSeoMeta({ title: t('billing.choosePackage') })
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
