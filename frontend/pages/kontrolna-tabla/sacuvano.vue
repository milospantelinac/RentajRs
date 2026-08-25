<template>
  <div>
    <h1 class="text-page-title mb-4">{{ t('nav.favorites') }}</h1>

    <p v-if="!visibleFavorites.length" class="text-muted">{{ t('dashboard.noFavorites') }}</p>
    <div class="row">
      <div v-for="f in visibleFavorites" :key="f.listingId" class="col-6 col-md-3 mb-4">
        <ListingCard :listing="{ ...f.listing, price: f.listing.price, coverPhoto: f.listing.photos?.[0] }" />
        <p v-if="f.priceDropped" class="text-success text-muted mt-1">{{ t('dashboard.priceDropped') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
// T23 — "Sačuvano" used to also carry a "Moji nacrti" tab (RNT-060) mirroring
// the owner's own draft listings, which already show under "Moji oglasi" with
// status "Nacrt" — pure duplication. Removed; this page is now other owners'
// favorited listings only.
definePageMeta({ middleware: 'auth', layout: 'dashboard' })
const { t } = useI18n()
const api = useApi()
const favoritesStore = useFavoritesStore()

const { data: favorites } = await useAsyncData('favorites', () => api.get('/users/me/favorites'))
// Already have the full list right here — seed the shared store from it
// instead of letting each ListingCard trigger its own GET .../favorites.
favoritesStore.seed((favorites.value || []).map((f) => f.listingId))
// The card's own heart toggle is how a listing gets removed from this page —
// filtering against the store here means unfavoriting on the card drops it
// from view immediately.
const visibleFavorites = computed(() => (favorites.value || []).filter((f) => favoritesStore.isFavorited(f.listingId)))

useSeoMeta({ title: t('nav.favorites') })
</script>
