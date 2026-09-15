<template>
  <div>
    <section class="hero">
      <div class="hero-shell">
        <div class="hero-card">
          <img src="/images/hero-logo-mark.svg" alt="" aria-hidden="true" class="hero-logo-mark" />
          <div class="hero-card-content">
          <h1 class="hero-title">
            <span>{{ t('home.heroTitleLine1') }}</span>
            <span>{{ t('home.heroTitleLine2') }}</span>
          </h1>
          <p class="hero-subtitle">{{ t('home.heroSubtitle') }}</p>

          <!-- Full 4-field row search — tablet and up, where it fits on one line.
               Figma nests a white row inside a tinted, inset-shadowed frame. -->
          <div class="hero-search">
          <div class="hero-search-full">
            <div class="hero-search-field">
              <label class="hero-search-label">{{ t('home.searchWhatLabel') }}</label>
              <input v-model="searchQuery" type="text" :placeholder="t('home.searchWhatPlaceholder')" class="hero-search-input" />
            </div>
            <div class="hero-search-divider" aria-hidden="true" />
            <div class="hero-search-field">
              <span class="hero-search-label">{{ t('home.searchLocationLabel') }}</span>
              <SelectMenu
                v-model="searchCityId"
                :options="cityOptions"
                :placeholder="t('home.searchCityAny')"
                variant="bare"
                :aria-label="t('home.searchLocationLabel')"
              />
            </div>
            <div class="hero-search-divider" aria-hidden="true" />
            <div class="hero-search-field">
              <span class="hero-search-label">{{ t('home.searchCategoryLabel') }}</span>
              <SelectMenu
                v-model="searchCategorySlug"
                :options="categoryOptions"
                :placeholder="t('home.searchCategoryAny')"
                variant="bare"
                :aria-label="t('home.searchCategoryLabel')"
              />
            </div>
            <div class="hero-search-divider" aria-hidden="true" />
            <div class="hero-search-field">
              <span class="hero-search-label">{{ t('home.searchPriceLabel') }}</span>
              <SelectMenu
                v-model="searchPriceBucket"
                :options="priceBuckets"
                :placeholder="t('home.searchPriceLabel')"
                variant="bare"
                :aria-label="t('home.searchPriceLabel')"
              />
            </div>
            <NuxtLink :to="searchLink" class="hero-search-btn" :aria-label="t('common.search')">
              <img src="/images/icons/search.svg" alt="" class="hero-search-btn-icon" />
            </NuxtLink>
          </div>
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
                    <span class="filters-sheet-label">{{ t('home.searchLocationLabel') }}</span>
                    <SelectMenu
                      v-model="searchCityId"
                      :options="cityOptions"
                      :placeholder="t('home.searchCityAny')"
                      :aria-label="t('home.searchLocationLabel')"
                    />
                  </div>
                  <div class="filters-sheet-field">
                    <span class="filters-sheet-label">{{ t('home.searchCategoryLabel') }}</span>
                    <SelectMenu
                      v-model="searchCategorySlug"
                      :options="categoryOptions"
                      :placeholder="t('home.searchCategoryAny')"
                      :aria-label="t('home.searchCategoryLabel')"
                    />
                  </div>
                  <div class="filters-sheet-field">
                    <span class="filters-sheet-label">{{ t('home.searchPriceLabel') }}</span>
                    <SelectMenu
                      v-model="searchPriceBucket"
                      :options="priceBuckets"
                      :placeholder="t('home.searchPriceLabel')"
                      :aria-label="t('home.searchPriceLabel')"
                    />
                  </div>

                  <NuxtLink :to="searchLink" class="btn btn-primary-flat btn-block filters-sheet-submit" @click="filtersOpen = false">
                    {{ t('home.filtersSubmit') }}
                  </NuxtLink>
                </div>
              </div>
            </Transition>
          </Teleport>
          </div>
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
        <NuxtLink to="/pretraga" class="featured-see-all">
          {{ t('home.seeAllListings') }}
          <img src="/images/icons/arrow.svg" alt="" class="featured-see-all-arrow" />
        </NuxtLink>
      </div>

      <p v-if="!featuredListings.length" class="text-muted">{{ t('home.noListingsYet') }}</p>
      <div v-else class="featured-grid">
        <div v-for="listing in featuredListings" :key="listing.id" class="featured-grid-item">
          <ListingCard :listing="listing" />
        </div>
      </div>
    </section>

    <section class="container possibilities-section">
      <h2 class="section-title possibilities-title">
        <span class="section-title-strong">{{ t('home.possibilitiesTitleStrong') }}</span>
        <span class="section-title-light">{{ t('home.possibilitiesTitleLight') }}</span>
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
            <span class="possibility-head">
              <span class="possibility-number">{{ String(index + 1).padStart(2, '0') }}</span>
              <span class="possibility-title">{{ t(feature.titleKey) }}</span>
            </span>
            <span v-if="activeFeature === index" class="possibility-text">{{ t(feature.textKey) }}</span>
          </button>
        </div>

        <div class="possibilities-showcase">
          <span class="possibilities-showcase-watermark">{{ String(activeFeature + 1).padStart(2, '0') }}</span>
          <span class="possibilities-showcase-icon">
            <img :src="features[activeFeature].icon" alt="" width="32" height="32" />
          </span>
          <p class="possibilities-showcase-title">{{ t(features[activeFeature].titleKey) }}</p>
          <!-- The card carries its own, shorter copy in Figma — not the list's. -->
          <p class="possibilities-showcase-text">{{ t(features[activeFeature].cardTextKey) }}</p>

          <div class="possibilities-mockup">
            <div class="possibilities-mockup-header">
              <img src="/images/home/guest-avatar.png" alt="" class="possibilities-mockup-avatar" />
              <div class="possibilities-mockup-header-text">
                <p class="possibilities-mockup-name">{{ t('home.mockupGuestName') }}</p>
                <p class="possibilities-mockup-label">{{ t('home.mockupGuestPayment') }}</p>
              </div>
              <span class="possibilities-mockup-status">
                <img src="/images/icons/check-circle.svg" alt="" class="possibilities-mockup-status-icon" />
                {{ t('home.mockupStatus') }}
              </span>
            </div>
            <div class="possibilities-mockup-body">
              <div class="possibilities-mockup-body-text">
                <p class="possibilities-mockup-amount">{{ t('home.mockupAmount') }}</p>
                <p class="possibilities-mockup-note">{{ t('home.mockupAmountNote') }}</p>
              </div>
              <span class="possibilities-mockup-commission">{{ t('home.mockupCommission') }}</span>
            </div>
          </div>

          <div class="possibilities-dots">
            <span
              v-for="(feature, index) in features"
              :key="feature.titleKey"
              class="possibilities-dot"
              :class="{ 'possibilities-dot-active': activeFeature === index }"
            />
          </div>
        </div>
      </div>
    </section>

    <section v-if="videoEmbedUrl" class="video-section">
      <h2 class="section-title-center video-title">
        <span class="section-title-light">{{ t('home.howItWorksVideoTitleStrong') }}</span>
        <span class="section-title-strong">{{ t('home.howItWorksVideoTitleLight') }}</span>
      </h2>
      <div class="video-frame">
        <button
          v-if="videoEmbedUrl.type === 'iframe'"
          type="button"
          class="video-thumbnail"
          :style="videoEmbedUrl.thumbnail ? { backgroundImage: `url(${videoEmbedUrl.thumbnail})` } : {}"
          :aria-label="t('home.playVideo')"
          @click="openVideoModal"
        >
          <span class="video-play-icon" aria-hidden="true">
            <img src="/images/icons/play.svg" alt="" width="118" height="118" />
          </span>
        </button>
        <video v-else :src="videoEmbedUrl.src" class="video-native" controls />
      </div>
    </section>

    <Teleport to="body">
      <div v-if="videoModalOpen" class="video-modal-backdrop" @click.self="closeVideoModal">
        <div class="video-modal-frame">
          <button type="button" class="video-modal-close" :aria-label="t('common.close')" @click="closeVideoModal">
            <FontAwesomeIcon icon="xmark" />
          </button>
          <iframe
            :src="videoModalSrc"
            class="video-iframe"
            title="Rentaj"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
          />
        </div>
      </div>
    </Teleport>

    <section class="container faq-section">
      <div class="faq-section-grid">
        <h2 class="section-title">
          <span class="section-title-strong">{{ t('home.faqSectionTitleStrong') }}</span> <span class="section-title-light">{{ t('home.faqSectionTitleLight') }}</span>
        </h2>
        <FaqAccordion />
      </div>
    </section>

    <section class="cta-section">
      <div class="cta-banner">
        <div class="cta-banner-rings" aria-hidden="true">
          <span class="cta-ring cta-ring-1" />
          <span class="cta-ring cta-ring-2" />
          <span class="cta-ring cta-ring-3" />
        </div>
        <h2 class="cta-title">{{ t('home.ctaTitle') }}</h2>
        <p class="cta-text">{{ t('home.ctaText') }}</p>
        <NuxtLink to="/oglasi/novi" class="btn btn-tertiary cta-btn">
          <span class="cta-btn-icon" aria-hidden="true">
            <svg viewBox="0 0 7 11" fill="none">
              <path
                d="M0.654258 1.91787C0.29346 1.56479 0.293461 0.992339 0.654259 0.639262C1.01506 0.286185 1.60002 0.286186 1.96082 0.639263L5.88051 4.47508C6.24131 4.82815 6.24131 5.4006 5.88051 5.75368C5.51972 6.10676 4.93475 6.10676 4.57395 5.75368L0.654258 1.91787Z"
                fill="white"
              />
              <path
                d="M4.57304 4.47548C4.93383 4.12241 5.5188 4.12241 5.8796 4.47548C6.2404 4.82856 6.2404 5.40101 5.8796 5.75409L1.95991 9.5899C1.59911 9.94298 1.01414 9.94298 0.653344 9.5899C0.292546 9.23682 0.292547 8.66437 0.653344 8.3113L4.57304 4.47548Z"
                fill="white"
              />
            </svg>
          </span>
          {{ t('home.ctaButton') }}
        </NuxtLink>
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
// T01 — Nekretnine 1st, Prostori za proslave 2nd; the rest is unspecified,
// left in its prior relative order.
// Dizajn 7 — "Prostori, Nekretnine, Igraonice, Vozila, Magacini, Mašine",
// matching the Figma tile order exactly.
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

  // A poster uploaded in /admin/sadrzaj wins over the provider's own
  // thumbnail, which is low-resolution and letterboxed at this frame's size.
  const poster = videoData.value?.thumbnailUrl || null

  const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]+)/)
  if (youtubeMatch) {
    return {
      type: 'iframe',
      src: `https://www.youtube.com/embed/${youtubeMatch[1]}`,
      thumbnail: poster || `https://img.youtube.com/vi/${youtubeMatch[1]}/maxresdefault.jpg`,
    }
  }

  const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  if (vimeoMatch) return { type: 'iframe', src: `https://player.vimeo.com/video/${vimeoMatch[1]}`, thumbnail: poster }

  return { type: 'iframe', src: url, thumbnail: poster }
})

// T02 — the embed used to load (and autoplay-eligible) inline as soon as the
// section scrolled into view; now it opens full-screen only once the visitor
// actually clicks play, with ?autoplay=1 added so it starts immediately there.
const videoModalOpen = ref(false)
const videoModalSrc = computed(() => {
  if (!videoEmbedUrl.value || videoEmbedUrl.value.type !== 'iframe') return ''
  const sep = videoEmbedUrl.value.src.includes('?') ? '&' : '?'
  return `${videoEmbedUrl.value.src}${sep}autoplay=1`
})
function openVideoModal() {
  videoModalOpen.value = true
}
function closeVideoModal() {
  videoModalOpen.value = false
}
function onVideoModalKeydown(e) {
  if (e.key === 'Escape') closeVideoModal()
}
watch(videoModalOpen, (open) => {
  if (open) window.addEventListener('keydown', onVideoModalKeydown)
  else window.removeEventListener('keydown', onVideoModalKeydown)
})
onUnmounted(() => window.removeEventListener('keydown', onVideoModalKeydown))

const priceBuckets = computed(() => [
  { value: '', label: t('home.searchPriceLabel') },
  { value: '0-3000', label: '0 – 3.000 RSD' },
  { value: '3000-10000', label: '3.000 – 10.000 RSD' },
  { value: '10000-30000', label: '10.000 – 30.000 RSD' },
  { value: '30000-', label: '30.000+ RSD' },
])

// Icons are the exact SVGs exported from the six Figma showcase-card states
// (nodes 26:357, 26:1199, 26:1653, 26:2078, 26:2500, 26:3010) — white strokes
// meant to sit on the blue gradient card, so they render as plain <img>.
const features = [
  { titleKey: 'home.feature1Title', textKey: 'home.feature1Text', cardTextKey: 'home.feature1CardText', icon: '/images/home/features/direktne-rezervacije.svg' },
  { titleKey: 'home.feature2Title', textKey: 'home.feature2Text', cardTextKey: 'home.feature2CardText', icon: '/images/home/features/po-boravku-po-terminu.svg' },
  { titleKey: 'home.feature3Title', textKey: 'home.feature3Text', cardTextKey: 'home.feature3CardText', icon: '/images/home/features/rezervacioni-sistem.svg' },
  { titleKey: 'home.feature4Title', textKey: 'home.feature4Text', cardTextKey: 'home.feature4CardText', icon: '/images/home/features/poruke.svg' },
  { titleKey: 'home.feature5Title', textKey: 'home.feature5Text', cardTextKey: 'home.feature5CardText', icon: '/images/home/features/ical-sinhronizacija.svg' },
  { titleKey: 'home.feature6Title', textKey: 'home.feature6Text', cardTextKey: 'home.feature6CardText', icon: '/images/home/features/otkljucaj-kategoriju.svg' },
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

// SelectMenu takes flat { value, label } pairs so it stays independent of the
// API's shape; the leading entry is the "any" option the old <option> carried.
const cityOptions = computed(() => [
  { value: '', label: t('home.searchCityAny') },
  ...cities.value.map((c) => ({ value: c.id, label: c.name })),
])

const categoryOptions = computed(() => [
  { value: '', label: t('home.searchCategoryAny') },
  ...categories.value.map((c) => ({ value: c.slug, label: c.name })),
])

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
// Figma 26:23 — the hero card is 1378 wide with 31px margins on the 1440
// canvas, i.e. wider than the 1216 content column, so it gets its own shell
// instead of .container. It also butts straight up against the header.
.hero {
  padding: 0 0 24px;
}

.hero-shell {
  width: 100%;
  max-width: 1426px; // 1378 card + 2 x 24 padding
  margin: 0 auto;
  padding: 0 16px;

  @include respond-above(md) {
    padding: 0 24px;
  }
}

// The background is Figma's own artwork (exported from node 26:23), not a
// CSS gradient — it carries the blue wash and the soft-light overlay baked in.
.hero-card {
  position: relative;
  background-image: url('/images/home/hero-bg.jpg');
  background-size: cover;
  background-position: center;
  border-radius: 30px;
  padding: 64px 24px 100px;
  text-align: center;
  color: $color-surface;
  overflow: hidden;
}

@include respond-above(lg) {
  .hero-card {
    height: 645px;
    padding: 147px 32px 0;
  }
}

// Large faint brand mark bleeding off the right edge — the SVG already
// bakes in its own 10% opacity and is pre-cropped to the hero's own aspect
// slice (952x676 in Figma), so it's sized to the hero's full height and
// positioned by its measured right-edge gap (78px of 1273px hero width).
.hero-logo-mark {
  position: absolute;
  top: 0;
  right: 6.1%;
  height: 100%;
  width: auto;
  pointer-events: none;
}

// Stacked after the logo mark in DOM order with its own stacking context,
// so it paints above it without needing an explicit z-index.
.hero-card-content {
  position: relative;
}

// Figma 26:291 — 74/1.1 Regular, centred, pure white.
.hero-title {
  display: flex;
  flex-direction: column;
  font-weight: 400;
  font-size: 40px;
  line-height: 1.1;
  margin: 0;
  color: $color-surface;
}

@include respond-above(md) {
  .hero-title {
    font-size: 56px;
  }
}

@include respond-above(lg) {
  .hero-title {
    font-size: 74px;
  }
}

// Figma 26:292 — 20/1.1 Regular white, 22px under the title.
.hero-subtitle {
  font-size: $font-size-body;
  line-height: 1.1;
  margin: 16px 0 0;
}

@include respond-above(lg) {
  .hero-subtitle {
    font-size: 20px;
    margin-top: 22px;
  }
}

// Figma 26:293/26:294 — an 838x84 tinted frame with an inset shadow holding
// an 822x68 white row.
.hero-search {
  border-radius: 14px;
  max-width: 900px;
  margin: 32px auto 40px;
}

@include respond-above(lg) {
  .hero-search {
    max-width: 838px;
    padding: 8px;
    background: $color-background;
    box-shadow: inset 0 5px 10px rgba(32, 113, 161, 0.25);
    margin: 45px auto 0;
  }
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
    height: 68px;
    padding: 0 10px 0 14px;
    background: $color-surface;
    border-radius: 10px;
    gap: 0;
  }
}

.hero-search-field {
  flex: 1;
  min-width: 0;
  text-align: left;
  padding: 0 16px;
}

@include respond-above(lg) {
  .hero-search-field:first-child {
    padding-left: 0;
  }
}

// Figma 26:303 — 12px Medium uppercase with -0.24px tracking.
.hero-search-label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
  letter-spacing: -0.02em;
  text-transform: uppercase;
  color: $color-text;
  margin-bottom: 6px;
}

.hero-search-input {
  border: none;
  background: none;
  padding: 0;
  width: 100%;
  font-size: 14px;
  line-height: 1.1;
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

// Figma 26:298 — 48x49 white tile, radius 8, sitting on its own drop shadow
// inside the white row.
.hero-search-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 49px;
  border-radius: 8px;
  background: $color-surface;
  flex-shrink: 0;
  box-shadow: 0 4px 10px rgba(207, 207, 207, 0.5);
  margin: 0 auto;
}

.hero-search-btn-icon {
  width: 22px;
  height: 22px;
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
  font-size: 18px;
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
// Figma 26:309/26:310 — a 1113x213 white frame, radius 20, with a 14px ring
// around a tinted inner panel. It hangs 107px over the hero card's lower edge.
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
    max-width: 1113px;
    margin-top: -107px;
    padding: 14px;
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

// Figma spreads the six tiles by their own widths (space-between) rather than
// centring each in an equal column, so the outer two sit flush with the
// panel's inner padding.
@include respond-above(lg) {
  .hero-categories-panel {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0;
    padding: 39px 81px;
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
  width: 66px;
  height: 66px;
  border-radius: $radius-input;
  background: $color-surface;
  box-shadow: 0 2px 6px rgba(15, 27, 51, 0.06);
}

.hero-category-icon {
  width: 30px;
  height: 30px;
}

// Figma 26:320 — 20px Medium, 20.6px under the icon tile.
.hero-category-name {
  font-weight: 500;
  font-size: $font-size-body;
  line-height: 1.1;
  color: $color-text;
}

@include respond-above(lg) {
  .hero-category-name {
    font-size: 20px;
  }

  .hero-category-tile {
    gap: 21px;
  }
}

// Section titles reused across the page ----------------------------------
// Figma (node 26:139 and siblings): Funnel Sans Regular 48/56, -1.68px
// tracking. Mobile steps down but keeps the same 1.167 line-height ratio.
.section-title {
  font-size: 32px;
  font-weight: $font-weight-page-title;
  line-height: 1.167;
  letter-spacing: $letter-spacing-page-title;
  margin: 0;
}

.section-title-center {
  font-size: 32px;
  font-weight: $font-weight-page-title;
  line-height: 1.167;
  letter-spacing: $letter-spacing-page-title;
  margin: 0 0 40px;
  text-align: center;
}

@include respond-above(md) {
  .section-title,
  .section-title-center {
    font-size: $font-size-page-title;
    line-height: $line-height-page-title;
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
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: $color-text;
  font-weight: 500;
  font-size: $font-size-body;
  white-space: nowrap;
}

.featured-see-all-arrow {
  width: 12px;
  height: 12px;
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

// Dizajn 7 — at the width the container itself settles at its fixed 1216px
// (xxl+), the grid switches to the exact spec: 4 × 280px card with 32px
// gaps both ways (4×280 + 3×32 = 1216, exactly the content width).
@include respond-above(xxl) {
  .featured-grid {
    grid-template-columns: repeat(4, 280px);
    gap: 32px;
  }
}

// Possibilities / feature list ---------------------------------------------
// Every value below is read off the Figma nodes for this section rather than
// eyeballed: the section sits under a full-width hairline (26:290, x=112
// w=1218), the left list is 555 wide and the showcase card 631, 26px apart.
.possibilities-section {
  border-top: 1px solid $color-border;
  padding-top: 54px;
  padding-bottom: 56px;
}

// Dizajn 7 — heading is left-aligned and breaks after "…na", matching the
// Figma frame (it was centered and on one line before).
.possibilities-title {
  display: flex;
  flex-direction: column;
  margin-bottom: 38px;
}

.possibilities-grid {
  display: flex;
  flex-direction: column;
  gap: 26px;
}

@include respond-above(lg) {
  .possibilities-grid {
    flex-direction: row;
    align-items: flex-start;
  }

  // 555 + 26 gap + 631 = the 1216 Figma content width.
  .possibilities-list {
    flex: 0 0 555px;
    min-width: 0;
  }

  .possibilities-showcase {
    flex: 1;
    min-width: 0;
  }
}

.possibilities-list {
  display: flex;
  flex-direction: column;
}

// Inactive rows are a plain 78px band with a hairline under them; only the
// active one becomes a filled, outlined card carrying the description.
.possibility-item {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 78px;
  padding: 0 32px;
  border: 1px solid transparent;
  border-bottom-color: $color-border;
  border-radius: 15px;
  background: none;
  text-align: left;
  cursor: pointer;
}

// Number column 36px wide, 20px to the label (144 / 200 in the Figma frame).
.possibility-head {
  display: flex;
  align-items: center;
  gap: 20px;
}

.possibility-number {
  font-size: 32px;
  font-weight: 500;
  line-height: 1.5;
  color: $color-text;
  width: 36px;
  flex-shrink: 0;
}

.possibility-title {
  font-size: 20px;
  font-weight: 500;
  line-height: 1.5;
  color: $color-text;
}

// Starts at the padding edge, not indented under the title (Figma x=144).
.possibility-text {
  font-size: 18px;
  font-weight: 400;
  line-height: 1.5;
  color: $color-text-muted;
  margin-top: 4px;
}

.possibility-item-active {
  min-height: 152px;
  padding: 22px 32px;
  background: $color-background;
  border-color: $color-primary;
}

.possibility-item-active .possibility-number,
.possibility-item-active .possibility-title {
  color: $color-primary;
}

@include respond-below(md) {
  .possibility-number {
    font-size: 24px;
    width: 30px;
  }

  .possibility-title {
    font-size: 17px;
  }

  .possibility-text {
    font-size: $font-size-body;
  }
}

// Figma 26:356 — 631x568, radius 25, 128deg gradient, blue drop shadow. The
// bottom padding is deliberately deeper than the top: the dots sit 74px above
// the card's lower edge in the design.
.possibilities-showcase {
  position: relative;
  overflow: hidden;
  border-radius: 25px;
  background: linear-gradient(
    128.18deg,
    $color-gradient-start 0%,
    $color-gradient-mid 55%,
    $color-gradient-end 100%
  );
  box-shadow: 0 20px 40px rgba(0, 54, 246, 0.25);
  color: $color-surface;
  padding: 38px 38px 74px;
  display: flex;
  flex-direction: column;
}

// Figma 26:367 — 185.66px Medium white at 10% opacity, bleeding off the card's
// top-right corner (the card clips it).
.possibilities-showcase-watermark {
  position: absolute;
  top: -76px;
  left: 445px;
  font-size: 185.66px;
  font-weight: 500;
  line-height: 1.1;
  opacity: 0.1;
  pointer-events: none;
}

// Figma 26:357 — 80x80 glass badge, radius 15, 32px icon.
.possibilities-showcase-icon {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  border-radius: 15px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.3);

  img {
    display: block;
    width: 32px;
    height: 32px;
  }
}

.possibilities-showcase-title {
  font-size: 26px;
  font-weight: 500;
  line-height: 1.1;
  margin: 2px 0 0;
  position: relative;
}

.possibilities-showcase-text {
  font-size: 16px;
  font-weight: 300;
  line-height: 1.3;
  letter-spacing: -0.02em;
  margin: 18px 0 0;
  max-width: 355px;
  position: relative;
}

// Figma 26:368 — 555x170 white card, radius 15, 67px below the description.
.possibilities-mockup {
  background: $color-surface;
  border-radius: 15px;
  padding: 24px;
  margin-top: 67px;
  position: relative;
}

.possibilities-mockup-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid $color-border;
}

.possibilities-mockup-avatar {
  width: 49px;
  height: 49px;
  flex-shrink: 0;
  border-radius: $radius-pill;
  object-fit: cover;
}

.possibilities-mockup-header-text {
  flex: 1;
  min-width: 0;
}

.possibilities-mockup-label {
  color: #8d96a3;
  font-size: 14px;
  line-height: 1.3;
  margin: 3px 0 0;
}

.possibilities-mockup-name {
  color: #00082c;
  font-weight: 500;
  font-size: 20px;
  line-height: 1.1;
  margin: 0;
}

// Figma 26:414 — 110x40 pill, #CDFAD1 on #1DB82B, 23.5px check glyph.
.possibilities-mockup-status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 110px;
  height: 40px;
  background: #cdfad1;
  color: #1db82b;
  font-weight: 500;
  font-size: 16px;
  letter-spacing: -0.04em;
  padding: 0 15px 0 10px;
  border-radius: $radius-pill;
  white-space: nowrap;
  flex-shrink: 0;
}

.possibilities-mockup-status-icon {
  width: 23.5px;
  height: 23.5px;
}

.possibilities-mockup-body {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding-top: 10px;
}

.possibilities-mockup-body-text {
  min-width: 0;
}

.possibilities-mockup-amount {
  font-size: 26px;
  font-weight: 500;
  line-height: 1.1;
  color: #00082c;
  margin: 0 0 8px;
}

.possibilities-mockup-note {
  color: #8d96a3;
  font-size: 14px;
  line-height: 1.3;
  margin: 0;
}

// Figma 26:424 — 98x29 pill, tinted #ECF2FC with primary ink.
.possibilities-mockup-commission {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 29px;
  background: $color-accent-tint;
  color: $color-primary;
  font-weight: 500;
  font-size: 14px;
  line-height: 1.1;
  padding: 0 12px;
  border-radius: $radius-pill;
  white-space: nowrap;
  flex-shrink: 0;
}

// Figma 26:369–26:374 — six equal 30x4 dashes 2px apart, 44px under the card;
// only the colour marks the active one.
.possibilities-dots {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-top: 44px;
  position: relative;
}

.possibilities-dot {
  width: 30px;
  height: 4px;
  border-radius: $radius-pill;
  background: rgba(255, 255, 255, 0.3);
  transition: background-color 0.15s ease;
}

.possibilities-dot-active {
  background: $color-surface;
}

// Video section -------------------------------------------------------------
// Figma (nodes 26:137–26:142): the frame is 1293x653 with 46px corners, wider
// than the 1216 content column, so this section carries its own wrapper.
.video-section {
  width: 100%;
  max-width: 1341px; // 1293 frame + 2 x 24 padding
  margin: 0 auto;
  padding: 56px 16px;

  @include respond-above(md) {
    padding: 56px 24px;
  }
}

// Two centred lines — "Pogledajte kako" muted above "Rentaj funkcioniše?".
.video-title {
  margin-bottom: 56px;

  span {
    display: block;
  }
}

.video-frame {
  position: relative;
  aspect-ratio: 1293 / 653;
  border-radius: 46px;
  background: $color-dark;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

@include respond-below(md) {
  .video-frame {
    aspect-ratio: 16 / 9;
    border-radius: 20px;
  }
}

.video-iframe,
.video-native {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: none;
}

.video-thumbnail {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: none;
  padding: 0;
  cursor: pointer;
  background-color: $color-dark;
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: center;
  justify-content: center;
}

// Figma 26:141 — a 154px frosted ring around the 118px gradient play disc.
// The design puts no scrim over the poster, so there is none here either.
.video-play-icon {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 154px;
  height: 154px;
  border-radius: $radius-pill;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: linear-gradient(118.65deg, rgba(255, 255, 255, 0.15) 2%, rgba(255, 255, 255, 0.05) 98%);
  backdrop-filter: blur(9.45px);
  transition: transform 0.15s ease;
}

.video-play-icon img {
  display: block;
  width: 118px;
  height: 118px;
}

.video-thumbnail:hover .video-play-icon {
  transform: scale(1.06);
}

@include respond-below(md) {
  .video-play-icon {
    width: 96px;
    height: 96px;
  }

  .video-play-icon img {
    width: 74px;
    height: 74px;
  }
}

.video-modal-backdrop {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(6, 27, 49, 0.8);
  z-index: $z-modal;
}

.video-modal-frame {
  position: relative;
  width: 100%;
  max-width: 960px;
  aspect-ratio: 16 / 9;
  background: $color-dark;
  border-radius: $radius-card;
  overflow: hidden;
}

.video-modal-close {
  position: absolute;
  top: -40px;
  right: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  font-size: 16px;
  cursor: pointer;
  z-index: 1;
}

.video-modal-close:hover {
  background: rgba(255, 255, 255, 0.3);
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

// Figma: the accordion column is a fixed 728 flush with the right content
// edge, the heading takes the rest and wraps onto three lines.
@include respond-above(lg) {
  .faq-section-grid {
    flex-direction: row;
    justify-content: space-between;
    gap: 0;
  }

  .faq-section-grid > .section-title {
    flex: 1;
    min-width: 0;
    // Figma wraps this heading onto three lines inside a 352-wide box; at 48px
    // "Često postavljana" measures 351, so the column has to be a shade under.
    max-width: 340px;
  }

  .faq-section-grid > :deep(.faq-accordion) {
    flex: 0 0 728px;
  }
}

// CTA banner --------------------------------------------------------------
// Figma 26:905 — the CTA banner deliberately breaks out of the 1216 content
// column: it is 1338 wide with 51px side margins on the 1440 canvas, so it
// gets its own wrapper rather than the shared .container.
.cta-section {
  width: 100%;
  max-width: 1386px; // 1338 banner + 2 x 24 padding
  margin: 0 auto;
  padding: 0 16px;

  @include respond-above(md) {
    padding: 0 24px;
  }
}

.cta-banner {
  position: relative;
  overflow: hidden;
  isolation: isolate; // keeps the rings' color-burn off the page behind it
  border-radius: 30px;
  background: linear-gradient(
    210deg,
    $color-gradient-start 0%,
    $color-gradient-mid 55%,
    $color-gradient-end 100%
  );
  color: $color-surface;
  padding: 40px 24px;
  margin: 24px 0 64px;
}

@include respond-above(lg) {
  .cta-banner {
    padding: 122px 64px 121px;
  }
}

.cta-banner-rings {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

// Figma 26:1113–26:1115 — three discs sharing a centre 127px in from the
// banner's right edge and 34px below its top, lightening the gradient through
// a color-burn blend rather than drawing visible outlines.
.cta-ring {
  position: absolute;
  top: 34px;
  right: 127px;
  transform: translate(50%, -50%);
  border-radius: 50%;
  background: rgba(237, 235, 255, 0.5);
  mix-blend-mode: color-burn;
  box-shadow: inset 0 20px 40px rgba(0, 0, 0, 0.3);
}

.cta-ring-1 {
  width: 764px;
  height: 764px;
}

.cta-ring-2 {
  width: 537px;
  height: 537px;
}

.cta-ring-3 {
  width: 307px;
  height: 307px;
}

.cta-title {
  position: relative;
  font-size: 34px;
  font-weight: 400;
  line-height: 1.2;
  max-width: 660px;
  margin: 0 0 24px;
  color: $color-surface;
}

@include respond-above(lg) {
  .cta-title {
    font-size: 64px;
  }
}

.cta-text {
  position: relative;
  font-size: 18px;
  line-height: 1.5;
  max-width: 368px;
  margin: 0 0 20px;
}

// Figma 26:1249 — 163x52 tile on $color-background, radius 8, with a 33px
// gradient chevron badge 9px in from the left edge.
.cta-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  height: 52px;
  padding: 0 16px 0 9px;
  border-radius: 8px;
  background: $color-background;
  border-color: $color-background;
  font-size: 16px;
  font-weight: 500;
  color: $color-text;
}

.cta-btn:hover {
  background: $color-surface;
  border-color: $color-surface;
  color: $color-text;
}

.cta-btn-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 33px;
  height: 32px;
  border-radius: 5px;
  background: linear-gradient(
    209deg,
    $color-gradient-start 1%,
    $color-gradient-mid 72%,
    $color-gradient-end 100%
  );
  flex-shrink: 0;
}

.cta-btn-icon svg {
  width: 7px;
  height: 11px;
}
</style>
