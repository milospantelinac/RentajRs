<template>
  <header class="site-header">
    <div class="container site-header-inner">
      <NuxtLink to="/" class="site-logo">
        <span class="site-logo-mark">R</span>
        <span class="site-logo-text">{{ t('common.appName') }}</span>
      </NuxtLink>

      <div class="d-none-mobile site-nav-pill-wrap">
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
          <NuxtLink to="/kontrolna-tabla" class="site-header-pill-btn d-none-mobile">{{ t('nav.dashboard') }}</NuxtLink>
        </template>

        <NuxtLink to="/oglasi/novi" class="site-header-cta-btn">
          <span class="site-header-cta-icon" aria-hidden="true">+</span>
          <span class="d-none-mobile">{{ t('nav.addListing') }}</span>
        </NuxtLink>

        <template v-if="auth.isAuthenticated">
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
        </template>
      </div>
    </div>
  </header>
</template>

<script setup>
const { t } = useI18n()
const auth = useAuthStore()
const menuOpen = ref(false)

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
  gap: 8px;
  font-weight: 700;
  font-size: $font-size-section-title;
  color: $color-text;
  flex-shrink: 0;
}

.site-logo:hover {
  text-decoration: none;
}

.site-logo-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: $radius-pill;
  background: $gradient-marketing;
  color: $color-surface;
  font-weight: 700;
}

.site-nav-pill-wrap {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
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
