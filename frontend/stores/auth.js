import { defineStore } from 'pinia'

// Tokens live in cookies (not localStorage) so they're available during SSR
// for protected-page rendering — see nuxt.config runtimeConfig comments on
// why the frontend never talks to Postgres directly, only this API.
const ACCESS_COOKIE = 'rentaj_at'
const REFRESH_COOKIE = 'rentaj_rt'
const COOKIE_OPTS = { maxAge: 60 * 60 * 24 * 30, sameSite: 'lax' }

// IMPORTANT: useCookie() (like every Nuxt composable) needs Nuxt's
// request-scoped context, which is only guaranteed to still be attached
// synchronously or immediately after an await *on the same microtask
// chain*. Once you're inside a callback that escaped that chain (a catch
// block after an awaited $fetch, e.g.), calling useCookie() directly throws
// "composable called outside a plugin" during SSR. useNuxtApp().runWithContext()
// re-attaches that context explicitly, so every cookie read/write below goes
// through withCookies() instead of calling useCookie() bare.
function withCookies(fn) {
  return useNuxtApp().runWithContext(() => {
    const access = useCookie(ACCESS_COOKIE, COOKIE_OPTS)
    const refresh = useCookie(REFRESH_COOKIE, COOKIE_OPTS)
    return fn(access, refresh)
  })
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    accessToken: null,
    refreshToken: null,
    initialized: false,
  }),

  getters: {
    isAuthenticated: (state) => !!state.accessToken && !!state.user,
    isOwner: (state) => !!state.user?.isOwner,
  },

  actions: {
    async setTokens(accessToken, refreshToken) {
      this.accessToken = accessToken
      this.refreshToken = refreshToken
      await withCookies((access, refresh) => {
        access.value = accessToken
        refresh.value = refreshToken
      })
    },

    async clearSessionAndCookies() {
      await withCookies((access, refresh) => {
        access.value = null
        refresh.value = null
      })
      this.clearSessionState()
    },

    /** Safe to call from anywhere (including after an await) — just resets in-memory state. */
    clearSessionState() {
      this.user = null
      this.accessToken = null
      this.refreshToken = null
    },

    /** Called once per request (server, via plugins/auth.js) / once on boot (client). */
    async initFromCookies() {
      // Grabbed once, up front — every composable call below happens after an
      // `await`, and re-entering via runWithContext() is the only way those
      // stay attached to *this* request's Nuxt instance (see nuxt.config.ts
      // experimental.asyncContext comment for why that matters during SSR).
      const nuxtApp = useNuxtApp()
      const { access, refresh } = await withCookies((access, refresh) => ({ access, refresh }))
      if (!access.value) {
        this.initialized = true
        return
      }
      this.accessToken = access.value
      this.refreshToken = refresh.value

      try {
        this.user = await nuxtApp.runWithContext(() => useApi().get('/users/me'))
      } catch {
        this.clearSessionState()
      }
      this.initialized = true
    },

    async login(email, password, rememberMe = false) {
      const api = useApi()
      const result = await api.post('/auth/login', { email, password, rememberMe })
      if (result.twoFactorRequired || result.twoFactorSetupRequired) return result
      await this.setTokens(result.accessToken, result.refreshToken)
      await this.fetchMe()
      return result
    },

    async verifyTwoFactor(tempToken, code) {
      const api = useApi()
      const result = await api.post('/auth/login/2fa', { tempToken, code })
      await this.setTokens(result.accessToken, result.refreshToken)
      await this.fetchMe()
      return result
    },

    async register(payload) {
      const api = useApi()
      return api.post('/auth/register', payload)
    },

    async fetchMe() {
      const api = useApi()
      this.user = await api.get('/users/me')
    },

    async refreshSession() {
      if (!this.refreshToken) return false
      try {
        const config = useRuntimeConfig()
        const baseURL = import.meta.server ? config.apiBaseInternal : config.public.apiBase
        const result = await $fetch('/auth/refresh', {
          baseURL,
          method: 'POST',
          body: { refreshToken: this.refreshToken },
        })
        await this.setTokens(result.accessToken, result.refreshToken)
        return true
      } catch {
        return false
      }
    },

    async logout() {
      const api = useApi()
      const refreshToken = this.refreshToken
      await this.clearSessionAndCookies()
      try {
        await api.post('/auth/logout', { refreshToken })
      } catch {
        // best-effort — already cleared locally regardless
      }
      await navigateTo('/')
    },
  },
})
