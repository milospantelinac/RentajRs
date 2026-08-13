<template>
  <div>
    <section class="hero">
      <div class="container">
        <h1 class="text-hero mb-3">
          <span class="text-hero-strong">{{ t('home.heroTitleStrong') }}</span>
          <span class="text-hero-light"> {{ t('home.heroTitleLight') }}</span>
        </h1>
        <p class="text-body mb-4 hero-tagline">{{ t('common.tagline') }}</p>

        <div class="hero-search card">
          <div class="row align-items-center">
            <div class="col-12 col-md-4 mb-2 mb-md-0">
              <select v-model="searchCategorySlug" class="form-control form-select">
                <option value="">{{ t('home.searchCategoryAny') }}</option>
                <option v-for="cat in categories" :key="cat.id" :value="cat.slug">{{ cat.name }}</option>
              </select>
            </div>
            <div class="col-12 col-md-4 mb-2 mb-md-0">
              <select v-model="searchCityId" class="form-control form-select">
                <option value="">{{ t('home.searchCityAny') }}</option>
                <option v-for="c in cities" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
            </div>
            <div class="col-12 col-md-4">
              <NuxtLink :to="searchLink" class="btn btn-primary btn-block">{{ t('common.search') }}</NuxtLink>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="container py-md-6 py-4">
      <h2 class="text-section-title mb-3">{{ t('home.categoriesTitle') }}</h2>
      <div class="category-grid">
        <NuxtLink v-for="cat in categories" :key="cat.id" :to="`/${cat.slug}`" class="category-tile card card-interactive">
          <span class="category-tile-icon">{{ useCategoryIcon(cat.icon) }}</span>
          <span class="text-body category-tile-name">{{ cat.name }}</span>
        </NuxtLink>
      </div>
    </section>

    <section v-for="row in categoryRows" :key="row.category.id" class="container py-4">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h2 class="text-section-title">{{ t('home.featuredTitle', { name: row.category.name }) }}</h2>
        <NuxtLink :to="`/${row.category.slug}`" class="text-body">{{ t('common.seeAll') }}</NuxtLink>
      </div>
      <p v-if="!row.listings.length" class="text-muted">{{ t('home.noListingsYet') }}</p>
      <div v-else class="carousel-row">
        <div v-for="listing in row.listings" :key="listing.id" class="carousel-item">
          <ListingCard :listing="listing" />
        </div>
      </div>
    </section>

    <section class="how-it-works">
      <div class="container py-6">
        <h2 class="text-section-title mb-4">{{ t('home.howItWorksTitle') }}</h2>
        <div class="row">
          <div class="col-12 col-md-4 mb-4 mb-md-0">
            <div class="how-step">
              <span class="how-step-number">1</span>
              <p class="text-body how-step-title">{{ t('home.step1Title') }}</p>
              <p class="text-muted">{{ t('home.step1Text') }}</p>
            </div>
          </div>
          <div class="col-12 col-md-4 mb-4 mb-md-0">
            <div class="how-step">
              <span class="how-step-number">2</span>
              <p class="text-body how-step-title">{{ t('home.step2Title') }}</p>
              <p class="text-muted">{{ t('home.step2Text') }}</p>
            </div>
          </div>
          <div class="col-12 col-md-4">
            <div class="how-step">
              <span class="how-step-number">3</span>
              <p class="text-body how-step-title">{{ t('home.step3Title') }}</p>
              <p class="text-muted">{{ t('home.step3Text') }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="owner-cta">
      <div class="container py-6 text-center">
        <h2 class="text-page-title mb-2">{{ t('home.ownerCtaTitle') }}</h2>
        <p class="text-body owner-cta-text mb-4">{{ t('home.ownerCtaText') }}</p>
        <NuxtLink to="/oglasi/novi" class="btn btn-primary">{{ t('home.ownerCtaButton') }}</NuxtLink>
      </div>
    </section>
  </div>
</template>

<script setup>
const { t } = useI18n()
const api = useApi()

const searchCategorySlug = ref('')
const searchCityId = ref('')

// One useAsyncData covering everything the page needs, fetched concurrently.
const { data: homeData } = await useAsyncData('home-page-data', async () => {
  const [categories, cities] = await Promise.all([api.get('/categories'), api.get('/locations/cities')])
  const topCategories = categories.slice(0, 5)
  const rows = await Promise.all(
    topCategories.map(async (category) => {
      const res = await api.post('/search', { categorySlug: category.slug, sort: 'newest', page: 1, pageSize: 6 })
      return { category, listings: res.results }
    }),
  )
  return { categories, cities, categoryRows: rows.filter((row) => row.listings.length > 0) }
})

const categories = computed(() => homeData.value?.categories || [])
const cities = computed(() => homeData.value?.cities || [])
const categoryRows = computed(() => homeData.value?.categoryRows || [])

const searchLink = computed(() => {
  const params = new URLSearchParams()
  if (searchCategorySlug.value) params.set('categorySlug', searchCategorySlug.value)
  if (searchCityId.value) params.set('cityId', searchCityId.value)
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
  background: $gradient-marketing;
  padding: 64px 0 56px;
  color: $color-surface;
}

.hero .text-hero-strong,
.hero .text-hero-light {
  color: $color-surface;
}

.hero-tagline {
  color: rgba(255, 255, 255, 0.9);
}

.hero-search {
  padding: 16px;
  max-width: 720px;
}

.category-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

@include respond-above(md) {
  .category-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

.category-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px 12px;
  text-align: center;
}

.category-tile-icon {
  font-size: 28px;
}

.category-tile-name {
  font-weight: 600;
}

.carousel-row {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  padding-bottom: 8px;
  scroll-snap-type: x proximity;
}

.carousel-item {
  flex: 0 0 220px;
  scroll-snap-align: start;
}

.how-it-works {
  background: $color-background;
}

.how-step {
  text-align: center;
}

.how-step-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: $radius-pill;
  background: $gradient-marketing;
  color: $color-surface;
  font-weight: 700;
  margin-bottom: 12px;
}

.how-step-title {
  font-weight: 600;
  margin-bottom: 4px;
}

.owner-cta-text {
  max-width: 560px;
  margin-left: auto;
  margin-right: auto;
}
</style>
