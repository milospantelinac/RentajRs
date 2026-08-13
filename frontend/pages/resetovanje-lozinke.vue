<template>
  <div class="container auth-page">
    <div class="row justify-content-center">
      <div class="col-12 col-md-6 col-lg-5">
        <div class="card">
          <div class="card-body">
            <h1 class="text-page-title mb-4">{{ t('auth.resetPasswordTitle') }}</h1>

            <div v-if="success" class="text-body">
              {{ t('auth.passwordResetSuccess') }}
              <NuxtLink to="/prijava" class="btn btn-primary-flat btn-block mt-4">{{ t('nav.login') }}</NuxtLink>
            </div>

            <form v-else @submit.prevent="submit">
              <div class="form-group mb-4">
                <label class="form-label" for="password">{{ t('auth.newPassword') }}</label>
                <input id="password" v-model="password" type="password" class="form-control" required minlength="8" />
              </div>
              <p v-if="error" class="form-error mb-3">{{ error }}</p>
              <button type="submit" class="btn btn-primary-flat btn-block" :disabled="loading">
                {{ loading ? t('common.loading') : t('common.confirm') }}
              </button>
            </form>
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

const password = ref('')
const loading = ref(false)
const error = ref('')
const success = ref(false)

async function submit() {
  error.value = ''
  loading.value = true
  try {
    await api.post('/auth/reset-password', { token: route.query.token, password: password.value })
    success.value = true
  } catch (e) {
    error.value = e?.data?.message?.[0] || e?.data?.message || t('auth.genericError')
  } finally {
    loading.value = false
  }
}

useSeoMeta({ title: t('auth.resetPasswordTitle') })
</script>

<style lang="scss" scoped>
.auth-page {
  padding: 48px 0;
}
</style>
