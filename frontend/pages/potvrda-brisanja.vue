<template>
  <div class="container auth-page">
    <div class="row justify-content-center">
      <div class="col-12 col-md-6 col-lg-5">
        <div class="card">
          <div class="card-body">
            <h1 class="text-page-title mb-4">{{ t('auth.deleteAccountConfirmTitle') }}</h1>

            <div v-if="success" class="text-body">
              {{ t('auth.deleteAccountConfirmSuccess') }}
              <NuxtLink to="/" class="btn btn-primary-flat btn-block mt-4">{{ t('nav.home') }}</NuxtLink>
            </div>

            <template v-else>
              <p class="text-body mb-4">{{ t('auth.deleteAccountConfirmIntro') }}</p>
              <p v-if="error" class="form-error mb-3">{{ error }}</p>
              <button class="btn btn-danger btn-block" :disabled="loading" @click="confirm">
                {{ loading ? t('common.loading') : t('auth.deleteAccountConfirmButton') }}
              </button>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const { t } = useI18n()
const api = useApi()
const route = useRoute()
const auth = useAuthStore()

const loading = ref(false)
const success = ref(false)
const error = ref('')

async function confirm() {
  error.value = ''
  loading.value = true
  try {
    await api.post('/users/deletion/confirm', { token: route.query.token })
    success.value = true
    await auth.clearSessionAndCookies()
  } catch (e) {
    error.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    loading.value = false
  }
}

useSeoMeta({ title: t('auth.deleteAccountConfirmTitle') })
</script>

<style lang="scss" scoped>
.auth-page {
  padding: 48px 0;
}
</style>
