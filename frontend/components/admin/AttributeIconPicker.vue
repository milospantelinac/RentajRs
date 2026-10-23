<template>
  <!-- T129: an icon from the attribute icon library (assets/icons/attributes),
       for a field or an amenity item. Empty: the icon named after the key.
       For a concept the library has nothing for, the admin uploads one of
       their own; it is offered for every other field and item from then on. -->
  <div class="icon-picker">
    <button type="button" class="icon-picker-current" :aria-expanded="open" @click="toggle">
      <AttributeIcon :name="modelValue || fallbackKey || 'podrazumevana'" :size="22" />
      <span>{{ currentLabel }}</span>
    </button>
    <div v-if="open" class="icon-picker-panel">
      <input
        v-model="query"
        type="search"
        class="admin-field icon-picker-search"
        :placeholder="t('admin.attr.iconSearch')"
        :aria-label="t('admin.attr.iconSearch')"
      />
      <div class="icon-picker-grid">
        <button
          type="button"
          class="icon-picker-item"
          :class="{ 'is-active': !modelValue }"
          :title="t('admin.attr.iconDefault')"
          @click="pick('')"
        >
          <AttributeIcon :name="fallbackKey || 'podrazumevana'" :size="22" />
          <span class="icon-picker-name">{{ t('admin.attr.iconDefault') }}</span>
        </button>
        <button
          v-for="icon in shownUploads"
          :key="icon"
          type="button"
          class="icon-picker-item"
          :class="{ 'is-active': modelValue === icon }"
          :title="t('admin.attr.iconUploaded')"
          @click="pick(icon)"
        >
          <AttributeIcon :name="icon" :size="22" />
          <span class="icon-picker-name">{{ t('admin.attr.iconUploaded') }}</span>
        </button>
        <button
          v-for="name in shown"
          :key="name"
          type="button"
          class="icon-picker-item"
          :class="{ 'is-active': modelValue === name }"
          :title="name"
          @click="pick(name)"
        >
          <AttributeIcon :name="name" :size="22" />
          <span class="icon-picker-name">{{ name }}</span>
        </button>
      </div>
      <div class="icon-picker-upload">
        <label class="btn btn-tertiary btn-sm icon-picker-upload-button" :class="{ 'is-busy': uploading }">
          {{ uploading ? t('admin.attr.iconUploading') : t('admin.attr.iconUpload') }}
          <input
            type="file"
            accept="image/png,image/svg+xml,image/webp,image/jpeg"
            class="visually-hidden"
            :disabled="uploading"
            @change="upload"
          />
        </label>
        <p class="admin-card-note">{{ t('admin.attr.iconUploadHint') }}</p>
        <p v-if="uploadError" class="form-error" role="alert">{{ uploadError }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  modelValue: { type: String, default: '' },
  // The field's or item's key, whose own icon shows while none is picked.
  fallbackKey: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])
const { t } = useI18n()
const api = useApi()

const open = ref(false)
const query = ref('')
const shown = computed(() => {
  const q = query.value.trim().toLowerCase()
  return q ? ATTRIBUTE_ICON_NAMES.filter((name) => name.includes(q)) : ATTRIBUTE_ICON_NAMES
})

const currentLabel = computed(() => {
  if (!props.modelValue) return t('admin.attr.iconDefault')
  return isUploadedAttributeIcon(props.modelValue) ? t('admin.attr.iconUploaded') : props.modelValue
})

// The uploaded icons, shared by every picker on the page: one read per visit,
// and an icon uploaded in one picker is offered by the others at once.
const uploads = useState('admin-attribute-icon-uploads', () => null)
// An item's own uploaded icon is offered even before the list has it.
const shownUploads = computed(() => {
  if (query.value.trim()) return []
  const icons = uploads.value ?? []
  return isUploadedAttributeIcon(props.modelValue) && !icons.includes(props.modelValue) ? [props.modelValue, ...icons] : icons
})

async function loadUploads() {
  if (uploads.value) return
  try {
    const { icons } = await api.get('/admin/attribute-icons')
    uploads.value = icons.map((row) => row.icon)
  } catch {
    // The library still works without them; a failed read is tried again on the next opening.
  }
}

function toggle() {
  open.value = !open.value
  if (open.value) loadUploads()
}

function pick(name) {
  emit('update:modelValue', name)
  open.value = false
}

const uploading = ref(false)
const uploadError = ref('')

// The file is stored at once; the field or item wears it once it is saved.
async function upload(event) {
  const file = event.target.files?.[0]
  if (!file) return
  const body = new FormData()
  body.append('file', file)
  uploading.value = true
  uploadError.value = ''
  try {
    const { icon } = await api.post('/admin/attribute-icons', body)
    uploads.value = [icon, ...(uploads.value ?? []).filter((other) => other !== icon)]
    pick(icon)
  } catch (e) {
    uploadError.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    uploading.value = false
    event.target.value = ''
  }
}
</script>

<style lang="scss" scoped>
.icon-picker {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.icon-picker-current {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  align-self: flex-start;
  padding: 8px 14px;
  border: 1px solid $color-border;
  border-radius: 12px;
  background: $color-surface;
  font-family: $font-family-base;
  font-size: 14px;
  color: $color-text;
  cursor: pointer;
}

.icon-picker-current:hover {
  border-color: $color-primary;
}

.icon-picker-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: 1px solid $color-border;
  border-radius: 12px;
}

.icon-picker-search {
  width: 100%;
}

.icon-picker-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
  gap: 8px;
  max-height: 260px;
  overflow-y: auto;
}

.icon-picker-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 10px 6px;
  border: 1px solid $color-border;
  border-radius: 10px;
  background: $color-surface;
  color: $color-text-muted;
  font-family: $font-family-base;
  cursor: pointer;
}

.icon-picker-item:hover,
.icon-picker-item.is-active {
  border-color: $color-primary;
  color: $color-primary;
}

.icon-picker-name {
  max-width: 100%;
  font-size: 10px;
  line-height: 13px;
  overflow-wrap: anywhere;
  text-align: center;
}

.icon-picker-upload {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  padding-top: 10px;
  border-top: 1px solid $color-border;
}

.icon-picker-upload .admin-card-note,
.icon-picker-upload .form-error {
  margin: 0;
}

.icon-picker-upload-button {
  cursor: pointer;
}

// While an icon is uploading the button cannot be pressed again.
.icon-picker-upload-button.is-busy {
  pointer-events: none;
  opacity: 0.6;
}
</style>
