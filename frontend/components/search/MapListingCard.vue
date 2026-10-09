<template>
  <!-- T113: Figma 1716:3269, the map's listing card. -->
  <div class="map-card" :class="`map-card-${placement}`">
    <!-- The whole card and its arrow open the listing (T113 point 6). -->
    <NuxtLink :to="`/oglasi/${listing.slug}`" class="map-card-link">
      <div class="map-card-photo">
        <img
          v-if="listing.coverPhoto"
          :src="listing.coverPhoto.url"
          :alt="listing.coverPhoto.altText || listing.title"
          class="map-card-image"
        />
        <div v-else class="map-card-image map-card-image-placeholder" />
        <span class="map-card-scrim" aria-hidden="true" />
        <span v-if="listing.category?.name" class="map-card-category">{{
          listing.category.name
        }}</span>
      </div>

      <div class="map-card-body">
        <p class="map-card-title">{{ listing.title }}</p>
        <div class="map-card-row">
          <span class="map-card-location">{{ locationLabel }}</span>
          <!-- T114: "Novo" until the first review. -->
          <span class="map-card-rating">
            <img src="/images/icons/star.svg" alt="" class="map-card-star" />
            {{ hasRating(listing) ? formatRating(listing.avgRating) : t('listing.ratingNew') }}
          </span>
        </div>
        <div class="map-card-row">
          <!-- T121: "Od 12.000 RSD / terminu" on defined slots, "Trenutno nema termina" without one ahead. -->
          <p class="map-card-price">
            <template v-if="priceText">
              <span>{{ priceText }}</span>
              <span class="map-card-price-unit">{{ priceUnitSuffix }}</span>
            </template>
            <span v-else class="map-card-price-unit">{{ t('listing.noUpcomingSlots') }}</span>
          </p>
          <span class="btn btn-circle-sm map-card-arrow" aria-hidden="true">
            <img src="/images/icons/arrow.svg" alt="" class="map-card-arrow-icon" />
          </span>
        </div>
      </div>
    </NuxtLink>

    <!-- T113 point 8 (agreed 2026-10-09, not drawn): several listings on one
         point, one at a time, from a pill along the photo's lower edge. -->
    <div v-if="count > 1" class="map-card-pager">
      <span class="map-card-pager-pill">
        <button
          type="button"
          class="map-card-step"
          :aria-label="t('search.mapCardPrevious')"
          @click="$emit('step', -1)"
        >
          <img src="/images/icons/chevron-left-18.svg" alt="" width="12" height="12" />
        </button>
        <span class="map-card-count">{{ index + 1 }} / {{ count }}</span>
        <button
          type="button"
          class="map-card-step"
          :aria-label="t('search.mapCardNext')"
          @click="$emit('step', 1)"
        >
          <img src="/images/icons/chevron-right-18.svg" alt="" width="12" height="12" />
        </button>
      </span>
    </div>

    <!-- 1716:3288: a 28px circle out of the card's corner, its shadow drawn in the asset. -->
    <button
      type="button"
      class="map-card-close"
      :aria-label="t('common.close')"
      @click="$emit('close')"
    >
      <img src="/images/icons/map-card-close.svg" alt="" width="40" height="40" />
    </button>

    <!-- 1716:3355: points at the pill; a phone's docked card has none. -->
    <img
      v-if="placement !== 'docked'"
      src="/images/icons/map-card-caret.svg"
      alt=""
      width="16"
      height="8"
      class="map-card-caret"
      :style="{ left: `${arrowX - CARET_HALF}px` }"
    />
  </div>
</template>

<script setup>
// T113: the small listing card a price pill opens on the /pretraga map. The
// same fields as the big card (Dizajn 3) from the same search result.
const props = defineProps({
  listing: { type: Object, required: true },
  index: { type: Number, default: 0 },
  count: { type: Number, default: 1 },
  // 'above' or 'below' the pill on a desktop, 'docked' along a phone's map.
  placement: { type: String, default: 'above' },
  // Where the caret points, from the card's left edge.
  arrowX: { type: Number, default: 150 },
})
defineEmits(['close', 'step'])

const CARET_HALF = 8

const { t } = useI18n()

const locationLabel = computed(() => {
  const { city, cityArea } = props.listing
  if (!city?.name) return ''
  return cityArea ? `${city.name} · ${cityArea.name}` : city.name
})
const priceText = computed(() => formatListingPrice(props.listing, t))
const priceUnitSuffix = computed(() => getCardPriceUnitSuffix(props.listing.priceUnit, t))
</script>

<style lang="scss" scoped>
// 1716:3269: 124 tall, 10 padding, the 104px photo and the text 12 apart.
.map-card {
  position: relative;
  height: 124px;
  border-radius: 16px;
  background: $color-surface;
  box-shadow: $shadow-card;
}

.map-card-link {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 100%;
  padding: 10px;
  color: inherit;
}

.map-card-link:hover {
  text-decoration: none;
}

// 1716:3270
.map-card-photo {
  position: relative;
  flex-shrink: 0;
  width: 104px;
  height: 104px;
  border-radius: 12px;
  overflow: hidden;
}

.map-card-image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.map-card-image-placeholder {
  background: $color-background;
}

.map-card-scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    rgba(0, 0, 0, 0.4) 0%,
    rgba(0, 0, 0, 0.05) 42%,
    rgba(0, 0, 0, 0) 72%,
    rgba(0, 0, 0, 0.35) 100%
  );
}

// 1716:3271
.map-card-category {
  position: absolute;
  top: 8px;
  left: 8px;
  max-width: calc(100% - 16px);
  padding: 4px 9px;
  border-radius: $radius-pill;
  background: rgba($color-surface, 0.92);
  color: $color-text;
  font-size: 10px;
  line-height: normal;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

// 1716:3273: title on top, price at the bottom, place and rating between.
.map-card-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: space-between;
  min-width: 0;
  height: 104px;
}

// 1716:3274: two lines at most (the legend's "naslov, najviše 2 reda").
.map-card-title {
  margin: 0;
  font-size: 15px;
  font-weight: $font-weight-card-title;
  line-height: normal;
  color: $color-text;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

// 1716:3275 and 1716:3281: the two ends of each row, nothing between them.
.map-card-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
}

// A long place name stops short of the rating instead of touching it.
.map-card-location {
  min-width: 0;
  margin-right: 8px;
  font-size: 12px;
  line-height: normal;
  color: $color-text-muted;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

// 1716:3277
.map-card-rating {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  font-weight: $font-weight-card-title;
  line-height: normal;
  color: $color-text;
}

.map-card-star {
  width: 15px;
  height: 15px;
}

// 1716:3282: "Od 12.000 RSD / terminu" is wider than the column, so the unit
// goes under the price rather than being cut.
.map-card-price {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  column-gap: 4px;
  min-width: 0;
  margin: 0;
  font-size: 16px;
  font-weight: $font-weight-card-title;
  line-height: normal;
  color: $color-text;
}

.map-card-price-unit {
  font-size: 12px;
  font-weight: 400;
  color: $color-text-muted;
  white-space: nowrap;
}

// 1716:3285: the shared .btn-circle-sm is that 30px bordered circle.
.map-card-arrow {
  flex-shrink: 0;
}

.map-card-arrow-icon {
  width: 18px;
  height: 18px;
}

// Along the photo's lower edge, in the category pill's white.
.map-card-pager {
  position: absolute;
  left: 10px;
  bottom: 18px;
  display: flex;
  justify-content: center;
  width: 104px;
  pointer-events: none;
}

.map-card-pager-pill {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border-radius: $radius-pill;
  background: rgba($color-surface, 0.92);
  pointer-events: auto;
}

.map-card-step {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: $radius-pill;
  background: none;
  cursor: pointer;
}

.map-card-step:hover {
  background: $color-background;
}

.map-card-count {
  font-size: 10px;
  font-weight: $font-weight-card-title;
  line-height: normal;
  color: $color-text;
  white-space: nowrap;
}

// 1716:3288: 10 out of the top right corner; the 40px asset carries the
// circle's border and shadow around it (inset -4 -6 -8 -6).
.map-card-close {
  position: absolute;
  top: -10px;
  right: -10px;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: $radius-pill;
  background: none;
  cursor: pointer;
}

.map-card-close img {
  position: absolute;
  top: -4px;
  left: -6px;
  width: 40px;
  height: 40px;
  max-width: none;
}

// 1716:3355: 16x8, laps 1px over the card's edge; turned over under a pill.
.map-card-caret {
  position: absolute;
  bottom: -7px;
  display: block;
}

.map-card-below .map-card-caret {
  top: -7px;
  bottom: auto;
  transform: rotate(180deg);
}
</style>
