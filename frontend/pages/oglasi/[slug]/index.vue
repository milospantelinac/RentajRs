<template>
  <ListingPublicView v-if="listing" :listing="listing" :reviews="reviews" />
  <div v-else class="container py-6">
    <p class="text-muted">{{ t('listing.noResults') }}</p>
  </div>
</template>

<script setup>
const { t } = useI18n()
const api = useApi()
const route = useRoute()

const { data: listing, error: listingError } = await useAsyncData(`listing-${route.params.slug}`, () =>
  api.get(`/listings/public/${route.params.slug}`),
)

if (listingError.value) throw createError(pageLoadError(listingError.value, 'Listing not found'))
if (!listing.value) {
  throw createError({ statusCode: 404, statusMessage: 'Listing not found' })
}

const { data: reviews } = await useAsyncData(`listing-reviews-${route.params.slug}`, () =>
  api.get(`/listings/${listing.value.id}/reviews`),
)

useSeoMeta({
  title: () => listing.value?.title,
  description: () => listing.value?.description?.slice(0, 160),
  ogTitle: () => listing.value?.title,
  ogImage: () => listing.value?.photos?.[0]?.url,
})

// Structured data (Ch.14.4) — Product schema is the closest fit for a
// priced, bookable listing without inventing a custom vocabulary.
useHead(() => ({
  script: listing.value
    ? [
        {
          type: 'application/ld+json',
          innerHTML: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: listing.value.title,
            description: listing.value.description,
            image: listing.value.photos?.map((p) => p.url) ?? [],
            // T121: a listing on defined slots without one ahead has no price to offer.
            ...(Number(listing.value.price) > 0
              ? { offers: { '@type': 'Offer', price: listing.value.price, priceCurrency: 'RSD' } }
              : {}),
            ...(listing.value.reviewCount > 0
              ? {
                  aggregateRating: {
                    '@type': 'AggregateRating',
                    ratingValue: listing.value.avgRating,
                    reviewCount: listing.value.reviewCount,
                  },
                }
              : {}),
          }),
        },
      ]
    : [],
}))
</script>
