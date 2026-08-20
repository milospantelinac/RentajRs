<template>
  <div class="settings-page">
    <h1 class="text-page-title mb-4">{{ t('dashboard.settings') }}</h1>

    <div class="card mb-4">
      <div class="card-body">
        <h2 class="text-section-title mb-3">{{ t('dashboard.avatarSettings') }}</h2>

        <div class="avatar-settings-row">
          <button type="button" class="avatar-picker" :aria-label="t('dashboard.avatarChangeAction')" @click="avatarFileInput?.click()">
            <img v-if="avatarPreviewUrl" :src="avatarPreviewUrl" alt="" class="avatar-picker-image" />
            <span v-else class="avatar-picker-placeholder">
              <FontAwesomeIcon icon="plus" />
            </span>
            <span v-if="avatarPreviewUrl" class="avatar-picker-edit">
              <FontAwesomeIcon icon="pen" />
            </span>
          </button>
          <div class="avatar-settings-info">
            <p class="text-muted avatar-settings-hint">{{ t('dashboard.avatarHint') }}</p>
            <button v-if="avatarPreviewUrl" type="button" class="avatar-remove-link" @click="removeAvatar">
              {{ t('dashboard.avatarRemoveAction') }}
            </button>
          </div>
        </div>

        <input ref="avatarFileInput" type="file" accept="image/*" class="d-none" @change="onAvatarFileSelected" />

        <p v-if="avatarError" class="form-error mb-2 mt-3">{{ avatarError }}</p>
        <p v-if="avatarSaved" class="text-success mb-2 mt-3">{{ t('dashboard.changesSaved') }}</p>
        <button class="btn btn-primary-flat mt-3" :disabled="avatarSaving || (!pendingAvatarBlob && !avatarRemoveRequested)" @click="saveAvatar">
          {{ avatarSaving ? t('common.loading') : t('dashboard.saveChanges') }}
        </button>
      </div>
    </div>

    <AvatarCropModal v-if="pendingAvatarFile" :file="pendingAvatarFile" @confirm="onCropConfirm" @cancel="pendingAvatarFile = null" />

    <div class="card mb-4">
      <div class="card-body">
        <h2 class="text-section-title mb-3">{{ t('dashboard.profileSettings') }}</h2>
        <div class="row">
          <div class="col-6">
            <div class="form-group mb-3">
              <label class="form-label">{{ t('auth.firstName') }}</label>
              <input v-model="profileForm.firstName" type="text" class="form-control" />
            </div>
          </div>
          <div class="col-6">
            <div class="form-group mb-3">
              <label class="form-label">{{ t('auth.lastName') }}</label>
              <input v-model="profileForm.lastName" type="text" class="form-control" />
            </div>
          </div>
        </div>
        <div class="form-group mb-3">
          <label class="form-label">{{ t('auth.phone') }}</label>
          <input v-model="profileForm.phone" type="text" class="form-control" />
        </div>

        <p v-if="profileError" class="form-error mb-2">{{ profileError }}</p>
        <p v-if="profileSaved" class="text-success mb-2">{{ t('dashboard.changesSaved') }}</p>
        <button class="btn btn-primary-flat" :disabled="profileSaving" @click="saveProfile">{{ t('dashboard.saveChanges') }}</button>
      </div>
    </div>

    <div class="card mb-4">
      <div class="card-body">
        <h2 class="text-section-title mb-3">{{ t('dashboard.billingSettings') }}</h2>
        <div class="form-group mb-3">
          <label class="form-label">{{ t('listing.paymentMethod') }}</label>
          <select v-model="billingForm.buyerType" class="form-control form-select">
            <option value="PERSON">{{ t('dashboard.buyerTypePerson') }}</option>
            <option value="COMPANY">{{ t('dashboard.buyerTypeCompany') }}</option>
          </select>
        </div>
        <template v-if="billingForm.buyerType === 'COMPANY'">
          <div class="form-group mb-3">
            <label class="form-label">{{ t('dashboard.companyName') }}</label>
            <input v-model="billingForm.companyName" type="text" class="form-control" />
          </div>
          <div class="row">
            <div class="col-6">
              <div class="form-group mb-3">
                <label class="form-label">{{ t('dashboard.taxId') }}</label>
                <input v-model="billingForm.taxId" type="text" class="form-control" />
              </div>
            </div>
            <div class="col-6">
              <div class="form-group mb-3">
                <label class="form-label">{{ t('dashboard.registrationNumber') }}</label>
                <input v-model="billingForm.registrationNumber" type="text" class="form-control" />
              </div>
            </div>
          </div>
        </template>
        <div class="form-group mb-3">
          <label class="form-label">{{ t('dashboard.bankAccount') }}</label>
          <input v-model="billingForm.bankAccount" type="text" placeholder="160-0000000000000-00" class="form-control" />
        </div>

        <p v-if="billingError" class="form-error mb-2">{{ billingError }}</p>
        <p v-if="billingSaved" class="text-success mb-2">{{ t('dashboard.changesSaved') }}</p>
        <button class="btn btn-primary-flat" :disabled="billingSaving" @click="saveBilling">{{ t('dashboard.saveChanges') }}</button>
      </div>
    </div>

    <div class="card mb-4">
      <div class="card-body">
        <h2 class="text-section-title mb-3">{{ t('dashboard.twoFactorSettings') }}</h2>

        <template v-if="twoFactorStep === 'status'">
          <p class="mb-3" :class="auth.user?.twoFactorEnabled ? 'text-success' : 'text-muted'">
            {{ auth.user?.twoFactorEnabled ? t('auth.twoFactorEnabledStatus') : t('auth.twoFactorDisabledStatus') }}
          </p>
          <button v-if="!auth.user?.twoFactorEnabled" class="btn btn-primary-flat" :disabled="twoFactorLoading" @click="twoFactorStep = 'enable-password'">
            {{ t('auth.twoFactorEnableButton') }}
          </button>
          <button v-else class="btn btn-danger" :disabled="twoFactorLoading" @click="twoFactorStep = 'disable'">
            {{ t('auth.twoFactorDisableButton') }}
          </button>
        </template>

        <form v-else-if="twoFactorStep === 'enable-password'" @submit.prevent="startTwoFactorSetup">
          <p class="text-muted mb-2">{{ t('auth.twoFactorConfirmEnablePasswordPrompt') }}</p>
          <div class="form-group mb-3">
            <label class="form-label" for="twoFactorEnablePassword">{{ t('auth.twoFactorPasswordLabel') }}</label>
            <input id="twoFactorEnablePassword" v-model="twoFactorPassword" type="password" class="form-control" required />
          </div>
          <p v-if="twoFactorError" class="form-error mb-3">{{ twoFactorError }}</p>
          <button type="submit" class="btn btn-primary-flat" :disabled="twoFactorLoading">{{ t('common.continue') }}</button>
          <button type="button" class="btn btn-tertiary" :disabled="twoFactorLoading" @click="cancelTwoFactorFlow">{{ t('common.cancel') }}</button>
        </form>

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

        <div v-else-if="twoFactorStep === 'backupCodes'">
          <p class="text-body mb-3">{{ t('auth.backupCodesIntro') }}</p>
          <ul class="backup-codes-list mb-3">
            <li v-for="backupCode in twoFactorBackupCodes" :key="backupCode">{{ backupCode }}</li>
          </ul>
          <p class="text-muted mb-3">{{ t('auth.backupCodesWarning') }}</p>
          <button type="button" class="btn btn-primary-flat" @click="cancelTwoFactorFlow">
            {{ t('auth.backupCodesSavedConfirm') }}
          </button>
        </div>
      </div>
    </div>

    <div class="card mb-4">
      <div class="card-body">
        <h2 class="text-section-title mb-2">{{ t('dashboard.notificationSettings') }}</h2>
        <p class="text-muted mb-3">{{ t('dashboard.notificationSettingsHint') }}</p>
        <div v-for="cat in notificationCategories" :key="cat.key" class="notif-row">
          <span class="text-body">{{ t(`dashboard.notifCategory${cat.key}`) }}</span>
          <div class="notif-toggles">
            <label class="notif-toggle">
              <input v-model="notifPrefs[cat.key].emailEnabled" type="checkbox" @change="saveNotifCategory(cat)" />
              {{ t('dashboard.notifChannelEmail') }}
            </label>
            <label class="notif-toggle">
              <input v-model="notifPrefs[cat.key].appEnabled" type="checkbox" @change="saveNotifCategory(cat)" />
              {{ t('dashboard.notifChannelApp') }}
            </label>
          </div>
        </div>
        <p v-if="notifSaved" class="text-success mt-2">{{ t('dashboard.changesSaved') }}</p>
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

const avatarFileInput = ref(null)
const pendingAvatarFile = ref(null) // File driving the open crop modal, if any
const pendingAvatarBlob = ref(null) // cropped result, held locally until "Sačuvaj izmene"
const avatarRemoveRequested = ref(false) // user cleared the photo, pending "Sačuvaj izmene"
const avatarPreviewUrl = ref(auth.user?.avatarUrl || '')
const avatarSaving = ref(false)
const avatarSaved = ref(false)
const avatarError = ref('')

function onAvatarFileSelected(e) {
  const file = e.target.files?.[0]
  e.target.value = '' // so picking the same file again still fires change
  if (file) pendingAvatarFile.value = file
}

function onCropConfirm(blob) {
  if (avatarPreviewUrl.value?.startsWith('blob:')) URL.revokeObjectURL(avatarPreviewUrl.value)
  pendingAvatarBlob.value = blob
  avatarRemoveRequested.value = false
  avatarPreviewUrl.value = URL.createObjectURL(blob)
  pendingAvatarFile.value = null
  avatarSaved.value = false
}

function removeAvatar() {
  if (avatarPreviewUrl.value?.startsWith('blob:')) URL.revokeObjectURL(avatarPreviewUrl.value)
  avatarPreviewUrl.value = ''
  pendingAvatarBlob.value = null
  avatarRemoveRequested.value = true
  avatarSaved.value = false
}

async function saveAvatar() {
  if (!pendingAvatarBlob.value && !avatarRemoveRequested.value) return
  avatarSaving.value = true
  avatarSaved.value = false
  avatarError.value = ''
  try {
    if (avatarRemoveRequested.value) {
      await api.delete('/users/me/avatar')
    } else {
      const formData = new FormData()
      formData.append('file', pendingAvatarBlob.value, 'avatar.jpg')
      await api.post('/users/me/avatar', formData)
    }
    await auth.fetchMe()
    pendingAvatarBlob.value = null
    avatarRemoveRequested.value = false
    avatarSaved.value = true
  } catch (e) {
    avatarError.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    avatarSaving.value = false
  }
}

const profileForm = reactive({
  firstName: auth.user?.firstName || '',
  lastName: auth.user?.lastName || '',
  phone: auth.user?.phone || '',
})
const profileSaving = ref(false)
const profileSaved = ref(false)
const profileError = ref('')

async function saveProfile() {
  profileSaving.value = true
  profileSaved.value = false
  profileError.value = ''
  try {
    await api.patch('/users/me', profileForm)
    await auth.fetchMe()
    profileSaved.value = true
  } catch (e) {
    profileError.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    profileSaving.value = false
  }
}

const billingForm = reactive({
  buyerType: auth.user?.buyerType || 'PERSON',
  companyName: auth.user?.companyName || '',
  taxId: auth.user?.taxId || '',
  registrationNumber: auth.user?.registrationNumber || '',
  bankAccount: auth.user?.bankAccount || '',
})
const billingSaving = ref(false)
const billingSaved = ref(false)
const billingError = ref('')

async function saveBilling() {
  billingSaving.value = true
  billingSaved.value = false
  billingError.value = ''
  try {
    await api.patch('/users/me', billingForm)
    await auth.fetchMe()
    billingSaved.value = true
  } catch (e) {
    billingError.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    billingSaving.value = false
  }
}

const twoFactorStep = ref('status')
const twoFactorLoading = ref(false)
const twoFactorError = ref('')
const twoFactorSecret = ref('')
const twoFactorQrCodeDataUrl = ref('')
const twoFactorCode = ref('')
const twoFactorPassword = ref('')
const twoFactorBackupCodes = ref([])

function cancelTwoFactorFlow() {
  twoFactorStep.value = 'status'
  twoFactorError.value = ''
  twoFactorCode.value = ''
  twoFactorPassword.value = ''
  twoFactorBackupCodes.value = []
}

async function startTwoFactorSetup() {
  twoFactorLoading.value = true
  twoFactorError.value = ''
  try {
    const result = await api.post('/auth/2fa/generate', { password: twoFactorPassword.value })
    twoFactorSecret.value = result.secret
    twoFactorQrCodeDataUrl.value = result.qrCodeDataUrl
    twoFactorPassword.value = ''
    twoFactorStep.value = 'setup'
  } catch (e) {
    twoFactorError.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    twoFactorLoading.value = false
  }
}

async function confirmTwoFactorSetup() {
  twoFactorLoading.value = true
  twoFactorError.value = ''
  try {
    const result = await api.post('/auth/2fa/confirm', { code: twoFactorCode.value })
    await auth.fetchMe()
    twoFactorBackupCodes.value = result.backupCodes || []
    twoFactorCode.value = ''
    twoFactorStep.value = 'backupCodes'
  } catch (e) {
    twoFactorError.value = extractErrorMessage(e, t('auth.genericError'))
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
    twoFactorError.value = extractErrorMessage(e, t('auth.genericError'))
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

// R87 — the backend stores a NotificationSetting row per exact email
// template key (45 of them); grouping into a handful of categories here
// keeps the UI usable while still writing per-event rows underneath. Only
// non-critical events appear as toggleable — money/security/confirmed-
// booking emails always send (see backend CRITICAL_EMAIL_EVENTS).
const NOTIFICATION_CATEGORIES = [
  { key: 'Listings', events: ['listing_submitted_for_approval', 'listing_approved', 'listing_rejected', 'listing_edit_approved', 'listing_edit_rejected', 'listing_price_dropped'] },
  { key: 'Bookings', events: ['booking_requested_guest', 'booking_requested_owner', 'booking_request_unopened_reminder', 'booking_rejected', 'booking_expired', 'booking_no_show_marked'] },
  { key: 'Messages', events: ['new_message'] },
  { key: 'Reviews', events: ['review_invitation', 'reviews_published', 'review_reminder_7d', 'review_replied'] },
  { key: 'Subscription', events: ['subscription_activated', 'subscription_renewal_reminder', 'subscription_expiring_soon', 'subscription_expired'] },
  { key: 'Account', events: ['welcome_registration', 'data_export_ready'] },
]
const notificationCategories = NOTIFICATION_CATEGORIES
const notifPrefs = reactive(
  Object.fromEntries(NOTIFICATION_CATEGORIES.map((cat) => [cat.key, { emailEnabled: true, appEnabled: true }])),
)
const notifSaved = ref(false)

async function loadNotificationSettings() {
  const rows = await api.get('/notifications/settings')
  const byEvent = new Map(rows.map((r) => [r.event, r]))
  for (const cat of NOTIFICATION_CATEGORIES) {
    const relevant = cat.events.map((e) => byEvent.get(e)).filter(Boolean)
    // No row for an event means it's still on the default (both channels on) —
    // a category only reads as "off" once every one of its events is off.
    notifPrefs[cat.key] = {
      emailEnabled: relevant.length ? relevant.every((r) => r.emailEnabled) : true,
      appEnabled: relevant.length ? relevant.every((r) => r.appEnabled) : true,
    }
  }
}

async function saveNotifCategory(cat) {
  notifSaved.value = false
  await api.patch('/notifications/settings', {
    events: cat.events,
    emailEnabled: notifPrefs[cat.key].emailEnabled,
    appEnabled: notifPrefs[cat.key].appEnabled,
  })
  notifSaved.value = true
}

onMounted(loadNotificationSettings)

useSeoMeta({ title: t('dashboard.settings') })
</script>

<style lang="scss" scoped>
.avatar-settings-row {
  display: flex;
  align-items: center;
  gap: 20px;
}

.avatar-picker {
  position: relative;
  flex-shrink: 0;
  width: 88px;
  height: 88px;
  padding: 0;
  border: none;
  border-radius: $radius-pill;
  background: none;
  cursor: pointer;
}

.avatar-picker-image {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: $radius-pill;
  object-fit: cover;
}

.avatar-picker-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  border-radius: $radius-pill;
  border: 2px dashed $color-border;
  background: $color-background;
  color: $color-text-muted;
  font-size: 22px;
}

.avatar-picker:hover .avatar-picker-placeholder {
  border-color: $color-primary;
  color: $color-primary;
}

.avatar-picker-edit {
  position: absolute;
  right: -2px;
  bottom: -2px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: $radius-pill;
  border: 2px solid $color-surface;
  background: $color-primary;
  color: $color-surface;
  font-size: 12px;
}

.avatar-settings-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.avatar-settings-hint {
  font-size: $font-size-muted;
  margin: 0;
}

.avatar-remove-link {
  align-self: flex-start;
  border: none;
  background: none;
  padding: 0;
  color: $color-error;
  font-size: $font-size-muted;
  font-weight: 500;
  cursor: pointer;
}

.avatar-remove-link:hover {
  text-decoration: underline;
}

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

.backup-codes-list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 16px;
  margin: 0;
  background: $color-background;
  border-radius: $radius-input;
  list-style: none;
}

.backup-codes-list li {
  font-family: monospace;
  text-align: center;
  letter-spacing: 0.05em;
}

.notif-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 0;
  border-bottom: 1px solid $color-border;
}

.notif-row:last-of-type {
  border-bottom: none;
}

.notif-toggles {
  display: flex;
  gap: 16px;
}

.notif-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: $font-size-muted;
  color: $color-text-muted;
  cursor: pointer;
}
</style>
