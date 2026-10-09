import { isDefinedSlotsListing } from './bookingRules'

// Dizajn 3: the unit ListingCard prints after the price. GUEST keeps its existing
// "po gostu" phrasing (T111), a different price model. Dizajn 21's price hint in
// the wizard quotes the card through this too, so the two can't drift apart.
const CARD_PRICE_UNIT_SUFFIX = {
  NIGHT: '/ noć',
  DAY: '/ danu',
  HOUR: '/ satu',
  SLOT: '/ terminu',
  MONTH: '/ mesečno',
  YEAR: '/ godišnje',
}

export function getCardPriceUnitSuffix(priceUnit, t) {
  return priceUnit === 'GUEST' ? t('listing.pricePerGuestSuffix') : CARD_PRICE_UNIT_SUFFIX[priceUnit] || ''
}

// T121: a listing on defined slots carries the lowest price of its slots
// ahead and shows it as "Od 12.000 RSD"; 0 means none is ahead, and then no
// price shows at all (the card says "Trenutno nema termina"). Every other
// listing shows its own price. '' stands for "no price to show".
export function formatListingPrice(listing, t) {
  const amount = `${new Intl.NumberFormat('sr-RS').format(Math.round(Number(listing?.price) || 0))} RSD`
  if (!isDefinedSlotsListing(listing)) return amount
  return Number(listing?.price) > 0 ? t('listing.priceFromAmount', { price: amount }) : ''
}
