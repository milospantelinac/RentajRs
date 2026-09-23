<template>
  <nav class="admin-nav card" :aria-label="t('admin.panel')">
    <template v-for="group in ADMIN_NAV_GROUPS" :key="group.key">
      <p v-if="group.titleKey" class="admin-nav-group">{{ t(group.titleKey) }}</p>
      <NuxtLink
        v-for="item in group.items"
        :key="item.to"
        :to="item.to"
        class="admin-nav-link"
        :class="{ 'admin-nav-link-active': isActive(item.to) }"
        :aria-current="isActive(item.to) ? 'page' : undefined"
      >
        <DashboardNavIcon :name="item.icon" class="admin-nav-icon" />
        <span class="admin-nav-label">{{ t(item.labelKey) }}</span>
      </NuxtLink>
    </template>

    <span class="admin-nav-divider" aria-hidden="true" />
    <NuxtLink :to="ADMIN_NAV_BACK.to" class="admin-nav-link">
      <DashboardNavIcon :name="ADMIN_NAV_BACK.icon" class="admin-nav-icon" />
      <span class="admin-nav-label">{{ t(ADMIN_NAV_BACK.labelKey) }}</span>
    </NuxtLink>
  </nav>
</template>

<script setup>
// Dizajn 45: the panel's menu, built like the dashboard's own (Dizajn 30,
// frame 357:444) rather than the tab strip it used to be. None of these
// entries carries a counter, so the link has no room for one.
const { t } = useI18n()
const route = useRoute()

function isActive(to) {
  return isAdminLinkActive(route, to)
}
</script>

<style lang="scss" scoped>
// The same card, paddings and type as .dash-nav: the panel is meant to read
// as the same menu, one section further in.
.admin-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 20px 14px;
}

.admin-nav-group {
  padding: 16px 0 6px 14px;
  font-size: 11px;
  font-weight: 500;
  line-height: normal;
  letter-spacing: 0.7px;
  text-transform: uppercase;
  color: $color-text-muted;
}

.admin-nav-link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 14px;
  border-radius: $radius-button;
  font-size: 14px;
  font-weight: 400;
  line-height: normal;
  color: $color-text;
  text-decoration: none;
}

.admin-nav-icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  color: $color-text-muted;
}

.admin-nav-link:hover {
  background: $color-background;
  color: $color-primary;
  text-decoration: none;
}

.admin-nav-link:hover .admin-nav-icon {
  color: $color-primary;
}

.admin-nav-link-active,
.admin-nav-link-active:hover {
  background: $color-accent-tint;
  color: $color-primary;
  font-weight: 500;
}

.admin-nav-link-active .admin-nav-icon {
  color: $color-primary;
}

.admin-nav-label {
  flex: 1 0 0;
  min-width: 1px;
}

// The way out of the panel sits under a line, with a group's worth of air
// (16 above, 6 below, as .admin-nav-group has) around it.
.admin-nav-divider {
  display: block;
  height: 1px;
  margin: 16px 14px 6px;
  background: $color-border;
}
</style>
