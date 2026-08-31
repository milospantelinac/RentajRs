<template>
  <div v-if="dashboard">
    <h1 class="text-page-title mb-1">{{ t('dashboard.greeting', { name: auth.user?.firstName }) }}</h1>
    <p class="text-muted mb-4">
      {{ dashboard.attentionItems.length ? thingsWaitingText : t('dashboard.allCaughtUp') }}
    </p>

    <section v-if="dashboard.attentionItems.length" class="mb-4">
      <div
        v-for="(item, i) in dashboard.attentionItems"
        :key="i"
        class="attention-card mb-2"
        :class="`attention-card-${item.urgency === 'critical' ? 'critical' : item.urgency === 'decision' ? 'decision' : 'info'}`"
      >
        <span class="text-body">{{ attentionText(item) }}</span>
        <NuxtLink :to="item.actionUrl" class="btn btn-tertiary btn-sm">{{ t('common.continue') }}</NuxtLink>
      </div>
    </section>

    <section v-if="dashboard.onboarding && !dashboard.onboarding.allDone" class="card mb-4">
      <div class="card-body">
        <h2 class="text-section-title mb-3">{{ t('dashboard.onboardingTitle') }}</h2>
        <ul class="onboarding-list">
          <li :class="dashboard.onboarding.hasListing ? 'onboarding-done' : ''">
            {{ dashboard.onboarding.hasListing ? '✓' : '○' }} {{ t('dashboard.onboardingListing') }}
          </li>
          <li :class="dashboard.onboarding.hasAvailability ? 'onboarding-done' : ''">
            {{ dashboard.onboarding.hasAvailability ? '✓' : '○' }} {{ t('dashboard.onboardingAvailability') }}
          </li>
          <li :class="dashboard.onboarding.hasIcal ? 'onboarding-done' : ''">
            {{ dashboard.onboarding.hasIcal ? '✓' : '○' }} {{ t('dashboard.onboardingIcal') }}
          </li>
          <li :class="dashboard.onboarding.hasBankAccount ? 'onboarding-done' : ''">
            {{ dashboard.onboarding.hasBankAccount ? '✓' : '○' }} {{ t('dashboard.onboardingBankAccount') }}
          </li>
        </ul>
      </div>
    </section>

    <!-- T97 — the numbers alone didn't say what they counted: "Rezervacija
         3" while the list below had 7 rows (this only counts CONFIRMED +
         COMPLETED), "Vrednost" with no hint of the period or whether it's
         money received vs. still expected. Every card now explains itself. -->
    <section class="row mb-4">
      <div class="col-6 col-md-3 mb-3">
        <div class="card" :title="t('dashboard.listingsExplanation')">
          <div class="card-body-sm"><p class="text-muted">{{ t('dashboard.listings') }}</p><p class="text-page-title">{{ dashboard.stats.listingCount }}</p></div>
        </div>
      </div>
      <div class="col-6 col-md-3 mb-3">
        <div class="card" :title="t('dashboard.bookingsExplanation')">
          <div class="card-body-sm"><p class="text-muted">{{ t('dashboard.bookings') }}</p><p class="text-page-title">{{ dashboard.stats.bookingCount }}</p></div>
        </div>
      </div>
      <div class="col-6 col-md-3 mb-3">
        <div class="card" :title="t('dashboard.valueExplanation')">
          <div class="card-body-sm"><p class="text-muted">{{ t('dashboard.value') }}</p><p class="text-page-title">{{ formatPrice(dashboard.stats.confirmedValue) }}</p></div>
        </div>
      </div>
      <div class="col-6 col-md-3 mb-3">
        <div class="card" :title="t('dashboard.ratingExplanation')">
          <div class="card-body-sm"><p class="text-muted">{{ t('dashboard.rating') }}</p><p class="text-page-title">{{ dashboard.stats.avgRating ? dashboard.stats.avgRating.toFixed(1) : '—' }}</p></div>
        </div>
      </div>
    </section>

    <section>
      <h2 class="text-section-title mb-3">{{ t('dashboard.upcoming') }}</h2>
      <p v-if="!dashboard.upcomingBookings.length" class="text-muted">{{ t('dashboard.noUpcoming') }}</p>
      <div v-for="b in dashboard.upcomingBookings" :key="b.id" class="card mb-2">
        <div class="card-body-sm upcoming-row">
          <span>{{ new Date(b.startsAt).toLocaleDateString('sr-RS') }}</span>
          <span>{{ b.listing.title }}</span>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
definePageMeta({ middleware: 'auth', layout: 'dashboard' })
const { t, te } = useI18n()
const api = useApi()
const auth = useAuthStore()

const { data: dashboard } = await useAsyncData('dashboard', () => api.get('/dashboard'))

const thingsWaitingText = computed(() => {
  const count = dashboard.value.attentionItems.length
  return t(`dashboard.thingsWaiting${srPluralCategory(count)}`, { count })
})

// T85 — most attention item titles carry a count and need a plural form per
// count (attention.new_requestsOne/Few/Many); a few are fixed phrases with no
// real plural (attention.term_conflict) and just keep their single key.
function attentionText(item) {
  const pluralKey = `attention.${item.title}${srPluralCategory(item.count)}`
  const key = te(pluralKey) ? pluralKey : `attention.${item.title}`
  return t(key, { count: item.count })
}

function formatPrice(value) {
  return `${new Intl.NumberFormat('sr-RS').format(value || 0)} RSD`
}

useSeoMeta({ title: t('dashboard.overview') })
</script>

<style lang="scss" scoped>
.onboarding-list {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.onboarding-done {
  color: $color-success;
}

.upcoming-row {
  display: flex;
  justify-content: space-between;
}
</style>
