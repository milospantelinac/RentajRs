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
