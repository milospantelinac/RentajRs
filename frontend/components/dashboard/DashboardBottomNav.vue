<template>
  <nav class="bottom-nav">
    <NuxtLink v-for="item in leftItems" :key="item.to" :to="item.to" class="bottom-nav-item" active-class="bottom-nav-item-active">
      <DashboardNavIcon :name="item.icon" class="bottom-nav-icon" />
      <span class="bottom-nav-label">{{ t(item.labelKey) }}</span>
    </NuxtLink>

    <NuxtLink to="/kontrolna-tabla" class="bottom-nav-home" exact-active-class="bottom-nav-home-active">
      <span class="bottom-nav-home-circle">
        <DashboardNavIcon name="home" class="bottom-nav-home-icon" />
      </span>
      <span class="bottom-nav-label">{{ t('dashboard.overview') }}</span>
    </NuxtLink>

    <NuxtLink to="/kontrolna-tabla/poruke" class="bottom-nav-item" active-class="bottom-nav-item-active">
      <DashboardNavIcon name="message" class="bottom-nav-icon" />
      <span class="bottom-nav-label">{{ t('nav.messages') }}</span>
    </NuxtLink>

    <button type="button" class="bottom-nav-item" :class="{ 'bottom-nav-item-active': moreOpen }" @click="moreOpen = !moreOpen">
      <DashboardNavIcon name="more" class="bottom-nav-icon" />
      <span class="bottom-nav-label">{{ t('dashboard.more') }}</span>
    </button>

    <Teleport to="body">
      <Transition name="sheet">
        <div v-if="moreOpen" class="more-sheet-backdrop" @click="moreOpen = false">
          <div class="more-sheet" @click.stop>
            <span class="more-sheet-handle" aria-hidden="true" />
            <NuxtLink v-for="item in moreItems" :key="item.to" :to="item.to" class="more-sheet-item" @click="moreOpen = false">
              <DashboardNavIcon :name="item.icon" class="more-sheet-icon" />
              {{ t(item.labelKey) }}
            </NuxtLink>
          </div>
        </div>
      </Transition>
    </Teleport>
  </nav>
</template>

<script setup>
// R156 — mobile navigation for dashboard-area screens is a fixed bottom bar.
// A real tab bar only has room for ~5 slots, but the sidebar has up to 9
// destinations (owner + admin), so the two lower-traffic ones each role
// doesn't need at a glance go behind "Više" instead of being dropped.
const { t } = useI18n()
const auth = useAuthStore()
const route = useRoute()
const moreOpen = ref(false)

watch(
  () => route.fullPath,
  () => {
    moreOpen.value = false
  },
)

const leftItems = computed(() =>
  auth.user?.isOwner
    ? [
        { to: '/kontrolna-tabla/oglasi', labelKey: 'listing.myListings', icon: 'list' },
        { to: '/kontrolna-tabla/rezervacije?role=owner', labelKey: 'dashboard.requests', icon: 'inbox' },
      ]
    : [
        { to: '/kontrolna-tabla/rezervacije?role=guest', labelKey: 'dashboard.myBookings', icon: 'calendar' },
        { to: '/kontrolna-tabla/sacuvano', labelKey: 'nav.favorites', icon: 'heart' },
      ],
)

const moreItems = computed(() => {
  const items = auth.user?.isOwner
    ? [
        { to: '/kontrolna-tabla/pretplate', labelKey: 'dashboard.subscriptions', icon: 'card' },
        { to: '/kontrolna-tabla/rezervacije?role=guest', labelKey: 'dashboard.myBookings', icon: 'calendar' },
        { to: '/kontrolna-tabla/sacuvano', labelKey: 'nav.favorites', icon: 'heart' },
        { to: '/kontrolna-tabla/podesavanja', labelKey: 'dashboard.settings', icon: 'gear' },
      ]
    : [{ to: '/kontrolna-tabla/podesavanja', labelKey: 'dashboard.settings', icon: 'gear' }]
  if (auth.user?.isAdmin) items.push({ to: '/admin', labelKey: 'dashboard.adminPanel', icon: 'shield' })
  return items
})
</script>

<style lang="scss" scoped>
.bottom-nav {
  display: none;
}

@include mobile-only {
  .bottom-nav {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    align-items: center;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 60px;
    padding-bottom: env(safe-area-inset-bottom);
    background: $color-surface;
    border-top: 1px solid $color-border;
    box-shadow: 0 -2px 10px rgba(15, 27, 51, 0.05);
    z-index: $z-mobile-bottom-nav;
  }
}

.bottom-nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  height: 100%;
  border: none;
  background: none;
  color: $color-text-muted;
  min-height: $touch-target-min;
  cursor: pointer;
}

.bottom-nav-icon {
  width: 21px;
  height: 21px;
}

.bottom-nav-label {
  font-size: 10.5px;
  font-weight: 500;
  line-height: 1;
}

.bottom-nav-item-active {
  color: $color-primary;
}

// The home tab is lifted out of the bar as a raised, filled circle — the
// one deliberately "branded" element here, everything else stays neutral.
.bottom-nav-home {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 2px;
  height: 100%;
  padding-top: 2px;
  color: $color-text-muted;
}

.bottom-nav-home-circle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 46px;
  margin-top: -22px;
  border-radius: $radius-pill;
  background: $gradient-marketing;
  box-shadow: 0 6px 16px -4px rgba(9, 87, 223, 0.55);
  border: 3px solid $color-surface;
}

.bottom-nav-home-icon {
  width: 20px;
  height: 20px;
  color: $color-surface;
}

.bottom-nav-home-active .bottom-nav-label {
  color: $color-primary;
  font-weight: 700;
}

.more-sheet-backdrop {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: flex-end;
  background: rgba(6, 27, 49, 0.45);
  z-index: $z-modal;
}

.more-sheet {
  width: 100%;
  padding: 10px 12px calc(16px + env(safe-area-inset-bottom));
  background: $color-surface;
  border-radius: 20px 20px 0 0;
  box-shadow: 0 -8px 24px rgba(15, 27, 51, 0.12);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.more-sheet-handle {
  width: 36px;
  height: 4px;
  margin: 4px auto 12px;
  border-radius: $radius-pill;
  background: $color-border;
}

.more-sheet-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 13px 10px;
  border-radius: $radius-button;
  color: $color-text;
  font-size: $font-size-body;
}

.more-sheet-item:hover,
.more-sheet-item:active {
  background: $color-background;
  text-decoration: none;
}

.more-sheet-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  color: $color-text-muted;
}

.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.2s ease;
}

.sheet-enter-active .more-sheet,
.sheet-leave-active .more-sheet {
  transition: transform 0.22s ease;
}

.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}

.sheet-enter-from .more-sheet,
.sheet-leave-to .more-sheet {
  transform: translateY(100%);
}
</style>
