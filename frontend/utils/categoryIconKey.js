// T129: the icon an admin picks for a category in Administracija > Kategorije.
// Category icons are SVG files named after the category slug they were drawn
// for (categoryIcons, searchCategoryIcons, wizardCategoryIcons). Category.icon
// holds one of those names when the admin picked it, so a new category such
// as "Spa centri" can wear an existing icon; any other value (the seed's old
// "building", "car", ...) is ignored and the category's own slug decides.
// For a category the library has nothing for, the admin uploads one of its
// own (Category.imageUrl); the category wears it while Category.icon is
// UPLOADED_ICON, which an upload sets. A picture uploaded while it was still a
// "category picture" was kept as a photo, so it replaces no drawn icon unless
// the admin picks it.
import { mediaVariant } from './media'

/** Category.icon of a category wearing the icon uploaded for it (the backend's UPLOADED_ICON). */
export const UPLOADED_ICON = 'upload'

const iconFiles = import.meta.glob(
  ['../assets/icons/categories/*.svg', '../assets/icons/search-categories/*.svg', '../assets/icons/wizard-categories/*.svg'],
  { query: '?raw', import: 'default' },
)

/** Every icon name an admin can pick, without the search page's "Sve" tile. */
export const CATEGORY_ICON_KEYS = [
  ...new Set(Object.keys(iconFiles).map((path) => path.match(/([^/]+)\.svg$/)[1])),
]
  .filter((key) => key !== 'sve')
  .sort()

/** The name the icon helpers look a category up by. */
export function categoryIconKey(category) {
  if (!category) return ''
  return CATEGORY_ICON_KEYS.includes(category.icon) ? category.icon : category.slug
}

/**
 * The address of the icon uploaded for a category it wears, at its smallest
 * width (the icons are drawn at 18 to 32 px), or '' when it wears another.
 */
export function categoryIconUpload(category) {
  if (category?.icon !== UPLOADED_ICON || !category.imageUrl) return ''
  return mediaVariant(category.imageUrl, 400)
}
