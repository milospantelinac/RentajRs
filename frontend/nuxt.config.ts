export default defineNuxtConfig({
  compatibilityDate: '2024-09-01',
  devtools: { enabled: false },

  // Without this, Nuxt tracks "the current app instance" via a plain mutable
  // variable instead of AsyncLocalStorage — safe only for composable calls
  // made *before* the first await in a request. Any composable call after an
  // await (e.g. stores/auth.js calling useApi() after `await withCookies()`)
  // then either throws "called outside a plugin" or, worse, under concurrent
  // SSR requests silently reads a different request's context. This is what
  // caused a logged-in user's cookies to be read correctly but the follow-up
  // /users/me call to fail, leaving them looking logged-out after a full
  // page load despite valid tokens.
  experimental: { asyncContext: true },

  css: ['~/assets/scss/main.scss'],

  app: {
    head: {
      titleTemplate: '%s · Rentaj',
      htmlAttrs: { lang: 'sr-Latn-RS' },
      link: [
        { rel: 'icon', type: 'image/png', href: '/favicon.png' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Funnel+Sans:wght@300;400;500;600;700&display=swap',
        },
      ],
    },
  },

  runtimeConfig: {
    // Server-side only (SSR fetches use this — resolves inside the Docker
    // network to the backend container; falls back to the public URL for
    // non-docker local dev).
    apiBaseInternal: process.env.NUXT_API_BASE_INTERNAL || 'http://localhost:3001/api/v1',
    public: {
      // Exposed to the browser — must be reachable from the visitor's machine.
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:3001/api/v1',
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'https://rentaj.rs',
      googleMapsApiKey: process.env.NUXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    },
  },

  modules: ['@pinia/nuxt', '@nuxtjs/i18n', '@nuxt/image', '@nuxtjs/sitemap', '@nuxtjs/robots'],

  // Components live in subdirectories (layout/, ui/, listings/, search/, ...)
  // purely for developer organization; pathPrefix:false keeps their tag
  // names flat (<AppHeader>, not <LayoutAppHeader>). Filenames are kept
  // globally unique across subdirectories to avoid collisions under this
  // setting — see DOCUMENTATION.md "Frontend structure".
  components: [{ path: '~/components', pathPrefix: false }],

  i18n: {
    // v10 defaults to looking for translation files under i18n/locales/;
    // restructureDir:false keeps the flatter <root>/locales/ layout used
    // throughout this project instead of introducing a second i18n/ folder.
    restructureDir: false,
    locales: [{ code: 'sr', language: 'sr-Latn-RS', file: 'sr.json', name: 'Srpski' }],
    defaultLocale: 'sr',
    langDir: 'locales/',
    strategy: 'no_prefix',
    // R138: the switch stays present-but-disabled in the UI until English
    // copy is launch-quality; the `en` locale file exists structurally
    // (locales/en.json) so wiring it back in later is a config change, not a
    // rebuild — see components/layout/LanguageSwitcher.vue.
  },

  site: {
    url: process.env.NUXT_PUBLIC_SITE_URL || 'https://rentaj.rs',
  },

  sitemap: {
    // Per-listing/category URLs are added dynamically by
    // server/api/_sitemap-urls.ts (the @nuxtjs/sitemap v6 auto-discovered
    // path — listed explicitly here too since the module's own advice is not
    // to rely on the legacy auto-detection). Category+city combo pages
    // self-exclude via their own per-page `robots: noindex` below the R135
    // threshold (pages/[categorySlug]/[citySlug].vue) rather than a rule here.
    sources: ['/api/_sitemap-urls'],
    exclude: [
      '/kontrolna-tabla/**',
      '/admin/**',
      '/prijava',
      '/registracija',
      '/resetovanje-lozinke',
      '/zaboravljena-lozinka',
      '/potvrda-adrese',
      '/potvrda-brisanja',
      '/auth/google/callback',
    ],
  },

  robots: {
    disallow: [
      '/kontrolna-tabla',
      '/admin',
      '/prijava',
      '/registracija',
      '/resetovanje-lozinke',
      '/zaboravljena-lozinka',
      '/potvrda-adrese',
      '/potvrda-brisanja',
      '/auth',
    ],
  },

  image: {
    quality: 80,
    format: ['webp', 'avif', 'jpeg'],
  },

  nitro: {
    compressPublicAssets: true,
  },

  vite: {
    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler',
          // Makes design tokens/breakpoint mixins available in every
          // component's <style lang="scss"> block without a manual @use —
          // the single reason component styles are allowed to reference
          // $color-*/$radius-*/respond-above() directly instead of importing
          // assets/scss/main.scss (which would duplicate its global CSS).
          additionalData: `
            @use "@/assets/scss/tokens" as *;
            @use "@/assets/scss/breakpoints" as *;
          `,
        },
      },
    },
  },

  typescript: { strict: false },
});
