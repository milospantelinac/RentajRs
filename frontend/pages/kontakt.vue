<template>
  <div class="contact-page">
    <section class="contact-hero">
      <div class="container text-center">
        <h1 class="text-page-title mb-2">{{ t('contactPage.title') }}</h1>
        <p class="text-body contact-subtitle">{{ t('contactPage.subtitle') }}</p>
      </div>
    </section>

    <section class="container contact-body">
      <div class="row justify-content-center">
        <div class="col-12 col-md-6">
          <div class="card">
            <div class="card-body text-center">
              <p class="text-label mb-2">{{ t('contactPage.emailLabel') }}</p>
              <a href="mailto:podrska@rentaj.rs" class="contact-email">podrska@rentaj.rs</a>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
const { t } = useI18n()

useSeoMeta({ title: t('contactPage.title'), description: t('contactPage.subtitle') })
</script>

<style lang="scss" scoped>
.contact-hero {
  background: $color-background;
  padding: 56px 0 32px;
}

.contact-subtitle {
  color: $color-text-muted;
  max-width: 480px;
  margin: 0 auto;
}

.contact-body {
  padding: 48px 0 64px;
}

.contact-email {
  font-size: $font-size-page-title;
  font-weight: 600;
  color: $color-primary;
}
</style>
