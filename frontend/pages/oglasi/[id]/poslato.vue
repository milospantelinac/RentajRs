<template>
  <div class="container py-6 text-center">
    <h1 class="text-page-title mb-3">{{ t('billing.submittedTitle') }}</h1>
    <p class="text-body mb-4">{{ t('billing.submittedMessage') }}</p>

    <div v-if="receipt" class="card receipt-card mb-4">
      <div class="card-body-sm">
        <h2 class="text-section-title mb-3">{{ t('billing.receiptTitle') }}</h2>
        <dl class="receipt-list">
          <div class="receipt-row">
            <dt class="text-muted">{{ t('billing.receiptPackage') }}</dt>
            <dd class="text-body">
              {{ receipt.package }} — {{ receipt.billingCycle === 'YEARLY' ? t('billing.yearly') : t('billing.monthly') }}
            </dd>
          </div>
          <div class="receipt-row">
            <dt class="text-muted">{{ t('billing.receiptAmount') }}</dt>
            <dd class="text-body receipt-amount">{{ formattedAmount }} {{ receipt.currency }}</dd>
          </div>
          <div class="receipt-row">
            <dt class="text-muted">{{ t('billing.receiptDate') }}</dt>
            <dd class="text-body">{{ formattedDate }}</dd>
          </div>
          <div v-if="receipt.documentNumber" class="receipt-row">
            <dt class="text-muted">{{ t('billing.receiptDocument') }}</dt>
            <dd class="text-body">{{ receipt.documentNumber }}</dd>
          </div>
          <div v-if="receipt.bankReference" class="receipt-row">
            <dt class="text-muted">{{ t('billing.receiptReference') }}</dt>
            <dd class="text-body">{{ receipt.bankReference }}</dd>
          </div>
        </dl>
      </div>
    </div>

    <NuxtLink to="/kontrolna-tabla" class="btn btn-primary-flat">{{ t('nav.dashboard') }}</NuxtLink>
  </div>
</template>

<script setup>
definePageMeta({ middleware: 'auth' })
const { t } = useI18n()
const api = useApi()
const route = useRoute()

// Banca Intesa pilot checklist 2.7 — a real payment confirmation on the site,
// not just a generic "submitted" message. The subscriptionId is only present
// when we actually reached here from a successful NestPay checkout (see
// SubscriptionsService.handleNestPaySuccess) — a listing that got here some
// other way just shows the plain submitted message.
const { data: receipt } = await useAsyncData('checkout-receipt', async () => {
  const subscriptionId = route.query.subscriptionId
  if (!subscriptionId) return null
  try {
    return await api.get(`/subscriptions/${subscriptionId}/receipt`)
  } catch {
    return null
  }
})

const formattedAmount = computed(() => (receipt.value ? new Intl.NumberFormat('sr-RS').format(receipt.value.amount) : ''))
const formattedDate = computed(() =>
  receipt.value ? new Date(receipt.value.purchasedAt).toLocaleString('sr-RS', { dateStyle: 'medium', timeStyle: 'short' }) : '',
)

useSeoMeta({ title: t('billing.submittedTitle') })
</script>

<style lang="scss" scoped>
.receipt-card {
  max-width: 420px;
  margin-left: auto;
  margin-right: auto;
  text-align: left;
}

.receipt-list {
  margin: 0;
}

.receipt-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid $color-border;
}

.receipt-row:last-child {
  border-bottom: none;
}

.receipt-row dt {
  font-size: $font-size-muted;
}

.receipt-row dd {
  margin: 0;
  text-align: right;
}

.receipt-amount {
  font-weight: 600;
}
</style>
