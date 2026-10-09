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
