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
      @click="toggle"
    >
      <span class="date-field-value">{{ modelValue ? formatDate(modelValue) : placeholder }}</span>
      <img src="/images/icons/chevron-down.svg" alt="" class="date-field-chevron" />
    </button>
    <!-- T141 point 6: the calendar is drawn over the page, so no list or card
         it opens from can cut it off; it opens upward when there is no room
         below and follows its field as the page scrolls. -->
    <Teleport to="body">
      <div v-if="open" ref="popover" class="date-field-popover" :style="popoverStyle">
        <BookingDateRangePicker
          :listing-id="listingId"
          :show-pricing="false"
          :single-date="true"
          :month-count="1"
          :initial-start="modelValue"
          @update:range="onPick"
        />
      </div>
    </Teleport>
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

const POPOVER_WIDTH = 340
const POPOVER_GAP = 6
const VIEWPORT_EDGE = 16

const open = ref(false)
const root = ref(null)
const popover = ref(null)
const popoverStyle = ref({})

// 532:830 reads "26. 9. 2026.".
const dateFormatter = new Intl.DateTimeFormat('sr-Latn-RS', {
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
})
function formatDate(value) {
  const [year, month, day] = value.split('-').map(Number)
  return dateFormatter.format(new Date(year, month - 1, day))
}

// Under the field, inside the window's sides; above it when the calendar
// would run past the bottom and fits on top; where neither fits (a short
// phone screen), as low as it can go while all of it shows.
function place() {
  if (!open.value || !root.value) return
  const field = root.value.getBoundingClientRect()
  const width = Math.min(POPOVER_WIDTH, window.innerWidth - 2 * VIEWPORT_EDGE)
  const left = Math.min(
    Math.max(field.left, VIEWPORT_EDGE),
    window.innerWidth - width - VIEWPORT_EDGE,
  )
  const height = popover.value?.offsetHeight || 0
  const below = field.bottom + POPOVER_GAP
  const above = field.top - POPOVER_GAP - height
  let top = below
  if (below + height > window.innerHeight) {
    top = above >= 0 ? above : Math.max(VIEWPORT_EDGE, window.innerHeight - height - VIEWPORT_EDGE)
  }
  popoverStyle.value = { top: `${top}px`, left: `${left}px`, width: `${width}px` }
}

// The calendar grows once its month has loaded, so its place is worked out again then.
let popoverObserver = null
async function toggle() {
  open.value = !open.value
  if (!open.value) return
  place()
  await nextTick()
  place()
  if (popover.value && typeof ResizeObserver !== 'undefined') {
    popoverObserver = new ResizeObserver(place)
    popoverObserver.observe(popover.value)
  }
}

watch(open, (isOpen) => {
  if (isOpen) return
  popoverObserver?.disconnect()
  popoverObserver = null
})

// The picker reports its initial date as soon as it mounts; only a new pick closes it.
function onPick(range) {
  if (!range.startsAt || range.startsAt === props.modelValue) return
  emit('update:modelValue', range.startsAt)
  open.value = false
}

function onPointerDown(event) {
  if (!open.value) return
  if (root.value?.contains(event.target) || popover.value?.contains(event.target)) return
  open.value = false
}
function onKeydown(event) {
  if (open.value && event.key === 'Escape') open.value = false
}

onMounted(() => {
  document.addEventListener('pointerdown', onPointerDown)
  document.addEventListener('keydown', onKeydown)
  window.addEventListener('scroll', place, { capture: true, passive: true })
  window.addEventListener('resize', place)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown)
  document.removeEventListener('keydown', onKeydown)
  window.removeEventListener('scroll', place, { capture: true })
  window.removeEventListener('resize', place)
  popoverObserver?.disconnect()
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
  position: fixed;
  z-index: $z-dropdown;
  border-radius: 14px;
  background: $color-surface;
  box-shadow: 0 12px 32px rgba(6, 27, 49, 0.14);
}
</style>
