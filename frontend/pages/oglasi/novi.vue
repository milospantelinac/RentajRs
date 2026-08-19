<template>
  <div class="container wizard-start">
    <template v-if="step === 'top'">
      <h1 class="text-page-title mb-4">{{ t('listing.chooseCategory') }}</h1>
      <p v-if="error" class="form-error mb-3">{{ error }}</p>

      <div class="row">
        <div v-for="cat in sortedCategories" :key="cat.id" class="col-6 col-md-3 mb-3">
          <button
            class="category-tile card card-interactive"
            :class="{ 'category-tile-propose': cat.slug === 'ostalo' }"
            @click="selectTopCategory(cat)"
          >
            <span v-if="cat.slug === 'ostalo'" class="category-tile-propose-icon" aria-hidden="true">+</span>
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

    <!-- Kategorije spec §8 — the owner doesn't pick a category or even name
         one; they describe the listing and Rentaj assigns the real category
         afterward from the moderation queue. -->
    <template v-else-if="step === 'propose'">
      <h1 class="text-page-title mb-2">{{ t('listing.unlockYourCategory') }}</h1>
      <p class="text-muted mb-4">{{ t('listing.proposeCategoryExplain') }}</p>

      <form class="card" @submit.prevent="submitUncategorized">
        <div class="card-body">
          <div class="form-group mb-3">
            <label class="form-label">{{ t('listing.title') }}</label>
            <input v-model="uncategorized.title" type="text" class="form-control" required maxlength="200" />
          </div>
          <div class="form-group mb-3">
            <label class="form-label">{{ t('listing.reservationMethod') }}</label>
            <select v-model="uncategorized.bookingModel" class="form-control form-select">
              <option value="PER_STAY">{{ t('booking.byStay') }}</option>
              <option value="PER_SLOT">{{ t('booking.bySlot') }}</option>
              <option value="NO_BOOKING">{{ t('listing.bookingModelNone') }}</option>
            </select>
          </div>
          <div v-if="uncategorized.bookingModel !== 'NO_BOOKING'" class="form-group mb-3">
            <label class="form-label">{{ t('listing.priceUnit') }}</label>
            <select v-model="uncategorized.priceUnit" class="form-control form-select">
              <template v-if="uncategorized.bookingModel === 'PER_STAY'">
                <option value="DAY">{{ t('listing.unitDay') }}</option>
                <option value="NIGHT">{{ t('listing.unitNight') }}</option>
                <option value="MONTH">{{ t('listing.unitMonth') }}</option>
              </template>
              <template v-else>
                <option value="HOUR">{{ t('listing.unitHour') }}</option>
                <option value="SLOT">{{ t('listing.unitSlot') }}</option>
              </template>
            </select>
          </div>
          <div class="form-group mb-3">
            <label class="form-label">{{ t('listing.proposeCategoryComment') }}</label>
            <textarea v-model="uncategorized.description" class="form-control" rows="3" maxlength="2000" />
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
// "Otključaj svoju kategoriju" (ostalo) je predlog, ne standardna kategorija —
// uvek se prikazuje poslednja, sa drugačijim dizajnom (vidi .category-tile-propose).
const sortedCategories = computed(() => {
  const list = categories.value || []
  return [...list.filter((c) => c.slug !== 'ostalo'), ...list.filter((c) => c.slug === 'ostalo')]
})

const uncategorized = reactive({ title: '', bookingModel: 'PER_STAY', priceUnit: 'NIGHT', description: '' })
watch(
  () => uncategorized.bookingModel,
  (val) => {
    uncategorized.priceUnit = val === 'PER_STAY' ? 'NIGHT' : val === 'PER_SLOT' ? 'HOUR' : ''
  },
)

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

async function submitUncategorized() {
  error.value = ''
  submitting.value = true
  try {
    const listing = await api.post('/listings/uncategorized', {
      title: uncategorized.title,
      bookingModel: uncategorized.bookingModel,
      priceUnit: uncategorized.bookingModel !== 'NO_BOOKING' ? uncategorized.priceUnit : undefined,
      description: uncategorized.description || undefined,
    })
    await navigateTo(`/oglasi/${listing.id}/uredi`)
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

.category-tile-propose {
  border: 1.5px dashed $color-primary;
  background: rgba($color-primary, 0.04);
}

.category-tile-propose:hover {
  background: rgba($color-primary, 0.08);
}

.category-tile-propose-icon {
  display: block;
  width: 24px;
  height: 24px;
  margin: 0 auto 8px;
  border-radius: 50%;
  background: $color-primary;
  color: $color-surface;
  font-weight: 700;
  font-size: 15px;
  line-height: 24px;
}
</style>
