<template>
  <div class="wizard-wrap">
    <div class="hero-band">
      <div class="hero-rings" aria-hidden="true">
        <span class="hero-ring hero-ring-1" />
        <span class="hero-ring hero-ring-2" />
        <span class="hero-ring hero-ring-3" />
      </div>

      <div class="hero-top">
        <div>
          <div class="eyebrow"><span class="pulse-dot" />{{ t('listing.autoSaveNotice') }}</div>
          <h1>{{ t('listing.wizardTitle') }}</h1>
          <p v-if="listing?.category?.name" class="wizard-category-name">{{ listing.category.name }}</p>
          <p>{{ t('listing.wizardStepCounter', { current: currentStep + 1, total: steps.length, label: t(steps[currentStep].labelKey) }) }}</p>
        </div>
      </div>

      <div class="stepper">
        <button
          v-for="(step, index) in steps"
          :key="step.key"
          type="button"
          class="step"
          :class="{ done: isStepDone(index), active: currentStep === index }"
          :disabled="index > maxStepReached"
          @click="currentStep = index"
        >
          <span class="step-line" />
          <span class="step-circle">{{ isStepDone(index) ? '✓' : index + 1 }}</span>
          <span class="step-label">{{ t(step.labelKey) }}</span>
        </button>
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <h2>{{ t(steps[currentStep].labelKey) }}</h2>
        <p>{{ t(steps[currentStep].descKey) }}</p>
      </div>

      <!-- Osnovni podaci -->
      <div v-if="steps[currentStep].key === 'basics'">
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

      <!-- Cena i način rezervacije -->
      <div v-else-if="steps[currentStep].key === 'pricing'">
        <div class="form-group mb-3">
          <label class="form-label">{{ t('listing.reservationMethod') }}</label>
          <select v-model="bookingChoice" class="form-control form-select">
            <option value="ONLINE">{{ onlineOptionLabel }}</option>
            <option value="NONE">{{ t('listing.bookingModelNone') }}</option>
          </select>
        </div>

        <div v-if="form.bookingModel === 'PER_SLOT'" class="form-group mb-3">
          <label class="form-label">{{ t('listing.slotCreationMethod') }}</label>
          <select v-model="form.slotSubmode" class="form-control form-select">
            <option value="WORKING_HOURS">{{ t('listing.slotSubmodeWorkingHours') }}</option>
            <option value="DEFINED_SLOTS">{{ t('listing.slotSubmodeDefined') }}</option>
          </select>
        </div>

        <template v-if="showFlatPriceFields">
          <div class="row">
            <div class="col-6">
              <div class="form-group mb-3">
                <label class="form-label">{{ t('listing.price') }} (RSD)</label>
                <input v-model.number="form.price" type="number" min="0" class="form-control" @blur="autoFillWeekendPrice" />
              </div>
            </div>
            <div class="col-6">
              <div class="form-group mb-3">
                <label class="form-label">{{ t('listing.priceUnit') }}</label>
                <select v-model="form.priceUnit" class="form-control form-select" :disabled="form.bookingModel === 'PER_SLOT'">
                  <option v-for="unit in allowedPriceUnitsForChoice" :key="unit" :value="unit">
                    {{ t(`listing.unit${unitLabel(unit)}`) }}
                  </option>
                </select>
              </div>
            </div>
          </div>

          <p v-if="form.priceUnit === 'MONTH'" class="text-muted mb-3">{{ t('listing.monthlyPricingNotice') }}</p>

          <div v-if="showWeekendPrice" class="form-group mb-3">
            <label class="form-label">{{ t('listing.weekendPrice') }} (RSD)</label>
            <input v-model.number="form.weekendPrice" type="number" min="0" class="form-control" :placeholder="String(form.price || 0)" />
            <p class="text-muted mt-1">{{ t('listing.weekendPriceHint') }}</p>
          </div>
        </template>
        <p v-else class="text-muted mb-3">{{ t('listing.definedSlotsPriceNotice') }}</p>
      </div>

      <!-- Dostupnost / termini -->
      <div v-else-if="steps[currentStep].key === 'availability'">
        <template v-if="form.bookingModel === 'PER_STAY'">
          <label class="form-label">{{ t('listing.calendarTitle') }}</label>
          <p class="text-muted mb-2">{{ t('listing.calendarHint') }}</p>
          <AvailabilityCalendar
            :listing-id="listingId"
            :base-price="form.price"
            :weekend-price="form.weekendPrice"
            :show-pricing="true"
            :mode="form.priceUnit === 'MONTH' ? 'month' : 'day'"
          />

          <div v-if="form.priceUnit !== 'MONTH'" class="form-group mt-4">
            <label class="form-label">{{ t('listing.icalSectionTitle') }}</label>
            <IcalSyncPanel v-if="listing?.status === 'ACTIVE'" :listing-id="listingId" :ical-export-token="listing?.icalExportToken" />
            <div v-else class="ical-locked">
              <span class="ical-locked-icon" aria-hidden="true">🔒</span>
              <p class="text-muted mb-0">{{ t('listing.icalLockedHint') }}</p>
            </div>
          </div>
        </template>

        <template v-else-if="form.slotSubmode === 'WORKING_HOURS'">
          <WorkingHoursEditor :listing-id="listingId" />
        </template>
        <template v-else>
          <DefinedSlotsEditor :listing-id="listingId" />
        </template>
      </div>

      <!-- Rezervaciona pravila -->
      <div v-else-if="steps[currentStep].key === 'rules'">
        <div class="row">
          <div class="col-6">
            <div class="form-group mb-3">
              <label class="form-label">{{ t(form.priceUnit === 'MONTH' ? 'listing.minDurationMonths' : 'listing.minDuration') }}</label>
              <input v-model.number="form.minDuration" type="number" min="1" class="form-control" />
            </div>
          </div>
          <div class="col-6">
            <div class="form-group mb-3">
              <label class="form-label">{{ t(form.priceUnit === 'MONTH' ? 'listing.maxDurationMonths' : 'listing.maxDuration') }}</label>
              <input v-model.number="form.maxDuration" type="number" min="1" class="form-control" />
            </div>
          </div>
        </div>
        <div class="row">
          <div class="col-6">
            <div class="form-group mb-3">
              <label class="form-label">{{ t('listing.earliestBookingHours') }}</label>
              <input v-model.number="form.earliestBookingHours" type="number" min="0" class="form-control" />
            </div>
          </div>
          <div class="col-6">
            <div class="form-group mb-3">
              <label class="form-label">{{ t('listing.maxAdvanceBookingDays') }}</label>
              <input v-model.number="form.maxAdvanceBookingDays" type="number" min="1" class="form-control" />
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
        <div v-if="listing?.category?.slug === 'vozila'" class="row">
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

      <!-- Plaćanje, obrada rezervacije i otkazivanje -->
      <div v-else-if="steps[currentStep].key === 'payment'">
        <div class="form-group mb-3">
          <label class="form-label">{{ t('listing.paymentMethod') }}</label>
          <select v-model="form.paymentMethod" class="form-control form-select" @change="onPaymentMethodChange">
            <option value="CASH">{{ t('listing.paymentCash') }}</option>
            <option value="BANK_TRANSFER">{{ t('listing.paymentBankTransfer') }}</option>
            <option value="BOTH">{{ t('listing.paymentBoth') }}</option>
          </select>
          <p class="text-muted mt-1">{{ t(`listing.paymentMethodDesc${form.paymentMethod}`) }}</p>
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
          {{ t('listing.stepPayment') }}: <NuxtLink to="/kontrolna-tabla/podesavanja">{{ t('common.edit') }} →</NuxtLink>
        </p>

        <div class="form-group mt-3">
          <label class="form-label">{{ t('listing.requestHandling') }}</label>
          <select v-model="form.requiresApproval" class="form-control form-select">
            <option :value="true">{{ t('listing.requestHandlingApproval') }}</option>
            <option :value="false" :disabled="form.paymentMethod === 'CASH'">{{ t('listing.requestHandlingInstant') }}</option>
          </select>
          <p class="text-muted mt-1">
            {{ t(form.requiresApproval ? 'listing.requestHandlingApprovalDesc' : 'listing.requestHandlingInstantDesc') }}
          </p>
          <p v-if="form.paymentMethod === 'CASH'" class="text-muted mt-1">{{ t('listing.requestHandlingCashNotice') }}</p>
        </div>

        <div class="form-group mt-3">
          <label class="form-label">{{ t('listing.cancellationTerms') }}</label>
          <select v-model="form.cancellationPolicyType" class="form-control form-select">
            <option :value="null">—</option>
            <option value="NO_CANCELLATION">{{ t('listing.cancellationNone') }}</option>
            <option value="FREE_UNTIL_DAYS">{{ t('listing.cancellationFreeUntilDays') }}</option>
            <option value="FREE_UNTIL_HOURS">{{ t('listing.cancellationFreeUntilHours') }}</option>
          </select>
          <div v-if="form.cancellationPolicyType === 'FREE_UNTIL_DAYS'" class="form-group mt-2">
            <label class="form-label">{{ t('listing.cancellationThresholdDays') }}</label>
            <input v-model.number="form.cancellationThreshold" type="number" min="1" class="form-control" />
          </div>
          <div v-if="form.cancellationPolicyType === 'FREE_UNTIL_HOURS'" class="form-group mt-2">
            <label class="form-label">{{ t('listing.cancellationThresholdHours') }}</label>
            <input v-model.number="form.cancellationThreshold" type="number" min="1" class="form-control" />
          </div>
        </div>
        <p class="text-muted mt-3">{{ t('listing.noPaymentThroughPlatformNotice') }}</p>
      </div>

      <!-- Detalji (kategorijski atributi) -->
      <div v-else-if="steps[currentStep].key === 'attributes'">
        <div v-for="attr in visibleCategoryAttributes" :key="attr.id" class="form-group mb-3">
          <label class="form-label">{{ attr.name }}<span v-if="attr.required"> *</span></label>

          <input
            v-if="attr.type === 'NUMBER'"
            v-model.number="attributeValues[attr.id].valueNumber"
            type="number"
            class="form-control"
          />
          <select
            v-else-if="attr.type === 'YEAR'"
            v-model.number="attributeValues[attr.id].valueNumber"
            class="form-control form-select"
          >
            <option :value="null">—</option>
            <option v-for="y in yearOptions" :key="y" :value="y">{{ y }}</option>
          </select>
          <input
            v-else-if="attr.type === 'TEXT'"
            v-model="attributeValues[attr.id].valueText"
            type="text"
            class="form-control"
          />
          <textarea
            v-else-if="attr.type === 'TEXTAREA'"
            v-model="attributeValues[attr.id].valueText"
            class="form-control"
            rows="3"
          />
          <div v-else-if="attr.type === 'BOOLEAN'" class="form-row-inline">
            <input v-model="attributeValues[attr.id].valueBoolean" type="checkbox" class="form-checkbox" />
          </div>
          <select v-else-if="attr.type === 'LIST'" v-model="attributeValues[attr.id].singleOption" class="form-control form-select">
            <option value="">—</option>
            <option v-for="opt in attr.options" :key="opt.id" :value="opt.id">{{ opt.name }}</option>
          </select>
          <div v-else-if="attr.type === 'MULTISELECT'" class="form-group">
            <select
              multiple
              class="form-control"
              :value="attributeValues[attr.id].valueOptionIds"
              @change="onMultiselectChange(attr.id, $event)"
            >
              <option v-for="opt in attr.options" :key="opt.id" :value="opt.id">{{ opt.name }}</option>
            </select>
          </div>
          <div v-else-if="attr.type === 'CHECKBOX_GROUP'" class="wizard-multiselect">
            <label v-for="opt in attr.options" :key="opt.id" class="form-row-inline">
              <input type="checkbox" class="form-checkbox" :value="opt.id" v-model="attributeValues[attr.id].valueOptionIds" />
              {{ opt.name }}
            </label>
          </div>
        </div>
        <p v-if="!visibleCategoryAttributes.length" class="text-muted">{{ t('listing.noAttributesForCategory') }}</p>
      </div>

      <!-- Lokacija -->
      <div v-else-if="steps[currentStep].key === 'location'">
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
          <input v-model="location.address" type="text" class="form-control" @blur="previewLocationOnMap" />
        </div>

        <div class="form-group mb-3">
          <label class="form-label">{{ t('listing.mapPinLabel') }}</label>
          <p class="text-muted mb-2">{{ t('listing.mapPinHint') }}</p>
          <LocationPickerMap
            :latitude="location.latitude"
            :longitude="location.longitude"
            @update:position="onPinDragged"
          />
        </div>

        <div class="form-group mb-3">
          <label class="form-label">{{ t('listing.googlePlaceIdLabel') }}</label>
          <p class="text-muted mb-2">{{ t('listing.googlePlaceIdHint') }}</p>
          <input v-model="location.googlePlaceId" type="text" class="form-control" placeholder="ChIJ..." />
        </div>
      </div>

      <!-- Fotografije -->
      <div v-else-if="steps[currentStep].key === 'photos'">
        <p class="text-muted mb-3">{{ t('listing.photoCountRecommendation') }}</p>
        <div
          class="dropzone"
          :class="{ 'dropzone-active': dropzoneActive }"
          @click="fileInput.click()"
          @dragover.prevent="dropzoneActive = true"
          @dragleave.prevent="dropzoneActive = false"
          @drop.prevent="onDropFiles"
        >
          <div class="dropzone-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 16V4M12 4l-4 4M12 4l4 4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /><path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="white" stroke-width="2" stroke-linecap="round" /></svg>
          </div>
          <strong>{{ t('listing.dropzoneTitle') }}</strong>
          <span>{{ t('listing.dropzoneHint') }}</span>
          <input ref="fileInput" type="file" accept="image/*" multiple class="d-none" @change="onFileInputChange" />
        </div>

        <div class="photo-grid">
          <div
            v-for="(photo, index) in photos"
            :key="photo.id"
            class="photo"
            draggable="true"
            @dragstart="onPhotoDragStart(index)"
            @dragover.prevent
            @drop.prevent="onPhotoDrop(index)"
          >
            <img :src="photo.url" :alt="photo.altText || ''" />
            <button
              class="photo-badge"
              :class="{ 'photo-badge-inactive': index !== 0 }"
              :title="index === 0 ? t('listing.coverPhotoBadge') : t('listing.setCoverPhotoHint')"
              @click.stop="setCoverPhoto(index)"
            >
              ★ {{ index === 0 ? t('listing.coverPhotoBadge') : '' }}
            </button>
            <button class="photo-remove" :aria-label="t('listing.removePhoto')" @click.stop="removePhoto(photo.id)">✕</button>
            <span class="photo-drag" aria-hidden="true">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="8" cy="6" r="1.6" fill="#334155" /><circle cx="16" cy="6" r="1.6" fill="#334155" /><circle cx="8" cy="12" r="1.6" fill="#334155" /><circle cx="16" cy="12" r="1.6" fill="#334155" /><circle cx="8" cy="18" r="1.6" fill="#334155" /><circle cx="16" cy="18" r="1.6" fill="#334155" /></svg>
            </span>
          </div>
          <div class="photo photo-add" @click="fileInput.click()">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="#0957df" stroke-width="2.2" stroke-linecap="round" /></svg>
            {{ t('listing.addMorePhotos') }}
          </div>
        </div>

        <div v-if="photos.length > 1" class="grid-hint">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" /><path d="M12 8v5M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
          {{ t('listing.setCoverPhotoHint') }}
        </div>
      </div>

      <!-- Pregled -->
      <div v-else-if="steps[currentStep].key === 'review'">
        <ul class="wizard-checklist mb-4">
          <li v-for="(ok, key) in readiness?.checklist" :key="key" :class="ok ? 'text-success' : 'text-error'">
            {{ ok ? '✓' : '✗' }} {{ t(`listing.checklist.${key}`) }}
            <NuxtLink v-if="!ok && key === 'hasPhone'" to="/kontrolna-tabla/podesavanja">{{ t('common.edit') }} →</NuxtLink>
            <!-- T33 — name the specific missing attribute(s) instead of leaving
                 the owner to guess which of the category's fields is empty. -->
            <span v-if="!ok && key === 'requiredAttributesFilled' && readiness?.missingAttributeNames?.length" class="text-muted">
              ({{ t('listing.missingAttributesPrefix') }}: {{ readiness.missingAttributeNames.join(', ') }})
            </span>
          </li>
        </ul>
        <p v-if="!readiness?.ready" class="text-muted mb-3">{{ t('listing.notReadyYet') }}</p>

        <div class="review-actions">
          <NuxtLink :to="`/oglasi/${listingId}/pregled`" class="btn btn-tertiary">{{ t('listing.previewListing') }}</NuxtLink>
          <NuxtLink v-if="!listing?.subscriptionId" to="/kontrolna-tabla/oglasi" class="btn btn-tertiary">{{ t('listing.saveAsDraft') }}</NuxtLink>
          <!-- T41 — a listing that already has a package attached (editing an
               existing/published listing) never needs to go through package
               selection again; every step already saved as the owner went,
               so "finishing" here is just a confirmation, no purchase. -->
          <button
            v-if="readiness?.ready && listing?.subscriptionId"
            class="btn btn-primary-flat"
            :disabled="finishing"
            @click="finishEditing"
          >
            {{ finishing ? t('common.loading') : t('listing.saveChanges') }}
          </button>
          <!-- T42 — a brand-new listing whose owner already has an active PRO
               subscription with a free slot attaches to it directly instead
               of detouring through a package purchase they don't need. -->
          <button
            v-else-if="readiness?.ready && freeSlotSubscription"
            class="btn btn-primary-flat"
            :disabled="finishing"
            @click="publishWithFreeSlot"
          >
            {{ finishing ? t('common.loading') : t('listing.publishWithExistingPackage') }}
          </button>
          <NuxtLink v-else-if="readiness?.ready" :to="`/oglasi/${listingId}/paket`" class="btn btn-primary-flat">
            {{ t('listing.goToPackages') }}
          </NuxtLink>
        </div>
        <p class="text-muted mt-2">{{ t('listing.draftSavedExplain') }}</p>
      </div>

      <p v-if="error" class="form-error mt-3">{{ error }}</p>

      <div class="card-footer">
        <button v-if="currentStep > 0" class="btn btn-ghost" @click="currentStep--">← {{ t('listing.back') }}</button>
        <span v-else />
        <div class="progress-text">{{ t('listing.wizardStepsProgress', { current: currentStep + 1, total: steps.length }) }}</div>
        <button v-if="currentStep < steps.length - 1" class="btn btn-primary" :disabled="saving" @click="saveCurrentStep">
          {{ saving ? t('common.loading') : t('listing.saveAndContinue') }} →
        </button>
        <span v-else />
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
const fileInput = ref(null)
const dropzoneActive = ref(false)
const draggedPhotoIndex = ref(null)
const mySubscriptions = ref([])
const finishing = ref(false)

// Declared before the steps/watchers below since watch()'s source getter
// (unlike computed()) runs eagerly at setup time — referencing `form` in
// one before this declaration is a temporal-dead-zone error, not just a
// stale-closure bug.
const form = reactive({
  bookingModel: 'PER_STAY',
  slotSubmode: null,
  title: '',
  description: '',
  videoUrl: '',
  priceUnit: 'NIGHT',
  price: 0,
  weekendPrice: null,
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
  earliestBookingHours: null,
  maxAdvanceBookingDays: null,
  cancellationPolicyType: null,
  cancellationThreshold: null,
})

// Dodavanje Oglasa spec's KONAČNI FLOW — a fixed 9-step order (basics
// first, then price+booking-method combined, then availability/rules/
// payment, which are the only steps "Bez rezervacije" ever skips), rather
// than the old free-choice bookingModel step 0 + a separate pricing step 5.
const ALL_STEPS = [
  { key: 'basics', labelKey: 'listing.stepBasics', descKey: 'listing.stepBasicsDesc' },
  { key: 'pricing', labelKey: 'listing.stepPricing', descKey: 'listing.stepPricingDesc' },
  { key: 'availability', labelKey: 'listing.stepAvailability', descKey: 'listing.stepAvailabilityDesc', skipIfNoBooking: true },
  { key: 'rules', labelKey: 'listing.stepRules', descKey: 'listing.stepRulesDesc', skipIfNoBooking: true },
  { key: 'payment', labelKey: 'listing.stepPayment', descKey: 'listing.stepPaymentDesc', skipIfNoBooking: true },
  { key: 'attributes', labelKey: 'listing.stepAttributes', descKey: 'listing.stepAttributesDesc' },
  { key: 'location', labelKey: 'listing.stepLocation', descKey: 'listing.stepLocationDesc' },
  { key: 'photos', labelKey: 'listing.stepPhotos', descKey: 'listing.stepPhotosDesc' },
  { key: 'review', labelKey: 'listing.stepReview', descKey: 'listing.stepReviewDesc' },
]
const steps = computed(() => ALL_STEPS.filter((s) => !s.skipIfNoBooking || form.bookingModel !== 'NO_BOOKING'))

// Toggling "bez rezervacije" removes 3 steps from the array — keep the user
// on a valid index instead of landing on whatever step now shares that slot.
watch(
  () => form.bookingModel,
  () => {
    nextTick(() => {
      if (currentStep.value >= steps.value.length) currentStep.value = steps.value.length - 1
    })
  },
)

// T42 — an active PRO subscription with fewer published listings than its
// listingLimit has a free slot; a brand-new listing can attach to it instead
// of buying a new package. Same condition pretplate.vue already uses for its
// "attach free" action, just reached from the create wizard this time.
const freeSlotSubscription = computed(() =>
  (mySubscriptions.value || []).find(
    (s) => s.status === 'ACTIVE' && s.package?.key === 'PRO' && (s.listings?.length || 0) < (s.package?.listingLimit || 0),
  ),
)

// Refetch readiness any time the review step becomes active — via
// save-and-advance, a tab click, or returning to an already-unlocked review
// step after fixing something elsewhere (e.g. adding a phone number) — not
// just the one path that used to call it inline in saveCurrentStep().
watch(currentStep, async (step) => {
  if (step === steps.value.length - 1) {
    readiness.value = await api.get(`/listings/${listingId}/readiness`)
  }
})

// "Način rezervacije" (Dodavanje Oglasa spec §0/§2) — the owner never picks
// PER_STAY vs PER_SLOT directly; that always comes from the category. This
// binary choice is all that's actually theirs: online (whichever model the
// category has) or no booking system at all.
const bookingChoice = ref('ONLINE')
watch(bookingChoice, (val) => {
  form.bookingModel = val === 'ONLINE' ? listing.value?.category?.defaultBookingModel || 'PER_STAY' : 'NO_BOOKING'
  if (form.bookingModel === 'PER_SLOT' && !form.slotSubmode) form.slotSubmode = 'WORKING_HOURS'
})
const onlineOptionLabel = computed(() =>
  listing.value?.category?.defaultBookingModel === 'PER_SLOT'
    ? t('listing.bookingModelPerSlot')
    : t('listing.bookingModelPerStay'),
)

// PER_SLOT never shows a free price-unit choice (always HOUR for working
// hours, SLOT for defined slots — each slot carries its own price instead).
watch(
  () => [form.bookingModel, form.slotSubmode],
  () => {
    if (form.bookingModel === 'PER_SLOT') {
      form.priceUnit = form.slotSubmode === 'DEFINED_SLOTS' ? 'SLOT' : 'HOUR'
    }
  },
)

const showFlatPriceFields = computed(() => !(form.bookingModel === 'PER_SLOT' && form.slotSubmode === 'DEFINED_SLOTS'))
const allowedPriceUnitsForChoice = computed(() => {
  if (form.bookingModel === 'PER_SLOT') return ['HOUR']
  return listing.value?.category?.allowedPriceUnits || []
})
const showWeekendPrice = computed(() => showFlatPriceFields.value && ['NIGHT', 'DAY', 'HOUR'].includes(form.priceUnit))

// "Vikend cena automatski se popunjava istom vrednošću kao obična cena"
// (Dodavanje Oglasa spec §2) — only while weekendPrice has never been set,
// so a deliberate later edit is never silently overwritten.
function autoFillWeekendPrice() {
  if (showWeekendPrice.value && (form.weekendPrice === null || form.weekendPrice === undefined)) {
    form.weekendPrice = form.price
  }
}

const currentYear = new Date().getFullYear()
const yearOptions = Array.from({ length: 60 }, (_, i) => currentYear - i)

// Kategorije spec §5 (Mašine) — an attribute conditioned on a sibling's
// selected option (e.g. "Maksimalna dubina kopanja" only when tip_masine =
// bager) only shows once that option is actually selected; new machine
// types are then just data (a new option + a few dependent attributes), no
// wizard code change needed.
const visibleCategoryAttributes = computed(() => {
  const attrs = listing.value?.category?.attributes || []
  const byKey = new Map(attrs.map((a) => [a.key, a]))
  return attrs.filter((attr) => {
    if (!attr.dependsOnAttrKey) return true
    const parent = byKey.get(attr.dependsOnAttrKey)
    if (!parent) return true
    const selected = attributeValues[parent.id]?.singleOption
    const selectedOption = parent.options?.find((o) => o.id === selected)
    return selectedOption?.key === attr.dependsOnOptionKey
  })
})

function onMultiselectChange(attributeId, event) {
  attributeValues[attributeId].valueOptionIds = Array.from(event.target.selectedOptions).map((o) => o.value)
}

const location = reactive({ regionId: '', cityId: '', cityAreaId: '', address: '', latitude: null, longitude: null, googlePlaceId: '' })

async function previewLocationOnMap() {
  const city = cities.value.find((c) => c.id === location.cityId)
  if (!location.address?.trim() || !city) return
  try {
    const coords = await api.get(`/geocoding/preview?address=${encodeURIComponent(location.address)}&city=${encodeURIComponent(city.name)}`)
    if (coords) {
      location.latitude = coords.latitude
      location.longitude = coords.longitude
    }
  } catch {
    // Preview is a convenience, not a required step — the final save still
    // auto-geocodes server-side if no pin was ever placed.
  }
}

function onPinDragged({ latitude, longitude }) {
  location.latitude = latitude
  location.longitude = longitude
}
const attributeValues = reactive({})
const hasBankAccount = computed(() => !!auth.user?.bankAccount)

const citiesInRegion = computed(() => cities.value.filter((c) => c.regionId === location.regionId))

// A step reads as "done" (checkmark, solid connecting line) once it's been
// saved and the wizard has moved past it — but not while it's the one
// currently on screen, even if the user navigated back to re-edit it.
function isStepDone(index) {
  return index < maxStepReached.value && index !== currentStep.value
}

// RNT-028 — "send QR code instantly" only makes sense for bank-transfer
// payment (the QR *is* the bank-transfer payment slip); a cash-only listing
// switching to it left a request auto-confirmed with no actual payment
// instructions ever sent.
function onPaymentMethodChange() {
  if (form.paymentMethod === 'CASH') form.requiresApproval = true
}

function unitLabel(unit) {
  return unit.charAt(0) + unit.slice(1).toLowerCase()
}

function compact(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && v !== undefined && v !== null))
}

function isAttributeValueFilled(attr, v) {
  if (attr.type === 'NUMBER' || attr.type === 'YEAR') return v.valueNumber !== null && v.valueNumber !== undefined && v.valueNumber !== ''
  if (attr.type === 'TEXT' || attr.type === 'TEXTAREA') return !!v.valueText
  if (attr.type === 'BOOLEAN') return true // false is a real answer, not an empty one
  if (attr.type === 'LIST') return !!v.singleOption
  return (v.valueOptionIds || []).length > 0 // MULTISELECT / CHECKBOX_GROUP
}

// RNT-022/023 — the wizard used to save-and-advance on every step no matter
// what was in it (or wasn't), only surfacing missing required fields as a
// checklist on the very last step. Blocking here catches it right where the
// owner can actually fix it.
function validateCurrentStep() {
  const step = steps.value[currentStep.value].key
  if (step === 'basics') {
    if (!form.title?.trim() || !form.description?.trim()) return t('listing.validationBasicsRequired')
  } else if (step === 'attributes') {
    const missingRequired = visibleCategoryAttributes.value.some(
      (attr) => attr.required && !isAttributeValueFilled(attr, attributeValues[attr.id]),
    )
    if (missingRequired) return t('listing.validationAttributesRequired')
  } else if (step === 'location') {
    if (!location.regionId || !location.cityId || !location.address?.trim()) return t('listing.validationLocationRequired')
  } else if (step === 'photos') {
    if (!photos.value.length) return t('listing.validationPhotosRequired')
  } else if (step === 'pricing') {
    if (showFlatPriceFields.value && !(Number(form.price) > 0)) return t('listing.validationPriceRequired')
  }
  return ''
}

async function loadListing() {
  listing.value = await api.get(`/listings/${listingId}`)

  // /listings/:id returns the raw category row (no resolved/inherited
  // attributes — that's TaxonomyService's job); fetch the definitions
  // separately and merge in this listing's already-saved values by id.
  if (listing.value.category?.slug) {
    const categoryDetail = await api.get(`/categories/${listing.value.category.slug}`)
    const valueByAttributeId = new Map((listing.value.attributes || []).map((v) => [v.attributeId, v]))
    listing.value.category.name = categoryDetail.name
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
    weekendPrice: listing.value.weekendPrice ? Number(listing.value.weekendPrice) : null,
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
    earliestBookingHours: listing.value.earliestBookingHours,
    maxAdvanceBookingDays: listing.value.maxAdvanceBookingDays,
    cancellationPolicyType: listing.value.cancellationPolicyType || null,
    cancellationThreshold: listing.value.cancellationThreshold,
  })
  bookingChoice.value = listing.value.bookingModel === 'NO_BOOKING' ? 'NONE' : 'ONLINE'
  // The bookingChoice watcher only fires on an actual toggle — a freshly
  // created PER_SLOT draft loads with slotSubmode still null (never set at
  // creation) and bookingChoice starting at its already-'ONLINE' default,
  // so nothing would otherwise pick WORKING_HOURS as the default submode.
  if (form.bookingModel === 'PER_SLOT' && !form.slotSubmode) form.slotSubmode = 'WORKING_HOURS'
  Object.assign(location, {
    regionId: listing.value.regionId || '',
    cityId: listing.value.cityId || '',
    cityAreaId: listing.value.cityAreaId || '',
    address: listing.value.address || '',
    latitude: listing.value.latitude !== null && listing.value.latitude !== undefined ? Number(listing.value.latitude) : null,
    longitude: listing.value.longitude !== null && listing.value.longitude !== undefined ? Number(listing.value.longitude) : null,
    googlePlaceId: listing.value.googlePlaceId || '',
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

  // RNT-032 — loadListing() only ever runs once, in onMounted; a returning
  // user opening this URL directly used to always land back on step 1 even
  // though every earlier step was already saved. Jump to the furthest
  // incomplete step instead, matching what maxStepReached unlocks below.
  const resumeStep = computeMaxStepFromListing()
  currentStep.value = resumeStep
  maxStepReached.value = Math.max(maxStepReached.value, resumeStep)
}

/**
 * A returning user opening an in-progress draft shouldn't have to redo the
 * whole wizard from step 1 to unlock where they left off — walk the steps in
 * order and stop at the first one whose data isn't saved yet, matching the
 * same order saveCurrentStep() enforces going forward.
 */
function computeMaxStepFromListing() {
  const doneByKey = {
    basics: () => !!listing.value.title && !!listing.value.description,
    pricing: () =>
      Number(listing.value.price) > 0 || (listing.value.bookingModel === 'PER_SLOT' && listing.value.slotSubmode === 'DEFINED_SLOTS'),
    availability: () => true, // scheduling itself is optional to have touched before moving on
    rules: () => true, // all optional
    payment: () => true, // all optional except CASH default, already set
    attributes: () => true, // required ones enforced by the review checklist, not gate-able from here
    location: () => !!listing.value.cityId,
    photos: () => (listing.value.photos || []).length > 0,
    review: () => true,
  }
  let reached = 0
  for (let i = 0; i < steps.value.length; i++) {
    if (!doneByKey[steps.value[i].key]()) break
    reached = i + 1
  }
  return Math.min(reached, steps.value.length - 1)
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

// R160 — a phone photo can be several MB; shrinking it in the browser first
// (matching the server's own 1920px cap in UploadsService.saveImage) means a
// twenty-photo listing doesn't choke slow mobile uploads. Falls back to the
// original file untouched for anything that isn't a decodable raster image.
const DOWNSCALE_MAX_DIMENSION = 1920
const DOWNSCALE_QUALITY = 0.85

async function downscaleImage(file) {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') return file

  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, DOWNSCALE_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
    if (scale >= 1) {
      bitmap.close?.()
      return file
    }

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext('2d')
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close?.()

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', DOWNSCALE_QUALITY))
    if (!blob) return file
    return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' })
  } catch {
    // Decoding failed (corrupt file, unsupported format) — let the backend's
    // own validation reject it with a proper error rather than failing silently here.
    return file
  }
}

async function uploadFile(rawFile) {
  const file = await downscaleImage(rawFile)
  const formData = new FormData()
  formData.append('file', file)
  const photo = await api.post(`/listings/${listingId}/photos`, formData)
  photos.value.push(photo)
}

async function onFileInputChange(evt) {
  const files = Array.from(evt.target.files || [])
  evt.target.value = ''
  for (const file of files) await uploadFile(file)
}

async function onDropFiles(evt) {
  dropzoneActive.value = false
  const files = Array.from(evt.dataTransfer?.files || []).filter((f) => f.type.startsWith('image/'))
  for (const file of files) await uploadFile(file)
}

async function removePhoto(photoId) {
  await api.delete(`/listings/${listingId}/photos/${photoId}`)
  photos.value = photos.value.filter((p) => p.id !== photoId)
}

async function persistPhotoOrder() {
  await api.patch(`/listings/${listingId}/photos/reorder`, { photoIds: photos.value.map((p) => p.id) })
}

function onPhotoDragStart(index) {
  draggedPhotoIndex.value = index
}

function onPhotoDrop(targetIndex) {
  if (draggedPhotoIndex.value === null || draggedPhotoIndex.value === targetIndex) return
  const arr = [...photos.value]
  const [moved] = arr.splice(draggedPhotoIndex.value, 1)
  arr.splice(targetIndex, 0, moved)
  photos.value = arr
  draggedPhotoIndex.value = null
  persistPhotoOrder()
}

function setCoverPhoto(index) {
  if (index === 0) return
  const arr = [...photos.value]
  const [moved] = arr.splice(index, 1)
  arr.unshift(moved)
  photos.value = arr
  persistPhotoOrder()
}

async function saveCurrentStep() {
  error.value = ''
  const validationError = validateCurrentStep()
  if (validationError) {
    error.value = validationError
    return
  }
  saving.value = true
  try {
    const step = steps.value[currentStep.value].key
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
      await api.patch(`/listings/${listingId}/location`, {
        ...location,
        cityAreaId: location.cityAreaId || undefined,
        latitude: location.latitude ?? undefined,
        longitude: location.longitude ?? undefined,
      })
    } else if (step === 'photos' || step === 'availability' || step === 'review') {
      // photos: persisted per-upload/reorder already.
      // availability: the calendar/working-hours/defined-slots components
      // save directly to their own endpoints as the owner interacts with them.
      // review: nothing to save — navigation handled by the link itself.
    } else {
      // Backend DTOs treat a field as "not provided" only when it's
      // undefined — an empty string still fails e.g. @IsUrl()/@Matches() on
      // an optional field. Strip empty strings here rather than loosening
      // those validators, so a real empty submission is still caught
      // elsewhere.
      await api.patch(`/listings/${listingId}`, compact(form))
    }

    if (currentStep.value < steps.value.length - 1) {
      currentStep.value++
      if (currentStep.value > maxStepReached.value) maxStepReached.value = currentStep.value
    }
  } catch (e) {
    error.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    saving.value = false
  }
}

// T41 — this listing already has a package attached (subscriptionId set), so
// there's nothing left to buy. Every step already persisted via
// saveCurrentStep as the owner went, so finishing is pure confirmation.
async function finishEditing() {
  await navigateTo('/kontrolna-tabla/oglasi?updated=1')
}

// T42 — attach this brand-new listing to the owner's existing PRO
// subscription's free slot instead of sending them through package
// purchase; mirrors kontrolna-tabla/pretplate.vue's attachFree().
async function publishWithFreeSlot() {
  error.value = ''
  finishing.value = true
  try {
    await api.post('/subscriptions/purchase', {
      listingId,
      existingSubscriptionId: freeSlotSubscription.value.id,
    })
    await navigateTo(`/oglasi/${listingId}/poslato`)
  } catch (e) {
    error.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    finishing.value = false
  }
}

onMounted(async () => {
  ;[regions.value, cities.value] = await Promise.all([api.get('/locations/regions'), api.get('/locations/cities')])
  api.get('/subscriptions/mine').then((subs) => { mySubscriptions.value = subs }).catch(() => {})
  await loadListing()
  if (location.cityId) {
    const city = cities.value.find((c) => c.id === location.cityId)
    if (city) cityAreas.value = await api.get(`/locations/cities/${city.slug}/areas`)
  }
})

useSeoMeta({ title: t('listing.wizardTitle') })
</script>

<style lang="scss" scoped>
.wizard-wrap {
  max-width: 1040px;
  margin: 0 auto;
  padding: 14px 20px 80px;
}

@include respond-above(md) {
  .wizard-wrap {
    padding: 14px 32px 80px;
  }
}

// ===== Hero band =====
.hero-band {
  position: relative;
  overflow: hidden;
  border-radius: 26px;
  padding: 28px 24px 56px;
  background:
    radial-gradient(ellipse 680px 560px at 38% 60%, rgba(0, 215, 255, 0.7), transparent 65%),
    radial-gradient(ellipse 520px 440px at 64% 10%, rgba(0, 195, 255, 0.4), transparent 60%),
    $gradient-marketing;
  box-shadow: 0 20px 60px -20px rgba(9, 87, 223, 0.45);
  isolation: isolate;
}

@include respond-above(md) {
  .hero-band {
    border-radius: 36px;
    padding: 36px 44px 64px;
  }
}

.hero-rings {
  position: absolute;
  top: 50%;
  right: -60px;
  transform: translateY(-50%);
  width: 380px;
  height: 380px;
  z-index: 0;
  pointer-events: none;
  display: none;
}

@include respond-above(md) {
  .hero-rings {
    display: block;
  }
}

.hero-ring {
  position: absolute;
  inset: 0;
  border-radius: $radius-pill;
  border: 1px solid rgba(255, 255, 255, 0.18);
}

.hero-ring-2 {
  inset: 55px;
}

.hero-ring-3 {
  inset: 110px;
}

.hero-top {
  position: relative;
  z-index: 1;
  margin-bottom: 24px;
}

@include respond-above(md) {
  .hero-top {
    margin-bottom: 30px;
  }
}

.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  font-size: 12.5px;
  font-weight: 700;
  color: $color-surface;
  background: rgba(255, 255, 255, 0.16);
  padding: 6px 14px 6px 10px;
  border-radius: $radius-pill;
  letter-spacing: 0.02em;
}

.wizard-category-name {
  margin-top: 10px;
  font-size: $font-size-muted;
  color: rgba(255, 255, 255, 0.75);
}

.pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: $radius-pill;
  background: #4ade80;
  position: relative;
  flex-shrink: 0;
}

.pulse-dot::before {
  content: '';
  position: absolute;
  inset: -4px;
  border-radius: $radius-pill;
  background: #4ade80;
  opacity: 0.45;
  animation: wizard-pulse 1.8s ease-out infinite;
}

@keyframes wizard-pulse {
  0% {
    transform: scale(0.6);
    opacity: 0.5;
  }
  100% {
    transform: scale(1.9);
    opacity: 0;
  }
}

.hero-top h1 {
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.02em;
  margin: 14px 0 6px;
  color: $color-surface;
}

@include respond-above(md) {
  .hero-top h1 {
    font-size: 28px;
  }
}

.hero-top p {
  font-size: 14.5px;
  color: rgba(255, 255, 255, 0.82);
  margin: 0;
  max-width: 480px;
  line-height: 1.5;
}

// ===== Stepper =====
.stepper {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  row-gap: 20px;
  background: none;
  border: none;
  padding: 0;
}

.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  min-width: 33%;
  position: relative;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
}

@include respond-above(md) {
  .step {
    min-width: 78px;
  }
}

.step:disabled {
  cursor: not-allowed;
}

.step-line {
  position: absolute;
  top: 16px;
  left: calc(-50% + 16px);
  width: calc(100% - 32px);
  height: 2px;
  background: rgba(255, 255, 255, 0.28);
  z-index: 0;
}

.step:first-child .step-line {
  display: none;
}

.step.done .step-line {
  background: rgba(255, 255, 255, 0.85);
}

.step-circle {
  width: 32px;
  height: 32px;
  border-radius: $radius-pill;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12.5px;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.14);
  border: 1.5px solid rgba(255, 255, 255, 0.4);
  color: rgba(255, 255, 255, 0.75);
  z-index: 1;
  position: relative;
}

.step.done .step-circle {
  background: $color-surface;
  border-color: $color-surface;
  color: $color-primary;
}

.step.active .step-circle {
  background: $color-surface;
  border-color: $color-surface;
  color: $color-primary;
  box-shadow: 0 0 0 5px rgba(255, 255, 255, 0.22);
}

.step-label {
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.7);
  margin-top: 8px;
  text-align: center;
  line-height: 1.25;
  max-width: 82px;
}

.step.active .step-label {
  color: $color-surface;
}

// ===== Card =====
.card {
  position: relative;
  z-index: 2;
  background: $color-surface;
  border-radius: $radius-card;
  box-shadow: 0 24px 48px -16px rgba(9, 45, 120, 0.28), 0 2px 6px rgba(16, 29, 61, 0.06);
  padding: 26px;
  border: 1px solid $color-border;
  margin: -30px 8px 0;
}

@include respond-above(md) {
  .card {
    border-radius: 28px;
    padding: 40px;
    margin: -40px 20px 0;
  }
}

.card-head {
  margin-bottom: 26px;
}

.card-head h2 {
  font-size: 21px;
  font-weight: 800;
  margin: 0 0 6px;
  letter-spacing: -0.01em;
  color: $color-text;
}

.card-head p {
  font-size: 14px;
  color: $color-text-muted;
  margin: 0;
  line-height: 1.5;
}

// ===== Dropzone =====
.dropzone {
  border: 2px dashed #c9d4ee;
  border-radius: $radius-card;
  background: #fafbff;
  padding: 38px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
  margin-bottom: 28px;
}

.dropzone:hover,
.dropzone-active {
  border-color: $color-primary;
  background: #f2f6ff;
}

.dropzone-icon {
  width: 52px;
  height: 52px;
  border-radius: 16px;
  background: $gradient-marketing;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 14px;
  box-shadow: 0 10px 20px -8px rgba(9, 87, 223, 0.5);
}

.dropzone strong {
  font-size: 15px;
  font-weight: 700;
  margin-bottom: 4px;
  display: block;
}

.dropzone span {
  font-size: 13px;
  color: $color-text-muted;
}

// ===== Photo grid =====
.photo-grid {
  display: flex;
  flex-wrap: wrap;
  margin: 0 -8px 14px;
}

.photo {
  position: relative;
  border-radius: $radius-input;
  overflow: hidden;
  height: 150px;
  background: #eef1f7;
  border: 1px solid $color-border;
  cursor: grab;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  width: calc(50% - 16px);
  margin: 0 8px 16px;
}

@include respond-above(sm) {
  .photo {
    width: calc(25% - 16px);
  }
}

.photo:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 24px -10px rgba(16, 29, 61, 0.25);
}

.photo img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.photo-badge {
  position: absolute;
  top: 8px;
  left: 8px;
  background: $color-primary;
  color: $color-surface;
  font-size: 10.5px;
  font-weight: 700;
  padding: 4px 9px;
  border-radius: $radius-pill;
  display: flex;
  align-items: center;
  gap: 4px;
  box-shadow: 0 4px 10px -2px rgba(9, 87, 223, 0.5);
  border: none;
  cursor: pointer;
}

.photo-badge-inactive {
  background: rgba(15, 23, 42, 0.45);
  opacity: 0;
  transition: opacity 0.15s ease;
}

.photo:hover .photo-badge-inactive {
  opacity: 1;
}

.photo-remove {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  border-radius: $radius-pill;
  background: rgba(15, 23, 42, 0.55);
  color: $color-surface;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  opacity: 0;
  transition: opacity 0.15s ease;
  cursor: pointer;
}

.photo:hover .photo-remove {
  opacity: 1;
}

.photo-drag {
  position: absolute;
  bottom: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.photo:hover .photo-drag {
  opacity: 1;
}

.photo-add {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1.5px dashed #c9d4ee;
  background: #fafbff;
  color: $color-primary;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.photo-add:hover {
  background: #f2f6ff;
  border-color: $color-primary;
}

.grid-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  color: $color-text-muted;
  margin-bottom: 12px;
}

.grid-hint svg {
  flex-shrink: 0;
  color: $color-primary;
}

// ===== Footer nav =====
.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid $color-border;
  gap: 12px;
}

.progress-text {
  font-size: 13px;
  color: $color-text-muted;
  font-weight: 500;
  white-space: nowrap;
}

.btn-ghost {
  background: transparent;
  color: $color-text-muted;
  border: none;
  padding: 11px 12px;
  border-radius: $radius-button;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.btn-ghost:hover {
  color: $color-text;
}

.btn-primary {
  background: $gradient-marketing;
  color: $color-surface;
  border: none;
  padding: 11px 22px;
  border-radius: $radius-button;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 10px 22px -8px rgba(9, 87, 223, 0.55);
  transition: box-shadow 0.15s ease;
}

.btn-primary:hover:not(:disabled) {
  box-shadow: 0 14px 26px -8px rgba(9, 87, 223, 0.65);
}

.btn-primary:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

/* T29 — a 20-30+ item checkbox list (Sadržaji/Oprema/Priključci) in one
   vertical column made the step needlessly tall; auto-fill columns instead,
   collapsing to a single column on narrow viewports on their own. */
.wizard-multiselect {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 6px 16px;
}

.wizard-checklist {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.review-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.ical-locked {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border: 1.5px dashed $color-border;
  border-radius: $radius-input;
  background: $color-background;
}

.ical-locked-icon {
  font-size: 18px;
  flex-shrink: 0;
}
</style>
