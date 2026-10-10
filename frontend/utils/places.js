// T119: how a place (an okrug's settlement, or a part of a city) is written
// wherever one is picked or shown. Places come from GET /locations/search
// ({ type: 'city' | 'area', ... }) or GET /locations/cities/:key (a city row,
// no type).

/** "Surduk", "Novo Selo (Lebane)" when several places share the name, "Vračar, Beograd" for a part of a city. */
export function placeLabel(place) {
  if (!place) return ''
  if (place.type === 'area') return [place.name, place.city?.name].filter(Boolean).join(', ')
  return place.sharedName && place.municipality && place.municipality !== place.name
    ? `${place.name} (${place.municipality})`
    : place.name || ''
}

/** A city row from GET /locations/cities/:key, as the place fields hold it. */
export function cityAsPlace(city) {
  if (!city) return null
  return {
    type: 'city',
    id: city.id,
    name: city.name,
    slug: city.slug,
    municipality: city.municipality,
    nameLocative: city.nameLocative,
    region: city.region ? { id: city.region.id, name: city.region.name } : null,
  }
}

/** The city a picked place is in: itself, or the city of a part. */
export function placeCity(place) {
  if (!place) return null
  return place.type === 'area' ? place.city : place
}

/**
 * The place inside a sentence: "u Beogradu" with the stored locative, and
 * "u mestu Surduk" for a place that has none, which reads right whatever
 * the name's ending.
 */
export function placeInSentence(t, place) {
  if (!place?.name) return ''
  return place.nameLocative ? t('location.inLocative', { city: place.nameLocative }) : t('location.inPlace', { city: place.name })
}
