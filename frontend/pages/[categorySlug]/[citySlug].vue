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
    <div v-else class="card">
      <div class="card-body text-center">
        <p class="text-body mb-2">{{ t('category.emptyTitle', { name: `${category.name} — ${city.name}` }) }}</p>
        <NuxtLink to="/oglasi/novi" class="btn btn-primary-flat">{{ t('nav.addListing') }}</NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup>
const { t } = useI18n()
const api = useApi()
const route = useRoute()
const config = useRuntimeConfig()

const { data: category } = await useAsyncData(`cc-category-${route.params.categorySlug}`, async () => {
  try {
    return await api.get(`/categories/${route.params.categorySlug}`)
  } catch {
    return null
  }
})

const { data: cities } = await useAsyncData('cc-cities', () => api.get('/locations/cities'))
const city = computed(() => cities.value?.find((c) => c.slug === route.params.citySlug))

if (!category.value || !city.value) {
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
