<template>
  <div class="container py-6 text-center">
    <h1 class="text-page-title mb-3">{{ t('billing.paymentFailedTitle') }}</h1>
    <p class="text-body mb-4">{{ t(unchanged ? 'billing.renewPaymentFailedMessage' : 'billing.paymentFailedMessage') }}</p>
    <div class="form-row-inline justify-content-center">
      <NuxtLink :to="retryUrl" class="btn btn-primary-flat">{{ t('billing.tryAgain') }}</NuxtLink>
      <NuxtLink to="/kontrolna-tabla" class="btn btn-tertiary">{{ t('nav.dashboard') }}</NuxtLink>
    </div>
  </div>
</template>

<script setup>
import { getPackagePurchaseMode } from '~/utils/subscriptions'

definePageMeta({ middleware: 'auth' })
const { t } = useI18n()
const api = useApi()
const route = useRoute()
// A declined renewal (SubscriptionsService.handleNestPayFail) keeps its package for the retry.
const renewId = typeof route.query.obnova === 'string' ? route.query.obnova : ''
const retryUrl = `/oglasi/${route.params.id}/paket${renewId ? `?obnova=${renewId}` : ''}`

// Only a listing still waiting for its first package is "saved as a draft". A
// live one that tried to move up to Pro lands here without ?obnova= as well,
// and like a renewal it keeps the package and the place in search it had.
const { data: listing } = await useAsyncData(`payment-failed-listing-${route.params.id}`, () =>
  api.get(`/listings/${route.params.id}`).catch(() => false),
)
const unchanged = getPackagePurchaseMode(listing.value, renewId) !== 'publish'

useSeoMeta({ title: t('billing.paymentFailedTitle') })
</script>
