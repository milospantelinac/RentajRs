<template>
  <nav class="bottom-nav">
    <NuxtLink to="/kontrolna-tabla" class="bottom-nav-item">{{ t('dashboard.overview') }}</NuxtLink>
    <NuxtLink :to="bookingsLink" class="bottom-nav-item">{{ auth.user?.isOwner ? t('dashboard.requests') : t('dashboard.myBookings') }}</NuxtLink>
    <NuxtLink to="/kontrolna-tabla/poruke" class="bottom-nav-item">{{ t('nav.messages') }}</NuxtLink>
    <NuxtLink to="/kontrolna-tabla/podesavanja" class="bottom-nav-item">{{ t('dashboard.settings') }}</NuxtLink>
  </nav>
</template>

<script setup>
// R156 — mobile navigation for dashboard-area screens is a fixed bottom bar.
const { t } = useI18n()
const auth = useAuthStore()
// RNT-063 — "Zahtevi za rezervaciju" (booking requests) only makes sense
// from the owner's side; a guest has bookings, not requests to approve.
const bookingsLink = computed(() => (auth.user?.isOwner ? '/kontrolna-tabla/rezervacije?role=owner' : '/kontrolna-tabla/rezervacije?role=guest'))
</script>

<style lang="scss" scoped>
.bottom-nav {
  display: none;
}

@include mobile-only {
  .bottom-nav {
    display: flex;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 60px;
    background: $color-surface;
    border-top: 1px solid $color-border;
    z-index: $z-mobile-bottom-nav;
  }
}

.bottom-nav-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: $font-size-label;
  color: $color-text-muted;
  min-height: $touch-target-min;
}

.bottom-nav-item.router-link-active {
  color: $color-primary;
  font-weight: 600;
}
</style>
