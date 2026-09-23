// Dizajn 34: a page outside /kontrolna-tabla can name the menu entry it
// belongs to. One booking's page (/rezervacije/:id) is "Zahtevi za
// rezervaciju" for its owner (359:456) and "Moje rezervacije" for its guest,
// which only the loaded booking can tell (middleware/booking-menu.js). The
// entry is kept with the path it was set for, so it never carries over to the
// next page; everywhere else the rule in utils/dashboardNav.js decides.
const STATE_KEY = 'dashboard-active-link'

/** For a route middleware, which knows the path it is taking the visitor to. */
export function setDashboardActiveLink(path, to) {
  useState(STATE_KEY, () => null).value = { path, to }
}

export function useDashboardActiveLink() {
  const current = useState(STATE_KEY, () => null)
  const route = useRoute()

  function setActiveLink(to) {
    current.value = { path: route.path, to }
  }

  function isLinkActive(to) {
    if (current.value?.path === route.path) return current.value.to === to
    return isDashboardLinkActive(route, to)
  }

  return { setActiveLink, isLinkActive }
}
