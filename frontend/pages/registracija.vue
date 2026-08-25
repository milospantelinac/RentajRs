<template>
  <div class="container auth-page">
    <div class="row justify-content-center">
      <div class="col-12 col-md-6 col-lg-5">
        <div class="card">
          <div class="card-body">
            <h1 class="text-page-title mb-4">{{ t('nav.register') }}</h1>

            <div v-if="success" class="text-body">
              <p>{{ t('auth.registerSuccess') }}</p>
              <NuxtLink :to="loginLink">{{ t('auth.haveAccount') }}</NuxtLink>
            </div>

            <form v-else @submit.prevent="submit" @invalid.capture="onInvalidCapture" @input.capture="onInputCapture">
              <div class="row">
                <div class="col-6">
                  <div class="form-group mb-3">
                    <label class="form-label" for="firstName">{{ t('auth.firstName') }}</label>
                    <input id="firstName" v-model="form.firstName" type="text" class="form-control" required />
                  </div>
                </div>
                <div class="col-6">
                  <div class="form-group mb-3">
                    <label class="form-label" for="lastName">{{ t('auth.lastName') }}</label>
                    <input id="lastName" v-model="form.lastName" type="text" class="form-control" required />
                  </div>
                </div>
              </div>

              <div class="form-group mb-3">
                <label class="form-label" for="email">{{ t('auth.email') }}</label>
                <input id="email" v-model="form.email" type="email" class="form-control" required />
              </div>

              <div class="form-group mb-3">
                <label class="form-label" for="password">{{ t('auth.password') }}</label>
                <PasswordField id="password" v-model="form.password" required minlength="8" />
              </div>

              <!-- Honeypot — hidden from real users, tripped only by bots (R177) -->
              <div class="form-honeypot" aria-hidden="true">
                <label for="website">Website</label>
                <input id="website" v-model="form.website" type="text" tabindex="-1" autocomplete="off" />
              </div>

              <label class="form-row-inline mb-4">
                <input id="terms" v-model="form.acceptedTerms" type="checkbox" class="form-checkbox" required />
                <span class="text-muted">
                  {{ t('auth.acceptTermsPrefix') }}
                  <NuxtLink to="/uslovi-koriscenja" target="_blank">{{ t('footer.terms') }}</NuxtLink>
                  {{ t('auth.acceptTermsMiddle') }}
                  <NuxtLink to="/politika-privatnosti" target="_blank">{{ t('footer.privacy') }}</NuxtLink>
                  {{ t('auth.acceptTermsSuffix') }}
                </span>
              </label>

              <p v-if="error" class="form-error mb-3">{{ error }}</p>

              <button type="submit" class="btn btn-primary-flat btn-block mb-3" :disabled="loading">
                {{ loading ? t('common.loading') : t('nav.register') }}
              </button>

              <a :href="googleLoginUrl" class="btn btn-tertiary btn-block mb-3">{{ t('auth.continueWithGoogle') }}</a>

              <div class="auth-links">
                <NuxtLink :to="loginLink">{{ t('auth.haveAccount') }}</NuxtLink>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const { t } = useI18n()
const auth = useAuthStore()
const config = useRuntimeConfig()
const route = useRoute()
const { onInvalidCapture, onInputCapture } = useLocalizedFormValidation()

const googleLoginUrl = computed(() => `${config.public.apiBase}/auth/google`)
const loginLink = computed(() =>
  route.query.redirect ? { path: '/prijava', query: { redirect: route.query.redirect } } : '/prijava',
)

const form = reactive({
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  website: '',
  acceptedTerms: false,
})
const loading = ref(false)
const error = ref('')
const success = ref(false)

async function submit() {
  error.value = ''
  loading.value = true
  try {
    await auth.register({
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      password: form.password,
      website: form.website,
      termsVersion: '1.0',
    })
    success.value = true
  } catch (e) {
    error.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    loading.value = false
  }
}

useSeoMeta({ title: t('nav.register') })
</script>

<style lang="scss" scoped>
.auth-page {
  padding: 48px 0;
}

.auth-links {
  display: flex;
  justify-content: center;
  font-size: $font-size-muted;
}

.form-row-inline {
  align-items: flex-start;
}
</style>
