// Dizajn 8: icons for the category tiles above the search results ("Sve" and
// one per category).
// The SVGs are the exact exports from the Figma frame, kept byte-for-byte as
// Figma produced them. Figma bakes the tile's state colour into each export
// (#CED6DE while idle, #0957DF on the active tile), so the two state colours
// are rewritten to currentColor here at load time — Dizajn 2's rule for this
// icon family is that colour is inherited from the surrounding text, never
// hardcoded. Only those two hexes are touched; the clip-path mask's white
// stays white.
import { getCategoryIconMarkup } from './categoryIcons'

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

// Dizajn 46: the tile order used to be repeated here, because the categories
// endpoint returned mašine before magacini. displayOrder is the one order now
// (the admin drags it in Administracija > Kategorije since T129), so
// /categories already arrives sorted and this file is only about icons again.

// Dizajn 50: Ostalo, the seventh tile, comes from the solid set at its 30px.
export function getSearchCategoryIconMarkup(slug) {
  return REGISTRY[slug] || getCategoryIconMarkup(slug) || REGISTRY[ALL_CATEGORIES_SLUG] || ''
}
