// Dizajn 2 — one icon registry for every attribute/amenity icon on the
// platform, keyed by the Figma library's slug (assets/icons/attributes/).
// Backend attribute and option keys don't always match that slug directly
// (snake_case vs kebab-case, or a different word for the same concept), so
// ALIASES maps every such key to the slug that actually has an SVG. Keys not
// listed here are tried as-is, then with underscores turned to hyphens,
// before falling back to "podrazumevana" — see resolveAttributeIconSlug().
//
// Same slug intentionally reused across unrelated attributes below (e.g.
// every "tip_*" machine sub-type selector reuses tip-masine) — the Ikonice
// biblioteka only has one icon per visual concept, not per attribute.
const ALIASES = {
  // Nekretnine / Sobe scalar fields
  kvadratura: 'povrsina',
  broj_soba: 'spavace-sobe',
  broj_kreveta: 'kreveti',
  broj_kupatila: 'kupatila',

  // Vozila scalar fields
  godina_proizvodnje: 'godiste',
  broj_sedista: 'sedista',
  vrsta_pogona: 'gorivo',

  // Dostavna vozila cargo dimensions — all share the one "tovarni prostor" icon
  zapremina_tovarnog_prostora: 'tovarni-prostor',
  duzina_tovarnog_prostora: 'tovarni-prostor',
  sirina_tovarnog_prostora: 'tovarni-prostor',
  visina_tovarnog_prostora: 'tovarni-prostor',

  // Građevinske mašine
  tezina_masine: 'tezina',
  dostava_na_lokaciju: 'dostava',
  tip_bagera: 'tip-masine',
  tip_dizalice: 'tip-masine',
  tip_mini_masine: 'tip-masine',
  tip_platforme: 'tip-masine',
  tip_transportera: 'tip-masine',
  tip_viljuskara: 'tip-masine',
  nosivost_dizalica: 'nosivost',
  nosivost_platforma: 'nosivost',
  nosivost_transporter: 'nosivost',
  nosivost_viljuskar: 'nosivost',
  max_radna_visina_bager: 'visina-prostora',
  max_radna_visina_platforma: 'visina-prostora',
  max_visina_dizanja_dizalica: 'visina-prostora',
  max_visina_dizanja_viljuskar: 'visina-prostora',

  // Opremljenost options with no dedicated tile — same underlying concept
  // as an existing icon (indoor/outdoor pool, sauna variants, cabin
  // heating/AC reuse the generic heating/AC icons).
  'bazen-spoljasnji': 'bazen',
  'bazen-unutrasnji': 'bazen',
  'bio-sauna': 'sauna',
  'finska-sauna': 'sauna',
  'grejanje-kabine': 'grejanje',
  'klima-u-kabini': 'klima',
}

const DEFAULT_SLUG = 'podrazumevana'

// Vite-only glob import: eagerly inlines every icon's raw markup as a string
// at build time, keyed by its file path, so a component can render any of
// them via v-html without a per-icon import statement.
const rawIcons = import.meta.glob('../assets/icons/attributes/*.svg', { as: 'raw', eager: true })
const REGISTRY = Object.fromEntries(
  Object.entries(rawIcons).map(([path, content]) => [path.match(/([^/]+)\.svg$/)[1], content]),
)

export function resolveAttributeIconSlug(key) {
  if (!key) return DEFAULT_SLUG
  if (REGISTRY[key]) return key
  const hyphenated = key.replace(/_/g, '-')
  if (REGISTRY[hyphenated]) return hyphenated
  if (ALIASES[key]) return ALIASES[key]
  if (ALIASES[hyphenated]) return ALIASES[hyphenated]
  return DEFAULT_SLUG
}

export function getAttributeIconMarkup(key) {
  const slug = resolveAttributeIconSlug(key)
  return REGISTRY[slug] || REGISTRY[DEFAULT_SLUG] || ''
}
