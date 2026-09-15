// Dizajn 4 — which 3 attribute values show on a listing card's "traka
// ključnih činjenica", and in what order, per category. Reads real
// attribute values (SearchService.serializeResult / UsersService.listFavorites
// already resolve LIST/CHECKBOX_GROUP option ids to names) — this module only
// picks and formats, it never invents a value.
//
// Keyed by the listing's actual (leaf) category slug — Prostori za proslave's
// two bookable leaves share their parent's attribute set (T64), so both list
// the same three keys.
const PRIORITY_BY_CATEGORY = {
  stanovi: ['kapacitet_ljudi', 'broj_soba', 'kvadratura'],
  'kuce-i-vikendice': ['kapacitet_ljudi', 'broj_soba', 'kvadratura'],
  sobe: ['kapacitet_ljudi', 'broj_soba', 'kvadratura'],
  'sale-za-proslave': ['kapacitet_ljudi', 'tip_prostora', 'ketering'],
  'konferencijske-sale': ['kapacitet_ljudi', 'tip_prostora', 'ketering'],
  igraonice: ['kapacitet_dece', 'uzrast_dece', 'kvadratura'],
  'putnicka-vozila': ['broj_sedista', 'menjac', 'godina_proizvodnje'],
  'dostavna-vozila': ['nosivost', 'zapremina_tovarnog_prostora', 'godina_proizvodnje'],
  'magacini-i-skladista': ['povrsina', 'visina_prostora', 'tip_prostora'],
  'gradjevinske-masine': ['tip_masine', 'snaga_motora', 'tezina_masine'],
}

// Serbian count-noun declension (1 / 2–4 / 5+) for the handful of NUMBER-type
// key facts that need a word appended to the raw count — mirrors the
// DURATION_UNIT_WORDS pattern in utils/pluralize.js.
const COUNT_NOUNS = {
  kapacitet_ljudi: { One: 'gost', Few: 'gosta', Many: 'gostiju' },
  kapacitet_dece: { One: 'dete', Few: 'deteta', Many: 'dece' },
  broj_soba: { One: 'soba', Few: 'sobe', Many: 'soba' },
  // Dizajn 11 — the listing page's key-facts strip labels every count with the
  // declined noun ("4 kreveta", "2 kupatila"), so those two need entries the
  // 3-fact card strip never asked for.
  broj_kreveta: { One: 'krevet', Few: 'kreveta', Many: 'kreveta' },
  broj_kupatila: { One: 'kupatilo', Few: 'kupatila', Many: 'kupatila' },
}

// Dizajn 11 — the listing page's strip is longer than the card's three facts
// and puts area last, so it gets its own order per category; anything without
// an entry here falls back to the card's priority list.
const DETAIL_PRIORITY_BY_CATEGORY = {
  stanovi: ['kapacitet_ljudi', 'broj_soba', 'broj_kreveta', 'sprat', 'kvadratura'],
  'kuce-i-vikendice': ['kapacitet_ljudi', 'broj_soba', 'broj_kreveta', 'broj_kupatila', 'kvadratura'],
  sobe: ['kapacitet_ljudi', 'broj_kreveta', 'kupatilo', 'kvadratura'],
  'sale-za-proslave': ['kapacitet_ljudi', 'tip_prostora', 'ketering'],
  'konferencijske-sale': ['kapacitet_ljudi', 'tip_prostora', 'ketering'],
  igraonice: ['kapacitet_dece', 'uzrast_dece'],
  'putnicka-vozila': ['broj_sedista', 'menjac', 'gorivo', 'godina_proizvodnje'],
  'dostavna-vozila': ['nosivost', 'zapremina_tovarnog_prostora', 'menjac', 'godina_proizvodnje'],
  'magacini-i-skladista': ['povrsina', 'visina_prostora', 'tip_prostora'],
  'gradjevinske-masine': ['tip_masine', 'snaga_motora', 'tezina_masine', 'godina_proizvodnje'],
}

function formatNumber(attr) {
  const n = attr.valueNumber
  const noun = COUNT_NOUNS[attr.key]
  if (attr.key === 'godina_proizvodnje') return String(n)
  const suffix = noun ? ` ${noun[srPluralCategory(n)]}` : attr.unit ? ` ${attr.unit}` : ''
  return `${n}${suffix}`
}

// Dizajn 25: the youngest and oldest age across the chosen brackets of uzrast_dece, or
// null when none is chosen. The listing page's Detalji row reads it too.
export function getAgeRange(labels) {
  const nums = labels.flatMap((label) => [...label.matchAll(/\d+/g)].map((m) => Number(m[0])))
  return nums.length ? { min: Math.min(...nums), max: Math.max(...nums) } : null
}

// uzrast_dece is a CHECKBOX_GROUP of brackets ("4–6 godine", "10+ godina", …)
// — the card shows one combined range, e.g. "4–10 god.", not a list.
function formatAgeRange(attr) {
  const range = getAgeRange(attr.optionNames)
  if (!range) return ''
  const { min, max } = range
  return min === max ? `${min}+ god.` : `${min}–${max} god.`
}

function formatKeyFact(attr) {
  if (attr.key === 'uzrast_dece') return formatAgeRange(attr)
  if (attr.key === 'broj_soba' && attr.valueNumber == null && attr.optionNames.length) {
    // Stanovi's broj_soba is a LIST ("Garsonjera", "1", "2.5", "5+", …) —
    // append the noun only when the option itself is a plain count.
    const label = attr.optionNames[0]
    const n = Number(label.replace('+', ''))
    return /^\d+(\.\d+)?\+?$/.test(label) ? `${label} ${COUNT_NOUNS.broj_soba[srPluralCategory(n)]}` : label
  }
  if (attr.valueNumber !== null && attr.valueNumber !== undefined) return formatNumber(attr)
  if (attr.optionNames?.length) return attr.optionNames.join(', ')
  if (attr.valueText) return attr.valueText
  if (attr.valueBoolean !== null && attr.valueBoolean !== undefined) return attr.valueBoolean ? 'Da' : 'Ne'
  return ''
}

/** Returns up to 3 { key, text } key facts for a listing card, in priority order. */
export function getCardKeyFacts(listing) {
  const order = PRIORITY_BY_CATEGORY[listing.category?.slug]
  if (!order) return []
  const byKey = new Map((listing.attributes || []).map((a) => [a.key, a]))
  const facts = []
  for (const key of order) {
    if (facts.length >= 3) break
    const attr = byKey.get(key)
    if (!attr) continue
    const text = formatKeyFact(attr)
    if (text) facts.push({ key, text })
  }
  return facts
}

// -- Dizajn 11: listing page ------------------------------------------------

// The listing detail payload (ListingsService.buildDisplayPayload) keeps every
// category attribute with its raw ListingAttribute row attached, while search
// results arrive pre-flattened; normalising here lets both feed the same
// formatters instead of duplicating them per payload shape.
function flattenDetailAttribute(attr) {
  const v = attr.value || {}
  return {
    key: attr.key,
    type: attr.type,
    unit: attr.unit,
    valueNumber: v.valueNumber !== null && v.valueNumber !== undefined ? Number(v.valueNumber) : null,
    valueText: v.valueText ?? null,
    valueBoolean: v.valueBoolean ?? null,
    optionNames: (v.valueOptionIds || []).map((id) => attr.options?.find((o) => o.id === id)?.name).filter(Boolean),
  }
}

// "6" over "gostiju", not "6 gostiju" on one line — the strip stacks the value
// above its label, so the two halves have to come out of the formatter apart.
function lowercaseFirst(value) {
  return value ? value.charAt(0).toLocaleLowerCase('sr-RS') + value.slice(1) : ''
}

/**
 * Dizajn 11 — the listing page's "traka ključnih činjenica": up to 6
 * { key, value, label } facts in the category's own display order. An
 * attribute the owner never filled in produces nothing at all (no empty
 * cell, no dash), per the ticket's display rule.
 */
export function getListingKeyFacts(listing) {
  const order = DETAIL_PRIORITY_BY_CATEGORY[listing.category?.slug] ?? PRIORITY_BY_CATEGORY[listing.category?.slug]
  if (!order) return []
  const byKey = new Map((listing.attributes || []).map((a) => [a.key, a]))
  const facts = []
  for (const key of order) {
    if (facts.length >= 6) break
    const attr = byKey.get(key)
    if (!attr) continue
    const flat = flattenDetailAttribute(attr)
    const noun = COUNT_NOUNS[key]
    if (noun && flat.valueNumber !== null) {
      facts.push({ key, value: String(flat.valueNumber), label: noun[srPluralCategory(flat.valueNumber)] })
      continue
    }
    // Stanovi's broj_soba is a LIST, not a NUMBER — a plain count option
    // ("3", "4.5") still declines its noun; "Garsonjera" doesn't.
    if (noun && flat.optionNames.length && /^\d+(\.\d+)?\+?$/.test(flat.optionNames[0])) {
      const option = flat.optionNames[0]
      facts.push({ key, value: option, label: noun[srPluralCategory(Number(option.replace('+', '')))] })
      continue
    }
    const text = formatKeyFact(flat)
    if (!text) continue
    facts.push({ key, value: text, label: lowercaseFirst(attr.name) })
  }
  return facts
}
