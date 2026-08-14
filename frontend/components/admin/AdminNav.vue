<template>
  <nav class="admin-nav">
    <NuxtLink to="/admin" class="admin-nav-link">{{ t('admin.queue') }}</NuxtLink>
    <NuxtLink to="/admin/kategorije" class="admin-nav-link">{{ t('admin.categories') }}</NuxtLink>
    <NuxtLink to="/admin/korisnici" class="admin-nav-link">{{ t('admin.users') }}</NuxtLink>
    <NuxtLink to="/admin/pretplate" class="admin-nav-link">{{ t('admin.subscriptions') }}</NuxtLink>
    <NuxtLink to="/admin/placanje" class="admin-nav-link">{{ t('admin.paymentSettings') }}</NuxtLink>
    <NuxtLink to="/admin/sporovi" class="admin-nav-link">{{ t('admin.disputes') }}</NuxtLink>
    <NuxtLink to="/admin/email-sabloni" class="admin-nav-link">{{ t('admin.emailTemplates') }}</NuxtLink>
    <NuxtLink to="/admin/podesavanja" class="admin-nav-link">{{ t('admin.settings') }}</NuxtLink>
  </nav>
</template>

<script setup>
const { t } = useI18n()
</script>

<style lang="scss" scoped>
.admin-nav {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  border-bottom: 1px solid $color-border;
  margin-bottom: 24px;
}

.admin-nav-link {
  padding: 12px 16px;
  color: $color-text-muted;
  font-size: $font-size-body;
  white-space: nowrap;
  border-bottom: 2px solid transparent;
}

.admin-nav-link:hover {
  color: $color-primary;
  text-decoration: none;
}

.admin-nav-link.router-link-active {
  color: $color-primary;
  border-bottom-color: $color-primary;
  font-weight: 600;
}
</style>
