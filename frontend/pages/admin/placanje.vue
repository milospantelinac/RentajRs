<template>
  <div>
    <h2 class="text-section-title mb-1">{{ t('admin.paymentSettingsTitle') }}</h2>
    <p class="text-muted mb-4">{{ t('admin.paymentSettingsSubtitle') }}</p>

    <div class="card mb-4">
      <div class="card-body">
        <h3 class="text-body payment-settings-group-title mb-1">{{ t('admin.nestpayConnectionParams') }}</h3>
        <p class="text-muted mb-3">{{ t('admin.nestpayConnectionParamsHint') }}</p>

        <div class="row">
          <div class="col-12 col-md-6 mb-3">
            <label class="form-label">{{ t('admin.clientId') }}</label>
            <input v-model="form.clientId" type="text" class="form-control" />
          </div>
          <div class="col-12 col-md-6 mb-3">
            <label class="form-label">{{ t('admin.storeKey') }}</label>
            <input v-model="form.storeKey" type="password" class="form-control" :placeholder="storeKeySet ? maskedPlaceholder : ''" @focus="clearIfMasked('storeKey')" />
          </div>
          <div class="col-12 col-md-6 mb-3">
            <label class="form-label">{{ t('admin.apiUsername') }}</label>
            <input v-model="form.apiUsername" type="text" class="form-control" />
          </div>
          <div class="col-12 col-md-6 mb-3">
            <label class="form-label">{{ t('admin.apiPassword') }}</label>
            <input v-model="form.apiPassword" type="password" class="form-control" :placeholder="apiPasswordSet ? maskedPlaceholder : ''" @focus="clearIfMasked('apiPassword')" />
          </div>
          <div class="col-12 col-md-6 mb-3">
            <label class="form-label">{{ t('admin.transactionType') }}</label>
            <select v-model="form.transactionType" class="form-control form-select">
              <option value="Auth">{{ t('admin.transactionTypeAuth') }}</option>
              <option value="PreAuth">{{ t('admin.transactionTypePreAuth') }}</option>
            </select>
          </div>
          <div class="col-12 col-md-6 mb-3">
            <label class="form-label">{{ t('admin.currency') }}</label>
            <select v-model="form.currency" class="form-control form-select">
              <option value="RSD">RSD</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
        </div>

        <div class="form-row-inline mb-2">
          <input id="testMode" v-model="form.testMode" type="checkbox" class="form-checkbox" @change="applyEndpointDefault" />
          <label for="testMode">{{ t('admin.testMode') }}</label>
        </div>
        <p class="text-muted mb-3">{{ form.testMode ? t('admin.testModeOnHint') : t('admin.testModeOffHint') }}</p>

        <div class="mb-3">
          <label class="form-label">{{ t('admin.apiEndpoint') }}</label>
          <input v-model="form.apiEndpoint" type="text" class="form-control" placeholder="https://testsecurepay.eway2pay.com" />
        </div>
        <div class="mb-3">
          <label class="form-label">{{ t('admin.okUrl') }}</label>
          <input v-model="form.okUrl" type="text" class="form-control" />
        </div>
        <div class="mb-3">
          <label class="form-label">{{ t('admin.failUrl') }}</label>
          <input v-model="form.failUrl" type="text" class="form-control" />
        </div>
        <div class="mb-3">
          <label class="form-label">{{ t('admin.shopUrl') }}</label>
          <input v-model="form.shopUrl" type="text" class="form-control" />
        </div>
      </div>
    </div>

    <div class="card mb-4">
      <div class="card-body">
        <h3 class="text-body payment-settings-group-title mb-1">{{ t('admin.merchantInfoTitle') }}</h3>
        <p class="text-muted mb-3">{{ t('admin.merchantInfoHint') }}</p>

        <div class="mb-3">
          <label class="form-label">{{ t('admin.merchantName') }}</label>
          <input v-model="form.merchantName" type="text" class="form-control" />
        </div>
        <div class="row">
          <div class="col-12 col-md-6 mb-3">
            <label class="form-label">{{ t('admin.merchantTaxId') }}</label>
            <input v-model="form.merchantTaxId" type="text" class="form-control" />
          </div>
          <div class="col-12 col-md-6 mb-3">
            <label class="form-label">{{ t('admin.merchantAddress') }}</label>
            <input v-model="form.merchantAddress" type="text" class="form-control" />
          </div>
        </div>
      </div>
    </div>

    <p v-if="saved" class="text-success mb-2">{{ t('admin.paymentSettingsSaved') }}</p>
    <p v-if="error" class="form-error mb-2">{{ error }}</p>
    <button class="btn btn-primary-flat" :disabled="saving" @click="save">
      {{ saving ? t('common.loading') : t('admin.saveSetting') }}
    </button>
  </div>
</template>

<script setup>
definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })
const { t } = useI18n()
const api = useApi()

const maskedPlaceholder = '••••••••'
const saving = ref(false)
const saved = ref(false)
const error = ref('')
const storeKeySet = ref(false)
const apiPasswordSet = ref(false)

const form = reactive({
  clientId: '',
  storeKey: '',
  apiUsername: '',
  apiPassword: '',
  okUrl: '',
  failUrl: '',
  shopUrl: '',
  apiEndpoint: '',
  transactionType: 'Auth',
  currency: 'RSD',
  testMode: true,
  merchantName: '',
  merchantTaxId: '',
  merchantAddress: '',
})

const { data: settings } = await useAsyncData('admin-payment-settings', () => api.get('/admin/payment-settings'))
if (settings.value) {
  Object.assign(form, settings.value)
  storeKeySet.value = !!settings.value.storeKey
  apiPasswordSet.value = !!settings.value.apiPassword
  form.storeKey = ''
  form.apiPassword = ''
}

function clearIfMasked(field) {
  if (form[field] === maskedPlaceholder) form[field] = ''
}

const TEST_ENDPOINT = 'https://testsecurepay.eway2pay.com'
const PROD_ENDPOINT = 'https://bib.eway2pay.com'
function applyEndpointDefault() {
  if (!form.apiEndpoint || form.apiEndpoint === TEST_ENDPOINT || form.apiEndpoint === PROD_ENDPOINT) {
    form.apiEndpoint = form.testMode ? TEST_ENDPOINT : PROD_ENDPOINT
  }
}

async function save() {
  saving.value = true
  saved.value = false
  error.value = ''
  try {
    // Whitelisted explicitly — `form` also carries read-only fields like
    // `updatedAt` from the GET response, which the update DTO rejects.
    const payload = {
      clientId: form.clientId,
      apiUsername: form.apiUsername,
      okUrl: form.okUrl,
      failUrl: form.failUrl,
      shopUrl: form.shopUrl,
      apiEndpoint: form.apiEndpoint,
      transactionType: form.transactionType,
      currency: form.currency,
      testMode: form.testMode,
      merchantName: form.merchantName,
      merchantTaxId: form.merchantTaxId,
      merchantAddress: form.merchantAddress,
    }
    if (form.storeKey) payload.storeKey = form.storeKey
    if (form.apiPassword) payload.apiPassword = form.apiPassword
    const result = await api.patch('/admin/payment-settings', payload)
    storeKeySet.value = !!result.storeKey
    apiPasswordSet.value = !!result.apiPassword
    form.storeKey = ''
    form.apiPassword = ''
    saved.value = true
  } catch (e) {
    error.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    saving.value = false
  }
}

useSeoMeta({ title: t('admin.paymentSettingsTitle') })
</script>

<style lang="scss" scoped>
.payment-settings-group-title {
  font-weight: 600;
}
</style>
