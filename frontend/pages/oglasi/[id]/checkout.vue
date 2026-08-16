<template>
  <div v-if="listing && pkg" class="container checkout-page py-4">
    <h1 class="text-page-title mb-4">{{ t('billing.checkoutTitle') }}</h1>

    <div class="row">
      <div class="col-12 col-lg-7 mb-4 mb-lg-0">
        <div class="card">
          <div class="card-body">
            <h2 class="text-section-title mb-3">{{ t('billing.billingDetails') }}</h2>

            <div class="row">
              <div class="col-6">
                <div class="form-group mb-3">
                  <label class="form-label">{{ t('auth.firstName') }}</label>
                  <input v-model="form.firstName" type="text" class="form-control" required />
                </div>
              </div>
              <div class="col-6">
                <div class="form-group mb-3">
                  <label class="form-label">{{ t('auth.lastName') }}</label>
                  <input v-model="form.lastName" type="text" class="form-control" required />
                </div>
              </div>
            </div>
            <div class="form-group mb-3">
              <label class="form-label">{{ t('auth.email') }}</label>
              <input v-model="form.email" type="email" class="form-control" required />
            </div>

            <label class="form-row-inline mb-3 checkout-company-toggle">
              <input v-model="form.isCompany" type="checkbox" class="form-checkbox" />
              {{ t('billing.wantCompanyInvoice') }}
            </label>

            <template v-if="form.isCompany">
              <div class="row">
                <div class="col-6">
                  <div class="form-group mb-3">
                    <label class="form-label">{{ t('dashboard.taxId') }}</label>
                    <input v-model="form.taxId" type="text" class="form-control" required />
                  </div>
                </div>
                <div class="col-6">
                  <div class="form-group mb-3">
                    <label class="form-label">{{ t('billing.registrationNumber') }}</label>
                    <input v-model="form.registrationNumber" type="text" class="form-control" required />
                  </div>
                </div>
              </div>
              <div class="form-group mb-3">
                <label class="form-label">{{ t('dashboard.companyName') }}</label>
                <input v-model="form.companyName" type="text" class="form-control" required />
              </div>
              <div class="form-group mb-3">
                <label class="form-label">{{ t('billing.companyAddress') }}</label>
                <input v-model="form.companyAddress" type="text" class="form-control" required />
              </div>
            </template>
          </div>
        </div>
      </div>

      <div class="col-12 col-lg-5">
        <div class="card checkout-summary">
          <div class="card-body">
            <h2 class="text-section-title mb-3">{{ t('billing.yourOrder') }}</h2>

            <div class="checkout-summary-row mb-2">
              <span class="text-body">{{ pkg.key }} — {{ cycle === 'YEARLY' ? t('billing.yearly') : t('billing.monthly') }}</span>
              <span class="text-body checkout-summary-price">{{ formatPrice(priceForCycle) }}</span>
            </div>
            <p class="text-muted checkout-listing-title mb-3">{{ listing.title }}</p>
            <p class="text-muted checkout-vat-note mb-3">{{ t('billing.notVatRegistered') }}</p>

            <div class="checkout-security-note mb-3">
              <span aria-hidden="true">🔒</span>
              {{ t('billing.securePaymentNote') }}
            </div>

            <p class="text-muted checkout-info-note mb-2">{{ t('billing.autoRenewalNotice') }}</p>
            <p class="text-muted checkout-info-note mb-3">{{ t('billing.afterPaymentNotice') }}</p>

            <p class="text-muted checkout-terms mb-4">
              {{ t('billing.termsPrefix') }}
              <NuxtLink to="/uslovi-koriscenja" target="_blank">{{ t('footer.terms') }}</NuxtLink>.
            </p>

            <p v-if="error" class="form-error mb-3">{{ error }}</p>
            <button class="btn btn-primary-flat btn-block" :disabled="submitting" @click="submitCheckout">
              {{ submitting ? t('common.loading') : t('billing.payAndPublish') }}
            </button>
            <NuxtLink :to="`/oglasi/${route.params.id}/paket`" class="btn btn-tertiary btn-block mt-2">
              ← {{ t('billing.backToPackages') }}
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>

    <form v-if="nestpayForm" ref="nestpayFormEl" :action="nestpayForm.actionUrl" method="POST" class="checkout-hidden-form">
      <input v-for="(value, key) in nestpayForm.fields" :key="key" type="hidden" :name="key" :value="value" />
    </form>
  </div>
</template>

<script setup>
definePageMeta({ middleware: 'auth' })
const { t } = useI18n()
const api = useApi()
const auth = useAuthStore()
const route = useRoute()

const cycle = route.query.billingCycle === 'YEARLY' ? 'YEARLY' : 'MONTHLY'
const packageId = route.query.packageId

const { data: listing } = await useAsyncData(`checkout-listing-${route.params.id}`, () => api.get(`/listings/${route.params.id}`))
const { data: packages } = await useAsyncData('checkout-packages', () => api.get('/packages'))
const pkg = computed(() => packages.value?.find((p) => p.id === packageId))
const priceForCycle = computed(() => (pkg.value ? (cycle === 'YEARLY' ? pkg.value.priceYearly : pkg.value.priceMonthly) : 0))

const form = reactive({
  firstName: auth.user?.firstName || '',
  lastName: auth.user?.lastName || '',
  email: auth.user?.email || '',
  isCompany: auth.user?.buyerType === 'COMPANY',
  taxId: auth.user?.taxId || '',
  registrationNumber: auth.user?.registrationNumber || '',
  companyName: auth.user?.companyName || '',
  companyAddress: auth.user?.billingAddress || '',
})

const submitting = ref(false)
const error = ref('')
const nestpayForm = ref(null)
const nestpayFormEl = ref(null)

function formatPrice(value) {
  return `${new Intl.NumberFormat('sr-RS').format(value || 0)} RSD`
}

function validate() {
  if (!form.firstName || !form.lastName || !form.email) return t('billing.checkoutValidationRequired')
  if (form.isCompany && (!form.taxId || !form.registrationNumber || !form.companyName || !form.companyAddress)) {
    return t('billing.checkoutValidationCompanyRequired')
  }
  return ''
}

async function submitCheckout() {
  error.value = validate()
  if (error.value) return

  submitting.value = true
  try {
    const result = await api.post('/subscriptions/checkout/init', {
      listingId: route.params.id,
      packageId,
      billingCycle: cycle,
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      phone: auth.user?.phone || undefined,
      isCompany: form.isCompany,
      taxId: form.isCompany ? form.taxId : undefined,
      registrationNumber: form.isCompany ? form.registrationNumber : undefined,
      companyName: form.isCompany ? form.companyName : undefined,
      companyAddress: form.isCompany ? form.companyAddress : undefined,
    })
    nestpayForm.value = result
    await nextTick()
    nestpayFormEl.value.submit()
  } catch (e) {
    error.value = extractErrorMessage(e, t('auth.genericError'))
    submitting.value = false
  }
}

useSeoMeta({ title: t('billing.checkoutTitle') })
</script>

<style lang="scss" scoped>
.checkout-page {
  padding: 32px 0 64px;
}

.checkout-company-toggle {
  align-items: flex-start;
}

.checkout-summary-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.checkout-summary-price {
  font-weight: 600;
}

.checkout-listing-title {
  padding-bottom: 16px;
  border-bottom: 1px solid $color-border;
}

.checkout-security-note {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  background: $color-background;
  border-radius: $radius-input;
  font-size: $font-size-muted;
  color: $color-text-muted;
}

.checkout-terms,
.checkout-vat-note,
.checkout-info-note {
  font-size: $font-size-muted;
}

.checkout-hidden-form {
  display: none;
}
</style>
