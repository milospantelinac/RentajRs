<template>
  <div class="subs">
    <DashboardPageHeader class="subs-header" :title="t('billing.mySubscriptions')" :subtitle="summary">
      <template #actions>
        <NuxtLink :to="buyPackageLink" class="subs-buy">{{ t('billing.buyPackage') }}</NuxtLink>
      </template>
    </DashboardPageHeader>

    <!-- Where the bank sends the owner back after a payment (SubscriptionsService). -->
    <p v-if="notice" class="subs-notice" :class="`is-${notice.tone}`" :role="notice.tone === 'success' ? 'status' : 'alert'">
      <template v-if="notice.key === 'upgraded'">{{ t('billing.upgradedBanner') }}</template>
      <template v-else>
        {{ t(`mySubscriptions.payment.${notice.key}`) }}
        {{ t(`mySubscriptions.payment.${notice.contact}Before`) }}<NuxtLink to="/kontakt" class="subs-notice-link">{{ t('mySubscriptions.payment.contactLink') }}</NuxtLink>{{ t(`mySubscriptions.payment.${notice.contact}After`) }}
      </template>
    </p>

    <!-- Dizajn 44: a failed load says so where the cards would be. -->
    <section v-if="error" class="subs-section">
      <div class="subs-state is-error">
        <DashboardNavIcon name="packages" class="subs-state-icon" />
        <p class="subs-state-title">{{ t('mySubscriptions.loadErrorTitle') }}</p>
        <p class="subs-state-text">{{ t('mySubscriptions.loadErrorText') }}</p>
        <button type="button" class="subs-state-button" @click="reload()">{{ t('errorPage.tryAgain') }}</button>
      </div>
    </section>

    <template v-else>
      <section class="subs-section" :aria-label="t('mySubscriptions.cardsLabel')">
        <p v-if="deleteError" class="subs-alert" role="alert">
          <img src="/images/icons/field-error.svg" alt="" width="16" height="16" />
          {{ deleteError }}
        </p>

        <div v-if="cards.length" class="subs-grid">
          <article v-for="card in cards" :key="card.id" class="subs-card" :class="{ 'is-danger': card.danger }" :aria-label="card.label">
            <div class="subs-card-head">
              <span class="subs-package">{{ card.packageKey }}</span>
              <span class="subs-pill" :class="`subs-pill-${card.status}`">{{ card.statusText }}</span>
              <span class="subs-price">{{ card.price }}</span>
            </div>

            <dl class="subs-facts">
              <div class="subs-fact">
                <dt class="subs-label">{{ card.listingsLabel }}</dt>
                <dd v-if="card.listings.length" class="subs-value subs-listings">
                  <NuxtLink v-for="listing in card.listings" :key="listing.id" :to="listing.url" class="subs-listing">{{ listing.text }}</NuxtLink>
                </dd>
                <dd v-else class="subs-value is-muted">{{ t('mySubscriptions.noListing') }}</dd>
              </div>

              <div v-if="card.usage" class="subs-fact">
                <dt class="subs-label">{{ t('mySubscriptions.usageLabel') }}</dt>
                <dd class="subs-value subs-usage">
                  <span class="subs-meter" aria-hidden="true"><span class="subs-meter-fill" :style="{ width: `${card.usage.percent}%` }" /></span>
                  <span>{{ t('mySubscriptions.usage', { used: card.usage.used, limit: card.usage.limit }) }}</span>
                </dd>
              </div>

              <div class="subs-fact">
                <dt class="subs-label">{{ t('mySubscriptions.durationLabel') }}</dt>
                <dd class="subs-value">{{ card.duration }}</dd>
              </div>

              <div v-if="card.end" class="subs-fact">
                <dt class="subs-label">{{ card.end.label }}</dt>
                <dd class="subs-value" :class="{ 'is-urgent': card.end.urgent }">{{ card.end.value }}</dd>
              </div>

              <div v-if="card.banked" class="subs-fact">
                <dt class="subs-label">{{ t('mySubscriptions.bankedLabel') }}</dt>
                <dd class="subs-value">{{ card.banked }}</dd>
              </div>

              <!-- T21: a checkout that never reached the bank can be cleared away. -->
              <div v-if="card.deletable" class="subs-fact">
                <dt class="subs-label">{{ t('mySubscriptions.unfinishedPayment') }}</dt>
                <dd class="subs-value">
                  <button type="button" class="subs-delete" :disabled="deletingId === card.id" @click="deleteAwaitingPayment(card.id)">
                    {{ t('common.delete') }}
                  </button>
                </dd>
              </div>
            </dl>

            <p v-if="card.warning" class="subs-warning">{{ card.warning }}</p>
          </article>
        </div>

        <div v-else class="subs-state">
          <DashboardNavIcon name="packages" class="subs-state-icon" />
          <p class="subs-state-title">{{ t('mySubscriptions.emptyTitle') }}</p>
          <p class="subs-state-text">{{ t('mySubscriptions.emptyText') }}</p>
          <NuxtLink :to="buyPackageLink" class="subs-state-button">{{ t('billing.buyPackage') }}</NuxtLink>
        </div>
      </section>

      <!-- ADR-005's banked-days transfer only ever fires from here or from an
           upgrade purchase: an ACTIVE listing has no other reachable path to a
           Pro package once it's already published. -->
      <section v-if="upgradeRows.length" class="subs-section" aria-labelledby="subs-upgrade-title">
        <div class="subs-upgrade-heading">
          <h2 id="subs-upgrade-title" class="subs-upgrade-title">{{ t('billing.upgradeSectionTitle') }}</h2>
          <p class="subs-upgrade-text">{{ t('billing.upgradeExplain') }}</p>
        </div>

        <p v-if="attachError" class="subs-alert" role="alert">
          <img src="/images/icons/field-error.svg" alt="" width="16" height="16" />
          {{ attachError }}
        </p>

        <ul class="subs-list">
          <li v-for="row in upgradeRows" :key="row.id" class="subs-row">
            <div class="subs-row-text">
              <p class="subs-row-title">{{ row.title }}</p>
              <p v-if="row.meta" class="subs-row-meta">{{ row.meta }}</p>
            </div>
            <div class="subs-row-actions">
              <button
                v-if="proSubscriptionWithRoom"
                type="button"
                class="subs-soft"
                :disabled="attachingId === row.id"
                @click="attachFree(row.id)"
              >
                {{ t('billing.attachFreeAction') }}
              </button>
              <NuxtLink :to="row.upgradeUrl" class="subs-soft">{{ t('billing.upgradeToProAction') }}</NuxtLink>
            </div>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<script setup>
// Dizajn 35 (frame 380:1219): the packages an owner pays for, one card each,
// and the live listings that can still move to Pro.
import {
  buildSubscriptionCard,
  buildUpgradeRow,
  formatSubscriptionsSummary,
  getPaymentNotice,
  selectShownSubscriptions,
  selectUpgradeableListings,
} from '~/utils/subscriptions'

definePageMeta({ middleware: 'auth', layout: 'dashboard' })
const { t } = useI18n()
const api = useApi()
const route = useRoute()

// Moji oglasi's rows name each listing's place and category, and say which ones are live.
const { data, error, refresh } = await useAsyncData('my-subscriptions-page', async () => {
  const [subscriptions, listings] = await Promise.all([api.get('/subscriptions/mine'), api.get('/listings/mine')])
  return { subscriptions, listings }
})
const subscriptions = computed(() => data.value?.subscriptions || [])
const listings = computed(() => data.value?.listings || [])
const listingsById = computed(() => new Map(listings.value.map((listing) => [listing.id, listing])))

// The server's clock decides which packages end this week, so hydration reads the same cards.
const now = useState('my-subscriptions-now', () => Date.now())
onMounted(() => {
  now.value = Date.now()
})

const cards = computed(() =>
  selectShownSubscriptions(subscriptions.value).map((subscription) => buildSubscriptionCard(t, subscription, listingsById.value, now.value)),
)
const summary = computed(() => formatSubscriptionsSummary(t, cards.value))
const upgradeRows = computed(() => selectUpgradeableListings(listings.value).map((listing) => buildUpgradeRow(t, listing)))
const notice = computed(() => getPaymentNotice(route.query))

// A package is always bought for one specific listing (ADR-004: subscription
// tied to the listing, not the account), and only while that listing is
// DRAFT/REJECTED (the only statuses /oglasi/:id/paket accepts). So "Buy a new
// package" has to resolve to a real listing, not a generic page: point it at
// the first one actually awaiting a package, or at "new listing" if none is.
const buyPackageLink = computed(() => {
  const waiting = listings.value.find((listing) => ['DRAFT', 'REJECTED'].includes(listing.status))
  return waiting ? `/oglasi/${waiting.id}/paket` : '/oglasi/novi'
})

// T42: an active Pro package with a free place takes another listing at no charge.
const proSubscriptionWithRoom = computed(() =>
  subscriptions.value.find(
    (s) => s.status === 'ACTIVE' && s.package?.key === 'PRO' && (s.listings?.length || 0) < (s.package?.listingLimit || 0),
  ),
)

async function reload() {
  await refresh()
  now.value = Date.now()
}

const attachingId = ref(null)
const attachError = ref('')
async function attachFree(listingId) {
  if (!proSubscriptionWithRoom.value) return
  if (!confirm(t('billing.attachFreeConfirm'))) return
  attachingId.value = listingId
  attachError.value = ''
  try {
    await api.post('/subscriptions/purchase', {
      listingId,
      existingSubscriptionId: proSubscriptionWithRoom.value.id,
    })
    await reload()
  } catch (e) {
    attachError.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    attachingId.value = null
  }
}

const deletingId = ref(null)
const deleteError = ref('')
async function deleteAwaitingPayment(id) {
  if (!confirm(t('billing.deleteAwaitingConfirm'))) return
  deletingId.value = id
  deleteError.value = ''
  try {
    await api.delete(`/subscriptions/${id}`)
    await reload()
  } catch (e) {
    deleteError.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    deletingId.value = null
  }
}

useSeoMeta({ title: t('billing.mySubscriptions') })
</script>

<style lang="scss" scoped>
// Dizajn 35, frame 380:1306: the title bar, the cards and the Pro list, 24
// apart. This frame's content column has none of the 4 / 8 padding 357:493
// gives the dashboard's; its two blocks carry their own (380:1313, 380:1386).
$subs-danger-stroke: #f43f5e;
$subs-danger-bg: #fcd8e0;
$subs-success-bg: #cdfad1;
$subs-success-text: #178c24;
$subs-success-note: #0f731f;
$subs-alert-bg: #fdeff1;

.subs {
  display: flex;
  flex-direction: column;
  gap: 24px;
  margin: -4px -8px 0;
}

.dash-page-header.subs-header {
  margin-bottom: 0;
}

// 380:1311: white on the page grey, no stroke.
.subs-buy {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  padding: 13px 22px;
  border-radius: $radius-button;
  background: $color-surface;
  font-size: 14px;
  font-weight: 500;
  line-height: normal;
  color: $color-text;
  white-space: nowrap;
}

.subs-buy:hover {
  color: $color-primary;
}

.subs-notice {
  margin: 0 8px;
  padding: 14px 16px;
  border-radius: $radius-input;
  font-size: 13px;
  font-weight: 400;
  line-height: 20px;
}

.subs-notice.is-success {
  background: $subs-success-bg;
  color: $subs-success-note;
}

.subs-notice.is-warning {
  background: $color-warning-bg;
  color: $color-warning;
}

.subs-notice.is-danger {
  background: $subs-alert-bg;
  color: $color-error;
}

.subs-notice-link {
  font-weight: 500;
  color: inherit;
  text-decoration: underline;
}

.subs-notice-link:hover {
  color: inherit;
  text-decoration: none;
}

// 380:1313, 380:1386
.subs-section {
  padding: 4px 8px 8px;
}

.subs-alert {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  padding: 12px 16px;
  border-radius: $radius-input;
  background: $subs-alert-bg;
  font-size: 13px;
  line-height: normal;
  color: $color-error;
}

// 380:1313: two 524 columns 8 apart, rows 20 apart, each card as tall as it needs.
.subs-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
  gap: 20px 8px;
}

// 380:1314. It clips, so the warning's fill follows the corners.
.subs-card {
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: $radius-card;
  background: $color-surface;
  box-shadow: $shadow-card;
}

// 380:1331: Figma's 1.5 stroke sits inside the card and over the warning, so it
// is drawn on top of the content rather than as a border that would move it.
.subs-card.is-danger::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow: inset 0 0 0 1.5px $subs-danger-stroke;
  pointer-events: none;
}

// 380:1315
.subs-card-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 22px;
}

// 380:1316
.subs-package {
  padding: 5px 10px;
  border-radius: 8px;
  background: $color-accent-tint;
  font-size: 11px;
  font-weight: 500;
  line-height: normal;
  letter-spacing: 0.5px;
  color: $color-primary;
  white-space: nowrap;
}

// 380:1318
.subs-pill {
  padding: 5px 10px;
  border-radius: $radius-pill;
  font-size: 11px;
  font-weight: 500;
  line-height: normal;
  white-space: nowrap;
}

.subs-pill-ACTIVE {
  background: $subs-success-bg;
  color: $subs-success-text;
}

.subs-pill-PENDING_ACTIVATION {
  background: $color-warning-bg;
  color: $color-warning;
}

.subs-pill-AWAITING_PAYMENT {
  background: $color-background;
  color: $color-text-muted;
}

.subs-pill-EXPIRED {
  background: $subs-alert-bg;
  color: $color-error;
}

// 380:1321, after the spacer.
.subs-price {
  margin-left: auto;
  font-size: 15px;
  font-weight: 500;
  line-height: normal;
  color: $color-text;
  white-space: nowrap;
}

.subs-facts {
  margin: 0;
}

// 380:1322: 40 tall with the 1px line inside, as the Figma stroke is.
.subs-fact {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 11px 22px 12px;
  border-top: 1px solid $color-border;
  font-size: 13px;
  line-height: normal;
}

.subs-label {
  flex-shrink: 0;
  font-weight: 300;
  color: $color-text-muted;
}

.subs-value {
  min-width: 0;
  margin: 0;
  font-weight: 500;
  color: $color-text;
  text-align: right;
  overflow-wrap: anywhere;
}

// 380:1347
.subs-value.is-urgent {
  color: $color-error;
}

.subs-value.is-muted {
  font-weight: 300;
  color: $color-text-muted;
}

.subs-listings {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.subs-listing {
  color: $color-text;
}

.subs-listing:hover {
  color: $color-primary;
  text-decoration: underline;
}

// Room for 2 of 4 listings: the brand fill on the line colour.
.subs-usage {
  display: flex;
  align-items: center;
  gap: 10px;
  white-space: nowrap;
}

.subs-meter {
  display: block;
  width: 96px;
  height: 6px;
  overflow: hidden;
  border-radius: $radius-pill;
  background: $color-border;
}

.subs-meter-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: $color-primary;
}

.subs-delete {
  padding: 0;
  border: 0;
  background: none;
  font-family: $font-family-base;
  font-size: 13px;
  font-weight: 500;
  line-height: normal;
  color: $color-error;
  cursor: pointer;
}

.subs-delete:hover:not(:disabled) {
  text-decoration: underline;
}

.subs-delete:disabled {
  opacity: 0.5;
  cursor: default;
}

// 380:1348
.subs-warning {
  padding: 12px 22px 14px;
  background: $subs-danger-bg;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  color: $color-error;
}

// 380:1387
.subs-upgrade-heading {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 14px;
}

.subs-upgrade-title {
  font-size: 20px;
  font-weight: 400;
  line-height: 28px;
  letter-spacing: -0.4px;
  color: $color-text;
}

.subs-upgrade-text {
  font-size: 13px;
  font-weight: 300;
  line-height: 20px;
  color: $color-text-muted;
}

// 380:1390
.subs-list {
  margin: 0;
  padding: 0;
  list-style: none;
  border-radius: $radius-card;
  background: $color-surface;
  box-shadow:
    0 6px 20px rgba(97, 115, 133, 0.08),
    0 1px 3px rgba(97, 115, 133, 0.05);
}

// 380:1391, and 380:1397 with the 1px line inside. When the buttons don't fit
// beside the name they go under it.
.subs-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 16px;
  padding: 14px 22px;
}

.subs-row + .subs-row {
  padding-top: 13px;
  border-top: 1px solid $color-border;
}

.subs-row-text {
  display: flex;
  flex: 1 1 240px;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  overflow-wrap: anywhere;
}

.subs-row-title {
  font-size: 15px;
  font-weight: 500;
  line-height: normal;
  color: $color-text;
}

.subs-row-meta {
  font-size: 12px;
  font-weight: 300;
  line-height: normal;
  color: $color-text-muted;
}

.subs-row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

// 380:1395. The frame draws no hover; the outline is the one Dizajn 18's options use.
.subs-soft {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 11px 18px;
  border: 0;
  border-radius: $radius-button;
  background: $color-accent-tint;
  font-family: $font-family-base;
  font-size: 13px;
  font-weight: 500;
  line-height: normal;
  color: $color-primary;
  white-space: nowrap;
  cursor: pointer;
  transition: box-shadow 0.15s ease;
}

.subs-soft:hover {
  box-shadow: inset 0 0 0 1px $color-primary;
  color: $color-primary;
}

.subs-soft:disabled {
  opacity: 0.5;
  cursor: default;
}

// Dizajn 44: an icon, a title, one sentence and one button, in a card where the cards would be.
.subs-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 24px;
  border-radius: $radius-card;
  background: $color-surface;
  box-shadow: $shadow-card;
  text-align: center;
}

.subs-state-icon {
  width: 48px;
  height: 48px;
  margin-bottom: 12px;
  color: $color-text-muted;
}

.subs-state-title {
  font-size: 17px;
  font-weight: 500;
  line-height: normal;
  color: $color-text;
}

.subs-state-text {
  max-width: 420px;
  margin-top: 4px;
  font-size: 13px;
  font-weight: 300;
  line-height: normal;
  color: $color-text-muted;
}

.subs-state.is-error .subs-state-icon,
.subs-state.is-error .subs-state-title {
  color: $color-error;
}

// 357:503, the dashboard's grey button.
.subs-state-button {
  display: inline-flex;
  align-items: center;
  margin-top: 16px;
  padding: 11px 20px;
  border: 0;
  border-radius: $radius-button;
  background: $color-background;
  font-family: $font-family-base;
  font-size: 13px;
  font-weight: 500;
  line-height: normal;
  color: $color-text;
  white-space: nowrap;
  cursor: pointer;
}

.subs-state-button:hover {
  color: $color-primary;
}

// Below xl a card needs the whole column for its label and listing name.
@include respond-below(xl) {
  .subs-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@include mobile-only {
  .subs {
    margin: 0;
  }

  .subs-section {
    padding: 0;
  }

  .subs-notice {
    margin: 0;
  }

  .subs-card-head,
  .subs-fact {
    padding-right: 16px;
    padding-left: 16px;
  }

  .subs-warning {
    padding: 12px 16px 14px;
  }

  // A phone always puts the buttons under the listing's name.
  .subs-row {
    padding: 14px 16px;
  }

  .subs-row + .subs-row {
    padding-top: 13px;
  }

  .subs-row-text {
    flex-basis: 100%;
  }

  .subs-state {
    padding: 32px 16px;
  }
}
</style>
