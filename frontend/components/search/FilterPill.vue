<template>
  <div ref="rootRef" class="filter-pill-wrap">
    <button
      :id="triggerId"
      type="button"
      class="filter-pill"
      :class="{ 'filter-pill-active': active }"
      :aria-expanded="open"
      :aria-controls="panelId"
      @click="toggle"
    >
      <span class="filter-pill-label">{{ label }}</span>
      <span v-if="value" class="filter-pill-value">{{ value }}</span>
      <svg class="filter-pill-chevron" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path d="M3.5 5.25L7 8.75L10.5 5.25" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>

    <!-- On <body> so the panel isn't clipped by the filter row's own overflow. -->
    <Teleport to="body">
      <Transition name="filter-pop">
        <div v-if="open" :id="panelId" ref="panelRef" class="filter-pill-panel" :style="panelStyle">
          <slot :close="close" />
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
/**
 * Dizajn 8 — one pill on the search filter bar: a label, the current value
 * once set, and a popover holding whatever control that filter needs. The
 * pill turns blue as soon as `active` is true, matching the Figma states.
 */
const props = defineProps({
  label: { type: String, required: true },
  value: { type: String, default: '' },
  active: { type: Boolean, default: false },
  panelWidth: { type: Number, default: 280 },
})

const uid = useId()
const triggerId = `filter-${uid}-trigger`
const panelId = `filter-${uid}-panel`

const rootRef = ref(null)
const panelRef = ref(null)
const open = ref(false)
const panelStyle = ref({})

function positionPanel() {
  const el = document.getElementById(triggerId)
  if (!el) return
  const rect = el.getBoundingClientRect()
  // Keep the panel inside the viewport when the pill sits near the right edge.
  const left = Math.min(rect.left, window.innerWidth - props.panelWidth - 16)
  panelStyle.value = {
    top: `${rect.bottom + 8}px`,
    left: `${Math.max(16, left)}px`,
    width: `${props.panelWidth}px`,
  }
}

function toggle() {
  if (open.value) close()
  else {
    positionPanel()
    open.value = true
  }
}

function close() {
  open.value = false
}

function onViewportChange() {
  if (open.value) positionPanel()
}

useClickOutside(rootRef, (event) => {
  if (panelRef.value?.contains(event.target)) return
  close()
})

function onKeydown(event) {
  if (event.key === 'Escape' && open.value) {
    close()
    document.getElementById(triggerId)?.focus()
  }
}

onMounted(() => {
  window.addEventListener('scroll', onViewportChange, true)
  window.addEventListener('resize', onViewportChange)
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  open.value = false
})

onUnmounted(() => {
  window.removeEventListener('scroll', onViewportChange, true)
  window.removeEventListener('resize', onViewportChange)
  window.removeEventListener('keydown', onKeydown)
})
</script>

<style lang="scss" scoped>
.filter-pill-wrap {
  position: relative;
}

// Figma 619:525 — idle pill.
.filter-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px 10px 16px;
  border: 1px solid $color-border;
  border-radius: $radius-pill;
  background: $color-surface;
  font-family: $font-family-base;
  cursor: pointer;
  white-space: nowrap;
}

.filter-pill-label {
  font-size: 14px;
  color: $color-text;
}

.filter-pill-value {
  font-size: 13px;
  color: $color-text-muted;
}

.filter-pill-chevron {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  color: $color-text-muted;
  transition: transform 0.15s ease;
}

.filter-pill[aria-expanded='true'] .filter-pill-chevron {
  transform: rotate(180deg);
}

// Figma 619:515 — the same pill once the filter carries a value.
.filter-pill-active {
  background: $color-accent-tint;
  border: 1.5px solid $color-primary;
  // 1.5px border instead of 1px would otherwise shift the row by half a pixel.
  padding: 9.5px 13.5px 9.5px 15.5px;
}

.filter-pill-active .filter-pill-label {
  font-weight: 500;
  color: $color-primary;
}

.filter-pill-active .filter-pill-value,
.filter-pill-active .filter-pill-chevron {
  color: $color-primary;
}

.filter-pill-panel {
  position: fixed;
  z-index: $z-modal;
  padding: 16px;
  background: $color-surface;
  border-radius: $radius-input;
  box-shadow: $shadow-card;
}

.filter-pop-enter-active,
.filter-pop-leave-active {
  transition:
    opacity 0.12s ease,
    transform 0.12s ease;
}

.filter-pop-enter-from,
.filter-pop-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
