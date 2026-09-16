<template>
  <span v-if="markup" class="dashboard-nav-icon" aria-hidden="true" v-html="markup" />
  <FontAwesomeIcon v-else :icon="FALLBACK_ICONS[name]" aria-hidden="true" />
</template>

<script setup>
// Shared icon set between DashboardNav (sidebar) and DashboardBottomNav
// (mobile tab bar), one place to edit. Dizajn 30: every entry frame 357:406
// draws uses that frame's own 20px export (utils/dashboardNavIcons.js); the
// admin panel and the bottom bar's "Više" have no Figma icon and keep their
// Font Awesome glyphs. The parent sets the size and the colour.
const FALLBACK_ICONS = {
  admin: 'shield-halved',
  more: 'ellipsis',
}

const props = defineProps({ name: { type: String, required: true } })

const markup = computed(() => getDashboardNavIconMarkup(props.name))
</script>

<style lang="scss" scoped>
.dashboard-nav-icon {
  display: inline-flex;
}

.dashboard-nav-icon :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
