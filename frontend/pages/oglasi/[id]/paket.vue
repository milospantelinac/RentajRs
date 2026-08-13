<template>
  <div class="container package-page py-4">
    <h1 class="text-page-title mb-4">{{ t('billing.choosePackage') }}</h1>

    <div class="form-row-inline mb-4">
      <button class="btn btn-sm" :class="cycle === 'MONTHLY' ? 'btn-primary-flat' : 'btn-tertiary'" @click="cycle = 'MONTHLY'">
        {{ t('billing.monthly') }}
      </button>
      <button class="btn btn-sm" :class="cycle === 'YEARLY' ? 'btn-primary-flat' : 'btn-tertiary'" @click="cycle = 'YEARLY'">
        {{ t('billing.yearly') }}
      </button>
    </div>

    <div class="row">
      <div v-for="pkg in packages" :key="pkg.id" class="col-12 col-md-4 mb-4">
        <div class="card package-card">
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
            <button class="btn btn-primary-flat btn-block" :disabled="purchasing" @click="purchase(pkg)">
              {{ t('billing.selectPackage') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <p v-if="error" class="form-error">{{ error }}</p>
  </div>
</template>

<script setup>
definePageMeta({ middleware: 'auth' })
const { t } = useI18n()
const api = useApi()
const route = useRoute()

const { data: packages } = await useAsyncData('packages', () => api.get('/packages'))
const cycle = ref('MONTHLY')
const purchasing = ref(false)
const error = ref('')

function formatPrice(value) {
  return `${new Intl.NumberFormat('sr-RS').format(value || 0)} RSD`
}

async function purchase(pkg) {
  error.value = ''
  purchasing.value = true
  try {
    await api.post('/subscriptions/purchase', {
      listingId: route.params.id,
      packageId: pkg.id,
      billingCycle: cycle.value,
    })
    await navigateTo(`/oglasi/${route.params.id}/poslato`)
  } catch (e) {
    error.value = e?.data?.message?.[0] || e?.data?.message || t('auth.genericError')
  } finally {
    purchasing.value = false
  }
}

useSeoMeta({ title: t('billing.choosePackage') })
</script>

<style lang="scss" scoped>
.package-page {
  padding: 32px 0 64px;
}

.package-card {
  height: 100%;
  display: flex;
  flex-direction: column;
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
</style>
