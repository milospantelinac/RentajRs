<template>
  <nav class="dash-nav card">
    <template v-for="group in groups" :key="group.key">
      <p v-if="group.titleKey" class="dash-nav-group">{{ t(group.titleKey) }}</p>
      <template v-for="item in group.items" :key="item.to">
        <!-- `custom` keeps Vue Router's own active class and aria-current out:
             both ignore the query (utils/dashboardNav.js). -->
        <NuxtLink v-slot="{ href, navigate }" :to="item.to" custom>
          <a
            :href="href"
            class="dash-nav-link"
            :class="{ 'dash-nav-link-active': isLinkActive(item.to) }"
            :aria-current="isLinkActive(item.to) ? 'page' : undefined"
            @click="navigate"
          >
            <DashboardNavIcon :name="item.icon" class="dash-nav-icon" />
            <span class="dash-nav-label">{{ t(item.labelKey) }}</span>
            <span v-if="item.count && counts[item.count] > 0" class="dash-nav-count">{{ formatNavCount(counts[item.count]) }}</span>
          </a>
        </NuxtLink>
      </template>
    </template>
  </nav>
</template>

<script setup>
const { t } = useI18n()
const auth = useAuthStore()
const { isLinkActive } = useDashboardActiveLink()
const counts = useDashboardCountsStore()

// Dizajn 30 keeps who sees what: the renting group is for owners and the
// admin group for admins, as before. `count` names the counter in
// stores/dashboardCounts.js an entry carries.
const groups = computed(() => {
  const list = [{ key: 'home', items: [{ to: '/kontrolna-tabla', labelKey: 'dashboard.overview', icon: 'home' }] }]
  if (auth.user?.isOwner) {
    list.push({
      key: 'renting',
      titleKey: 'dashboard.sectionRenting',
      items: [
        { to: '/kontrolna-tabla/oglasi', labelKey: 'listing.myListings', icon: 'listings' },
        { to: '/kontrolna-tabla/rezervacije?role=owner', labelKey: 'dashboard.requests', icon: 'requests', count: 'bookingRequests' },
        { to: '/kontrolna-tabla/pretplate', labelKey: 'dashboard.subscriptions', icon: 'packages' },
      ],
    })
  }
  list.push(
    {
      key: 'booking',
      titleKey: 'dashboard.sectionBooking',
      items: [
        { to: '/kontrolna-tabla/rezervacije?role=guest', labelKey: 'dashboard.myBookings', icon: 'bookings' },
        { to: '/kontrolna-tabla/sacuvano', labelKey: 'nav.favorites', icon: 'saved' },
      ],
    },
    {
      key: 'general',
      titleKey: 'dashboard.sectionGeneral',
      items: [
        { to: '/kontrolna-tabla/poruke', labelKey: 'nav.messages', icon: 'messages', count: 'unreadConversations' },
        { to: '/kontrolna-tabla/podesavanja', labelKey: 'dashboard.settings', icon: 'profile' },
      ],
    },
  )
  if (auth.user?.isAdmin) {
    list.push({
      key: 'admin',
      titleKey: 'dashboard.sectionAdmin',
      items: [{ to: '/admin', labelKey: 'dashboard.adminPanel', icon: 'admin' }],
    })
  }
  return list
})
</script>

<style lang="scss" scoped>
// Dizajn 30, frame 357:444. The card itself is the shared .card (white, 16
// radius, the frame's two-layer shadow).
$nav-count-bg: #f43f5e;

.dash-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 20px 14px;
}

// 357:449: an 11px Medium caption, 16 above it and 6 below
.dash-nav-group {
  padding: 16px 0 6px 14px;
  font-size: 11px;
  font-weight: 500;
  line-height: normal;
  letter-spacing: 0.7px;
  text-transform: uppercase;
  color: $color-text-muted;
}

// 357:451
.dash-nav-link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 14px;
  border-radius: $radius-button;
  font-size: 14px;
  font-weight: 400;
  line-height: normal;
  color: $color-text;
  text-decoration: none;
}

.dash-nav-icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  color: $color-text-muted;
}

// The frame draws no hover; this keeps the old one (page grey, blue text).
.dash-nav-link:hover {
  background: $color-background;
  color: $color-primary;
  text-decoration: none;
}

.dash-nav-link:hover .dash-nav-icon {
  color: $color-primary;
}

// 357:445, and 378:456 / 380:943 with a counter
.dash-nav-link-active,
.dash-nav-link-active:hover {
  background: $color-accent-tint;
  color: $color-primary;
  font-weight: 500;
}

.dash-nav-link-active .dash-nav-icon {
  color: $color-primary;
}

.dash-nav-label {
  flex: 1 0 0;
  min-width: 1px;
}

// 357:462. Figma rounds the digit's box up to 7, so one digit makes a 23 wide
// pill; the minimum keeps that, longer numbers grow it.
.dash-nav-count {
  flex-shrink: 0;
  min-width: 23px;
  padding: 3px 8px;
  border-radius: $radius-pill;
  background: $nav-count-bg;
  font-size: 11px;
  font-weight: 500;
  line-height: normal;
  color: $color-surface;
}
</style>
