<template>
  <div v-if="page" class="legal-page">
    <section class="legal-hero">
      <div class="container text-center">
        <h1 class="text-page-title mb-2">{{ page.title }}</h1>
        <p class="text-body legal-subtitle">{{ t('legalPages.privacySubtitle') }}</p>
        <p class="text-muted legal-updated">{{ t('legalPages.lastUpdated', { date: lastUpdated }) }}</p>
      </div>
    </section>

    <section class="container legal-body">
      <div class="row justify-content-center">
        <div class="col-12 col-md-8">
          <article class="legal-content" v-html="page.bodyHtml" />
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
const { t } = useI18n()
const api = useApi()

const { data: page } = await useAsyncData('static-page-politika-privatnosti', () => api.get('/static-pages/politika-privatnosti'))

const lastUpdated = computed(() =>
  page.value?.updatedAt ? new Date(page.value.updatedAt).toLocaleDateString('sr-RS') : '',
)

useSeoMeta({ title: () => page.value?.title || t('legalPages.privacyTitle'), description: t('legalPages.privacySubtitle'), robots: 'noindex,follow' })
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

.legal-updated {
  font-size: $font-size-muted;
  margin-top: 8px;
}

.legal-body {
  padding: 32px 0 64px;
}

.legal-content :deep(h2) {
  margin-top: 32px;
  margin-bottom: 12px;
  font-size: 17px;
  font-weight: $font-weight-section-title;
  line-height: 1.3;
}

.legal-content :deep(h2:first-child) {
  margin-top: 0;
}

.legal-content :deep(p),
.legal-content :deep(li) {
  color: $color-text;
  line-height: 1.7;
}

.legal-content :deep(ul) {
  padding-left: 20px;
  margin-bottom: 16px;
}
</style>
