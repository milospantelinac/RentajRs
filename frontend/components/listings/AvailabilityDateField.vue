<template>
  <!-- Dizajn 22: the date fields of 239:287 ("soft", 252:400) and 532:514
       ("boxed", 532:829). They open the site's own calendar, one month at a
       time, with dates that are already blocked greyed out. -->
  <div ref="root" class="date-field" :class="`date-field-${variant}`">
    <button
      :id="id"
      type="button"
      class="date-field-control"
      :class="{ 'is-empty': !modelValue }"
      :aria-expanded="open"
      :aria-label="ariaLabel"
      @click="open = !open"
    >
      <span class="date-field-value">{{ modelValue ? formatDate(modelValue) : placeholder }}</span>
      <img src="/images/icons/chevron-down.svg" alt="" class="date-field-chevron" />
    </button>
    <div v-if="open" class="date-field-popover">
      <BookingDateRangePicker
        :listing-id="listingId"
        :show-pricing="false"
        :single-date="true"
        :month-count="1"
        :initial-start="modelValue"
        @update:range="onPick"
      />
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  modelValue: { type: String, default: '' },
  listingId: { type: String, required: true },
  placeholder: { type: String, default: '' },
  variant: { type: String, default: 'soft' },
  id: { type: String, default: undefined },
  ariaLabel: { type: String, default: undefined },
})

const emit = defineEmits(['update:modelValue'])

const open = ref(false)
const root = ref(null)

// 532:830 reads "26. 9. 2026.".
const dateFormatter = new Intl.DateTimeFormat('sr-Latn-RS', { day: 'numeric', month: 'numeric', year: 'numeric' })
function formatDate(value) {
  const [year, month, day] = value.split('-').map(Number)
  return dateFormatter.format(new Date(year, month - 1, day))
}

// The picker reports its initial date as soon as it mounts; only a new pick closes it.
function onPick(range) {
  if (!range.startsAt || range.startsAt === props.modelValue) return
  emit('update:modelValue', range.startsAt)
  open.value = false
}

function onPointerDown(event) {
  if (open.value && root.value && !root.value.contains(event.target)) open.value = false
}
function onKeydown(event) {
  if (open.value && event.key === 'Escape') open.value = false
}

onMounted(() => {
  document.addEventListener('pointerdown', onPointerDown)
  document.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<style lang="scss" scoped>
.date-field {
  position: relative;
  min-width: 0;
}

// 252:400: 44 tall, no stroke, the text 16 in and the 16px chevron 14 from the right.
.date-field-control {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  height: 44px;
  margin: 0;
  padding: 0 14px 0 16px;
  border: 0;
  border-radius: $radius-input;
  background-color: $color-background;
  color: $color-text;
  font-family: $font-family-base;
  font-size: 14px;
  font-weight: 400;
  line-height: normal;
  text-align: left;
  cursor: pointer;
}

.date-field-control.is-empty {
  color: $color-text-muted;
}

.date-field-control:focus-visible {
  outline: none;
  background-color: $color-surface;
  box-shadow: inset 0 0 0 1.5px $color-primary;
}

.date-field-value {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.date-field-chevron {
  display: block;
  flex-shrink: 0;
  width: 16px;
  height: 16px;
}

// 532:829: a 1px stroke, the text 14 in and a 14px chevron.
.date-field-boxed .date-field-control {
  padding: 0 14px;
  box-shadow: inset 0 0 0 1px $color-border;
}

.date-field-boxed .date-field-control:focus-visible {
  box-shadow: inset 0 0 0 1.5px $color-primary;
}

.date-field-boxed .date-field-chevron {
  width: 14px;
  height: 14px;
}

// The picker's summary line asks a guest for an arrival date; an owner only needs the grid.
.date-field-popover :deep(.range-picker-summary) {
  display: none;
}

.date-field-popover {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 20;
  width: 340px;
  max-width: calc(100vw - 32px);
  border-radius: 14px;
  background: $color-surface;
  box-shadow: 0 12px 32px rgba(6, 27, 49, 0.14);
}
</style>
