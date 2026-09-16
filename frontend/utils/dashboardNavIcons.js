// Dizajn 30: the 20px icons of the dashboard menu, exported from frame 357:406
// (378:444 and 380:905 draw the active ones: the same paths in #0957DF). The
// SVGs are the exact exports, kept byte for byte. Figma bakes the grey into
// each one, so it is rewritten to currentColor and the menu sets the colour.
const rawIcons = import.meta.glob('../assets/icons/dashboard-nav/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
})

const BAKED_COLOR = /#637384/gi

const REGISTRY = Object.fromEntries(
  Object.entries(rawIcons).map(([path, content]) => [path.match(/([^/]+)\.svg$/)[1], content.replace(BAKED_COLOR, 'currentColor')]),
)

/** Null for the entries Figma draws no icon for (admin panel, the bottom bar's "Više"). */
export function getDashboardNavIconMarkup(name) {
  return REGISTRY[name] || null
}
