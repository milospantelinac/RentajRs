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
// The public pages sit on white in Figma — $color-background is reserved
// there for fields, active rows and other subtle fills, which disappear if
// the page itself carries it. The dashboard and admin shells keep the body's
// $color-background.
.page-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: $color-surface;
}

.page-content {
  flex: 1;
}
</style>
