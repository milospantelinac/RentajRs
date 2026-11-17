/**
 * T114: a rating reads the same everywhere. It shows from the first review on
 * (the three-review rule R102 is gone), with one decimal like the listing
 * card's "4.7" (the database keeps one), and a listing without a review yet
 * reads "Novo" instead.
 */
export function hasRating(listing) {
  return Number(listing?.reviewCount) > 0 && listing?.avgRating != null
}

export function formatRating(value) {
  return Number(value).toFixed(1)
}

/**
 * The one mark beside a listing's title (cards, map card, listing page, booking
 * panel): a featured listing says "Istaknuto" and nothing else, otherwise the
 * rating from the first review on and "Novo" before it.
 */
export function listingMark(listing, t) {
  if (listing?.featured) return t('listing.featuredBadge')
  return hasRating(listing) ? formatRating(listing.avgRating) : t('listing.ratingNew')
}
