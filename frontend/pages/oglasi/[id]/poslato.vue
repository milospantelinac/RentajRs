<template>
  <div class="container py-6 text-center">
    <h1 class="text-page-title mb-3">{{ t('billing.submittedTitle') }}</h1>
    <p class="text-body mb-4">{{ t('billing.submittedMessage') }}</p>
    <NuxtLink to="/kontrolna-tabla" class="btn btn-primary-flat">{{ t('nav.dashboard') }}</NuxtLink>
  </div>
</template>

<script setup>
definePageMeta({ middleware: 'auth' })
const { t } = useI18n()
useSeoMeta({ title: t('billing.submittedTitle') })
</script>
