<template>
  <!-- T129 part 2: the category's /pretraga filters (CategoryFilter rows):
       which field, what kind, in the bar or in "Više filtera", and the order. -->
  <section class="admin-card flt-card">
    <div class="admin-card-head flt-head">
      <div>
        <p class="admin-card-title">{{ t('admin.filter.title') }}</p>
        <p class="admin-card-note">{{ t('admin.filter.hint') }}</p>
      </div>
      <button type="button" class="btn btn-primary-flat btn-sm" :disabled="!data" @click="openCreate">{{ t('admin.filter.add') }}</button>
    </div>
    <div class="admin-card-body">
      <p v-if="loadError" class="form-error">{{ loadError }}</p>
      <p v-else-if="data && !data.filters.length" class="admin-card-note">{{ t('admin.filter.none') }}</p>
      <ul v-else-if="data" class="flt-list">
        <li
          v-for="(row, index) in data.filters"
          :key="row.id"
          class="flt-row"
          :class="{ 'flt-row-over': overId === row.id }"
          draggable="true"
          @dragstart="onDragStart(row, $event)"
          @dragover="onDragOver(row, $event)"
          @dragleave="overId = overId === row.id ? null : overId"
          @drop="onDrop(row, $event)"
          @dragend="dragId = overId = null"
        >
          <span class="flt-handle" aria-hidden="true">⋮⋮</span>
          <div class="flt-text">
            <p class="admin-cell-name">{{ rowName(row) }}</p>
            <p class="admin-cell-sub">
              {{ t(`admin.filter.controls.${row.control}`) }} · {{ t(`admin.filter.places.${row.placement}`) }}
              <template v-if="row.thresholds.length"> · {{ row.thresholds.join(', ') }}</template>
            </p>
            <p v-if="row.missing" class="flt-warning">{{ t('admin.filter.missing') }}</p>
            <p v-else-if="isHiddenField(row)" class="flt-warning">{{ t('admin.filter.hiddenField') }}</p>
          </div>
          <div class="admin-actions flt-actions">
            <button v-if="row.control !== 'AREA'" type="button" class="admin-action" @click="openEdit(row)">{{ t('admin.attr.edit') }}</button>
            <button type="button" class="admin-action" :disabled="index === 0" :aria-label="t('admin.attr.moveUp')" @click="move(row, -1)">↑</button>
            <button
              type="button"
              class="admin-action"
              :disabled="index === data.filters.length - 1"
              :aria-label="t('admin.attr.moveDown')"
              @click="move(row, 1)"
            >↓</button>
            <button type="button" class="admin-action admin-action-danger" @click="remove(row)">{{ t('admin.attr.remove') }}</button>
          </div>
        </li>
      </ul>
    </div>

    <div v-if="editor" class="admin-modal-backdrop" @click.self="editor = null">
      <form class="admin-modal admin-card flt-modal" @submit.prevent="save">
        <div class="admin-card-body flt-form">
          <p class="admin-card-title">{{ editor.row ? t('admin.filter.edit') : t('admin.filter.add') }}</p>
          <div class="form-group">
            <label class="form-label" for="flt-field">{{ t('admin.filter.field') }}</label>
            <select id="flt-field" v-model="editor.field" class="form-control form-select" :disabled="Boolean(editor.row)" @change="onFieldChange">
              <option value="" disabled>{{ t('admin.filter.field') }}</option>
              <option value="__area">{{ t('admin.filter.area') }}</option>
              <option v-for="entry in data.pool" :key="entry.key" :value="entry.key">
                {{ entry.name }} ({{ t(`admin.attr.types.${entry.type}`) }})
              </option>
            </select>
          </div>
          <div v-if="editor.field" class="form-group">
            <label class="form-label" for="flt-kind">{{ t('admin.filter.kind') }}</label>
            <select id="flt-kind" v-model="editor.control" class="form-control form-select" @change="onControlChange">
              <option v-for="control in kinds" :key="control" :value="control">{{ t(`admin.filter.controls.${control}`) }}</option>
            </select>
          </div>
          <div v-if="editor.control === 'OPTION_TOGGLE'" class="form-group">
            <label class="form-label" for="flt-item">{{ t('admin.filter.item') }}</label>
            <select id="flt-item" v-model="editor.optionKey" class="form-control form-select" :disabled="Boolean(editor.row)" required>
              <option value="" disabled>{{ t('admin.filter.item') }}</option>
              <option v-for="option in fieldEntry?.options || []" :key="option.key" :value="option.key">{{ option.name }}</option>
            </select>
          </div>
          <div v-if="editor.control" class="form-group">
            <p class="form-label">{{ t('admin.filter.place') }}</p>
            <div class="admin-switch">
              <button
                v-for="place in places"
                :key="place"
                type="button"
                class="admin-switch-btn"
                :class="{ 'is-active': editor.placement === place }"
                @click="editor.placement = place"
              >{{ t(`admin.filter.places.${place}`) }}</button>
            </div>
          </div>
          <div v-if="editor.control === 'MIN' || editor.control === 'GUESTS'" class="form-group">
            <label class="form-label" for="flt-values">{{ t('admin.filter.values') }}</label>
            <input id="flt-values" v-model="editor.thresholds" type="text" class="form-control" inputmode="numeric" />
            <p class="admin-card-note flt-hint">{{ t('admin.filter.valuesHint') }}</p>
          </div>
          <p v-if="editorError" class="form-error">{{ editorError }}</p>
          <div class="flt-actions">
            <button type="submit" class="btn btn-primary-flat btn-sm" :disabled="busy || !editor.control || !editor.placement">{{ t('common.save') }}</button>
            <button type="button" class="btn btn-tertiary btn-sm" @click="editor = null">{{ t('common.cancel') }}</button>
          </div>
        </div>
      </form>
    </div>
  </section>
</template>

<script setup>
const props = defineProps({
  categoryId: { type: String, required: true },
})
const { t } = useI18n()
const api = useApi()

const data = ref(null)
const loadError = ref('')
async function load() {
  try {
    data.value = await api.get(`/admin/categories/${props.categoryId}/filters`)
    loadError.value = ''
  } catch (e) {
    loadError.value = extractErrorMessage(e, t('auth.genericError'))
  }
}
onMounted(load)

const poolEntry = (key) => data.value?.pool.find((entry) => entry.key === key)
function rowName(row) {
  if (row.control === 'AREA') return t('admin.filter.area')
  return row.name || row.attributeKey
}
const isHiddenField = (row) => Boolean(row.attributeKey && poolEntry(row.attributeKey)?.hidden)

const busy = ref(false)
async function withBusy(request) {
  busy.value = true
  try {
    await request()
    await load()
    return true
  } catch (e) {
    alert(extractErrorMessage(e, t('auth.genericError')))
    return false
  } finally {
    busy.value = false
  }
}

// -- Order ------------------------------------------------------------------

function saveOrder(ids) {
  return withBusy(() => api.patch(`/admin/categories/${props.categoryId}/filters/reorder`, { ids }))
}
function move(row, step) {
  const ids = data.value.filters.map((filter) => filter.id)
  const from = ids.indexOf(row.id)
  if (!ids[from + step]) return
  ids.splice(from + step, 0, ids.splice(from, 1)[0])
  return saveOrder(ids)
}
const dragId = ref(null)
const overId = ref(null)
function onDragStart(row, event) {
  dragId.value = row.id
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', row.id)
}
function onDragOver(row, event) {
  if (!dragId.value || dragId.value === row.id) return
  event.preventDefault()
  overId.value = row.id
}
function onDrop(row, event) {
  event.preventDefault()
  const source = dragId.value
  dragId.value = overId.value = null
  if (!source || source === row.id) return
  const ids = data.value.filters.map((filter) => filter.id)
  ids.splice(ids.indexOf(row.id), 0, ids.splice(ids.indexOf(source), 1)[0])
  return saveOrder(ids)
}

function remove(row) {
  if (!confirm(t('admin.filter.removeConfirm', { name: rowName(row) }))) return
  return withBusy(() => api.delete(`/admin/filters/${row.id}`))
}

// -- Create and edit --------------------------------------------------------

const editor = ref(null)
const editorError = ref('')
const fieldEntry = computed(() => (editor.value?.field && editor.value.field !== '__area' ? poolEntry(editor.value.field) : null))

// The kinds the chosen field allows, as the server checks them (controlsByType),
// the guest count for a capacity field, and no item switch to swap into later.
const kinds = computed(() => {
  if (!editor.value?.field) return []
  if (editor.value.field === '__area') return ['AREA']
  const entry = fieldEntry.value
  if (!entry) return []
  let list = [...(data.value.controlsByType[entry.type] || [])]
  if (data.value.guestKeys.includes(entry.key)) list.unshift('GUESTS')
  if (editor.value.row) {
    list = editor.value.row.control === 'OPTION_TOGGLE' ? ['OPTION_TOGGLE'] : list.filter((control) => control !== 'OPTION_TOGGLE')
  }
  return list
})
const places = computed(() =>
  ['BAR', 'PANEL'].filter((place) => editor.value?.control && data.value.controlsByPlacement[place].includes(editor.value.control)),
)

function onFieldChange() {
  editor.value.control = kinds.value[0] || ''
  editor.value.optionKey = ''
  onControlChange()
}
function onControlChange() {
  if (!places.value.includes(editor.value.placement)) editor.value.placement = places.value[places.value.length - 1] || ''
}

function openCreate() {
  editorError.value = ''
  editor.value = { row: null, field: '', control: '', optionKey: '', placement: '', thresholds: '' }
}
function openEdit(row) {
  editorError.value = ''
  editor.value = {
    row,
    field: row.attributeKey || '__area',
    control: row.control,
    optionKey: row.optionKey || '',
    placement: row.placement,
    thresholds: row.thresholds.join(', '),
  }
}

async function save() {
  const form = editor.value
  const thresholds = form.thresholds
    .split(/[,\s]+/)
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0)
  const values = form.control === 'MIN' || form.control === 'GUESTS' ? { thresholds } : {}
  busy.value = true
  editorError.value = ''
  try {
    if (form.row) {
      await api.patch(`/admin/filters/${form.row.id}`, { control: form.control, placement: form.placement, ...values })
    } else {
      await api.post(`/admin/categories/${props.categoryId}/filters`, {
        control: form.control,
        placement: form.placement,
        ...(form.field === '__area' ? {} : { attributeKey: form.field }),
        ...(form.control === 'OPTION_TOGGLE' ? { optionKey: form.optionKey } : {}),
        ...values,
      })
    }
    editor.value = null
    await load()
  } catch (e) {
    editorError.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    busy.value = false
  }
}
</script>

<style lang="scss" scoped>
.flt-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.flt-list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.flt-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 10px 12px;
  padding: 12px 0;
  border-bottom: 1px solid $color-border;
  cursor: grab;
}

.flt-row:last-child {
  border-bottom: 0;
}

.flt-row-over {
  box-shadow: inset 0 2px 0 $color-primary;
}

.flt-handle {
  padding-top: 2px;
  font-size: 13px;
  letter-spacing: -3px;
  color: $color-text-muted;
  user-select: none;
}

.flt-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1 1 220px;
  min-width: 0;
}

.flt-warning {
  font-size: 13px;
  color: $color-error;
}

.flt-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 14px;
}

.flt-modal {
  max-width: 520px;
  max-height: calc(100vh - 32px);
  overflow-y: auto;
}

.flt-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.flt-form .form-group {
  margin-bottom: 0;
}

.flt-hint {
  margin-top: 6px;
}
</style>
