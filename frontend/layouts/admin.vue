<template>
  <div class="admin-shell">
    <AppHeader />
    <div class="admin-body">
      <aside class="admin-sidebar d-none-mobile">
        <AdminNav />
      </aside>
      <main class="admin-content">
        <AdminTabs />
        <slot />
      </main>
    </div>
    <DashboardBottomNav />
  </div>
</template>

<script setup>
// Dizajn 45: the panel takes the dashboard's shell (Dizajn 30, frame
// 357:406) instead of the container-and-tabs page it used to be, down to the
// same widths and paddings, so moving between the two reads as one place.
// Each page prints its own title, as the dashboard's pages do.
//
// No footer here, though the dashboard has one: AppFooter's link columns run
// 99px past a 1024 viewport (the same on every dashboard page, and the footer
// is off limits), and the panel has no reason to carry the marketing links.
useDashboardCountsPolling()
</script>

<style lang="scss" scoped>
.admin-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: $color-background;
}

.admin-body {
  flex: 1;
  display: flex;
  align-items: flex-start;
  gap: 28px;
  width: 100%;
  max-width: 1440px;
  margin: 0 auto;
  padding: 28px 24px 48px;
}

.admin-sidebar {
  flex: 0 0 252px;
  width: 252px;
}

.admin-content {
  flex: 1;
  min-width: 0;
  padding: 4px 8px 40px;
}

@include respond-above(xl) {
  .admin-body {
    padding: 28px 56px 48px 32px;
  }
}

// The menu follows the scroll on a window tall enough to show it whole; the
// admin menu is 610 tall, just under the dashboard's longest.
@media (min-height: 800px) {
  .admin-sidebar {
    position: sticky;
    top: 132px;
  }
}

@include mobile-only {
  // room for the fixed bottom bar under the footer
  .admin-shell {
    padding-bottom: calc(60px + env(safe-area-inset-bottom));
  }

  .admin-body {
    padding: 24px 16px 32px;
  }

  .admin-content {
    padding: 0;
  }
}
</style>
