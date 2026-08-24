import { defineStore } from 'pinia'

// Shared across every ListingCard/ListingPublicView instance on the page —
// without this, a search results grid of 20 cards would each independently
// call GET /users/me/favorites. One fetch, cached for the session; toggling
// on one card (or on the Sačuvano page) is instantly reflected everywhere
// else showing the same listing, since they all read this same Set.
export const useFavoritesStore = defineStore('favorites', {
  state: () => ({
    ids: new Set(),
    loaded: false,
    // A plain boolean, not a stored Promise — Nuxt SSR serializes Pinia
    // state for hydration and a raw Promise there isn't serializable
    // (DevalueError: "Cannot stringify a Promise"). It also can't be a
    // module-scoped variable instead: Nitro's node-server reuses one
    // process across concurrent requests, so that would let one visitor's
    // in-flight fetch get awaited (and its favorites data delivered) by a
    // different visitor's request. Pinia state is already isolated per
    // request, so it's the only safe place for this flag.
    loading: false,
  }),

  actions: {
    async ensureLoaded() {
      const auth = useAuthStore()
      if (!auth.isAuthenticated || this.loaded || this.loading) return
      this.loading = true
      const api = useApi()
      try {
        const favorites = await api.get('/users/me/favorites')
        this.ids = new Set((favorites || []).map((f) => f.listingId))
        this.loaded = true
      } catch {
        // leave loaded=false so a later ensureLoaded() call retries
      } finally {
        this.loading = false
      }
    },

    /** Sačuvano already fetches the full favorites list itself — seed from that instead of a second call. */
    seed(listingIds) {
      this.ids = new Set(listingIds)
      this.loaded = true
    },

    isFavorited(listingId) {
      return this.ids.has(listingId)
    },

    async toggle(listingId) {
      const api = useApi()
      if (this.ids.has(listingId)) {
        await api.delete(`/listings/${listingId}/favorite`)
        this.ids.delete(listingId)
      } else {
        await api.post(`/listings/${listingId}/favorite`, {})
        this.ids.add(listingId)
      }
    },
  },
})
