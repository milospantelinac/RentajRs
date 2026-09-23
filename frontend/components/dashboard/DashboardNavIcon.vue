<template>
  <span v-if="markup" class="dashboard-nav-icon" aria-hidden="true" v-html="markup" />
  <FontAwesomeIcon v-else-if="fallback" :icon="fallback" aria-hidden="true" />
</template>

<script setup>
// Shared icon set between DashboardNav (sidebar), DashboardBottomNav (mobile
// tab bar) and the admin menu, one place to edit. Dizajn 30: every entry
// frame 357:406 draws uses that frame's own 20px export
// (utils/dashboardNavIcons.js); the admin panel and the bottom bar's "Više"
// have no Figma icon and keep their Font Awesome glyphs. Dizajn 45 adds the
// admin menu's own entries on the same terms, except the three that mean the
// same thing as a dashboard entry (Rezervacije, Pretplate and the way back to
// Kontrolna tabla), which reuse its exports. The glyph per name lives in
// utils/dashboardNavIcons.js, shared with StateBlock. The parent sets size
// and colour.
const props = defineProps({ name: { type: String, required: true } })

const markup = computed(() => getDashboardNavIconMarkup(props.name))
const fallback = computed(() => getNavIconFallback(props.name))
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
