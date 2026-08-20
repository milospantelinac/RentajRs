<template>
  <NuxtLayout name="default">
    <div class="container error-page text-center">
      <div class="error-icon-badge" :class="{ 'error-icon-badge-critical': isServerError }">
        <svg v-if="!isServerError" width="40" height="40" viewBox="0 0 24 24" fill="none">
          <circle cx="10" cy="10" r="6" stroke="currentColor" stroke-width="1.8" />
          <path d="M20 20l-4.35-4.35" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          <path d="M7.5 7.5l5 5M12.5 7.5l-5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        </svg>
        <svg v-else width="40" height="40" viewBox="0 0 24 24" fill="none">
          <path d="M12 3.5 21.5 19.5H2.5L12 3.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
          <path d="M12 9.5v4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          <circle cx="12" cy="16.5" r="0.9" fill="currentColor" />
        </svg>
      </div>

      <p class="error-eyebrow">{{ t('errorPage.errorLabel', { code: statusCode }) }}</p>
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
// dead link), so it gets its own copy, color and primary action instead of
// reusing "Stranica ne postoji." for every status code.
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
  padding: 96px 0;
  max-width: 480px;
}

.error-icon-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 88px;
  height: 88px;
  border-radius: $radius-pill;
  background: $gradient-marketing;
  color: $color-surface;
  box-shadow: 0 12px 32px -12px rgba(9, 87, 223, 0.5);
  margin-bottom: 20px;
}

.error-icon-badge-critical {
  background: $color-error;
  box-shadow: 0 12px 32px -12px rgba(229, 72, 77, 0.5);
}

.error-eyebrow {
  font-size: $font-size-label;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: $color-text-muted;
  margin-bottom: 10px;
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
</style>
