<template>
  <div class="faq-page">
    <section class="faq-hero">
      <div class="container text-center">
        <h1 class="text-page-title mb-2">{{ t('home.faqSectionTitleStrong') }} {{ t('home.faqSectionTitleLight') }}</h1>
      </div>
    </section>

    <section class="container faq-page-body">
      <div class="row justify-content-center">
        <div class="col-12 col-md-8">
          <FaqAccordion />
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
const { t } = useI18n()

useSeoMeta({ title: `${t('home.faqSectionTitleStrong')} ${t('home.faqSectionTitleLight')}` })
</script>

<style lang="scss" scoped>
.faq-hero {
  background: $color-background;
  padding: 56px 0 32px;
}

.faq-page-body {
  padding: 48px 0 64px;
}
</style>
