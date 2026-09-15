<template>
  <div class="auth-page auth-page-register">
    <div class="auth-card auth-card-register">
      <header class="auth-head">
        <h1 class="auth-title">{{ t('nav.register') }}</h1>
        <p class="auth-subtitle">{{ t('auth.registerSubtitle') }}</p>
      </header>

      <template v-if="success">
        <p class="auth-text">{{ t('auth.registerSuccess') }}</p>
        <p class="auth-switch">
          <span class="auth-switch-prompt">{{ t('auth.haveAccountPrompt') }}</span>
          <NuxtLink :to="loginLink" class="auth-switch-link">{{ t('auth.loginLink') }}</NuxtLink>
        </p>
      </template>

      <form v-else class="auth-form" @submit.prevent="submit" @invalid.capture="onInvalid" @input.capture="onInput">
        <a :href="googleLoginUrl" class="auth-google">
          <img src="/images/icons/google.svg" alt="" />
          {{ t('auth.registerWithGoogle') }}
        </a>

        <div class="auth-divider">{{ t('auth.or') }}</div>

        <div class="auth-row">
          <div class="auth-field">
            <label class="auth-label" for="firstName">{{ t('auth.firstName') }}</label>
            <input
              id="firstName"
              v-model="form.firstName"
              name="firstName"
              type="text"
              class="auth-input"
              :class="{ 'is-invalid': fieldErrors.firstName }"
              required
              maxlength="100"
            />
            <p v-if="fieldErrors.firstName" class="auth-error"><img src="/images/icons/field-error.svg" alt="" />{{ fieldErrors.firstName }}</p>
          </div>
          <div class="auth-field">
            <label class="auth-label" for="lastName">{{ t('auth.lastName') }}</label>
            <input
              id="lastName"
              v-model="form.lastName"
              name="lastName"
              type="text"
              class="auth-input"
              :class="{ 'is-invalid': fieldErrors.lastName }"
              required
              maxlength="100"
            />
            <p v-if="fieldErrors.lastName" class="auth-error"><img src="/images/icons/field-error.svg" alt="" />{{ fieldErrors.lastName }}</p>
          </div>
        </div>

        <div class="auth-field">
          <label class="auth-label" for="email">{{ t('auth.email') }}</label>
          <input id="email" v-model="form.email" name="email" type="email" class="auth-input" :class="{ 'is-invalid': fieldErrors.email }" required />
          <p v-if="fieldErrors.email" class="auth-error"><img src="/images/icons/field-error.svg" alt="" />{{ fieldErrors.email }}</p>
        </div>

        <div class="auth-field">
          <label class="auth-label" for="phone">{{ t('auth.phone') }}</label>
          <input
            id="phone"
            v-model="form.phone"
            name="phone"
            type="tel"
            class="auth-input"
            :class="{ 'is-invalid': fieldErrors.phone }"
            pattern="\+?[0-9\s\(\)\-]{6,20}"
            :data-pattern-message="t('auth.phoneInvalid')"
          />
          <p v-if="fieldErrors.phone" class="auth-error"><img src="/images/icons/field-error.svg" alt="" />{{ fieldErrors.phone }}</p>
        </div>

        <div class="auth-field">
          <label class="auth-label" for="password">{{ t('auth.password') }}</label>
          <PasswordField
            id="password"
            v-model="form.password"
            name="password"
            :class="{ 'is-invalid': fieldErrors.password }"
            required
            minlength="8"
            pattern="(?=.*\d).{8,}"
            :data-pattern-message="t('auth.passwordRuleError')"
          />
          <p v-if="fieldErrors.password" class="auth-error"><img src="/images/icons/field-error.svg" alt="" />{{ fieldErrors.password }}</p>
          <div class="auth-strength">
            <span v-for="segment in 3" :key="segment" class="auth-strength-bar" :class="{ 'auth-strength-bar-on': segment <= passwordStrength }" />
            <span class="auth-strength-label">{{ strengthLabel }}</span>
          </div>
          <p class="auth-hint">
            {{ t('auth.passwordHint') }}
            <img src="/images/icons/info-circle.svg" alt="" />
          </p>
        </div>

        <!-- Honeypot — hidden from real users, tripped only by bots (R177) -->
        <div class="form-honeypot" aria-hidden="true">
          <label for="website">Website</label>
          <input id="website" v-model="form.website" type="text" tabindex="-1" autocomplete="off" />
        </div>

        <label class="auth-terms">
          <input
            id="terms"
            v-model="form.acceptedTerms"
            name="acceptedTerms"
            type="checkbox"
            class="auth-checkbox"
            :class="{ 'is-invalid': fieldErrors.acceptedTerms }"
            required
          />
          <span class="auth-terms-text">
            {{ t('auth.acceptTermsPrefix') }}
            <NuxtLink to="/uslovi-koriscenja" target="_blank">{{ t('auth.termsLink') }}</NuxtLink>
            {{ t('auth.acceptTermsMiddle') }}
            <NuxtLink to="/politika-privatnosti" target="_blank">{{ t('auth.privacyLink') }}</NuxtLink>{{ t('auth.acceptTermsEnd') }}
          </span>
        </label>
        <p v-if="fieldErrors.acceptedTerms" class="auth-error"><img src="/images/icons/field-error.svg" alt="" />{{ fieldErrors.acceptedTerms }}</p>

        <p v-if="error" class="auth-error"><img src="/images/icons/field-error.svg" alt="" />{{ error }}</p>

        <button type="submit" class="auth-submit" :disabled="loading">
          {{ loading ? t('common.loading') : t('auth.registerSubmit') }}
        </button>

        <p class="auth-switch">
          <span class="auth-switch-prompt">{{ t('auth.haveAccountPrompt') }}</span>
          <NuxtLink :to="loginLink" class="auth-switch-link">{{ t('auth.loginLink') }}</NuxtLink>
        </p>
      </form>
    </div>
  </div>
</template>

<script setup>
// Dizajn 16 (Figma "Registracija · Desktop 1440", node 397:496).
const { t } = useI18n()
const auth = useAuthStore()
const config = useRuntimeConfig()
const route = useRoute()
const { fieldErrors, onInvalid, onInput } = useInlineFormValidation()

const googleLoginUrl = computed(() => `${config.public.apiBase}/auth/google`)
const loginLink = computed(() =>
  route.query.redirect ? { path: '/prijava', query: { redirect: route.query.redirect } } : '/prijava',
)

const form = reactive({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  password: '',
  website: '',
  acceptedTerms: false,
})
const loading = ref(false)
const error = ref('')
const success = ref(false)

// 1 = below the 8-character / one-digit rule, 2 = meets it, 3 = 12+ characters with a symbol.
const passwordStrength = computed(() => {
  const value = form.password
  if (!value) return 0
  if (value.length < 8 || !/\d/.test(value)) return 1
  return value.length >= 12 && /[^A-Za-z0-9]/.test(value) ? 3 : 2
})
const strengthLabel = computed(
  () => ['', t('auth.passwordStrengthWeak'), t('auth.passwordStrengthGood'), t('auth.passwordStrengthStrong')][passwordStrength.value],
)

async function submit() {
  error.value = ''
  loading.value = true
  try {
    await auth.register({
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      phone: form.phone.trim() || undefined,
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
@use '@/assets/scss/auth';
</style>
