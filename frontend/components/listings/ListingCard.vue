<template>
  <NuxtLink :to="`/oglasi/${listing.slug}`" class="listing-card">
    <div class="listing-card-media">
      <img
        v-if="listing.coverPhoto"
        :src="listing.coverPhoto.url"
        :alt="listing.coverPhoto.altText || listing.title"
        class="listing-card-image"
        loading="lazy"
      />
      <div v-else class="listing-card-image listing-card-image-placeholder" />
      <div class="listing-card-scrim" aria-hidden="true" />

      <span v-if="listing.category?.name" class="listing-card-category-pill">{{ listing.category.name }}</span>

      <button
        type="button"
        class="listing-card-favorite-btn"
        :class="{ 'listing-card-favorite-btn-active': isFavorited }"
        :disabled="togglingFavorite"
        :aria-label="t(isFavorited ? 'listing.unsaveListing' : 'listing.saveListing')"
        @click.stop.prevent="toggleFavorite"
      >
        <svg viewBox="0 0 18 18" fill="none" class="listing-card-favorite-icon">
          <path
            d="M9 15.375C9 15.375 3.375 11.925 3.375 8.175C3.44498 7.55639 3.68851 6.97019 4.07748 6.48411C4.46645 5.99802 4.98498 5.63188 5.57319 5.42797C6.16141 5.22405 6.7953 5.19069 7.40167 5.33172C8.00804 5.47275 8.56215 5.78244 9 6.225C9.43785 5.78244 9.99196 5.47275 10.5983 5.33172C11.2047 5.19069 11.8386 5.22405 12.4268 5.42797C13.015 5.63188 13.5336 5.99802 13.9225 6.48411C14.3115 6.97019 14.555 7.55639 14.625 8.175C14.625 11.925 9 15.375 9 15.375Z"
            :fill="isFavorited ? 'currentColor' : 'none'"
            stroke="currentColor"
            stroke-width="1.2"
            stroke-linejoin="round"
          />
        </svg>
      </button>

      <span v-if="locationLabel" class="listing-card-location">
        <img src="/images/icons/pin.svg" alt="" class="listing-card-pin" />
        {{ locationLabel }}
      </span>
    </div>

    <div class="listing-card-body">
      <div class="listing-card-title-row">
        <p class="listing-card-title">{{ listing.title }}</p>
        <span v-if="listing.avgRating" class="listing-card-rating">
          <img src="/images/icons/star.svg" alt="" class="listing-card-star" />
          {{ Number(listing.avgRating).toFixed(2) }}
        </span>
      </div>

      <div v-if="keyFacts.length" class="listing-card-facts">
        <span v-for="fact in keyFacts" :key="fact.key" class="listing-card-fact">
          <AttributeIcon :name="fact.key" :size="15" />
          <span class="listing-card-fact-text">{{ fact.text }}</span>
        </span>
      </div>

      <div class="listing-card-divider" />

      <div class="listing-card-footer">
        <p class="listing-card-price">
          {{ new Intl.NumberFormat('sr-RS').format(listing.price || 0) }} RSD
          <span class="listing-card-price-unit">{{ priceUnitSuffix }}</span>
        </p>
        <span class="btn btn-circle-sm listing-card-details-btn" aria-hidden="true">
          <img src="/images/icons/arrow.svg" alt="" class="listing-card-details-arrow" />
        </span>
      </div>
    </div>
  </NuxtLink>
</template>

<script setup>
// Dizajn 3 — one card component for the whole platform (naslovna, pretraga,
// slični oglasi, sačuvano, mobilna). Title/location/rating/price/unit read
// straight off the listing; the favorite button only changes look and
// position here — toggling behavior is untouched (T-scoped to this ticket).
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

const locationLabel = computed(() => {
  const { city, cityArea } = props.listing
  if (!city?.name) return ''
  return cityArea ? `${city.name} · ${cityArea.name}` : city.name
})

const keyFacts = computed(() => getCardKeyFacts(props.listing))

// Dizajn 3: "/ noć", "/ danu", "/ terminu", "/ satu", from utils/listingPrice.js.
const priceUnitSuffix = computed(() => getCardPriceUnitSuffix(props.listing.priceUnit, t))
</script>

<style lang="scss" scoped>
// Dizajn 1's shared $radius-card is 16px; this component's own Figma
// measurement is 20px — kept as a local override rather than changing the
// shared token (which also backs unrelated cards/tables/panels).
$listing-card-radius: 20px;

.listing-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: $color-surface;
  border-radius: $listing-card-radius;
  box-shadow: $shadow-card;
  overflow: hidden;
}

.listing-card:hover {
  text-decoration: none;
}

.listing-card-media {
  position: relative;
  flex-shrink: 0;
  height: 200px;
  overflow: hidden;
}

.listing-card-image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.listing-card-image-placeholder {
  background: $color-background;
}

.listing-card-scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0.05) 42%, rgba(0, 0, 0, 0) 72%, rgba(0, 0, 0, 0.35) 100%);
  pointer-events: none;
}

.listing-card-category-pill {
  position: absolute;
  top: 14px;
  left: 14px;
  padding: 6px 11px;
  border-radius: $radius-pill;
  background: rgba($color-background, 0.7);
  color: $color-text;
  font-size: 10px;
  white-space: nowrap;
}

.listing-card-favorite-btn {
  position: absolute;
  top: 14px;
  right: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: none;
  border-radius: $radius-pill;
  background: $color-surface;
  color: $color-text-muted;
  cursor: pointer;
  transition: color 0.15s;
}

.listing-card-favorite-btn:hover {
  color: $color-primary;
}

.listing-card-favorite-btn-active {
  color: $color-primary;
}

.listing-card-favorite-icon {
  width: 18px;
  height: 18px;
}

.listing-card-location {
  position: absolute;
  bottom: 14px;
  left: 14px;
  display: flex;
  align-items: center;
  gap: 5px;
  color: $color-surface;
  font-size: 13px;
  white-space: nowrap;
  max-width: calc(100% - 28px);
  overflow: hidden;
  text-overflow: ellipsis;
}

.listing-card-pin {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.listing-card-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
  padding: 16px 18px;
}

.listing-card-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.listing-card-title {
  margin: 0;
  font-size: 16px;
  font-weight: $font-weight-card-title;
  line-height: 18px;
  color: $color-text;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.listing-card-rating {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  font-size: 14px;
  font-weight: $font-weight-card-title;
  color: $color-text;
}

.listing-card-star {
  width: 15px;
  height: 15px;
}

.listing-card-facts {
  display: flex;
  align-items: center;
  gap: 12px;
}

.listing-card-fact {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  color: $color-text;
  flex-shrink: 1;
}

.listing-card-fact-text {
  font-size: 13px;
  font-weight: $font-weight-card-title;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.listing-card-divider {
  height: 1px;
  background: $color-border;
  margin-top: auto;
}

.listing-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.listing-card-price {
  margin: 0;
  font-size: 16px;
  color: $color-text;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.listing-card-price-unit {
  font-size: 13px;
  color: $color-text-muted;
}

// Sizing/color come from the shared .btn.btn-circle-sm (Dizajn 6); only the
// flex-layout concern belongs here.
.listing-card-details-btn {
  flex-shrink: 0;
}

.listing-card-details-arrow {
  width: 18px;
  height: 18px;
}
</style>
