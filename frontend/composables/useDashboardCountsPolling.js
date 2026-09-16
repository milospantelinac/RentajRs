// Dizajn 30: keeps the dashboard menu counters fresh while a layout that
// shows the menu is on screen. They refresh after every page it shows
// (page:finish comes once that page has rendered) and every 30 seconds, like
// the notification bell. Called by the layouts rather than the two menus, so
// the hidden desktop or mobile menu doesn't poll a second time.
export function useDashboardCountsPolling() {
  const nuxtApp = useNuxtApp()
  const counts = useDashboardCountsStore()
  let pollHandle = null
  let removePageHook = null

  onMounted(() => {
    counts.refresh()
    pollHandle = setInterval(() => counts.refresh(), 30_000)
    removePageHook = nuxtApp.hook('page:finish', () => counts.refresh())
  })

  onBeforeUnmount(() => {
    clearInterval(pollHandle)
    removePageHook?.()
  })
}
