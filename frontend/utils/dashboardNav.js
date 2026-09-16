// Dizajn 30: which menu entry is the current page, one rule for the sidebar
// and the mobile bottom bar.
//
// T96: "Zahtevi za rezervaciju" (?role=owner) and "Moje rezervacije"
// (?role=guest) are the same path, and Vue Router's own active class ignores
// the query, so both used to light up together. An entry is current when the
// path matches and every query value it names matches too; the bookings list
// reads a missing role as guest, so the guest entry also covers the bare path.
// An entry stays current on the pages below it (an open conversation under
// Poruke), except the dashboard home, which every other page sits below.
const HOME_PATH = '/kontrolna-tabla'

const DEFAULT_QUERY = {
  '/kontrolna-tabla/rezervacije': { role: 'guest' },
}

export function isDashboardLinkActive(route, to) {
  const [path, queryString] = to.split('?')
  const pathMatches = route.path === path || (path !== HOME_PATH && route.path.startsWith(`${path}/`))
  if (!pathMatches) return false
  if (!queryString) return true
  const defaults = DEFAULT_QUERY[path] || {}
  return [...new URLSearchParams(queryString).entries()].every(([key, value]) => (route.query[key] ?? defaults[key]) === value)
}

/** The red counter next to an entry; two digits is all the pill has room for. */
export function formatNavCount(count) {
  return count > 99 ? '99+' : String(count)
}
