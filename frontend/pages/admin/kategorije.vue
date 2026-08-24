<template>
  <div>
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h2 class="text-section-title">{{ t('admin.categories') }}</h2>
      <button class="btn btn-primary-flat btn-sm" @click="showCreate = !showCreate">{{ t('admin.newCategory') }}</button>
    </div>

    <div v-if="showCreate" class="card mb-4">
      <div class="card-body">
        <div class="row">
          <div class="col-12 col-md-6">
            <div class="form-group mb-3">
              <label class="form-label">{{ t('admin.categoryName') }}</label>
              <input v-model="createForm.name" type="text" class="form-control" />
            </div>
          </div>
          <div class="col-12 col-md-6">
            <div class="form-group mb-3">
              <label class="form-label">{{ t('admin.parentCategory') }}</label>
              <select v-model="createForm.parentId" class="form-control form-select">
                <option :value="undefined">—</option>
                <option v-for="c in tree" :key="c.id" :value="c.id">{{ '—'.repeat(c.level - 1) }} {{ c.name }}</option>
              </select>
            </div>
          </div>
          <div class="col-12 col-md-6">
            <div class="form-group mb-3">
              <label class="form-label">{{ t('admin.bookingModel') }}</label>
              <select v-model="createForm.defaultBookingModel" class="form-control form-select">
                <option value="PER_STAY">PER_STAY</option>
                <option value="PER_SLOT">PER_SLOT</option>
                <option value="NO_BOOKING">NO_BOOKING</option>
              </select>
            </div>
          </div>
          <div class="col-12 col-md-6">
            <div class="form-group mb-3">
              <label class="form-label">{{ t('listing.priceUnit') }}</label>
              <select v-model="createForm.defaultPriceUnit" class="form-control form-select">
                <option v-for="u in priceUnits" :key="u" :value="u">{{ u }}</option>
              </select>
            </div>
          </div>
          <div class="col-12">
            <div class="form-group mb-3">
              <label class="form-label">{{ t('admin.allowedPriceUnits') }}</label>
              <div class="tag-options">
                <button
                  v-for="u in priceUnits"
                  :key="u"
                  type="button"
                  class="btn btn-sm"
                  :class="createForm.allowedPriceUnits.includes(u) ? 'btn-primary-flat' : 'btn-tertiary'"
                  @click="toggleUnit(u)"
                >{{ u }}</button>
              </div>
            </div>
          </div>
        </div>
        <button class="btn btn-primary-flat btn-sm" @click="createCategory">{{ t('admin.create') }}</button>
      </div>
    </div>

    <table class="table table-responsive-cards mb-4">
      <thead>
        <tr>
          <th>{{ t('admin.categoryName') }}</th>
          <th>{{ t('admin.statusLabel') }}</th>
          <th>{{ t('admin.listingCount') }}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="c in tree" :key="c.id">
          <td :data-label="t('admin.categoryName')">{{ '—'.repeat(c.level - 1) }} {{ c.name }}</td>
          <td :data-label="t('admin.statusLabel')">
            <span class="badge" :class="c.status === 'ACTIVE' ? 'badge-success' : 'badge-neutral'">{{ c.status }}</span>
          </td>
          <td :data-label="t('admin.listingCount')">{{ c.listingCount }}</td>
          <td :data-label="''">
            <button class="btn btn-tertiary btn-sm" @click="selectedAttrCategory = c; loadAttributes()">{{ t('admin.attributes') }}</button>
            <button v-if="c.level > 1" class="btn btn-tertiary btn-sm" @click="promote(c.id)">{{ t('admin.promote') }}</button>
            <button v-if="c.status === 'ACTIVE'" class="btn btn-tertiary btn-sm" @click="openMerge(c)">{{ t('admin.merge') }}</button>
            <button v-if="c.status === 'ACTIVE'" class="btn btn-tertiary btn-sm" @click="archiveCategory(c)">{{ t('admin.archive') }}</button>
            <button v-else class="btn btn-tertiary btn-sm" @click="approveCategory(c.id)">{{ t('admin.restore') }}</button>
            <button class="btn btn-danger btn-sm" @click="deleteCategory(c)">{{ t('common.delete') }}</button>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- T60 — "Otključaj svoju kategoriju" (Kategorije spec §8) parks these
         as DRAFT listings with pendingCategoryAssignment, but nothing ever
         surfaced them to an admin to actually resolve until now. -->
    <h2 class="text-section-title mb-3">{{ t('admin.pendingCategoryListings') }}</h2>
    <p v-if="!pendingCategoryListings?.length" class="text-muted mb-4">{{ t('admin.noItems') }}</p>
    <div v-for="l in pendingCategoryListings" :key="l.id" class="card mb-3">
      <div class="card-body">
        <p class="text-body mb-1"><strong>{{ l.title }}</strong></p>
        <p class="text-muted mb-1">{{ t('admin.proposedBy') }}: {{ l.user?.firstName }} {{ l.user?.lastName }} ({{ l.user?.email }})</p>
        <p class="text-muted mb-1">{{ t('admin.bookingModel') }}: {{ l.bookingModel }} · {{ t('listing.priceUnit') }}: {{ l.priceUnit }}</p>
        <p v-if="l.description" class="text-muted mb-2">{{ l.description }}</p>
        <div class="d-flex reply-actions">
          <select v-model="assignCategoryTarget[l.id]" class="form-control form-select">
            <option value="">{{ t('admin.parentCategory') }}</option>
            <option v-for="c in tree" :key="c.id" :value="c.id">{{ '—'.repeat(c.level - 1) }} {{ c.name }}</option>
          </select>
          <button
            class="btn btn-primary-flat btn-sm"
            :disabled="!assignCategoryTarget[l.id]"
            @click="assignCategory(l.id)"
          >{{ t('admin.assignCategory') }}</button>
        </div>
      </div>
    </div>

    <h2 class="text-section-title mb-3">{{ t('admin.proposedCategories') }}</h2>
    <p v-if="!proposed?.length" class="text-muted mb-4">{{ t('admin.noItems') }}</p>
    <div v-for="p in proposed" :key="p.id" class="card mb-3">
      <div class="card-body">
        <p class="text-body"><strong>{{ p.name }}</strong> <span class="text-muted">({{ p.parentName || '—' }})</span></p>
        <p class="text-muted mb-2">{{ t('admin.proposedBy') }}: {{ p.proposedByUser?.firstName }} {{ p.proposedByUser?.lastName }} · {{ p.proposalCount }}×</p>
        <div class="d-flex reply-actions">
          <button class="btn btn-primary-flat btn-sm" @click="approveCategory(p.id)">{{ t('admin.approve') }}</button>
          <button class="btn btn-danger btn-sm" @click="rejectCategory(p.id)">{{ t('admin.reject') }}</button>
        </div>
      </div>
    </div>

    <div v-if="selectedAttrCategory" class="card mb-4">
      <div class="card-body">
        <h2 class="text-section-title mb-3">{{ selectedAttrCategory.name }} — {{ t('admin.attributes') }}</h2>
        <table v-if="attributes.length" class="table table-responsive-cards mb-3">
          <thead>
            <tr>
              <th>{{ t('listing.title') }}</th>
              <th>{{ t('admin.ownAttribute') }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in attributes" :key="a.id">
              <td :data-label="t('listing.title')">{{ a.name }} <span class="text-muted">({{ a.key }}, {{ a.type }})</span></td>
              <td :data-label="t('admin.ownAttribute')">
                <span class="badge" :class="a.categoryId === selectedAttrCategory.id ? 'badge-success' : 'badge-neutral'">
                  {{ a.categoryId === selectedAttrCategory.id ? t('common.yes') : t('admin.inherited') }}
                </span>
              </td>
              <td :data-label="''">
                <button v-if="a.categoryId === selectedAttrCategory.id" class="btn btn-danger btn-sm" @click="deleteAttribute(a.id)">
                  {{ t('common.delete') }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <h3 class="text-label mb-2">{{ t('admin.addAttribute') }}</h3>
        <div class="row">
          <div class="col-6 col-md-3">
            <div class="form-group mb-2">
              <label class="form-label">{{ t('admin.attrKey') }}</label>
              <input v-model="attrForm.key" type="text" class="form-control" />
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="form-group mb-2">
              <label class="form-label">{{ t('admin.categoryName') }}</label>
              <input v-model="attrForm.name" type="text" class="form-control" />
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="form-group mb-2">
              <label class="form-label">{{ t('admin.attrType') }}</label>
              <select v-model="attrForm.type" class="form-control form-select">
                <option v-for="ty in ['NUMBER', 'TEXT', 'LIST', 'MULTISELECT', 'BOOLEAN']" :key="ty" :value="ty">{{ ty }}</option>
              </select>
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="form-group mb-2">
              <label class="form-label">{{ t('admin.attrUnit') }}</label>
              <input v-model="attrForm.unit" type="text" class="form-control" />
            </div>
          </div>
          <div class="col-12" v-if="['LIST', 'MULTISELECT'].includes(attrForm.type)">
            <div class="form-group mb-2">
              <label class="form-label">{{ t('admin.attrOptions') }}</label>
              <input v-model="attrForm.optionsRaw" type="text" class="form-control" placeholder="wifi:Wi-Fi, parking:Parking" />
            </div>
          </div>
          <div class="col-12">
            <label class="form-label mr-2">
              <input v-model="attrForm.required" type="checkbox" /> {{ t('admin.attrRequired') }}
            </label>
            <label class="form-label ml-3">
              <input v-model="attrForm.isFilter" type="checkbox" /> {{ t('admin.attrIsFilter') }}
            </label>
          </div>
        </div>
        <button class="btn btn-primary-flat btn-sm mt-2" @click="upsertAttribute">{{ t('common.save') }}</button>
      </div>
    </div>

    <div v-if="mergeTarget" class="modal-backdrop" @click.self="mergeTarget = null">
      <div class="modal-panel card">
        <div class="card-body">
          <h3 class="text-section-title mb-3">{{ t('admin.merge') }}: {{ mergeTarget.name }}</h3>
          <div class="form-group mb-3">
            <label class="form-label">{{ t('admin.mergeInto') }}</label>
            <select v-model="mergeInto" class="form-control form-select">
              <option v-for="c in tree.filter((c) => c.id !== mergeTarget.id)" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </div>
          <div class="d-flex reply-actions">
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
  name: '', parentId: undefined, defaultBookingModel: 'PER_STAY', defaultPriceUnit: 'NIGHT', allowedPriceUnits: ['NIGHT'],
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
.tag-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.reply-actions {
  gap: 8px;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
}

.modal-panel {
  width: 100%;
  max-width: 420px;
}
</style>
