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

// Only the vertical padding, so on a phone the container keeps its own 16px
// gutter and the panels sit 16 in from the edges, as on the homepage FAQ
// (Dizajn 42). From md up this page has always run to the container's edge.
.faq-page-body {
  padding-top: 48px;
  padding-bottom: 64px;
}

@include respond-above(md) {
  .faq-page-body {
    padding-left: 0;
    padding-right: 0;
  }
}
</style>
