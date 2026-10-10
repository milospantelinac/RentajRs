<template>
  <div ref="rootRef" class="place-field" :class="{ 'is-invalid': invalid, 'is-disabled': disabled }">
    <input
      :id="inputId || undefined"
      ref="inputRef"
      v-model="text"
      type="text"
      class="place-field-input"
      role="combobox"
      autocomplete="off"
      autocapitalize="none"
      spellcheck="false"
      :placeholder="placeholder"
      :aria-label="ariaLabel || undefined"
      :aria-expanded="open"
      :aria-controls="listId"
      :aria-activedescendant="activeId"
      aria-autocomplete="list"
      :aria-invalid="invalid || undefined"
      :disabled="disabled"
      @focus="onFocus"
      @click="onClick"
      @input="onInput"
      @keydown="onKeydown"
      @blur="onBlur"
    />
    <button
      v-if="clearable && (modelValue || text) && !disabled"
      type="button"
      class="place-field-clear"
      :aria-label="t('location.clear')"
      @mousedown.prevent
      @click="clear"
    >
      <svg viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path d="M3.5 3.5L10.5 10.5M10.5 3.5L3.5 10.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
      </svg>
    </button>

    <!-- Teleported and fixed like SelectMenu's panel: the hero card and the
         filter sheet clip their overflow. -->
    <Teleport to="body">
      <Transition name="place-field-pop">
        <ul v-if="open" :id="listId" class="place-field-list" :style="panelStyle" role="listbox" @mousedown.prevent>
          <li v-if="!results.length" class="place-field-status" role="presentation">
            {{ loading ? t('location.searching') : text.trim() ? t('location.noResults') : t('location.typeHint') }}
          </li>
          <li
            v-for="(place, index) in results"
            :id="`${listId}-o${index}`"
            :key="`${place.type}-${place.id}`"
            class="place-field-option"
            :class="{ 'is-active': index === activeIndex, 'is-selected': isSelected(place) }"
            role="option"
            :aria-selected="isSelected(place)"
            @click="choose(place)"
            @mousemove="activeIndex = index"
          >
            <span class="place-field-option-name">{{ place.name }}</span>
            <span class="place-field-option-hint">{{ placeHint(place) }}</span>
          </li>
        </ul>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
/**
 * T119: the place fields (homepage, search page, wizard). Some six thousand
 * settlements are too many for a list, so the field searches as it is typed
 * (GET /locations/search, Latin or Cyrillic, with or without diacritics) and
 * offers the matches with their municipality and okrug; a part of a city
 * ("Vračar") comes with its city. The value is the chosen place as the
 * search returns it, or null for none ("Svi gradovi").
 */
const props = defineProps({
  modelValue: { type: Object, default: null },
  placeholder: { type: String, default: '' },
  ariaLabel: { type: String, default: '' },
  inputId: { type: String, default: '' },
  // The places of this okrug come first (the wizard, once one is picked).
  preferRegionId: { type: String, default: '' },
  withAreas: { type: Boolean, default: true },
  clearable: { type: Boolean, default: true },
  invalid: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'enter'])

const { t } = useI18n()
const api = useApi()
const uid = useId()
const listId = `place-${uid}-list`

const rootRef = ref(null)
const inputRef = ref(null)
const text = ref(placeLabel(props.modelValue))
const open = ref(false)
const results = ref([])
const loading = ref(false)
const activeIndex = ref(-1)
const panelStyle = ref({})
// Whether the arrows moved through the list since it was last filled: Enter
// then picks the marked place even when nothing new was typed.
const moved = ref(false)
// The text the shown results were found for.
let resultsFor = null
let typingTimer = null
let blurTimer = null
let requestId = 0

const PANEL_MAX_HEIGHT = 320
const PANEL_MIN_WIDTH = 260

const activeId = computed(() => (open.value && activeIndex.value >= 0 ? `${listId}-o${activeIndex.value}` : undefined))

// A new value from outside (a link, "Resetuj") shows in the field unless it is being typed in.
watch(
  () => props.modelValue,
  (place) => {
    if (!import.meta.client || document.activeElement !== inputRef.value) text.value = placeLabel(place)
  },
)

function isSelected(place) {
  return !!props.modelValue && props.modelValue.type === place.type && props.modelValue.id === place.id
}

// Under the field's own box when the page marks one (data-place-anchor), else under the input.
function positionPanel() {
  const el = rootRef.value?.closest('[data-place-anchor]') || rootRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const below = window.innerHeight - rect.bottom - 16
  const flip = below < 200 && rect.top > below
  const width = Math.min(Math.max(rect.width, PANEL_MIN_WIDTH), window.innerWidth - 16)
  panelStyle.value = {
    left: `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`,
    width: `${width}px`,
    maxHeight: `${Math.min(PANEL_MAX_HEIGHT, Math.max(flip ? rect.top - 16 : below, 140))}px`,
    ...(flip ? { bottom: `${window.innerHeight - rect.top + 8}px` } : { top: `${rect.bottom + 8}px` }),
  }
}

async function search(typed) {
  const id = ++requestId
  loading.value = true
  try {
    const found = await api.get('/locations/search', {
      query: {
        q: typed || undefined,
        preferRegionId: props.preferRegionId || undefined,
        areas: props.withAreas ? undefined : '0',
      },
    })
    if (id !== requestId) return
    results.value = found || []
    resultsFor = typed
    activeIndex.value = results.value.length ? 0 : -1
    moved.value = false
  } catch {
    if (id === requestId) results.value = []
  } finally {
    if (id === requestId) loading.value = false
  }
}

function openPanel() {
  positionPanel()
  open.value = true
}

function closePanel() {
  open.value = false
  activeIndex.value = -1
}

function onFocus() {
  clearTimeout(blurTimer)
  openPanel()
  // The chosen place's name is replaced by what is typed next.
  if (props.modelValue && text.value === placeLabel(props.modelValue)) {
    inputRef.value?.select()
    search('')
  } else {
    search(text.value.trim())
  }
}

// The field keeps the focus after a pick; a click on it opens the list again.
// The click's mouseup drops the selection onFocus made, so it is made again:
// what is typed next replaces the chosen place's name.
function onClick() {
  if (!open.value) onFocus()
  else if (props.modelValue && text.value === placeLabel(props.modelValue)) inputRef.value?.select()
}

function onInput() {
  if (!open.value) openPanel()
  clearTimeout(typingTimer)
  const typed = text.value.trim()
  typingTimer = setTimeout(() => search(typed), 150)
}

function choose(place) {
  clearTimeout(blurTimer)
  emit('update:modelValue', place)
  text.value = placeLabel(place)
  closePanel()
}

function clear() {
  emit('update:modelValue', null)
  text.value = ''
  results.value = []
  inputRef.value?.focus()
}

// A tap on a phone can blur the field before its click reaches the option, so
// the list waits a moment before it closes.
function onBlur() {
  clearTimeout(blurTimer)
  blurTimer = setTimeout(finishBlur, 150)
}

function finishBlur() {
  closePanel()
  clearTimeout(typingTimer)
  // An emptied field means no place; a half-typed one goes back to the chosen place.
  if (!text.value.trim()) {
    if (props.modelValue) emit('update:modelValue', null)
    text.value = ''
  } else {
    text.value = placeLabel(props.modelValue)
  }
}

function move(delta) {
  const count = results.value.length
  if (!count) return
  activeIndex.value = (activeIndex.value + delta + count) % count
  moved.value = true
  document.getElementById(`${listId}-o${activeIndex.value}`)?.scrollIntoView({ block: 'nearest' })
}

function onKeydown(event) {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      if (!open.value) onFocus()
      else move(1)
      break
    case 'ArrowUp':
      event.preventDefault()
      move(-1)
      break
    case 'Enter': {
      // A pick needs something typed or a place marked with the arrows; Enter on
      // the chosen place's own name keeps it (and runs the page's search).
      const typed = text.value.trim() && text.value !== placeLabel(props.modelValue) ? text.value.trim() : ''
      if (open.value && (typed || moved.value)) {
        event.preventDefault()
        pickOnEnter(typed)
      } else {
        closePanel()
        emit('enter', event)
      }
      break
    }
    case 'Escape':
      if (open.value) {
        event.preventDefault()
        closePanel()
        text.value = placeLabel(props.modelValue)
      }
      break
    case 'Tab':
      closePanel()
      break
  }
}

// Enter typed faster than the search answered: find the text first, then take its best match.
async function pickOnEnter(typed) {
  if (!moved.value && typed && resultsFor !== typed) {
    clearTimeout(typingTimer)
    await search(typed)
  }
  const place = results.value[activeIndex.value]
  if (place) choose(place)
}

function onViewportChange() {
  if (open.value) positionPanel()
}

onMounted(() => {
  window.addEventListener('scroll', onViewportChange, true)
  window.addEventListener('resize', onViewportChange)
})

onBeforeUnmount(() => {
  open.value = false
  clearTimeout(typingTimer)
  clearTimeout(blurTimer)
})

onUnmounted(() => {
  window.removeEventListener('scroll', onViewportChange, true)
  window.removeEventListener('resize', onViewportChange)
})

function placeHint(place) {
  if (place.type === 'area') return [t('location.area'), place.city?.name].filter(Boolean).join(' · ')
  const municipality = place.municipality && place.municipality !== place.name ? place.municipality : ''
  return [municipality, place.region?.name].filter(Boolean).join(' · ')
}
</script>


<style lang="scss" scoped>
.place-field {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.place-field-input {
  flex: 1;
  min-width: 0;
  width: 100%;
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  color: inherit;
  text-overflow: ellipsis;
}

.place-field-input:focus {
  outline: none;
}

.place-field-input::placeholder {
  color: $color-text-muted;
  opacity: 1;
}

.place-field.is-disabled {
  opacity: 0.6;
}

.place-field-clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: none;
  color: $color-text-muted;
  cursor: pointer;
}

.place-field-clear svg {
  width: 14px;
  height: 14px;
}

.place-field-clear:hover,
.place-field-clear:focus-visible {
  background: $color-background;
  color: $color-text;
  outline: none;
}

// Fixed + teleported to <body>; positionPanel() supplies top/left/width.
.place-field-list {
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

.place-field-option {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 9px 12px;
  border-radius: 8px;
  cursor: pointer;
}

.place-field-option.is-active {
  background: $color-background;
}

.place-field-option.is-selected {
  background: $color-accent-tint;
}

.place-field-option-name {
  font-size: 14px;
  font-weight: 500;
  line-height: 1.3;
  color: $color-text;
}

.place-field-option.is-selected .place-field-option-name {
  color: $color-primary;
}

.place-field-option-hint {
  font-size: 12px;
  line-height: 1.3;
  color: $color-text-muted;
}

.place-field-status {
  padding: 10px 12px;
  font-size: 14px;
  line-height: 1.3;
  color: $color-text-muted;
}

.place-field-pop-enter-active,
.place-field-pop-leave-active {
  transition:
    opacity 0.12s ease,
    transform 0.12s ease;
}

.place-field-pop-enter-from,
.place-field-pop-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
