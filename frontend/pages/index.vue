<template>
  <div>
    <section class="hero">
      <div class="container">
        <div class="hero-card">
          <h1 class="hero-title">
            <span>{{ t('home.heroTitleLine1') }}</span>
            <span>{{ t('home.heroTitleLine2') }}</span>
          </h1>
          <p class="hero-subtitle">{{ t('home.heroSubtitle') }}</p>

          <!-- Full 4-field row search — tablet and up, where it fits on one line -->
          <div class="hero-search hero-search-full">
            <div class="hero-search-field">
              <label class="hero-search-label">{{ t('home.searchWhatLabel') }}</label>
              <input v-model="searchQuery" type="text" :placeholder="t('home.searchWhatPlaceholder')" class="hero-search-input" />
            </div>
            <div class="hero-search-divider" aria-hidden="true" />
            <div class="hero-search-field">
              <label class="hero-search-label">{{ t('home.searchLocationLabel') }}</label>
              <select v-model="searchCityId" class="hero-search-input hero-search-select">
                <option value="">{{ t('home.searchCityAny') }}</option>
                <option v-for="c in cities" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
            </div>
            <div class="hero-search-divider" aria-hidden="true" />
            <div class="hero-search-field">
              <label class="hero-search-label">{{ t('home.searchCategoryLabel') }}</label>
              <select v-model="searchCategorySlug" class="hero-search-input hero-search-select">
                <option value="">{{ t('home.searchCategoryAny') }}</option>
                <option v-for="cat in categories" :key="cat.id" :value="cat.slug">{{ cat.name }}</option>
              </select>
            </div>
            <div class="hero-search-divider" aria-hidden="true" />
            <div class="hero-search-field">
              <label class="hero-search-label">{{ t('home.searchPriceLabel') }}</label>
              <select v-model="searchPriceBucket" class="hero-search-input hero-search-select">
                <option v-for="bucket in priceBuckets" :key="bucket.value" :value="bucket.value">{{ bucket.label }}</option>
              </select>
            </div>
            <NuxtLink :to="searchLink" class="hero-search-btn" :aria-label="t('common.search')">
              <span aria-hidden="true">→</span>
            </NuxtLink>
          </div>

          <!-- Compact search + "Filteri" sheet trigger — mobile only -->
          <div class="hero-search-compact">
            <div class="hero-search-compact-bar">
              <input
                v-model="searchQuery"
                type="text"
                :placeholder="t('home.searchBarPlaceholder')"
                class="hero-search-compact-input"
                @keyup.enter="filtersOpen = false"
              />
              <NuxtLink :to="searchLink" class="hero-search-compact-submit" :aria-label="t('common.search')">
                <FontAwesomeIcon icon="magnifying-glass" />
              </NuxtLink>
            </div>
            <button type="button" class="hero-filters-btn" @click="filtersOpen = true">
              <FontAwesomeIcon icon="sliders" />
              {{ t('home.filtersButton') }}
            </button>
          </div>

          <Teleport to="body">
            <Transition name="sheet">
              <div v-if="filtersOpen" class="filters-sheet-backdrop" @click="filtersOpen = false">
                <div class="filters-sheet" @click.stop>
                  <span class="filters-sheet-handle" aria-hidden="true" />
                  <div class="filters-sheet-header">
                    <p class="filters-sheet-title">{{ t('home.filtersSheetTitle') }}</p>
                    <button type="button" class="filters-sheet-reset" @click="resetFilters">{{ t('home.filtersReset') }}</button>
                  </div>

                  <div class="filters-sheet-field">
                    <label class="filters-sheet-label">{{ t('home.searchWhatLabel') }}</label>
                    <input v-model="searchQuery" type="text" :placeholder="t('home.searchWhatPlaceholder')" class="filters-sheet-input" />
                  </div>
                  <div class="filters-sheet-field">
                    <label class="filters-sheet-label">{{ t('home.searchLocationLabel') }}</label>
                    <select v-model="searchCityId" class="filters-sheet-input filters-sheet-select">
                      <option value="">{{ t('home.searchCityAny') }}</option>
                      <option v-for="c in cities" :key="c.id" :value="c.id">{{ c.name }}</option>
                    </select>
                  </div>
                  <div class="filters-sheet-field">
                    <label class="filters-sheet-label">{{ t('home.searchCategoryLabel') }}</label>
                    <select v-model="searchCategorySlug" class="filters-sheet-input filters-sheet-select">
                      <option value="">{{ t('home.searchCategoryAny') }}</option>
                      <option v-for="cat in categories" :key="cat.id" :value="cat.slug">{{ cat.name }}</option>
                    </select>
                  </div>
                  <div class="filters-sheet-field">
                    <label class="filters-sheet-label">{{ t('home.searchPriceLabel') }}</label>
                    <select v-model="searchPriceBucket" class="filters-sheet-input filters-sheet-select">
                      <option v-for="bucket in priceBuckets" :key="bucket.value" :value="bucket.value">{{ bucket.label }}</option>
                    </select>
                  </div>

                  <NuxtLink :to="searchLink" class="btn btn-primary-flat btn-block filters-sheet-submit" @click="filtersOpen = false">
                    {{ t('home.filtersSubmit') }}
                  </NuxtLink>
                </div>
              </div>
            </Transition>
          </Teleport>

        </div>

        <div class="hero-categories-frame">
          <div class="hero-categories-panel">
            <NuxtLink v-for="cat in homeCategories" :key="cat.slug" :to="`/${cat.slug}`" class="hero-category-tile">
              <span class="hero-category-icon-wrap">
                <img :src="cat.icon" alt="" class="hero-category-icon" />
              </span>
              <span class="hero-category-name">{{ t(cat.labelKey) }}</span>
            </NuxtLink>
          </div>
        </div>
      </div>
    </section>

    <section class="container featured-section">
      <div class="featured-header">
        <h2 class="section-title">
          <span class="section-title-strong">{{ t('home.featuredTitleStrong') }}</span>&nbsp;<span class="section-title-light">{{ t('home.featuredTitleLight') }}</span>
        </h2>
        <NuxtLink to="/pretraga" class="featured-see-all">{{ t('home.seeAllListings') }} →</NuxtLink>
      </div>

      <p v-if="!featuredListings.length" class="text-muted">{{ t('home.noListingsYet') }}</p>
      <div v-else class="featured-grid">
        <div v-for="listing in featuredListings" :key="listing.id" class="featured-grid-item">
          <ListingCard :listing="listing" />
        </div>
      </div>
    </section>

    <section class="container possibilities-section">
      <h2 class="section-title-center">
        <span class="section-title-strong">{{ t('home.possibilitiesTitleStrong') }}</span>&nbsp;<span class="section-title-light">{{ t('home.possibilitiesTitleLight') }}</span>
      </h2>

      <div class="possibilities-grid">
        <div class="possibilities-list">
          <button
            v-for="(feature, index) in features"
            :key="feature.titleKey"
            class="possibility-item"
            :class="{ 'possibility-item-active': activeFeature === index }"
            @click="activeFeature = index"
          >
            <span class="possibility-number">{{ String(index + 1).padStart(2, '0') }}</span>
            <span class="possibility-title">{{ t(feature.titleKey) }}</span>
          </button>
        </div>

        <div class="possibilities-showcase">
          <span class="possibilities-showcase-watermark">{{ String(activeFeature + 1).padStart(2, '0') }}</span>
          <p class="possibilities-showcase-title">{{ t(features[activeFeature].titleKey) }}</p>
          <p class="possibilities-showcase-text">{{ t(features[activeFeature].textKey) }}</p>

          <div class="possibilities-mockup">
            <div class="possibilities-mockup-header">
              <div>
                <p class="possibilities-mockup-label">{{ t('home.mockupGuestPayment') }}</p>
                <p class="possibilities-mockup-name">{{ t('home.mockupGuestName') }}</p>
              </div>
              <span class="possibilities-mockup-status">✓ {{ t('home.mockupStatus') }}</span>
            </div>
            <div class="possibilities-mockup-body">
              <p class="possibilities-mockup-amount">{{ t('home.mockupAmount') }}</p>
              <p class="possibilities-mockup-note">{{ t('home.mockupAmountNote') }}</p>
              <span class="possibilities-mockup-commission">{{ t('home.mockupCommission') }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section v-if="videoEmbedUrl" class="container video-section">
      <h2 class="section-title-center">
        <span class="section-title-light">{{ t('home.howItWorksVideoTitleStrong') }}</span>&nbsp;<span class="section-title-strong">{{ t('home.howItWorksVideoTitleLight') }}</span>
      </h2>
      <div class="video-frame">
        <iframe
          v-if="videoEmbedUrl.type === 'iframe'"
          :src="videoEmbedUrl.src"
          class="video-iframe"
          title="Rentaj"
          frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
        />
        <video v-else :src="videoEmbedUrl.src" class="video-native" controls />
      </div>
    </section>

    <section class="container faq-section">
      <div class="faq-section-grid">
        <h2 class="section-title">
          <span class="section-title-strong">{{ t('home.faqSectionTitleStrong') }}</span>&nbsp;<span class="section-title-light">{{ t('home.faqSectionTitleLight') }}</span>
        </h2>
        <FaqAccordion :limit="6" />
      </div>
    </section>

    <section class="container">
      <div class="cta-banner">
        <div class="cta-banner-rings" aria-hidden="true">
          <span class="cta-ring cta-ring-1" />
          <span class="cta-ring cta-ring-2" />
          <span class="cta-ring cta-ring-3" />
        </div>
        <h2 class="cta-title">{{ t('home.ctaTitle') }}</h2>
        <p class="cta-text">{{ t('home.ctaText') }}</p>
        <NuxtLink to="/oglasi/novi" class="btn btn-tertiary cta-btn">{{ t('home.ctaButton') }}</NuxtLink>
      </div>
    </section>
  </div>
</template>

<script setup>
const { t } = useI18n()
const api = useApi()

const searchQuery = ref('')
const searchCategorySlug = ref('')
const searchCityId = ref('')
const searchPriceBucket = ref('')
const activeFeature = ref(0)
const filtersOpen = ref(false)

function resetFilters() {
  searchQuery.value = ''
  searchCategorySlug.value = ''
  searchCityId.value = ''
  searchPriceBucket.value = ''
}

// Fixed 6-tile quick-links strip from the Figma homepage design — a curated
// marketing shortcut, not the full (growing, admin-managed) category list
// used in the search filter dropdown above.
const homeCategories = [
  { slug: 'prostori-za-proslave', icon: '/images/categories/prostori.svg', labelKey: 'home.categoryProstori' },
  { slug: 'nekretnine', icon: '/images/categories/nekretnine.svg', labelKey: 'home.categoryNekretnine' },
  { slug: 'igraonice', icon: '/images/categories/igraonice.svg', labelKey: 'home.categoryIgraonice' },
  { slug: 'vozila', icon: '/images/categories/vozila.svg', labelKey: 'home.categoryVozila' },
  { slug: 'magacini-i-skladista', icon: '/images/categories/magacini.svg', labelKey: 'home.categoryMagacini' },
  { slug: 'gradjevinske-masine', icon: '/images/categories/masine.svg', labelKey: 'home.categoryMasine' },
]

// Admin-set via /admin/sadrzaj (Setting key homepage_video_url) — the
// section only renders once a URL is actually set (RNT-052: an empty
// placeholder here used to show a black box with no video).
const { data: videoData } = await useAsyncData('homepage-video-url', () => api.get('/homepage-video-url'))
const videoEmbedUrl = computed(() => {
  const url = videoData.value?.url
  if (!url) return null
  if (/\.(mp4|webm|ogg)$/i.test(url)) return { type: 'video', src: url }

  const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]+)/)
  if (youtubeMatch) return { type: 'iframe', src: `https://www.youtube.com/embed/${youtubeMatch[1]}` }

  const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  if (vimeoMatch) return { type: 'iframe', src: `https://player.vimeo.com/video/${vimeoMatch[1]}` }

  return { type: 'iframe', src: url }
})

const priceBuckets = computed(() => [
  { value: '', label: t('home.searchPriceLabel') },
  { value: '0-3000', label: '0 – 3.000 RSD' },
  { value: '3000-10000', label: '3.000 – 10.000 RSD' },
  { value: '10000-30000', label: '10.000 – 30.000 RSD' },
  { value: '30000-', label: '30.000+ RSD' },
])

const features = [
  { titleKey: 'home.feature1Title', textKey: 'home.feature1Text' },
  { titleKey: 'home.feature2Title', textKey: 'home.feature2Text' },
  { titleKey: 'home.feature3Title', textKey: 'home.feature3Text' },
  { titleKey: 'home.feature4Title', textKey: 'home.feature4Text' },
  { titleKey: 'home.feature5Title', textKey: 'home.feature5Text' },
  { titleKey: 'home.feature6Title', textKey: 'home.feature6Text' },
]

// One useAsyncData covering everything the page needs, fetched concurrently.
const { data: homeData } = await useAsyncData('home-page-data', async () => {
  const [categories, cities, search] = await Promise.all([
    api.get('/categories'),
    api.get('/locations/cities'),
    api.post('/search', { sort: 'newest', page: 1, pageSize: 8 }),
  ])
  return { categories, cities, featuredListings: search.results }
})

const categories = computed(() => homeData.value?.categories || [])
const cities = computed(() => homeData.value?.cities || [])
const featuredListings = computed(() => homeData.value?.featuredListings || [])

const searchLink = computed(() => {
  const params = new URLSearchParams()
  if (searchQuery.value) params.set('q', searchQuery.value)
  if (searchCategorySlug.value) params.set('categorySlug', searchCategorySlug.value)
  if (searchCityId.value) params.set('cityId', searchCityId.value)
  if (searchPriceBucket.value) {
    const [min, max] = searchPriceBucket.value.split('-')
    if (min) params.set('priceMin', min)
    if (max) params.set('priceMax', max)
  }
  const qs = params.toString()
  return qs ? `/pretraga?${qs}` : '/pretraga'
})

useSeoMeta({
  title: 'Rentaj — Oglasi. Rezervacije. Jedno mesto.',
  description: 'Rentaj je platforma koja spaja oglasnik i rezervacioni sistem, bez provizije.',
  ogTitle: 'Rentaj',
  ogDescription: 'Rentaj je platforma koja spaja oglasnik i rezervacioni sistem, bez provizije.',
})

useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'Rentaj',
        url: 'https://rentaj.rs',
        potentialAction: {
          '@type': 'SearchAction',
          target: 'https://rentaj.rs/pretraga?q={search_term_string}',
          'query-input': 'required name=search_term_string',
        },
      }),
    },
  ],
})
</script>

<style lang="scss" scoped>
.hero {
  padding: 24px 0;
}

.hero-card {
  background: $gradient-marketing;
  border-radius: 30px;
  padding: 64px 32px 48px;
  text-align: center;
  color: $color-surface;
}

.hero-title {
  display: flex;
  flex-direction: column;
  font-weight: 400;
  font-size: 40px;
  line-height: 1.15;
  margin: 0 0 16px;
  color: $color-surface;
}

@include respond-above(md) {
  .hero-title {
    font-size: 64px;
  }
}

.hero-subtitle {
  font-size: $font-size-body;
  opacity: 0.9;
  margin: 0 0 32px;
}

.hero-search {
  border-radius: 14px;
  max-width: 900px;
  margin: 0 auto 40px;
}

// The 4-field row only has room to breathe from lg up — below that it's
// replaced by the compact bar + "Filteri" sheet (.hero-search-compact).
.hero-search-full {
  display: none;
}

@include respond-above(lg) {
  .hero-search-full {
    display: flex;
    align-items: center;
    background: $color-background;
    padding: 10px 10px 10px 24px;
    gap: 8px;
  }
}

.hero-search-field {
  flex: 1;
  text-align: left;
  padding: 8px 12px;
}

.hero-search-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: -0.02em;
  color: $color-text;
  margin-bottom: 2px;
}

.hero-search-input {
  border: none;
  background: none;
  padding: 0;
  width: 100%;
  font-size: $font-size-body;
  color: $color-text-muted;
}

.hero-search-input:focus {
  outline: none;
}

.hero-search-select {
  appearance: none;
  color: $color-text-muted;
}

.hero-search-divider {
  display: none;
  width: 1px;
  height: 34px;
  background: $color-border;
}

@include respond-above(lg) {
  .hero-search-divider {
    display: block;
  }
}

.hero-search-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: $radius-input;
  background: $color-surface;
  color: $color-text;
  font-size: 20px;
  flex-shrink: 0;
  box-shadow: $shadow-card;
  margin: 0 auto;
}

@include respond-above(lg) {
  .hero-search-btn {
    margin: 0;
  }
}

.hero-search-btn:hover {
  text-decoration: none;
}

// Compact search bar + "Filteri" button — mobile only. Below lg the full
// 4-field row doesn't fit, so search collapses to one input here and the
// rest of the fields move into the .filters-sheet bottom sheet.
.hero-search-compact {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 900px;
  margin: 0 auto 40px;
}

@include respond-above(lg) {
  .hero-search-compact {
    display: none;
  }
}

.hero-search-compact-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  background: $color-surface;
  border-radius: $radius-input;
  padding: 4px 4px 4px 16px;
}

.hero-search-compact-input {
  flex: 1;
  border: none;
  background: none;
  padding: 12px 0;
  font-size: $font-size-body;
  color: $color-text;
  min-width: 0;
}

.hero-search-compact-input:focus {
  outline: none;
}

.hero-search-compact-input::placeholder {
  color: $color-text-muted;
}

.hero-search-compact-submit {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: $radius-button;
  background: $color-primary;
  color: $color-surface;
  flex-shrink: 0;
}

.hero-search-compact-submit:hover {
  text-decoration: none;
  background: $color-dark;
}

.hero-filters-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: $radius-input;
  background: $color-surface;
  color: $color-text;
  font-weight: 600;
  font-size: $font-size-body;
  cursor: pointer;
}

// Filters bottom sheet -------------------------------------------------
.filters-sheet-backdrop {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: flex-end;
  background: rgba(6, 27, 49, 0.45);
  z-index: $z-modal;
}

.filters-sheet {
  width: 100%;
  max-height: 85vh;
  overflow-y: auto;
  padding: 10px 20px calc(20px + env(safe-area-inset-bottom));
  background: $color-surface;
  border-radius: 20px 20px 0 0;
  box-shadow: 0 -8px 24px rgba(15, 27, 51, 0.12);
}

.filters-sheet-handle {
  display: block;
  width: 36px;
  height: 4px;
  margin: 4px auto 16px;
  border-radius: $radius-pill;
  background: $color-border;
}

.filters-sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.filters-sheet-title {
  font-size: $font-size-page-title;
  font-weight: 600;
  color: $color-text;
  margin: 0;
}

.filters-sheet-reset {
  border: none;
  background: none;
  color: $color-primary;
  font-weight: 500;
  font-size: $font-size-muted;
  cursor: pointer;
}

.filters-sheet-field {
  padding: 14px 0;
  border-top: 1px solid $color-border;
}

.filters-sheet-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: -0.02em;
  color: $color-text-muted;
  margin-bottom: 6px;
}

.filters-sheet-input {
  border: none;
  background: none;
  padding: 0;
  width: 100%;
  font-size: $font-size-body;
  color: $color-text;
}

.filters-sheet-input:focus {
  outline: none;
}

.filters-sheet-input::placeholder {
  color: $color-text-muted;
}

.filters-sheet-select {
  appearance: none;
}

.filters-sheet-submit {
  margin-top: 20px;
}

.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.2s ease;
}

.sheet-enter-active .filters-sheet,
.sheet-leave-active .filters-sheet {
  transition: transform 0.22s ease;
}

.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}

.sheet-enter-from .filters-sheet,
.sheet-leave-to .filters-sheet {
  transform: translateY(100%);
}

// Quick-categories strip — a card that floats over the hero's bottom edge
// (negative margin pulls it up), white "border" wrapping a lighter F9FAFD
// panel per the Figma spec. Row on desktop, 2-column grid on mobile.
.hero-categories-frame {
  position: relative;
  z-index: 1;
  max-width: 900px;
  margin: -36px auto 0;
  padding: 8px;
  background: $color-surface;
  border-radius: 20px;
  box-shadow: 0 16px 32px rgba(15, 27, 51, 0.1);
}

@include respond-above(lg) {
  .hero-categories-frame {
    margin-top: -56px;
  }
}

.hero-categories-panel {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px 12px;
  background: $color-background;
  border-radius: 12px;
  padding: 24px 16px;
}

@include respond-above(lg) {
  .hero-categories-panel {
    grid-template-columns: repeat(6, 1fr);
    gap: 8px;
    padding: 28px 32px;
  }
}

.hero-category-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  color: $color-text;
  text-align: center;
}

.hero-category-tile:hover {
  text-decoration: none;
}

.hero-category-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 60px;
  height: 60px;
  border-radius: 14px;
  background: $color-surface;
  box-shadow: 0 2px 6px rgba(15, 27, 51, 0.06);
}

.hero-category-icon {
  width: 26px;
  height: 26px;
}

.hero-category-name {
  font-weight: 600;
  font-size: $font-size-muted;
  color: $color-text;
}

// Section titles reused across the page ----------------------------------
.section-title {
  font-size: 32px;
  font-weight: 400;
  margin: 0;
}

.section-title-center {
  font-size: 32px;
  font-weight: 400;
  margin: 0 0 40px;
  text-align: center;
}

@include respond-above(md) {
  .section-title,
  .section-title-center {
    font-size: 42px;
  }
}

.section-title-strong {
  color: $color-text;
}

.section-title-light {
  color: $color-text-muted;
}

// Featured listings --------------------------------------------------------
.featured-section {
  padding-top: 56px;
  padding-bottom: 56px;
}

.featured-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
}

.featured-see-all {
  color: $color-text;
  font-weight: 500;
  font-size: $font-size-body;
  white-space: nowrap;
}

.featured-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

// Grid items default to min-width: auto, so a nowrap-truncated title inside
// still reports its full unwrapped text as the item's minimum content size —
// the column (and the page) grows to fit it instead of the ellipsis kicking in.
.featured-grid-item {
  min-width: 0;
}

@include respond-above(md) {
  .featured-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

// Possibilities / feature list ---------------------------------------------
.possibilities-section {
  padding-top: 56px;
  padding-bottom: 56px;
}

.possibilities-grid {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

@include respond-above(lg) {
  .possibilities-grid {
    flex-direction: row;
    align-items: stretch;
  }
}

.possibilities-list {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.possibility-item {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 18px 8px;
  border: none;
  border-bottom: 1px solid $color-border;
  background: none;
  text-align: left;
  cursor: pointer;
}

.possibility-number {
  font-size: 24px;
  font-weight: 500;
  color: $color-text-muted;
  width: 40px;
  flex-shrink: 0;
}

.possibility-title {
  font-size: $font-size-page-title;
  color: $color-text;
}

.possibility-item-active {
  background: $color-background;
  border-color: $color-primary;
  border-radius: $radius-card;
}

.possibility-item-active .possibility-number,
.possibility-item-active .possibility-title {
  color: $color-primary;
}

.possibilities-showcase {
  position: relative;
  flex: 1;
  overflow: hidden;
  border-radius: 25px;
  background: $gradient-marketing;
  color: $color-surface;
  padding: 32px;
  display: flex;
  flex-direction: column;
}

.possibilities-showcase-watermark {
  position: absolute;
  top: -20px;
  right: 16px;
  font-size: 160px;
  font-weight: 500;
  opacity: 0.1;
  line-height: 1;
}

.possibilities-showcase-title {
  font-size: 26px;
  font-weight: 500;
  margin: 0 0 12px;
  position: relative;
}

.possibilities-showcase-text {
  font-size: $font-size-body;
  opacity: 0.9;
  max-width: 380px;
  margin: 0 0 24px;
  position: relative;
}

.possibilities-mockup {
  background: $color-surface;
  border-radius: $radius-card;
  padding: 20px;
  margin-top: auto;
  position: relative;
}

.possibilities-mockup-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 16px;
  border-bottom: 1px solid $color-border;
}

.possibilities-mockup-label {
  color: $color-text-muted;
  font-size: $font-size-muted;
  margin: 0 0 4px;
}

.possibilities-mockup-name {
  color: $color-text;
  font-weight: 500;
  font-size: $font-size-page-title;
  margin: 0;
}

.possibilities-mockup-status {
  background: #cdfad1;
  color: #1db82b;
  font-weight: 500;
  font-size: $font-size-muted;
  padding: 8px 14px;
  border-radius: $radius-pill;
  white-space: nowrap;
}

.possibilities-mockup-body {
  padding-top: 16px;
}

.possibilities-mockup-amount {
  font-size: 24px;
  font-weight: 500;
  color: $color-text;
  margin: 0 0 6px;
}

.possibilities-mockup-note {
  color: $color-text-muted;
  font-size: $font-size-muted;
  margin: 0 0 12px;
}

.possibilities-mockup-commission {
  display: inline-block;
  background: $color-background;
  color: $color-primary;
  font-weight: 500;
  font-size: $font-size-muted;
  padding: 6px 14px;
  border-radius: $radius-pill;
}

// Video section -------------------------------------------------------------
.video-section {
  padding: 56px 0;
}

.video-frame {
  position: relative;
  height: 420px;
  border-radius: 30px;
  background: $color-dark;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.video-iframe,
.video-native {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: none;
}

// FAQ -------------------------------------------------------------------
.faq-section {
  padding-top: 56px;
  padding-bottom: 56px;
}

.faq-section-grid {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

@include respond-above(lg) {
  .faq-section-grid {
    flex-direction: row;
  }

  .faq-section-grid > .section-title {
    flex: 0 0 320px;
  }

  .faq-section-grid > :deep(.faq-accordion) {
    flex: 1;
  }
}

// CTA banner --------------------------------------------------------------
.cta-banner {
  position: relative;
  overflow: hidden;
  border-radius: 30px;
  background: $gradient-marketing;
  color: $color-surface;
  padding: 64px 32px;
  margin: 24px 0 64px;
}

.cta-banner-rings {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.cta-ring {
  position: absolute;
  right: -80px;
  top: 50%;
  transform: translateY(-50%);
  border-radius: $radius-pill;
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.cta-ring-1 {
  width: 500px;
  height: 500px;
  right: -160px;
}

.cta-ring-2 {
  width: 350px;
  height: 350px;
  right: -80px;
}

.cta-ring-3 {
  width: 200px;
  height: 200px;
  right: 0;
}

.cta-title {
  position: relative;
  font-size: 32px;
  font-weight: 400;
  max-width: 600px;
  margin: 0 0 16px;
  color: $color-surface;
}

@include respond-above(md) {
  .cta-title {
    font-size: 48px;
  }
}

.cta-text {
  position: relative;
  font-size: $font-size-body;
  opacity: 0.9;
  max-width: 420px;
  margin: 0 0 32px;
}

.cta-btn {
  position: relative;
  background: $color-surface;
  border-color: $color-surface;
  color: $color-text;
}

.cta-btn:hover {
  background: $color-background;
  border-color: $color-background;
  color: $color-text;
}
</style>
