<template>
  <div class="saved">
    <DashboardPageHeader class="saved-header" :title="t('nav.favorites')" :subtitle="summary" />

    <!-- Dizajn 44: a failed load and an empty list both say so where the
         cards would be. -->
    <section v-if="error" class="saved-state is-error">
      <DashboardNavIcon name="saved" class="saved-state-icon" />
      <p class="saved-state-title">{{ t('savedListings.loadErrorTitle') }}</p>
      <p class="saved-state-text">{{ t('savedListings.loadErrorText') }}</p>
      <button type="button" class="saved-button" @click="refresh()">{{ t('errorPage.tryAgain') }}</button>
    </section>

    <section v-else-if="!visibleFavorites.length" class="saved-state">
      <DashboardNavIcon name="saved" class="saved-state-icon" />
      <p class="saved-state-title">{{ t('savedListings.emptyTitle') }}</p>
      <p class="saved-state-text">{{ t('savedListings.emptyText') }}</p>
      <NuxtLink to="/pretraga" class="saved-button">{{ t('dashboard.browseListings') }}</NuxtLink>
    </section>

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

// Dizajn 44, in the white raised card the other dashboard pages use.
.saved-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 24px;
  border-radius: $radius-card;
  background: $color-surface;
  box-shadow:
    0 6px 20px rgba(97, 115, 133, 0.08),
    0 1px 3px rgba(97, 115, 133, 0.05);
  text-align: center;
}

.saved-state-icon {
  width: 48px;
  height: 48px;
  margin-bottom: 12px;
  color: $color-text-muted;
}

.saved-state-title {
  font-size: 17px;
  font-weight: 500;
  line-height: normal;
  color: $color-text;
}

.saved-state-text {
  max-width: 420px;
  margin-top: 4px;
  font-size: 13px;
  font-weight: 300;
  line-height: normal;
  color: $color-text-muted;
}

.saved-state.is-error .saved-state-icon,
.saved-state.is-error .saved-state-title {
  color: $color-error;
}

// 357:503, the dashboard's grey button.
.saved-button {
  display: inline-flex;
  align-items: center;
  margin-top: 16px;
  padding: 11px 20px;
  border: 0;
  border-radius: $radius-button;
  background: $color-background;
  font-size: 13px;
  font-weight: 500;
  line-height: normal;
  color: $color-text;
  white-space: nowrap;
  cursor: pointer;
}

.saved-button:hover {
  color: $color-primary;
  text-decoration: none;
}

@include mobile-only {
  .saved {
    margin: 0;
  }

  .saved-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .saved-state {
    padding: 32px 16px;
  }
}
</style>
