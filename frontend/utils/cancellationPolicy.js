// T87 — mirrors the backend's formatCancellationPolicy (bookings.service.ts),
// used for a LIVE listing's current policy (the booking form, the listing
// page). A booking's own frozen wording lives in its cancellationTermsSnapshot
// column instead — never regenerate that from the listing's current settings,
// since the whole point of the snapshot is to survive a later policy edit.
export function cancellationPolicyText(t, type, threshold) {
  if (type === 'NO_CANCELLATION') return t('listing.cancellationNone')
  if (type === 'FREE_UNTIL_DAYS' && threshold) return t('listing.cancellationFreeUntilDays', { threshold })
  if (type === 'FREE_UNTIL_HOURS' && threshold) return t('listing.cancellationFreeUntilHours', { threshold })
  return null
}
