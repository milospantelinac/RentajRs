// Dizajn 29: helpers for the "poslat na odobrenje" and "nije odobren" pages.

// "24 časa", "48 časova", "1 čas". The genitive form follows "u roku od", the
// other one "najviše".
export function formatHours(t, n, genitive = false) {
  const lastTwo = n % 100
  const last = n % 10
  let form = 'Many'
  if (last === 1 && lastTwo !== 11) form = 'One'
  else if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) form = 'Few'
  return t(`submission.hours${genitive ? 'Gen' : 'Acc'}${form}`, { n })
}

// The wizard step "Izmeni oglas" opens for a rejection reason; the review step
// lists whatever else is missing.
const REASON_STEP = {
  MISSING_PHOTOS: 'photos',
  CONTACT_INFO_IN_DESCRIPTION: 'basics',
  INAPPROPRIATE_CONTENT: 'basics',
  PRICE_OUT_OF_RANGE: 'pricing',
}

export function getReasonStep(reason) {
  return REASON_STEP[reason] || 'review'
}

export function formatPackage(t, subscription) {
  if (!subscription) return ''
  const values = {
    package: subscription.package,
    cycle: t(subscription.billingCycle === 'YEARLY' ? 'billing.yearly' : 'billing.monthly'),
  }
  if (!subscription.expiresAt) return t('submission.packageValue', values)
  const date = new Date(subscription.expiresAt).toLocaleDateString('sr-RS')
  return t('submission.packageValidUntil', { ...values, date })
}
