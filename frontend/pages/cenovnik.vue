<template>
  <div class="pricing-page">
    <div class="container">
      <header class="pricing-hero">
        <p class="pricing-eyebrow">{{ t('pricing.eyebrow') }}</p>
        <h1 class="pricing-title">
          {{ t('pricing.titleLead') }}
          <span class="pricing-title-muted">{{ t('pricing.titleMuted') }}</span>
        </h1>
        <p class="pricing-subtitle">{{ t('pricing.subtitle') }}</p>
      </header>

      <PackagePricingCards v-model:cycle="cycle" :packages="packages || []" highlight-key="STANDARD" class="pricing-packages">
        <template #after-toggle>
          <span class="pricing-yearly-note">{{ t('pricing.yearlyNote') }}</span>
        </template>
        <template #cta>
          <NuxtLink to="/oglasi/novi" class="package-cta-btn">{{ t('pricing.getStarted') }}</NuxtLink>
        </template>
      </PackagePricingCards>

      <section class="pricing-secure">
        <p class="pricing-secure-title">
          <img src="/images/icons/shield-check.svg" alt="" class="pricing-secure-icon" />
          {{ t('pricing.securePaymentTitle') }}
        </p>
        <p class="pricing-secure-text">{{ t('pricing.securePaymentText') }}</p>
      </section>
    </div>
  </div>
</template>

<script setup>
// Dizajn 12 (Figma "Cenovnik · Desktop 1440", node 199:287). Package names,
// prices, feature lists and the monthly/yearly switch all come from the shared
// PackagePricingCards + /packages, unchanged — this page only frames them.
const { t } = useI18n()
const api = useApi()

const { data: packages } = await useAsyncData('pricing-packages', () => api.get('/packages'))
const cycle = ref('MONTHLY')

useSeoMeta({ title: t('pricing.title'), description: t('pricing.subtitle') })
</script>

<style lang="scss" scoped>
// Figma 199:318 — eyebrow, title, subtitle stacked 20 apart, centred.
.pricing-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding-top: 72px;
  text-align: center;
}

.pricing-eyebrow {
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  color: $color-primary;
}

.pricing-title {
  font-size: 52px;
  font-weight: 400;
  line-height: 58px;
  letter-spacing: -1.82px;
  color: $color-text;
}

.pricing-title-muted {
  color: $color-text-muted;
}

.pricing-subtitle {
  max-width: 760px;
  font-size: 18px;
  line-height: 28px;
  color: $color-text-muted;
}

// Toggle sits 34px under the subtitle: the hero's 20px gap plus the Period
// frame's own 14px top padding in Figma.
.pricing-packages {
  margin-top: 34px;
}

.pricing-yearly-note {
  display: inline-flex;
  padding: 7px 14px;
  border-radius: $radius-pill;
  background: $color-accent-tint;
  color: $color-primary;
  font-size: 14px;
  font-weight: 500;
}

// Figma 202:384 — 64 above, 96 below, a #F9FAFD band with the copy centred.
.pricing-secure {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 22px;
  margin: 64px 0 96px;
  padding: 32px 36px 34px;
  border-radius: $radius-card;
  background: $color-background;
  text-align: center;
}

.pricing-secure-title {
  display: flex;
  align-items: center;
  gap: 11px;
  font-size: 18px;
  font-weight: 500;
  color: $color-text;
}

.pricing-secure-icon {
  width: 20px;
  height: 20px;
}

.pricing-secure-text {
  max-width: 720px;
  font-size: 15px;
  line-height: 24px;
  color: $color-text-muted;
}

@include respond-below(md) {
  .pricing-hero {
    padding-top: 40px;
  }

  .pricing-title {
    font-size: 34px;
    line-height: 40px;
    letter-spacing: -1px;
  }

  .pricing-subtitle {
    font-size: 16px;
    line-height: 25px;
  }

  .pricing-secure {
    margin: 48px 0 64px;
    padding: 24px 20px;
  }
}
</style>
