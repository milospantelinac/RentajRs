/**
 * Single point of contact with the backend — every data fetch in the app
 * goes through this (never a raw fetch()/axios call scattered in a
 * component), so auth headers, base-URL switching (server vs. browser) and
 * 401-refresh-and-retry logic live in exactly one place.
 */
export function useApi() {
  const config = useRuntimeConfig()
  const auth = useAuthStore()
  // Read the locale straight from the same cookie @nuxtjs/i18n itself uses,
  // rather than useI18n() — useApi() is also called from Pinia store actions
  // (see stores/auth.js), which run outside an active component instance,
  // and useI18n() throws in that context instead of just returning a default.
  const localeCookie = useCookie('i18n_redirected')

  // Inside Docker, SSR fetches must hit the backend container by its
  // service name; the browser must hit the publicly reachable URL.
  const baseURL = import.meta.server ? config.apiBaseInternal : config.public.apiBase

  async function request(path, options = {}) {
    const headers = { ...(options.headers || {}) }
    if (auth.accessToken) {
      headers.Authorization = `Bearer ${auth.accessToken}`
    }
    // Without this, backend error/validation messages fall back to the
    // browser's OS-level Accept-Language header, which is often English even
    // when the visitor is actively using the Serbian UI (see nestjs-i18n's
    // resolver chain in i18n.module.ts — x-lang is checked before that).
    headers['x-lang'] = localeCookie.value || 'sr'

    try {
      return await $fetch(path, { baseURL, ...options, headers })
    } catch (error) {
      const status = error?.response?.status
      if (status === 401 && auth.refreshToken && !options._retried) {
        const refreshed = await auth.refreshSession()
        if (refreshed) {
          return request(path, { ...options, _retried: true })
        }
        // Post-await: only touch in-memory state, never useCookie (see stores/auth.js).
        auth.clearSessionState()
      }
      throw error
    }
  }

  return {
    get: (path, opts) => request(path, { method: 'GET', ...opts }),
    post: (path, body, opts) => request(path, { method: 'POST', body, ...opts }),
    patch: (path, body, opts) => request(path, { method: 'PATCH', body, ...opts }),
    put: (path, body, opts) => request(path, { method: 'PUT', body, ...opts }),
    delete: (path, opts) => request(path, { method: 'DELETE', ...opts }),
    raw: request,
  }
}
