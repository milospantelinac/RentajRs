<template>
  <!-- Administracija > Oglasi (no frame): a listing an admin added goes live
       without payment, on the package the admin picks, for a number of months
       or days or with no end, with a free featured slot if the admin wants one. -->
  <div class="admin-modal-backdrop" @click.self="close">
    <div class="admin-modal admin-card publish-dialog" role="dialog" aria-modal="true" aria-labelledby="publish-dialog-title">
      <div class="admin-card-body publish-body">
        <div>
          <p id="publish-dialog-title" class="admin-card-title">{{ t('adminListings.publishTitle') }}</p>
          <p class="admin-card-note publish-intro">{{ t('adminListings.publishIntro', { name: ownerName }) }}</p>
        </div>

        <fieldset class="publish-group">
          <legend class="form-label">{{ t('adminListings.packageLabel') }}</legend>
          <div class="publish-packages">
            <label
              v-for="pkg in packages"
              :key="pkg.id"
              class="publish-package"
              :class="{ 'is-active': packageId === pkg.id, 'is-disabled': isBlocked(pkg) }"
            >
              <input v-model="packageId" type="radio" name="publish-package" :value="pkg.id" :disabled="isBlocked(pkg)" class="visually-hidden" />
              <span class="publish-package-name">{{ pkg.key }}</span>
              <span class="publish-package-features">{{ featuresOf(pkg) }}</span>
            </label>
          </div>
          <p v-if="basicBlocked" class="admin-card-note">{{ t('billing.osnovniDisabledForOnlineBooking') }}</p>
        </fieldset>

        <fieldset class="publish-group">
          <legend class="form-label">{{ t('adminListings.durationLabel') }}</legend>
          <div class="admin-switch admin-switch-sm" role="radiogroup" :aria-label="t('adminListings.durationLabel')">
            <button
              v-for="option in UNIT_OPTIONS"
              :key="option"
              type="button"
              role="radio"
              class="admin-switch-btn"
              :class="{ 'is-active': unit === option }"
              :aria-checked="unit === option"
              @click="setUnit(option)"
            >
              {{ t(`adminListings.unit.${option}`) }}
            </button>
          </div>
          <div v-if="unit !== 'UNLIMITED'" class="publish-amount">
            <input
              v-model.number="amount"
              type="number"
              inputmode="numeric"
              min="1"
              :max="MAX_PERIOD[unit]"
              class="admin-field publish-amount-input"
              :aria-label="t(`adminListings.amountLabel.${unit}`)"
            />
            <span class="publish-amount-unit">{{ unitWord }}</span>
          </div>
          <div v-if="unit !== 'UNLIMITED'" class="publish-quick">
            <button
              v-for="quick in QUICK_PERIODS[unit]"
              :key="quick"
              type="button"
              class="publish-quick-btn"
              :class="{ 'is-active': amount === quick }"
              @click="amount = quick"
            >
              {{ t(`adminListings.quick.${unit}${srPluralCategory(quick)}`, { count: quick }) }}
            </button>
          </div>
          <p class="publish-end" :class="{ 'is-invalid': unit !== 'UNLIMITED' && !periodOk }">{{ endText }}</p>
        </fieldset>

        <label class="publish-group">
          <span class="form-label">{{ t('adminListings.featuredLabel') }}</span>
          <select v-model.number="featuredDays" class="admin-field publish-select">
            <option :value="0">{{ t('adminListings.featuredNone') }}</option>
            <option v-for="days in FEATURED_DAYS" :key="days" :value="days">{{ t('adminListings.featuredDays', { count: days }) }}</option>
          </select>
        </label>

        <label class="publish-group">
          <span class="form-label">
            {{ t('adminListings.noteLabel') }}
            <span class="publish-optional">{{ t('common.optional') }}</span>
          </span>
          <textarea v-model="note" class="form-control publish-note" maxlength="500" :placeholder="t('adminListings.notePlaceholder')" />
        </label>

        <p v-if="error" class="form-error mb-0" role="alert">{{ error }}</p>

        <div class="publish-actions">
          <button type="button" class="btn btn-primary-flat" :disabled="!canPublish || busy" @click="publish">
            {{ busy ? t('common.loading') : t('adminListings.publishConfirm') }}
          </button>
          <button type="button" class="btn btn-tertiary" :disabled="busy" @click="close">{{ t('common.cancel') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
// The template reads these constants too, which Nuxt's auto-imports do not reach.
import { FEATURED_DAYS, MAX_PERIOD, QUICK_PERIODS } from '~/utils/freePeriod'

const props = defineProps({
  listingId: { type: String, required: true },
  bookingModel: { type: String, default: '' },
  ownerName: { type: String, default: '' },
})
const emit = defineEmits(['close', 'published'])
const { t } = useI18n()
const api = useApi()

const UNIT_OPTIONS = ['MONTHS', 'DAYS', 'UNLIMITED']

const packages = ref([])
const packageId = ref('')
const unit = ref('MONTHS')
const amount = ref(1)
const featuredDays = ref(0)
const note = ref('')
const busy = ref(false)
const error = ref('')

// Ch.3 §10: Osnovni has no booking system, so not for a listing guests book online.
const bookable = computed(() => props.bookingModel && props.bookingModel !== 'NO_BOOKING')
const isBlocked = (pkg) => bookable.value && !pkg.hasBookings
const basicBlocked = computed(() => packages.value.some((pkg) => isBlocked(pkg)))

onMounted(async () => {
  try {
    packages.value = await api.get('/packages')
    // Standard is the package most listings run on; the first one that fits otherwise.
    const preferred = packages.value.find((pkg) => pkg.key === 'STANDARD' && !isBlocked(pkg))
    packageId.value = (preferred || packages.value.find((pkg) => !isBlocked(pkg)))?.id || ''
  } catch (e) {
    error.value = extractErrorMessage(e, t('auth.genericError'))
  }
})

function featuresOf(pkg) {
  const parts = []
  if (pkg.hasBookings) parts.push(t('adminListings.feature.bookings'))
  if (pkg.hasMessaging) parts.push(t('adminListings.feature.messaging'))
  if (pkg.hasReviews) parts.push(t('adminListings.feature.reviews'))
  if (pkg.hasIcal) parts.push(t('adminListings.feature.ical'))
  return parts.length ? parts.join(' · ') : t('adminListings.feature.contactOnly')
}

function setUnit(next) {
  if (next === unit.value) return
  unit.value = next
  if (next !== 'UNLIMITED') amount.value = QUICK_PERIODS[next][0]
}

const periodOk = computed(() => isValidPeriod(amount.value, unit.value))
const unitWord = computed(() => t(`adminListings.unitWord.${unit.value}${srPluralCategory(amount.value || 0)}`))
const endText = computed(() => {
  if (unit.value === 'UNLIMITED') return t('adminListings.endsNever')
  if (!periodOk.value) return t(`adminListings.amountInvalid.${unit.value}`, { max: MAX_PERIOD[unit.value] })
  return t('adminListings.endsOn', { date: formatPeriodEnd(new Date(), amount.value, unit.value) })
})
const canPublish = computed(() => !!packageId.value && (unit.value === 'UNLIMITED' || periodOk.value))

async function publish() {
  if (!canPublish.value) return
  busy.value = true
  error.value = ''
  try {
    const result = await api.post(`/admin/listings/${props.listingId}/publish`, {
      packageId: packageId.value,
      duration: unit.value,
      ...(unit.value === 'UNLIMITED' ? {} : { amount: amount.value }),
      ...(featuredDays.value ? { featuredDays: featuredDays.value } : {}),
      ...(note.value.trim() ? { note: note.value.trim() } : {}),
    })
    // Published either way; featuring may wait for a place or be refused.
    if (result?.featuredNote) alert(result.featuredNote)
    emit('published', result)
  } catch (e) {
    error.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    busy.value = false
  }
}

function close() {
  if (!busy.value) emit('close')
}
</script>

<style lang="scss" scoped>
.publish-dialog {
  max-width: 560px;
  max-height: calc(100vh - 32px);
  overflow-y: auto;
}

.publish-body {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.publish-intro {
  margin-top: 6px;
}

.publish-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  border: 0;
  min-width: 0;
}

.publish-group .form-label {
  margin-bottom: 0;
}

.publish-packages {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.publish-package {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  border: 1px solid $color-border;
  border-radius: $radius-input;
  background: $color-surface;
  cursor: pointer;
}

.publish-package:hover {
  border-color: $color-primary;
}

.publish-package.is-active {
  border-color: $color-primary;
  box-shadow: 0 0 0 3px $color-accent-tint;
}

.publish-package.is-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.publish-package:focus-within {
  border-color: $color-primary;
}

.publish-package-name {
  font-size: 14px;
  font-weight: 600;
  color: $color-text;
}

.publish-package-features {
  font-size: 12px;
  line-height: 16px;
  color: $color-text-muted;
}

.publish-amount {
  display: flex;
  align-items: center;
  gap: 10px;
}

.publish-amount-input {
  width: 110px;
}

.publish-amount-unit {
  font-size: 14px;
  color: $color-text;
}

.publish-quick {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.publish-quick-btn {
  padding: 6px 12px;
  border: 1px solid $color-border;
  border-radius: $radius-pill;
  background: $color-surface;
  font-family: $font-family-base;
  font-size: 13px;
  color: $color-text;
  cursor: pointer;
}

.publish-quick-btn:hover,
.publish-quick-btn.is-active {
  border-color: $color-primary;
  color: $color-primary;
}

.publish-end {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: $color-primary;
}

.publish-end.is-invalid {
  color: $color-error;
}

.publish-select {
  max-width: 260px;
}

.publish-optional {
  margin-left: 6px;
  font-weight: 400;
  color: $color-text-muted;
}

.publish-note {
  min-height: 80px;
  resize: vertical;
}

.publish-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

@include mobile-only {
  .publish-packages {
    grid-template-columns: 1fr;
  }
}
</style>
