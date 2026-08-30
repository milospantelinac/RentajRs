<template>
  <ul v-if="rules.length" class="booking-rules-summary">
    <li v-for="rule in rules" :key="rule">{{ rule }}</li>
  </ul>
</template>

<script setup>
// T87 — the listing's booking rules and cancellation policy used to live only
// in the database; a guest had no way to see min/max duration, how far ahead
// booking is allowed, or the cancellation window before sending a request.
// Shared between the listing page and the booking form so the two can't drift.
const props = defineProps({ listing: { type: Object, required: true } })
const { t } = useI18n()

const rules = computed(() => {
  const l = props.listing
  const lines = []

  if (l.minDuration && l.maxDuration) {
    lines.push(
      t('booking.durationRangeRule', { min: l.minDuration, max: l.maxDuration, unit: srDurationUnitWord(l.priceUnit, l.maxDuration) }),
    )
  } else if (l.minDuration) {
    lines.push(t('booking.minDurationRule', { min: l.minDuration, unit: srDurationUnitWord(l.priceUnit, l.minDuration) }))
  } else if (l.maxDuration) {
    lines.push(t('booking.maxDurationRule', { max: l.maxDuration, unit: srDurationUnitWord(l.priceUnit, l.maxDuration) }))
  }

  if (l.maxAdvanceBookingDays) lines.push(t('booking.horizonRule', { days: l.maxAdvanceBookingDays }))
  if (l.earliestBookingHours) lines.push(t('booking.earliestRule', { hours: l.earliestBookingHours }))

  const cancellation = cancellationPolicyText(t, l.cancellationPolicyType, l.cancellationThreshold)
  if (cancellation) lines.push(cancellation)

  return lines
})
</script>

<style lang="scss" scoped>
.booking-rules-summary {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: $font-size-label;
  color: $color-text-muted;
}
</style>
