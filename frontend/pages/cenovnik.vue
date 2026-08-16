<template>
  <div class="pricing-page">
    <section class="pricing-hero">
      <div class="container text-center">
        <h1 class="text-page-title mb-2">{{ t('pricing.title') }}</h1>
        <p class="text-body pricing-subtitle">{{ t('pricing.subtitle') }}</p>
      </div>
    </section>

    <section class="container pricing-cards">
      <PackagePricingCards v-model:cycle="cycle" :packages="packages" highlight-key="STANDARD">
        <template #cta="{ pkg }">
          <NuxtLink to="/oglasi/novi" class="btn btn-primary-flat btn-block">{{ t('pricing.getStarted') }}</NuxtLink>
        </template>
      </PackagePricingCards>
      <p class="text-muted text-center pricing-note">{{ t('pricing.noCommission') }}</p>
    </section>
  </div>
</template>

<script setup>
const { t } = useI18n()
const api = useApi()

const { data: packages } = await useAsyncData('pricing-packages', () => api.get('/packages'))
const cycle = ref('MONTHLY')

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

.pricing-cards {
  padding: 48px 0 64px;
}

.pricing-note {
  margin-top: 16px;
}
</style>
