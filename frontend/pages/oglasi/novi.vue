<template>
  <div class="container wizard-start">
    <template v-if="step === 'top'">
      <h1 class="text-page-title mb-4">{{ t('listing.chooseCategory') }}</h1>
      <p v-if="error" class="form-error mb-3">{{ error }}</p>

      <div class="row">
        <div v-for="cat in categories" :key="cat.id" class="col-6 col-md-3 mb-3">
          <button class="category-tile card card-interactive" @click="selectTopCategory(cat)">
            <span class="text-body">{{ cat.slug === 'ostalo' ? t('listing.unlockYourCategory') : cat.name }}</span>
          </button>
        </div>
      </div>
    </template>

    <template v-else-if="step === 'sub'">
      <h1 class="text-page-title mb-2">{{ activeTopCategory.name }}</h1>
      <p class="text-muted mb-4">{{ t('listing.chooseSubcategory') }}</p>
      <p v-if="error" class="form-error mb-3">{{ error }}</p>

      <div class="row">
        <div v-for="sub in activeTopCategory.children" :key="sub.id" class="col-6 col-md-3 mb-3">
          <button class="category-tile card card-interactive" @click="selectLeafCategory(sub.id)">
            <span class="text-body">{{ sub.name }}</span>
          </button>
        </div>
      </div>
      <button class="btn btn-tertiary mt-2" @click="step = 'top'">← {{ t('listing.back') }}</button>
    </template>

    <template v-else-if="step === 'propose'">
      <h1 class="text-page-title mb-2">{{ t('listing.unlockYourCategory') }}</h1>
      <p class="text-muted mb-4">{{ t('listing.proposeCategoryExplain') }}</p>

      <form class="card" @submit.prevent="submitProposal">
        <div class="card-body">
          <div class="form-group mb-3">
            <label class="form-label">{{ t('listing.proposeCategoryName') }}</label>
            <input v-model="proposal.name" type="text" class="form-control" required maxlength="100" />
          </div>
          <div class="form-group mb-3">
            <label class="form-label">{{ t('listing.stepBookingModel') }}</label>
            <select v-model="proposal.bookingModel" class="form-control form-select">
              <option value="PER_STAY">{{ t('listing.bookingModelPerStay') }}</option>
              <option value="PER_SLOT">{{ t('listing.bookingModelPerSlot') }}</option>
              <option value="NO_BOOKING">{{ t('listing.bookingModelNone') }}</option>
            </select>
          </div>
          <div class="form-group mb-3">
            <label class="form-label">{{ t('listing.priceUnit') }}</label>
            <select v-model="proposal.priceUnit" class="form-control form-select">
              <option value="DAY">{{ t('listing.unitDay') }}</option>
              <option value="NIGHT">{{ t('listing.unitNight') }}</option>
              <option value="HOUR">{{ t('listing.unitHour') }}</option>
              <option value="MONTH">{{ t('listing.unitMonth') }}</option>
              <option value="SLOT">{{ t('listing.unitSlot') }}</option>
            </select>
          </div>
          <div class="form-group mb-3">
            <label class="form-label">{{ t('listing.proposeCategoryComment') }}</label>
            <textarea v-model="proposal.comment" class="form-control" rows="3" maxlength="500" />
          </div>
          <p v-if="error" class="form-error mb-3">{{ error }}</p>
          <button type="submit" class="btn btn-primary-flat" :disabled="submitting">
            {{ submitting ? t('common.loading') : t('listing.proposeCategorySubmit') }}
          </button>
          <button type="button" class="btn btn-tertiary" @click="step = 'top'">{{ t('common.cancel') }}</button>
        </div>
      </form>
    </template>
  </div>
</template>

<script setup>
definePageMeta({ middleware: 'auth' })
const { t } = useI18n()
const api = useApi()
const error = ref('')
const submitting = ref(false)
const step = ref('top')
const activeTopCategory = ref(null)

const { data: categories } = await useAsyncData('wizard-categories', () => api.get('/categories'))

const proposal = reactive({ name: '', bookingModel: 'PER_STAY', priceUnit: 'DAY', comment: '' })

function selectTopCategory(cat) {
  error.value = ''
  if (cat.slug === 'ostalo') {
    step.value = 'propose'
    return
  }
  if (cat.children?.length) {
    activeTopCategory.value = cat
    step.value = 'sub'
    return
  }
  selectLeafCategory(cat.id)
}

async function selectLeafCategory(categoryId) {
  error.value = ''
  try {
    const listing = await api.post('/listings', { categoryId })
    await navigateTo(`/oglasi/${listing.id}/uredi`)
  } catch (e) {
    error.value = extractErrorMessage(e, t('auth.genericError'))
  }
}

async function submitProposal() {
  error.value = ''
  submitting.value = true
  try {
    const other = categories.value.find((c) => c.slug === 'ostalo')
    const category = await api.post('/categories/propose', {
      parentId: other.id,
      name: proposal.name,
      bookingModel: proposal.bookingModel,
      priceUnit: proposal.priceUnit,
      comment: proposal.comment || undefined,
    })
    await selectLeafCategory(category.id)
  } catch (e) {
    error.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    submitting.value = false
  }
}

useSeoMeta({ title: t('listing.chooseCategory') })
</script>

<style lang="scss" scoped>
.wizard-start {
  padding: 40px 0;
}

.category-tile {
  width: 100%;
  padding: 24px 16px;
  text-align: center;
  cursor: pointer;
  border: 1px solid $color-border;
}

.category-tile:hover {
  border-color: $color-primary;
}
</style>
