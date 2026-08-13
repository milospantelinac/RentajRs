<template>
  <div class="container auth-page">
    <p class="text-body text-center">{{ t('common.loading') }}</p>
  </div>
</template>

<script setup>
// Backend's /auth/google/callback redirects here with tokens in the query
// string (see AuthController.googleCallback) — this page's only job is to
// hand them to the auth store and continue on.
const { t } = useI18n()
const route = useRoute()
const auth = useAuthStore()

onMounted(async () => {
  const { accessToken, refreshToken } = route.query
  if (accessToken && refreshToken) {
    await auth.setTokens(accessToken, refreshToken)
    await auth.fetchMe()
    await navigateTo('/kontrolna-tabla')
  } else {
    await navigateTo('/prijava')
  }
})

definePageMeta({ layout: false })
</script>

<style lang="scss" scoped>
.auth-page {
  padding: 80px 0;
}
.text-center {
  text-align: center;
}
</style>
