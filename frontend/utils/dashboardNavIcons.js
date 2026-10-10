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

// Dizajn 45: the Font Awesome glyph an entry with no Figma icon falls back
// to, shared by the menus (DashboardNavIcon) and the empty and error blocks
// (StateBlock), so a name means the same picture everywhere. The admin
// panel's entries are the whole list of such names, plus the bottom bar's
// "Više" and the panel's own shield.
const NAV_ICON_FALLBACKS = {
  admin: 'shield-halved',
  more: 'ellipsis',
  queue: 'clipboard-check',
  disputes: 'triangle-exclamation',
  categories: 'sitemap',
  models: 'sliders',
  users: 'users',
  payments: 'credit-card',
  content: 'file-lines',
  emails: 'envelope',
  settings: 'gear',
}

/** Null for a name that neither registry knows, which leaves the caller without an icon rather than breaking it. */
export function getNavIconFallback(name) {
  return NAV_ICON_FALLBACKS[name] || null
}
