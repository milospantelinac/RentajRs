// The wizard's fixed order (Dodavanje Oglasa spec, KONAČNI FLOW): the basics
// first, then price and booking method together, then availability, rules and
// payment, the only steps "Bez rezervacije" skips. uredi.vue walks this list and
// Moji oglasi counts it for a draft's "korak 1 od 9" (Dizajn 32).
export const WIZARD_STEPS = [
  { key: 'basics', labelKey: 'listing.stepBasics', descKey: 'listing.stepBasicsDesc' },
  { key: 'pricing', labelKey: 'listing.stepPricing', descKey: 'listing.stepPricingDesc' },
  { key: 'availability', labelKey: 'listing.stepAvailability', descKey: 'listing.stepAvailabilityDesc', skipIfNoBooking: true },
  { key: 'rules', labelKey: 'listing.stepRules', descKey: 'listing.stepRulesDesc', skipIfNoBooking: true },
  { key: 'payment', labelKey: 'listing.stepPayment', descKey: 'listing.stepPaymentDesc', skipIfNoBooking: true },
  { key: 'attributes', labelKey: 'listing.stepAttributes', descKey: 'listing.stepAttributesDesc' },
  { key: 'location', labelKey: 'listing.stepLocation', descKey: 'listing.stepLocationDesc' },
  { key: 'photos', labelKey: 'listing.stepPhotos', descKey: 'listing.stepPhotosDesc' },
  { key: 'review', labelKey: 'listing.stepReview', descKey: 'listing.stepReviewDesc' },
]

export function getWizardSteps(bookingModel) {
  return WIZARD_STEPS.filter((step) => !step.skipIfNoBooking || bookingModel !== 'NO_BOOKING')
}
