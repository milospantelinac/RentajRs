<template>
  <footer class="site-footer" :class="{ 'has-divider': hasDivider }">
    <div class="container">
      <div class="footer-top">
        <div class="footer-brand">
          <NuxtLink to="/" class="site-logo">
            <img src="/images/rentaj-logo.svg" :alt="t('common.appName')" class="site-logo-img" />
          </NuxtLink>
          <p class="footer-tagline">{{ t('footer.description') }}</p>
          <div class="footer-social">
            <!-- Figma 2124:3521 and 2126:3319 draw the glyph inside the whole 51 by 51 circle frame, so these two svgs fill the circle. -->
            <a href="https://www.tiktok.com/@rentaj.rs" target="_blank" rel="noopener noreferrer" class="footer-social-btn" :aria-label="t('footer.socialTikTok')">
              <svg viewBox="0 0 51 51" fill="none" class="footer-social-glyph-full">
                <path
                  d="M25.9266 15.7662C26.9909 15.75 28.0472 15.7581 29.1034 15.75C29.1684 16.9931 29.6153 18.2606 30.5253 19.1381C31.4353 20.04 32.7191 20.4544 33.9703 20.5925V23.8669C32.8003 23.8263 31.6222 23.5825 30.5578 23.0788C30.0947 22.8675 29.6641 22.5994 29.2416 22.3231C29.2334 24.6956 29.2497 27.0681 29.2253 29.4325C29.1603 30.57 28.7866 31.6994 28.1284 32.6338C27.0641 34.1938 25.2197 35.2094 23.3266 35.2419C22.1647 35.3069 21.0028 34.99 20.0116 34.405C18.3703 33.4381 17.2166 31.6669 17.0459 29.7656C17.0297 29.3594 17.0216 28.9531 17.0378 28.555C17.1841 27.0113 17.9478 25.5325 19.1341 24.525C20.4828 23.355 22.3678 22.7944 24.1309 23.1275C24.1472 24.33 24.0984 25.5325 24.0984 26.735C23.2941 26.475 22.3516 26.5481 21.6447 27.0356C21.1328 27.3688 20.7428 27.8806 20.5397 28.4575C20.3691 28.8719 20.4178 29.3269 20.4259 29.7656C20.6209 31.0981 21.9047 32.2194 23.2697 32.0975C24.1797 32.0894 25.0491 31.5612 25.5203 30.7894C25.6747 30.5212 25.8453 30.245 25.8534 29.9281C25.9347 28.4738 25.9022 27.0275 25.9103 25.5731C25.9184 22.2987 25.9022 19.0325 25.9266 15.7662Z"
                  fill="currentColor"
                />
              </svg>
            </a>
            <a href="https://www.instagram.com/rentaj.rs/" target="_blank" rel="noopener noreferrer" class="footer-social-btn" :aria-label="t('footer.socialInstagram')">
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
            <a href="https://www.facebook.com/profile.php?id=61591503981480" target="_blank" rel="noopener noreferrer" class="footer-social-btn" :aria-label="t('footer.socialFacebook')">
              <svg viewBox="0 0 51 51" fill="none" class="footer-social-glyph-full">
                <path
                  d="M31.2 16.0001H28.35C27.0902 16.0001 25.882 16.5005 24.9912 17.3913C24.1005 18.2821 23.6 19.4903 23.6 20.7501V23.6001H20.75V27.4001H23.6V35.0001H27.4V27.4001H30.25L31.2 23.6001H27.4V20.7501C27.4 20.4981 27.5001 20.2565 27.6783 20.0783C27.8564 19.9002 28.0981 19.8001 28.35 19.8001H31.2V16.0001Z"
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

      <PaymentLogos v-if="showPaymentLogos" class="footer-payment-strip" />

      <p class="footer-copyright">© {{ year }} {{ t('footer.rights') }}</p>
    </div>
  </footer>
</template>

<script setup>
const { t } = useI18n()
const auth = useAuthStore()
const route = useRoute()
const year = new Date().getFullYear()

// The homepage frames (26:12, 26:3073) end on the CTA banner and draw no rule
// over the footer; every other page frame does.
const hasDivider = computed(() => route.path !== '/')

// The bank allows one group of security marks per page (EPM 2.2), and the
// checkout shows its own strip under the order summary.
const showPaymentLogos = computed(() => route.meta.footerPaymentLogos !== false)

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
// The columns are held apart by spacing alone. The logo sits 121px below the
// CTA banner's lower edge.
.site-footer {
  background: $color-surface;
  padding: 57px 0 40px;
}

// Every page frame but the homepage draws a 1px #E4EBF2 rule across the
// content column at the footer's top edge ("Footer divider", 140:155 in
// 133:2). It takes the first of the 57 top pixels, so nothing below it moves.
.site-footer.has-divider {
  padding-top: 0;
}

.site-footer.has-divider .footer-top {
  border-top: 1px solid $color-border;
  padding-top: 56px;
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

.footer-social-btn .footer-social-glyph-full {
  width: 51px;
  height: 51px;
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

// The lg tier's content column is 912 wide, short of the 1067 these fixed
// columns take, so the footer ran past the page edge from 992 to 1199 px (a
// page scrolling sideways at 1157, T127). There the first two link columns
// give way and the last keeps its longest name; from xl up nothing changes.
@include respond-between(lg, xl) {
  .footer-nav-group {
    flex-shrink: 1;
  }

  .footer-nav-group:last-child {
    min-width: auto;
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

// Dizajn 42 (94:27, first column): on a phone the whole footer is one centred
// column. Logo 130, the text 14/1.5 in 311, 45px social circles 9 apart, then
// the three groups with every heading and link on a 43px step. The frame lays
// two headings over their first links; the groups here just keep that step
// and stand one empty step apart.
@include mobile-only {
  .footer-top {
    flex-direction: column;
    align-items: center;
    gap: 0;
    text-align: center;
  }

  .footer-brand {
    flex: none;
    width: 100%;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .footer-tagline {
    margin-top: 15.5px;
    font-size: 14px;
    max-width: 311px;
  }

  .footer-social {
    margin-top: 16px;
    gap: 9.14px;
  }

  .footer-social-btn {
    width: 45px;
    height: 45px;
  }

  .footer-social-btn svg {
    width: 34.1px;
    height: 34.1px;
  }

  // The full-frame glyphs follow the circle: 45 of 51.
  .footer-social-btn .footer-social-glyph-full {
    width: 45px;
    height: 45px;
  }

  .footer-links {
    flex: none;
    flex-direction: column;
    align-items: center;
    gap: 68px;
    margin-top: 39px;
  }

  .footer-nav-group {
    min-width: 0;
    align-items: center;
    gap: 25px;
  }

  .footer-nav-title {
    margin: 0;
  }
}

// The card marks (components/billing/PaymentLogos.vue) follow Banca Intesa's
// branding samples of 2026-10 rather than the Figma strip, which predates the
// SafeKey and DinaCard Secure marks. Only the spacing around them is the footer's.
.footer-payment-strip {
  padding: 24px 0;
}

@include respond-below(md) {
  .footer-payment-strip {
    padding-top: 31px;
  }
}

.footer-copyright {
  margin: 0;
  padding-top: 24px;
  text-align: center;
  color: $color-text-muted;
  font-size: 14px;
}
</style>
