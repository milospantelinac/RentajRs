import { defineStore } from 'pinia'

// Dizajn 30: the red counters next to "Zahtevi za rezervaciju" and "Poruke",
// shared by the sidebar and the mobile bottom bar. The dashboard layout
// refreshes them after every page it shows and every 30 seconds, the same
// cadence as the notification bell; a page that changes one of them (an open
// conversation gets marked read) refreshes them itself once it is done.
export const useDashboardCountsStore = defineStore('dashboardCounts', {
  state: () => ({
    bookingRequests: 0,
    unreadConversations: 0,
  }),

  actions: {
    async refresh() {
      const auth = useAuthStore()
      if (!auth.isAuthenticated) return
      const api = useApi()
      try {
        const counts = await api.get('/dashboard/counts')
        this.bookingRequests = counts.bookingRequests
        this.unreadConversations = counts.unreadConversations
      } catch {
        // best effort, like the bell: a failed poll keeps the last numbers
      }
    },
  },
})
