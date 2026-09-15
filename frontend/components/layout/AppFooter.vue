<template>
  <footer class="site-footer">
    <div class="container">
      <div class="footer-top">
        <div class="footer-brand">
          <NuxtLink to="/" class="site-logo">
            <img src="/images/rentaj-logo.svg" :alt="t('common.appName')" class="site-logo-img" />
          </NuxtLink>
          <p class="footer-tagline">{{ t('footer.description') }}</p>
          <div class="footer-social">
            <a href="https://www.linkedin.com" target="_blank" rel="noopener" class="footer-social-btn" aria-label="LinkedIn">
              <svg viewBox="0 0 38.9513 38.9513" fill="none">
                <path
                  d="M27.9141 27.9148V21.8517C27.9141 18.8719 27.2727 16.5957 23.7963 16.5957C22.1201 16.5957 21.0027 17.5062 20.5475 18.3753H20.5061V16.8648H17.216V27.9148H20.651V22.4311C20.651 20.9826 20.9199 19.5963 22.6995 19.5963C24.4585 19.5963 24.4791 21.2309 24.4791 22.5139V27.894H27.9141V27.9148Z"
                  fill="currentColor"
                />
                <path d="M11.6299 16.8647H15.0649V27.9147H11.6299V16.8647Z" fill="currentColor" />
                <path
                  d="M13.3469 11.3599C12.2501 11.3599 11.3604 12.2497 11.3604 13.3464C11.3604 14.4431 12.2501 15.3536 13.3469 15.3536C14.4436 15.3536 15.3334 14.4431 15.3334 13.3464C15.3334 12.2497 14.4436 11.3599 13.3469 11.3599Z"
                  fill="currentColor"
                />
              </svg>
            </a>
            <a href="https://www.instagram.com" target="_blank" rel="noopener" class="footer-social-btn" aria-label="Instagram">
              <svg viewBox="0 0 38.9513 38.9513" fill="none">
                <path
                  fill-rule="evenodd"
                  clip-rule="evenodd"
                  d="M15.1652 29.0942C16.6043 29.1816 18.0416 29.216 19.4761 29.2128C20.9105 29.216 22.348 29.1816 23.787 29.0942C24.9989 29.0205 26.1486 28.6191 27.1072 27.8373C28.0305 27.0844 28.6097 26.0759 28.8979 24.9462C29.1644 23.9026 29.1787 22.8535 29.1917 21.9059L29.192 21.8872C29.2029 21.0858 29.212 20.2817 29.2139 19.4769V19.4751V19.4733C29.212 18.6685 29.2029 17.8645 29.192 17.0631L29.1917 17.0444C29.1787 16.0968 29.1643 15.0477 28.8979 14.004C28.6097 12.8743 28.0305 11.8658 27.1072 11.1129C26.1486 10.3312 24.9989 9.92985 23.787 9.85617C22.348 9.76866 20.9105 9.73417 19.4761 9.73753C18.0416 9.73417 16.6043 9.76866 15.1652 9.85617C13.9533 9.92985 12.8036 10.3312 11.845 11.1129C10.9217 11.8658 10.3424 12.8743 10.0542 14.004C9.78778 15.0479 9.77345 16.0971 9.76052 17.0447L9.76027 17.0631C9.7493 17.8645 9.74016 18.6685 9.73828 19.4733V19.4751V19.4769C9.74016 20.2817 9.7493 21.0858 9.76027 21.8872L9.76052 21.9055C9.77345 22.8532 9.78778 23.9024 10.0542 24.9463C10.3424 26.0759 10.9217 27.0844 11.845 27.8373C12.8036 28.6191 13.9533 29.0205 15.1652 29.0942ZM19.4743 27.6913C18.0657 27.6945 16.6603 27.6607 15.2576 27.5754C14.3265 27.5187 13.4907 27.2161 12.8066 26.6582C12.171 26.1399 11.7483 25.4313 11.5285 24.5701C11.3121 23.7221 11.2951 22.8456 11.2817 21.8664C11.2708 21.0674 11.2617 20.2707 11.2599 19.4751C11.2617 18.6795 11.2708 17.8828 11.2817 17.0838C11.2951 16.1047 11.3121 15.2282 11.5285 14.3802C11.7483 13.519 12.171 12.8104 12.8066 12.2921C13.4907 11.7343 14.3265 11.4315 15.2576 11.3749C16.6603 11.2896 18.0657 11.2557 19.4743 11.2591H19.4761H19.4779C20.8863 11.2557 22.292 11.2896 23.6945 11.3749C24.6258 11.4315 25.4615 11.7343 26.1455 12.2921C26.7811 12.8103 27.2039 13.519 27.4236 14.3802C27.64 15.2281 27.657 16.1047 27.6705 17.0838C27.6814 17.8828 27.6905 18.6794 27.6924 19.4751C27.6905 20.2709 27.6814 21.0674 27.6705 21.8664C27.657 22.8456 27.64 23.7221 27.4236 24.5701C27.2039 25.4313 26.7811 26.1399 26.1455 26.6582C25.4615 27.2161 24.6258 27.5187 23.6945 27.5754C22.292 27.6607 20.8863 27.6945 19.4779 27.6913H19.4761H19.4743Z"
                  fill="currentColor"
                />
                <path
                  fill-rule="evenodd"
                  clip-rule="evenodd"
                  d="M14.7471 19.4749C14.7471 22.0871 16.8647 24.2048 19.4769 24.2048C22.0891 24.2048 24.2067 22.0871 24.2067 19.4749C24.2067 16.8628 22.0891 14.7451 19.4769 14.7451C16.8647 14.7451 14.7471 16.8628 14.7471 19.4749ZM19.4769 22.6912C17.7006 22.6912 16.2607 21.2513 16.2607 19.4749C16.2607 17.6986 17.7006 16.2587 19.4769 16.2587C21.2533 16.2587 22.6932 17.6986 22.6932 19.4749C22.6932 21.2513 21.2533 22.6912 19.4769 22.6912Z"
                  fill="currentColor"
                />
                <path d="M25.8761 14.19C25.8761 14.8047 25.3779 15.3029 24.7633 15.3029C24.1486 15.3029 23.6504 14.8047 23.6504 14.19C23.6504 13.5754 24.1486 13.0771 24.7633 13.0771C25.3779 13.0771 25.8761 13.5754 25.8761 14.19Z" fill="currentColor" />
              </svg>
            </a>
            <a href="https://www.x.com" target="_blank" rel="noopener" class="footer-social-btn footer-social-btn-x" aria-label="X (Twitter)">
              <svg viewBox="0 0 35.0913 35.0913" fill="none">
                <path
                  d="M19.2154 16.2019L25.7472 8.77246H24.1994L18.5279 15.2233L13.9981 8.77246H8.77344L15.6234 18.5273L8.77344 26.3181H10.3213L16.3106 19.5059L21.0944 26.3181H26.3191L19.2154 16.2019ZM17.0953 18.6132L16.4014 17.6418L10.8791 9.91264H13.2566L17.7131 16.1504L18.4072 17.1217L24.2002 25.2298H21.8227L17.0953 18.6132Z"
                  fill="currentColor"
                />
              </svg>
            </a>
          </div>
        </div>

        <div class="footer-links">
          <div class="footer-nav-group">
            <p class="footer-nav-title">{{ t('footer.aboutGroup') }}</p>
            <NuxtLink to="/cenovnik" class="footer-link">{{ t('nav.pricing') }}</NuxtLink>
            <NuxtLink to="/politika-privatnosti" class="footer-link">{{ t('footer.privacy') }}</NuxtLink>
            <NuxtLink to="/uslovi-koriscenja" class="footer-link">{{ t('footer.termsLong') }}</NuxtLink>
            <NuxtLink to="/faq" class="footer-link">{{ t('nav.faq') }}</NuxtLink>
            <NuxtLink to="/kontakt" class="footer-link">{{ t('footer.contactCta') }}</NuxtLink>
          </div>

          <div class="footer-nav-group">
            <p class="footer-nav-title">{{ t('footer.platformGroup') }}</p>
            <NuxtLink to="/oglasi/novi" class="footer-link">{{ t('nav.addListing') }}</NuxtLink>
            <NuxtLink to="/pretraga" class="footer-link">{{ t('footer.categoriesGroup') }}</NuxtLink>
            <NuxtLink v-if="!auth.user" to="/prijava" class="footer-link">{{ t('nav.login') }}</NuxtLink>
          </div>

          <div class="footer-nav-group">
            <p class="footer-nav-title">{{ t('footer.categoriesGroup') }}</p>
            <NuxtLink v-for="category in categories" :key="category.id" :to="`/${category.slug}`" class="footer-link">
              {{ category.name }}
            </NuxtLink>
          </div>
        </div>
      </div>

      <div class="footer-payment-strip">
        <img src="/images/payment/maestro.svg" alt="Maestro" class="footer-payment-logo footer-payment-maestro" />
        <img src="/images/payment/mastercard.svg" alt="Mastercard" class="footer-payment-logo footer-payment-mastercard" />
        <img src="/images/payment/dinacard.png" alt="DinaCard" class="footer-payment-logo footer-payment-dinacard" />
        <img src="/images/payment/visa.png" alt="Visa" class="footer-payment-logo footer-payment-visa" />
        <img src="/images/payment/amex.png" alt="American Express" class="footer-payment-logo footer-payment-amex" />
        <a href="https://www.bancaintesa.rs" target="_blank" rel="noopener" class="footer-payment-link">
          <img src="/images/payment/banca-intesa.png" alt="Banca Intesa" class="footer-payment-logo footer-payment-intesa" />
        </a>
        <a href="https://www.mastercard.rs/sr-rs/korisnici/pronadite-karticu.html" target="_blank" rel="noopener" class="footer-payment-link">
          <img src="/images/payment/mastercard-id-check.png" alt="Mastercard ID Check" class="footer-payment-logo footer-payment-idcheck" />
        </a>
        <a
          href="https://rs.visa.com/pay-with-visa/security-and-assistance/protected-everywhere.html"
          target="_blank"
          rel="noopener"
          class="footer-payment-link"
        >
          <img src="/images/payment/visa-secure.png" alt="Visa Secure" class="footer-payment-logo footer-payment-visasecure" />
        </a>
      </div>

      <p class="footer-copyright">© {{ year }} {{ t('footer.rights') }}</p>
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
// Figma draws no rules anywhere in the footer — the columns are held apart by
// spacing alone. The logo sits 121px below the CTA banner's lower edge.
.site-footer {
  background: $color-surface;
  padding: 57px 0 40px;
}

.footer-top {
  display: flex;
  flex-wrap: wrap;
  gap: 40px;
  padding-bottom: 32px;
}

.footer-brand {
  flex: 1.6 1 320px;
  min-width: 280px;
}

// Figma puts the three link columns at x=604 / 853 / 1101 on the 1440 canvas,
// i.e. 249px apart starting 492px into the 1216 content column.
@include respond-above(lg) {
  .footer-top {
    flex-wrap: nowrap;
    gap: 0;
  }

  .footer-brand {
    flex: 0 0 492px;
    min-width: 0;
  }
}

.site-logo {
  display: inline-flex;
  align-items: center;
}

.site-logo-img {
  width: 130px;
  height: auto;
  display: block;
}

.footer-tagline {
  margin-top: 34px;
  color: $color-text-muted;
  font-size: 16px;
  line-height: 1.5;
  max-width: 335px;
}

.footer-social {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 47px;
}

.footer-social-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 51px;
  height: 51px;
  border-radius: $radius-pill;
  background: rgba($color-text, 0.1);
  color: $color-text;
  transition: background-color 0.15s ease;
}

.footer-social-btn:hover {
  background: rgba($color-text, 0.18);
  text-decoration: none;
}

// Figma sizes the glyph frame at ~39px inside the 51px circle (the X mark is
// drawn a shade smaller); each SVG's own viewBox centres the mark, so the
// frame size is what gets set here.
.footer-social-btn svg {
  width: 39px;
  height: 39px;
}

.footer-social-btn-x svg {
  width: 35px;
  height: 35px;
}

.footer-links {
  display: flex;
  flex: 3 1 600px;
  gap: 24px;
}

.footer-nav-group {
  flex: 1 1 0;
  min-width: 140px;
  display: flex;
  flex-direction: column;
  gap: 38px;
}

@include respond-above(lg) {
  .footer-links {
    flex: 1;
    gap: 0;
  }

  .footer-nav-group {
    flex: 0 0 249px;
    min-width: 0;
  }

  .footer-nav-group:last-child {
    flex: 1;
  }
}

.footer-nav-title {
  margin: 0 0 4px;
  color: $color-text-muted;
  font-size: 14px;
}

.footer-link {
  display: block;
  color: $color-text;
  font-size: 14px;
}

.footer-link:hover {
  color: $color-primary;
  text-decoration: none;
}

// Three fixed-min-width columns don't fit a phone screen — stack them,
// same pattern as .dashboard-body's mobile-only column stack.
@include mobile-only {
  .footer-links {
    flex-wrap: wrap;
    gap: 32px;
  }

  .footer-nav-group {
    min-width: 100%;
  }
}

// Figma's strip runs 131 → 1297 on the 1440 canvas with roughly 62px between
// marks — centred, not stretched edge to edge. Each mark keeps its own height
// from the design rather than one shared value.
.footer-payment-strip {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: center;
  gap: 28px;
  padding: 24px 0;
}

@include respond-above(lg) {
  .footer-payment-strip {
    flex-wrap: nowrap;
    gap: 52px;
  }
}

.footer-payment-link {
  display: flex;
  align-items: center;
}

// Heights measured off the Figma strip, mark by mark.
.footer-payment-logo {
  height: 24px;
  width: auto;
  display: block;
  opacity: 0.85;
  transition: opacity 0.15s ease;
}

// The comment after each value is the mark's height in the Figma strip. Three
// of the files carry transparent padding (visa fills 60% of its box, ID Check
// 50%, Visa Secure 86%), so their CSS height is scaled up to land the visible
// mark on the design's height.
.footer-payment-maestro { height: 35px; }
.footer-payment-mastercard { height: 36px; }
.footer-payment-dinacard { height: 45px; }
.footer-payment-visa { height: 48px; } // 29 visible
.footer-payment-amex { height: 48px; }
.footer-payment-intesa { height: 52px; }
.footer-payment-idcheck { height: 40px; } // 20 visible
.footer-payment-visasecure { height: 49px; } // 42 visible

// Phones can't fit eight marks in a row at full size — step them down but keep
// the relative weighting.
@include respond-below(md) {
  .footer-payment-logo {
    height: 20px;
  }

  .footer-payment-dinacard,
  .footer-payment-amex,
  .footer-payment-intesa,
  .footer-payment-visasecure {
    height: 30px;
  }
}

.footer-payment-link:hover .footer-payment-logo {
  opacity: 1;
}

.footer-copyright {
  margin: 0;
  padding-top: 24px;
  text-align: center;
  color: $color-text-muted;
  font-size: 14px;
}
</style>
