<template>
  <div>
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h1 class="text-page-title">{{ t('billing.mySubscriptions') }}</h1>
      <NuxtLink :to="buyPackageLink" class="btn btn-tertiary">{{ t('billing.buyPackage') }}</NuxtLink>
    </div>

    <div v-if="showUpgradedBanner" class="upgraded-banner mb-4">{{ t('billing.upgradedBanner') }}</div>

    <p v-if="!subscriptions?.length" class="text-muted">{{ t('billing.noSubscriptions') }}</p>

    <!-- ADR-005's banked-days transfer only ever fires from here or from an
         upgrade purchase — an ACTIVE listing has no other reachable path to
         a Pro package once it's already published. -->
    <div v-if="upgradeableListings.length" class="mb-5">
      <h2 class="text-section-title mb-2">{{ t('billing.upgradeSectionTitle') }}</h2>
      <p class="text-muted mb-3">{{ t('billing.upgradeExplain') }}</p>
      <div v-for="listing in upgradeableListings" :key="listing.id" class="card mb-2">
        <div class="card-body d-flex justify-content-between align-items-center flex-wrap upgrade-row">
          <span class="text-body">{{ listing.title }}</span>
          <div class="upgrade-actions">
            <button
              v-if="proSubscriptionWithRoom"
              class="btn btn-tertiary btn-sm"
              :disabled="attachingId === listing.id"
              @click="attachFree(listing.id)"
            >
              {{ t('billing.attachFreeAction') }}
            </button>
            <NuxtLink :to="`/oglasi/${listing.id}/paket`" class="btn btn-primary-flat btn-sm">
              {{ t('billing.upgradeToProAction') }}
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>

    <div v-for="sub in subscriptions" :key="sub.id" class="card mb-3">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h2 class="text-section-title">{{ sub.package?.name || sub.package?.key }}</h2>
          <span class="badge" :class="statusBadge(sub.status)">{{ t(`billing.status${statusLabel(sub.status)}`) }}</span>
        </div>

        <div class="row mb-2">
          <div class="col-6 text-muted">{{ sub.billingCycle === 'YEARLY' ? t('billing.yearly') : t('billing.monthly') }}</div>
          <div class="col-6">{{ formatPrice(sub.priceAtPurchase) }}</div>
        </div>
        <div v-if="sub.expiresAt" class="row mb-2">
          <div class="col-6 text-muted">{{ t('billing.expiresOn') }}</div>
          <div class="col-6">{{ new Date(sub.expiresAt).toLocaleDateString('sr-RS') }}</div>
        </div>
        <p class="text-muted mb-2">{{ sub.autoRenew ? t('billing.autoRenewOn') : t('billing.autoRenewOff') }}</p>

        <p v-if="sub.bankedDays?.length" class="text-muted mb-2">
          {{ t('billing.bankedDaysCount', { count: sub.bankedDays.reduce((s, b) => s + b.days, 0) }) }}
        </p>

        <div v-if="sub.listings?.length" class="mb-2">
          <p class="text-label mb-1">{{ t('billing.coveredListings') }}</p>
          <ul class="covered-listings">
            <li v-for="l in sub.listings" :key="l.id">
              <NuxtLink :to="`/oglasi/${l.slug}`">{{ l.title }}</NuxtLink>
            </li>
          </ul>
        </div>

        <button
          v-if="sub.status === 'ACTIVE' && sub.autoRenew"
          class="btn btn-danger btn-sm"
          @click="cancel(sub.id)"
        >
          {{ t('billing.cancelSubscription') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ middleware: 'auth', layout: 'dashboard' })
const { t } = useI18n()
const api = useApi()
const route = useRoute()

const { data: subscriptions, refresh } = await useAsyncData('my-subscriptions', () => api.get('/subscriptions/mine'))

// A package is always bought for one specific listing (ADR-004 — subscription
// tied to the listing, not the account), and only while that listing is
// DRAFT/REJECTED (the only statuses /oglasi/:id/paket accepts). So "Buy a new
// package" has to resolve to a real listing, not a generic page — point it at
// the first one actually awaiting a package, or at "new listing" if none is.
const { data: listings, refresh: refreshListings } = await useAsyncData('my-listings-for-billing', () => api.get('/listings/mine'))
const listingAwaitingPackage = computed(() => listings.value?.find((l) => ['DRAFT', 'REJECTED'].includes(l.status)))
const buyPackageLink = computed(() =>
  listingAwaitingPackage.value ? `/oglasi/${listingAwaitingPackage.value.id}/paket` : '/oglasi/novi',
)

const showUpgradedBanner = computed(() => route.query.upgraded === '1')

// Which package each already-published listing currently sits on — /listings/mine
// doesn't carry that, so it's derived from the subscriptions we already fetched.
const packageKeyByListingId = computed(() => {
  const map = new Map()
  for (const sub of subscriptions.value || []) {
    for (const listing of sub.listings || []) {
      map.set(listing.id, sub.package?.key)
    }
  }
  return map
})

// ADR-005: an ACTIVE listing not yet on Pro has no other reachable route to
// one — this section is that route (see billing.upgradeSectionTitle).
const upgradeableListings = computed(() =>
  (listings.value || []).filter((l) => l.status === 'ACTIVE' && packageKeyByListingId.value.get(l.id) !== 'PRO'),
)

const proSubscriptionWithRoom = computed(() =>
  (subscriptions.value || []).find(
    (s) => s.status === 'ACTIVE' && s.package?.key === 'PRO' && (s.listings?.length || 0) < (s.package?.listingLimit || 0),
  ),
)

const attachingId = ref(null)
async function attachFree(listingId) {
  if (!proSubscriptionWithRoom.value) return
  if (!confirm(t('billing.attachFreeConfirm'))) return
  attachingId.value = listingId
  try {
    await api.post('/subscriptions/purchase', {
      listingId,
      existingSubscriptionId: proSubscriptionWithRoom.value.id,
    })
    await Promise.all([refresh(), refreshListings()])
  } finally {
    attachingId.value = null
  }
}

function formatPrice(value) {
  return `${new Intl.NumberFormat('sr-RS').format(value || 0)} RSD`
}

function statusLabel(status) {
  const map = {
    AWAITING_PAYMENT: 'AwaitingPayment', PENDING_ACTIVATION: 'PendingActivation', ACTIVE: 'Active', GRACE: 'Grace',
    EXPIRED: 'Expired', CANCELLED: 'Cancelled',
  }
  return map[status] || 'Active'
}
function statusBadge(status) {
  const map = {
    AWAITING_PAYMENT: 'badge-neutral', PENDING_ACTIVATION: 'badge-warning', ACTIVE: 'badge-success', GRACE: 'badge-warning',
    EXPIRED: 'badge-critical', CANCELLED: 'badge-neutral',
  }
  return map[status] || 'badge-neutral'
}

async function cancel(id) {
  if (!confirm(t('billing.cancelConfirm'))) return
  await api.post(`/subscriptions/${id}/cancel`, {})
  await refresh()
}

useSeoMeta({ title: t('billing.mySubscriptions') })
</script>

<style lang="scss" scoped>
.covered-listings {
  margin: 0;
  padding-left: 20px;
}

.upgraded-banner {
  padding: 12px 16px;
  border-radius: $radius-card;
  background: rgba($color-success, 0.1);
  border: 1px solid rgba($color-success, 0.35);
  color: $color-success;
  font-size: $font-size-body;
}

.upgrade-row {
  gap: 12px;
}

.upgrade-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
