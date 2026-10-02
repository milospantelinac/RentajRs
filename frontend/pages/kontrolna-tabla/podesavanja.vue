<template>
  <div class="profile">
    <DashboardPageHeader class="profile-header" :title="t('dashboard.settings')" />

    <!-- 380:1716 -->
    <section class="profile-card">
      <div class="profile-head">
        <h2 class="profile-title">{{ t('dashboard.avatarSettings') }}</h2>
        <p class="profile-note">{{ t('dashboard.avatarHint') }}</p>
      </div>

      <div class="profile-avatar-row">
        <img v-if="avatarPreviewUrl" :src="avatarPreviewUrl" alt="" class="profile-avatar" />
        <span v-else class="profile-avatar profile-avatar-empty">{{ avatarInitials }}</span>
        <button type="button" class="profile-pick" @click="avatarFileInput?.click()">{{ t('dashboard.avatarPickAction') }}</button>
        <button v-if="avatarPreviewUrl" type="button" class="profile-remove" @click="removeAvatar">{{ t('dashboard.avatarRemoveAction') }}</button>
      </div>

      <input ref="avatarFileInput" type="file" accept="image/*" class="d-none" @change="onAvatarFileSelected" />

      <p v-if="avatarError" class="profile-error" role="alert">{{ avatarError }}</p>
      <p v-else-if="avatarSaved" class="profile-saved" role="status">{{ t('dashboard.changesSaved') }}</p>

      <div class="profile-action">
        <button type="button" class="profile-save" :disabled="avatarSaving || (!pendingAvatarBlob && !avatarRemoveRequested)" @click="saveAvatar">
          {{ avatarSaving ? t('common.loading') : t('dashboard.saveChanges') }}
        </button>
      </div>
    </section>

    <AvatarCropModal v-if="pendingAvatarFile" :file="pendingAvatarFile" @confirm="onCropConfirm" @cancel="pendingAvatarFile = null" />

    <!-- 380:1728 -->
    <section class="profile-card">
      <div class="profile-head">
        <h2 class="profile-title">{{ t('dashboard.profileSettings') }}</h2>
      </div>

      <div class="profile-row">
        <label class="profile-field">
          <span class="profile-label">{{ t('auth.firstName') }}</span>
          <input v-model="profileForm.firstName" type="text" class="profile-input" />
        </label>
        <label class="profile-field">
          <span class="profile-label">{{ t('auth.lastName') }}</span>
          <input v-model="profileForm.lastName" type="text" class="profile-input" />
        </label>
        <label class="profile-field">
          <span class="profile-label">{{ t('auth.phone') }}</span>
          <input v-model="profileForm.phone" type="text" class="profile-input" />
        </label>
      </div>

      <p v-if="profileError" class="profile-error" role="alert">{{ profileError }}</p>
      <p v-else-if="profileSaved" class="profile-saved" role="status">{{ t('dashboard.changesSaved') }}</p>

      <div class="profile-action">
        <button type="button" class="profile-save" :disabled="profileSaving" @click="saveProfile">{{ t('dashboard.saveChanges') }}</button>
      </div>
    </section>

    <!-- 380:1747 -->
    <section class="profile-card">
      <div class="profile-head">
        <h2 class="profile-title">{{ t('dashboard.billingSettings') }}</h2>
      </div>

      <div class="profile-choice" role="radiogroup" :aria-label="t('listing.paymentMethod')">
        <span class="profile-label">{{ t('listing.paymentMethod') }}</span>
        <div class="profile-choice-row">
          <label v-for="option in buyerTypes" :key="option" class="profile-option" :class="{ 'is-selected': billingForm.buyerType === option }">
            <input v-model="billingForm.buyerType" type="radio" :value="option" class="profile-radio" />
            <span class="profile-option-text">{{ t(`dashboard.buyerType${option === 'PERSON' ? 'Person' : 'Company'}`) }}</span>
          </label>
        </div>
      </div>

      <!-- The frame draws the Fizicko lice state, where a company has nothing
           to fill in; Pravno lice keeps the three invoicing fields checkout
           asks for, in the same field style. -->
      <template v-if="billingForm.buyerType === 'COMPANY'">
        <label class="profile-field">
          <span class="profile-label">{{ t('dashboard.companyName') }}</span>
          <input v-model="billingForm.companyName" type="text" class="profile-input" autocomplete="organization" />
        </label>
        <div class="profile-row">
          <label class="profile-field">
            <span class="profile-label">{{ t('dashboard.taxId') }}</span>
            <input v-model="billingForm.taxId" type="text" class="profile-input" />
          </label>
          <label class="profile-field">
            <span class="profile-label">{{ t('dashboard.registrationNumber') }}</span>
            <input v-model="billingForm.registrationNumber" type="text" class="profile-input" />
          </label>
        </div>
      </template>

      <label class="profile-field">
        <span class="profile-label">{{ t('dashboard.bankAccount') }}</span>
        <input v-model="billingForm.bankAccount" type="text" placeholder="160-0000000000000-00" class="profile-input" />
      </label>

      <p v-if="billingError" class="profile-error" role="alert">{{ billingError }}</p>
      <p v-else-if="billingSaved" class="profile-saved" role="status">{{ t('dashboard.changesSaved') }}</p>

      <div class="profile-action">
        <button type="button" class="profile-save" :disabled="billingSaving" @click="saveBilling">{{ t('dashboard.saveChanges') }}</button>
      </div>
    </section>

    <!-- 380:1766 -->
    <section class="profile-card">
      <div class="profile-head">
        <h2 class="profile-title">{{ t('dashboard.twoFactorSettings') }}</h2>
      </div>

      <div v-if="twoFactorStep === 'status'" class="profile-state">
        <p class="profile-state-text">
          {{ auth.user?.twoFactorEnabled ? t('auth.twoFactorEnabledStatus') : t('auth.twoFactorDisabledStatus') }}
        </p>
        <button v-if="!auth.user?.twoFactorEnabled" type="button" class="profile-cta" :disabled="twoFactorLoading" @click="twoFactorStep = 'enable-password'">
          {{ t('auth.twoFactorEnableButton') }}
        </button>
        <button v-else type="button" class="profile-cta is-danger" :disabled="twoFactorLoading" @click="twoFactorStep = 'disable'">
          {{ t('auth.twoFactorDisableButton') }}
        </button>
      </div>

      <form v-else-if="twoFactorStep === 'enable-password'" class="profile-panel" @submit.prevent="startTwoFactorSetup">
        <p class="profile-panel-text">{{ t('auth.twoFactorConfirmEnablePasswordPrompt') }}</p>
        <label class="profile-field">
          <span class="profile-label">{{ t('auth.twoFactorPasswordLabel') }}</span>
          <input v-model="twoFactorPassword" type="password" class="profile-input" required />
        </label>
        <p v-if="twoFactorError" class="profile-error" role="alert">{{ twoFactorError }}</p>
        <div class="profile-action">
          <button type="submit" class="profile-cta" :disabled="twoFactorLoading">{{ t('common.continue') }}</button>
          <button type="button" class="profile-ghost" :disabled="twoFactorLoading" @click="cancelTwoFactorFlow">{{ t('common.cancel') }}</button>
        </div>
      </form>

      <form v-else-if="twoFactorStep === 'setup'" class="profile-panel" @submit.prevent="confirmTwoFactorSetup">
        <p class="profile-panel-text">{{ t('auth.twoFactorSetupInstructions') }}</p>
        <img v-if="twoFactorQrCodeDataUrl" :src="twoFactorQrCodeDataUrl" :alt="t('auth.twoFactorQrAlt')" class="profile-qr" />
        <p class="profile-panel-text">{{ t('auth.twoFactorManualEntry') }}</p>
        <p class="profile-secret">{{ twoFactorSecret }}</p>
        <label class="profile-field">
          <span class="profile-label">{{ t('auth.twoFactorCode') }}</span>
          <input v-model="twoFactorCode" type="text" inputmode="numeric" class="profile-input" required />
        </label>
        <p v-if="twoFactorError" class="profile-error" role="alert">{{ twoFactorError }}</p>
        <div class="profile-action">
          <button type="submit" class="profile-cta" :disabled="twoFactorLoading">{{ t('common.confirm') }}</button>
          <button type="button" class="profile-ghost" :disabled="twoFactorLoading" @click="cancelTwoFactorFlow">{{ t('common.cancel') }}</button>
        </div>
      </form>

      <form v-else-if="twoFactorStep === 'disable'" class="profile-panel" @submit.prevent="confirmTwoFactorDisable">
        <p class="profile-panel-text">{{ t('auth.twoFactorConfirmPasswordPrompt') }}</p>
        <label class="profile-field">
          <span class="profile-label">{{ t('auth.twoFactorPasswordLabel') }}</span>
          <input v-model="twoFactorPassword" type="password" class="profile-input" required />
        </label>
        <p v-if="twoFactorError" class="profile-error" role="alert">{{ twoFactorError }}</p>
        <div class="profile-action">
          <button type="submit" class="profile-cta is-danger" :disabled="twoFactorLoading">{{ t('auth.twoFactorDisableButton') }}</button>
          <button type="button" class="profile-ghost" :disabled="twoFactorLoading" @click="cancelTwoFactorFlow">{{ t('common.cancel') }}</button>
        </div>
      </form>

      <div v-else-if="twoFactorStep === 'backupCodes'" class="profile-panel">
        <p class="profile-panel-text">{{ t('auth.backupCodesIntro') }}</p>
        <ul class="profile-codes">
          <li v-for="backupCode in twoFactorBackupCodes" :key="backupCode">{{ backupCode }}</li>
        </ul>
        <p class="profile-panel-text">{{ t('auth.backupCodesWarning') }}</p>
        <div class="profile-action">
          <button type="button" class="profile-cta" @click="cancelTwoFactorFlow">{{ t('auth.backupCodesSavedConfirm') }}</button>
        </div>
      </div>
    </section>

    <!-- 380:1773 -->
    <section class="profile-card">
      <div class="profile-head">
        <h2 class="profile-title">{{ t('dashboard.notificationSettings') }}</h2>
        <p class="profile-note">{{ t('dashboard.notificationSettingsHint') }}</p>
      </div>

      <div class="profile-matrix">
        <div class="profile-matrix-head">
          <span class="profile-matrix-kind">{{ t('dashboard.notifTypeColumn') }}</span>
          <span class="profile-matrix-cell">{{ t('dashboard.notifChannelEmail') }}</span>
          <span class="profile-matrix-cell">{{ t('dashboard.notifChannelApp') }}</span>
        </div>
        <div v-for="cat in notificationCategories" :key="cat.key" class="profile-matrix-row">
          <span class="profile-matrix-kind">{{ t(`dashboard.notifCategory${cat.key}`) }}</span>
          <label class="profile-matrix-cell">
            <input v-model="notifPrefs[cat.key].emailEnabled" type="checkbox" class="profile-check" :aria-label="`${t(`dashboard.notifCategory${cat.key}`)} - ${t('dashboard.notifChannelEmail')}`" />
          </label>
          <label class="profile-matrix-cell">
            <input v-model="notifPrefs[cat.key].appEnabled" type="checkbox" class="profile-check" :aria-label="`${t(`dashboard.notifCategory${cat.key}`)} - ${t('dashboard.notifChannelApp')}`" />
          </label>
        </div>
      </div>

      <p v-if="notifError" class="profile-error" role="alert">{{ notifError }}</p>
      <p v-else-if="notifSaved" class="profile-saved" role="status">{{ t('dashboard.changesSaved') }}</p>

      <div class="profile-action">
        <button type="button" class="profile-save" :disabled="notifSaving" @click="saveNotificationSettings">{{ t('dashboard.saveChanges') }}</button>
      </div>
    </section>

    <!-- 380:1841 -->
    <section class="profile-card is-danger">
      <div class="profile-head">
        <h2 class="profile-title is-danger">{{ t('dashboard.deleteAccount') }}</h2>
        <p class="profile-note">{{ t('dashboard.deleteAccountWarning') }}</p>
      </div>

      <p v-if="deleteError" class="profile-error" role="alert">{{ deleteError }}</p>
      <p v-else-if="deleteRequested" class="profile-note" role="status">{{ t('dashboard.deleteAccountRequested') }}</p>

      <div class="profile-action">
        <button type="button" class="profile-delete" :disabled="deleting" @click="deleteAccount">{{ t('dashboard.deleteAccount') }}</button>
      </div>
    </section>
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

// 380:1721 draws a photo; without one the circle carries the same initials the
// header and the inbox rows use.
const avatarInitials = computed(() => {
  const letters = [auth.user?.firstName, auth.user?.lastName].map((part) => part?.trim()?.[0]).filter(Boolean)
  return letters.join('').toUpperCase()
})

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

const buyerTypes = ['PERSON', 'COMPANY']
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

const deleting = ref(false)
const deleteRequested = ref(false)
const deleteError = ref('')

// R175 (Ch.22.4): the account goes only on a confirmation from the registered
// address, so this asks for that mail and /potvrda-brisanja does the deleting.
async function deleteAccount() {
  if (!confirm(t('dashboard.deleteAccountConfirm'))) return
  deleting.value = true
  deleteRequested.value = false
  deleteError.value = ''
  try {
    await api.post('/users/me/deletion/request')
    deleteRequested.value = true
  } catch (e) {
    deleteError.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    deleting.value = false
  }
}

// R87 — the backend stores a NotificationSetting row per exact email
// template key (46 of them); grouping into a handful of categories here
// keeps the UI usable while still writing per-event rows underneath. Only
// non-critical events appear as toggleable — money/security/confirmed-
// booking emails always send (see backend CRITICAL_EMAIL_EVENTS).
const NOTIFICATION_CATEGORIES = [
  { key: 'Listings', events: ['listing_submitted_for_approval', 'listing_approved', 'listing_rejected', 'listing_category_assigned', 'listing_price_dropped'] },
  {
    key: 'Bookings',
    events: [
      'booking_requested_guest',
      'booking_requested_owner',
      'booking_request_unopened_reminder',
      'booking_rejected',
      'booking_expired',
      'booking_request_expired_guest',
      'booking_request_expired_owner',
      'booking_no_show_marked',
    ],
  },
  { key: 'Messages', events: ['new_message'] },
  { key: 'Reviews', events: ['review_invitation', 'reviews_published', 'review_reminder_7d', 'review_replied'] },
  { key: 'Subscription', events: ['subscription_activated', 'subscription_renewed', 'subscription_expiring_soon', 'subscription_expired'] },
  { key: 'Account', events: ['welcome_registration', 'data_export_ready'] },
]
const notificationCategories = NOTIFICATION_CATEGORIES
const notifPrefs = reactive(
  Object.fromEntries(NOTIFICATION_CATEGORIES.map((cat) => [cat.key, { emailEnabled: true, appEnabled: true }])),
)
const notifSaving = ref(false)
const notifSaved = ref(false)
const notifError = ref('')

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

// 380:1838 gives the whole matrix one button, so a tick only changes the local
// state and every category goes over the wire on save.
async function saveNotificationSettings() {
  notifSaving.value = true
  notifSaved.value = false
  notifError.value = ''
  try {
    for (const cat of NOTIFICATION_CATEGORIES) {
      await api.patch('/notifications/settings', {
        events: cat.events,
        emailEnabled: notifPrefs[cat.key].emailEnabled,
        appEnabled: notifPrefs[cat.key].appEnabled,
      })
    }
    notifSaved.value = true
  } catch (e) {
    notifError.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    notifSaving.value = false
  }
}

onMounted(loadNotificationSettings)

useSeoMeta({ title: t('dashboard.settings') })
</script>

<style lang="scss" scoped>
// 380:1841 draws the delete card in the same red pair Dizajn 35 uses.
$profile-danger-stroke: #f43f5e;
$profile-danger-bg: #fcd8e0;

// Dizajn 38, frame 380:1627. Six raised cards 32 apart inside the dashboard's
// own 4/8 padding, so the page needs no outer offset of its own. Every value
// here comes from the frame and stays page-scoped: its fields are 46 tall on
// the page grey without a border, not the shared 56px .form-control.
.profile {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.dash-page-header.profile-header {
  margin-bottom: 0;
}

.profile-card {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 22px 24px;
  border-radius: $radius-card;
  background: $color-surface;
  box-shadow:
    0 1px 3px rgba(97, 115, 133, 0.05),
    0 6px 20px rgba(97, 115, 133, 0.08);
}

// 380:1841
.profile-card.is-danger {
  gap: 16px;
  background: $profile-danger-bg;
  box-shadow:
    inset 0 0 0 1px $profile-danger-stroke,
    0 1px 3px rgba(97, 115, 133, 0.05),
    0 6px 20px rgba(97, 115, 133, 0.08);
}

.profile-head {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.profile-title {
  margin: 0;
  font-size: 17px;
  font-weight: 500;
  line-height: normal;
  color: $color-text;
}

.profile-title.is-danger {
  color: $color-error;
}

.profile-note {
  margin: 0;
  font-size: 13px;
  font-weight: 300;
  line-height: 20px;
  color: $color-text-muted;
}

// 380:1720
.profile-avatar-row {
  display: flex;
  align-items: center;
  gap: 18px;
}

.profile-avatar {
  flex-shrink: 0;
  width: 76px;
  height: 76px;
  border-radius: $radius-pill;
  object-fit: cover;
}

.profile-avatar-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid $color-border;
  background: $color-surface;
  color: $color-primary;
  font-size: 24px;
  font-weight: 500;
}

.profile-pick {
  flex-shrink: 0;
  padding: 11px 18px;
  border: none;
  border-radius: $radius-button;
  background: $color-surface;
  box-shadow: inset 0 0 0 1px $color-border;
  color: $color-text;
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  line-height: 16px;
  cursor: pointer;
}

.profile-pick:hover {
  box-shadow: inset 0 0 0 1px $color-primary;
  color: $color-primary;
}

.profile-remove {
  flex-shrink: 0;
  padding: 0;
  border: none;
  background: none;
  color: $color-text-muted;
  font-size: 13px;
  font-weight: 500;
  line-height: normal;
  cursor: pointer;
}

.profile-remove:hover {
  color: $color-error;
}

// 380:1731 — three equal columns, 16 apart
.profile-row {
  display: flex;
  gap: 16px;
}

.profile-row > .profile-field {
  flex: 1 1 0;
  min-width: 0;
}

.profile-field {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.profile-label {
  font-size: 13px;
  font-weight: 500;
  line-height: normal;
  color: $color-text-muted;
}

// 380:1734 — page grey, no border, 46 tall
.profile-input {
  width: 100%;
  padding: 14px 18px;
  border: none;
  border-radius: $radius-input;
  background: $color-background;
  color: $color-text;
  font-family: inherit;
  font-size: 14px;
  font-weight: 400;
  line-height: 18px;
}

.profile-input:focus {
  outline: 1.5px solid $color-primary;
  outline-offset: -1.5px;
}

.profile-input::placeholder {
  color: $color-text-muted;
}

// 380:1750
.profile-choice {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.profile-choice-row {
  display: flex;
  gap: 10px;
}

// 380:1753 — the picked option carries the blue outline, the other one draws
// nothing but its radio and label.
.profile-option {
  display: flex;
  flex: 1 1 0;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 14px 22px 14px 18px;
  border-radius: $radius-button;
  background: $color-surface;
  cursor: pointer;
}

.profile-option.is-selected {
  box-shadow: inset 0 0 0 1.5px $color-primary;
}

.profile-radio {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  margin: 0;
  border: 1.5px solid $color-border;
  border-radius: $radius-pill;
  background: $color-surface;
  appearance: none;
  cursor: pointer;
}

.profile-radio:checked {
  border: 5px solid $color-primary;
}

.profile-option-text {
  font-size: 14px;
  font-weight: 400;
  line-height: 18px;
  color: $color-text;
}

// 380:1769
.profile-state {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 18px;
  border-radius: $radius-button;
  background: $color-background;
}

.profile-state-text {
  margin: 0;
  font-size: 14px;
  font-weight: 400;
  line-height: normal;
  color: $color-text;
}

// 380:1771
.profile-cta {
  flex-shrink: 0;
  padding: 12px 20px;
  border: none;
  border-radius: $radius-button;
  background: linear-gradient(90deg, $color-gradient-start 0%, $color-primary 100%);
  color: $color-surface;
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  line-height: normal;
  cursor: pointer;
}

.profile-cta.is-danger {
  background: $color-error;
}

.profile-cta:disabled {
  opacity: 0.6;
  cursor: default;
}

.profile-ghost {
  padding: 12px 20px;
  border: 1px solid $color-border;
  border-radius: $radius-button;
  background: $color-surface;
  color: $color-text;
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  line-height: normal;
  cursor: pointer;
}

// The 2FA flows the frame's collapsed row does not draw, kept in its language.
.profile-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  border-radius: $radius-button;
  background: $color-background;
}

.profile-panel-text {
  margin: 0;
  font-size: 13px;
  font-weight: 300;
  line-height: 20px;
  color: $color-text-muted;
}

.profile-qr {
  display: block;
  width: 180px;
  height: 180px;
}

.profile-secret {
  margin: 0;
  padding: 12px;
  border-radius: $radius-button;
  background: $color-surface;
  font-family: monospace;
  text-align: center;
  letter-spacing: 0.05em;
  word-break: break-all;
}

.profile-codes {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin: 0;
  padding: 16px;
  border-radius: $radius-button;
  background: $color-surface;
  list-style: none;
}

.profile-codes li {
  font-family: monospace;
  text-align: center;
  letter-spacing: 0.05em;
}

// 380:1777
.profile-matrix {
  display: flex;
  flex-direction: column;
  border-radius: $radius-button;
  overflow: hidden;
}

.profile-matrix-head,
.profile-matrix-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.profile-matrix-head {
  padding: 12px 20px;
  background: $color-background;
}

.profile-matrix-row {
  padding: 12px 20px 13px;
  border-top: 1px solid $color-border;
}

.profile-matrix-head .profile-matrix-kind,
.profile-matrix-head .profile-matrix-cell {
  font-size: 12px;
  font-weight: 500;
  line-height: normal;
  color: $color-text-muted;
}

.profile-matrix-kind {
  flex: 1 1 0;
  min-width: 0;
  font-size: 14px;
  font-weight: 400;
  line-height: normal;
  color: $color-text;
}

.profile-matrix-cell {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  width: 150px;
}

.profile-matrix-row .profile-matrix-cell {
  cursor: pointer;
}

// 380:1785 — the same white tick the rest of the site uses
.profile-check {
  width: 18px;
  height: 18px;
  margin: 0;
  border: 1.5px solid $color-border;
  border-radius: 8px;
  background: $color-surface;
  appearance: none;
  cursor: pointer;
}

.profile-check:checked {
  border-color: $color-primary;
  background: $color-primary url('/images/icons/check-white-18.svg') center / 18px 18px no-repeat;
}

.profile-action {
  display: flex;
  align-items: center;
  gap: 12px;
}

// 380:1726
.profile-save {
  padding: 12px 22px;
  border: none;
  border-radius: $radius-button;
  background: $color-accent-tint;
  color: $color-primary;
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  line-height: normal;
  cursor: pointer;
}

.profile-save:disabled {
  opacity: 0.6;
  cursor: default;
}

// 380:1846
.profile-delete {
  padding: 12px 22px;
  border: none;
  border-radius: $radius-button;
  background: $color-surface;
  box-shadow: inset 0 0 0 1px $profile-danger-stroke;
  color: $color-error;
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  line-height: 16px;
  cursor: pointer;
}

.profile-delete:disabled {
  opacity: 0.6;
  cursor: default;
}

.profile-error {
  margin: 0;
  font-size: 13px;
  font-weight: 400;
  line-height: 20px;
  color: $color-error;
}

.profile-saved {
  margin: 0;
  font-size: 13px;
  font-weight: 400;
  line-height: 20px;
  color: $color-success;
}

@include respond-below(lg) {
  .profile-row {
    flex-direction: column;
  }

  .profile-choice-row {
    flex-direction: column;
  }

  .profile-state {
    flex-direction: column;
    align-items: flex-start;
  }
}

@include mobile-only {
  .profile-avatar-row {
    flex-wrap: wrap;
  }

  .profile-matrix-head,
  .profile-matrix-row {
    gap: 8px;
    padding-right: 12px;
    padding-left: 12px;
  }

  .profile-matrix-cell {
    width: 64px;
  }
}
</style>
