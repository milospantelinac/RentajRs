// T129: a category URL that moved (a merge, a promotion, a new slug from the
// admin panel) has a stored redirect. The category pages check it before
// they load, so old links and search results keep landing on the category,
// with the rest of the path (a city page) kept.
export default defineNuxtRouteMiddleware(async (to) => {
  const slug = to.params.categorySlug
  if (!slug) return
  const target = await useApi()
    .get('/redirects/resolve', { query: { path: `/${slug}` } })
    .catch(() => null)
  if (!target?.newPath) return
  const rest = to.path.slice(`/${slug}`.length)
  return navigateTo(
    { path: `${target.newPath}${rest}`, query: to.query, hash: to.hash },
    { redirectCode: target.type === 302 ? 302 : 301, replace: true },
  )
})
