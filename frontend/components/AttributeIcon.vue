<template>
  <span class="attribute-icon" :style="{ width: size + 'px', height: size + 'px' }" v-html="markup" />
</template>

<script setup>
// Dizajn 2 — renders one icon from the shared attribute/amenity registry by
// key (a CategoryAttribute or AttributeOption key). Inlined via v-html
// rather than <img> so the SVG's stroke/fill="currentColor" actually
// inherits the surrounding text color, per spec ("boja se nasleđuje od
// teksta pored kog stoji — ne hardkodirati boju").
const props = defineProps({
  name: { type: String, required: true },
  size: { type: [Number, String], default: 24 },
})

const markup = computed(() => getAttributeIconMarkup(props.name))
</script>

<style lang="scss" scoped>
.attribute-icon {
  display: inline-flex;
  flex-shrink: 0;
  color: inherit;
}

.attribute-icon :deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
