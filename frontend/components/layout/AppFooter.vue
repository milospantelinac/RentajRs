<template>
  <footer class="site-footer">
    <div class="container">
      <div class="row">
        <div class="col-12 col-md-4 mb-4 mb-md-0">
          <div class="site-logo mb-2">
            <img src="/images/rentaj-logo.svg" :alt="t('common.appName')" class="site-logo-img" />
          </div>
          <p class="footer-tagline">{{ t('footer.description') }}</p>
        </div>

        <div class="col-6 col-md-2 mb-4 mb-md-0">
          <div class="text-label mb-3">{{ t('footer.aboutGroup') }}</div>
          <NuxtLink to="/cenovnik" class="footer-link">{{ t('nav.pricing') }}</NuxtLink>
          <NuxtLink to="/politika-privatnosti" class="footer-link">{{ t('footer.privacy') }}</NuxtLink>
          <NuxtLink to="/uslovi-koriscenja" class="footer-link">{{ t('footer.terms') }}</NuxtLink>
          <NuxtLink to="/faq" class="footer-link">{{ t('nav.faq') }}</NuxtLink>
          <NuxtLink to="/kontakt" class="footer-link">{{ t('footer.contact') }}</NuxtLink>
          <NuxtLink to="/o-nama" class="footer-link">{{ t('footer.about') }}</NuxtLink>
          <NuxtLink to="/kolacici" class="footer-link">{{ t('footer.cookies') }}</NuxtLink>
        </div>

        <div class="col-6 col-md-2 mb-4 mb-md-0">
          <div class="text-label mb-3">{{ t('footer.categoriesGroup') }}</div>
          <NuxtLink
            v-for="category in categories"
            :key="category.id"
            :to="`/${category.slug}`"
            class="footer-link"
          >
            {{ category.name }}
          </NuxtLink>
        </div>

        <div class="col-12 col-md-4">
          <div class="text-label mb-3">{{ t('footer.platformGroup') }}</div>
          <NuxtLink to="/pretraga" class="footer-link">{{ t('nav.search') }}</NuxtLink>
          <NuxtLink v-if="!auth.user" to="/prijava" class="footer-link">{{ t('nav.login') }}</NuxtLink>
          <NuxtLink to="/oglasi/novi" class="footer-link">{{ t('nav.addListing') }}</NuxtLink>
        </div>
      </div>

      <div class="footer-bottom">
        <span class="text-muted">© {{ year }} {{ t('footer.rights') }}</span>

        <div class="footer-payment-badges">
          <div class="footer-payment-group">
            <img src="/images/payment/maestro.png" alt="Maestro" class="footer-payment-logo" />
            <img src="/images/payment/mastercard.png" alt="Mastercard" class="footer-payment-logo" />
            <img src="/images/payment/dinacard.png" alt="DinaCard" class="footer-payment-logo" />
            <img src="/images/payment/visa.png" alt="Visa" class="footer-payment-logo" />
            <img src="/images/payment/amex.png" alt="American Express" class="footer-payment-logo footer-payment-logo-square" />
          </div>

          <a href="https://www.bancaintesa.rs" target="_blank" rel="noopener" class="footer-payment-link">
            <img src="/images/payment/banca-intesa.png" alt="Banca Intesa" class="footer-payment-logo" />
          </a>

          <div class="footer-payment-group">
            <a href="https://www.mastercard.rs/sr-rs/korisnici/pronadite-karticu.html" target="_blank" rel="noopener" class="footer-payment-link">
              <img src="/images/payment/mastercard-id-check.png" alt="Mastercard ID Check" class="footer-payment-logo" />
            </a>
            <a
              href="https://rs.visa.com/pay-with-visa/security-and-assistance/protected-everywhere.html"
              target="_blank"
              rel="noopener"
              class="footer-payment-link"
            >
              <img src="/images/payment/visa-secure.png" alt="Visa Secure" class="footer-payment-logo footer-payment-logo-square" />
            </a>
          </div>
        </div>
      </div>
    </div>
  </footer>
</template>

<script setup>
const { t } = useI18n()
const auth = useAuthStore()
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
}

.site-logo-img {
  width: 130px;
  height: auto;
  display: block;
}

.footer-tagline {
  color: $color-text-muted;
  font-size: $font-size-body;
  line-height: 1.6;
  max-width: 320px;
}

.footer-link {
  display: block;
  color: $color-text-muted;
  font-size: $font-size-muted;
  padding: 6px 0;
}

.footer-link:hover {
  color: $color-primary;
  text-decoration: none;
}

.footer-bottom {
  margin-top: 32px;
  padding-top: 20px;
  border-top: 1px solid $color-border;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

// Required by Banca Intesa's NestPay merchant onboarding (EPM compliance) —
// order and spacing follow "primer korektnog brendiranja" in the pilot docs
// handoff: card schemes, then the bank mark, then the security badges, with
// a wider gap between those three groups than between logos inside a group.
.footer-payment-badges {
  display: flex;
  align-items: center;
  gap: 28px;
  flex-wrap: wrap;
}

.footer-payment-group {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.footer-payment-link {
  display: flex;
  align-items: center;
}

.footer-payment-logo {
  height: 22px;
  width: auto;
  display: block;
  opacity: 0.85;
  transition: opacity 0.15s ease;
}

.footer-payment-logo-square {
  height: 38px;
}

.footer-payment-link:hover .footer-payment-logo {
  opacity: 1;
}
</style>
