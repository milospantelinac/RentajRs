<template>
  <div class="saved">
    <DashboardPageHeader class="saved-header" :title="t('nav.favorites')" :subtitle="summary" />

    <!-- Dizajn 44: a failed load and an empty list both say so where the
         cards would be. -->
    <StateBlock
      v-if="error"
      card
      error
      icon="saved"
      :title="t('savedListings.loadErrorTitle')"
      :text="t('savedListings.loadErrorText')"
    >
      <button type="button" class="state-block-action" @click="refresh()">{{ t('errorPage.tryAgain') }}</button>
    </StateBlock>

    <StateBlock
      v-else-if="!visibleFavorites.length"
      card
      icon="saved"
      :title="t('savedListings.emptyTitle')"
      :text="t('savedListings.emptyText')"
    >
      <NuxtLink to="/pretraga" class="state-block-action">{{ t('dashboard.browseListings') }}</NuxtLink>
    </StateBlock>

    <div v-else class="saved-grid">
      <ListingCard v-for="favorite in visibleFavorites" :key="favorite.listingId" :listing="favorite.listing" />
    </div>
  </div>
</template>

<script setup>
// Dizajn 36, frame 380:1415: the live listings of other owners this user
// saved, each as the card search shows (Dizajn 3), newest save first. The API
// sends only the card's own fields and only listings that are still live.
definePageMeta({ middleware: 'auth', layout: 'dashboard' })
const { t } = useI18n()
const api = useApi()
const favoritesStore = useFavoritesStore()

const { data: favorites, error, refresh } = await useAsyncData('favorites', () => api.get('/users/me/favorites'))

// The page already holds the whole list, so it seeds the shared store (again
// after a retry) instead of letting every card ask for it.
watch(
  favorites,
  (list) => {
    if (list) favoritesStore.seed(list.map((favorite) => favorite.listingId))
  },
  { immediate: true },
)

// Taking the heart off a card removes it from the store, and so from here.
const visibleFavorites = computed(() => (favorites.value || []).filter((f) => favoritesStore.isFavorited(f.listingId)))

// 380:1505: "6 oglasa koje ste sačuvali"; nothing while there is nothing to count.
const summary = computed(() => {
  const count = error.value ? 0 : visibleFavorites.value.length
  return count ? t(`savedListings.summary${srPluralCategory(count)}`, { count }) : ''
})

useSeoMeta({ title: t('nav.favorites') })
</script>

<style lang="scss" scoped>
// 380:1502 starts at 312,132 with no padding of its own, so the page steps out
// of the layout's 4 / 8 (as ical.vue and pretplate.vue do).
.saved {
  margin: -4px -8px 0;
}

// 380:1503: the cards start 24 under the heading, not the shared 32.
.dash-page-header.saved-header {
  margin-bottom: 24px;
}

// 380:1506: 300 wide cards 32 apart both ways, three to a row in the 1072
// column. Every row is as tall as the tallest, so all cards match and their
// price rows line up. Nothing here clips, so the shadows show in full.
.saved-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 300px));
  grid-auto-rows: 1fr;
  gap: 32px;
}

@include mobile-only {
  .saved {
    margin: 0;
  }

  .saved-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
