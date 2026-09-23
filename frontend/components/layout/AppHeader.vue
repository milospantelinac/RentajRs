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
        <template v-if="auth.isAuthenticated">
          <NotificationBell />
        </template>

        <!-- Figma puts "Dodaj Oglas" before "Prijava", with the login pill
             flush against the right content edge. -->
        <NuxtLink to="/oglasi/novi" class="site-header-cta-btn">
          <span class="site-header-cta-icon" aria-hidden="true">
            <svg viewBox="0 0 7 11" fill="none">
              <path
                d="M0.654258 1.91787C0.29346 1.56479 0.293461 0.992339 0.654259 0.639262C1.01506 0.286185 1.60002 0.286186 1.96082 0.639263L5.88051 4.47508C6.24131 4.82815 6.24131 5.4006 5.88051 5.75368C5.51972 6.10676 4.93475 6.10676 4.57395 5.75368L0.654258 1.91787Z"
                fill="white"
              />
              <path
                d="M4.57304 4.47548C4.93383 4.12241 5.5188 4.12241 5.8796 4.47548C6.2404 4.82856 6.2404 5.40101 5.8796 5.75409L1.95991 9.5899C1.59911 9.94298 1.01414 9.94298 0.653344 9.5899C0.292546 9.23682 0.292547 8.66437 0.653344 8.3113L4.57304 4.47548Z"
                fill="white"
              />
            </svg>
          </span>
          <span class="d-none-mobile">{{ t('nav.addListing') }}</span>
        </NuxtLink>

        <template v-if="!auth.isAuthenticated">
          <NuxtLink to="/prijava" class="site-header-pill-btn d-none-mobile">{{ t('nav.login') }}</NuxtLink>
        </template>

        <template v-if="auth.isAuthenticated">
          <div ref="userMenuRef" class="user-menu">
            <button class="user-menu-trigger" @click="menuOpen = !menuOpen">
              <img v-if="auth.user?.avatarUrl" :src="auth.user.avatarUrl" alt="" class="user-menu-avatar" />
              <span v-else class="user-menu-avatar user-menu-avatar-placeholder">{{ initials }}</span>
              <span class="user-menu-name d-none-mobile">{{ auth.user?.firstName }}</span>
              <svg class="user-menu-chevron d-none-mobile" viewBox="0 0 12 8" fill="none">
                <path d="M1 1l5 5 5-5" stroke="currentColor" stroke-width="1.5" fill="none" />
              </svg>
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
          <img src="/images/icons/menu-22.svg" alt="" class="mobile-nav-toggle-lines" />
          <FontAwesomeIcon :icon="mobileNavOpen ? 'xmark' : 'bars'" class="mobile-nav-toggle-fa" />
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
          <!-- Dizajn 42: the phone header keeps only the logo and this menu, so
               the two header buttons move in here. -->
          <NuxtLink
            to="/oglasi/novi"
            class="mobile-nav-dropdown-item mobile-nav-dropdown-item-phone"
            active-class="mobile-nav-dropdown-item-active"
            @click="mobileNavOpen = false"
          >
            {{ t('nav.addListing') }}
          </NuxtLink>
          <NuxtLink
            v-if="!auth.isAuthenticated"
            to="/prijava"
            class="mobile-nav-dropdown-item mobile-nav-dropdown-item-phone"
            active-class="mobile-nav-dropdown-item-active"
            @click="mobileNavOpen = false"
          >
            {{ t('nav.login') }}
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
  // Figma runs the header straight into the hero card with no rule under it.
}

// Dizajn 5 — 104px (was 68).
.site-header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  height: 104px;
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
  gap: 41px;
  background: $color-background;
  border-radius: $radius-input;
  padding: 16px 34px;
}

.site-nav-pill-link {
  font-size: 14px;
  color: $color-text;
  white-space: nowrap;
}

.site-nav-pill-link:hover {
  text-decoration: none;
}

.site-nav-pill-link-active {
  color: $color-primary;
  font-weight: 600;
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

// Dizajn 42 (94:27, first column): the phone header is 77 tall with only the
// 112px logo and the menu lines. "Dodaj oglas" and "Prijava" move into the
// menu; a signed-in user keeps the bell and the avatar next to it.
@include mobile-only {
  .site-header-inner {
    gap: 12px;
    height: 77px;
  }

  .site-logo-img {
    width: 112px;
  }

  .site-header-actions {
    gap: 8px;
    margin-right: 48px;
  }
}

.site-header-pill-btn {
  display: flex;
  align-items: center;
  height: 44px;
  padding: 0 20px;
  // Dizajn 5 — the header's own action buttons use an 8px radius, distinct
  // from the 12px shared $radius-input used by the nav pill above.
  border-radius: 8px;
  background: $color-background;
  color: $color-text;
  font-weight: 500;
  font-size: 14px;
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
  height: 44px;
  padding: 0 16px;
  border-radius: 8px;
  background: $color-background;
  color: $color-text;
  font-weight: 500;
  font-size: 14px;
  white-space: nowrap;
}

.site-header-cta-btn:hover {
  text-decoration: none;
  background: $color-border;
}

.site-header-cta-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: $gradient-marketing;
  flex-shrink: 0;
}

.site-header-cta-icon svg {
  width: 7px;
  height: 11px;
}

// Dizajn 42: on a phone both buttons live in the menu instead.
@include mobile-only {
  .site-header-cta-btn,
  .site-header-pill-btn {
    display: none;
  }
}

.user-menu {
  position: relative;
}

.user-menu-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 44px;
  padding: 0 12px 0 6px;
  border: none;
  border-radius: 8px;
  background: $color-background;
  cursor: pointer;
}

.user-menu-trigger:hover {
  background: $color-border;
}

.user-menu-avatar {
  width: 32px;
  height: 32px;
  border-radius: $radius-pill;
  object-fit: cover;
  flex-shrink: 0;
}

.user-menu-avatar-placeholder {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: $color-dark;
  color: $color-surface;
  font-size: 12px;
  font-weight: 600;
}

.user-menu-name {
  font-size: 14px;
  font-weight: 500;
  color: $color-text;
  white-space: nowrap;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-menu-chevron {
  width: 10px;
  height: 7px;
  color: $color-text-muted;
  flex-shrink: 0;
}

.user-menu-dropdown {
  position: absolute;
  top: 52px;
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

.mobile-nav-toggle-lines {
  display: none;
}

// 26:3103: the bare 22x16 lines, flush with the 16px gutter; the button keeps
// a 44px tap area that grows to the left of them.
@include mobile-only {
  .mobile-nav-toggle {
    width: 44px;
    height: 44px;
    padding: 0;
    justify-content: flex-end;
    background: none;
  }

  .mobile-nav-toggle:hover {
    background: none;
  }

  .mobile-nav-toggle-lines {
    display: block;
    width: 22.19px;
    height: 15.72px;
  }

  .mobile-nav-toggle-fa {
    display: none;
  }
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

.mobile-nav-dropdown-item-phone {
  display: none;
}

@include mobile-only {
  .mobile-nav-dropdown-item-phone {
    display: block;
  }
}
</style>
