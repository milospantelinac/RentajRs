<template>
  <nav class="dash-nav">
    <NuxtLink to="/kontrolna-tabla" class="dash-nav-link">{{ t('dashboard.overview') }}</NuxtLink>

    <template v-if="auth.user?.isOwner">
      <p class="text-label dash-nav-section">{{ t('dashboard.sectionRenting') }}</p>
      <NuxtLink to="/kontrolna-tabla/oglasi" class="dash-nav-link">{{ t('listing.myListings') }}</NuxtLink>
      <NuxtLink to="/kontrolna-tabla/rezervacije?role=owner" class="dash-nav-link">{{ t('dashboard.requests') }}</NuxtLink>
      <NuxtLink to="/kontrolna-tabla/pretplate" class="dash-nav-link">{{ t('dashboard.subscriptions') }}</NuxtLink>
    </template>

    <p class="text-label dash-nav-section">{{ t('dashboard.sectionBooking') }}</p>
    <NuxtLink to="/kontrolna-tabla/rezervacije?role=guest" class="dash-nav-link">{{ t('nav.dashboard') }}</NuxtLink>
    <NuxtLink to="/kontrolna-tabla/sacuvano" class="dash-nav-link">{{ t('nav.favorites') }}</NuxtLink>

    <p class="text-label dash-nav-section">{{ t('dashboard.sectionGeneral') }}</p>
    <NuxtLink to="/kontrolna-tabla/poruke" class="dash-nav-link">{{ t('nav.messages') }}</NuxtLink>
    <NuxtLink to="/kontrolna-tabla/podesavanja" class="dash-nav-link">{{ t('dashboard.settings') }}</NuxtLink>

    <template v-if="auth.user?.isAdmin">
      <p class="text-label dash-nav-section">{{ t('dashboard.sectionAdmin') }}</p>
      <NuxtLink to="/admin" class="dash-nav-link">{{ t('dashboard.adminPanel') }}</NuxtLink>
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
}

.dash-nav-section {
  margin-top: 16px;
  margin-bottom: 4px;
}

.dash-nav-link {
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
</style>
