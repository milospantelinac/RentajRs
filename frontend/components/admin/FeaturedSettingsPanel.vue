<template>
  <div>
    <StateBlock v-if="failed" card error icon="settings" :title="t('admin.loadErrorTitle')" :text="t('admin.loadErrorText')">
      <button type="button" class="state-block-action" @click="load">{{ t('errorPage.tryAgain') }}</button>
    </StateBlock>

    <template v-else-if="rules">
      <!-- The rules of featuring: how many show where, the limits, the length. -->
      <form class="admin-card feat-card" @submit.prevent="saveRules">
        <div class="admin-card-body feat-form">
          <div>
            <p class="admin-card-title">{{ t('admin.featured.settings.rulesTitle') }}</p>
            <p class="admin-card-note">{{ t('admin.featured.settings.rulesNote') }}</p>
          </div>

          <label class="admin-check-row">
            <input v-model="rules.enabled" type="checkbox" class="admin-check" />
            {{ t('admin.featured.settings.enabled') }}
          </label>
          <p class="admin-card-note feat-under-check">{{ t('admin.featured.settings.enabledHint') }}</p>

          <div class="feat-grid">
            <div v-for="field in NUMBER_FIELDS" :key="field.key" class="form-group">
              <label class="form-label" :for="`feat-rule-${field.key}`">{{ t(`admin.featured.settings.${field.key}`) }}</label>
              <input
                :id="`feat-rule-${field.key}`"
                v-model.number="rules[field.key]"
                type="number"
                :min="field.min"
                :max="field.max"
                class="form-control feat-number"
                required
              />
              <p class="admin-card-note feat-hint">{{ t(`admin.featured.settings.${field.key}Hint`) }}</p>
            </div>
          </div>

          <!-- A category with a limit of its own (two shifts of leaders, a busy one). -->
          <div class="form-group">
            <p class="form-label">{{ t('admin.featured.settings.categoryLimits') }}</p>
            <p class="admin-card-note feat-hint">{{ t('admin.featured.settings.categoryLimitsHint') }}</p>
            <ul v-if="limitRows.length" class="feat-limits">
              <li v-for="row in limitRows" :key="row.id" class="feat-limit-row">
                <span class="feat-limit-name">{{ row.label }}</span>
                <input
                  v-model.number="rules.categoryLimits[row.id]"
                  type="number"
                  min="1"
                  max="100"
                  class="form-control feat-number"
                  :aria-label="t('admin.featured.settings.limitFor', { name: row.label })"
                />
                <button type="button" class="admin-action admin-action-danger" @click="removeLimit(row.id)">{{ t('admin.featured.settings.removeLimit') }}</button>
              </li>
            </ul>
            <div class="feat-limit-add">
              <select v-model="newLimitCategory" class="admin-field" :aria-label="t('admin.featured.settings.addLimit')">
                <option value="">{{ t('admin.featured.settings.pickCategory') }}</option>
                <option v-for="category in categoriesWithoutLimit" :key="category.id" :value="category.id">{{ category.label }}</option>
              </select>
              <button type="button" class="admin-action" :disabled="!newLimitCategory" @click="addLimit">{{ t('admin.featured.settings.addLimit') }}</button>
            </div>
          </div>

          <p v-if="rulesMessage" class="form-success" role="status">{{ rulesMessage }}</p>
          <p v-if="rulesError" class="form-error" role="alert">{{ rulesError }}</p>
          <div class="feat-actions">
            <button type="submit" class="btn btn-primary-flat btn-sm" :disabled="rulesSaving">{{ t('common.save') }}</button>
          </div>
        </div>
      </form>

      <!-- R146: how the rest of a search is ordered ("Preporučeno"). -->
      <form class="admin-card feat-card" @submit.prevent="saveWeights">
        <div class="admin-card-body feat-form">
          <div>
            <p class="admin-card-title">{{ t('admin.featured.settings.rankingTitle') }}</p>
            <p class="admin-card-note">{{ t('admin.featured.settings.rankingNote') }}</p>
          </div>
          <div class="feat-grid">
            <div v-for="key in WEIGHT_KEYS" :key="key" class="form-group">
              <label class="form-label" :for="`feat-weight-${key}`">{{ t(`admin.featured.settings.weight.${key}`) }}</label>
              <input
                :id="`feat-weight-${key}`"
                v-model.number="weights[key]"
                type="number"
                min="0"
                max="1"
                step="0.05"
                class="form-control feat-number"
                required
              />
              <p class="admin-card-note feat-hint">{{ t(`admin.featured.settings.weight.${key}Hint`) }}</p>
            </div>
          </div>
          <p class="admin-card-note">{{ t('admin.featured.settings.weightShare', { shares: weightShares }) }}</p>
          <p v-if="weightsMessage" class="form-success" role="status">{{ weightsMessage }}</p>
          <p v-if="weightsError" class="form-error" role="alert">{{ weightsError }}</p>
          <div class="feat-actions">
            <button type="submit" class="btn btn-primary-flat btn-sm" :disabled="weightsSaving">{{ t('common.save') }}</button>
          </div>
        </div>
      </form>
    </template>
  </div>
</template>

<script setup>
// Podešavanja: the rules FeaturedService reads (Setting featured_rules) and
// the weights of "Preporučeno" (Setting ranking_weights, needs the
// manage_settings permission). Both used to be raw JSON in Podešavanja.
const { t } = useI18n()
const api = useApi()

const NUMBER_FIELDS = [
  { key: 'searchTopCount', min: 0, max: 10 },
  { key: 'homeDesktopCount', min: 1, max: 8 },
  { key: 'homePhoneCount', min: 1, max: 4 },
  { key: 'homeIntervalSeconds', min: 3, max: 30 },
  { key: 'maxPerCategory', min: 1, max: 100 },
  { key: 'maxPerOwnerPerCategory', min: 1, max: 10 },
  { key: 'defaultDays', min: 1, max: 365 },
]
const WEIGHT_KEYS = ['rating', 'freshness', 'responseTime', 'random']

const rules = ref(null)
const weights = reactive({ rating: 0, freshness: 0, responseTime: 0, random: 0 })
const categories = ref([])
const failed = ref(false)

async function load() {
  failed.value = false
  try {
    const data = await api.get('/admin/featured/settings')
    rules.value = { ...data.rules, categoryLimits: { ...data.rules.categoryLimits } }
    Object.assign(weights, data.rankingWeights)
    categories.value = data.categories.map((category) => ({
      id: category.id,
      label: category.parentName ? `${category.parentName} / ${category.name}` : category.name,
    }))
  } catch {
    failed.value = true
  }
}

onMounted(load)

const limitRows = computed(() =>
  Object.keys(rules.value?.categoryLimits || {}).map((id) => ({
    id,
    label: categories.value.find((category) => category.id === id)?.label || id,
  })),
)
const categoriesWithoutLimit = computed(() => categories.value.filter((category) => !(category.id in (rules.value?.categoryLimits || {}))))
const newLimitCategory = ref('')

function addLimit() {
  rules.value.categoryLimits[newLimitCategory.value] = rules.value.maxPerCategory
  newLimitCategory.value = ''
}

function removeLimit(id) {
  delete rules.value.categoryLimits[id]
}

const rulesSaving = ref(false)
const rulesMessage = ref('')
const rulesError = ref('')

async function saveRules() {
  rulesSaving.value = true
  rulesMessage.value = ''
  rulesError.value = ''
  try {
    const saved = await api.put('/admin/featured/settings', rules.value)
    rules.value = { ...saved, categoryLimits: { ...saved.categoryLimits } }
    rulesMessage.value = t('dashboard.changesSaved')
  } catch (e) {
    rulesError.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    rulesSaving.value = false
  }
}

// "ocena 35%, svežina 25%, ...": each weight's share of the whole.
const weightShares = computed(() => {
  const total = WEIGHT_KEYS.reduce((sum, key) => sum + (Number(weights[key]) || 0), 0)
  if (!total) return '-'
  return WEIGHT_KEYS.map(
    (key) => `${t(`admin.featured.settings.weight.${key}`).toLocaleLowerCase('sr')} ${Math.round(((Number(weights[key]) || 0) / total) * 100)}%`,
  ).join(', ')
})

const weightsSaving = ref(false)
const weightsMessage = ref('')
const weightsError = ref('')

async function saveWeights() {
  weightsSaving.value = true
  weightsMessage.value = ''
  weightsError.value = ''
  try {
    Object.assign(weights, await api.put('/admin/featured/ranking', { ...weights }))
    weightsMessage.value = t('dashboard.changesSaved')
  } catch (e) {
    weightsError.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    weightsSaving.value = false
  }
}
</script>

<style lang="scss" scoped>
.feat-card {
  margin-bottom: 20px;
}

.feat-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.feat-form .form-group {
  margin-bottom: 0;
}

.feat-under-check {
  margin-top: -10px;
}

.feat-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

@include respond-above(md) {
  .feat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.feat-hint {
  margin-top: 6px;
}

.feat-number {
  max-width: 140px;
}

.feat-limits {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 10px 0;
  padding: 0;
  list-style: none;
}

.feat-limit-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.feat-limit-name {
  flex: 0 1 240px;
  min-width: 0;
  font-size: 14px;
}

.feat-limit-add {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}

.feat-actions {
  display: flex;
  gap: 10px;
}
</style>
