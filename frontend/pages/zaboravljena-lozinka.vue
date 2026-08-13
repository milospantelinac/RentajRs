<template>
  <div class="container auth-page">
    <div class="row justify-content-center">
      <div class="col-12 col-md-6 col-lg-5">
        <div class="card">
          <div class="card-body">
            <h1 class="text-page-title mb-4">{{ t('auth.forgotPassword') }}</h1>

            <div v-if="sent" class="text-body">{{ t('auth.forgotPasswordSuccess') }}</div>

            <form v-else @submit.prevent="submit">
              <div class="form-group mb-4">
                <label class="form-label" for="email">{{ t('auth.email') }}</label>
                <input id="email" v-model="email" type="email" class="form-control" required />
              </div>
              <button type="submit" class="btn btn-primary-flat btn-block" :disabled="loading">
                {{ loading ? t('common.loading') : t('common.continue') }}
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
const email = ref('')
const loading = ref(false)
const sent = ref(false)

async function submit() {
  loading.value = true
  try {
    await api.post('/auth/forgot-password', { email: email.value })
  } finally {
    sent.value = true
    loading.value = false
  }
}

useSeoMeta({ title: t('auth.forgotPassword') })
</script>

<style lang="scss" scoped>
.auth-page {
  padding: 48px 0;
}
</style>
