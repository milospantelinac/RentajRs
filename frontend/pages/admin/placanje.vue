<template>
  <div>
    <DashboardPageHeader :title="t('admin.paymentSettingsTitle')" :subtitle="t('admin.paymentSettingsSubtitle')" />

    <StateBlock
      v-if="loadError"
      card
      error
      icon="payments"
      :title="t('admin.loadErrorTitle')"
      :text="t('admin.loadErrorText')"
    >
      <button type="button" class="state-block-action" @click="reload">{{ t('errorPage.tryAgain') }}</button>
    </StateBlock>

    <template v-else>
      <div class="admin-card">
        <div class="admin-card-head">
          <div>
            <p class="admin-card-title">{{ t('admin.nestpayConnectionParams') }}</p>
            <p class="admin-card-note">{{ t('admin.nestpayConnectionParamsHint') }}</p>
          </div>
        </div>
        <div class="admin-card-body pay-body">
          <div class="pay-grid">
            <div class="form-group">
              <label class="form-label">{{ t('admin.clientId') }}</label>
              <input v-model="form.clientId" type="text" class="form-control" />
            </div>
            <div class="form-group">
              <label class="form-label">{{ t('admin.storeKey') }}</label>
              <input
                v-model="form.storeKey"
                type="password"
                class="form-control"
                :placeholder="storeKeySet ? maskedPlaceholder : ''"
                @focus="clearIfMasked('storeKey')"
              />
            </div>
            <div class="form-group">
              <label class="form-label">{{ t('admin.apiUsername') }}</label>
              <input v-model="form.apiUsername" type="text" class="form-control" />
            </div>
            <div class="form-group">
              <label class="form-label">{{ t('admin.apiPassword') }}</label>
              <input
                v-model="form.apiPassword"
                type="password"
                class="form-control"
                :placeholder="apiPasswordSet ? maskedPlaceholder : ''"
                @focus="clearIfMasked('apiPassword')"
              />
            </div>
            <div class="form-group">
              <label class="form-label">{{ t('admin.transactionType') }}</label>
              <select v-model="form.transactionType" class="form-control form-select">
                <option value="Auth">{{ t('admin.transactionTypeAuth') }}</option>
                <option value="PreAuth">{{ t('admin.transactionTypePreAuth') }}</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">{{ t('admin.currency') }}</label>
              <select v-model="form.currency" class="form-control form-select">
                <option value="RSD">RSD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>

          <div class="pay-mode">
            <label class="admin-check-row">
              <input v-model="form.testMode" type="checkbox" class="admin-check" @change="applyEndpointDefault" />
              {{ t('admin.testMode') }}
            </label>
            <p class="admin-card-note">{{ form.testMode ? t('admin.testModeOnHint') : t('admin.testModeOffHint') }}</p>
          </div>

          <div class="form-group">
            <label class="form-label">{{ t('admin.apiEndpoint') }}</label>
            <input v-model="form.apiEndpoint" type="text" class="form-control" placeholder="https://testsecurepay.eway2pay.com" />
          </div>
          <div class="form-group">
            <label class="form-label">{{ t('admin.okUrl') }}</label>
            <input v-model="form.okUrl" type="text" class="form-control" />
          </div>
          <div class="form-group">
            <label class="form-label">{{ t('admin.failUrl') }}</label>
            <input v-model="form.failUrl" type="text" class="form-control" />
          </div>
          <div class="form-group">
            <label class="form-label">{{ t('admin.shopUrl') }}</label>
            <input v-model="form.shopUrl" type="text" class="form-control" />
          </div>
        </div>
      </div>

      <div class="admin-card">
        <div class="admin-card-head">
          <div>
            <p class="admin-card-title">{{ t('admin.merchantInfoTitle') }}</p>
            <p class="admin-card-note">{{ t('admin.merchantInfoHint') }}</p>
          </div>
        </div>
        <div class="admin-card-body pay-body">
          <div class="form-group">
            <label class="form-label">{{ t('admin.merchantName') }}</label>
            <input v-model="form.merchantName" type="text" class="form-control" />
          </div>
          <div class="pay-grid">
            <div class="form-group">
              <label class="form-label">{{ t('admin.merchantTaxId') }}</label>
              <input v-model="form.merchantTaxId" type="text" class="form-control" />
            </div>
            <div class="form-group">
              <label class="form-label">{{ t('admin.merchantAddress') }}</label>
              <input v-model="form.merchantAddress" type="text" class="form-control" />
            </div>
          </div>
        </div>
      </div>

      <div class="pay-actions">
        <button class="btn btn-primary-flat" :disabled="saving" @click="save">
          {{ saving ? t('common.loading') : t('admin.saveSetting') }}
        </button>
        <p v-if="error" class="form-error">{{ error }}</p>
        <p v-else-if="saved" class="form-success">{{ t('admin.paymentSettingsSaved') }}</p>
      </div>
    </template>
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

const { data: settings, error: loadError, refresh } = await useAsyncData('admin-payment-settings', () => api.get('/admin/payment-settings'))

// Dizajn 44: a failed load says so instead of showing an empty form that
// would overwrite the live settings on save.
function applySettings(value) {
  if (!value) return
  Object.assign(form, value)
  storeKeySet.value = !!value.storeKey
  apiPasswordSet.value = !!value.apiPassword
  form.storeKey = ''
  form.apiPassword = ''
}
applySettings(settings.value)

async function reload() {
  await refresh()
  applySettings(settings.value)
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
.pay-body {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding-top: 18px;
}

// Two fields to a line above 768, one below, without the shared grid's own
// negative margins.
.pay-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 18px;
}

@include respond-above(md) {
  .pay-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.pay-mode {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px 18px;
  border-radius: $radius-input;
  background: $color-background;
}

.pay-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  margin-top: 20px;
}
</style>
