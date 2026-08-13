<template>
  <div v-if="visible" class="cookie-banner card">
    <div class="container cookie-banner-inner">
      <p class="text-body cookie-banner-text">{{ t('cookies.message') }}</p>
      <div class="cookie-banner-actions">
        <button class="btn btn-tertiary btn-sm" @click="acceptEssentialOnly">
          {{ t('cookies.essentialOnly') }}
        </button>
        <button class="btn btn-primary-flat btn-sm" @click="acceptAll">
          {{ t('cookies.acceptAll') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
// Ch.16.2 — consent must be stored and revocable, not just a one-time
// dismiss. Anonymous choice lives in a cookie; UsersService/AuthService
// carries it into the `Consent` table once the visitor registers (see
// DOCUMENTATION.md "Future work" for the anonymous->account consent-sync
// endpoint this MVP defers).
const { t } = useI18n()
const consent = useCookie('rentaj_cookie_consent', { maxAge: 60 * 60 * 24 * 365 })
const visible = ref(!consent.value)

function acceptAll() {
  consent.value = JSON.stringify({ essential: true, analytics: true, marketing: true })
  visible.value = false
}

function acceptEssentialOnly() {
  consent.value = JSON.stringify({ essential: true, analytics: false, marketing: false })
  visible.value = false
}
</script>

<style lang="scss" scoped>
.cookie-banner {
  position: fixed;
  left: 16px;
  right: 16px;
  bottom: 16px;
  z-index: $z-toast;
  max-width: 720px;
  margin: 0 auto;
  padding: 16px 20px;
}

.cookie-banner-inner {
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cookie-banner-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

@include respond-below(sm) {
  .cookie-banner-actions {
    flex-direction: column;
  }
  .cookie-banner-actions .btn {
    width: 100%;
  }
}
</style>
