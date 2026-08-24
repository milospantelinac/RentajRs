<template>
  <div>
    <h1 class="text-page-title mb-4">{{ t('nav.favorites') }}</h1>

    <div class="form-row-inline saved-tabs mb-4">
      <button class="btn btn-sm" :class="tab === 'favorites' ? 'btn-primary-flat' : 'btn-tertiary'" @click="tab = 'favorites'">
        {{ t('dashboard.savedOthers') }}
      </button>
      <button class="btn btn-sm" :class="tab === 'drafts' ? 'btn-primary-flat' : 'btn-tertiary'" @click="tab = 'drafts'">
        {{ t('dashboard.savedDrafts') }}
      </button>
    </div>

    <template v-if="tab === 'favorites'">
      <p v-if="!visibleFavorites.length" class="text-muted">{{ t('dashboard.noFavorites') }}</p>
      <div class="row">
        <div v-for="f in visibleFavorites" :key="f.listingId" class="col-6 col-md-3 mb-4">
          <ListingCard :listing="{ ...f.listing, price: f.listing.price, coverPhoto: f.listing.photos?.[0] }" />
          <p v-if="f.priceDropped" class="text-success text-muted mt-1">{{ t('dashboard.priceDropped') }}</p>
        </div>
      </div>
    </template>

    <template v-else>
      <p v-if="!drafts?.length" class="text-muted">{{ t('dashboard.noDrafts') }}</p>
      <div v-else class="draft-list">
        <div v-for="d in drafts" :key="d.id" class="card mb-2">
          <div class="card-body d-flex justify-content-between align-items-center flex-wrap draft-row">
            <span class="text-body">{{ d.title || t('listing.statusDraft') }}</span>
            <NuxtLink :to="`/oglasi/${d.id}/uredi`" class="btn btn-tertiary btn-sm">{{ t('listing.editListing') }}</NuxtLink>
          </div>
        </div>
        <NuxtLink to="/kontrolna-tabla/oglasi" class="text-body">{{ t('listing.myListings') }} →</NuxtLink>
      </div>
    </template>
  </div>
</template>

<script setup>
// RNT-060 — the owner's own explicit decision: "Sačuvano" gets two tabs, her
// own draft listings alongside other owners' listings she's favorited,
// since she'd initially assumed drafts belonged here before "Moji oglasi"
// existed. Full draft management (status, pause, subscription) still lives
// on that page — this tab is a convenience surface, not a duplicate of it.
definePageMeta({ middleware: 'auth', layout: 'dashboard' })
const { t } = useI18n()
const api = useApi()
const favoritesStore = useFavoritesStore()
const tab = ref('favorites')

const { data: favorites } = await useAsyncData('favorites', () => api.get('/users/me/favorites'))
// Already have the full list right here — seed the shared store from it
// instead of letting each ListingCard trigger its own GET .../favorites.
favoritesStore.seed((favorites.value || []).map((f) => f.listingId))
// The card's own heart toggle is how a listing gets removed from this page
// (RNT-060 never had a distinct "remove" control) — filtering against the
// store here means unfavoriting on the card drops it from view immediately.
const visibleFavorites = computed(() => (favorites.value || []).filter((f) => favoritesStore.isFavorited(f.listingId)))

const { data: listings } = await useAsyncData('saved-drafts', () => api.get('/listings/mine'))
const drafts = computed(() => (listings.value || []).filter((l) => ['DRAFT', 'REJECTED'].includes(l.status)))

useSeoMeta({ title: t('nav.favorites') })
</script>

<style lang="scss" scoped>
.saved-tabs {
  gap: 8px;
}

.draft-row {
  gap: 12px;
}
</style>
