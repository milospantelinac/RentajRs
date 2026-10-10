<template>
  <!-- T129 part 2: the fields, amenity groups and key facts of one category. -->
  <div class="attr-editor">
    <div class="admin-filters">
      <input
        v-model="search"
        type="search"
        class="admin-field admin-field-search"
        :placeholder="t('admin.attr.search')"
        :aria-label="t('admin.attr.search')"
      />
    </div>
    <p v-if="loadError" class="form-error">{{ loadError }}</p>

    <!-- Polja -->
    <section class="admin-card attr-card">
      <div class="admin-card-head attr-head">
        <div>
          <p class="admin-card-title">{{ t('admin.attr.fieldsTitle') }}</p>
          <p class="admin-card-note">{{ t('admin.attr.fieldsHint') }}</p>
        </div>
        <button type="button" class="btn btn-primary-flat btn-sm" @click="openCreate(false)">{{ t('admin.attr.newField') }}</button>
      </div>
      <div class="admin-card-body">
        <p v-if="!ownFields.length" class="admin-card-note">{{ t('admin.attr.noOwnFields') }}</p>
        <ul v-else class="attr-list">
          <li
            v-for="(field, index) in shownOwnFields"
            :key="field.id"
            class="attr-row"
            :class="{ 'attr-row-over': overId === field.id, 'attr-row-hidden': field.hidden }"
            :draggable="canDrag"
            @dragstart="onDragStart(field, $event)"
            @dragover="onDragOver(field, ownFields, $event)"
            @dragleave="overId = overId === field.id ? null : overId"
            @drop="onDrop(field, ownFields, $event)"
            @dragend="dragId = overId = null"
          >
            <div class="attr-row-main">
              <span v-if="canDrag" class="attr-handle" aria-hidden="true">⋮⋮</span>
              <AttributeIcon :name="field.icon || field.key" :size="20" class="attr-icon" />
              <div class="attr-text">
                <p class="admin-cell-name">{{ field.name }}</p>
                <p class="admin-cell-sub">
                  {{ t(`admin.attr.types.${field.type}`) }}<template v-if="field.unit">, {{ field.unit }}</template>
                  · {{ t('admin.attr.listings', { count: field.listingCount }) }}
                </p>
                <div class="admin-pills attr-pills">
                  <span v-if="field.required" class="admin-pill admin-pill-info">{{ t('admin.attr.required') }}</span>
                  <span v-if="field.hidden" class="admin-pill admin-pill-neutral">{{ t('admin.attr.hidden') }}</span>
                  <span v-if="!field.showOnListing" class="admin-pill admin-pill-neutral">{{ t('admin.attr.offListing') }}</span>
                  <span v-if="field.system" class="admin-pill admin-pill-warning">{{ t('admin.attr.system') }}</span>
                  <span v-if="field.dependsOnAttrKey" class="admin-pill admin-pill-neutral">{{ conditionLabel(field) }}</span>
                </div>
              </div>
              <div class="admin-actions attr-actions">
                <button v-if="isList(field)" type="button" class="admin-action" @click="toggleOpen(field.id)">
                  {{ t('admin.attr.items') }} ({{ field.options.length }})
                </button>
                <button type="button" class="admin-action" @click="openEdit(field)">{{ t('admin.attr.edit') }}</button>
                <button v-if="!field.system" type="button" class="admin-action" @click="setHidden(field, !field.hidden)">
                  {{ field.hidden ? t('admin.attr.show') : t('admin.attr.hide') }}
                </button>
                <template v-if="canDrag">
                  <button
                    type="button"
                    class="admin-action"
                    :disabled="index === 0"
                    :aria-label="t('admin.attr.moveUp')"
                    :title="t('admin.attr.moveUp')"
                    @click="move(field, ownFields, -1)"
                  >↑</button>
                  <button
                    type="button"
                    class="admin-action"
                    :disabled="index === ownFields.length - 1"
                    :aria-label="t('admin.attr.moveDown')"
                    :title="t('admin.attr.moveDown')"
                    @click="move(field, ownFields, 1)"
                  >↓</button>
                </template>
                <button v-if="!field.system" type="button" class="admin-action admin-action-danger" @click="remove(field)">
                  {{ t('common.delete') }}
                </button>
              </div>
            </div>
            <AttributeOptionsEditor
              v-if="isList(field) && (openIds.has(field.id) || search.trim())"
              class="attr-options"
              :attribute="field"
              :search="search"
              @changed="load"
            />
          </li>
        </ul>

        <div v-for="group in inheritedFieldGroups" :key="group.categoryId" class="attr-inherited">
          <p class="admin-card-note">
            {{ t('admin.attr.inheritedFrom', { name: group.categoryName }) }}.
            {{ t('admin.attr.inheritedHint') }}
            <NuxtLink :to="`/admin/kategorije/${group.categoryId}?tab=attributes`" class="admin-action">{{ t('admin.attr.openCategory') }}</NuxtLink>
          </p>
          <ul class="attr-list">
            <li v-for="field in group.fields" :key="field.id" class="attr-row attr-row-readonly">
              <div class="attr-row-main">
                <AttributeIcon :name="field.icon || field.key" :size="20" class="attr-icon" />
                <div class="attr-text">
                  <p class="admin-cell-name">{{ field.name }}</p>
                  <p class="admin-cell-sub">
                    {{ t(`admin.attr.types.${field.type}`) }} · {{ t('admin.attr.listings', { count: field.listingCount }) }}
                    <template v-if="field.hidden"> · {{ t('admin.attr.hidden') }}</template>
                  </p>
                </div>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <!-- Opremljenost -->
    <section class="admin-card attr-card">
      <div class="admin-card-head attr-head">
        <div>
          <p class="admin-card-title">{{ t('admin.attr.amenitiesTitle') }}</p>
          <p class="admin-card-note">{{ t('admin.attr.amenitiesHint') }}</p>
        </div>
        <button type="button" class="btn btn-primary-flat btn-sm" @click="openCreate(true)">{{ t('admin.attr.newGroup') }}</button>
      </div>
      <div class="admin-card-body">
        <p v-if="!ownGroups.length" class="admin-card-note">{{ t('admin.attr.noOwnGroups') }}</p>
        <div v-for="(group, index) in shownOwnGroups" :key="group.id" class="attr-group" :class="{ 'attr-row-hidden': group.hidden }">
          <div class="attr-row-main">
            <div class="attr-text">
              <p class="admin-cell-name">{{ group.name }}</p>
              <p class="admin-cell-sub">
                {{ t('admin.attr.listings', { count: group.listingCount }) }}
                <template v-if="group.hidden"> · {{ t('admin.attr.hidden') }}</template>
                <template v-if="!group.showOnListing"> · {{ t('admin.attr.offListing') }}</template>
              </p>
            </div>
            <div class="admin-actions attr-actions">
              <button type="button" class="admin-action" @click="openEdit(group)">{{ t('admin.attr.edit') }}</button>
              <button type="button" class="admin-action" @click="setHidden(group, !group.hidden)">
                {{ group.hidden ? t('admin.attr.show') : t('admin.attr.hide') }}
              </button>
              <template v-if="canDrag && ownGroups.length > 1">
                <button
                  type="button"
                  class="admin-action"
                  :disabled="index === 0"
                  :aria-label="t('admin.attr.moveUp')"
                  @click="move(group, ownGroups, -1)"
                >↑</button>
                <button
                  type="button"
                  class="admin-action"
                  :disabled="index === ownGroups.length - 1"
                  :aria-label="t('admin.attr.moveDown')"
                  @click="move(group, ownGroups, 1)"
                >↓</button>
              </template>
              <button type="button" class="admin-action admin-action-danger" @click="remove(group)">{{ t('common.delete') }}</button>
            </div>
          </div>
          <AttributeOptionsEditor class="attr-options" :attribute="group" with-icons :search="search" @changed="load" />
        </div>

        <div v-for="group in inheritedGroups" :key="group.id" class="attr-group attr-inherited">
          <p class="admin-card-note">
            {{ t('admin.attr.inheritedFrom', { name: group.categoryName }) }}: <strong>{{ group.name }}</strong>.
            {{ t('admin.attr.inheritedHint') }}
            <NuxtLink :to="`/admin/kategorije/${group.categoryId}?tab=attributes`" class="admin-action">{{ t('admin.attr.openCategory') }}</NuxtLink>
          </p>
          <AttributeOptionsEditor class="attr-options" :attribute="group" with-icons readonly :search="search" />
        </div>
      </div>
    </section>

    <!-- Ključne činjenice -->
    <section class="admin-card attr-card">
      <div class="admin-card-head attr-head">
        <div>
          <p class="admin-card-title">{{ t('admin.attr.factsTitle') }}</p>
          <p class="admin-card-note">{{ t('admin.attr.factsHint') }}</p>
        </div>
      </div>
      <div class="admin-card-body attr-facts">
        <div v-for="slot in FACT_SLOTS" :key="slot.key" class="attr-fact-col">
          <p class="form-label">{{ t(slot.label) }}</p>
          <p v-if="!facts[slot.key].length" class="admin-card-note">
            {{ inheritedFacts(slot) ? t('admin.attr.factsInherited', { list: inheritedFacts(slot) }) : t('admin.attr.factsNone') }}
          </p>
          <ol v-else class="attr-fact-list">
            <li v-for="(key, index) in facts[slot.key]" :key="key" class="attr-fact">
              <AttributeIcon :name="factIcon(key)" :size="18" />
              <span class="attr-fact-name">{{ factName(key) }}</span>
              <button type="button" class="admin-action" :disabled="index === 0" :aria-label="t('admin.attr.moveUp')" @click="moveFact(slot.key, index, -1)">↑</button>
              <button
                type="button"
                class="admin-action"
                :disabled="index === facts[slot.key].length - 1"
                :aria-label="t('admin.attr.moveDown')"
                @click="moveFact(slot.key, index, 1)"
              >↓</button>
              <button type="button" class="admin-action admin-action-danger" @click="facts[slot.key].splice(index, 1)">
                {{ t('admin.attr.remove') }}
              </button>
            </li>
          </ol>
          <select
            class="admin-field attr-fact-add"
            :disabled="facts[slot.key].length >= slot.max"
            :aria-label="t('admin.attr.factsAdd')"
            value=""
            @change="addFact(slot.key, $event)"
          >
            <option value="">{{ t('admin.attr.factsAdd') }}</option>
            <option v-for="entry in factChoices(slot.key)" :key="entry.key" :value="entry.key">{{ entry.name }}</option>
          </select>
        </div>
        <div class="attr-facts-save">
          <button type="button" class="btn btn-primary-flat btn-sm" :disabled="busy" @click="saveFacts">{{ t('admin.attr.factsSave') }}</button>
          <span v-if="factsSaved" class="attr-saved" role="status">{{ t('admin.attr.saved') }}</span>
        </div>
      </div>
    </section>

    <!-- Novo polje, nova grupa, izmena -->
    <div v-if="editor" class="admin-modal-backdrop" @click.self="editor = null">
      <form class="admin-modal admin-card attr-modal" @submit.prevent="saveEditor">
        <div class="admin-card-body attr-form">
          <p class="admin-card-title">{{ editorTitle }}</p>
          <div class="form-group">
            <label class="form-label" for="attr-name">{{ t('admin.attr.name') }}</label>
            <input id="attr-name" v-model="editor.name" type="text" class="form-control" maxlength="80" required />
          </div>
          <div v-if="!editor.group" class="form-group">
            <label class="form-label" for="attr-type">{{ t('admin.attr.type') }}</label>
            <select id="attr-type" v-model="editor.type" class="form-control form-select" :disabled="typeLocked">
              <option v-for="type in FIELD_TYPES" :key="type" :value="type">{{ t(`admin.attr.types.${type}`) }}</option>
            </select>
            <p v-if="editor.source?.system" class="admin-card-note attr-hint">{{ t('admin.attr.typeSystem') }}</p>
            <p v-else-if="typeLocked" class="admin-card-note attr-hint">{{ t('admin.attr.typeLocked') }}</p>
          </div>
          <div v-if="editor.type === 'NUMBER'" class="form-group">
            <label class="form-label" for="attr-unit">{{ t('admin.attr.unit') }}</label>
            <input id="attr-unit" v-model="editor.unit" type="text" class="form-control" maxlength="20" list="attr-units" />
            <datalist id="attr-units">
              <option v-for="unit in UNITS" :key="unit" :value="unit" />
            </datalist>
            <p class="admin-card-note attr-hint">{{ t('admin.attr.unitHint') }}</p>
          </div>
          <div v-if="!editor.source && LIST_TYPES.includes(editor.type)" class="form-group">
            <label class="form-label" for="attr-items">{{ t('admin.attr.initialItems') }}</label>
            <textarea id="attr-items" v-model="editor.items" class="form-control" rows="5" />
          </div>
          <div class="form-group">
            <p class="form-label">{{ t('admin.attr.icon') }}</p>
            <AttributeIconPicker v-model="editor.icon" :fallback-key="editor.source?.key || ''" />
          </div>
          <div v-if="!editor.group" class="form-group">
            <label class="form-label" for="attr-condition">{{ t('admin.attr.conditionLabel') }}</label>
            <select id="attr-condition" v-model="editor.dependsOnAttrKey" class="form-control form-select" @change="editor.dependsOnOptionKey = ''">
              <option value="">{{ t('admin.attr.conditionNone') }}</option>
              <option v-for="candidate in conditionFields" :key="candidate.key" :value="candidate.key">{{ candidate.name }}</option>
            </select>
            <select
              v-if="editor.dependsOnAttrKey"
              v-model="editor.dependsOnOptionKey"
              class="form-control form-select attr-condition-option"
              :aria-label="t('admin.attr.conditionOption')"
              required
            >
              <option value="" disabled>{{ t('admin.attr.conditionOption') }}</option>
              <option v-for="option in conditionOptions" :key="option.key" :value="option.key">{{ option.name }}</option>
            </select>
          </div>
          <label class="admin-check-row">
            <input v-model="editor.required" type="checkbox" class="admin-check" /> {{ t('admin.attr.requiredLabel') }}
          </label>
          <label class="admin-check-row">
            <input v-model="editor.showOnListing" type="checkbox" class="admin-check" /> {{ t('admin.attr.showOnListingLabel') }}
          </label>
          <label v-if="editor.source && !editor.source.system" class="admin-check-row">
            <input v-model="editor.hidden" type="checkbox" class="admin-check" /> {{ t('admin.attr.hiddenLabel') }}
          </label>
          <p v-if="editorError" class="form-error">{{ editorError }}</p>
          <div class="attr-actions">
            <button type="submit" class="btn btn-primary-flat btn-sm" :disabled="busy || !editor.name.trim()">{{ t('common.save') }}</button>
            <button type="button" class="btn btn-tertiary btn-sm" @click="editor = null">{{ t('common.cancel') }}</button>
          </div>
        </div>
      </form>
    </div>

    <div v-if="inUse" class="admin-modal-backdrop" @click.self="inUse = null">
      <div class="admin-modal admin-card" role="dialog" aria-modal="true" :aria-label="t('admin.attr.inUseTitle')">
        <div class="admin-card-body attr-form">
          <p class="admin-card-title">{{ t('admin.attr.inUseTitle') }}</p>
          <p>{{ t('admin.attr.inUseField', { name: inUse.name, count: inUse.listingCount }) }}</p>
          <div class="attr-actions">
            <button v-if="!inUse.hidden && !inUse.system" type="button" class="btn btn-primary-flat btn-sm" @click="hideFromDialog">
              {{ t('admin.attr.hideField') }}
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
  categoryId: { type: String, required: true },
})
const emit = defineEmits(['changed'])
const { t } = useI18n()
const api = useApi()

const LIST_TYPES = ['LIST', 'MULTISELECT', 'CHECKBOX_GROUP']
// An amenity group is made with "Nova grupa opremljenosti"; the field types are the rest.
const FIELD_TYPES = ['NUMBER', 'YEAR', 'TEXT', 'TEXTAREA', 'LIST', 'MULTISELECT', 'BOOLEAN']
const UNITS = ['m²', 'm', 'cm', 'kg', 't', 'kom', 'l', 'm³', 'kW', 'KS']
const FACT_SLOTS = [
  { key: 'cardFactKeys', label: 'admin.attr.factsCard', max: 3 },
  { key: 'listingFactKeys', label: 'admin.attr.factsListing', max: 6 },
]

const data = ref(null)
const loadError = ref('')
const facts = reactive({ cardFactKeys: [], listingFactKeys: [] })

async function load() {
  try {
    data.value = await api.get(`/admin/categories/${props.categoryId}/attributes`)
    loadError.value = ''
    facts.cardFactKeys = [...data.value.cardFactKeys]
    facts.listingFactKeys = [...data.value.listingFactKeys]
    emit('changed')
  } catch (e) {
    loadError.value = extractErrorMessage(e, t('auth.genericError'))
  }
}
onMounted(load)

// The listing page shows CHECKBOX_GROUP as Opremljenost, except Uzrast dece (utils/listingAttributes.js).
const isGroup = (attribute) => attribute.type === 'CHECKBOX_GROUP' && attribute.key !== 'uzrast_dece'
const isList = (attribute) => LIST_TYPES.includes(attribute.type)

const attributes = computed(() => data.value?.attributes || [])
const ownFields = computed(() => attributes.value.filter((a) => !a.inherited && !isGroup(a)))
const ownGroups = computed(() => attributes.value.filter((a) => !a.inherited && isGroup(a)))
const inheritedGroups = computed(() => attributes.value.filter((a) => a.inherited && isGroup(a)))
const inheritedFieldGroups = computed(() => {
  const byCategory = new Map()
  for (const field of attributes.value.filter((a) => a.inherited && !isGroup(a))) {
    if (!byCategory.has(field.categoryId)) {
      byCategory.set(field.categoryId, { categoryId: field.categoryId, categoryName: field.categoryName, fields: [] })
    }
    byCategory.get(field.categoryId).fields.push(field)
  }
  return [...byCategory.values()]
})

// A search shows the fields and groups whose name, or an item's, has the text.
const search = ref('')
const matches = (attribute) => {
  const q = search.value.trim().toLowerCase()
  return !q || attribute.name.toLowerCase().includes(q) || attribute.options.some((o) => o.name.toLowerCase().includes(q))
}
const shownOwnFields = computed(() => ownFields.value.filter(matches))
const shownOwnGroups = computed(() => ownGroups.value.filter(matches))
const canDrag = computed(() => !search.value.trim())

const openIds = reactive(new Set())
function toggleOpen(id) {
  if (openIds.has(id)) openIds.delete(id)
  else openIds.add(id)
}

function conditionLabel(field) {
  const parent = attributes.value.find((a) => a.key === field.dependsOnAttrKey)
  const option = parent?.options.find((o) => o.key === field.dependsOnOptionKey)
  return t('admin.attr.condition', { field: parent?.name || field.dependsOnAttrKey, option: option?.name || field.dependsOnOptionKey })
}

const busy = ref(false)

// -- Order ------------------------------------------------------------------

// The server takes the category's own attributes as one list: fields first, then the groups.
function saveOrder(fields, groups) {
  return withBusy(() => api.patch(`/admin/categories/${props.categoryId}/attributes/reorder`, { ids: [...fields, ...groups].map((a) => a.id) }))
}
function reordered(list, sourceId, targetId) {
  const next = [...list]
  const from = next.findIndex((a) => a.id === sourceId)
  const to = next.findIndex((a) => a.id === targetId)
  next.splice(to, 0, next.splice(from, 1)[0])
  return next
}
function move(attribute, list, step) {
  const index = list.findIndex((a) => a.id === attribute.id)
  const target = list[index + step]
  if (!target) return
  const next = reordered(list, attribute.id, target.id)
  return list === ownGroups.value ? saveOrder(ownFields.value, next) : saveOrder(next, ownGroups.value)
}

const dragId = ref(null)
const overId = ref(null)
function onDragStart(attribute, event) {
  if (!canDrag.value) return
  dragId.value = attribute.id
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', attribute.id)
}
function onDragOver(attribute, list, event) {
  if (!dragId.value || dragId.value === attribute.id || !list.some((a) => a.id === dragId.value)) return
  event.preventDefault()
  overId.value = attribute.id
}
function onDrop(attribute, list, event) {
  event.preventDefault()
  const source = dragId.value
  dragId.value = overId.value = null
  if (!source || source === attribute.id || !list.some((a) => a.id === source)) return
  return saveOrder(reordered(list, source, attribute.id), ownGroups.value)
}

// -- Hide, delete -----------------------------------------------------------

async function withBusy(request) {
  busy.value = true
  try {
    await request()
    await load()
    return true
  } catch (e) {
    if (['ATTRIBUTE_IN_USE'].includes(e?.data?.code)) return e
    alert(extractErrorMessage(e, t('auth.genericError')))
    return false
  } finally {
    busy.value = false
  }
}

function setHidden(attribute, hidden) {
  return withBusy(() => api.patch(`/admin/attributes/${attribute.id}`, { hidden }))
}

// Never blind (T129): a field or group listings use is hidden instead.
const inUse = ref(null)
async function remove(attribute) {
  if (attribute.listingCount > 0) {
    inUse.value = attribute
    return
  }
  if (!confirm(t('admin.attr.deleteFieldConfirm', { name: attribute.name }))) return
  const result = await withBusy(() => api.delete(`/admin/attributes/${attribute.id}`))
  if (result && result !== true) inUse.value = { ...attribute, listingCount: result.data.listingCount }
}
async function hideFromDialog() {
  const attribute = inUse.value
  inUse.value = null
  await setHidden(attribute, true)
}

// -- Create and edit --------------------------------------------------------

const editor = ref(null)
const editorError = ref('')
const editorTitle = computed(() => {
  if (!editor.value) return ''
  if (editor.value.group) return editor.value.source ? t('admin.attr.editGroup') : t('admin.attr.newGroup')
  return editor.value.source ? t('admin.attr.editField') : t('admin.attr.newField')
})
const typeLocked = computed(() => Boolean(editor.value?.source && (editor.value.source.system || editor.value.source.listingCount > 0)))

function openCreate(group) {
  editorError.value = ''
  editor.value = {
    source: null,
    group,
    name: '',
    type: group ? 'CHECKBOX_GROUP' : 'NUMBER',
    unit: '',
    items: '',
    icon: '',
    dependsOnAttrKey: '',
    dependsOnOptionKey: '',
    required: false,
    showOnListing: true,
    hidden: false,
  }
}

function openEdit(attribute) {
  editorError.value = ''
  editor.value = {
    source: attribute,
    group: isGroup(attribute),
    name: attribute.name,
    type: attribute.type,
    unit: attribute.unit || '',
    items: '',
    icon: attribute.icon || '',
    dependsOnAttrKey: attribute.dependsOnAttrKey || '',
    dependsOnOptionKey: attribute.dependsOnOptionKey || '',
    required: attribute.required,
    showOnListing: attribute.showOnListing,
    hidden: attribute.hidden,
  }
}

// A condition is an item of a single-choice field of the category or a parent, never the field itself.
const conditionFields = computed(() =>
  attributes.value.filter((a) => a.type === 'LIST' && a.key !== editor.value?.source?.key),
)
const conditionOptions = computed(() => conditionFields.value.find((a) => a.key === editor.value?.dependsOnAttrKey)?.options || [])

async function saveEditor() {
  const form = editor.value
  const condition = form.group
    ? {}
    : {
        dependsOnAttrKey: form.dependsOnAttrKey || null,
        dependsOnOptionKey: form.dependsOnAttrKey ? form.dependsOnOptionKey || null : null,
      }
  // The unit belongs to a number; another type keeps whatever it has.
  const body = {
    name: form.name.trim(),
    ...(form.type === 'NUMBER' ? { unit: form.unit.trim() } : {}),
    required: form.required,
    showOnListing: form.showOnListing,
    ...condition,
  }
  busy.value = true
  editorError.value = ''
  try {
    if (form.source) {
      await api.patch(`/admin/attributes/${form.source.id}`, {
        ...body,
        ...(typeLocked.value || form.type === form.source.type ? {} : { type: form.type }),
        ...(form.source.system ? {} : { hidden: form.hidden }),
        icon: form.icon || null,
      })
    } else {
      const items = LIST_TYPES.includes(form.type)
        ? form.items.split('\n').map((line) => line.trim()).filter(Boolean).map((name) => ({ name }))
        : []
      await api.post(`/admin/categories/${props.categoryId}/attributes`, {
        ...body,
        type: form.type,
        unit: body.unit || undefined,
        icon: form.icon || undefined,
        dependsOnAttrKey: body.dependsOnAttrKey || undefined,
        dependsOnOptionKey: body.dependsOnOptionKey || undefined,
        options: items,
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

// -- Key facts --------------------------------------------------------------

const factPool = computed(() => data.value?.factPool || [])
const factName = (key) => factPool.value.find((entry) => entry.key === key)?.name || key
const factIcon = (key) => attributes.value.find((a) => a.key === key)?.icon || key
const factChoices = (slot) => factPool.value.filter((entry) => !facts[slot].includes(entry.key))
function inheritedFacts(slot) {
  const resolved = data.value?.[slot.key === 'cardFactKeys' ? 'resolvedCardFactKeys' : 'resolvedListingFactKeys'] || []
  return resolved.map(factName).join(', ')
}
function addFact(slot, event) {
  const key = event.target.value
  event.target.value = ''
  if (key && !facts[slot].includes(key)) facts[slot].push(key)
}
function moveFact(slot, index, step) {
  const list = facts[slot]
  list.splice(index + step, 0, list.splice(index, 1)[0])
}

const factsSaved = ref(false)
async function saveFacts() {
  factsSaved.value = false
  const done = await withBusy(() =>
    api.put(`/admin/categories/${props.categoryId}/facts`, {
      cardFactKeys: facts.cardFactKeys,
      listingFactKeys: facts.listingFactKeys,
    }),
  )
  factsSaved.value = done === true
}
</script>

<style lang="scss" scoped>
.attr-editor {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.attr-editor > .admin-filters {
  margin-bottom: 0;
}

.attr-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.attr-list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.attr-row,
.attr-group {
  padding: 12px 0;
  border-bottom: 1px solid $color-border;
}

.attr-row:last-child,
.attr-group:last-child {
  border-bottom: 0;
}

.attr-row[draggable='true'] {
  cursor: grab;
}

.attr-row-over {
  box-shadow: inset 0 2px 0 $color-primary;
}

.attr-row-hidden .admin-cell-name {
  color: $color-text-muted;
}

.attr-row-main {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 10px 12px;
}

.attr-handle {
  padding-top: 2px;
  font-size: 13px;
  letter-spacing: -3px;
  color: $color-text-muted;
  user-select: none;
}

.attr-icon {
  margin-top: 1px;
  color: $color-text;
}

.attr-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1 1 220px;
  min-width: 0;
}

.attr-pills {
  margin-top: 2px;
}

.attr-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 14px;
}

.attr-options {
  margin: 12px 0 0 30px;
  padding: 12px 16px;
  border-radius: 12px;
  background: $color-background;
}

.attr-inherited {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px dashed $color-border;
}

.attr-row-readonly .admin-cell-name {
  color: $color-text-muted;
}

.attr-facts {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
}

@include respond-above(md) {
  .attr-facts {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.attr-fact-col {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.attr-fact-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.attr-fact {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border: 1px solid $color-border;
  border-radius: 10px;
}

.attr-fact-name {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 14px;
  overflow-wrap: anywhere;
}

.attr-fact-add {
  width: 100%;
}

.attr-facts-save {
  display: flex;
  align-items: center;
  gap: 12px;
}

.attr-saved {
  font-size: 14px;
  color: $color-success;
}

.attr-modal {
  max-width: 560px;
  max-height: calc(100vh - 32px);
  overflow-y: auto;
}

.attr-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.attr-form .form-group {
  margin-bottom: 0;
}

.attr-hint {
  margin-top: 6px;
}

.attr-condition-option {
  margin-top: 8px;
}

@include mobile-only {
  .attr-options {
    margin-left: 0;
  }
}
</style>
