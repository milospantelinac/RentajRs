<template>
  <div class="settings-page">
    <h1 class="text-page-title mb-4">{{ t('dashboard.settings') }}</h1>

    <div class="card mb-4">
      <div class="card-body">
        <h2 class="text-section-title mb-3">{{ t('dashboard.profileSettings') }}</h2>
        <div class="row">
          <div class="col-6">
            <div class="form-group mb-3">
              <label class="form-label">{{ t('auth.firstName') }}</label>
              <input v-model="form.firstName" type="text" class="form-control" />
            </div>
          </div>
          <div class="col-6">
            <div class="form-group mb-3">
              <label class="form-label">{{ t('auth.lastName') }}</label>
              <input v-model="form.lastName" type="text" class="form-control" />
            </div>
          </div>
        </div>
        <div class="form-group mb-3">
          <label class="form-label">{{ t('auth.phone') }}</label>
          <input v-model="form.phone" type="text" class="form-control" />
        </div>
      </div>
    </div>

    <div class="card mb-4">
      <div class="card-body">
        <h2 class="text-section-title mb-3">{{ t('dashboard.billingSettings') }}</h2>
        <div class="form-group mb-3">
          <label class="form-label">{{ t('listing.paymentMethod') }}</label>
          <select v-model="form.buyerType" class="form-control form-select">
            <option value="PERSON">{{ t('dashboard.buyerTypePerson') }}</option>
            <option value="COMPANY">{{ t('dashboard.buyerTypeCompany') }}</option>
          </select>
        </div>
        <template v-if="form.buyerType === 'COMPANY'">
          <div class="form-group mb-3">
            <label class="form-label">{{ t('dashboard.companyName') }}</label>
            <input v-model="form.companyName" type="text" class="form-control" />
          </div>
          <div class="row">
            <div class="col-6">
              <div class="form-group mb-3">
                <label class="form-label">{{ t('dashboard.taxId') }}</label>
                <input v-model="form.taxId" type="text" class="form-control" />
              </div>
            </div>
            <div class="col-6">
              <div class="form-group mb-3">
                <label class="form-label">{{ t('dashboard.registrationNumber') }}</label>
                <input v-model="form.registrationNumber" type="text" class="form-control" />
              </div>
            </div>
          </div>
        </template>
        <div class="form-group mb-3">
          <label class="form-label">{{ t('dashboard.bankAccount') }}</label>
          <input v-model="form.bankAccount" type="text" placeholder="160-0000000000000-00" class="form-control" />
        </div>

        <p v-if="saved" class="text-success mb-2">{{ t('dashboard.changesSaved') }}</p>
        <button class="btn btn-primary-flat" :disabled="saving" @click="save">{{ t('dashboard.saveChanges') }}</button>
      </div>
    </div>

    <div class="card mb-4">
      <div class="card-body">
        <h2 class="text-section-title mb-3">{{ t('dashboard.twoFactorSettings') }}</h2>

        <template v-if="twoFactorStep === 'status'">
          <p class="mb-3" :class="auth.user?.twoFactorEnabled ? 'text-success' : 'text-muted'">
            {{ auth.user?.twoFactorEnabled ? t('auth.twoFactorEnabledStatus') : t('auth.twoFactorDisabledStatus') }}
          </p>
          <button v-if="!auth.user?.twoFactorEnabled" class="btn btn-primary-flat" :disabled="twoFactorLoading" @click="startTwoFactorSetup">
            {{ t('auth.twoFactorEnableButton') }}
          </button>
          <button v-else class="btn btn-danger" :disabled="twoFactorLoading" @click="twoFactorStep = 'disable'">
            {{ t('auth.twoFactorDisableButton') }}
          </button>
        </template>

        <form v-else-if="twoFactorStep === 'setup'" @submit.prevent="confirmTwoFactorSetup">
          <p class="text-muted mb-2">{{ t('auth.twoFactorSetupInstructions') }}</p>
          <img v-if="twoFactorQrCodeDataUrl" :src="twoFactorQrCodeDataUrl" :alt="t('auth.twoFactorQrAlt')" class="setup-qr mb-3" />
          <p class="text-muted mb-1">{{ t('auth.twoFactorManualEntry') }}</p>
          <div class="setup-secret mb-3">{{ twoFactorSecret }}</div>
          <div class="form-group mb-3">
            <label class="form-label" for="twoFactorCode">{{ t('auth.twoFactorCode') }}</label>
            <input id="twoFactorCode" v-model="twoFactorCode" type="text" inputmode="numeric" class="form-control" required />
          </div>
          <p v-if="twoFactorError" class="form-error mb-3">{{ twoFactorError }}</p>
          <button type="submit" class="btn btn-primary-flat" :disabled="twoFactorLoading">{{ t('common.confirm') }}</button>
          <button type="button" class="btn btn-tertiary" :disabled="twoFactorLoading" @click="cancelTwoFactorFlow">{{ t('common.cancel') }}</button>
        </form>

        <form v-else-if="twoFactorStep === 'disable'" @submit.prevent="confirmTwoFactorDisable">
          <p class="text-muted mb-2">{{ t('auth.twoFactorConfirmPasswordPrompt') }}</p>
          <div class="form-group mb-3">
            <label class="form-label" for="twoFactorPassword">{{ t('auth.twoFactorPasswordLabel') }}</label>
            <input id="twoFactorPassword" v-model="twoFactorPassword" type="password" class="form-control" required />
          </div>
          <p v-if="twoFactorError" class="form-error mb-3">{{ twoFactorError }}</p>
          <button type="submit" class="btn btn-danger" :disabled="twoFactorLoading">{{ t('auth.twoFactorDisableButton') }}</button>
          <button type="button" class="btn btn-tertiary" :disabled="twoFactorLoading" @click="cancelTwoFactorFlow">{{ t('common.cancel') }}</button>
        </form>
      </div>
    </div>

    <div class="card">
      <div class="card-body">
        <h2 class="text-section-title mb-3">{{ t('dashboard.deleteAccount') }}</h2>
        <p class="text-muted mb-3">{{ t('dashboard.deleteAccountWarning') }}</p>
        <button class="btn btn-danger" @click="deleteAccount">{{ t('dashboard.deleteAccount') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ middleware: 'auth', layout: 'dashboard' })
const { t } = useI18n()
const api = useApi()
const auth = useAuthStore()

const form = reactive({
  firstName: auth.user?.firstName || '',
  lastName: auth.user?.lastName || '',
  phone: auth.user?.phone || '',
  buyerType: auth.user?.buyerType || 'PERSON',
  companyName: auth.user?.companyName || '',
  taxId: auth.user?.taxId || '',
  registrationNumber: auth.user?.registrationNumber || '',
  bankAccount: auth.user?.bankAccount || '',
})
const saving = ref(false)
const saved = ref(false)

async function save() {
  saving.value = true
  saved.value = false
  try {
    await api.patch('/users/me', form)
    await auth.fetchMe()
    saved.value = true
  } finally {
    saving.value = false
  }
}

const twoFactorStep = ref('status')
const twoFactorLoading = ref(false)
const twoFactorError = ref('')
const twoFactorSecret = ref('')
const twoFactorQrCodeDataUrl = ref('')
const twoFactorCode = ref('')
const twoFactorPassword = ref('')

function cancelTwoFactorFlow() {
  twoFactorStep.value = 'status'
  twoFactorError.value = ''
  twoFactorCode.value = ''
  twoFactorPassword.value = ''
}

async function startTwoFactorSetup() {
  twoFactorLoading.value = true
  twoFactorError.value = ''
  try {
    const result = await api.post('/auth/2fa/generate')
    twoFactorSecret.value = result.secret
    twoFactorQrCodeDataUrl.value = result.qrCodeDataUrl
    twoFactorStep.value = 'setup'
  } finally {
    twoFactorLoading.value = false
  }
}

async function confirmTwoFactorSetup() {
  twoFactorLoading.value = true
  twoFactorError.value = ''
  try {
    await api.post('/auth/2fa/confirm', { code: twoFactorCode.value })
    await auth.fetchMe()
    cancelTwoFactorFlow()
  } catch (e) {
    twoFactorError.value = e?.data?.message?.[0] || e?.data?.message || t('auth.genericError')
  } finally {
    twoFactorLoading.value = false
  }
}

async function confirmTwoFactorDisable() {
  twoFactorLoading.value = true
  twoFactorError.value = ''
  try {
    await api.post('/auth/2fa/disable', { password: twoFactorPassword.value })
    await auth.fetchMe()
    cancelTwoFactorFlow()
  } catch (e) {
    twoFactorError.value = e?.data?.message?.[0] || e?.data?.message || t('auth.genericError')
  } finally {
    twoFactorLoading.value = false
  }
}

async function deleteAccount() {
  if (!confirm(t('dashboard.deleteAccountWarning'))) return
  await api.delete('/users/me')
  await auth.clearSessionAndCookies()
  await navigateTo('/')
}

useSeoMeta({ title: t('dashboard.settings') })
</script>

<style lang="scss" scoped>
.setup-qr {
  display: block;
  width: 180px;
  height: 180px;
}

.setup-secret {
  padding: 12px;
  background: $color-background;
  border-radius: $radius-input;
  font-family: monospace;
  text-align: center;
  letter-spacing: 0.05em;
  word-break: break-all;
}
</style>
