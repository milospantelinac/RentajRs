<template>
  <nav class="dash-nav card">
    <NuxtLink to="/kontrolna-tabla" class="dash-nav-link">
      <span class="dash-nav-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none"><path d="M4 12 12 4l8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /><path d="M6 10v9a1 1 0 0 0 1 1h3v-5a2 2 0 0 1 2-2 2 2 0 0 1 2 2v5h3a1 1 0 0 0 1-1v-9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
      </span>
      {{ t('dashboard.overview') }}
    </NuxtLink>

    <template v-if="auth.user?.isOwner">
      <p class="text-label dash-nav-section">{{ t('dashboard.sectionRenting') }}</p>
      <NuxtLink to="/kontrolna-tabla/oglasi" class="dash-nav-link">
        <span class="dash-nav-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none"><path d="M8 6h12M8 12h12M8 18h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /><circle cx="4" cy="6" r="1" fill="currentColor" /><circle cx="4" cy="12" r="1" fill="currentColor" /><circle cx="4" cy="18" r="1" fill="currentColor" /></svg>
        </span>
        {{ t('listing.myListings') }}
      </NuxtLink>
      <NuxtLink to="/kontrolna-tabla/rezervacije?role=owner" class="dash-nav-link">
        <span class="dash-nav-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none"><path d="M4 12h4l1.5 3h5L16 12h4" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" /><path d="M5 7l-1 5v6a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6l-1-5a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" /></svg>
        </span>
        {{ t('dashboard.requests') }}
      </NuxtLink>
      <NuxtLink to="/kontrolna-tabla/pretplate" class="dash-nav-link">
        <span class="dash-nav-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none"><rect x="3.5" y="6" width="17" height="12" rx="2" stroke="currentColor" stroke-width="1.8" /><path d="M3.5 10h17" stroke="currentColor" stroke-width="1.8" /></svg>
        </span>
        {{ t('dashboard.subscriptions') }}
      </NuxtLink>
    </template>

    <p class="text-label dash-nav-section">{{ t('dashboard.sectionBooking') }}</p>
    <NuxtLink to="/kontrolna-tabla/rezervacije?role=guest" class="dash-nav-link">
      <span class="dash-nav-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none"><rect x="4" y="5.5" width="16" height="14.5" rx="2" stroke="currentColor" stroke-width="1.8" /><path d="M4 10h16M8 3.5v3M16 3.5v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>
      </span>
      {{ t('dashboard.myBookings') }}
    </NuxtLink>
    <NuxtLink to="/kontrolna-tabla/sacuvano" class="dash-nav-link">
      <span class="dash-nav-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none"><path d="M12 20s-7-4.35-9.5-8.5C.7 8 2 4.5 5.5 4.5c2 0 3.5 1.2 4.5 2.7 1-1.5 2.5-2.7 4.5-2.7C18 4.5 19.3 8 21.5 11.5 19 15.65 12 20 12 20Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" /></svg>
      </span>
      {{ t('nav.favorites') }}
    </NuxtLink>

    <p class="text-label dash-nav-section">{{ t('dashboard.sectionGeneral') }}</p>
    <NuxtLink to="/kontrolna-tabla/poruke" class="dash-nav-link">
      <span class="dash-nav-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none"><path d="M4 5.5h16a1 1 0 0 1 1 1V15a1 1 0 0 1-1 1H9l-4 3.5V16H4a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" /></svg>
      </span>
      {{ t('nav.messages') }}
    </NuxtLink>
    <NuxtLink to="/kontrolna-tabla/podesavanja" class="dash-nav-link">
      <span class="dash-nav-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8" /><path d="M12 3.5v2M12 18.5v2M20.5 12h-2M5.5 12h-2M17.7 6.3l-1.4 1.4M7.7 16.3l-1.4 1.4M17.7 17.7l-1.4-1.4M7.7 7.7 6.3 6.3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>
      </span>
      {{ t('dashboard.settings') }}
    </NuxtLink>

    <template v-if="auth.user?.isAdmin">
      <p class="text-label dash-nav-section">{{ t('dashboard.sectionAdmin') }}</p>
      <NuxtLink to="/admin" class="dash-nav-link">
        <span class="dash-nav-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none"><path d="M12 3.5l7 3v5c0 5-3 8-7 9-4-1-7-4-7-9v-5l7-3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" /></svg>
        </span>
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
