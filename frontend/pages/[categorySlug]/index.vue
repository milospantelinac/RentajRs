<template>
  <div v-if="category" class="container category-page py-4">
    <nav class="text-muted mb-2">
      <NuxtLink to="/">{{ t('nav.home') }}</NuxtLink> / {{ category.name }}
    </nav>
    <h1 class="text-page-title mb-2">{{ category.name }}</h1>
    <p v-if="category.description" class="text-body mb-4">{{ category.description }}</p>

    <div v-if="results.length" class="row">
      <div v-for="listing in results" :key="listing.id" class="col-6 col-md-3 mb-4">
        <ListingCard :listing="listing" />
      </div>
    </div>
    <div v-else class="card">
      <div class="card-body text-center">
        <p class="text-body mb-2">{{ t('category.emptyTitle', { name: category.name }) }}</p>
        <p class="text-muted mb-3">{{ t('category.emptySubtitle') }}</p>
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

const { data: category } = await useAsyncData(`category-${route.params.categorySlug}`, async () => {
  try {
    return await api.get(`/categories/${route.params.categorySlug}`)
  } catch {
    return null
  }
})

if (!category.value) {
  throw createError({ statusCode: 404, statusMessage: 'Category not found' })
}

const { data: searchResponse } = await useAsyncData(`category-listings-${route.params.categorySlug}`, () =>
  api.post('/search', { categorySlug: route.params.categorySlug, pageSize: 24 }),
)
const results = computed(() => searchResponse.value?.results || [])

// R135 — only indexed once the category has at least 3 listings; below
// that it's still browsable, just tagged noindex so a thin page doesn't
// hurt the whole domain's SEO.
const shouldIndex = computed(() => (searchResponse.value?.total || 0) >= 3)

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
</style>
