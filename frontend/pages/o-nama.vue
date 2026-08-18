<template>
  <div v-if="page" class="legal-page">
    <section class="legal-hero">
      <div class="container text-center">
        <h1 class="text-page-title mb-2">{{ page.title }}</h1>
        <p class="text-body legal-subtitle">{{ t('legalPages.aboutSubtitle') }}</p>
      </div>
    </section>

    <section class="container legal-body">
      <div class="row justify-content-center">
        <div class="col-12 col-md-8">
          <article class="legal-content" v-html="page.bodyHtml" />

          <nav class="about-quick-links mt-4" :aria-label="t('legalPages.aboutQuickLinks')">
            <NuxtLink to="/cenovnik" class="btn btn-tertiary btn-sm">{{ t('nav.pricing') }}</NuxtLink>
            <NuxtLink to="/politika-privatnosti" class="btn btn-tertiary btn-sm">{{ t('footer.privacy') }}</NuxtLink>
            <NuxtLink to="/uslovi-koriscenja" class="btn btn-tertiary btn-sm">{{ t('footer.terms') }}</NuxtLink>
            <NuxtLink to="/faq" class="btn btn-tertiary btn-sm">{{ t('nav.faq') }}</NuxtLink>
            <NuxtLink to="/kontakt" class="btn btn-tertiary btn-sm">{{ t('footer.contact') }}</NuxtLink>
          </nav>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
const { t } = useI18n()
const api = useApi()

const { data: page } = await useAsyncData('static-page-o-nama', () => api.get('/static-pages/o-nama'))

useSeoMeta({ title: () => page.value?.title || t('legalPages.aboutTitle'), description: t('legalPages.aboutSubtitle') })
</script>

<style lang="scss" scoped>
.legal-hero {
  background: $color-background;
  padding: 56px 0 24px;
}

.legal-subtitle {
  color: $color-text-muted;
  max-width: 480px;
  margin: 0 auto;
}

.legal-body {
  padding: 32px 0 64px;
}

.legal-content :deep(.lead-paragraph) {
  font-size: $font-size-page-title;
  font-weight: 600;
  line-height: 1.5;
  margin-bottom: 32px;
}

.legal-content :deep(h2) {
  margin-top: 32px;
  margin-bottom: 12px;
  font-size: 17px;
  font-weight: $font-weight-section-title;
  line-height: 1.3;
  color: $color-text;
}

.legal-content :deep(p) {
  color: $color-text;
  line-height: 1.7;
}

.about-quick-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
