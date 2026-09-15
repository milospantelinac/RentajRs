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

.category-tile-icon :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
