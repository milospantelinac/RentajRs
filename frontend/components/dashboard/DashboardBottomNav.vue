<template>
  <nav class="bottom-nav">
    <div class="bottom-nav-bar">
      <div class="bottom-nav-side">
        <NuxtLink v-for="item in leftItems" :key="item.to" :to="item.to" class="bottom-nav-item" active-class="bottom-nav-item-active">
          <span class="bottom-nav-icon-wrap">
            <DashboardNavIcon :name="item.icon" class="bottom-nav-icon" />
          </span>
          <span class="bottom-nav-label">{{ t(item.labelKey) }}</span>
        </NuxtLink>
      </div>

      <span class="bottom-nav-fab-space" aria-hidden="true" />

      <div class="bottom-nav-side">
        <NuxtLink to="/kontrolna-tabla/poruke" class="bottom-nav-item" active-class="bottom-nav-item-active">
          <span class="bottom-nav-icon-wrap">
            <DashboardNavIcon name="message" class="bottom-nav-icon" />
          </span>
          <span class="bottom-nav-label">{{ t('nav.messages') }}</span>
        </NuxtLink>

        <button
          type="button"
          class="bottom-nav-item"
          :class="{ 'bottom-nav-item-active': moreOpen || isMoreActive }"
          @click="moreOpen = !moreOpen"
        >
          <span class="bottom-nav-icon-wrap">
            <DashboardNavIcon name="more" class="bottom-nav-icon" />
          </span>
          <span class="bottom-nav-label">{{ t('dashboard.more') }}</span>
        </button>
      </div>
    </div>

    <!-- Sits outside .bottom-nav-bar so the bar's own notch mask doesn't clip it too -->
    <NuxtLink to="/kontrolna-tabla" class="bottom-nav-fab" exact-active-class="bottom-nav-fab-active">
      <span class="bottom-nav-fab-circle">
        <DashboardNavIcon name="home" class="bottom-nav-fab-icon" />
      </span>
      <span class="bottom-nav-label bottom-nav-fab-label">{{ t('dashboard.overview') }}</span>
    </NuxtLink>

    <Teleport to="body">
      <Transition name="sheet">
        <div v-if="moreOpen" class="more-sheet-backdrop" @click="moreOpen = false">
          <div class="more-sheet" @click.stop>
            <span class="more-sheet-handle" aria-hidden="true" />
            <NuxtLink
              v-for="item in moreItems"
              :key="item.to"
              :to="item.to"
              class="more-sheet-item"
              active-class="more-sheet-item-active"
              @click="moreOpen = false"
            >
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
        { to: '/kontrolna-tabla/oglasi', labelKey: 'dashboard.tabListings', icon: 'list' },
        { to: '/kontrolna-tabla/rezervacije?role=owner', labelKey: 'dashboard.tabRequests', icon: 'inbox' },
      ]
    : [
        { to: '/kontrolna-tabla/rezervacije?role=guest', labelKey: 'dashboard.tabBookings', icon: 'calendar' },
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

// The "Više" tab itself has no route of its own, so NuxtLink's active-class
// can't mark it — mark it by hand whenever the current page is one of the
// sheet's own destinations (comparing paths only; the items' query strings
// don't affect which page we're actually on).
const isMoreActive = computed(() => moreItems.value.some((item) => route.path === item.to.split('?')[0]))
</script>

<style lang="scss" scoped>
.bottom-nav {
  display: none;
}

@include mobile-only {
  .bottom-nav {
    display: block;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 60px;
    z-index: $z-mobile-bottom-nav;
  }
}

.bottom-nav-bar {
  display: flex;
  align-items: center;
  position: absolute;
  inset: 0;
  padding-bottom: env(safe-area-inset-bottom);
  background: $color-surface;
  border-top: 1px solid $color-border;
  box-shadow: 0 -2px 10px rgba(15, 27, 51, 0.05);

  // The hole Home's circle sits in — punched through the bar's own
  // background at top-center, a few px wider than the circle so a ring of
  // the page background shows all around it (the "cut into the bar" look).
  $notch-radius: 30px;
  -webkit-mask-image: radial-gradient(circle $notch-radius at 50% 0%, transparent 0 $notch-radius, black #{$notch-radius + 1px} 100%);
  mask-image: radial-gradient(circle $notch-radius at 50% 0%, transparent 0 $notch-radius, black #{$notch-radius + 1px} 100%);
}

.bottom-nav-side {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-around;
  height: 100%;
}

.bottom-nav-fab-space {
  width: 76px;
  flex-shrink: 0;
}

.bottom-nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 100%;
  border: none;
  background: none;
  color: $color-text-muted;
  min-height: $touch-target-min;
  cursor: pointer;
  text-decoration: none;
}

// Inactive tabs show a plain icon; the active one gets a soft rounded-square
// highlight behind the icon instead — no gradients, just a tinted pill, and
// every tab (including Home) uses the exact same treatment when current.
.bottom-nav-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 30px;
  border-radius: $radius-card;
  transition: background-color 0.15s ease;
}

.bottom-nav-icon {
  width: 20px;
  height: 20px;
}

.bottom-nav-label {
  font-size: 10.5px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
}

.bottom-nav-item-active {
  color: $color-primary;
}

.bottom-nav-item-active .bottom-nav-icon-wrap {
  background: rgba($color-primary, 0.12);
}

.bottom-nav-item-active .bottom-nav-label {
  font-weight: 700;
}

// Raised, solid-color circle centered over the notch cut into the bar —
// half above the bar's top edge, half below it. No gradient; a plain
// $color-primary fill reads as the one deliberately emphasized tab.
.bottom-nav-fab {
  position: absolute;
  top: -24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  text-decoration: none;
}

.bottom-nav-fab-circle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: $radius-pill;
  background: $color-primary;
  box-shadow: 0 4px 10px rgba(9, 87, 223, 0.35);
}

.bottom-nav-fab-icon {
  width: 20px;
  height: 20px;
  color: $color-surface;
}

.bottom-nav-fab-label {
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

.more-sheet-item-active {
  background: rgba($color-primary, 0.08);
  color: $color-primary;
  font-weight: 600;
}

.more-sheet-item-active .more-sheet-icon {
  color: $color-primary;
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
