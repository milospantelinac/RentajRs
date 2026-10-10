<template>
  <div v-if="category && city" class="container category-city-page py-4">
    <nav class="text-muted mb-2">
      <NuxtLink to="/">{{ t('nav.home') }}</NuxtLink> /
      <NuxtLink :to="`/${category.slug}`">{{ category.name }}</NuxtLink> /
      {{ city.name }}
    </nav>
    <h1 class="text-page-title mb-4">{{ category.name }} — {{ city.name }}</h1>

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
      :title="t('category.emptyTitle', { name: `${category.name} - ${city.name}` })"
      :text="t('category.emptySubtitle')"
    >
      <NuxtLink to="/oglasi/novi" class="state-block-action">{{ t('nav.addListing') }}</NuxtLink>
    </StateBlock>
  </div>
</template>

<script setup>
// A segment with a dot is a file someone asked for, never a category or a
// city: it gets its 404 before this page renders or asks the API anything.
definePageMeta({
  validate: (route) => ![route.params.categorySlug, route.params.citySlug].some((segment) => String(segment).includes('.')),
  middleware: ['category-redirect'],
})

const { t } = useI18n()
const api = useApi()
const route = useRoute()
const config = useRuntimeConfig()

const { data: category, error: categoryError } = await useAsyncData(`cc-category-${route.params.categorySlug}`, () =>
  api.get(`/categories/${route.params.categorySlug}`),
)

// T119: the one place by its slug (there are some six thousand now); a slug
// an admin changed is redirected by the middleware before this runs.
const { data: city, error: cityError } = await useAsyncData(`cc-city-${route.params.citySlug}`, () =>
  api.get(`/locations/cities/${route.params.citySlug}`),
)

// Dizajn 50: nor does an unpublished category have city pages.
if (categoryError.value || cityError.value) throw createError(pageLoadError(categoryError.value || cityError.value, 'Not found'))
if (!category.value || category.value.published === false || !city.value) {
  throw createError({ statusCode: 404, statusMessage: 'Not found' })
}

const { data: searchResponse } = await useAsyncData(
  `cc-listings-${route.params.categorySlug}-${route.params.citySlug}`,
  () => api.post('/search', { categorySlug: route.params.categorySlug, cityId: city.value.id, pageSize: 24 }),
)
const results = computed(() => searchResponse.value?.results || [])
// Setting.listing_index_threshold (admin-editable, R135), not a hardcoded 3.
const shouldIndex = computed(() => (searchResponse.value?.total || 0) >= (searchResponse.value?.indexThreshold ?? 3))

useSeoMeta({
  title: () => `${category.value?.name} — ${city.value?.name}`,
  description: () => `${category.value?.name} u gradu ${city.value?.name} — Rentaj`,
  robots: () => (shouldIndex.value ? 'index,follow' : 'noindex,follow'),
})

useHead(() => ({
  link: [
    {
      rel: 'canonical',
      href: `${config.public.siteUrl}/${route.params.categorySlug}/${route.params.citySlug}`,
    },
  ],
}))
</script>
