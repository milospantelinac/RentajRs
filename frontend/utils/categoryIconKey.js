// T129: the icon an admin picks for a category in Administracija > Kategorije.
// Category icons are SVG files named after the category slug they were drawn
// for (categoryIcons, searchCategoryIcons, wizardCategoryIcons). Category.icon
// holds one of those names when the admin picked it, so a new category such
// as "Spa centri" can wear an existing icon; any other value (the seed's old
// "building", "car", ...) is ignored and the category's own slug decides.
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
