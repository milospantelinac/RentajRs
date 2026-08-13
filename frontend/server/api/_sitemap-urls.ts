// @nuxtjs/sitemap (v6) auto-discovers server/api/_sitemap-urls.ts as a dynamic
// URL source. Static routes (pages/*.vue with no dynamic segment) are already
// picked up by the file-based scan; this only needs to cover what that scan
// can't know about — per-listing and per-category slugs living in the database.
export default defineEventHandler(async () => {
  const config = useRuntimeConfig()
  const { listings, categories } = await $fetch<{
    listings: Array<{ slug: string; updatedAt: string | null }>
    categories: Array<{ slug: string }>
  }>('/search/sitemap-urls', { baseURL: config.apiBaseInternal })

  return [
    ...categories.map((c) => ({ loc: `/${c.slug}` })),
    ...listings.map((l) => ({ loc: `/oglasi/${l.slug}`, lastmod: l.updatedAt || undefined })),
  ]
})
