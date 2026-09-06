/**
 * Serbian plural category for a count — the standard Slavic ...1 / ...2-4 /
 * everything-else split, with the ...11/...12-14 exceptions (11 uklonjenih,
 * not 11 uklonjenog). Returns a capitalized suffix ('One'/'Few'/'Many') meant
 * to be appended directly to a locale key, e.g. `attention.new_requests${srPluralCategory(n)}`.
 * Only 'sr' is an active locale right now (see nuxt.config.ts R138) — if
 * English pluralization is ever wired up for real, it needs its own (much
 * simpler, singular-vs-plural) category function rather than reusing this one.
 */
export function srPluralCategory(count) {
  const n = Math.abs(count)
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'One'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'Few'
  return 'Many'
}

// T86 — MIN_DURATION/MAX_DURATION messages need the listing's price-unit noun
// declined for the count ("10 noćenja", not just "10"); mirrors the backend's
// own DURATION_UNIT_WORDS_SR in bookings.service.ts so client-side
// pre-validation reads the same as the server's.
const DURATION_UNIT_WORDS = {
  NIGHT: { One: 'noćenje', Few: 'noćenja', Many: 'noćenja' },
  DAY: { One: 'dan', Few: 'dana', Many: 'dana' },
  HOUR: { One: 'sat', Few: 'sata', Many: 'sati' },
  MONTH: { One: 'mesec', Few: 'meseca', Many: 'meseci' },
  YEAR: { One: 'godina', Few: 'godine', Many: 'godina' },
  SLOT: { One: 'termin', Few: 'termina', Many: 'termina' },
  GUEST: { One: 'gost', Few: 'gosta', Many: 'gostiju' },
}

export function srDurationUnitWord(priceUnit, count) {
  const words = DURATION_UNIT_WORDS[priceUnit] || DURATION_UNIT_WORDS.NIGHT
  return words[srPluralCategory(count)]
}
