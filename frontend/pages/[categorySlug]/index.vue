<template>
  <div v-if="category" class="container category-page py-4">
    <nav class="text-muted mb-2">
      <NuxtLink to="/">{{ t('nav.home') }}</NuxtLink> / {{ category.name }}
    </nav>
    <h1 class="text-page-title mb-2">{{ category.name }}</h1>
    <p v-if="category.description" class="text-body mb-4">{{ category.description }}</p>

    <div v-if="category.children?.length" class="city-chip-row mb-4">
      <NuxtLink
        v-for="sub in category.children"
        :key="sub.id"
        :to="`/${sub.slug}`"
        class="city-chip"
      >
        {{ sub.name }}
      </NuxtLink>
    </div>

    <div v-if="results.length" class="row">
      <div v-for="listing in results" :key="listing.id" class="col-6 col-md-3 mb-4">
        <ListingCard :listing="listing" />
      </div>
    </div>
    <!-- Dizajn 44: the same empty state as everywhere else, in the card the
         cards would fill. -->
    <StateBlock
      v-else
      card
      icon="listings"
      :title="t('category.emptyTitle', { name: category.name })"
      :text="t('category.emptySubtitle')"
    >
      <NuxtLink to="/oglasi/novi" class="state-block-action">{{ t('nav.addListing') }}</NuxtLink>
    </StateBlock>

    <div v-if="cities.length" class="city-links mt-4">
      <h2 class="text-section-title mb-2">{{ t('category.browseByCity') }}</h2>
      <div class="city-chip-row">
        <NuxtLink
          v-for="city in cities"
          :key="city.id"
          :to="`/${route.params.categorySlug}/${city.slug}`"
          class="city-chip"
        >
          {{ city.name }}
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup>
// A segment with a dot is a file a browser or crawler asked for
// (apple-touch-icon-precomposed.png, wp-login.php), never a category: it gets
// its 404 before this page renders or asks the API anything.
definePageMeta({
  validate: (route) => !String(route.params.categorySlug).includes('.'),
  middleware: ['category-redirect'],
})

const { t } = useI18n()
const api = useApi()
const route = useRoute()
const config = useRuntimeConfig()

const { data: category, error: categoryError } = await useAsyncData(`category-${route.params.categorySlug}`, () =>
  api.get(`/categories/${route.params.categorySlug}`),
)

// Dizajn 50: a category the admin hasn't published (Ostalo until the owner
// does) has no page of its own; the endpoint still answers for the wizard.
if (categoryError.value) throw createError(pageLoadError(categoryError.value, 'Category not found'))
if (!category.value || category.value.published === false) {
  throw createError({ statusCode: 404, statusMessage: 'Category not found' })
}

const { data: searchResponse } = await useAsyncData(`category-listings-${route.params.categorySlug}`, () =>
  api.post('/search', { categorySlug: route.params.categorySlug, pageSize: 24 }),
)
const results = computed(() => searchResponse.value?.results || [])

// The category+city combo pages (Ch.14.3) have no other internal link
// pointing at them — this is that link, and it doubles as the only
// discovery path a crawler has short of the sitemap.
const { data: citiesData } = await useAsyncData(`category-cities-${route.params.categorySlug}`, () =>
  api.get(`/search/indexed-cities?categorySlug=${route.params.categorySlug}`),
)
const cities = computed(() => citiesData.value || [])

// R135 — only indexed once the category clears the admin-configured
// threshold (Setting.listing_index_threshold, default 3); below that it's
// still browsable, just tagged noindex so a thin page doesn't hurt the
// whole domain's SEO.
const shouldIndex = computed(() => (searchResponse.value?.total || 0) >= (searchResponse.value?.indexThreshold ?? 3))

useSeoMeta({
  title: () => category.value?.name,
  description: () => category.value?.description?.slice(0, 160) || `${category.value?.name} — Rentaj`,
  robots: () => (shouldIndex.value ? 'index,follow' : 'noindex,follow'),
})

useHead(() => ({
  link: [{ rel: 'canonical', href: `${config.public.siteUrl}/${route.params.categorySlug}` }],
}))
</script>

<style lang="scss" scoped>
.category-page {
  min-height: 60vh;
}

.city-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.city-chip {
  display: inline-block;
  padding: 6px 14px;
  border-radius: $radius-pill;
  border: 1px solid $color-border;
  background: $color-surface;
  color: $color-text;
  font-size: $font-size-muted;

  &:hover {
    border-color: $color-primary;
    color: $color-primary;
  }
}
</style>
