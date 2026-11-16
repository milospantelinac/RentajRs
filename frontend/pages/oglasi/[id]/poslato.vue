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
const { data: receipt, refresh: refreshReceipt } = await useAsyncData(`checkout-receipt-${listingId}`, async () => {
  const subscriptionId = route.query.subscriptionId
  if (!subscriptionId) return null
  try {
    return await api.get(`/subscriptions/${subscriptionId}/receipt`)
  } catch {
    return null
  }
})

// The receipt is issued right after the payment, so a page opened in the first seconds may still say
// "being issued": ask again a few times, 2 seconds apart, and stop at once when it is there.
onMounted(async () => {
  for (let attempt = 0; attempt < 5 && receipt.value?.receipt?.status === 'PENDING'; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 2000))
    await refreshReceipt()
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
  const fiscal = r.receipt
  if (fiscal?.status === 'ISSUED') {
    // The number opens the receipt's check at the Tax Administration; the PDF is the receipt itself.
    rows.push({ label: t('billing.receiptDocument'), value: fiscal.documentNumber, href: fiscal.verificationUrl || undefined })
    if (fiscal.pdfUrl) rows.push({ label: t('billing.receiptFiscal'), value: t('billing.receiptPdf'), href: fiscal.pdfUrl })
  } else if (fiscal) {
    // Waiting for the fiscal service (usually a second or two); the email follows either way.
    rows.push({ label: t('billing.receiptFiscal'), value: t('billing.receiptPending') })
  } else if (r.documentNumber) {
    rows.push({ label: t('billing.receiptDocument'), value: r.documentNumber })
  }
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
