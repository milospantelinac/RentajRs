<template>
  <SubmissionOutcome
    tone="success"
    :title="t('submission.submittedTitle')"
    :text="t('submission.submittedText', { hours: formatHours(t, slaHours, true) })"
    :listing="outcome"
    :rows="rows"
    :note="t('submission.editWhilePending')"
    :steps="steps"
    :primary="{ label: t('nav.dashboard'), to: '/kontrolna-tabla' }"
    :secondary="{ label: t('submission.viewListing'), to: `/oglasi/${listingId}/pregled` }"
  />
</template>

<script setup>
import { formatDateTime } from '~/utils/formatDateTime'
import { formatHours, formatPackage } from '~/utils/submissionOutcome'

definePageMeta({ middleware: 'auth' })
const { t } = useI18n()
const api = useApi()
const route = useRoute()
const listingId = route.params.id

const { data: outcome } = await useAsyncData(`submission-${listingId}`, () =>
  api.get(`/listings/${listingId}/submission`).catch(() => null),
)
if (outcome.value?.status === 'REJECTED') {
  await navigateTo(`/oglasi/${listingId}/odbijeno`, { replace: true })
}

// Banca Intesa pilot checklist 2.7: a real payment confirmation on the site. The
// subscriptionId is only there when we came back from a successful NestPay
// checkout (SubscriptionsService.handleNestPaySuccess); a free slot or a
// resubmission has no payment to show, only the package.
const { data: receipt } = await useAsyncData(`checkout-receipt-${listingId}`, async () => {
  const subscriptionId = route.query.subscriptionId
  if (!subscriptionId) return null
  try {
    return await api.get(`/subscriptions/${subscriptionId}/receipt`)
  } catch {
    return null
  }
})

const slaHours = computed(() => outcome.value?.slaHours ?? 24)

const rows = computed(() => {
  const r = receipt.value
  if (!r) {
    const packageValue = formatPackage(t, outcome.value?.subscription)
    return packageValue ? [{ label: t('billing.receiptPackage'), value: packageValue }] : []
  }
  const rows = [
    { label: t('billing.receiptPackage'), value: formatPackage(t, { package: r.package, billingCycle: r.billingCycle }) },
    { label: t('billing.receiptAmount'), value: `${new Intl.NumberFormat('sr-RS').format(r.amount)} ${r.currency}` },
    { label: t('billing.receiptDate'), value: formatDateTime(r.purchasedAt) },
  ]
  if (r.documentNumber) rows.push({ label: t('billing.receiptDocument'), value: r.documentNumber })
  if (r.bankReference) rows.push({ label: t('billing.receiptReference'), value: r.bankReference })
  return rows
})

const steps = computed(() => [
  { title: t('submission.submittedStep1Title'), text: t('submission.submittedStep1Text', { hours: formatHours(t, slaHours.value) }) },
  { title: t('submission.submittedStep2Title'), text: t('submission.submittedStep2Text') },
  { title: t('submission.submittedStep3Title'), text: t('submission.submittedStep3Text') },
])

useSeoMeta({ title: t('submission.submittedTitle') })
</script>
