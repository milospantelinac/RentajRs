<template>
  <div>
    <DashboardPageHeader :title="t('admin.categories')" :subtitle="t('admin.subtitle.categories')">
      <template #actions>
        <button class="btn btn-primary-flat btn-sm" @click="openCreate">{{ t('admin.newCategory') }}</button>
      </template>
    </DashboardPageHeader>

    <!-- T129: the panel's rules: search, live counts, order by dragging, and
         "Sakrij" offered where a delete would orphan listings. Everything a
         category holds is edited on its own screen (kategorije/[id]). -->
    <div class="admin-filters">
      <input
        v-model="search"
        type="search"
        class="admin-field admin-field-search"
        :placeholder="t('admin.cat.searchPlaceholder')"
        :aria-label="t('admin.cat.searchPlaceholder')"
      />
      <p v-if="!search" class="admin-card-note cat-drag-hint">{{ t('admin.cat.dragHint') }}</p>
    </div>
    <p v-if="notice" class="cat-notice" role="status">{{ notice }}</p>

    <div class="admin-card admin-card-table">
      <StateBlock
        v-if="!tree?.length"
        icon="categories"
        :title="t('admin.empty.categories.title')"
        :text="t('admin.empty.categories.text')"
      />
      <p v-else-if="!rows.length" class="admin-card-body admin-card-note">{{ t('admin.cat.noResults') }}</p>
      <table v-else class="admin-table cat-table">
        <thead>
          <tr>
            <th class="cat-col-handle"><span class="visually-hidden">{{ t('admin.cat.dragHandle') }}</span></th>
            <th>{{ t('admin.categoryName') }}</th>
            <th>{{ t('admin.statusLabel') }}</th>
            <th>{{ t('admin.listingCount') }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="c in rows"
            :key="c.id"
            :draggable="canDrag"
            :class="{ 'cat-row-dragging': dragId === c.id, 'cat-row-over': overId === c.id }"
            @dragstart="onDragStart(c, $event)"
            @dragover="onDragOver(c, $event)"
            @dragleave="overId = overId === c.id ? null : overId"
            @drop="onDrop(c, $event)"
            @dragend="onDragEnd"
          >
            <td class="cat-col-handle">
              <span v-if="canDrag" class="cat-handle" :title="t('admin.cat.dragHandle')" aria-hidden="true">⋮⋮</span>
            </td>
            <td :data-label="t('admin.categoryName')">
              <div class="admin-cell-pair" :style="{ paddingLeft: `${(c.level - 1) * 22}px` }">
                <NuxtLink :to="`/admin/kategorije/${c.id}`" class="admin-cell-name cat-link">{{ c.name }}</NuxtLink>
                <span class="admin-cell-sub">/{{ c.slug }}</span>
              </div>
            </td>
            <td :data-label="t('admin.statusLabel')">
              <span v-if="c.status !== 'ACTIVE'" class="admin-pill admin-pill-neutral">{{ t(`admin.categoryStatus.${c.status}`) }}</span>
              <!-- Dizajn 50: "Prikaži na sajtu", which only means something for an active category. -->
              <span v-else class="admin-pill" :class="c.published ? 'admin-pill-success' : 'admin-pill-warning'">
                {{ c.published ? t('admin.categoryVisibility.published') : t('admin.cat.draft') }}
              </span>
            </td>
            <td :data-label="t('admin.listingCount')">
              {{ t('admin.cat.activeOfTotal', { active: c.activeListingCount, total: c.listingCount }) }}
            </td>
            <td class="admin-cell-actions">
              <div class="admin-actions cat-actions">
                <NuxtLink :to="`/admin/kategorije/${c.id}`" class="admin-action">{{ t('admin.cat.open') }}</NuxtLink>
                <button v-if="c.status === 'ACTIVE'" class="admin-action" @click="togglePublished(c)">
                  {{ t(c.published ? 'admin.hideCategory' : 'admin.publishCategory') }}
                </button>
                <!-- Tablets have no HTML drag; the arrows do the same. -->
                <template v-if="canDrag">
                  <button
                    class="admin-action cat-arrow"
                    :disabled="isFirst(c)"
                    :aria-label="t('admin.cat.moveUp')"
                    :title="t('admin.cat.moveUp')"
                    @click="moveBy(c, -1)"
                  >↑</button>
                  <button
                    class="admin-action cat-arrow"
                    :disabled="isLast(c)"
                    :aria-label="t('admin.cat.moveDown')"
                    :title="t('admin.cat.moveDown')"
                    @click="moveBy(c, 1)"
                  >↓</button>
                </template>
                <button class="admin-action admin-action-danger" @click="deleteCategory(c)">{{ t('common.delete') }}</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- T60: "Otključaj svoju kategoriju" (Kategorije spec §8) parks these
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
              <option v-for="c in ordered" :key="c.id" :value="c.id">{{ indentLabel(c) }}</option>
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

    <div v-if="showCreate" class="admin-modal-backdrop" @click.self="showCreate = false">
      <form class="admin-modal admin-card cat-modal" @submit.prevent="createCategory">
        <div class="admin-card-body cat-form">
          <p class="admin-card-title">{{ t('admin.newCategory') }}</p>
          <div class="form-group">
            <label class="form-label" for="cat-new-name">{{ t('admin.categoryName') }}</label>
            <input id="cat-new-name" v-model="createForm.name" type="text" class="form-control" maxlength="100" required />
          </div>
          <div class="form-group">
            <label class="form-label" for="cat-new-parent">{{ t('admin.parentCategory') }}</label>
            <select id="cat-new-parent" v-model="createForm.parentId" class="form-control form-select">
              <option :value="null">{{ t('admin.cat.noParent') }}</option>
              <option v-for="c in parentOptions" :key="c.id" :value="c.id">{{ indentLabel(c) }}</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="cat-new-copy">{{ t('admin.cat.copyFrom') }}</label>
            <select id="cat-new-copy" v-model="createForm.copyFromId" class="form-control form-select">
              <option :value="null">{{ t('admin.cat.copyFromNone') }}</option>
              <option v-for="c in ordered" :key="c.id" :value="c.id">{{ indentLabel(c) }}</option>
            </select>
            <p class="admin-card-note cat-hint">{{ t('admin.cat.copyFromHint') }}</p>
          </div>
          <template v-if="!createForm.copyFromId">
            <div class="cat-grid">
              <div class="form-group">
                <label class="form-label" for="cat-new-model">{{ t('admin.bookingModel') }}</label>
                <select id="cat-new-model" v-model="createForm.defaultBookingModel" class="form-control form-select">
                  <option v-for="m in bookingModels" :key="m" :value="m">{{ m }}</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label" for="cat-new-unit">{{ t('listing.priceUnit') }}</label>
                <select id="cat-new-unit" v-model="createForm.defaultPriceUnit" class="form-control form-select">
                  <option v-for="u in createForm.allowedPriceUnits" :key="u" :value="u">{{ u }}</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <p class="form-label">{{ t('admin.allowedPriceUnits') }}</p>
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
          </template>
          <label class="admin-check-row">
            <input v-model="createForm.published" type="checkbox" class="admin-check" /> {{ t('admin.cat.publishNow') }}
          </label>
          <p class="admin-card-note cat-hint">{{ t('admin.cat.publishNowHint') }}</p>
          <p v-if="createError" class="form-error">{{ createError }}</p>
          <div class="cat-row-actions">
            <button type="submit" class="btn btn-primary-flat btn-sm" :disabled="creating || !createForm.name.trim()">
              {{ t('admin.cat.createAndOpen') }}
            </button>
            <button type="button" class="btn btn-tertiary btn-sm" @click="showCreate = false">{{ t('common.cancel') }}</button>
          </div>
        </div>
      </form>
    </div>

    <div v-if="inUse" class="admin-modal-backdrop" @click.self="inUse = null">
      <div class="admin-modal admin-card" role="dialog" aria-modal="true" :aria-label="t('admin.cat.inUseTitle')">
        <div class="admin-card-body cat-form">
          <p class="admin-card-title">{{ t('admin.cat.inUseTitle') }}</p>
          <p class="cat-description">
            {{
              inUse.listingCount
                ? t('admin.cat.inUseListings', { name: inUse.category.name, count: inUse.listingCount })
                : t('admin.cat.inUseChildren', { name: inUse.category.name, count: inUse.childCount })
            }}
          </p>
          <p v-if="!inUse.category.published" class="admin-card-note">{{ t('admin.cat.alreadyHidden') }}</p>
          <div class="cat-row-actions">
            <button
              v-if="inUse.category.published && inUse.category.status === 'ACTIVE'"
              class="btn btn-primary-flat btn-sm"
              @click="hideInstead"
            >{{ t('admin.cat.hideInstead') }}</button>
            <button class="btn btn-tertiary btn-sm" @click="inUse = null">{{ t('common.close') }}</button>
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

const priceUnits = ['NIGHT', 'DAY', 'HOUR', 'SLOT', 'MONTH', 'YEAR', 'GUEST']
const bookingModels = ['PER_STAY', 'PER_SLOT', 'NO_BOOKING']

const { data: tree, refresh: refreshTree } = await useAsyncData('admin-categories', () => api.get('/admin/categories'))
const { data: proposed, refresh: refreshProposed } = await useAsyncData('admin-categories-proposed', () => api.get('/admin/categories/proposed'))
const { data: pendingCategoryListings, refresh: refreshPendingCategoryListings } = await useAsyncData(
  'admin-listings-pending-category',
  () => api.get('/admin/listings/pending-category'),
)

// A child sits under its parent in a <select> too, where only spacing can
// show the level. Non-breaking, because an <option> drops ordinary spaces.
function indentLabel(c) {
  return `${'\u00a0'.repeat((c.level - 1) * 4)}${c.name}`
}

// The endpoint sends the tree level by level; the table shows each category
// followed by its subcategories, siblings in their displayOrder.
const ordered = computed(() => {
  const all = tree.value || []
  const byParent = new Map()
  for (const c of all) {
    const key = c.parentId || 'root'
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key).push(c)
  }
  for (const list of byParent.values()) list.sort((a, b) => a.displayOrder - b.displayOrder)
  const out = []
  const walk = (key) => {
    for (const c of byParent.get(key) || []) {
      out.push(c)
      walk(c.id)
    }
  }
  walk('root')
  // A category whose parent is missing would never be reached from the root.
  const seen = new Set(out.map((c) => c.id))
  return out.concat(all.filter((c) => !seen.has(c.id)))
})

const search = ref('')
const rows = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return ordered.value
  return ordered.value.filter((c) => c.name.toLowerCase().includes(q) || c.slug.includes(q))
})

// A search shows rows out of their levels, so the order is only changed on the full list.
const canDrag = computed(() => !search.value.trim())

const notice = ref('')
let noticeTimer
function flash(message) {
  notice.value = message
  clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => (notice.value = ''), 3000)
}

function siblingsOf(c) {
  return ordered.value.filter((other) => (other.parentId || null) === (c.parentId || null))
}
const isFirst = (c) => siblingsOf(c)[0]?.id === c.id
const isLast = (c) => siblingsOf(c).at(-1)?.id === c.id

async function saveOrder(parentId, ids) {
  try {
    await api.patch('/admin/categories/reorder', { parentId: parentId || null, ids })
    flash(t('admin.cat.orderSaved'))
  } catch (e) {
    alert(extractErrorMessage(e, t('auth.genericError')))
  }
  await refreshTree()
}

function moveBy(c, step) {
  const ids = siblingsOf(c).map((s) => s.id)
  const from = ids.indexOf(c.id)
  const to = from + step
  if (to < 0 || to >= ids.length) return
  ids.splice(to, 0, ids.splice(from, 1)[0])
  return saveOrder(c.parentId, ids)
}

// HTML drag and drop, within one level: a row dropped on a sibling takes its place.
const dragId = ref(null)
const overId = ref(null)
const dragged = computed(() => ordered.value.find((c) => c.id === dragId.value))
const sameLevel = (a, b) => a && b && (a.parentId || null) === (b.parentId || null)

function onDragStart(c, event) {
  if (!canDrag.value) return
  dragId.value = c.id
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', c.id)
}
function onDragOver(c, event) {
  if (!sameLevel(dragged.value, c) || c.id === dragId.value) return
  event.preventDefault()
  event.dataTransfer.dropEffect = 'move'
  overId.value = c.id
}
function onDrop(c, event) {
  event.preventDefault()
  const source = dragged.value
  onDragEnd()
  if (!sameLevel(source, c) || source.id === c.id) return
  const ids = siblingsOf(c).map((s) => s.id)
  const from = ids.indexOf(source.id)
  const to = ids.indexOf(c.id)
  ids.splice(to, 0, ids.splice(from, 1)[0])
  return saveOrder(c.parentId, ids)
}
function onDragEnd() {
  dragId.value = null
  overId.value = null
}

const assignCategoryTarget = reactive({})
async function assignCategory(listingId) {
  const categoryId = assignCategoryTarget[listingId]
  if (!categoryId) return
  await api.patch(`/admin/listings/${listingId}/category`, { categoryId })
  delete assignCategoryTarget[listingId]
  await refreshPendingCategoryListings()
}

// A new category goes under a main category at most: the site shows two levels.
const parentOptions = computed(() => (tree.value || []).filter((c) => c.level === 1 && c.status === 'ACTIVE'))

const showCreate = ref(false)
const creating = ref(false)
const createError = ref('')
const createForm = reactive({
  name: '',
  parentId: null,
  copyFromId: null,
  defaultBookingModel: 'PER_STAY',
  defaultPriceUnit: 'NIGHT',
  allowedPriceUnits: ['NIGHT'],
  published: false,
})

function openCreate() {
  Object.assign(createForm, {
    name: '',
    parentId: null,
    copyFromId: null,
    defaultBookingModel: 'PER_STAY',
    defaultPriceUnit: 'NIGHT',
    allowedPriceUnits: ['NIGHT'],
    published: false,
  })
  createError.value = ''
  showCreate.value = true
}

function toggleUnit(u) {
  const i = createForm.allowedPriceUnits.indexOf(u)
  if (i === -1) createForm.allowedPriceUnits.push(u)
  else if (createForm.allowedPriceUnits.length > 1) createForm.allowedPriceUnits.splice(i, 1)
  if (!createForm.allowedPriceUnits.includes(createForm.defaultPriceUnit)) {
    createForm.defaultPriceUnit = createForm.allowedPriceUnits[0]
  }
}

async function createCategory() {
  const source = (tree.value || []).find((c) => c.id === createForm.copyFromId)
  creating.value = true
  createError.value = ''
  try {
    const category = await api.post('/admin/categories', {
      name: createForm.name.trim(),
      parentId: createForm.parentId || undefined,
      copyFromId: source?.id,
      defaultBookingModel: source?.defaultBookingModel ?? createForm.defaultBookingModel,
      defaultPriceUnit: source?.defaultPriceUnit ?? createForm.defaultPriceUnit,
      allowedPriceUnits: source?.allowedPriceUnits ?? createForm.allowedPriceUnits,
      icon: source?.icon ?? undefined,
      published: createForm.published,
    })
    showCreate.value = false
    await navigateTo(`/admin/kategorije/${category.id}`)
  } catch (e) {
    createError.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    creating.value = false
  }
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

// T129: a category in use is never deleted blind. The counts here are live,
// so the dialog usually opens before asking the server; the server refuses
// the same cases with the same counts (deleted listings count there too).
const inUse = ref(null)
const childCountOf = (c) => (tree.value || []).filter((other) => other.parentId === c.id).length

async function deleteCategory(c) {
  const childCount = childCountOf(c)
  if (c.listingCount > 0 || childCount > 0) {
    inUse.value = { category: c, listingCount: c.listingCount, childCount }
    return
  }
  if (!confirm(t('admin.deleteCategoryConfirm', { name: c.name }))) return
  try {
    await api.delete(`/admin/categories/${c.id}`)
    await refreshTree()
  } catch (e) {
    const code = e?.data?.code
    if (code === 'CATEGORY_HAS_LISTINGS' || code === 'CATEGORY_HAS_CHILDREN') {
      inUse.value = { category: c, listingCount: e.data.listingCount || 0, childCount: e.data.childCount || 0 }
    } else {
      alert(extractErrorMessage(e, t('auth.genericError')))
    }
  }
}

async function hideInstead() {
  const { category } = inUse.value
  try {
    await api.patch(`/admin/categories/${category.id}`, { published: false })
    inUse.value = null
    await refreshTree()
  } catch (e) {
    alert(extractErrorMessage(e, t('auth.genericError')))
  }
}

useSeoMeta({ title: t('admin.categories') })
</script>

<style lang="scss" scoped>
.cat-drag-hint {
  flex: 1 1 280px;
  margin: 0;
}

.cat-notice {
  margin: -8px 0 16px;
  font-size: 14px;
  color: $color-success;
}

.cat-col-handle {
  width: 28px;
  padding-right: 0;
}

.cat-handle {
  font-size: 14px;
  letter-spacing: -3px;
  color: $color-text-muted;
  cursor: grab;
  user-select: none;
}

tr[draggable='true'] {
  cursor: grab;
}

.cat-row-dragging {
  opacity: 0.45;
}

// The row a dragged sibling would take the place of.
.cat-row-over td {
  box-shadow: inset 0 2px 0 $color-primary;
}

.cat-link {
  color: $color-text;
  text-decoration: none;
}

.cat-link:hover {
  color: $color-primary;
}

// Five columns do not fit the panel next to the menu on a tablet (about 410
// wide at 768), so below 992 each category becomes a card, as every admin
// table does on phones (_admin.scss).
@include respond-below(lg) {
  .cat-table thead {
    display: none;
  }

  .cat-table,
  .cat-table tbody,
  .cat-table tr,
  .cat-table td {
    display: block;
    width: 100%;
  }

  .cat-table tr {
    position: relative;
    padding: 14px 16px 14px 40px;
  }

  .cat-table tr + tr {
    border-top: 1px solid $color-border;
  }

  .cat-table td {
    padding: 4px 0;
    border-top: 0;
  }

  // The phone rules label each cell and right-align it; the card reads without.
  .cat-table td[data-label] {
    text-align: left;
  }

  .cat-table td[data-label]::before {
    content: none;
  }

  .cat-table td[data-label] .admin-cell-sub {
    text-align: left;
  }

  .cat-table td.cat-col-handle {
    position: absolute;
    top: 16px;
    left: 16px;
    width: auto;
    padding: 0;
  }

  .cat-table td.admin-cell-actions {
    width: auto;
    padding-top: 10px;
    white-space: normal;
  }

  .cat-actions {
    justify-content: flex-start;
    gap: 14px 18px;
  }
}

.cat-arrow {
  min-width: 16px;
  font-size: 15px;
}

// The shared actions cell is as narrow as it can be (width 1%), which stacked
// these one per line; a row keeps them on one line where the table has the
// room (from 992), and wraps them on tablets.
@include respond-above(lg) {
  .cat-actions {
    flex-wrap: nowrap;
    gap: 14px;
  }
}

.cat-modal {
  max-width: 560px;
  max-height: calc(100vh - 32px);
  overflow-y: auto;
}

.cat-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
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
  gap: 16px;
}

@include respond-above(md) {
  .cat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
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
</style>
