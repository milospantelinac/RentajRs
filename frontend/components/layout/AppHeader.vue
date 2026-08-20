<template>
  <header class="site-header">
    <div class="container site-header-inner">
      <NuxtLink to="/" class="site-logo">
        <img src="/images/rentaj-logo.svg" :alt="t('common.appName')" class="site-logo-img" />
      </NuxtLink>

      <div class="site-nav-pill-wrap">
        <nav class="site-nav-pill">
          <NuxtLink to="/" class="site-nav-pill-link" exact-active-class="site-nav-pill-link-active">
            {{ t('nav.home') }}
          </NuxtLink>
          <NuxtLink to="/cenovnik" class="site-nav-pill-link" active-class="site-nav-pill-link-active">
            {{ t('nav.pricing') }}
          </NuxtLink>
          <NuxtLink to="/faq" class="site-nav-pill-link" active-class="site-nav-pill-link-active">
            {{ t('nav.faq') }}
          </NuxtLink>
          <NuxtLink to="/kontakt" class="site-nav-pill-link" active-class="site-nav-pill-link-active">
            {{ t('nav.contact') }}
          </NuxtLink>
        </nav>
      </div>

      <div class="site-header-actions">
        <template v-if="!auth.isAuthenticated">
          <NuxtLink to="/prijava" class="site-header-pill-btn d-none-mobile">{{ t('nav.login') }}</NuxtLink>
        </template>
        <template v-else>
          <NotificationBell />
        </template>

        <NuxtLink to="/oglasi/novi" class="site-header-cta-btn">
          <span class="site-header-cta-icon" aria-hidden="true">+</span>
          <span class="d-none-mobile">{{ t('nav.addListing') }}</span>
        </NuxtLink>

        <template v-if="auth.isAuthenticated">
          <div ref="userMenuRef" class="user-menu">
            <button class="user-menu-trigger" @click="menuOpen = !menuOpen">
              <img v-if="auth.user?.avatarUrl" :src="auth.user.avatarUrl" alt="" class="user-menu-avatar" />
              <span v-else class="user-menu-avatar user-menu-avatar-placeholder">{{ initials }}</span>
            </button>
            <div v-if="menuOpen" class="user-menu-dropdown card">
              <NuxtLink to="/kontrolna-tabla" class="user-menu-item" @click="menuOpen = false">{{ t('nav.dashboard') }}</NuxtLink>
              <NuxtLink to="/kontrolna-tabla/poruke" class="user-menu-item" @click="menuOpen = false">{{ t('nav.messages') }}</NuxtLink>
              <NuxtLink to="/kontrolna-tabla/sacuvano" class="user-menu-item" @click="menuOpen = false">{{ t('nav.favorites') }}</NuxtLink>
              <button class="user-menu-item user-menu-item-danger" @click="handleLogout">{{ t('nav.logout') }}</button>
            </div>
          </div>
        </template>
      </div>

      <div ref="mobileNavRef" class="mobile-nav-toggle-wrap">
        <button
          class="mobile-nav-toggle"
          :aria-expanded="mobileNavOpen"
          :aria-label="t('nav.menu')"
          @click="mobileNavOpen = !mobileNavOpen"
        >
          <FontAwesomeIcon :icon="mobileNavOpen ? 'xmark' : 'bars'" />
        </button>
        <div v-if="mobileNavOpen" class="mobile-nav-dropdown card">
          <NuxtLink
            to="/"
            class="mobile-nav-dropdown-item"
            exact-active-class="mobile-nav-dropdown-item-active"
            @click="mobileNavOpen = false"
          >
            {{ t('nav.home') }}
          </NuxtLink>
          <NuxtLink
            to="/cenovnik"
            class="mobile-nav-dropdown-item"
            active-class="mobile-nav-dropdown-item-active"
            @click="mobileNavOpen = false"
          >
            {{ t('nav.pricing') }}
          </NuxtLink>
          <NuxtLink
            to="/faq"
            class="mobile-nav-dropdown-item"
            active-class="mobile-nav-dropdown-item-active"
            @click="mobileNavOpen = false"
          >
            {{ t('nav.faq') }}
          </NuxtLink>
          <NuxtLink
            to="/kontakt"
            class="mobile-nav-dropdown-item"
            active-class="mobile-nav-dropdown-item-active"
            @click="mobileNavOpen = false"
          >
            {{ t('nav.contact') }}
          </NuxtLink>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup>
const { t } = useI18n()
const auth = useAuthStore()
const menuOpen = ref(false)
const userMenuRef = ref(null)
const mobileNavOpen = ref(false)
const mobileNavRef = ref(null)

useClickOutside(userMenuRef, () => {
  menuOpen.value = false
})

useClickOutside(mobileNavRef, () => {
  mobileNavOpen.value = false
})

const initials = computed(() => {
  const u = auth.user
  if (!u) return ''
  return `${u.firstName?.[0] ?? ''}${u.lastName?.[0] ?? ''}`.toUpperCase()
})

function handleLogout() {
  menuOpen.value = false
  auth.logout()
}
</script>

<style lang="scss" scoped>
.site-header {
  position: sticky;
  top: 0;
  z-index: $z-sticky-header;
  background: $color-surface;
  border-bottom: 1px solid $color-border;
}

.site-header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  height: 68px;
  position: relative;
}

.site-logo {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.site-logo:hover {
  text-decoration: none;
}

.site-logo-img {
  width: 130px;
  height: auto;
  display: block;
}

// Pills only fit between logo and actions once the header has real breathing
// room (RNT-061: at md–xxl the absolutely-centered pill nav overlapped the
// actions on the right). Below xxl it's replaced by the hamburger below.
.site-nav-pill-wrap {
  display: none;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}

@include respond-above(xxl) {
  .site-nav-pill-wrap {
    display: block;
  }
}

.site-nav-pill {
  display: flex;
  align-items: center;
  gap: 4px;
  background: $color-background;
  border-radius: $radius-input;
  padding: 5px;
}

.site-nav-pill-link {
  padding: 10px 20px;
  border-radius: $radius-button;
  font-weight: 600;
  font-size: $font-size-muted;
  color: $color-text;
  white-space: nowrap;
}

.site-nav-pill-link:hover {
  text-decoration: none;
}

.site-nav-pill-link-active {
  background: $color-surface;
  box-shadow: $shadow-card;
}

.site-header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  position: relative;
  margin-left: auto;
}

// Reserve room so the absolutely-positioned hamburger (right below) never
// sits on top of the last action item once it's visible.
@include respond-below(xxl) {
  .site-header-actions {
    margin-right: 52px;
  }
}

// Below md there's no slack left for a 4th 40-66px-wide action item next to
// a 130px logo — tighten gaps and swap the CTA's padded rectangle for an
// icon-sized circle (it's icon-only here anyway, text is d-none-mobile).
@include mobile-only {
  .site-header-inner {
    gap: 12px;
  }

  .site-header-actions {
    gap: 8px;
    margin-right: 48px;
  }
}

// Visible at every width the pill nav isn't (RNT-061/062: pills only fit
// from xxl up; below that, including real mobile, this is the only way to
// reach Početna/Cenovnik/FAQ/Kontakt). Pinned to the header's own right
// edge regardless of how much is in .site-header-actions. `right` matches
// .container's own padding-left/right — an absolutely positioned child's
// right:0 lands on the container's padding-box edge, not its content edge,
// so left at 0 it would sit flush with the viewport, ignoring that padding.
.mobile-nav-toggle-wrap {
  display: none;
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
}

@include respond-above(md) {
  .mobile-nav-toggle-wrap {
    right: 24px;
  }
}

@include respond-below(xxl) {
  .mobile-nav-toggle-wrap {
    display: block;
  }
}

.mobile-nav-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: $radius-input;
  background: $color-background;
  color: $color-text;
  font-size: 16px;
  cursor: pointer;
}

.mobile-nav-toggle:hover {
  background: $color-border;
}

.mobile-nav-dropdown {
  position: absolute;
  top: 48px;
  right: 0;
  min-width: 180px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  z-index: $z-dropdown;
}

.mobile-nav-dropdown-item {
  display: block;
  padding: 10px 12px;
  border-radius: $radius-button;
  font-weight: 500;
  font-size: $font-size-muted;
  color: $color-text;
}

.mobile-nav-dropdown-item:hover {
  background: $color-background;
  text-decoration: none;
}

.mobile-nav-dropdown-item-active {
  background: $color-background;
  color: $color-primary;
  font-weight: 600;
}

.site-header-pill-btn {
  padding: 14px 32px;
  border-radius: $radius-input;
  background: $color-background;
  color: $color-text;
  font-weight: 500;
  font-size: $font-size-muted;
  white-space: nowrap;
}

.site-header-pill-btn:hover {
  text-decoration: none;
  background: $color-border;
}

.site-header-cta-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 20px;
  border-radius: $radius-input;
  background: $color-background;
  color: $color-text;
  font-weight: 500;
  font-size: $font-size-muted;
  white-space: nowrap;
}

.site-header-cta-btn:hover {
  text-decoration: none;
  background: $color-border;
}

@include mobile-only {
  .site-header-cta-btn {
    width: 44px;
    height: 44px;
    padding: 0;
    justify-content: center;
  }
}

.site-header-cta-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: $radius-badge;
  background: $gradient-marketing;
  color: $color-surface;
  font-size: 16px;
  line-height: 1;
  flex-shrink: 0;
}

.user-menu {
  position: relative;
}

.user-menu-trigger {
  border: none;
  background: none;
  padding: 0;
  cursor: pointer;
}

.user-menu-avatar {
  width: 36px;
  height: 36px;
  border-radius: $radius-pill;
  object-fit: cover;
}

.user-menu-avatar-placeholder {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: $color-dark;
  color: $color-surface;
  font-size: $font-size-muted;
  font-weight: 600;
}

.user-menu-dropdown {
  position: absolute;
  top: 48px;
  right: 0;
  min-width: 200px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  z-index: $z-dropdown;
}

.user-menu-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 10px 12px;
  border-radius: $radius-button;
  border: none;
  background: none;
  font-size: $font-size-muted;
  color: $color-text;
  cursor: pointer;
}

.user-menu-item:hover {
  background: $color-background;
  text-decoration: none;
}

.user-menu-item-danger {
  color: $color-error;
}
</style>
