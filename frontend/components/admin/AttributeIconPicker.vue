<template>
  <!-- T129: an icon from the attribute icon library (assets/icons/attributes),
       for a field or an amenity item. Empty: the icon named after the key. -->
  <div class="icon-picker">
    <button type="button" class="icon-picker-current" :aria-expanded="open" @click="open = !open">
      <AttributeIcon :name="modelValue || fallbackKey || 'podrazumevana'" :size="22" />
      <span>{{ modelValue || t('admin.attr.iconDefault') }}</span>
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

const open = ref(false)
const query = ref('')
const shown = computed(() => {
  const q = query.value.trim().toLowerCase()
  return q ? ATTRIBUTE_ICON_NAMES.filter((name) => name.includes(q)) : ATTRIBUTE_ICON_NAMES
})

function pick(name) {
  emit('update:modelValue', name)
  open.value = false
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
</style>
