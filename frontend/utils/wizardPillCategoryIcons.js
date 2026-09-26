// Dizajn 19: the 18px icon in the wizard's category pill. Igraonice comes from
// frame 185:287, every other category from its own korak 6 frame (545:514 to
// 552:1557). The SVGs are the exact exports, kept byte-for-byte. Figma bakes a
// colour into each one (#061B31 in the Igraonice frame, #0957DF in the rest),
// so both are rewritten to currentColor and the pill sets the colour.
import { ALL_CATEGORIES_SLUG, getSearchCategoryIconMarkup } from './searchCategoryIcons'

const rawIcons = import.meta.glob('../assets/icons/wizard-pill-categories/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
})

const BAKED_COLORS = /#061B31|#0957DF/gi

const REGISTRY = Object.fromEntries(
  Object.entries(rawIcons).map(([path, content]) => [
    path.match(/([^/]+)\.svg$/)[1],
    content.replace(BAKED_COLORS, 'currentColor'),
  ]),
)

// Listings sit on leaf categories. Figma draws one "Prostori za proslave" pill,
// and both of that category's bookable leaves use its icon.
const LEAF_TO_ICON = {
  'sale-za-proslave': 'prostori-za-proslave',
  'konferencijske-sale': 'prostori-za-proslave',
}

/** A category added later from the admin panel has no frame icon, so it gets the search tiles' generic one. */
export function getWizardPillCategoryIconMarkup(slug) {
  return REGISTRY[LEAF_TO_ICON[slug] || slug] || getSearchCategoryIconMarkup(ALL_CATEGORIES_SLUG)
}
