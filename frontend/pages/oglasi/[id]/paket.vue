<template>
  <div class="container package-page py-4">
    <h1 class="text-page-title mb-4">{{ t('billing.choosePackage') }}</h1>

    <PackagePricingCards
      v-model:cycle="cycle"
      :packages="packages"
      :disabled-keys="disabledKeys"
      :disabled-reason="t('billing.osnovniDisabledForOnlineBooking')"
    >
      <template #cta="{ pkg }">
        <button class="btn btn-primary-flat btn-block" @click="goToCheckout(pkg)">
          {{ t('billing.selectPackage') }}
        </button>
      </template>
    </PackagePricingCards>
  </div>
</template>

<script setup>
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

function goToCheckout(pkg) {
  navigateTo({
    path: `/oglasi/${route.params.id}/checkout`,
    query: { packageId: pkg.id, billingCycle: cycle.value },
  })
}

useSeoMeta({ title: t('billing.choosePackage') })
</script>

<style lang="scss" scoped>
.package-page {
  padding: 32px 0 64px;
}
</style>
