<template>
  <div class="dashboard-shell">
    <AppHeader />
    <div class="container dashboard-body">
      <aside class="dashboard-sidebar d-none-mobile">
        <DashboardNav />
      </aside>
      <main class="dashboard-content">
        <slot />
      </main>
    </div>
    <DashboardBottomNav />
  </div>
</template>

<style lang="scss" scoped>
.dashboard-body {
  display: flex;
  gap: 24px;
  padding: 24px 0 80px;
  align-items: flex-start;
}

.dashboard-sidebar {
  width: 220px;
  flex-shrink: 0;
  position: sticky;
  // Dizajn 5 — header grew 68px -> 104px; same 16px breathing room below it.
  top: 120px;
}

.dashboard-content {
  flex: 1;
  min-width: 0;
}

@include mobile-only {
  .dashboard-body {
    flex-direction: column;
    padding-bottom: 72px; // room for the bottom nav
    padding-left: 16px;
    padding-right: 16px;
  }
}
</style>
