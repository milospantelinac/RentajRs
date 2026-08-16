<template>
  <div class="container auth-page">
    <p class="text-body text-center">{{ t('common.loading') }}</p>
  </div>
</template>

<script setup>
// Backend's /auth/google/callback redirects here with a one-time code in the
// query string (see AuthController.googleCallback) — real tokens never sit
// in a URL. This page's only job is to exchange that code for the actual
// session via POST, then hand it to the auth store.
const { t } = useI18n()
const route = useRoute()
const api = useApi()
const auth = useAuthStore()

onMounted(async () => {
  const { code } = route.query
  if (code) {
    try {
      const { accessToken, refreshToken } = await api.post('/auth/google/exchange', { code })
      await auth.setTokens(accessToken, refreshToken)
      await auth.fetchMe()
      await navigateTo('/kontrolna-tabla')
      return
    } catch {
      // falls through to /prijava below
    }
  }
  await navigateTo('/prijava')
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
