<template>
  <div class="auth-page">
    <div class="auth-card">
      <header class="auth-head">
        <h1 class="auth-title">{{ t('nav.login') }}</h1>
        <p v-if="step === 'credentials'" class="auth-subtitle">{{ t('auth.loginSubtitle') }}</p>
      </header>

      <form
        v-if="step === 'credentials'"
        class="auth-form"
        @submit.prevent="submitCredentials"
        @invalid.capture="onInvalid"
        @input.capture="onInput"
      >
        <a :href="googleLoginUrl" class="auth-google">
          <img src="/images/icons/google.svg" alt="" />
          {{ t('auth.loginWithGoogle') }}
        </a>

        <div class="auth-divider">{{ t('auth.or') }}</div>

        <div class="auth-field">
          <label class="auth-label" for="email">{{ t('auth.email') }}</label>
          <input id="email" v-model="email" name="email" type="email" class="auth-input" :class="{ 'is-invalid': fieldErrors.email }" required />
          <p v-if="fieldErrors.email" class="auth-error"><img src="/images/icons/field-error.svg" alt="" />{{ fieldErrors.email }}</p>
        </div>

        <div class="auth-field">
          <label class="auth-label" for="password">{{ t('auth.password') }}</label>
          <PasswordField id="password" v-model="password" name="password" :class="{ 'is-invalid': fieldErrors.password }" required />
          <p v-if="fieldErrors.password" class="auth-error"><img src="/images/icons/field-error.svg" alt="" />{{ fieldErrors.password }}</p>
        </div>

        <div class="auth-options">
          <label class="auth-check">
            <input id="rememberMe" v-model="rememberMe" type="checkbox" class="auth-checkbox" />
            {{ t('auth.rememberMe') }}
          </label>
          <NuxtLink to="/zaboravljena-lozinka" class="auth-forgot">{{ t('auth.forgotPasswordLink') }}</NuxtLink>
        </div>

        <p v-if="error" class="auth-error"><img src="/images/icons/field-error.svg" alt="" />{{ error }}</p>

        <button type="submit" class="auth-submit" :disabled="loading">
          {{ loading ? t('common.loading') : t('auth.loginSubmit') }}
        </button>

        <p class="auth-switch">
          <span class="auth-switch-prompt">{{ t('auth.noAccountPrompt') }}</span>
          <NuxtLink :to="registerLink" class="auth-switch-link">{{ t('auth.registerLink') }}</NuxtLink>
        </p>
      </form>

      <form
        v-else-if="step === 'twoFactor'"
        class="auth-form"
        @submit.prevent="submitTwoFactor"
        @invalid.capture="onInvalid"
        @input.capture="onInput"
      >
        <p class="auth-text">{{ t('auth.twoFactorPrompt') }}</p>
        <p class="auth-text auth-text-muted">{{ t('auth.twoFactorBackupCodeHint') }}</p>
        <div class="auth-field">
          <label class="auth-label" for="code">{{ t('auth.twoFactorCode') }}</label>
          <input id="code" v-model="code" name="code" type="text" class="auth-input" :class="{ 'is-invalid': fieldErrors.code }" required />
          <p v-if="fieldErrors.code" class="auth-error"><img src="/images/icons/field-error.svg" alt="" />{{ fieldErrors.code }}</p>
        </div>
        <p v-if="error" class="auth-error"><img src="/images/icons/field-error.svg" alt="" />{{ error }}</p>
        <button type="submit" class="auth-submit" :disabled="loading">
          {{ t('common.confirm') }}
        </button>
      </form>

      <!-- R127: admin accounts must set up 2FA before their first real login. -->
      <form
        v-else-if="step === 'twoFactorSetup'"
        class="auth-form"
        @submit.prevent="submitTwoFactorSetup"
        @invalid.capture="onInvalid"
        @input.capture="onInput"
      >
        <p class="auth-text">{{ t('auth.twoFactorSetupRequiredMessage') }}</p>
        <p class="auth-text auth-text-muted">{{ t('auth.twoFactorSetupInstructions') }}</p>
        <img v-if="qrCodeDataUrl" :src="qrCodeDataUrl" :alt="t('auth.twoFactorQrAlt')" class="setup-qr" />
        <p class="auth-text auth-text-muted">{{ t('auth.twoFactorManualEntry') }}</p>
        <div class="setup-secret">{{ secret }}</div>
        <div class="auth-field">
          <label class="auth-label" for="setupCode">{{ t('auth.twoFactorCode') }}</label>
          <input
            id="setupCode"
            v-model="code"
            name="setupCode"
            type="text"
            inputmode="numeric"
            class="auth-input"
            :class="{ 'is-invalid': fieldErrors.setupCode }"
            required
          />
          <p v-if="fieldErrors.setupCode" class="auth-error"><img src="/images/icons/field-error.svg" alt="" />{{ fieldErrors.setupCode }}</p>
        </div>
        <p v-if="error" class="auth-error"><img src="/images/icons/field-error.svg" alt="" />{{ error }}</p>
        <button type="submit" class="auth-submit" :disabled="loading">
          {{ t('common.confirm') }}
        </button>
      </form>

      <div v-else-if="step === 'backupCodes'" class="auth-form">
        <p class="auth-text">{{ t('auth.backupCodesIntro') }}</p>
        <ul class="backup-codes-list">
          <li v-for="backupCode in backupCodes" :key="backupCode">{{ backupCode }}</li>
        </ul>
        <p class="auth-text auth-text-muted">{{ t('auth.backupCodesWarning') }}</p>
        <button type="button" class="auth-submit" @click="finishTwoFactorSetup">
          {{ t('auth.backupCodesSavedConfirm') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
// Dizajn 16 (Figma "Prijava · Desktop 1440", node 395:496). Layout only — the
// login, 2FA and Google flows below are unchanged.
const { t } = useI18n()
const auth = useAuthStore()
const config = useRuntimeConfig()
const api = useApi()
const route = useRoute()
const { fieldErrors, onInvalid, onInput } = useInlineFormValidation()

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
@use '@/assets/scss/auth';

.setup-qr {
  align-self: center;
  width: 180px;
  height: 180px;
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
