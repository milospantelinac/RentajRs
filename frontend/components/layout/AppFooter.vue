<template>
  <footer class="site-footer">
    <div class="container">
      <div class="row">
        <div class="col-12 col-md-4 mb-4 mb-md-0">
          <div class="site-logo mb-2">
            <span class="site-logo-mark">R</span>
            <span class="site-logo-text">{{ t('common.appName') }}</span>
          </div>
          <p class="text-muted">{{ t('common.tagline') }}</p>
        </div>

        <div class="col-6 col-md-2 mb-4 mb-md-0">
          <div class="text-label mb-2">{{ t('footer.about') }}</div>
          <NuxtLink to="/o-nama" class="footer-link">{{ t('footer.about') }}</NuxtLink>
          <NuxtLink to="/kontakt" class="footer-link">{{ t('footer.contact') }}</NuxtLink>
          <NuxtLink to="/pomoc" class="footer-link">{{ t('footer.help') }}</NuxtLink>
        </div>

        <div class="col-6 col-md-2 mb-4 mb-md-0">
          <div class="text-label mb-2">{{ t('footer.terms') }}</div>
          <NuxtLink to="/uslovi-koriscenja" class="footer-link">{{ t('footer.terms') }}</NuxtLink>
          <NuxtLink to="/politika-privatnosti" class="footer-link">{{ t('footer.privacy') }}</NuxtLink>
          <NuxtLink to="/kolacici" class="footer-link">{{ t('footer.cookies') }}</NuxtLink>
        </div>

        <div class="col-12 col-md-4">
          <div class="text-label mb-2">{{ t('nav.search') }}</div>
          <NuxtLink
            v-for="category in categories"
            :key="category.id"
            :to="`/${category.slug}`"
            class="footer-link"
          >
            {{ category.name }}
          </NuxtLink>
        </div>
      </div>

      <div class="footer-bottom">
        <span class="text-muted">© {{ year }} Rentaj. {{ t('footer.rights') }}</span>
      </div>
    </div>
  </footer>
</template>

<script setup>
const { t } = useI18n()
const year = new Date().getFullYear()

const { data: categories } = await useAsyncData('footer-categories', async () => {
  const api = useApi()
  try {
    return await api.get('/categories')
  } catch {
    return []
  }
})
</script>

<style lang="scss" scoped>
.site-footer {
  background: $color-surface;
  border-top: 1px solid $color-border;
  padding: 40px 0 24px;
  margin-top: 64px;
}

.site-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: $font-size-section-title;
  color: $color-text;
}

.site-logo-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: $radius-pill;
  background: $gradient-marketing;
  color: $color-surface;
  font-weight: 700;
  font-size: 13px;
}

.footer-link {
  display: block;
  color: $color-text-muted;
  font-size: $font-size-muted;
  padding: 4px 0;
}

.footer-link:hover {
  color: $color-primary;
  text-decoration: none;
}

.footer-bottom {
  margin-top: 32px;
  padding-top: 20px;
  border-top: 1px solid $color-border;
}
</style>
