<template>
  <div class="container py-6 text-center">
    <h1 class="text-page-title mb-3">{{ t('billing.paymentFailedTitle') }}</h1>
    <p class="text-body mb-4">{{ renewId ? t('billing.renewPaymentFailedMessage') : t('billing.paymentFailedMessage') }}</p>
    <div class="form-row-inline justify-content-center">
      <NuxtLink :to="retryUrl" class="btn btn-primary-flat">{{ t('billing.tryAgain') }}</NuxtLink>
      <NuxtLink to="/kontrolna-tabla" class="btn btn-tertiary">{{ t('nav.dashboard') }}</NuxtLink>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ middleware: 'auth' })
const { t } = useI18n()
const route = useRoute()
// A declined renewal (SubscriptionsService.handleNestPayFail) keeps its package for the retry.
const renewId = typeof route.query.obnova === 'string' ? route.query.obnova : ''
const retryUrl = `/oglasi/${route.params.id}/paket${renewId ? `?obnova=${renewId}` : ''}`
useSeoMeta({ title: t('billing.paymentFailedTitle') })
</script>
