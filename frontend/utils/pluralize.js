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
