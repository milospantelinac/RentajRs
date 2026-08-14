<template>
  <div class="pricing-page">
    <section class="pricing-hero">
      <div class="container text-center">
        <h1 class="text-page-title mb-2">{{ t('pricing.title') }}</h1>
        <p class="text-body pricing-subtitle">{{ t('pricing.subtitle') }}</p>

        <div class="form-row-inline pricing-toggle">
          <button class="btn btn-sm" :class="cycle === 'MONTHLY' ? 'btn-primary-flat' : 'btn-tertiary'" @click="cycle = 'MONTHLY'">
            {{ t('billing.monthly') }}
          </button>
          <button class="btn btn-sm" :class="cycle === 'YEARLY' ? 'btn-primary-flat' : 'btn-tertiary'" @click="cycle = 'YEARLY'">
            {{ t('billing.yearly') }}
          </button>
        </div>
      </div>
    </section>

    <section class="container pricing-cards">
      <div class="row">
        <div v-for="pkg in packages" :key="pkg.id" class="col-12 col-md-4 mb-4">
          <div class="card package-card" :class="{ 'package-card-highlight': pkg.key === 'STANDARD' }">
            <div class="card-body">
              <h2 class="text-section-title mb-2">{{ pkg.key }}</h2>
              <p class="text-page-title mb-1">
                {{ formatPrice(cycle === 'YEARLY' ? pkg.priceYearly : pkg.priceMonthly) }}
                <span class="text-muted text-body">/ {{ cycle === 'YEARLY' ? t('billing.year') : t('billing.month') }}</span>
              </p>
              <ul class="package-features">
                <li>{{ t('billing.featureListings', { count: pkg.listingLimit }) }}</li>
                <li :class="pkg.hasBookings ? '' : 'package-feature-off'">{{ t('billing.featureBookings') }}</li>
                <li :class="pkg.hasMessaging ? '' : 'package-feature-off'">{{ t('billing.featureMessaging') }}</li>
                <li :class="pkg.hasReviews ? '' : 'package-feature-off'">{{ t('billing.featureReviews') }}</li>
                <li :class="pkg.hasIcal ? '' : 'package-feature-off'">{{ t('billing.featureIcal') }}</li>
              </ul>
              <NuxtLink to="/oglasi/novi" class="btn btn-primary-flat btn-block">{{ t('pricing.getStarted') }}</NuxtLink>
            </div>
          </div>
        </div>
      </div>
      <p class="text-muted text-center pricing-note">{{ t('pricing.noCommission') }}</p>
    </section>
  </div>
</template>

<script setup>
const { t } = useI18n()
const api = useApi()

const { data: packages } = await useAsyncData('pricing-packages', () => api.get('/packages'))
const cycle = ref('MONTHLY')

function formatPrice(value) {
  return `${new Intl.NumberFormat('sr-RS').format(value || 0)} RSD`
}

useSeoMeta({ title: t('pricing.title'), description: t('pricing.subtitle') })
</script>

<style lang="scss" scoped>
.pricing-hero {
  background: $color-background;
  padding: 56px 0 32px;
}

.pricing-subtitle {
  color: $color-text-muted;
  max-width: 560px;
  margin: 0 auto 24px;
}

.pricing-toggle {
  justify-content: center;
}

.pricing-cards {
  padding: 48px 0 64px;
}

.package-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.package-card-highlight {
  border-color: $color-primary;
  box-shadow: $shadow-card;
}

.package-features {
  list-style: none;
  padding: 0;
  margin: 16px 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.package-feature-off {
  color: $color-text-muted;
  text-decoration: line-through;
}

.pricing-note {
  margin-top: 16px;
}
</style>
