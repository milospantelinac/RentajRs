<template>
  <div class="legal-page">
    <section class="legal-hero">
      <div class="container text-center">
        <h1 class="text-page-title mb-2">{{ t('footer.cookies') }}</h1>
        <p class="text-body legal-subtitle">{{ t('cookiesPage.subtitle') }}</p>
      </div>
    </section>

    <section class="container legal-body">
      <div class="row justify-content-center">
        <div class="col-12 col-md-8">
          <article class="legal-content">
            <h2 class="text-section-title">{{ t('cookiesPage.essentialTitle') }}</h2>
            <p>{{ t('cookiesPage.essentialText') }}</p>

            <h2 class="text-section-title">{{ t('cookiesPage.analyticsTitle') }}</h2>
            <p>{{ t('cookiesPage.analyticsText') }}</p>
          </article>

          <div class="card cookies-choice-card mt-4">
            <div class="card-body">
              <h2 class="text-section-title mb-2">{{ t('cookies.settings') }}</h2>
              <p class="text-muted mb-3">
                {{ currentChoiceText }}
              </p>
              <div class="cookies-choice-actions">
                <button class="btn btn-tertiary btn-sm" @click="acceptEssentialOnly">
                  {{ t('cookies.essentialOnly') }}
                </button>
                <button class="btn btn-primary-flat btn-sm" @click="acceptAll">
                  {{ t('cookies.acceptAll') }}
                </button>
              </div>
              <p v-if="justSaved" class="text-success mt-3 mb-0">{{ t('cookiesPage.saved') }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
const { t } = useI18n()
const consent = useCookie('rentaj_cookie_consent', { maxAge: 60 * 60 * 24 * 365 })
const justSaved = ref(false)

const currentChoiceText = computed(() => {
  if (!consent.value) return t('cookiesPage.noChoiceYet')
  try {
    const parsed = JSON.parse(consent.value)
    return parsed.analytics ? t('cookiesPage.choiceAll') : t('cookiesPage.choiceEssential')
  } catch {
    return t('cookiesPage.noChoiceYet')
  }
})

function acceptAll() {
  consent.value = JSON.stringify({ essential: true, analytics: true, marketing: true })
  justSaved.value = true
}

function acceptEssentialOnly() {
  consent.value = JSON.stringify({ essential: true, analytics: false, marketing: false })
  justSaved.value = true
}

useSeoMeta({ title: () => t('footer.cookies'), robots: 'noindex,follow' })
</script>

<style lang="scss" scoped>
.legal-hero {
  padding: 48px 0 32px;
  background: $color-surface;
}

.legal-subtitle {
  color: $color-text-muted;
  max-width: 560px;
  margin: 0 auto;
}

.legal-body {
  padding: 40px 0 64px;
}

.legal-content :deep(h2) {
  margin-top: 28px;
  margin-bottom: 10px;
}

.legal-content :deep(p) {
  color: $color-text-muted;
  line-height: 1.7;
}

.cookies-choice-actions {
  display: flex;
  gap: 8px;
}
</style>
