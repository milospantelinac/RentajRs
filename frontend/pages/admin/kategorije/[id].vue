<template>
  <div>
    <BackLink fallback="/admin/kategorije" class="mb-4" />

    <StateBlock
      v-if="loadError"
      card
      error
      icon="categories"
      :title="t('admin.empty.categories.title')"
      :text="loadError"
    />

    <template v-else-if="category">
      <DashboardPageHeader :title="category.name" :subtitle="`/${category.slug}`">
        <template #actions>
          <span v-if="category.status !== 'ACTIVE'" class="admin-pill admin-pill-neutral">
            {{ t(`admin.categoryStatus.${category.status}`) }}
          </span>
          <span v-else class="admin-pill" :class="category.published ? 'admin-pill-success' : 'admin-pill-warning'">
            {{ category.published ? t('admin.categoryVisibility.published') : t('admin.cat.draft') }}
          </span>
        </template>
      </DashboardPageHeader>
      <p class="admin-card-note cat-counts">
        {{ t('admin.cat.listingsLine', { total: category.listingCount, active: category.activeListingCount, children: category.childCount }) }}
      </p>

      <div class="admin-switch cat-tabs" role="tablist">
        <button
          v-for="key in TABS"
          :key="key"
          type="button"
          role="tab"
          class="admin-switch-btn"
          :class="{ 'is-active': tab === key }"
          :aria-selected="tab === key"
          @click="tab = key"
        >{{ t(`admin.cat.tabs.${key}`) }}</button>
      </div>

      <!-- Osnovno: everything about the category itself. -->
      <form v-if="tab === 'basics'" class="admin-card cat-card" @submit.prevent="saveBasics">
        <div class="admin-card-body cat-form">
          <div class="cat-grid">
            <div class="form-group">
              <label class="form-label" for="cat-name">{{ t('admin.categoryName') }}</label>
              <input id="cat-name" v-model="form.name" type="text" class="form-control" maxlength="100" required />
            </div>
            <div class="form-group">
              <label class="form-label" for="cat-slug">{{ t('admin.cat.slug') }}</label>
              <input id="cat-slug" v-model="form.slug" type="text" class="form-control" maxlength="80" required />
              <p class="admin-card-note cat-hint">{{ t('admin.cat.slugHint', { slug: form.slug || category.slug }) }}</p>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="cat-short">{{ t('admin.categoryShortDescription') }}</label>
            <input id="cat-short" v-model="form.shortDescription" type="text" class="form-control" maxlength="120" />
          </div>
          <div class="form-group">
            <label class="form-label" for="cat-description">{{ t('admin.cat.description') }}</label>
            <textarea id="cat-description" v-model="form.description" class="form-control" rows="4" />
          </div>
          <div class="form-group">
            <label class="form-label" for="cat-parent">{{ t('admin.parentCategory') }}</label>
            <select id="cat-parent" v-model="form.parentId" class="form-control form-select">
              <option :value="null">{{ t('admin.cat.noParent') }}</option>
              <option v-for="c in parentOptions" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </div>

          <fieldset class="cat-fieldset">
            <legend class="form-label">{{ t('admin.cat.icon') }}</legend>
            <div class="cat-icons">
              <button
                type="button"
                class="cat-icon"
                :class="{ 'is-active': !form.icon }"
                :aria-pressed="!form.icon"
                @click="form.icon = ''"
              >
                <span class="cat-icon-glyph" aria-hidden="true" v-html="iconPreview(category.slug)" />
                <span class="cat-icon-name">{{ t('admin.cat.iconDefault') }}</span>
              </button>
              <button
                v-for="key in CATEGORY_ICON_KEYS"
                :key="key"
                type="button"
                class="cat-icon"
                :class="{ 'is-active': form.icon === key }"
                :aria-pressed="form.icon === key"
                @click="form.icon = key"
              >
                <span class="cat-icon-glyph" aria-hidden="true" v-html="iconPreview(key)" />
                <span class="cat-icon-name">{{ key }}</span>
              </button>
            </div>
            <p class="admin-card-note cat-hint">{{ t('admin.cat.iconHint') }}</p>
          </fieldset>

          <div class="form-group">
            <p class="form-label">{{ t('admin.cat.image') }}</p>
            <img v-if="category.imageUrl" :src="category.imageUrl" alt="" class="cat-image" />
            <div class="cat-row-actions">
              <label class="btn btn-tertiary btn-sm cat-upload">
                {{ category.imageUrl ? t('admin.cat.imageReplace') : t('admin.cat.imageUpload') }}
                <input type="file" accept="image/jpeg,image/png,image/webp" class="visually-hidden" @change="uploadImage" />
              </label>
              <button v-if="category.imageUrl" type="button" class="btn btn-tertiary btn-sm" @click="removeImage">
                {{ t('admin.cat.imageRemove') }}
              </button>
            </div>
            <p class="admin-card-note cat-hint">{{ t('admin.cat.imageHint') }}</p>
          </div>

          <fieldset class="cat-fieldset">
            <legend class="form-label">{{ t('admin.cat.bookingSection') }}</legend>
            <p class="admin-card-note cat-hint">{{ t('admin.cat.bookingSectionHint') }}</p>
            <!-- T129 part 4: the models it offers, as in Administracija > Rezervacioni modeli. -->
            <div class="cat-models">
              <label v-for="model in category.bookingModelOptions" :key="model.key" class="admin-check-row">
                <input
                  type="checkbox"
                  class="admin-check"
                  :checked="form.modelKeys.includes(model.key)"
                  @change="toggleModel(model.key)"
                />
                {{ model.name }}<span v-if="!model.enabled" class="admin-card-note">&nbsp;({{ t('admin.models.off') }})</span>
              </label>
            </div>
            <p class="form-label">{{ t('admin.cat.allowedUnits') }}</p>
            <div class="admin-switch">
              <button
                v-for="u in PRICE_UNITS"
                :key="u"
                type="button"
                class="admin-switch-btn"
                :class="{ 'is-active': form.allowedPriceUnits.includes(u) }"
                @click="toggleUnit(u)"
              >{{ unitName(u) }}</button>
            </div>
            <div class="form-group">
              <label class="form-label" for="cat-unit">{{ t('admin.models.defaultUnit') }}</label>
              <select id="cat-unit" v-model="form.defaultPriceUnit" class="form-control form-select">
                <option v-for="u in form.allowedPriceUnits" :key="u" :value="u">{{ unitName(u) }}</option>
              </select>
            </div>
          </fieldset>

          <label v-if="category.status === 'ACTIVE'" class="admin-check-row">
            <input v-model="form.published" type="checkbox" class="admin-check" /> {{ t('admin.cat.published') }}
          </label>
          <p v-if="category.status === 'ACTIVE'" class="admin-card-note cat-hint">{{ t('admin.cat.publishedHint') }}</p>

          <p v-if="formError" class="form-error">{{ formError }}</p>
          <p v-if="formSaved" class="cat-saved" role="status">{{ t('admin.cat.saved') }}</p>
          <div class="cat-row-actions">
            <button type="submit" class="btn btn-primary-flat btn-sm" :disabled="saving">{{ t('common.save') }}</button>
          </div>
        </div>
      </form>

      <!-- Polja i opremljenost, with the key facts (T129 part 2). -->
      <CategoryAttributesEditor v-else-if="tab === 'attributes'" :category-id="category.id" @changed="loadAttributes" />

      <!-- Filteri: what /pretraga offers for this category. -->
      <CategoryFiltersEditor v-else-if="tab === 'filters'" :category-id="category.id" />

      <!-- Probni prikaz: the owner's card, rendered by the wizard's own component. -->
      <div v-else-if="tab === 'preview'" class="admin-card cat-card">
        <div class="admin-card-body cat-form">
          <p class="admin-card-note">{{ t('admin.cat.previewIntro') }}</p>
          <p v-if="!category.published || category.status !== 'ACTIVE'" class="cat-warning">{{ t('admin.cat.previewDraft') }}</p>
          <div class="cat-preview">
            <CategoryPickCard tag="div" :category="previewCategory" :parent="parent" :sub="Boolean(parent)" />
          </div>
          <p class="admin-card-title">{{ t('admin.cat.previewFields') }}</p>
          <p v-if="!previewAttributes.length" class="admin-card-note">{{ t('admin.cat.previewNoFields') }}</p>
          <ul v-else class="cat-fields">
            <li v-for="a in previewAttributes" :key="a.id" class="cat-field">
              <span class="admin-cell-name">{{ a.name }}<template v-if="a.unit"> ({{ a.unit }})</template></span>
              <span class="admin-cell-sub">
                {{ t(`admin.attr.types.${a.type}`) }}<template v-if="a.options?.length">: {{ a.options.map((o) => o.name).join(', ') }}</template>
              </span>
              <span class="admin-pills">
                <span v-if="a.required" class="admin-pill admin-pill-info">{{ t('admin.cat.previewRequired') }}</span>
                <span v-if="a.categoryId !== category.id" class="admin-pill admin-pill-neutral">{{ t('admin.cat.previewInherited') }}</span>
              </span>
            </li>
          </ul>
        </div>
      </div>

      <!-- Istorija izmena: AdminLog rows of the category and its attributes. -->
      <div v-else-if="tab === 'history'" class="admin-card admin-card-table">
        <StateBlock v-if="!history.length" icon="categories" :title="t('admin.cat.historyEmpty')" text="" />
        <table v-else class="admin-table">
          <thead>
            <tr>
              <th>{{ t('admin.cat.historyWhen') }}</th>
              <th>{{ t('admin.cat.historyWho') }}</th>
              <th>{{ t('admin.cat.historyWhat') }}</th>
              <th>{{ t('admin.cat.historyChanges') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in history" :key="row.id">
              <td :data-label="t('admin.cat.historyWhen')">{{ formatDateTime(row.createdAt) }}</td>
              <td :data-label="t('admin.cat.historyWho')">
                {{ [row.user?.firstName, row.user?.lastName].filter(Boolean).join(' ') || row.user?.email || '-' }}
              </td>
              <td :data-label="t('admin.cat.historyWhat')">{{ actionLabel(row) }}</td>
              <td :data-label="t('admin.cat.historyChanges')">
                <ul v-if="changesOf(row).length" class="cat-diff">
                  <li v-for="change in changesOf(row)" :key="change.field">
                    <strong>{{ change.label }}</strong>: {{ change.from }} → {{ change.to }}
                  </li>
                </ul>
                <span v-else class="admin-cell-sub">{{ t('admin.cat.historyNoDiff') }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Spajanje i arhiva: the moves that touch listings, each explained. -->
      <div v-else-if="tab === 'advanced'" class="admin-card cat-card">
        <div class="admin-card-body cat-form">
          <template v-if="category.status === 'ACTIVE'">
            <div class="form-group">
              <label class="form-label" for="cat-merge">{{ t('admin.mergeInto') }}</label>
              <select id="cat-merge" v-model="mergeInto" class="form-control form-select">
                <option value="">-</option>
                <option v-for="c in mergeOptions" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
              <p class="admin-card-note cat-hint">{{ t('admin.cat.mergeHint') }}</p>
            </div>
            <div class="cat-row-actions">
              <button class="btn btn-danger btn-sm" :disabled="!mergeInto" @click="confirmMerge">{{ t('admin.merge') }}</button>
            </div>
            <hr class="cat-rule" />
            <p class="admin-card-note">{{ t('admin.cat.archiveHint') }}</p>
            <div class="cat-row-actions">
              <button class="btn btn-tertiary btn-sm" @click="archiveCategory">{{ t('admin.archive') }}</button>
            </div>
          </template>
          <div v-else class="cat-row-actions">
            <button class="btn btn-primary-flat btn-sm" @click="restoreCategory">{{ t('admin.restore') }}</button>
          </div>
          <hr class="cat-rule" />
          <p class="admin-card-note">{{ t('admin.cat.deleteHint') }}</p>
          <div class="cat-row-actions">
            <button
              class="btn btn-danger btn-sm"
              :disabled="category.listingCount > 0 || category.childCount > 0"
              @click="deleteCategory"
            >{{ t('common.delete') }}</button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })
const { t } = useI18n()
const api = useApi()
const route = useRoute()

const TABS = ['basics', 'attributes', 'filters', 'preview', 'history', 'advanced']
const PRICE_UNITS = ['NIGHT', 'DAY', 'HOUR', 'SLOT', 'MONTH', 'YEAR', 'GUEST']
const UNIT_LABELS = { NIGHT: 'Night', DAY: 'Day', HOUR: 'Hour', SLOT: 'Slot', MONTH: 'Month', YEAR: 'Year', GUEST: 'Guest' }
const unitName = (unit) => t(`listing.unit${UNIT_LABELS[unit]}`)

const tab = ref(TABS.includes(route.query.tab) ? route.query.tab : 'basics')
watch(tab, (value) => navigateTo({ query: { ...route.query, tab: value } }, { replace: true }))

const { data: category, error, refresh } = await useAsyncData(`admin-category-${route.params.id}`, () =>
  api.get(`/admin/categories/${route.params.id}`),
)
const { data: tree, refresh: refreshTree } = await useAsyncData('admin-categories', () => api.get('/admin/categories'))
const loadError = computed(() => (error.value ? extractErrorMessage(error.value, t('auth.genericError')) : ''))

const parent = computed(() => (tree.value || []).find((c) => c.id === category.value?.parentId) || null)

// Main categories only, and never the category itself: the site shows two levels.
const parentOptions = computed(() =>
  (tree.value || []).filter((c) => c.level === 1 && c.status === 'ACTIVE' && c.id !== category.value?.id),
)
const mergeOptions = computed(() =>
  (tree.value || []).filter((c) => c.status === 'ACTIVE' && c.id !== category.value?.id),
)

// -- Osnovno ---------------------------------------------------------------

const form = reactive({
  name: '',
  slug: '',
  shortDescription: '',
  description: '',
  parentId: null,
  icon: '',
  modelKeys: [],
  defaultPriceUnit: 'NIGHT',
  allowedPriceUnits: [],
  published: false,
})

function fillForm(c) {
  if (!c) return
  Object.assign(form, {
    name: c.name,
    slug: c.slug,
    shortDescription: c.shortDescription || '',
    description: c.description || '',
    parentId: c.parentId || null,
    // Only an icon from the library counts as picked; the seed's old names fall back to the slug.
    icon: CATEGORY_ICON_KEYS.includes(c.icon) ? c.icon : '',
    modelKeys: [...(c.modelKeys || [])],
    defaultPriceUnit: c.defaultPriceUnit,
    allowedPriceUnits: [...c.allowedPriceUnits],
    published: c.published,
  })
}
watch(category, fillForm, { immediate: true })

function iconPreview(key) {
  return getCategoryIconMarkup(key) || getSearchCategoryIconMarkup(key)
}

function toggleModel(key) {
  const i = form.modelKeys.indexOf(key)
  if (i === -1) form.modelKeys.push(key)
  else if (form.modelKeys.length > 1) form.modelKeys.splice(i, 1)
}

function toggleUnit(u) {
  const i = form.allowedPriceUnits.indexOf(u)
  if (i === -1) form.allowedPriceUnits.push(u)
  else if (form.allowedPriceUnits.length > 1) form.allowedPriceUnits.splice(i, 1)
  if (!form.allowedPriceUnits.includes(form.defaultPriceUnit)) form.defaultPriceUnit = form.allowedPriceUnits[0]
}

const saving = ref(false)
const formError = ref('')
const formSaved = ref(false)

async function saveBasics() {
  const slug = form.slug.trim().toLowerCase()
  if (slug !== category.value.slug && !confirm(t('admin.cat.slugChangeConfirm', { from: category.value.slug, to: slug }))) return
  saving.value = true
  formError.value = ''
  formSaved.value = false
  try {
    await api.patch(`/admin/categories/${category.value.id}`, {
      name: form.name.trim(),
      slug,
      shortDescription: form.shortDescription,
      description: form.description,
      parentId: form.parentId,
      // An empty pick clears the icon, so the category's own slug decides again.
      icon: form.icon || '',
      ...(category.value.status === 'ACTIVE' ? { published: form.published } : {}),
    })
    // T129 part 4: the models, the units and the default one go together; a
    // model brings a unit along when the category allows none of its own.
    await api.put(`/admin/categories/${category.value.id}/booking-models`, {
      modelKeys: form.modelKeys,
      allowedPriceUnits: form.allowedPriceUnits,
      defaultPriceUnit: form.defaultPriceUnit,
    })
    await Promise.all([refresh(), refreshTree(), loadAttributes()])
    formSaved.value = true
  } catch (e) {
    formError.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    saving.value = false
  }
}

async function uploadImage(event) {
  const file = event.target.files?.[0]
  if (!file) return
  const body = new FormData()
  body.append('file', file)
  try {
    await api.post(`/admin/categories/${category.value.id}/image`, body)
    await refresh()
  } catch (e) {
    alert(extractErrorMessage(e, t('auth.genericError')))
  } finally {
    event.target.value = ''
  }
}

async function removeImage() {
  if (!confirm(t('admin.cat.imageRemoveConfirm'))) return
  try {
    await api.delete(`/admin/categories/${category.value.id}/image`)
    await refresh()
  } catch (e) {
    alert(extractErrorMessage(e, t('auth.genericError')))
  }
}

// -- Atributi and the preview ---------------------------------------------

// The wizard reads a category's fields from the public endpoint, own and
// inherited from the parent, so the preview reads the same.
const attributes = ref([])
async function loadAttributes() {
  if (!category.value) return
  try {
    const full = await api.get(`/categories/${category.value.slug}`)
    attributes.value = full.attributes || []
  } catch {
    attributes.value = []
  }
}
onMounted(loadAttributes)

const previewCategory = computed(() => ({
  ...category.value,
  name: form.name || category.value.name,
  shortDescription: form.shortDescription,
  icon: form.icon || category.value.icon,
}))

// T129: what a new listing is offered, as the wizard filters it: no hidden fields or items.
const previewAttributes = computed(() =>
  attributes.value
    .filter((attribute) => !attribute.hidden)
    .map((attribute) => ({ ...attribute, options: (attribute.options || []).filter((option) => !option.hidden) })),
)

// -- Istorija izmena ------------------------------------------------------

// Read when the tab opens (and again on every return to it), on the server too.
const { data: historyRows } = await useAsyncData(
  `admin-category-history-${route.params.id}`,
  () => (tab.value === 'history' ? api.get(`/admin/categories/${route.params.id}/history`) : Promise.resolve([])),
  { watch: [tab] },
)
const history = computed(() => historyRows.value || [])

function actionLabel(row) {
  // The locale keys use _ for the action's dot, which vue-i18n reads as nesting.
  const key = `admin.cat.actions.${row.action.replace('.', '_')}`
  const label = t(key)
  return label === key ? row.action : label
}

// Only the fields a person would read; ids, timestamps and counters are noise.
const HISTORY_FIELDS = [
  'name', 'slug', 'shortDescription', 'description', 'parentId', 'icon', 'imageUrl', 'published', 'status',
  'displayOrder', 'allowedPriceUnits', 'defaultPriceUnit', 'type', 'required', 'unit',
  'options', 'reason', 'mergedIntoId', 'key', 'hidden', 'showOnListing', 'dependsOnAttrKey', 'dependsOnOptionKey',
  'cardFactKeys', 'listingFactKeys', 'attributeKey', 'optionKey', 'control', 'placement', 'thresholds', 'order',
  'modelKeys',
]
const categoryName = (id) => (tree.value || []).find((c) => c.id === id)?.name

// Key facts and orders are kept as keys; they read better as the fields' and items' names.
const KEY_LIST_FIELDS = ['cardFactKeys', 'listingFactKeys', 'order', 'modelKeys', 'allowedPriceUnits']
function keyName(key, field) {
  // A unit and a model can share a key (DAY), so the field decides which it is.
  if (field === 'allowedPriceUnits') return UNIT_LABELS[key] ? unitName(key) : key
  const model = field === 'modelKeys' && category.value?.bookingModelOptions?.find((m) => m.key === key)
  if (model) return model.name
  const attribute = attributes.value.find((a) => a.key === key)
  if (attribute) return attribute.name
  for (const a of attributes.value) {
    const option = a.options?.find((o) => o.key === key)
    if (option) return option.name
  }
  return key
}

function show(field, value) {
  if (value === undefined || value === null || value === '') return t('admin.cat.empty')
  if (typeof value === 'boolean') return value ? t('admin.cat.yes') : t('admin.cat.no')
  if ((field === 'parentId' || field === 'mergedIntoId') && categoryName(value)) return categoryName(value)
  if (KEY_LIST_FIELDS.includes(field) && Array.isArray(value)) return value.map((key) => keyName(key, field)).join(', ') || t('admin.cat.empty')
  if (field === 'defaultPriceUnit' && UNIT_LABELS[value]) return unitName(value)
  if (Array.isArray(value)) return value.map((item) => (typeof item === 'object' ? item.name || item.key : item)).join(', ') || t('admin.cat.empty')
  return String(value)
}

// An empty text or list and none read the same (a saved form sends the icon as '').
const emptyAsNull = (value) => (value === undefined || value === '' || (Array.isArray(value) && !value.length) ? null : value)

function changesOf(row) {
  // A reorder keeps the id lists; it reads as the order changing, nothing per field.
  if (row.action === 'category.reorder') return []
  const before = row.oldValue || {}
  const after = row.newValue || {}
  return HISTORY_FIELDS.filter((field) => field in before || field in after)
    .filter((field) => JSON.stringify(emptyAsNull(before[field])) !== JSON.stringify(emptyAsNull(after[field])))
    .map((field) => ({
      field,
      label: t(`admin.cat.fields.${field}`),
      from: show(field, before[field]),
      to: show(field, after[field]),
    }))
}

// -- Spajanje, arhiva, brisanje --------------------------------------------

const mergeInto = ref('')

async function confirmMerge() {
  const target = mergeOptions.value.find((c) => c.id === mergeInto.value)
  if (!target || !confirm(`${t('admin.merge')}: ${category.value.name} → ${target.name}?`)) return
  try {
    await api.post(`/admin/categories/${category.value.id}/merge`, { targetCategoryId: target.id })
    await navigateTo('/admin/kategorije')
  } catch (e) {
    alert(extractErrorMessage(e, t('auth.genericError')))
  }
}

// The proposal flow's reject: listings move to "Ostalo", the category is archived.
async function archiveCategory() {
  if (!confirm(t('admin.archiveCategoryConfirm', { name: category.value.name }))) return
  try {
    await api.post(`/admin/categories/${category.value.id}/reject`, {})
    await Promise.all([refresh(), refreshTree()])
  } catch (e) {
    alert(extractErrorMessage(e, t('auth.genericError')))
  }
}

async function restoreCategory() {
  try {
    await api.post(`/admin/categories/${category.value.id}/approve`, {})
    await Promise.all([refresh(), refreshTree()])
  } catch (e) {
    alert(extractErrorMessage(e, t('auth.genericError')))
  }
}

async function deleteCategory() {
  if (!confirm(t('admin.deleteCategoryConfirm', { name: category.value.name }))) return
  try {
    await api.delete(`/admin/categories/${category.value.id}`)
    await navigateTo('/admin/kategorije')
  } catch (e) {
    alert(extractErrorMessage(e, t('auth.genericError')))
  }
}

useSeoMeta({ title: () => category.value?.name || t('admin.categories') })
</script>

<style lang="scss" scoped>
.cat-counts {
  margin: -8px 0 16px;
}

.cat-tabs {
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.cat-card {
  margin-bottom: 20px;
}

.cat-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.cat-form .form-group {
  margin-bottom: 0;
}

.cat-hint {
  margin-top: 6px;
}

.cat-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 18px;
}

@include respond-above(md) {
  .cat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.cat-fieldset {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.cat-models {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 22px;
}

.cat-icons {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
  gap: 10px;
}

.cat-icon {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px 8px;
  border: 1px solid $color-border;
  border-radius: 12px;
  background: $color-surface;
  color: $color-text-muted;
  font-family: $font-family-base;
  cursor: pointer;
}

.cat-icon:hover,
.cat-icon.is-active {
  border-color: $color-primary;
  color: $color-primary;
}

.cat-icon.is-active {
  box-shadow: 0 0 0 3px $color-accent-tint;
}

.cat-icon-glyph {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 30px;
}

.cat-icon-glyph :deep(svg) {
  width: auto;
  max-width: 34px;
  height: 100%;
}

.cat-icon-name {
  max-width: 100%;
  font-size: 11px;
  line-height: 14px;
  color: $color-text-muted;
  overflow-wrap: anywhere;
  text-align: center;
}

.cat-image {
  display: block;
  width: 280px;
  max-width: 100%;
  margin-bottom: 10px;
  border-radius: 12px;
}

.cat-upload {
  cursor: pointer;
}

.cat-row-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.cat-saved {
  font-size: 14px;
  color: $color-success;
}

.cat-warning {
  padding: 10px 14px;
  border-radius: 12px;
  background: $color-accent-tint;
  font-size: 14px;
  color: $color-text;
}

// The card at the wizard grid's 280px column.
.cat-preview {
  width: 280px;
  max-width: 100%;
}

.cat-fields {
  display: flex;
  flex-direction: column;
  gap: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}

.cat-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 0;
  border-bottom: 1px solid $color-border;
}

.cat-field:last-child {
  border-bottom: 0;
}

.cat-diff {
  margin: 0;
  padding: 0;
  font-size: 13px;
  line-height: 19px;
  list-style: none;
  overflow-wrap: anywhere;
}

.cat-rule {
  width: 100%;
  margin: 4px 0;
  border: 0;
  border-top: 1px solid $color-border;
}
</style>
