<template>
  <nav class="dash-nav card">
    <NuxtLink to="/kontrolna-tabla" class="dash-nav-link">
      <span class="dash-nav-icon" aria-hidden="true"><DashboardNavIcon name="home" /></span>
      {{ t('dashboard.overview') }}
    </NuxtLink>

    <template v-if="auth.user?.isOwner">
      <p class="text-label dash-nav-section">{{ t('dashboard.sectionRenting') }}</p>
      <NuxtLink to="/kontrolna-tabla/oglasi" class="dash-nav-link">
        <span class="dash-nav-icon" aria-hidden="true"><DashboardNavIcon name="list" /></span>
        {{ t('listing.myListings') }}
      </NuxtLink>
      <NuxtLink to="/kontrolna-tabla/rezervacije?role=owner" class="dash-nav-link">
        <span class="dash-nav-icon" aria-hidden="true"><DashboardNavIcon name="inbox" /></span>
        {{ t('dashboard.requests') }}
      </NuxtLink>
      <NuxtLink to="/kontrolna-tabla/pretplate" class="dash-nav-link">
        <span class="dash-nav-icon" aria-hidden="true"><DashboardNavIcon name="card" /></span>
        {{ t('dashboard.subscriptions') }}
      </NuxtLink>
    </template>

    <p class="text-label dash-nav-section">{{ t('dashboard.sectionBooking') }}</p>
    <NuxtLink to="/kontrolna-tabla/rezervacije?role=guest" class="dash-nav-link">
      <span class="dash-nav-icon" aria-hidden="true"><DashboardNavIcon name="calendar" /></span>
      {{ t('dashboard.myBookings') }}
    </NuxtLink>
    <NuxtLink to="/kontrolna-tabla/sacuvano" class="dash-nav-link">
      <span class="dash-nav-icon" aria-hidden="true"><DashboardNavIcon name="heart" /></span>
      {{ t('nav.favorites') }}
    </NuxtLink>

    <p class="text-label dash-nav-section">{{ t('dashboard.sectionGeneral') }}</p>
    <NuxtLink to="/kontrolna-tabla/poruke" class="dash-nav-link">
      <span class="dash-nav-icon" aria-hidden="true"><DashboardNavIcon name="message" /></span>
      {{ t('nav.messages') }}
    </NuxtLink>
    <NuxtLink to="/kontrolna-tabla/podesavanja" class="dash-nav-link">
      <span class="dash-nav-icon" aria-hidden="true"><DashboardNavIcon name="gear" /></span>
      {{ t('dashboard.settings') }}
    </NuxtLink>

    <template v-if="auth.user?.isAdmin">
      <p class="text-label dash-nav-section">{{ t('dashboard.sectionAdmin') }}</p>
      <NuxtLink to="/admin" class="dash-nav-link">
        <span class="dash-nav-icon" aria-hidden="true"><DashboardNavIcon name="shield" /></span>
        {{ t('dashboard.adminPanel') }}
      </NuxtLink>
    </template>
  </nav>
</template>

<script setup>
const { t } = useI18n()
const auth = useAuthStore()
</script>

<style lang="scss" scoped>
.dash-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 12px;
}

.dash-nav-section {
  margin-top: 16px;
  margin-bottom: 4px;
  padding: 0 12px;
}

.dash-nav-link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: $radius-button;
  color: $color-text;
  font-size: $font-size-body;
}

.dash-nav-link:hover,
.dash-nav-link.router-link-active {
  background: $color-background;
  color: $color-primary;
  text-decoration: none;
}

// Icons stay neutral gray regardless of hover/active state — only the
// label text picks up the primary color, per design feedback.
.dash-nav-icon {
  display: inline-flex;
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  color: $color-text-muted;
}

.dash-nav-icon svg {
  width: 100%;
  height: 100%;
}
</style>
