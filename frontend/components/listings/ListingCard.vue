<template>
  <NuxtLink :to="`/oglasi/${listing.slug}`" class="card card-interactive listing-card">
    <div class="listing-card-image-wrap">
      <img
        v-if="listing.coverPhoto"
        :src="listing.coverPhoto.url"
        :alt="listing.coverPhoto.altText || listing.title"
        class="listing-card-image"
        loading="lazy"
      />
      <div v-else class="listing-card-image listing-card-image-placeholder" />
      <span v-if="listing.category?.name" class="listing-card-category-badge">{{ listing.category.name }}</span>
      <span v-if="listing.avgRating" class="listing-card-rating-badge">
        <img src="/images/icons/star.svg" alt="" class="listing-card-star" />
        {{ Number(listing.avgRating).toFixed(1) }}
      </span>
      <button
        type="button"
        class="listing-card-favorite-btn"
        :class="{ 'listing-card-favorite-btn-active': isFavorited }"
        :disabled="togglingFavorite"
        :aria-label="t(isFavorited ? 'listing.unsaveListing' : 'listing.saveListing')"
        @click.stop.prevent="toggleFavorite"
      >
        <FontAwesomeIcon icon="heart" />
      </button>
    </div>
    <div class="card-body-sm">
      <p class="text-body listing-card-title">{{ listing.title }}</p>
      <p class="text-muted listing-card-location">
        {{ listing.city?.name }}<span v-if="listing.cityArea">, {{ listing.cityArea.name }}</span>
      </p>
      <div class="listing-card-divider" />
      <div class="listing-card-footer">
        <span class="text-body listing-card-price">
          {{ new Intl.NumberFormat('sr-RS').format(listing.price || 0) }} RSD
          <template v-if="listing.priceUnit === 'GUEST'"> {{ t('listing.pricePerGuestSuffix') }}</template>
        </span>
        <span class="listing-card-details-link">
          {{ t('home.detailsLink') }}
          <img src="/images/icons/arrow.svg" alt="" class="listing-card-details-arrow" />
        </span>
      </div>
    </div>
  </NuxtLink>
</template>

<script setup>
const { t } = useI18n()
const auth = useAuthStore()
const favoritesStore = useFavoritesStore()
const route = useRoute()

const props = defineProps({
  listing: { type: Object, required: true },
})

const togglingFavorite = ref(false)
const isFavorited = computed(() => favoritesStore.isFavorited(props.listing.id))

favoritesStore.ensureLoaded()

async function toggleFavorite() {
  if (!auth.isAuthenticated) {
    await navigateTo(`/prijava?redirect=${route.fullPath}`)
    return
  }
  togglingFavorite.value = true
  try {
    await favoritesStore.toggle(props.listing.id)
  } finally {
    togglingFavorite.value = false
  }
}
</script>

<style lang="scss" scoped>
.listing-card {
  display: block;
  padding: 6px;
}

.listing-card-image-wrap {
  position: relative;
  border-radius: 10px;
  overflow: hidden;
}

.listing-card-image {
  display: block;
  width: 100%;
  height: 160px;
  object-fit: cover;
}

.listing-card-image-placeholder {
  background: $color-background;
}

.listing-card-category-badge {
  position: absolute;
  top: 10px;
  left: 10px;
  padding: 4px 10px;
  border-radius: $radius-pill;
  background: rgba(255, 255, 255, 0.85);
  color: $color-text;
  font-size: 11px;
  font-weight: 600;
}

.listing-card-rating-badge {
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: $radius-pill;
  background: rgba(255, 255, 255, 0.85);
  color: $color-text;
  font-size: 11px;
  font-weight: 600;
}

.listing-card-star {
  width: 10px;
  height: 10px;
}

/* Bottom-right of the image — top-left/right are reserved for the category
   badge and rating badge above. */
.listing-card-favorite-btn {
  position: absolute;
  bottom: 10px;
  right: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.85);
  color: $color-text-muted;
  font-size: 14px;
  cursor: pointer;
  transition: color 0.15s;
}

.listing-card-favorite-btn:hover {
  color: $color-primary;
}

.listing-card-favorite-btn-active {
  color: $color-primary;
}

.listing-card-title {
  font-weight: 600;
  margin-top: 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.listing-card-location {
  margin-top: 2px;
}

.listing-card-divider {
  height: 1px;
  background: $color-border;
  margin: 10px 0;
}

.listing-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.listing-card-price {
  font-weight: 600;
}

// Matches the same brand gradient used across marketing surfaces
// ($gradient-marketing) rather than a flat blue, per the Figma spec.
.listing-card-details-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  background-image: $gradient-marketing;
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
}

.listing-card-details-arrow {
  width: 10px;
  height: 10px;
}
</style>
