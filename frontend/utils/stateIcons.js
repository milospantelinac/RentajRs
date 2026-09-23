// Dizajn 44: the 48px icon every empty and error block opens with. A
// dashboard state reuses the menu icon of the page it stands on
// (utils/dashboardNavIcons.js, frame 357:406); the public pages need two more,
// both already exported from Figma for earlier tickets: the search bar's
// magnifier (133:2) and the empty rating star (568:514). Figma bakes a colour
// into every export, so each one is rewritten to currentColor and the block
// sets grey or, on an error, red.
import { getDashboardNavIconMarkup } from './dashboardNavIcons'

const rawIcons = import.meta.glob('../assets/icons/state/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
})

const BAKED_COLORS = /#637384|#D6DEE7/gi

const REGISTRY = Object.fromEntries(
  Object.entries(rawIcons).map(([path, content]) => [path.match(/([^/]+)\.svg$/)[1], content.replace(BAKED_COLORS, 'currentColor')]),
)

/** Null for a name neither registry has, which leaves the block without an icon rather than breaking it. */
export function getStateIconMarkup(name) {
  return REGISTRY[name] || getDashboardNavIconMarkup(name)
}
