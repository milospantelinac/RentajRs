<template>
  <div>
    <DashboardPageHeader :title="t('admin.categories')" :subtitle="t('admin.subtitle.categories')">
      <template #actions>
        <button class="btn btn-primary-flat btn-sm" @click="showCreate = !showCreate">{{ t('admin.newCategory') }}</button>
      </template>
    </DashboardPageHeader>

    <div v-if="showCreate" class="admin-card cat-card">
      <p class="admin-card-title">{{ t('admin.newCategory') }}</p>
      <div class="cat-grid">
        <div class="form-group">
          <label class="form-label">{{ t('admin.categoryName') }}</label>
          <input v-model="createForm.name" type="text" class="form-control" />
        </div>
        <div class="form-group">
          <label class="form-label">{{ t('admin.parentCategory') }}</label>
          <select v-model="createForm.parentId" class="form-control form-select">
            <option :value="undefined">-</option>
            <option v-for="c in tree" :key="c.id" :value="c.id">{{ indentLabel(c) }}</option>
          </select>
        </div>
      </div>
      <div class="form-group cat-wide">
        <label class="form-label">{{ t('admin.categoryShortDescription') }}</label>
        <input v-model="createForm.shortDescription" type="text" class="form-control" maxlength="120" />
      </div>
      <div class="cat-grid">
        <div class="form-group">
          <label class="form-label">{{ t('admin.bookingModel') }}</label>
          <select v-model="createForm.defaultBookingModel" class="form-control form-select">
            <option value="PER_STAY">PER_STAY</option>
            <option value="PER_SLOT">PER_SLOT</option>
            <option value="NO_BOOKING">NO_BOOKING</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">{{ t('listing.priceUnit') }}</label>
          <select v-model="createForm.defaultPriceUnit" class="form-control form-select">
            <option v-for="u in priceUnits" :key="u" :value="u">{{ u }}</option>
          </select>
        </div>
      </div>
      <div class="form-group cat-wide">
        <label class="form-label">{{ t('admin.allowedPriceUnits') }}</label>
        <div class="admin-switch">
          <button
            v-for="u in priceUnits"
            :key="u"
            type="button"
            class="admin-switch-btn"
            :class="{ 'is-active': createForm.allowedPriceUnits.includes(u) }"
            @click="toggleUnit(u)"
          >{{ u }}</button>
        </div>
      </div>
      <button class="btn btn-primary-flat btn-sm" @click="createCategory">{{ t('admin.create') }}</button>
    </div>

    <div class="admin-card admin-card-table">
      <StateBlock
        v-if="!tree?.length"
        icon="categories"
        :title="t('admin.empty.categories.title')"
        :text="t('admin.empty.categories.text')"
      />
      <table v-else class="admin-table">
        <thead>
          <tr>
            <th>{{ t('admin.categoryName') }}</th>
            <th>{{ t('admin.statusLabel') }}</th>
            <th>{{ t('admin.categoryOnSite') }}</th>
            <th>{{ t('admin.listingCount') }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in tree" :key="c.id">
            <td :data-label="t('admin.categoryName')">
              <span class="admin-cell-name cat-name" :style="{ marginLeft: `${(c.level - 1) * 18}px` }">{{ c.name }}</span>
            </td>
            <td :data-label="t('admin.statusLabel')">
              <span class="admin-pill" :class="c.status === 'ACTIVE' ? 'admin-pill-success' : 'admin-pill-neutral'">
                {{ t(`admin.categoryStatus.${c.status}`) }}
              </span>
            </td>
            <!-- Dizajn 50: "Prikaži na sajtu", which only means something for an active category. -->
            <td :data-label="t('admin.categoryOnSite')">
              <span v-if="c.status === 'ACTIVE'" class="admin-pill" :class="c.published ? 'admin-pill-success' : 'admin-pill-neutral'">
                {{ t(`admin.categoryVisibility.${c.published ? 'published' : 'hidden'}`) }}
              </span>
              <span v-else>-</span>
            </td>
            <td :data-label="t('admin.listingCount')">{{ c.listingCount }}</td>
            <td class="admin-cell-actions">
              <div class="admin-actions">
                <button v-if="c.status === 'ACTIVE'" class="admin-action" @click="togglePublished(c)">
                  {{ t(c.published ? 'admin.hideCategory' : 'admin.publishCategory') }}
                </button>
                <button class="admin-action" @click="selectedAttrCategory = c; loadAttributes()">{{ t('admin.attributes') }}</button>
                <button v-if="c.level > 1" class="admin-action" @click="promote(c.id)">{{ t('admin.promote') }}</button>
                <button v-if="c.status === 'ACTIVE'" class="admin-action" @click="openMerge(c)">{{ t('admin.merge') }}</button>
                <button v-if="c.status === 'ACTIVE'" class="admin-action" @click="archiveCategory(c)">{{ t('admin.archive') }}</button>
                <button v-else class="admin-action" @click="approveCategory(c.id)">{{ t('admin.restore') }}</button>
                <button class="admin-action admin-action-danger" @click="deleteCategory(c)">{{ t('common.delete') }}</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- T60 — "Otključaj svoju kategoriju" (Kategorije spec §8) parks these
         as DRAFT listings with pendingCategoryAssignment, but nothing ever
         surfaced them to an admin to actually resolve until now. -->
    <div class="admin-card">
      <div class="admin-card-head">
        <p class="admin-card-title">{{ t('admin.pendingCategoryListings') }}</p>
      </div>

      <StateBlock
        v-if="!pendingCategoryListings?.length"
        icon="categories"
        :title="t('admin.empty.pendingCategory.title')"
        :text="t('admin.empty.pendingCategory.text')"
      />

      <div v-else class="admin-card-body cat-list">
        <div v-for="l in pendingCategoryListings" :key="l.id" class="cat-row">
          <p class="admin-cell-name">{{ l.title }}</p>
          <p class="admin-card-note">{{ t('admin.proposedBy') }}: {{ l.user?.firstName }} {{ l.user?.lastName }} ({{ l.user?.email }})</p>
          <p class="admin-card-note">{{ t('admin.bookingModel') }}: {{ l.bookingModel }} · {{ t('listing.priceUnit') }}: {{ l.priceUnit }}</p>
          <p v-if="l.description" class="cat-description">{{ l.description }}</p>
          <div class="cat-row-actions">
            <select v-model="assignCategoryTarget[l.id]" class="admin-field cat-assign" :aria-label="t('admin.parentCategory')">
              <option value="">{{ t('admin.parentCategory') }}</option>
              <option v-for="c in tree" :key="c.id" :value="c.id">{{ indentLabel(c) }}</option>
            </select>
            <button
              class="btn btn-primary-flat btn-sm"
              :disabled="!assignCategoryTarget[l.id]"
              @click="assignCategory(l.id)"
            >{{ t('admin.assignCategory') }}</button>
          </div>
        </div>
      </div>
    </div>

    <div class="admin-card">
      <div class="admin-card-head">
        <p class="admin-card-title">{{ t('admin.proposedCategories') }}</p>
      </div>

      <StateBlock
        v-if="!proposed?.length"
        icon="categories"
        :title="t('admin.empty.proposed.title')"
        :text="t('admin.empty.proposed.text')"
      />

      <div v-else class="admin-card-body cat-list">
        <div v-for="p in proposed" :key="p.id" class="cat-row">
          <p class="admin-cell-name">{{ p.name }} <span class="cat-parent">({{ p.parentName || '-' }})</span></p>
          <p class="admin-card-note">
            {{ t('admin.proposedBy') }}: {{ p.proposedByUser?.firstName }} {{ p.proposedByUser?.lastName }} · {{ p.proposalCount }}x
          </p>
          <div class="cat-row-actions">
            <button class="btn btn-primary-flat btn-sm" @click="approveCategory(p.id)">{{ t('admin.approve') }}</button>
            <button class="btn btn-danger btn-sm" @click="rejectCategory(p.id)">{{ t('admin.reject') }}</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="selectedAttrCategory" class="admin-card admin-card-table">
      <div class="admin-card-head">
        <p class="admin-card-title">{{ selectedAttrCategory.name }}: {{ t('admin.attributes') }}</p>
        <button class="admin-action" @click="selectedAttrCategory = null">{{ t('common.close') }}</button>
      </div>

      <StateBlock
        v-if="!attributes.length"
        icon="categories"
        :title="t('admin.empty.attributes.title')"
        :text="t('admin.empty.attributes.text')"
      />

      <table v-else class="admin-table">
        <thead>
          <tr>
            <th>{{ t('listing.title') }}</th>
            <th>{{ t('admin.ownAttribute') }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="a in attributes" :key="a.id">
            <td :data-label="t('listing.title')">
              <div class="admin-cell-pair">
                <span class="admin-cell-name">{{ a.name }}</span>
                <span class="admin-cell-sub">{{ a.key }}, {{ a.type }}</span>
              </div>
            </td>
            <td :data-label="t('admin.ownAttribute')">
              <span class="admin-pill" :class="a.categoryId === selectedAttrCategory.id ? 'admin-pill-success' : 'admin-pill-neutral'">
                {{ a.categoryId === selectedAttrCategory.id ? t('common.yes') : t('admin.inherited') }}
              </span>
            </td>
            <td class="admin-cell-actions">
              <div class="admin-actions">
                <button
                  v-if="a.categoryId === selectedAttrCategory.id"
                  class="admin-action admin-action-danger"
                  @click="deleteAttribute(a.id)"
                >{{ t('common.delete') }}</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="admin-card-body cat-attr-form">
        <p class="admin-card-title">{{ t('admin.addAttribute') }}</p>
        <div class="cat-grid cat-grid-4">
          <div class="form-group">
            <label class="form-label">{{ t('admin.attrKey') }}</label>
            <input v-model="attrForm.key" type="text" class="form-control" />
          </div>
          <div class="form-group">
            <label class="form-label">{{ t('admin.categoryName') }}</label>
            <input v-model="attrForm.name" type="text" class="form-control" />
          </div>
          <div class="form-group">
            <label class="form-label">{{ t('admin.attrType') }}</label>
            <select v-model="attrForm.type" class="form-control form-select">
              <option v-for="ty in ['NUMBER', 'TEXT', 'LIST', 'MULTISELECT', 'BOOLEAN']" :key="ty" :value="ty">{{ ty }}</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">{{ t('admin.attrUnit') }}</label>
            <input v-model="attrForm.unit" type="text" class="form-control" />
          </div>
        </div>
        <div v-if="['LIST', 'MULTISELECT'].includes(attrForm.type)" class="form-group cat-wide">
          <label class="form-label">{{ t('admin.attrOptions') }}</label>
          <input v-model="attrForm.optionsRaw" type="text" class="form-control" placeholder="wifi:Wi-Fi, parking:Parking" />
        </div>
        <div class="cat-checks">
          <label class="admin-check-row">
            <input v-model="attrForm.required" type="checkbox" class="admin-check" /> {{ t('admin.attrRequired') }}
          </label>
          <label class="admin-check-row">
            <input v-model="attrForm.isFilter" type="checkbox" class="admin-check" /> {{ t('admin.attrIsFilter') }}
          </label>
        </div>
        <button class="btn btn-primary-flat btn-sm" @click="upsertAttribute">{{ t('common.save') }}</button>
      </div>
    </div>

    <div v-if="mergeTarget" class="admin-modal-backdrop" @click.self="mergeTarget = null">
      <div class="admin-modal admin-card">
        <div class="admin-card-body">
          <p class="admin-card-title">{{ t('admin.merge') }}</p>
          <p class="admin-card-note mb-3">{{ mergeTarget.name }}</p>
          <div class="form-group mb-4">
            <label class="form-label">{{ t('admin.mergeInto') }}</label>
            <select v-model="mergeInto" class="form-control form-select">
              <option v-for="c in mergeOptions" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </div>
          <div class="cat-row-actions">
            <button class="btn btn-danger btn-sm" @click="confirmMerge">{{ t('admin.merge') }}</button>
            <button class="btn btn-tertiary btn-sm" @click="mergeTarget = null">{{ t('common.cancel') }}</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })
const { t } = useI18n()
const api = useApi()

const priceUnits = ['NIGHT', 'DAY', 'HOUR', 'SLOT', 'MONTH', 'YEAR']

const { data: tree, refresh: refreshTree } = await useAsyncData('admin-categories', () => api.get('/admin/categories'))
const { data: proposed, refresh: refreshProposed } = await useAsyncData('admin-categories-proposed', () => api.get('/admin/categories/proposed'))
const { data: pendingCategoryListings, refresh: refreshPendingCategoryListings } = await useAsyncData(
  'admin-listings-pending-category',
  () => api.get('/admin/listings/pending-category'),
)

// A child sits under its parent in a <select> too, where only spacing can
// show the level.
function indentLabel(c) {
  return `${' '.repeat((c.level - 1) * 3)}${c.name}`
}

const mergeOptions = computed(() => (tree.value || []).filter((c) => c.id !== mergeTarget.value?.id))

const assignCategoryTarget = reactive({})
async function assignCategory(listingId) {
  const categoryId = assignCategoryTarget[listingId]
  if (!categoryId) return
  await api.patch(`/admin/listings/${listingId}/category`, { categoryId })
  delete assignCategoryTarget[listingId]
  await refreshPendingCategoryListings()
}

const showCreate = ref(false)
const createForm = reactive({
  name: '', shortDescription: '', parentId: undefined, defaultBookingModel: 'PER_STAY', defaultPriceUnit: 'NIGHT', allowedPriceUnits: ['NIGHT'],
})

function toggleUnit(u) {
  const i = createForm.allowedPriceUnits.indexOf(u)
  if (i === -1) createForm.allowedPriceUnits.push(u)
  else createForm.allowedPriceUnits.splice(i, 1)
}

async function createCategory() {
  await api.post('/admin/categories', createForm)
  showCreate.value = false
  createForm.name = ''
  createForm.shortDescription = ''
  await refreshTree()
}

async function approveCategory(id) {
  await api.post(`/admin/categories/${id}/approve`, {})
  await Promise.all([refreshTree(), refreshProposed()])
}

async function rejectCategory(id) {
  const reason = prompt(t('admin.reason')) || undefined
  await api.post(`/admin/categories/${id}/reject`, { reason })
  await refreshProposed()
}

async function promote(id) {
  await api.post(`/admin/categories/${id}/promote`, {})
  await refreshTree()
}

// Dizajn 50: shows or hides an active category everywhere the site lists
// categories. Ostalo is the one that starts hidden, waiting for the owner.
async function togglePublished(c) {
  const confirmKey = c.published ? 'admin.hideCategoryConfirm' : 'admin.publishCategoryConfirm'
  if (!confirm(t(confirmKey, { name: c.name }))) return
  try {
    await api.patch(`/admin/categories/${c.id}`, { published: !c.published })
    await refreshTree()
  } catch (e) {
    alert(extractErrorMessage(e, t('auth.genericError')))
  }
}

// Reuses the same endpoint the proposal-rejection flow calls — it already
// reassigns any listings to the "Ostalo" fallback and archives the category,
// which is exactly what "archive an existing category" needs too.
async function archiveCategory(c) {
  if (!confirm(t('admin.archiveCategoryConfirm', { name: c.name }))) return
  try {
    await api.post(`/admin/categories/${c.id}/reject`, {})
    await refreshTree()
  } catch (e) {
    alert(extractErrorMessage(e, t('auth.genericError')))
  }
}

async function deleteCategory(c) {
  if (!confirm(t('admin.deleteCategoryConfirm', { name: c.name }))) return
  try {
    await api.delete(`/admin/categories/${c.id}`)
    await refreshTree()
  } catch (e) {
    alert(extractErrorMessage(e, t('auth.genericError')))
  }
}

const mergeTarget = ref(null)
const mergeInto = ref('')
function openMerge(c) {
  mergeTarget.value = c
  mergeInto.value = ''
}
async function confirmMerge() {
  if (!mergeInto.value) return
  await api.post(`/admin/categories/${mergeTarget.value.id}/merge`, { targetCategoryId: mergeInto.value })
  mergeTarget.value = null
  await refreshTree()
}

const selectedAttrCategory = ref(null)
const attributes = ref([])
const attrForm = reactive({ key: '', name: '', type: 'TEXT', unit: '', required: false, isFilter: false, optionsRaw: '' })

async function loadAttributes() {
  const category = await api.get(`/categories/${selectedAttrCategory.value.slug}`)
  attributes.value = category.attributes
  attrForm.key = ''
  attrForm.name = ''
  attrForm.type = 'TEXT'
  attrForm.unit = ''
  attrForm.required = false
  attrForm.isFilter = false
  attrForm.optionsRaw = ''
}

async function upsertAttribute() {
  const options = ['LIST', 'MULTISELECT'].includes(attrForm.type) && attrForm.optionsRaw
    ? attrForm.optionsRaw.split(',').map((pair) => {
        const [key, name] = pair.split(':').map((s) => s.trim())
        return { key, name: name || key }
      })
    : undefined
  await api.post(`/admin/categories/${selectedAttrCategory.value.id}/attributes`, {
    key: attrForm.key,
    name: attrForm.name,
    type: attrForm.type,
    unit: attrForm.unit || undefined,
    required: attrForm.required,
    isFilter: attrForm.isFilter,
    options,
  })
  await loadAttributes()
}

async function deleteAttribute(id) {
  if (!confirm(t('common.delete') + '?')) return
  await api.delete(`/admin/attributes/${id}`)
  await loadAttributes()
}

useSeoMeta({ title: t('admin.categories') })
</script>

<style lang="scss" scoped>
.cat-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 18px;
  padding: 22px 24px;
  margin-bottom: 20px;
}

// Two fields to a line above 768, four on the attribute form above 992.
.cat-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 18px;
  width: 100%;
}

.cat-wide {
  width: 100%;
}

@include respond-above(md) {
  .cat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@include respond-above(lg) {
  .cat-grid-4 {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

// The tree's depth, 18 a level, instead of a run of dashes in the cell.
.cat-name {
  display: inline-block;
}

.cat-list {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding-top: 0;
}

.cat-row {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  padding: 18px 0;
  border-bottom: 1px solid $color-border;
}

.cat-row:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.cat-parent {
  font-size: 13px;
  font-weight: 300;
  color: $color-text-muted;
}

.cat-description {
  font-size: 14px;
  font-weight: 400;
  line-height: 21px;
  color: $color-text;
  overflow-wrap: anywhere;
}

.cat-row-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}

.cat-assign {
  width: 260px;
  max-width: 100%;
}

.cat-attr-form {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 18px;
  border-top: 1px solid $color-border;
}

.cat-checks {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
}

@include mobile-only {
  .cat-card {
    padding: 18px 16px;
  }
}
</style>
