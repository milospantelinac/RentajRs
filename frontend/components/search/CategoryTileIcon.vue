<template>
  <span class="category-tile-icon" v-html="markup" />
</template>

<script setup>
// Inlined rather than <img> so the icon takes the tile's text colour — blue
// on the active tile, grey otherwise (Dizajn 8).
const props = defineProps({
  slug: { type: String, required: true },
})

const markup = computed(() => getSearchCategoryIconMarkup(props.slug))
</script>

<style lang="scss" scoped>
.category-tile-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  color: inherit;
}

// Dizajn 50: each icon keeps the size its SVG was exported at, centred in the
// 32px box the way frame 133:2 places it (Sve 26, Nekretnine 27.8, Igraonice,
// Magacini and Ostalo 30, the other three 32). They used to be stretched to 32.
.category-tile-icon :deep(svg) {
  display: block;
  flex-shrink: 0;
}
</style>
