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
      <!-- T96 — this and "Moje rezervacije" below share one path
           (/kontrolna-tabla/rezervacije) differing only by ?role=; Vue
           Router's router-link-active ignores query strings, so both used
           to light up together. `custom` opts out of Router's own active
           class so isBookingsRoleActive can decide it from the query instead. -->
      <NuxtLink v-slot="{ href, navigate }" to="/kontrolna-tabla/rezervacije?role=owner" custom>
        <a :href="href" class="dash-nav-link" :class="{ 'dash-nav-link-active': isBookingsRoleActive('owner') }" @click="navigate">
          <span class="dash-nav-icon" aria-hidden="true"><DashboardNavIcon name="inbox" /></span>
          {{ t('dashboard.requests') }}
        </a>
      </NuxtLink>
      <NuxtLink to="/kontrolna-tabla/pretplate" class="dash-nav-link">
        <span class="dash-nav-icon" aria-hidden="true"><DashboardNavIcon name="card" /></span>
        {{ t('dashboard.subscriptions') }}
      </NuxtLink>
    </template>

    <p class="text-label dash-nav-section">{{ t('dashboard.sectionBooking') }}</p>
    <NuxtLink v-slot="{ href, navigate }" to="/kontrolna-tabla/rezervacije?role=guest" custom>
      <a :href="href" class="dash-nav-link" :class="{ 'dash-nav-link-active': isBookingsRoleActive('guest') }" @click="navigate">
        <span class="dash-nav-icon" aria-hidden="true"><DashboardNavIcon name="calendar" /></span>
        {{ t('dashboard.myBookings') }}
      </a>
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
const route = useRoute()

// T96 — matches DashboardBottomNav's isActive(): only true on the bookings
// list AND with this exact role in the query, so "Zahtevi za rezervaciju"
// and "Moje rezervacije" are never both highlighted at once.
function isBookingsRoleActive(role) {
  return route.path === '/kontrolna-tabla/rezervacije' && (route.query.role || 'guest') === role
}
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
.dash-nav-link.router-link-active,
.dash-nav-link.dash-nav-link-active {
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
