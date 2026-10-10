<template>
  <div>
    <DashboardPageHeader :title="t('admin.bookingModels')" :subtitle="t('admin.subtitle.bookingModels')" />
    <p v-if="loadError" class="form-error">{{ loadError }}</p>

    <!-- T129 part 3: each model as the owner meets it in the wizard. -->
    <section v-if="data" class="admin-card bm-card">
      <div class="admin-card-head">
        <div>
          <p class="admin-card-title">{{ t('admin.models.listTitle') }}</p>
          <p class="admin-card-note">{{ t('admin.models.listHint') }}</p>
        </div>
      </div>
      <div class="admin-card-body bm-list">
        <form v-for="(model, index) in drafts" :key="model.key" class="bm-model" :class="{ 'bm-model-off': !model.enabled }" @submit.prevent="saveModel(model)">
          <div class="bm-model-head">
            <div class="bm-model-order">
              <button type="button" class="admin-action" :disabled="index === 0" :aria-label="t('admin.attr.moveUp')" @click="moveModel(index, -1)">↑</button>
              <button
                type="button"
                class="admin-action"
                :disabled="index === drafts.length - 1"
                :aria-label="t('admin.attr.moveDown')"
                @click="moveModel(index, 1)"
              >↓</button>
            </div>
            <div class="form-group bm-name">
              <label class="form-label" :for="`bm-name-${model.key}`">{{ t('admin.models.name') }}</label>
              <input :id="`bm-name-${model.key}`" v-model="model.name" type="text" class="form-control" maxlength="80" required />
            </div>
            <label class="admin-check-row bm-enabled">
              <input v-model="model.enabled" type="checkbox" class="admin-check" /> {{ t('admin.models.enabled') }}
            </label>
          </div>
          <div class="form-group">
            <label class="form-label" :for="`bm-desc-${model.key}`">{{ t('admin.models.description') }}</label>
            <textarea :id="`bm-desc-${model.key}`" v-model="model.description" class="form-control" rows="2" maxlength="300" />
          </div>
          <div class="bm-model-foot">
            <div v-if="model.possibleUnits.length > 1" class="bm-units">
              <span class="form-label">{{ t('admin.models.units') }}</span>
              <div class="admin-switch">
                <button
                  v-for="unit in model.possibleUnits"
                  :key="unit"
                  type="button"
                  class="admin-switch-btn"
                  :class="{ 'is-active': model.priceUnits.includes(unit) }"
                  @click="toggleUnit(model, unit)"
                >{{ unitName(unit) }}</button>
              </div>
            </div>
            <p v-else-if="model.possibleUnits.length" class="admin-card-note">
              {{ t('admin.models.fixedUnit', { unit: unitName(model.possibleUnits[0]) }) }}
            </p>
            <p class="admin-card-note">
              {{ t('admin.models.usage', { categories: model.categories.length, listings: model.listingCount }) }}
            </p>
          </div>
          <p v-if="!model.enabled && model.listingCount" class="bm-warning">{{ t('admin.models.offWarning', { count: model.listingCount }) }}</p>
          <p v-if="errors[model.key]" class="form-error">{{ errors[model.key] }}</p>
          <div class="bm-actions">
            <button type="submit" class="btn btn-primary-flat btn-sm" :disabled="busy || !isDirty(model)">{{ t('common.save') }}</button>
            <span v-if="savedKey === model.key" class="bm-saved" role="status">{{ t('admin.attr.saved') }}</span>
          </div>
        </form>
      </div>
    </section>

    <!-- T129 part 4: the categories x models table. -->
    <section v-if="data" class="admin-card bm-card">
      <div class="admin-card-head">
        <div>
          <p class="admin-card-title">{{ t('admin.models.matrixTitle') }}</p>
          <p class="admin-card-note">{{ t('admin.models.matrixHint') }}</p>
        </div>
      </div>
      <div class="admin-card-body bm-matrix-wrap">
        <table class="bm-matrix">
          <thead>
            <tr>
              <th class="bm-matrix-category">{{ t('admin.categoryName') }}</th>
              <th v-for="model in data.models" :key="model.key" :class="{ 'bm-col-off': !model.enabled }">
                {{ model.name }}<span v-if="!model.enabled" class="bm-col-note">{{ t('admin.models.off') }}</span>
              </th>
              <th>{{ t('admin.models.defaultUnit') }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.id">
              <th scope="row" class="bm-matrix-category">
                <NuxtLink :to="`/admin/kategorije/${row.id}`" class="bm-category" :style="{ paddingLeft: `${(row.level - 1) * 16}px` }">
                  {{ row.name }}
                </NuxtLink>
                <span v-if="!row.published" class="admin-pill admin-pill-warning">{{ t('admin.cat.draft') }}</span>
              </th>
              <td v-for="model in data.models" :key="model.key" :class="{ 'bm-col-off': !model.enabled }">
                <label class="bm-cell">
                  <input
                    type="checkbox"
                    class="admin-check"
                    :checked="row.modelKeys.includes(model.key)"
                    :aria-label="`${row.name}: ${model.name}`"
                    @change="toggleCell(row, model.key)"
                  />
                  <span v-if="row.listingCounts[model.key]" class="bm-count">{{ t('admin.models.listings', { count: row.listingCounts[model.key] }) }}</span>
                </label>
              </td>
              <td>
                <select v-model="row.defaultPriceUnit" class="admin-field bm-unit" :aria-label="`${row.name}: ${t('admin.models.defaultUnit')}`">
                  <option v-for="unit in rowUnits(row)" :key="unit" :value="unit">{{ unitName(unit) }}</option>
                </select>
              </td>
              <td class="bm-row-actions">
                <button v-if="rowDirty(row)" type="button" class="btn btn-primary-flat btn-sm" :disabled="busy" @click="saveRow(row)">
                  {{ t('common.save') }}
                </button>
                <p v-if="rowErrors[row.id]" class="form-error">{{ rowErrors[row.id] }}</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-if="history?.length" class="admin-card admin-card-table bm-card">
      <div class="admin-card-head">
        <p class="admin-card-title">{{ t('admin.models.historyTitle') }}</p>
      </div>
      <table class="admin-table">
        <thead>
          <tr>
            <th>{{ t('admin.cat.historyWhen') }}</th>
            <th>{{ t('admin.cat.historyWho') }}</th>
            <th>{{ t('admin.cat.historyChanges') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="entry in history" :key="entry.id">
            <td :data-label="t('admin.cat.historyWhen')">{{ formatDateTime(entry.createdAt) }}</td>
            <td :data-label="t('admin.cat.historyWho')">
              {{ [entry.user?.firstName, entry.user?.lastName].filter(Boolean).join(' ') || entry.user?.email || '-' }}
            </td>
            <td :data-label="t('admin.cat.historyChanges')">{{ describe(entry) }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<script setup>
definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })
const { t } = useI18n()
const api = useApi()

const UNIT_LABELS = { NIGHT: 'Night', DAY: 'Day', HOUR: 'Hour', SLOT: 'Slot', MONTH: 'Month', YEAR: 'Year', GUEST: 'Guest' }
const unitName = (unit) => t(`listing.unit${UNIT_LABELS[unit]}`)

const { data, error, refresh } = await useAsyncData('admin-booking-models', () => api.get('/admin/booking-models'))
const { data: history, refresh: refreshHistory } = await useAsyncData('admin-booking-models-history', () =>
  api.get('/admin/booking-models/history'),
)
const loadError = computed(() => (error.value ? extractErrorMessage(error.value, t('auth.genericError')) : ''))

// -- Models -----------------------------------------------------------------

// Editable copies of the models and the table rows, reset whenever the data reloads.
const drafts = ref([])
const rows = ref([])
watch(
  data,
  (value) => {
    drafts.value = (value?.models || []).map((model) => ({ ...model, priceUnits: [...(model.priceUnits || [])] }))
    rows.value = treeOrder(value?.categories || []).map((row) => ({ ...row, modelKeys: [...row.modelKeys] }))
  },
  { immediate: true },
)
const original = (key) => data.value?.models.find((model) => model.key === key)
function isDirty(model) {
  const saved = original(model.key)
  return (
    !!saved &&
    (saved.name !== model.name ||
      saved.description !== model.description ||
      saved.enabled !== model.enabled ||
      JSON.stringify([...saved.priceUnits].sort()) !== JSON.stringify([...model.priceUnits].sort()))
  )
}
function toggleUnit(model, unit) {
  const index = model.priceUnits.indexOf(unit)
  if (index === -1) model.priceUnits.push(unit)
  else if (model.priceUnits.length > 1) model.priceUnits.splice(index, 1)
}

const busy = ref(false)
const errors = reactive({})
const savedKey = ref('')
async function saveModel(model) {
  busy.value = true
  errors[model.key] = ''
  savedKey.value = ''
  try {
    await api.patch(`/admin/booking-models/${model.key}`, {
      name: model.name,
      description: model.description,
      enabled: model.enabled,
      ...(model.possibleUnits.length > 1 ? { priceUnits: model.priceUnits } : {}),
    })
    await Promise.all([refresh(), refreshHistory()])
    savedKey.value = model.key
  } catch (e) {
    errors[model.key] = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    busy.value = false
  }
}

async function moveModel(index, step) {
  const keys = drafts.value.map((model) => model.key)
  keys.splice(index + step, 0, keys.splice(index, 1)[0])
  busy.value = true
  try {
    await api.patch('/admin/booking-models/reorder', { keys })
    await Promise.all([refresh(), refreshHistory()])
  } catch (e) {
    alert(extractErrorMessage(e, t('auth.genericError')))
  } finally {
    busy.value = false
  }
}

// -- Categories x models ---------------------------------------------------

// Each category followed by its subcategories, siblings in their order.
function treeOrder(categories) {
  const byParent = new Map()
  for (const category of categories) {
    const key = category.parentId || 'root'
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key).push(category)
  }
  const out = []
  const walk = (key) => {
    for (const category of byParent.get(key) || []) {
      out.push(category)
      walk(category.id)
    }
  }
  walk('root')
  return out
}

const savedRow = (id) => data.value?.categories.find((category) => category.id === id)
function rowDirty(row) {
  const saved = savedRow(row.id)
  return (
    !!saved &&
    (JSON.stringify([...saved.modelKeys].sort()) !== JSON.stringify([...row.modelKeys].sort()) ||
      saved.defaultPriceUnit !== row.defaultPriceUnit)
  )
}
function toggleCell(row, key) {
  const index = row.modelKeys.indexOf(key)
  if (index === -1) row.modelKeys.push(key)
  else row.modelKeys.splice(index, 1)
  // The default unit follows when its model is taken away.
  const units = rowUnits(row)
  if (units.length && !units.includes(row.defaultPriceUnit)) row.defaultPriceUnit = units[0]
}
// The units the row's models take that the category allows, and the ones a newly given model brings.
function rowUnits(row) {
  const units = new Set()
  for (const key of row.modelKeys) {
    const model = data.value.models.find((candidate) => candidate.key === key)
    const own = (model?.priceUnits || []).filter((unit) => row.allowedPriceUnits.includes(unit))
    for (const unit of own.length ? own : (model?.priceUnits || []).slice(0, 1)) units.add(unit)
  }
  if (!units.size) units.add(row.defaultPriceUnit)
  return [...units]
}

const rowErrors = reactive({})
async function saveRow(row) {
  busy.value = true
  rowErrors[row.id] = ''
  try {
    await api.put(`/admin/categories/${row.id}/booking-models`, { modelKeys: row.modelKeys, defaultPriceUnit: row.defaultPriceUnit })
    await refresh()
  } catch (e) {
    rowErrors[row.id] = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    busy.value = false
  }
}

// -- History ----------------------------------------------------------------

function describe(entry) {
  if (entry.action === 'model.reorder') return t('admin.models.reordered')
  const before = entry.oldValue || {}
  const after = entry.newValue || {}
  const parts = []
  if (before.name !== after.name) parts.push(`${t('admin.models.name')}: ${before.name} → ${after.name}`)
  if (before.description !== after.description) parts.push(t('admin.models.descriptionChanged', { name: after.name }))
  if (before.enabled !== after.enabled) parts.push(`${after.name}: ${t(after.enabled ? 'admin.models.turnedOn' : 'admin.models.turnedOff')}`)
  if (JSON.stringify(before.priceUnits) !== JSON.stringify(after.priceUnits)) {
    parts.push(`${after.name}: ${(after.priceUnits || []).map(unitName).join(', ')}`)
  }
  return parts.join('; ') || after.name || entry.entityId
}

useSeoMeta({ title: t('admin.bookingModels') })
</script>

<style lang="scss" scoped>
.bm-card {
  margin-bottom: 20px;
}

.bm-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.bm-model {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px 0;
  border-bottom: 1px solid $color-border;
}

.bm-model:first-child {
  padding-top: 0;
}

.bm-model:last-child {
  border-bottom: 0;
}

.bm-model .form-group {
  margin-bottom: 0;
}

.bm-model-off .form-control {
  color: $color-text-muted;
}

.bm-model-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 12px 16px;
}

.bm-model-order {
  display: flex;
  gap: 10px;
  padding-bottom: 12px;
}

.bm-name {
  flex: 1 1 260px;
}

.bm-enabled {
  padding-bottom: 12px;
}

.bm-model-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px 20px;
}

.bm-units {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.bm-units .form-label {
  margin: 0;
}

.bm-warning {
  font-size: 13px;
  color: $color-text;
  padding: 8px 12px;
  border-radius: 10px;
  background: $color-accent-tint;
}

.bm-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.bm-saved {
  font-size: 14px;
  color: $color-success;
}

// The table scrolls inside its card on a narrow screen, never the page.
.bm-matrix-wrap {
  overflow-x: auto;
}

.bm-matrix {
  width: 100%;
  min-width: 860px;
  border-collapse: collapse;
  font-size: 13px;
}

.bm-matrix th,
.bm-matrix td {
  padding: 10px 8px;
  border-bottom: 1px solid $color-border;
  text-align: center;
  vertical-align: middle;
}

.bm-matrix thead th {
  font-weight: 600;
  color: $color-text-muted;
  line-height: 16px;
}

.bm-matrix .bm-matrix-category {
  min-width: 200px;
  text-align: left;
  font-weight: 500;
}

.bm-category {
  display: inline-block;
  color: $color-text;
  text-decoration: none;
}

.bm-category:hover {
  color: $color-primary;
}

.bm-matrix-category .admin-pill {
  margin-left: 6px;
}

.bm-col-off {
  background: $color-background;
}

.bm-col-note {
  display: block;
  font-weight: 400;
}

.bm-cell {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}

.bm-count {
  font-size: 11px;
  color: $color-text-muted;
  white-space: nowrap;
}

.bm-unit {
  height: 36px;
  padding-left: 10px;
}

.bm-row-actions {
  min-width: 96px;
}
</style>
