// Dizajn 8 — icons for the seven category tiles above the search results.
// The SVGs are the exact exports from the Figma frame, kept byte-for-byte as
// Figma produced them. Figma bakes the tile's state colour into each export
// (#CED6DE while idle, #0957DF on the active tile), so the two state colours
// are rewritten to currentColor here at load time — Dizajn 2's rule for this
// icon family is that colour is inherited from the surrounding text, never
// hardcoded. Only those two hexes are touched; the clip-path mask's white
// stays white.
const rawIcons = import.meta.glob('../assets/icons/search-categories/*.svg', { as: 'raw', eager: true })

const STATE_COLORS = /#CED6DE|#0957DF/gi

const REGISTRY = Object.fromEntries(
  Object.entries(rawIcons).map(([path, content]) => [
    path.match(/([^/]+)\.svg$/)[1],
    content.replace(STATE_COLORS, 'currentColor'),
  ]),
)

/** Slug of the "all categories" tile, which has no category row behind it. */
export const ALL_CATEGORIES_SLUG = 'sve'

/**
 * The order the tiles appear in, per the Dizajn 8 ticket. The categories
 * endpoint returns its own ordering, which differs (mašine before magacini),
 * so the row is sorted against this list and anything unlisted falls to the
 * end rather than disappearing.
 */
export const SEARCH_CATEGORY_ORDER = [
  'nekretnine',
  'prostori-za-proslave',
  'igraonice',
  'vozila',
  'magacini-i-skladista',
  'gradjevinske-masine',
]

export function getSearchCategoryIconMarkup(slug) {
  return REGISTRY[slug] || REGISTRY[ALL_CATEGORIES_SLUG] || ''
}

export function sortSearchCategories(categories) {
  const rank = (slug) => {
    const index = SEARCH_CATEGORY_ORDER.indexOf(slug)
    return index === -1 ? SEARCH_CATEGORY_ORDER.length : index
  }
  return [...categories].sort((a, b) => rank(a.slug) - rank(b.slug))
}
