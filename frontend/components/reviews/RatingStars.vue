<template>
  <!-- T114: five stars in the listing card's gold, the empty ones light grey. -->
  <span class="rating-stars" role="img" :aria-label="t('reviews.starLabel', { count: filled })">
    <svg
      v-for="n in 5"
      :key="n"
      viewBox="0 0 15 15"
      class="rating-star"
      :class="n <= filled ? 'is-full' : 'is-empty'"
      :style="{ width: `${size}px`, height: `${size}px` }"
      aria-hidden="true"
    >
      <path d="M7.5 1.625L9.3125 5.3125L13.375 5.90625L10.4375 8.78125L11.125 12.8125L7.5 10.9063L3.875 12.8125L4.5625 8.78125L1.625 5.90625L5.6875 5.3125L7.5 1.625Z" />
    </svg>
  </span>
</template>

<script setup>
const props = defineProps({
  rating: { type: Number, required: true },
  size: { type: Number, default: 15 },
})

const { t } = useI18n()

const filled = computed(() => Math.min(5, Math.max(0, Math.round(props.rating))))
</script>

<style lang="scss" scoped>
.rating-stars {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.rating-star {
  display: block;
  flex-shrink: 0;
}

// The star of star.svg on the listing card, and the empty star's grey.
.is-full {
  fill: $color-rating;
}

.is-empty {
  fill: $color-rating-empty;
}
</style>
