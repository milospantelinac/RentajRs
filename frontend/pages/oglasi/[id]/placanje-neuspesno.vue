<template>
  <div class="container py-6 text-center">
    <h1 class="text-page-title mb-3">{{ t('billing.paymentFailedTitle') }}</h1>
    <p class="text-body mb-4">{{ t('billing.paymentFailedMessage') }}</p>
    <div class="form-row-inline justify-content-center">
      <NuxtLink :to="`/oglasi/${route.params.id}/paket`" class="btn btn-primary-flat">{{ t('billing.tryAgain') }}</NuxtLink>
      <NuxtLink to="/kontrolna-tabla" class="btn btn-tertiary">{{ t('nav.dashboard') }}</NuxtLink>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ middleware: 'auth' })
const { t } = useI18n()
const route = useRoute()
useSeoMeta({ title: t('billing.paymentFailedTitle') })
</script>
