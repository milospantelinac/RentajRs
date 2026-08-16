<template>
  <NuxtLayout name="default">
    <div class="container error-page text-center">
      <p class="error-code">{{ error?.statusCode || 404 }}</p>
      <h1 class="text-page-title mb-2">{{ t('errorPage.title') }}</h1>
      <p class="text-body error-subtitle mb-4">{{ t('errorPage.subtitle') }}</p>
      <div class="error-actions">
        <button class="btn btn-primary-flat" @click="goHome">{{ t('errorPage.backHome') }}</button>
        <NuxtLink to="/pretraga" class="btn btn-tertiary">{{ t('errorPage.searchListings') }}</NuxtLink>
      </div>
    </div>
  </NuxtLayout>
</template>

<script setup>
// RNT-057 — Nuxt's built-in error page is English-only, has no header/footer,
// and its only exit is "Go back home"; this replaces it site-wide (root
// error.vue is Nuxt's convention for that) with something matching the rest
// of the site and offering a real second way out, not just one dead end.
defineProps({ error: { type: Object, default: null } })
const { t } = useI18n()

useSeoMeta({ title: t('errorPage.title') })

function goHome() {
  clearError({ redirect: '/' })
}
</script>

<style lang="scss" scoped>
.error-page {
  padding: 96px 0;
}

.error-code {
  font-size: 64px;
  font-weight: 700;
  color: $color-primary;
  margin-bottom: 8px;
}

.error-subtitle {
  color: $color-text-muted;
  max-width: 480px;
  margin: 0 auto;
}

.error-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
}
</style>
