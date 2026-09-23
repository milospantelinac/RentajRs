<template>
  <nav class="admin-tabs" :aria-label="t('admin.panel')">
    <NuxtLink
      v-for="item in ADMIN_NAV_ITEMS"
      :key="item.to"
      :to="item.to"
      class="admin-switch-btn"
      :class="{ 'is-active': isActive(item.to) }"
      :aria-current="isActive(item.to) ? 'page' : undefined"
    >{{ t(item.labelKey) }}</NuxtLink>
  </nav>
</template>

<script setup>
// Dizajn 45: on a phone the menu card gives way to the strip the panel always
// had, drawn as the platform's own switcher (.admin-switch-btn, Dizajn 34).
// The groups are dropped here, the order is the menu's.
const { t } = useI18n()
const route = useRoute()

function isActive(to) {
  return isAdminLinkActive(route, to)
}
</script>

<style lang="scss" scoped>
// The strip bleeds into the page's 16 of side padding so the first and the
// last entry can sit against the edge while it scrolls.
.admin-tabs {
  display: flex;
  gap: 8px;
  margin: 0 -16px 20px;
  padding: 0 16px;
  overflow-x: auto;
  scrollbar-width: none;
}

.admin-tabs::-webkit-scrollbar {
  display: none;
}

// The menu card takes over from 768 up; hiding it from here rather than with
// the .d-none-md utility keeps the scoped `display: flex` above from winning
// on specificity.
@include respond-above(md) {
  .admin-tabs {
    display: none;
  }
}
</style>
