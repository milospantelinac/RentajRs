<template>
  <div class="faq-page">
    <div class="container">
      <div class="faq-page-split">
        <h1 class="faq-page-title">
          {{ t('home.faqSectionTitleStrong') }} <span class="faq-page-title-muted">{{ t('home.faqSectionTitleLight') }}</span>
        </h1>
        <FaqAccordion class="faq-page-list" />
        <SupportAside class="faq-page-support" :links="supportLinks" />
      </div>
    </div>
  </div>
</template>

<script setup>
// Dizajn 47 (Figma "FAQ · Desktop 1440", node 1652:3271): the homepage FAQ
// section as a page. The title and the Kontakt support card share the left
// column, the questions take the right; on a narrow screen it reads title,
// questions, then the card. Questions still come from Admin FAQ.
const { t } = useI18n()

const supportLinks = computed(() => [
  { to: '/kontakt', label: t('footer.contactCta') },
  { to: '/uslovi-koriscenja', label: t('footer.termsLong') },
  { to: '/politika-privatnosti', label: t('footer.privacy') },
])

useSeoMeta({ title: `${t('home.faqSectionTitleStrong')} ${t('home.faqSectionTitleLight')}` })
</script>

<style lang="scss" scoped>
// 1652:3301: the section starts 72 under the header and ends 120 above the
// footer.
.faq-page {
  padding: 72px 0 120px;
}

// 1657:3270: 400 | 88 | 728, the title and the card 40 apart on the left and
// the list beside both. No class here may contain "col": _grid.scss pads every
// [class*='col'] element by 12px on each side.
.faq-page-split {
  display: grid;
  grid-template-columns: minmax(0, 400fr) minmax(0, 728fr);
  grid-template-rows: auto 1fr;
  grid-template-areas:
    'title list'
    'support list';
  column-gap: 88px;
  row-gap: 40px;
  align-items: start;
}

// 1657:3272: Regular 52/56 in a 352 box, so it breaks onto three lines.
.faq-page-title {
  grid-area: title;
  max-width: 352px;
  font-size: 52px;
  font-weight: 400;
  line-height: 56px;
  color: $color-text;
}

.faq-page-title-muted {
  color: $color-text-muted;
}

.faq-page-list {
  grid-area: list;
}

.faq-page-support {
  grid-area: support;
}

// 1657:3275 and 1657:3280: here the row is 13/11/12/32 with the toggle 24
// past the question, and the answer keeps 84 clear on the right. The homepage
// panels (26:12) sit 12/12/12/32 and 10/32/31, so only this page moves them;
// on a phone the shared panel keeps the homepage's own values.
@include respond-above(md) {
  .faq-page-list :deep(.faq-question) {
    gap: 24px;
    padding: 13px 11px 12px 32px;
  }

  .faq-page-list :deep(.faq-answer) {
    padding: 0 84px 28px 32px;
  }
}

// No frame below 1440: one column, as the ticket asks for 375, with the card
// as wide as on Kontakt.
@include respond-below(lg) {
  .faq-page-split {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: none;
    grid-template-areas:
      'title'
      'list'
      'support';
  }

  .faq-page-support {
    max-width: 400px;
  }
}

// Phone: Kontakt's page padding, the homepage's 42/56 FAQ heading with the
// list 25 under it, the card 40 under the list.
@include respond-below(md) {
  .faq-page {
    padding: 40px 0 56px;
  }

  .faq-page-split {
    row-gap: 25px;
  }

  .faq-page-title {
    font-size: 42px;
    letter-spacing: $letter-spacing-page-title;
  }

  .faq-page-support {
    max-width: none;
    margin-top: 15px;
  }
}
</style>
