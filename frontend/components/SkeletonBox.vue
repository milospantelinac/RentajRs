<template>
  <span class="skeleton-box" :style="style" aria-hidden="true" />
</template>

<script setup>
// Dizajn 44: the grey rectangle every loading state is built from: #E4EBF2
// ($color-border) in the shape of the element it stands in for, with that
// element's own rounding. Never a spinner, and never over the whole page.
const props = defineProps({
  width: { type: String, default: '100%' },
  height: { type: String, default: '12px' },
  // The rounding of the element being replaced; a text line keeps the 6 of a
  // badge so short lines don't read as bricks.
  radius: { type: String, default: '6px' },
})

const style = computed(() => ({ width: props.width, height: props.height, borderRadius: props.radius }))
</script>

<style lang="scss" scoped>
.skeleton-box {
  display: block;
  flex-shrink: 0;
  background: $color-border;
  // The ticket asks for flat grey; the pulse only keeps a long load from
  // looking like a page that finished drawing empty boxes.
  animation: skeleton-pulse 1.4s ease-in-out infinite;
}

@keyframes skeleton-pulse {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.55;
  }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-box {
    animation: none;
  }
}
</style>
