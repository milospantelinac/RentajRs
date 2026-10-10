<template>
  <!-- T129: the items of a list field or an amenity group: add, rename, icon,
       hide or show, delete (or hide, when listings use it) and the order. -->
  <div class="opt-editor">
    <p v-if="!rows.length" class="admin-card-note">{{ t('admin.attr.noItems') }}</p>
    <ul v-else class="opt-list">
      <li
        v-for="(option, index) in rows"
        :key="option.id"
        class="opt-row"
        :class="{ 'opt-row-hidden': option.hidden, 'opt-row-over': overId === option.id }"
        :draggable="canDrag && editingId !== option.id"
        @dragstart="onDragStart(option, $event)"
        @dragover="onDragOver(option, $event)"
        @dragleave="overId = overId === option.id ? null : overId"
        @drop="onDrop(option, $event)"
        @dragend="dragId = overId = null"
      >
        <span v-if="canDrag" class="opt-handle" aria-hidden="true">⋮⋮</span>
        <template v-if="editingId === option.id">
          <div class="opt-edit">
            <input
              v-model="draft.name"
              type="text"
              class="form-control"
              maxlength="80"
              :aria-label="t('admin.attr.name')"
              @keydown.enter.prevent="saveEdit(option)"
            />
            <AttributeIconPicker v-if="withIcons" v-model="draft.icon" :fallback-key="option.key" />
            <div class="opt-actions">
              <button type="button" class="btn btn-primary-flat btn-sm" :disabled="!draft.name.trim()" @click="saveEdit(option)">
                {{ t('common.save') }}
              </button>
              <button type="button" class="btn btn-tertiary btn-sm" @click="editingId = null">{{ t('common.cancel') }}</button>
            </div>
          </div>
        </template>
        <template v-else>
          <AttributeIcon v-if="withIcons" :name="option.icon || option.key" :size="20" class="opt-icon" />
          <span class="opt-name">
            {{ option.name }}
            <span v-if="option.hidden" class="admin-pill admin-pill-neutral">{{ t('admin.attr.hidden') }}</span>
          </span>
          <span class="admin-cell-sub opt-count">{{ t('admin.attr.listings', { count: option.listingCount }) }}</span>
          <div v-if="!readonly" class="admin-actions opt-actions">
            <button type="button" class="admin-action" @click="startEdit(option)">{{ t('admin.attr.edit') }}</button>
            <button type="button" class="admin-action" @click="setHidden(option, !option.hidden)">
              {{ option.hidden ? t('admin.attr.show') : t('admin.attr.hide') }}
            </button>
            <template v-if="canDrag">
              <button
                type="button"
                class="admin-action"
                :disabled="index === 0"
                :aria-label="t('admin.attr.moveUp')"
                :title="t('admin.attr.moveUp')"
                @click="move(option, -1)"
              >↑</button>
              <button
                type="button"
                class="admin-action"
                :disabled="index === rows.length - 1"
                :aria-label="t('admin.attr.moveDown')"
                :title="t('admin.attr.moveDown')"
                @click="move(option, 1)"
              >↓</button>
            </template>
            <button type="button" class="admin-action admin-action-danger" @click="remove(option)">{{ t('common.delete') }}</button>
          </div>
        </template>
      </li>
    </ul>

    <form v-if="!readonly" class="opt-add" @submit.prevent="add">
      <input
        v-model="newItem.name"
        type="text"
        class="form-control"
        maxlength="80"
        :placeholder="t('admin.attr.newItemPlaceholder')"
        :aria-label="t('admin.attr.newItemPlaceholder')"
      />
      <AttributeIconPicker v-if="withIcons" v-model="newItem.icon" />
      <button type="submit" class="btn btn-tertiary btn-sm" :disabled="!newItem.name.trim() || busy">{{ t('admin.attr.addItem') }}</button>
    </form>
    <p v-if="error" class="form-error">{{ error }}</p>

    <div v-if="inUse" class="admin-modal-backdrop" @click.self="inUse = null">
      <div class="admin-modal admin-card" role="dialog" aria-modal="true" :aria-label="t('admin.attr.inUseTitle')">
        <div class="admin-card-body opt-dialog">
          <p class="admin-card-title">{{ t('admin.attr.inUseTitle') }}</p>
          <p>{{ t('admin.attr.inUseItem', { name: inUse.name, count: inUse.listingCount }) }}</p>
          <div class="opt-actions">
            <button v-if="!inUse.hidden" type="button" class="btn btn-primary-flat btn-sm" @click="hideFromDialog">
              {{ t('admin.attr.hideItem') }}
            </button>
            <button type="button" class="btn btn-tertiary btn-sm" @click="inUse = null">{{ t('common.close') }}</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  attribute: { type: Object, required: true },
  // Amenity items carry an icon on the listing page; list items don't.
  withIcons: { type: Boolean, default: false },
  // Rows whose name has this text; the order can't change while it filters.
  search: { type: String, default: '' },
  readonly: { type: Boolean, default: false },
})
const emit = defineEmits(['changed'])
const { t } = useI18n()
const api = useApi()

const rows = computed(() => {
  const q = props.search.trim().toLowerCase()
  const options = props.attribute.options || []
  return q && !props.attribute.name.toLowerCase().includes(q)
    ? options.filter((option) => option.name.toLowerCase().includes(q))
    : options
})
const canDrag = computed(() => !props.readonly && !props.search.trim())

const busy = ref(false)
const error = ref('')
async function run(request) {
  busy.value = true
  error.value = ''
  try {
    await request()
    emit('changed')
    return true
  } catch (e) {
    if (e?.data?.code === 'OPTION_IN_USE') return e
    error.value = extractErrorMessage(e, t('auth.genericError'))
    return false
  } finally {
    busy.value = false
  }
}

const newItem = reactive({ name: '', icon: '' })
async function add() {
  const name = newItem.name.trim()
  if (!name) return
  const done = await run(() => api.post(`/admin/attributes/${props.attribute.id}/options`, { name, icon: newItem.icon || undefined }))
  if (done === true) Object.assign(newItem, { name: '', icon: '' })
}

const editingId = ref(null)
const draft = reactive({ name: '', icon: '' })
function startEdit(option) {
  editingId.value = option.id
  Object.assign(draft, { name: option.name, icon: option.icon || '' })
}
async function saveEdit(option) {
  const name = draft.name.trim()
  if (!name) return
  const done = await run(() => api.patch(`/admin/options/${option.id}`, { name, ...(props.withIcons ? { icon: draft.icon || null } : {}) }))
  if (done === true) editingId.value = null
}

function setHidden(option, hidden) {
  return run(() => api.patch(`/admin/options/${option.id}`, { hidden }))
}

// Never blind (T129): an item listings use is hidden instead.
const inUse = ref(null)
async function remove(option) {
  if (option.listingCount > 0) {
    inUse.value = option
    return
  }
  if (!confirm(t('admin.attr.deleteItemConfirm', { name: option.name }))) return
  const result = await run(() => api.delete(`/admin/options/${option.id}`))
  if (result && result !== true) inUse.value = { ...option, listingCount: result.data.listingCount }
}
async function hideFromDialog() {
  const option = inUse.value
  inUse.value = null
  await setHidden(option, true)
}

function saveOrder(ids) {
  return run(() => api.patch(`/admin/attributes/${props.attribute.id}/options/reorder`, { ids }))
}
function move(option, step) {
  const ids = rows.value.map((row) => row.id)
  const from = ids.indexOf(option.id)
  const to = from + step
  if (to < 0 || to >= ids.length) return
  ids.splice(to, 0, ids.splice(from, 1)[0])
  return saveOrder(ids)
}

const dragId = ref(null)
const overId = ref(null)
function onDragStart(option, event) {
  dragId.value = option.id
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', option.id)
}
function onDragOver(option, event) {
  if (!dragId.value || dragId.value === option.id) return
  event.preventDefault()
  overId.value = option.id
}
function onDrop(option, event) {
  event.preventDefault()
  const source = dragId.value
  dragId.value = overId.value = null
  if (!source || source === option.id) return
  const ids = rows.value.map((row) => row.id)
  ids.splice(ids.indexOf(option.id), 0, ids.splice(ids.indexOf(source), 1)[0])
  return saveOrder(ids)
}
</script>

<style lang="scss" scoped>
.opt-editor {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.opt-list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.opt-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  padding: 9px 0;
  border-bottom: 1px solid $color-border;
}

.opt-row:last-child {
  border-bottom: 0;
}

.opt-row[draggable='true'] {
  cursor: grab;
}

.opt-row-hidden .opt-name {
  color: $color-text-muted;
}

.opt-row-over {
  box-shadow: inset 0 2px 0 $color-primary;
}

.opt-handle {
  font-size: 13px;
  letter-spacing: -3px;
  color: $color-text-muted;
  user-select: none;
}

.opt-icon {
  color: $color-text;
}

.opt-name {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  flex: 1 1 160px;
  min-width: 0;
  font-size: 14px;
  color: $color-text;
  overflow-wrap: anywhere;
}

.opt-count {
  white-space: nowrap;
}

.opt-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 14px;
}

.opt-edit {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1 1 100%;
}

.opt-add {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 10px;
}

.opt-add .form-control {
  flex: 1 1 220px;
}

.opt-dialog {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
</style>
