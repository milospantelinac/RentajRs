// Dizajn 34: /rezervacije/:id sits under "Zahtevi za rezervaciju" for the
// booking's owner (359:456) and under "Moje rezervacije" for its guest. Only
// the booking can tell which, and the dashboard menu renders before the page's
// own data arrives, so the booking is fetched here, the menu entry is set, and
// the page takes the booking over instead of fetching it again.
export default defineNuxtRouteMiddleware(async (to) => {
  const nuxtApp = useNuxtApp()
  // The server already did this for the page being hydrated.
  if (import.meta.client && nuxtApp.isHydrating && nuxtApp.payload.serverRendered) return

  const auth = useAuthStore()
  if (!auth.isAuthenticated) return

  const api = useApi()
  const prefetched = useState(`booking-prefetch-${to.params.id}`, () => null)
  prefetched.value = null
  try {
    const booking = await api.get(`/bookings/${to.params.id}`)
    prefetched.value = booking
    const role = booking.ownerId === auth.user?.id ? 'owner' : 'guest'
    setDashboardActiveLink(to.path, `/kontrolna-tabla/rezervacije?role=${role}`)
  } catch {
    // The page asks again and says what went wrong.
  }
})
