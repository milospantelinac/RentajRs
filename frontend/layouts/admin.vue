<template>
  <div class="admin-shell">
    <AppHeader />
    <div class="container admin-page-body">
      <h1 class="text-page-title mb-3">{{ t('admin.panel') }}</h1>
      <AdminNav />
      <main>
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup>
const { t } = useI18n()
</script>

<style lang="scss" scoped>
.admin-page-body {
  padding: 24px 0 64px;
}
</style>
