<template>
  <span class="info-hint" @mouseenter="show('hovered')" @mouseleave="hovered = false">
    <button
      type="button"
      class="info-hint-button"
      :aria-label="label || t('bookingForm.tips.label')"
      :aria-describedby="open ? bubbleId : undefined"
      :aria-expanded="open"
      @focus="show('focused')"
      @blur="focused = false"
      @click="togglePinned"
      @keydown.esc="close"
    >
      <img src="/images/icons/info-circle.svg" alt="" />
    </button>
    <span v-show="open" :id="bubbleId" role="tooltip" class="info-hint-bubble" :class="`is-${align}`">{{ text }}</span>
  </span>
</template>

<script setup>
// Dizajn 40: the frame's (i) marks (556:618, 556:622, 556:626) open one short
// sentence on hover, keyboard focus or a tap.
defineProps({
  text: { type: String, required: true },
  label: { type: String, default: '' },
  // Which edge of the mark the sentence lines up with.
  align: { type: String, default: 'start' },
})

const { t } = useI18n()
const bubbleId = useId()
const hovered = ref(false)
const focused = ref(false)
const pinned = ref(false)
// Escape hides it until the pointer or the focus comes back.
const dismissed = ref(false)
const open = computed(() => !dismissed.value && (hovered.value || focused.value || pinned.value))

function show(source) {
  dismissed.value = false
  if (source === 'hovered') hovered.value = true
  else focused.value = true
}

// A tap also focuses and hovers the mark, so the first one leaves it open.
function togglePinned() {
  dismissed.value = false
  pinned.value = !pinned.value
}

function close() {
  pinned.value = false
  dismissed.value = true
}
</script>

<style lang="scss" scoped>
.info-hint {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
}

.info-hint-button {
  display: inline-flex;
  width: 16px;
  height: 16px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  cursor: help;
}

.info-hint-button img {
  width: 16px;
  height: 16px;
}

.info-hint-button:focus-visible {
  outline: 2px solid $color-primary;
  outline-offset: 2px;
}

.info-hint-bubble {
  position: absolute;
  z-index: $z-dropdown;
  top: calc(100% + 8px);
  width: max-content;
  max-width: 260px;
  padding: 10px 12px;
  border-radius: 8px;
  background: $color-text;
  color: $color-surface;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  text-align: left;
  white-space: normal;
  box-shadow: 0 8px 24px rgba(97, 115, 133, 0.18);
}

.info-hint-bubble.is-start {
  left: -8px;
}

.info-hint-bubble.is-end {
  right: -8px;
}
</style>
