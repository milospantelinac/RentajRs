<template>
  <div class="container wizard-page">
    <h1 class="text-page-title mb-2">{{ t('listing.wizardTitle') }}</h1>
    <p class="text-muted mb-4">{{ listing?.category?.name }}</p>

    <div class="wizard-steps mb-4">
      <button
        v-for="(step, index) in steps"
        :key="step.key"
        class="wizard-step-tab"
        :class="{ 'wizard-step-tab-active': currentStep === index, 'wizard-step-tab-disabled': index > maxStepReached }"
        :disabled="index > maxStepReached"
        @click="currentStep = index"
      >
        {{ index + 1 }}. {{ t(step.labelKey) }}
      </button>
    </div>

    <div class="card">
      <div class="card-body">
        <!-- Step 0: booking model -->
        <div v-if="currentStep === 0">
          <div class="form-group mb-3">
            <label class="form-label">{{ t('listing.stepBookingModel') }}</label>
            <select v-model="form.bookingModel" class="form-control form-select">
              <option value="PER_STAY">{{ t('listing.bookingModelPerStay') }}</option>
              <option value="PER_SLOT">{{ t('listing.bookingModelPerSlot') }}</option>
              <option value="NO_BOOKING">{{ t('listing.bookingModelNone') }}</option>
            </select>
          </div>
          <div v-if="form.bookingModel === 'PER_SLOT'" class="form-group mb-3">
            <select v-model="form.slotSubmode" class="form-control form-select">
              <option value="DEFINED_SLOTS">{{ t('listing.slotSubmodeDefined') }}</option>
              <option value="WORKING_HOURS">{{ t('listing.slotSubmodeWorkingHours') }}</option>
            </select>
          </div>
        </div>

        <!-- Step 1: basics -->
        <div v-else-if="currentStep === 1">
          <div class="form-group mb-3">
            <label class="form-label">{{ t('listing.title') }}</label>
            <input v-model="form.title" type="text" class="form-control" maxlength="200" />
          </div>
          <div class="form-group mb-3">
            <label class="form-label">{{ t('listing.description') }}</label>
            <textarea v-model="form.description" class="form-control" rows="6" maxlength="5000" />
          </div>
          <div class="form-group mb-3">
            <label class="form-label">{{ t('listing.videoUrl') }}</label>
            <input v-model="form.videoUrl" type="text" class="form-control" placeholder="https://youtube.com/..." />
          </div>
        </div>

        <!-- Step 2: category attributes -->
        <div v-else-if="currentStep === 2">
          <div v-for="attr in listing?.category?.attributes || []" :key="attr.id" class="form-group mb-3">
            <label class="form-label">{{ attr.name }}<span v-if="attr.required"> *</span></label>

            <input
              v-if="attr.type === 'NUMBER'"
              v-model.number="attributeValues[attr.id].valueNumber"
              type="number"
              class="form-control"
            />
            <input
              v-else-if="attr.type === 'TEXT'"
              v-model="attributeValues[attr.id].valueText"
              type="text"
              class="form-control"
            />
            <div v-else-if="attr.type === 'BOOLEAN'" class="form-row-inline">
              <input v-model="attributeValues[attr.id].valueBoolean" type="checkbox" class="form-checkbox" />
            </div>
            <select v-else-if="attr.type === 'LIST'" v-model="attributeValues[attr.id].singleOption" class="form-control form-select">
              <option value="">—</option>
              <option v-for="opt in attr.options" :key="opt.id" :value="opt.id">{{ opt.name }}</option>
            </select>
            <div v-else-if="attr.type === 'MULTISELECT'" class="wizard-multiselect">
              <label v-for="opt in attr.options" :key="opt.id" class="form-row-inline">
                <input type="checkbox" class="form-checkbox" :value="opt.id" v-model="attributeValues[attr.id].valueOptionIds" />
                {{ opt.name }}
              </label>
            </div>
          </div>
        </div>

        <!-- Step 3: location -->
        <div v-else-if="currentStep === 3">
          <div class="form-group mb-3">
            <label class="form-label">{{ t('listing.region') }}</label>
            <select v-model="location.regionId" class="form-control form-select" @change="onRegionChange">
              <option value="">—</option>
              <option v-for="r in regions" :key="r.id" :value="r.id">{{ r.name }}</option>
            </select>
          </div>
          <div class="form-group mb-3">
            <label class="form-label">{{ t('listing.city') }}</label>
            <select v-model="location.cityId" class="form-control form-select" @change="onCityChange">
              <option value="">—</option>
              <option v-for="c in citiesInRegion" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </div>
          <div v-if="cityAreas.length" class="form-group mb-3">
            <label class="form-label">{{ t('listing.cityArea') }}</label>
            <select v-model="location.cityAreaId" class="form-control form-select">
              <option value="">—</option>
              <option v-for="a in cityAreas" :key="a.id" :value="a.id">{{ a.name }}</option>
            </select>
          </div>
          <div class="form-group mb-3">
            <label class="form-label">{{ t('listing.address') }}</label>
            <input v-model="location.address" type="text" class="form-control" />
          </div>
        </div>

        <!-- Step 4: photos -->
        <div v-else-if="currentStep === 4">
          <div class="row mb-3">
            <div v-for="photo in photos" :key="photo.id" class="col-6 col-md-3 mb-3">
              <div class="wizard-photo">
                <img :src="photo.url" :alt="photo.altText || ''" />
                <button class="btn btn-danger btn-sm wizard-photo-remove" @click="removePhoto(photo.id)">
                  {{ t('listing.removePhoto') }}
                </button>
              </div>
            </div>
          </div>
          <label class="btn btn-tertiary">
            {{ t('listing.addPhoto') }}
            <input type="file" accept="image/*" class="d-none" @change="uploadPhoto" />
          </label>
        </div>

        <!-- Step 5: pricing -->
        <div v-else-if="currentStep === 5">
          <div class="row">
            <div class="col-6">
              <div class="form-group mb-3">
                <label class="form-label">{{ t('listing.price') }} (RSD)</label>
                <input v-model.number="form.price" type="number" min="0" class="form-control" />
              </div>
            </div>
            <div class="col-6">
              <div class="form-group mb-3">
                <label class="form-label">{{ t('listing.priceUnit') }}</label>
                <select v-model="form.priceUnit" class="form-control form-select">
                  <option v-for="unit in listing?.category?.allowedPriceUnits || []" :key="unit" :value="unit">
                    {{ t(`listing.unit${unitLabel(unit)}`) }}
                  </option>
                </select>
              </div>
            </div>
          </div>

          <div class="form-group mb-3">
            <label class="form-label">{{ t('listing.paymentMethod') }}</label>
            <select v-model="form.paymentMethod" class="form-control form-select">
              <option value="CASH">{{ t('listing.paymentCash') }}</option>
              <option value="BANK_TRANSFER">{{ t('listing.paymentBankTransfer') }}</option>
              <option value="BOTH">{{ t('listing.paymentBoth') }}</option>
            </select>
          </div>

          <div v-if="form.paymentMethod !== 'CASH'" class="row">
            <div class="col-6">
              <div class="form-group mb-3">
                <label class="form-label">{{ t('listing.advancePercent') }}</label>
                <input v-model.number="form.advancePercent" type="number" min="1" max="100" class="form-control" />
              </div>
            </div>
            <div class="col-6">
              <div class="form-group mb-3">
                <label class="form-label">{{ t('listing.paymentDeadlineHours') }}</label>
                <input v-model.number="form.paymentDeadlineHours" type="number" min="12" max="168" class="form-control" />
              </div>
            </div>
          </div>
          <p v-if="form.paymentMethod !== 'CASH' && !hasBankAccount" class="form-error">
            {{ t('listing.stepPricing') }}: <NuxtLink to="/kontrolna-tabla/podesavanja">{{ t('common.edit') }} →</NuxtLink>
          </p>

          <div v-if="listing?.bookingModel !== 'NO_BOOKING'" class="form-group mt-3">
            <label class="form-label">{{ t('listing.requestHandling') }}</label>
            <select v-model="form.requiresApproval" class="form-control form-select">
              <option :value="true">{{ t('listing.requestHandlingApproval') }}</option>
              <option :value="false">{{ t('listing.requestHandlingInstant') }}</option>
            </select>
          </div>
        </div>

        <!-- Step 6: availability rules -->
        <div v-else-if="currentStep === 6">
          <div class="row">
            <div class="col-6">
              <div class="form-group mb-3">
                <label class="form-label">{{ t('listing.minDuration') }}</label>
                <input v-model.number="form.minDuration" type="number" min="1" class="form-control" />
              </div>
            </div>
            <div class="col-6">
              <div class="form-group mb-3">
                <label class="form-label">{{ t('listing.maxDuration') }}</label>
                <input v-model.number="form.maxDuration" type="number" min="1" class="form-control" />
              </div>
            </div>
          </div>
          <div class="row">
            <div class="col-6">
              <div class="form-group mb-3">
                <label class="form-label">{{ t('listing.minGuests') }}</label>
                <input v-model.number="form.minGuests" type="number" min="1" class="form-control" />
              </div>
            </div>
            <div class="col-6">
              <div class="form-group mb-3">
                <label class="form-label">{{ t('listing.maxGuests') }}</label>
                <input v-model.number="form.maxGuests" type="number" min="1" class="form-control" />
              </div>
            </div>
          </div>
          <div class="form-group mb-3">
            <label class="form-label">{{ t('listing.gapAfterMinutes') }}</label>
            <input v-model.number="form.gapAfterMinutes" type="number" min="0" class="form-control" />
          </div>
          <div class="row">
            <div class="col-6">
              <div class="form-group mb-3">
                <label class="form-label">{{ t('listing.pickupTime') }}</label>
                <input v-model="form.pickupTime" type="time" class="form-control" />
              </div>
            </div>
            <div class="col-6">
              <div class="form-group mb-3">
                <label class="form-label">{{ t('listing.returnTime') }}</label>
                <input v-model="form.returnTime" type="time" class="form-control" />
              </div>
            </div>
          </div>
        </div>

        <!-- Step 7: cancellation -->
        <div v-else-if="currentStep === 7">
          <div class="form-group mb-3">
            <label class="form-label">{{ t('listing.cancellationTerms') }}</label>
            <textarea v-model="form.cancellationTerms" class="form-control" rows="5" maxlength="3000" />
          </div>
        </div>

        <!-- Step 8: review -->
        <div v-else-if="currentStep === 8">
          <ul class="wizard-checklist mb-4">
            <li v-for="(ok, key) in readiness?.checklist" :key="key" :class="ok ? 'text-success' : 'text-error'">
              {{ ok ? '✓' : '✗' }} {{ t(`listing.checklist.${key}`) }}
              <NuxtLink v-if="!ok && key === 'hasPhone'" to="/kontrolna-tabla/podesavanja">{{ t('common.edit') }} →</NuxtLink>
            </li>
          </ul>
          <p v-if="!readiness?.ready" class="text-muted mb-3">{{ t('listing.notReadyYet') }}</p>
          <NuxtLink v-else :to="`/oglasi/${listingId}/paket`" class="btn btn-primary-flat">
            {{ t('listing.goToPackages') }}
          </NuxtLink>
        </div>

        <p v-if="error" class="form-error mt-3">{{ error }}</p>

        <div class="wizard-actions mt-4">
          <button v-if="currentStep > 0" class="btn btn-tertiary" @click="currentStep--">{{ t('listing.back') }}</button>
          <button class="btn btn-primary-flat" :disabled="saving" @click="saveCurrentStep">
            {{ saving ? t('common.loading') : t('listing.saveAndContinue') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ middleware: 'auth' })
const { t } = useI18n()
const api = useApi()
const route = useRoute()
const auth = useAuthStore()

const listingId = route.params.id
const currentStep = ref(0)
// How far the user is *allowed* to jump ahead — steps beyond this are
// disabled tabs. Advances automatically as each step saves successfully;
// never decreases, so a completed step stays reachable for editing even
// after moving on.
const maxStepReached = ref(0)
const saving = ref(false)
const error = ref('')
const listing = ref(null)
const readiness = ref(null)
const photos = ref([])
const regions = ref([])
const cities = ref([])
const cityAreas = ref([])

// Refetch readiness any time the review step becomes active — via
// save-and-advance, a tab click, or returning to an already-unlocked review
// step after fixing something elsewhere (e.g. adding a phone number) — not
// just the one path that used to call it inline in saveCurrentStep().
watch(currentStep, async (step) => {
  if (step === steps.length - 1) {
    readiness.value = await api.get(`/listings/${listingId}/readiness`)
  }
})

const steps = [
  { key: 'bookingModel', labelKey: 'listing.stepBookingModel' },
  { key: 'basics', labelKey: 'listing.stepBasics' },
  { key: 'attributes', labelKey: 'listing.stepAttributes' },
  { key: 'location', labelKey: 'listing.stepLocation' },
  { key: 'photos', labelKey: 'listing.stepPhotos' },
  { key: 'pricing', labelKey: 'listing.stepPricing' },
  { key: 'availability', labelKey: 'listing.stepAvailability' },
  { key: 'cancellation', labelKey: 'listing.stepCancellation' },
  { key: 'review', labelKey: 'listing.stepReview' },
]

const form = reactive({
  bookingModel: 'PER_STAY',
  slotSubmode: null,
  title: '',
  description: '',
  videoUrl: '',
  priceUnit: 'NIGHT',
  price: 0,
  paymentMethod: 'CASH',
  requiresApproval: true,
  advancePercent: null,
  paymentDeadlineHours: 48,
  minDuration: null,
  maxDuration: null,
  minGuests: null,
  maxGuests: null,
  gapAfterMinutes: null,
  pickupTime: '',
  returnTime: '',
  cancellationTerms: '',
})

const location = reactive({ regionId: '', cityId: '', cityAreaId: '', address: '' })
const attributeValues = reactive({})
const hasBankAccount = computed(() => !!auth.user?.bankAccount)

const citiesInRegion = computed(() => cities.value.filter((c) => c.regionId === location.regionId))

function unitLabel(unit) {
  return unit.charAt(0) + unit.slice(1).toLowerCase()
}

function compact(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && v !== undefined))
}

async function loadListing() {
  listing.value = await api.get(`/listings/${listingId}`)

  // /listings/:id returns the raw category row (no resolved/inherited
  // attributes — that's TaxonomyService's job); fetch the definitions
  // separately and merge in this listing's already-saved values by id.
  if (listing.value.category?.slug) {
    const categoryDetail = await api.get(`/categories/${listing.value.category.slug}`)
    const valueByAttributeId = new Map((listing.value.attributes || []).map((v) => [v.attributeId, v]))
    listing.value.category.attributes = categoryDetail.attributes.map((attr) => ({
      ...attr,
      value: valueByAttributeId.get(attr.id) || null,
    }))
  }

  Object.assign(form, {
    bookingModel: listing.value.bookingModel,
    slotSubmode: listing.value.slotSubmode,
    title: listing.value.title,
    description: listing.value.description,
    videoUrl: listing.value.videoUrl || '',
    priceUnit: listing.value.priceUnit,
    price: listing.value.price || 0,
    paymentMethod: listing.value.paymentMethod || 'CASH',
    requiresApproval: listing.value.requiresApproval ?? true,
    advancePercent: listing.value.advancePercent,
    paymentDeadlineHours: listing.value.paymentDeadlineHours || 48,
    minDuration: listing.value.minDuration,
    maxDuration: listing.value.maxDuration,
    minGuests: listing.value.minGuests,
    maxGuests: listing.value.maxGuests,
    gapAfterMinutes: listing.value.gapAfterMinutes,
    pickupTime: listing.value.pickupTime || '',
    returnTime: listing.value.returnTime || '',
    cancellationTerms: listing.value.cancellationTerms || '',
  })
  Object.assign(location, {
    regionId: listing.value.regionId || '',
    cityId: listing.value.cityId || '',
    cityAreaId: listing.value.cityAreaId || '',
    address: listing.value.address || '',
  })
  photos.value = listing.value.photos || []

  for (const attr of listing.value.category?.attributes || []) {
    attributeValues[attr.id] = {
      valueNumber: attr.value?.valueNumber ?? null,
      valueText: attr.value?.valueText ?? '',
      valueBoolean: attr.value?.valueBoolean ?? false,
      valueOptionIds: attr.value?.valueOptionIds ?? [],
      singleOption: attr.value?.valueOptionIds?.[0] ?? '',
    }
  }

  maxStepReached.value = Math.max(maxStepReached.value, computeMaxStepFromListing())
}

/**
 * A returning user opening an in-progress draft shouldn't have to redo the
 * whole wizard from step 1 to unlock where they left off — walk the steps in
 * order and stop at the first one whose data isn't saved yet, matching the
 * same order saveCurrentStep() enforces going forward.
 */
function computeMaxStepFromListing() {
  const stepIsDone = [
    () => true, // booking model always has a value (defaulted on creation)
    () => !!listing.value.title && !!listing.value.description, // basics
    () => true, // attributes — required ones are enforced by the review checklist, not gate-able from here
    () => !!listing.value.cityId, // location
    () => (listing.value.photos || []).length > 0, // photos
    () => Number(listing.value.price) > 0, // pricing
    () => true, // availability rules are all optional
    () => true, // cancellation terms are optional
  ]
  let reached = 0
  for (let i = 0; i < stepIsDone.length; i++) {
    if (!stepIsDone[i]()) break
    reached = i + 1
  }
  return Math.min(reached, steps.length - 1)
}

async function onRegionChange() {
  location.cityId = ''
  location.cityAreaId = ''
  cityAreas.value = []
}

async function onCityChange() {
  location.cityAreaId = ''
  const city = cities.value.find((c) => c.id === location.cityId)
  cityAreas.value = city ? await api.get(`/locations/cities/${city.slug}/areas`) : []
}

async function uploadPhoto(evt) {
  const file = evt.target.files[0]
  if (!file) return
  const formData = new FormData()
  formData.append('file', file)
  const photo = await api.post(`/listings/${listingId}/photos`, formData)
  photos.value.push(photo)
}

async function removePhoto(photoId) {
  await api.delete(`/listings/${listingId}/photos/${photoId}`)
  photos.value = photos.value.filter((p) => p.id !== photoId)
}

async function saveCurrentStep() {
  error.value = ''
  saving.value = true
  try {
    const step = steps[currentStep.value].key
    if (step === 'attributes') {
      const values = Object.entries(attributeValues).map(([attributeId, v]) => ({
        attributeId,
        valueNumber: v.valueNumber,
        valueText: v.valueText,
        valueBoolean: v.valueBoolean,
        valueOptionIds: v.singleOption ? [v.singleOption] : v.valueOptionIds,
      }))
      await api.post(`/listings/${listingId}/attributes`, { values })
    } else if (step === 'location') {
      await api.patch(`/listings/${listingId}/location`, { ...location, cityAreaId: location.cityAreaId || undefined })
    } else if (step === 'photos') {
      // photos already persisted per-upload
    } else if (step === 'review') {
      // nothing to save — navigation handled by the link itself
    } else {
      // Backend DTOs treat a field as "not provided" only when it's
      // undefined — an empty string still fails e.g. @IsUrl()/@Matches() on
      // an optional field. Strip empty strings here rather than loosening
      // those validators, so a real empty submission is still caught
      // elsewhere.
      await api.patch(`/listings/${listingId}`, compact(form))
    }

    if (currentStep.value < steps.length - 1) {
      currentStep.value++
      if (currentStep.value > maxStepReached.value) maxStepReached.value = currentStep.value
    }
  } catch (e) {
    error.value = e?.data?.message?.[0] || e?.data?.message || t('auth.genericError')
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  ;[regions.value, cities.value] = await Promise.all([api.get('/locations/regions'), api.get('/locations/cities')])
  await loadListing()
  if (location.cityId) {
    const city = cities.value.find((c) => c.id === location.cityId)
    if (city) cityAreas.value = await api.get(`/locations/cities/${city.slug}/areas`)
  }
})

useSeoMeta({ title: t('listing.wizardTitle') })
</script>

<style lang="scss" scoped>
.wizard-page {
  padding: 32px 0 64px;
}

.wizard-steps {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  overflow-x: auto;
}

.wizard-step-tab {
  padding: 8px 12px;
  border-radius: $radius-button;
  border: 1px solid $color-border;
  background: $color-surface;
  font-size: $font-size-muted;
  color: $color-text-muted;
  white-space: nowrap;
  cursor: pointer;
}

.wizard-step-tab-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.wizard-step-tab-active {
  border-color: $color-primary;
  color: $color-primary;
  font-weight: 600;
}

.wizard-actions {
  display: flex;
  justify-content: space-between;
}

.wizard-photo {
  position: relative;
  border-radius: $radius-input;
  overflow: hidden;
  border: 1px solid $color-border;
}

.wizard-photo img {
  width: 100%;
  height: 120px;
  object-fit: cover;
}

.wizard-photo-remove {
  position: absolute;
  bottom: 6px;
  right: 6px;
}

.wizard-multiselect {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.wizard-checklist {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
</style>
