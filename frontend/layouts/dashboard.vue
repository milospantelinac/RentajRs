<template>
  <div class="dashboard-shell">
    <AppHeader />
    <div class="dashboard-body">
      <aside class="dashboard-sidebar d-none-mobile">
        <DashboardNav />
      </aside>
      <main class="dashboard-content">
        <slot />
      </main>
    </div>
    <AppFooter />
    <DashboardBottomNav />
  </div>
</template>

<script setup>
useDashboardCountsPolling()
</script>

<style lang="scss" scoped>
// Dizajn 30, frame 357:406: the page grey behind white raised cards, the
// footer after the content so the page grows with it. Nothing in here clips
// (no overflow), so the cards' shadows always show in full.
.dashboard-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: $color-background;
}

// 357:443: the menu and the content 28 apart, inside 28 / 56 / 48 / 32 of
// padding on the 1440 canvas; a wider window centres that canvas.
.dashboard-body {
  flex: 1;
  display: flex;
  align-items: flex-start;
  gap: 28px;
  width: 100%;
  max-width: 1440px;
  margin: 0 auto;
  padding: 28px 24px 48px;
}

.dashboard-sidebar {
  flex: 0 0 252px;
  width: 252px;
}

// 357:493
.dashboard-content {
  flex: 1;
  min-width: 0;
  padding: 4px 8px 40px;
}

@include respond-above(xl) {
  .dashboard-body {
    padding: 28px 56px 48px 32px;
  }
}

// The menu follows the scroll, 28 under the 104 tall sticky header, on any
// window tall enough to show it whole (the longest one, owner plus admin, is
// 626); a shorter window scrolls it with the page instead of cutting it off.
@media (min-height: 800px) {
  .dashboard-sidebar {
    position: sticky;
    top: 132px;
  }
}

@include mobile-only {
  // room for the fixed bottom bar under the footer
  .dashboard-shell {
    padding-bottom: calc(60px + env(safe-area-inset-bottom));
  }

  .dashboard-body {
    padding: 24px 16px 32px;
  }

  .dashboard-content {
    padding: 0;
  }
}
</style>
