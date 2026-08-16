<template>
  <div>
    <div class="container pt-4">
      <NuxtLink :to="`/oglasi/${route.params.id}/uredi`" class="btn btn-tertiary btn-sm">← {{ t('listing.backToEditing') }}</NuxtLink>
    </div>
    <ListingPublicView v-if="listing" :listing="listing" :reviews="reviews" preview />
  </div>
</template>

<script setup>
// RNT-031 — lets the owner see their listing exactly as a guest would,
// before ever paying for a package; reuses the public listing's own
// component so this can't show something publishing wouldn't actually look like.
definePageMeta({ middleware: 'auth' })
const { t } = useI18n()
const api = useApi()
const route = useRoute()

const { data: listing } = await useAsyncData(`listing-preview-${route.params.id}`, () =>
  api.get(`/listings/${route.params.id}/preview`),
)

const { data: reviews } = await useAsyncData(`listing-preview-reviews-${route.params.id}`, () =>
  api.get(`/listings/${route.params.id}/reviews`),
)

useSeoMeta({ title: () => `${t('listing.previewBanner')} — ${listing.value?.title}` })
</script>
