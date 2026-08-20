<template>
  <NuxtLayout name="default">
    <div class="error-page">
      <p class="error-code" :class="{ 'error-code-critical': isServerError }">{{ statusCode }}</p>
      <h1 class="text-page-title mb-2">{{ title }}</h1>
      <p class="text-body error-subtitle mb-4">{{ subtitle }}</p>

      <div class="error-actions">
        <button class="btn btn-primary-flat" @click="primaryAction">{{ primaryLabel }}</button>
        <NuxtLink v-if="!isServerError" to="/pretraga" class="btn btn-tertiary">{{ t('errorPage.searchListings') }}</NuxtLink>
        <button v-else class="btn btn-tertiary" @click="goHome">{{ t('errorPage.backHome') }}</button>
      </div>
    </div>
  </NuxtLayout>
</template>

<script setup>
// RNT-057 — Nuxt's built-in error page is English-only, has no header/footer,
// and its only exit is "Go back home"; this replaces it site-wide (root
// error.vue is Nuxt's convention for that) with something matching the rest
// of the site. A 5xx is a different situation than a 404 (our fault, not a
// dead link), so it gets its own copy and primary action instead of reusing
// "Stranica ne postoji." for every status code.
const props = defineProps({ error: { type: Object, default: null } })
const { t } = useI18n()

const statusCode = computed(() => props.error?.statusCode || 404)
const isServerError = computed(() => statusCode.value >= 500)

const title = computed(() => (isServerError.value ? t('errorPage.serverErrorTitle') : t('errorPage.title')))
const subtitle = computed(() => (isServerError.value ? t('errorPage.serverErrorSubtitle') : t('errorPage.subtitle')))
const primaryLabel = computed(() => (isServerError.value ? t('errorPage.tryAgain') : t('errorPage.backHome')))

useSeoMeta({ title })

function goHome() {
  clearError({ redirect: '/' })
}

function primaryAction() {
  if (isServerError.value) {
    reloadNuxtApp({ persistState: false })
  } else {
    goHome()
  }
}
</script>

<style lang="scss" scoped>
.error-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  min-height: 60vh;
  max-width: 480px;
  margin: 0 auto;
  padding: 48px 20px;
}

.error-code {
  font-size: 72px;
  font-weight: 700;
  line-height: 1;
  color: $color-primary;
  margin-bottom: 16px;
}

.error-code-critical {
  color: $color-error;
}

.error-subtitle {
  color: $color-text-muted;
  max-width: 400px;
  margin: 0 auto;
}

.error-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
}

@include respond-above(md) {
  .error-code {
    font-size: 108px;
  }
}
</style>
