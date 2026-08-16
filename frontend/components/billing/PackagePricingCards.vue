<template>
  <div>
    <div class="form-row-inline pricing-toggle mb-4">
      <button class="btn btn-sm" :class="cycle === 'MONTHLY' ? 'btn-primary-flat' : 'btn-tertiary'" @click="$emit('update:cycle', 'MONTHLY')">
        {{ t('billing.monthly') }}
      </button>
      <button class="btn btn-sm" :class="cycle === 'YEARLY' ? 'btn-primary-flat' : 'btn-tertiary'" @click="$emit('update:cycle', 'YEARLY')">
        {{ t('billing.yearly') }}
      </button>
    </div>

    <div class="row">
      <div v-for="pkg in packages" :key="pkg.id" class="col-12 col-md-4 mb-4">
        <div class="card package-card" :class="{ 'package-card-highlight': pkg.key === highlightKey }">
          <div class="card-body">
            <h2 class="text-section-title mb-2">{{ pkg.key }}</h2>
            <p class="text-page-title mb-1">
              {{ formatPrice(cycle === 'YEARLY' ? pkg.priceYearly : pkg.priceMonthly) }}
              <span class="text-muted text-body">/ {{ cycle === 'YEARLY' ? t('billing.year') : t('billing.month') }}</span>
            </p>
            <p v-if="cycle === 'YEARLY' && yearlySavings(pkg) > 0" class="package-savings">
              {{ t('billing.yearlySavings', { amount: formatPrice(yearlySavings(pkg)) }) }}
            </p>
            <ul class="package-features">
              <li>{{ t('billing.featureListings', { count: pkg.listingLimit }) }}</li>
              <li :class="pkg.hasBookings ? '' : 'package-feature-off'">{{ t('billing.featureBookings') }}</li>
              <li :class="pkg.hasMessaging ? '' : 'package-feature-off'">{{ t('billing.featureMessaging') }}</li>
              <li :class="pkg.hasReviews ? '' : 'package-feature-off'">{{ t('billing.featureReviews') }}</li>
              <li :class="pkg.hasIcal ? '' : 'package-feature-off'">{{ t('billing.featureIcal') }}</li>
            </ul>
            <slot name="cta" :pkg="pkg" />
          </div>
        </div>
      </div>
    </div>

    <p class="text-muted text-center pricing-vat-note">{{ t('billing.notVatRegistered') }}</p>
  </div>
</template>

<script setup>
// RNT-041 — the owner asked for /cenovnik and /oglasi/{id}/paket to show
// identical package info; this is the one place that logic lives now so
// the two pages can't drift apart again the way they did before.
defineProps({
  packages: { type: Array, required: true },
  cycle: { type: String, required: true },
  highlightKey: { type: String, default: null },
})
defineEmits(['update:cycle'])

const { t } = useI18n()

function formatPrice(value) {
  return `${new Intl.NumberFormat('sr-RS').format(value || 0)} RSD`
}

function yearlySavings(pkg) {
  return pkg.priceMonthly * 12 - pkg.priceYearly
}
</script>

<style lang="scss" scoped>
.pricing-toggle {
  justify-content: center;
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

.package-savings {
  color: $color-success;
  font-size: $font-size-label;
  font-weight: 600;
  margin-bottom: 8px;
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

.pricing-vat-note {
  margin-top: 8px;
}
</style>
