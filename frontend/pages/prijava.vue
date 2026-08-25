<template>
  <div class="container auth-page">
    <div class="row justify-content-center">
      <div class="col-12 col-md-6 col-lg-5">
        <div class="card">
          <div class="card-body">
            <h1 class="text-page-title mb-4">{{ t('nav.login') }}</h1>

            <form
              v-if="step === 'credentials'"
              @submit.prevent="submitCredentials"
              @invalid.capture="onInvalidCapture"
              @input.capture="onInputCapture"
            >
              <div class="form-group mb-3">
                <label class="form-label" for="email">E-mail</label>
                <input id="email" v-model="email" type="email" class="form-control" required />
              </div>
              <div class="form-group mb-3">
                <label class="form-label" for="password">{{ t('auth.password') }}</label>
                <PasswordField id="password" v-model="password" required />
              </div>
              <div class="form-row-inline mb-4">
                <input id="rememberMe" v-model="rememberMe" type="checkbox" class="form-checkbox" />
                <label for="rememberMe" class="text-muted">{{ t('auth.rememberMe') }}</label>
              </div>

              <p v-if="error" class="form-error mb-3">{{ error }}</p>

              <button type="submit" class="btn btn-primary-flat btn-block mb-3" :disabled="loading">
                {{ loading ? t('common.loading') : t('nav.login') }}
              </button>

              <a :href="googleLoginUrl" class="btn btn-tertiary btn-block mb-3">{{ t('auth.continueWithGoogle') }}</a>

              <div class="auth-links">
                <NuxtLink to="/zaboravljena-lozinka">{{ t('auth.forgotPassword') }}</NuxtLink>
                <NuxtLink :to="registerLink">{{ t('auth.noAccount') }}</NuxtLink>
              </div>
            </form>

            <form
              v-else-if="step === 'twoFactor'"
              @submit.prevent="submitTwoFactor"
              @invalid.capture="onInvalidCapture"
              @input.capture="onInputCapture"
            >
              <p class="text-body mb-3">{{ t('auth.twoFactorPrompt') }}</p>
              <p class="text-muted mb-3">{{ t('auth.twoFactorBackupCodeHint') }}</p>
              <div class="form-group mb-4">
                <label class="form-label" for="code">{{ t('auth.twoFactorCode') }}</label>
                <input id="code" v-model="code" type="text" class="form-control" required />
              </div>
              <p v-if="error" class="form-error mb-3">{{ error }}</p>
              <button type="submit" class="btn btn-primary-flat btn-block" :disabled="loading">
                {{ t('common.confirm') }}
              </button>
            </form>

            <!-- R127: admin accounts must set up 2FA before their first real login. -->
            <form
              v-else-if="step === 'twoFactorSetup'"
              @submit.prevent="submitTwoFactorSetup"
              @invalid.capture="onInvalidCapture"
              @input.capture="onInputCapture"
            >
              <p class="text-body mb-3">{{ t('auth.twoFactorSetupRequiredMessage') }}</p>
              <p class="text-muted mb-2">{{ t('auth.twoFactorSetupInstructions') }}</p>
              <img v-if="qrCodeDataUrl" :src="qrCodeDataUrl" :alt="t('auth.twoFactorQrAlt')" class="setup-qr mb-3" />
              <p class="text-muted mb-1">{{ t('auth.twoFactorManualEntry') }}</p>
              <div class="setup-secret mb-3">{{ secret }}</div>
              <div class="form-group mb-4">
                <label class="form-label" for="setupCode">{{ t('auth.twoFactorCode') }}</label>
                <input id="setupCode" v-model="code" type="text" inputmode="numeric" class="form-control" required />
              </div>
              <p v-if="error" class="form-error mb-3">{{ error }}</p>
              <button type="submit" class="btn btn-primary-flat btn-block" :disabled="loading">
                {{ t('common.confirm') }}
              </button>
            </form>

            <div v-else-if="step === 'backupCodes'">
              <p class="text-body mb-3">{{ t('auth.backupCodesIntro') }}</p>
              <ul class="backup-codes-list mb-3">
                <li v-for="backupCode in backupCodes" :key="backupCode">{{ backupCode }}</li>
              </ul>
              <p class="text-muted mb-4">{{ t('auth.backupCodesWarning') }}</p>
              <button type="button" class="btn btn-primary-flat btn-block" @click="finishTwoFactorSetup">
                {{ t('auth.backupCodesSavedConfirm') }}
              </button>
            </div>
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
const api = useApi()
const route = useRoute()
const { onInvalidCapture, onInputCapture } = useLocalizedFormValidation()

const redirectTarget = computed(() => {
  const value = route.query.redirect
  // Only ever follow an internal path — never let an open query param send
  // a logged-in session off to an arbitrary external URL.
  return typeof value === 'string' && value.startsWith('/') ? value : '/kontrolna-tabla'
})
const registerLink = computed(() =>
  route.query.redirect ? { path: '/registracija', query: { redirect: route.query.redirect } } : '/registracija',
)

const step = ref('credentials')
const email = ref('')
const password = ref('')
const rememberMe = ref(false)
const code = ref('')
const tempToken = ref('')
const secret = ref('')
const qrCodeDataUrl = ref('')
const backupCodes = ref([])
const error = ref('')
const loading = ref(false)

const googleLoginUrl = computed(() => `${config.public.apiBase}/auth/google`)

async function submitCredentials() {
  error.value = ''
  loading.value = true
  try {
    const result = await auth.login(email.value, password.value, rememberMe.value)
    if (result.twoFactorRequired) {
      tempToken.value = result.tempToken
      step.value = 'twoFactor'
    } else if (result.twoFactorSetupRequired) {
      tempToken.value = result.tempToken
      const setup = await api.post('/auth/login/2fa/setup-generate', { tempToken: result.tempToken })
      secret.value = setup.secret
      qrCodeDataUrl.value = setup.qrCodeDataUrl
      step.value = 'twoFactorSetup'
    } else {
      await navigateTo(redirectTarget.value)
    }
  } catch (e) {
    error.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    loading.value = false
  }
}

async function submitTwoFactor() {
  error.value = ''
  loading.value = true
  try {
    await auth.verifyTwoFactor(tempToken.value, code.value)
    await navigateTo(redirectTarget.value)
  } catch (e) {
    error.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    loading.value = false
  }
}

async function submitTwoFactorSetup() {
  error.value = ''
  loading.value = true
  try {
    const result = await api.post('/auth/login/2fa/setup-confirm', { tempToken: tempToken.value, code: code.value })
    await auth.setTokens(result.accessToken, result.refreshToken)
    await auth.fetchMe()
    backupCodes.value = result.backupCodes || []
    step.value = 'backupCodes'
  } catch (e) {
    error.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    loading.value = false
  }
}

async function finishTwoFactorSetup() {
  await navigateTo(redirectTarget.value)
}

useSeoMeta({ title: t('nav.login') })
</script>

<style lang="scss" scoped>
.auth-page {
  padding: 48px 0;
}

.auth-links {
  display: flex;
  justify-content: space-between;
  font-size: $font-size-muted;
}

.setup-qr {
  display: block;
  width: 180px;
  height: 180px;
  margin: 0 auto;
}

.setup-secret {
  padding: 12px;
  background: $color-background;
  border-radius: $radius-input;
  font-family: monospace;
  text-align: center;
  letter-spacing: 0.05em;
  word-break: break-all;
}

.backup-codes-list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 16px;
  margin: 0;
  background: $color-background;
  border-radius: $radius-input;
  list-style: none;
}

.backup-codes-list li {
  font-family: monospace;
  text-align: center;
  letter-spacing: 0.05em;
}
</style>
