<template>
  <div ref="rootRef" class="select-menu" :class="`select-menu-${variant}`">
    <button
      :id="triggerId"
      type="button"
      class="select-menu-trigger"
      role="combobox"
      :aria-expanded="open"
      :aria-controls="listId"
      :aria-label="ariaLabel"
      @click="toggle"
      @keydown="onTriggerKeydown"
    >
      <span class="select-menu-value" :class="{ 'select-menu-value-empty': !selected }">
        {{ displayLabel }}
      </span>
      <svg class="select-menu-chevron" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path d="M3.5 5.25L7 8.75L10.5 5.25" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>

    <!-- Teleported and fixed-positioned because the hero card (and the filter
         sheet) clip their overflow, which would cut the panel off. -->
    <Teleport to="body">
      <Transition name="select-menu-pop">
        <ul
          v-if="open"
          :id="listId"
          ref="listRef"
          class="select-menu-list"
          :style="panelStyle"
          role="listbox"
          :aria-activedescendant="activeId"
          tabindex="-1"
          @keydown="onListKeydown"
        >
          <li
            v-for="(option, index) in options"
            :id="`${listId}-o${index}`"
            :key="String(option.value)"
            class="select-menu-option"
            :class="{
              'select-menu-option-selected': isSelected(option),
              'select-menu-option-active': index === activeIndex,
            }"
            role="option"
            :aria-selected="isSelected(option)"
            @click="choose(option)"
            @mousemove="activeIndex = index"
          >
            <span class="select-menu-option-label">{{ option.label }}</span>
            <svg v-if="isSelected(option)" class="select-menu-check" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M2.5 7.5L5.5 10.5L11.5 3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </li>
        </ul>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
/**
 * Design-system dropdown replacing the native <select>, which renders with the
 * OS's own chrome and can't be styled to the Figma field. Options are plain
 * `{ value, label }` pairs so callers keep owning their data shape.
 *
 * `variant="bare"` drops the field background — used inside the hero search
 * bar, where the surrounding cell already supplies the frame. `variant="control"`
 * is the standalone $color-background field from the Figma Select component.
 */
const props = defineProps({
  modelValue: { type: [String, Number, null], default: '' },
  options: { type: Array, required: true },
  placeholder: { type: String, default: '' },
  ariaLabel: { type: String, default: '' },
  variant: { type: String, default: 'control' },
})

const emit = defineEmits(['update:modelValue'])

const uid = useId()
const triggerId = `select-${uid}-trigger`
const listId = `select-${uid}-list`

const rootRef = ref(null)
const listRef = ref(null)
const open = ref(false)
const activeIndex = ref(-1)
const panelStyle = ref({})

const PANEL_MAX_HEIGHT = 280
const PANEL_MIN_WIDTH = 200

/** Anchors the teleported panel to the trigger, flipping above it if the
 *  viewport has no room below. */
function positionPanel() {
  const el = document.getElementById(triggerId)
  if (!el) return
  const rect = el.getBoundingClientRect()
  const below = window.innerHeight - rect.bottom - 16
  const flip = below < PANEL_MAX_HEIGHT && rect.top > below
  panelStyle.value = {
    left: `${rect.left}px`,
    width: `${Math.max(rect.width, PANEL_MIN_WIDTH)}px`,
    maxHeight: `${Math.min(PANEL_MAX_HEIGHT, Math.max(flip ? rect.top - 16 : below, 140))}px`,
    ...(flip ? { bottom: `${window.innerHeight - rect.top + 8}px` } : { top: `${rect.bottom + 8}px` }),
  }
}

const selected = computed(() => props.options.find((o) => String(o.value) === String(props.modelValue)) ?? null)

// The trigger must never render blank: if the bound value isn't in the list
// yet (options still loading, or a stale query param), fall back to the
// placeholder and then to the list's own first entry.
const displayLabel = computed(() => selected.value?.label || props.placeholder || props.options[0]?.label || '')
const activeId = computed(() => (activeIndex.value >= 0 ? `${listId}-o${activeIndex.value}` : undefined))

function isSelected(option) {
  return String(option.value) === String(props.modelValue)
}

function selectedIndex() {
  return props.options.findIndex((o) => String(o.value) === String(props.modelValue))
}

async function openMenu(startIndex) {
  positionPanel()
  open.value = true
  activeIndex.value = startIndex ?? Math.max(selectedIndex(), 0)
  await nextTick()
  listRef.value?.focus()
  scrollActiveIntoView()
}

function closeMenu({ refocus = false } = {}) {
  open.value = false
  activeIndex.value = -1
  if (refocus) document.getElementById(triggerId)?.focus()
}

function toggle() {
  if (open.value) closeMenu()
  else openMenu()
}

function choose(option) {
  emit('update:modelValue', option.value)
  closeMenu({ refocus: true })
}

function scrollActiveIntoView() {
  if (activeIndex.value < 0) return
  document.getElementById(`${listId}-o${activeIndex.value}`)?.scrollIntoView({ block: 'nearest' })
}

function move(delta) {
  const count = props.options.length
  if (!count) return
  activeIndex.value = (activeIndex.value + delta + count) % count
  scrollActiveIntoView()
}

function onTriggerKeydown(event) {
  if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    openMenu()
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    openMenu(props.options.length - 1)
  }
}

function onListKeydown(event) {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      move(1)
      break
    case 'ArrowUp':
      event.preventDefault()
      move(-1)
      break
    case 'Home':
      event.preventDefault()
      activeIndex.value = 0
      scrollActiveIntoView()
      break
    case 'End':
      event.preventDefault()
      activeIndex.value = props.options.length - 1
      scrollActiveIntoView()
      break
    case 'Enter':
    case ' ':
      event.preventDefault()
      if (props.options[activeIndex.value]) choose(props.options[activeIndex.value])
      break
    case 'Escape':
      event.preventDefault()
      closeMenu({ refocus: true })
      break
    case 'Tab':
      closeMenu()
      break
  }
}

// The panel lives on <body>, so a click inside it is "outside" rootRef — let
// the option's own handler run first and ignore clicks that landed in the list.
useClickOutside(rootRef, (event) => {
  if (listRef.value?.contains(event.target)) return
  closeMenu()
})

function onViewportChange() {
  if (open.value) positionPanel()
}

onMounted(() => {
  window.addEventListener('scroll', onViewportChange, true)
  window.addEventListener('resize', onViewportChange)
})

// The panel is teleported, so tear it down before the component goes away —
// e.g. when the filter sheet closes with a menu still open.
onBeforeUnmount(() => {
  open.value = false
})

onUnmounted(() => {
  window.removeEventListener('scroll', onViewportChange, true)
  window.removeEventListener('resize', onViewportChange)
})
</script>

<style lang="scss" scoped>
.select-menu {
  position: relative;
}

.select-menu-trigger {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  border: none;
  background: none;
  font-family: $font-family-base;
  text-align: left;
  cursor: pointer;
  color: $color-text;
}

// Figma "Select" (node 605:550): $color-background, radius 12, 16/20 padding,
// 15px value, 14px chevron.
.select-menu-control .select-menu-trigger {
  min-height: 51px;
  padding: 16px 20px;
  background: $color-background;
  border: 1px solid transparent;
  border-radius: $radius-input;
  font-size: 15px;
}

.select-menu-control .select-menu-trigger:focus-visible {
  outline: none;
  border-color: $color-primary;
}

// Inside the hero search bar the cell already draws the frame, so the trigger
// only contributes the value row.
.select-menu-bare .select-menu-trigger {
  padding: 0;
  font-size: 14px;
  line-height: 1.1;
  color: $color-text-muted;
}

.select-menu-value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.select-menu-bare .select-menu-value-empty,
.select-menu-control .select-menu-value-empty {
  color: $color-text-muted;
}

.select-menu-chevron {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  color: $color-text-muted;
  transition: transform 0.15s ease;
}

.select-menu-trigger[aria-expanded='true'] .select-menu-chevron {
  transform: rotate(180deg);
}

// Fixed + teleported to <body>; positionPanel() supplies top/left/width.
.select-menu-list {
  position: fixed;
  z-index: $z-modal;
  overflow-y: auto;
  margin: 0;
  padding: 6px;
  list-style: none;
  background: $color-surface;
  border-radius: $radius-input;
  box-shadow: $shadow-card;
}

.select-menu-list:focus {
  outline: none;
}

.select-menu-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.3;
  color: $color-text;
  cursor: pointer;
}

.select-menu-option-active {
  background: $color-background;
}

.select-menu-option-selected {
  background: $color-accent-tint;
  color: $color-primary;
  font-weight: 500;
}

.select-menu-option-label {
  flex: 1;
  min-width: 0;
}

.select-menu-check {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.select-menu-pop-enter-active,
.select-menu-pop-leave-active {
  transition:
    opacity 0.12s ease,
    transform 0.12s ease;
}

.select-menu-pop-enter-from,
.select-menu-pop-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
