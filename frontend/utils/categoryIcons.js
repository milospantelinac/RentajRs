// Dizajn 50 (Figma frame "Ikonice", node 1651:3254): a
// solid icon for every subcategory and for Ostalo, the same family as the six
// category icons. The SVGs are the 30px components exported byte for byte and
// keyed by the category slug in the database. Unlike the older sets, which the
// frames exported at each place's own size, these are scaled by CSS: 30 in the
// category strips, 26 on the picker cards, 18 in the wizard's category pill.
// Sobe and both vehicles are 31 wide and spill half a pixel past each side of
// their 30 box, as the components do, so a box sets the height and lets the
// width follow. The idle #CED6DE Figma bakes in becomes currentColor, so the
// colour comes from the surrounding text.
const rawIcons = import.meta.glob('../assets/icons/categories/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
})

const REGISTRY = Object.fromEntries(
  Object.entries(rawIcons).map(([path, content]) => [
    path.match(/([^/]+)\.svg$/)[1],
    content.replace(/#CED6DE/gi, 'currentColor'),
  ]),
)

/** The solid icon for a subcategory or Ostalo, or '' when the category has none of its own. */
export function getCategoryIconMarkup(slug) {
  return REGISTRY[slug] || ''
}
