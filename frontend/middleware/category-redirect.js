// T129: a category URL that moved (a merge, a promotion, a new slug from the
// admin panel) has a stored redirect. The category pages check it before
// they load, so old links and search results keep landing on the category,
// with the rest of the path (a city page) kept. T119: a place whose slug an
// admin changed leaves one too (/grad/<slug>), so a city page follows both.
export default defineNuxtRouteMiddleware(async (to) => {
  const slug = to.params.categorySlug
  if (!slug) return
  const api = useApi()
  const citySlug = to.params.citySlug
  const [target, cityTarget] = await Promise.all([
    api.get('/redirects/resolve', { query: { path: `/${slug}` } }).catch(() => null),
    citySlug ? api.get('/redirects/resolve', { query: { path: `/grad/${citySlug}` } }).catch(() => null) : null,
  ])
  const movedCity = cityTarget?.newPath?.startsWith('/grad/') ? cityTarget.newPath.slice('/grad/'.length) : ''
  if (!target?.newPath && !movedCity) return
  const rest = movedCity ? `/${movedCity}` : to.path.slice(`/${slug}`.length)
  return navigateTo(
    { path: `${target?.newPath || `/${slug}`}${rest}`, query: to.query, hash: to.hash },
    { redirectCode: target?.newPath && target.type === 302 ? 302 : 301, replace: true },
  )
})
