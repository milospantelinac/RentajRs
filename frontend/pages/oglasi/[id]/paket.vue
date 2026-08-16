<template>
  <div class="container package-page py-4">
    <h1 class="text-page-title mb-4">{{ t('billing.choosePackage') }}</h1>

    <PackagePricingCards v-model:cycle="cycle" :packages="packages">
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
const cycle = ref('MONTHLY')

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
