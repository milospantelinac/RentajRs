<template>
  <div ref="rootRef" class="place-select">
    <button
      :id="triggerId"
      ref="triggerRef"
      type="button"
      class="place-select-trigger"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-controls="open ? panelId : undefined"
      :aria-label="ariaLabel || undefined"
      @click="onTriggerClick"
      @keydown="onTriggerKeydown"
    >
      <slot name="icon" />
      <span class="place-select-value">{{ modelValue ? placeLabel(modelValue) : placeholder }}</span>
      <svg class="place-select-chevron" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path d="M3.5 5.25L7 8.75L10.5 5.25" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>

    <!-- Teleported and fixed like SelectMenu's panel: the filter sheet clips its overflow. -->
    <Teleport to="body">
      <Transition name="place-select-pop">
        <div v-if="open" :id="panelId" ref="panelRef" class="place-select-panel" :style="panelStyle">
          <div class="place-select-search">
            <img src="/images/icons/search-line.svg" alt="" class="place-select-search-icon" width="16" height="16" />
            <input
              ref="searchRef"
              v-model="text"
              type="text"
              class="place-select-search-input"
              role="combobox"
              autocomplete="off"
              autocapitalize="none"
              spellcheck="false"
              aria-autocomplete="list"
              aria-expanded="true"
              :aria-controls="listId"
              :aria-activedescendant="activeId"
              :placeholder="t('location.searchPlaceholder')"
              :aria-label="t('location.searchPlaceholder')"
              @input="onInput"
              @keydown="onSearchKeydown"
            />
            <button
              v-if="text"
              type="button"
              class="place-select-search-clear"
              :aria-label="t('location.clearSearch')"
              @click="clearText"
            >
              <svg viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M3.5 3.5L10.5 10.5M10.5 3.5L3.5 10.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
              </svg>
            </button>
          </div>

          <ul :id="listId" ref="listRef" class="place-select-list" role="listbox" :aria-label="ariaLabel || undefined">
            <li
              v-for="(row, index) in rows"
              :id="`${listId}-o${index}`"
              :key="row === ALL ? 'all' : `${row.type}-${row.id}`"
              class="place-select-option"
              :class="{ 'is-active': index === activeIndex, 'is-selected': isSelected(row) }"
              role="option"
              :aria-selected="isSelected(row)"
              @click="choose(row)"
              @mousemove="activeIndex = index"
            >
              <span class="place-select-option-name">{{ row === ALL ? placeholder : row.name }}</span>
              <span v-if="row !== ALL" class="place-select-option-hint">{{ placeHint(row) }}</span>
              <svg v-if="isSelected(row)" class="place-select-check" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M2.5 7.5L5.5 10.5L11.5 3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </li>
            <li v-if="status" class="place-select-status" role="presentation">{{ status }}</li>
          </ul>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script>
// One list for every place dropdown, read again after ten minutes (the API
// keeps its own for as long).
const BROWSE_TTL_MS = 10 * 60 * 1000
let browseCache = null
</script>

<script setup>
/**
 * A place picked from a dropdown (the search page's city): the button shows
 * the chosen place or "Svi gradovi", and its panel has a search field above
 * a list that can be scrolled by hand. Untyped, the list is "Svi gradovi" and
 * then every town and every place with listings, by name
 * (GET /locations/browse); typed, it is the search's matches among all the
 * places and parts of a city (GET /locations/search), as in
 * LocationAutocomplete. The value is the chosen place, or null for none.
 */
const props = defineProps({
  modelValue: { type: Object, default: null },
  placeholder: { type: String, default: '' },
  ariaLabel: { type: String, default: '' },
  withAreas: { type: Boolean, default: true },
})

const emit = defineEmits(['update:modelValue'])

const { t } = useI18n()
const api = useApi()
const uid = useId()
const triggerId = `place-select-${uid}`
const panelId = `place-select-${uid}-panel`
const listId = `place-select-${uid}-list`

// The "Svi gradovi" row.
const ALL = Object.freeze({ all: true })

const rootRef = ref(null)
const triggerRef = ref(null)
const panelRef = ref(null)
const searchRef = ref(null)
const listRef = ref(null)
const open = ref(false)
const text = ref('')
const browse = ref([])
const browseLoading = ref(false)
const results = ref([])
const loading = ref(false)
const activeIndex = ref(-1)
const panelStyle = ref({})
// The text the shown results were found for.
let resultsFor = ''
let typingTimer = null
let requestId = 0

const PANEL_MAX_HEIGHT = 400
const PANEL_MIN_WIDTH = 320
const SEARCH_LIMIT = 20

const typed = computed(() => text.value.trim())

// The chosen place comes right after "Svi gradovi" when the list leaves it
// out (a village without listings, a part of a city).
const rows = computed(() => {
  if (typed.value) return results.value
  const chosen = props.modelValue && !browse.value.some(isSelected) ? [props.modelValue] : []
  return [ALL, ...chosen, ...browse.value]
})

const status = computed(() => {
  // The last matches stay up while the next ones are found.
  if (typed.value) {
    if (results.value.length) return ''
    return loading.value || resultsFor !== typed.value ? t('location.searching') : t('location.noResults')
  }
  return browseLoading.value && !browse.value.length ? t('location.searching') : ''
})

const activeId = computed(() => (activeIndex.value >= 0 && rows.value[activeIndex.value] ? `${listId}-o${activeIndex.value}` : undefined))

function isSelected(row) {
  if (row === ALL) return !props.modelValue
  return !!props.modelValue && props.modelValue.type === row.type && props.modelValue.id === row.id
}

function selectedIndex() {
  return Math.max(rows.value.findIndex(isSelected), 0)
}

// From the field's own box when the page marks one (data-place-anchor), else
// from the button. A page can also mark the box around it (data-place-bounds,
// the search bar): the panel then opens under that box, clear of what shares
// it (the phone's button under the city), and keeps inside its right edge.
function positionPanel() {
  const anchor = rootRef.value?.closest('[data-place-anchor]') || rootRef.value
  if (!anchor) return
  const rect = anchor.getBoundingClientRect()
  const bounds = anchor.closest('[data-place-bounds]')?.getBoundingClientRect()
  const outer = bounds || rect
  const right = Math.min(bounds ? bounds.right : Infinity, window.innerWidth - 8)
  const below = window.innerHeight - outer.bottom - 16
  const flip = below < 260 && outer.top > below
  const width = Math.min(Math.max(rect.width, PANEL_MIN_WIDTH), window.innerWidth - 16)
  panelStyle.value = {
    left: `${Math.max(8, Math.min(rect.left, right - width))}px`,
    width: `${width}px`,
    maxHeight: `${Math.min(PANEL_MAX_HEIGHT, Math.max(flip ? outer.top - 16 : below, 200))}px`,
    ...(flip ? { bottom: `${window.innerHeight - outer.top + 8}px` } : { top: `${outer.bottom + 8}px` }),
  }
}

// The list is scrolled by hand rather than with scrollIntoView, which would
// scroll the page under the fixed panel as well.
function scrollToActive({ center = false } = {}) {
  const list = listRef.value
  const item = list && activeIndex.value >= 0 ? list.children[activeIndex.value] : null
  if (!item) return
  const top = item.offsetTop
  const bottom = top + item.offsetHeight
  if (center) list.scrollTop = top - (list.clientHeight - item.offsetHeight) / 2
  else if (top < list.scrollTop) list.scrollTop = top
  else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight
}

function loadBrowse() {
  if (!browseCache || Date.now() - browseCache.at > BROWSE_TTL_MS) {
    const request = api.get('/locations/browse')
    browseCache = { at: Date.now(), request }
    request.catch(() => {
      if (browseCache?.request === request) browseCache = null
    })
  }
  const { request } = browseCache
  browseLoading.value = true
  request
    .then(async (list) => {
      const first = !browse.value.length
      browse.value = list || []
      // The chosen place shows in the list the moment it first arrives.
      if (first && open.value && !typed.value) {
        activeIndex.value = selectedIndex()
        await nextTick()
        scrollToActive({ center: true })
      }
    })
    .catch(() => {})
    .finally(() => {
      browseLoading.value = false
    })
}

async function openMenu({ focusSearch }) {
  text.value = ''
  results.value = []
  resultsFor = ''
  positionPanel()
  open.value = true
  activeIndex.value = selectedIndex()
  loadBrowse()
  await nextTick()
  // A phone keeps its keyboard down until the search field is tapped, so the list shows whole.
  if (focusSearch) searchRef.value?.focus({ preventScroll: true })
  scrollToActive({ center: true })
}

function closeMenu({ refocus = false } = {}) {
  open.value = false
  activeIndex.value = -1
  clearTimeout(typingTimer)
  requestId++
  loading.value = false
  if (refocus) triggerRef.value?.focus()
}

function finePointer() {
  return window.matchMedia?.('(hover: hover) and (pointer: fine)').matches ?? true
}

// A click made with Enter or Space (detail 0) always goes on to the search field.
function onTriggerClick(event) {
  if (open.value) closeMenu()
  else openMenu({ focusSearch: event.detail === 0 || finePointer() })
}

function onTriggerKeydown(event) {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    if (!open.value) openMenu({ focusSearch: true })
    else searchRef.value?.focus()
  } else if (event.key === 'Escape' && open.value) {
    event.preventDefault()
    closeMenu()
  }
}

async function search(query) {
  const id = ++requestId
  loading.value = true
  try {
    const found = await api.get('/locations/search', {
      query: { q: query, limit: SEARCH_LIMIT, areas: props.withAreas ? undefined : '0' },
    })
    if (id !== requestId) return
    results.value = found || []
    resultsFor = query
    activeIndex.value = results.value.length ? 0 : -1
    if (listRef.value) listRef.value.scrollTop = 0
  } catch {
    if (id === requestId) {
      results.value = []
      resultsFor = query
    }
  } finally {
    if (id === requestId) loading.value = false
  }
}

function onInput() {
  clearTimeout(typingTimer)
  const query = typed.value
  if (!query) {
    showBrowse()
    return
  }
  loading.value = true
  typingTimer = setTimeout(() => search(query), 150)
}

async function showBrowse() {
  requestId++
  loading.value = false
  results.value = []
  resultsFor = ''
  activeIndex.value = selectedIndex()
  await nextTick()
  scrollToActive({ center: true })
}

function clearText() {
  text.value = ''
  clearTimeout(typingTimer)
  showBrowse()
  searchRef.value?.focus()
}

function choose(row) {
  emit('update:modelValue', row === ALL ? null : row)
  closeMenu({ refocus: true })
}

function move(delta) {
  const count = rows.value.length
  if (!count) return
  activeIndex.value = activeIndex.value < 0 ? (delta > 0 ? 0 : count - 1) : Math.min(Math.max(activeIndex.value + delta, 0), count - 1)
  scrollToActive()
}

function onSearchKeydown(event) {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      move(1)
      break
    case 'ArrowUp':
      event.preventDefault()
      move(-1)
      break
    case 'PageDown':
      event.preventDefault()
      move(8)
      break
    case 'PageUp':
      event.preventDefault()
      move(-8)
      break
    case 'Enter':
      event.preventDefault()
      pickOnEnter()
      break
    case 'Escape':
      event.preventDefault()
      closeMenu({ refocus: true })
      break
    // The button takes the focus back, so Tab goes on from it to the next field.
    case 'Tab':
      closeMenu({ refocus: true })
      break
  }
}

// Enter typed faster than the search answered: find the text first, then take its best match.
async function pickOnEnter() {
  const query = typed.value
  if (query && resultsFor !== query) {
    clearTimeout(typingTimer)
    await search(query)
  }
  const row = rows.value[activeIndex.value]
  if (row) choose(row)
}

// The panel lives on <body>: a click inside it is outside rootRef. The event's
// path is read rather than contains(), since the clicked node may be gone by
// now (the search's clear button goes with the text).
useClickOutside(rootRef, (event) => {
  if (!open.value || (panelRef.value && event.composedPath().includes(panelRef.value))) return
  closeMenu()
})

function onViewportChange(event) {
  if (!open.value) return
  if (event?.type === 'scroll' && panelRef.value?.contains(event.target)) return
  positionPanel()
}

onMounted(() => {
  window.addEventListener('scroll', onViewportChange, true)
  window.addEventListener('resize', onViewportChange)
})

onBeforeUnmount(() => {
  open.value = false
  clearTimeout(typingTimer)
})

onUnmounted(() => {
  window.removeEventListener('scroll', onViewportChange, true)
  window.removeEventListener('resize', onViewportChange)
})

// "Opština · okrug", leaving out what repeats the name ("Beograd", okrug Beograd).
function placeHint(place) {
  if (place.type === 'area') return [t('location.area'), place.city?.name].filter(Boolean).join(' · ')
  return [place.municipality, place.region?.name].filter((part) => part && part !== place.name).join(' · ')
}
</script>

<style lang="scss" scoped>
.place-select {
  position: relative;
  display: flex;
  min-width: 0;
}

.place-select-trigger {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-width: 0;
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.place-select-value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.place-select-chevron {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: $color-text-muted;
  transition: transform 0.15s ease;
}

.place-select-trigger[aria-expanded='true'] .place-select-chevron {
  transform: rotate(180deg);
}

// Fixed + teleported to <body>; positionPanel() supplies top/left/width/max-height.
.place-select-panel {
  position: fixed;
  z-index: $z-modal;
  display: flex;
  flex-direction: column;
  padding: 6px;
  background: $color-surface;
  border-radius: $radius-input;
  box-shadow: $shadow-card;
}

.place-select-search {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
  height: 40px;
  margin-bottom: 6px;
  padding: 0 6px 0 12px;
  background: $color-background;
  border: 1px solid transparent;
  border-radius: 8px;
}

.place-select-search:focus-within {
  border-color: $color-primary;
}

.place-select-search-icon {
  display: block;
  flex-shrink: 0;
}

.place-select-search-input {
  flex: 1;
  min-width: 0;
  padding: 0;
  border: none;
  background: none;
  font-family: $font-family-base;
  font-size: 14px;
  color: $color-text;
}

// 16px keeps iOS from zooming the page when the field is tapped.
@media (hover: none) and (pointer: coarse) {
  .place-select-search-input {
    font-size: 16px;
  }
}

.place-select-search-input:focus {
  outline: none;
}

.place-select-search-input::placeholder {
  color: $color-text-muted;
  opacity: 1;
}

.place-select-search-clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: none;
  color: $color-text-muted;
  cursor: pointer;
}

.place-select-search-clear svg {
  width: 14px;
  height: 14px;
}

.place-select-search-clear:hover,
.place-select-search-clear:focus-visible {
  background: $color-surface;
  color: $color-text;
  outline: none;
}

// The offsetParent of the options, for scrollToActive().
.place-select-list {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  list-style: none;
}

.place-select-option {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 9px 12px;
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.3;
  color: $color-text;
  cursor: pointer;
}

.place-select-option.is-active {
  background: $color-background;
}

.place-select-option.is-selected {
  background: $color-accent-tint;
}

.place-select-option-name {
  flex-shrink: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.place-select-option.is-selected .place-select-option-name {
  font-weight: 500;
  color: $color-primary;
}

.place-select-option-hint {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: $color-text-muted;
}

.place-select-check {
  align-self: center;
  width: 14px;
  height: 14px;
  margin-left: auto;
  flex-shrink: 0;
  color: $color-primary;
}

.place-select-status {
  padding: 10px 12px;
  font-size: 14px;
  line-height: 1.3;
  color: $color-text-muted;
}

.place-select-pop-enter-active,
.place-select-pop-leave-active {
  transition:
    opacity 0.12s ease,
    transform 0.12s ease;
}

.place-select-pop-enter-from,
.place-select-pop-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
