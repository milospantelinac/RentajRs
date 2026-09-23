<template>
  <div class="container auth-page">
    <div class="row justify-content-center">
      <div class="col-12 col-md-6 col-lg-5">
        <div class="card">
          <div class="card-body">
            <h1 class="text-page-title mb-4">{{ t('auth.verifyEmailTitle') }}</h1>

            <!-- Dizajn 44: the shape of the answer that is coming, not a
                 spinner: two lines of text and the button under them. -->
            <div v-if="loading" class="verify-loading" aria-hidden="true">
              <SkeletonBox height="15px" />
              <SkeletonBox width="68%" height="15px" />
              <SkeletonBox class="verify-loading-button" height="46px" radius="12px" />
            </div>

            <div v-else-if="success" class="text-body">
              {{ t('auth.verifyEmailSuccess') }}
              <NuxtLink to="/prijava" class="btn btn-primary-flat btn-block mt-4">{{ t('nav.login') }}</NuxtLink>
            </div>

            <div v-else>
              <p class="form-error mb-3">{{ error || t('auth.verifyEmailError') }}</p>
              <NuxtLink to="/" class="btn btn-tertiary btn-block">{{ t('nav.home') }}</NuxtLink>
            </div>
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

const loading = ref(true)
const success = ref(false)
const error = ref('')

async function verify() {
  try {
    await api.post('/auth/verify-email', { token: route.query.token })
    success.value = true
  } catch (e) {
    error.value = extractErrorMessage(e, '')
  } finally {
    loading.value = false
  }
}

onMounted(verify)
useSeoMeta({ title: t('auth.verifyEmailTitle') })
</script>

<style lang="scss" scoped>
.auth-page {
  padding: 48px 0;
}

.verify-loading {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

// The button keeps the 4 spacing step the answer puts above it.
.verify-loading-button {
  margin-top: 16px;
}
</style>
