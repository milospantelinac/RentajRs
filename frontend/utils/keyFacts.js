// Dizajn 4: which 3 attribute values show on a listing card's "traka
// ključnih činjenica", and in what order. Reads real attribute values (the
// backend's serializeListingCard in common/utils/listing-card.ts already
// resolves LIST/CHECKBOX_GROUP option ids to names); this module only picks
// and formats, it never invents a value.
//
// T129: the keys and their order are the category's own, set in
// Administracija > Kategorije (category.cardFactKeys, and listingFactKeys for
// the listing page's strip, a subcategory without its own taking its
// parent's). They used to be fixed here per category slug; migration
// 20261010170000_attribute_admin moved those lists into the data unchanged.

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

/** Returns up to 3 { key, icon, text } key facts for a listing card, in the category's order. */
export function getCardKeyFacts(listing) {
  const order = listing.category?.cardFactKeys || []
  const byKey = new Map((listing.attributes || []).map((a) => [a.key, a]))
  const facts = []
  for (const key of order) {
    if (facts.length >= 3) break
    const attr = byKey.get(key)
    if (!attr) continue
    const text = formatKeyFact(attr)
    // T129: an icon the admin picked, else the one named after the key.
    if (text) facts.push({ key, icon: attr.icon || key, text })
  }
  return facts
}

// -- Dizajn 11: listing page ------------------------------------------------

// The listing detail payload (ListingsService.buildDisplayPayload) keeps every
// category attribute with its raw ListingAttribute row attached, while search
// results arrive pre-flattened; normalising here lets both feed the same
// formatters instead of duplicating them per payload shape.
export function flattenListingAttribute(attr) {
  const v = attr.value || {}
  return {
    key: attr.key,
    type: attr.type,
    unit: attr.unit,
    icon: attr.icon,
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
 * Dizajn 11: the listing page's "traka ključnih činjenica": up to 6
 * { key, icon, value, label } facts in the category's own order
 * (category.listingFactKeys, T129). An attribute the owner never filled in
 * produces nothing at all (no empty cell, no dash), per the ticket's display rule.
 */
export function getListingKeyFacts(listing) {
  const order = listing.category?.listingFactKeys || []
  const byKey = new Map((listing.attributes || []).map((a) => [a.key, a]))
  const facts = []
  for (const key of order) {
    if (facts.length >= 6) break
    const attr = byKey.get(key)
    // T129: a field the admin keeps off the listing page stays out of its strip too.
    if (!attr || attr.showOnListing === false) continue
    const flat = flattenListingAttribute(attr)
    const icon = attr.icon || key
    const noun = COUNT_NOUNS[key]
    if (noun && flat.valueNumber !== null) {
      facts.push({ key, icon, value: String(flat.valueNumber), label: noun[srPluralCategory(flat.valueNumber)] })
      continue
    }
    // Stanovi's broj_soba is a LIST, not a NUMBER: a plain count option
    // ("3", "4.5") still declines its noun; "Garsonjera" doesn't.
    if (noun && flat.optionNames.length && /^\d+(\.\d+)?\+?$/.test(flat.optionNames[0])) {
      const option = flat.optionNames[0]
      facts.push({ key, icon, value: option, label: noun[srPluralCategory(Number(option.replace('+', '')))] })
      continue
    }
    const text = formatKeyFact(flat)
    if (!text) continue
    facts.push({ key, icon, value: text, label: lowercaseFirst(attr.name) })
  }
  return facts
}
