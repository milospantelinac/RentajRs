<template>
  <div class="page-shell">
    <AppHeader />
    <main class="page-content">
      <slot />
    </main>
    <AppFooter />
    <CookieConsent />
  </div>
</template>

<style lang="scss" scoped>
.page-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.page-content {
  flex: 1;
}
</style>
