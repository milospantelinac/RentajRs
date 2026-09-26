<template>
  <SubmissionOutcome
    v-if="outcome"
    tone="danger"
    :title="t('submission.rejectedTitle')"
    :text="t(outcome.canResubmit ? 'submission.rejectedText' : 'submission.rejectedTextNewPackage')"
    :listing="outcome"
    :rows="rows"
    :note="rejection?.note || ''"
    :steps="steps"
    :primary="{ label: t('submission.editListing'), to: editTo }"
    :secondary="{ label: t('nav.dashboard'), to: '/kontrolna-tabla' }"
  />
</template>

<script setup>
import { formatHours, formatPackage, getReasonStep } from '~/utils/submissionOutcome'

definePageMeta({ middleware: 'auth' })
const { t } = useI18n()
const api = useApi()
const route = useRoute()
const listingId = route.params.id

const { data: outcome } = await useAsyncData(`submission-${listingId}`, () =>
  api.get(`/listings/${listingId}/submission`).catch(() => null),
)
if (!outcome.value) {
  throw createError({ statusCode: 404, statusMessage: 'Listing not found', fatal: true })
}
// The email and the bell keep linking here after the owner has moved on.
if (outcome.value.status === 'PENDING_APPROVAL') {
  await navigateTo(`/oglasi/${listingId}/poslato`, { replace: true })
} else if (outcome.value.status !== 'REJECTED') {
  await navigateTo('/kontrolna-tabla/oglasi', { replace: true })
}

const rejection = computed(() => outcome.value?.rejection)

const rows = computed(() => {
  const rows = []
  if (rejection.value?.reason) {
    rows.push({ label: t('submission.rowReason'), value: t(`admin.rejectReasons.${rejection.value.reason}`) })
  }
  if (rejection.value?.decidedAt) {
    const decidedAt = new Date(rejection.value.decidedAt)
    rows.push({
      label: t('submission.rowRejectedBy'),
      value: t('submission.rejectedBy', {
        date: decidedAt.toLocaleDateString('sr-RS'),
        time: decidedAt.toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' }),
      }),
    })
  }
  const packageValue = formatPackage(t, outcome.value?.subscription)
  if (packageValue) rows.push({ label: t('billing.receiptPackage'), value: packageValue })
  return rows
})

const editTo = computed(() => `/oglasi/${listingId}/uredi?korak=${getReasonStep(rejection.value?.reason)}`)

const steps = computed(() => {
  const newPackage = !outcome.value?.canResubmit
  return [
    { title: t('submission.rejectedStep1Title'), text: t('submission.rejectedStep1Text') },
    {
      title: t(newPackage ? 'submission.rejectedStep2TitleNewPackage' : 'submission.rejectedStep2Title'),
      text: t(newPackage ? 'submission.rejectedStep2TextNewPackage' : 'submission.rejectedStep2Text'),
    },
    {
      title: t('submission.rejectedStep3Title', { hours: formatHours(t, outcome.value?.slaHours ?? 24, true) }),
      text: t('submission.rejectedStep3Text'),
    },
  ]
})

useSeoMeta({ title: t('submission.rejectedTitle') })
</script>
