// Dizajn 17 — icons on the "Šta izdajete?" category cards (/oglasi/novi, Figma
// frame 172:287). The SVGs are the exact exports from that frame, kept
// byte-for-byte. They're the same glyphs as the Dizajn 8 search tiles, but the
// frame exports them at its own sizes — 30px for Nekretnine and Igraonice, 26px
// for the rest — so each file's width/height is what gives a card the frame's
// geometry. Figma bakes the card state into the export (#CED6DE idle;
// Nekretnine came from the hovered card, #0957DF), so both are rewritten to
// currentColor and the card sets the colour.
import { ALL_CATEGORIES_SLUG, getSearchCategoryIconMarkup } from './searchCategoryIcons'

const rawIcons = import.meta.glob('../assets/icons/wizard-categories/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
})

const STATE_COLORS = /#CED6DE|#0957DF/gi

const REGISTRY = Object.fromEntries(
  Object.entries(rawIcons).map(([path, content]) => [
    path.match(/([^/]+)\.svg$/)[1],
    content.replace(STATE_COLORS, 'currentColor'),
  ]),
)

/** A category added later from the admin panel has no frame icon, so it gets the search tiles' generic one. */
export function getWizardCategoryIconMarkup(slug) {
  return REGISTRY[slug] || getSearchCategoryIconMarkup(ALL_CATEGORIES_SLUG)
}
