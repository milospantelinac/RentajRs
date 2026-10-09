<template>
  <Teleport to="body">
    <Transition name="filter-panel">
      <div v-if="open" class="filter-panel-root">
        <!-- Figma 682:1431 — dims everything below the header, not the header
             itself, so the visitor keeps their bearings. -->
        <div class="filter-panel-scrim" @click="$emit('close')" />

        <aside class="filter-panel" role="dialog" aria-modal="true" :aria-label="t('search.filters')">
          <header class="filter-panel-header">
            <h2 class="filter-panel-title">{{ t('search.filters') }}</h2>
            <button type="button" class="filter-panel-close" :aria-label="t('common.close')" @click="$emit('close')">
              <img src="/images/icons/close-x.svg" alt="" width="16" height="16" />
            </button>
          </header>

          <!-- T115: the category's "Više filtera", in the order of Tamara's
               table. Price, date and online booking live in the bar only. -->
          <div class="filter-panel-body">
            <section v-for="filter in sections" :key="filter.key" class="fp-section">
              <!-- Od / do -->
              <template v-if="filter.control === 'RANGE'">
                <div class="fp-section-head">
                  <span class="fp-section-title">{{ getSearchFilterLabel(filter, t) }}</span>
                  <span v-if="filter.unit" class="fp-section-note">{{ filter.unit }}</span>
                </div>
                <div class="fp-field-row">
                  <input
                    type="number"
                    class="fp-field"
                    :placeholder="t('search.priceFrom')"
                    :value="rangeValue(filter, 'min')"
                    @input="setRange(filter, 'min', $event.target.value)"
                  />
                  <input
                    type="number"
                    class="fp-field"
                    :placeholder="t('search.priceTo')"
                    :value="rangeValue(filter, 'max')"
                    @input="setRange(filter, 'max', $event.target.value)"
                  />
                </div>
              </template>

              <!-- A yes/no attribute, or one option of a list as a switch of its own (Ljubimci dozvoljeni). -->
              <label v-else-if="filter.control === 'TOGGLE' || filter.control === 'OPTION_TOGGLE'" class="fp-switch-row">
                <span class="fp-switch-label">{{ getSearchFilterLabel(filter, t) }}</span>
                <input
                  type="checkbox"
                  class="fp-option-input"
                  :checked="Boolean(draft.get(filter.key))"
                  @change="setValue(filter, $event.target.checked || null)"
                />
                <span class="fp-switch" aria-hidden="true"><span class="fp-switch-knob" /></span>
              </label>

              <!-- One of a short list. -->
              <template v-else-if="filter.control === 'SELECT' || filter.control === 'MIN'">
                <div class="fp-section-head">
                  <span class="fp-section-title">{{ getSearchFilterLabel(filter, t) }}</span>
                </div>
                <div class="fp-chips">
                  <button
                    type="button"
                    class="fp-chip"
                    :class="{ 'fp-chip-active': !draft.has(filter.key) }"
                    @click="setValue(filter, null)"
                  >
                    {{ t('search.anyValue') }}
                  </button>
                  <button
                    v-for="choice in chipChoices(filter)"
                    :key="choice.value"
                    type="button"
                    class="fp-chip"
                    :class="{ 'fp-chip-active': draft.get(filter.key) === choice.value }"
                    @click="setValue(filter, choice.value)"
                  >
                    {{ choice.label }}
                  </button>
                </div>
              </template>

              <!-- Several of a list: any of them (Marka vozila) or all of them
                   (Opremljenost). The most common first, the rest on request. -->
              <template v-else>
                <div class="fp-section-head">
                  <span class="fp-section-title">{{ getSearchFilterLabel(filter, t) }}</span>
                  <span v-if="filter.control === 'ALL_OF'" class="fp-section-note">{{ t('search.allSelectedNote') }}</span>
                </div>
                <input
                  v-if="filter.options.length > LIST_SEARCH_FROM"
                  v-model="searchTexts[filter.key]"
                  type="search"
                  class="fp-field fp-search"
                  :placeholder="t('search.searchOptions')"
                  :aria-label="t('search.searchOptions')"
                />
                <ul class="fp-list">
                  <li v-for="opt in visibleOptions(filter)" :key="opt.key">
                    <label class="fp-option">
                      <input
                        type="checkbox"
                        class="fp-option-input"
                        :checked="isChecked(filter, opt.key)"
                        @change="toggleOption(filter, opt.key)"
                      />
                      <span class="fp-checkbox" aria-hidden="true">
                        <img src="/images/icons/check-small.svg" alt="" width="12" height="12" />
                      </span>
                      <span class="fp-option-label">{{ opt.name }}</span>
                    </label>
                  </li>
                </ul>
                <p v-if="searchTexts[filter.key]?.trim() && !visibleOptions(filter).length" class="fp-empty">
                  {{ t('search.noOptionMatch') }}
                </p>
                <button v-if="hiddenCount(filter)" type="button" class="fp-more" @click="expanded[filter.key] = true">
                  {{ t('search.showMoreCount', { count: hiddenCount(filter) }) }}
                </button>
              </template>
            </section>
          </div>

          <footer class="filter-panel-footer">
            <button type="button" class="fp-clear" @click="clearAll">{{ t('search.clearAll') }}</button>
            <button type="button" class="fp-apply" @click="apply">
              {{ t('search.showNListings', { count: total }) }}
            </button>
          </footer>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
/**
 * Dizajn 9 — the "Više filtera" panel. It floats over the results instead of
 * pushing them aside (the ticket is explicit: narrowing the map would defeat
 * the point), and edits a local draft so nothing re-searches until "Prikaži N
 * oglasa" is pressed. T115: it shows the category's own panel filters from
 * GET /search/filters and hands back what is picked in them, by filter key
 * (utils/searchFilters.js).
 */
const props = defineProps({
  open: { type: Boolean, default: false },
  filters: { type: Array, default: () => [] },
  selections: { type: Object, required: true },
  total: { type: Number, default: 0 },
})

const emit = defineEmits(['close', 'apply', 'clear'])

const { t } = useI18n()

const draft = reactive(new Map())
const expanded = reactive({})
const searchTexts = reactive({})

// GUESTS and AREA are the bar's pills; they never sit in the panel.
const sections = computed(() => props.filters.filter((filter) => filter.control !== 'GUESTS' && filter.control !== 'AREA'))

// Re-seed from what is applied every time the panel opens, so a cancelled
// edit never leaks into the next one.
watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return
    draft.clear()
    for (const filter of props.filters) {
      const value = props.selections.get(filter.key)
      if (value === undefined) continue
      draft.set(filter.key, Array.isArray(value) ? [...value] : typeof value === 'object' && value ? { ...value } : value)
    }
    for (const key of Object.keys(expanded)) delete expanded[key]
    for (const key of Object.keys(searchTexts)) delete searchTexts[key]
  },
  { immediate: true },
)

function setValue(filter, value) {
  if (value === null || value === undefined) draft.delete(filter.key)
  else draft.set(filter.key, value)
}

function chipChoices(filter) {
  if (filter.control === 'SELECT') return filter.options.map((option) => ({ value: option.key, label: option.name }))
  return filter.choices.map((choice) => ({ value: choice.value, label: getSearchChoiceLabel(filter, choice.value, t) }))
}

function rangeValue(filter, edge) {
  return draft.get(filter.key)?.[edge] ?? ''
}

function setRange(filter, edge, raw) {
  const range = { min: null, max: null, ...(draft.get(filter.key) || {}) }
  range[edge] = raw === '' || raw === null ? null : Number(raw)
  if (range.min == null && range.max == null) draft.delete(filter.key)
  else draft.set(filter.key, range)
}

function isChecked(filter, key) {
  return Boolean(draft.get(filter.key)?.includes(key))
}

function toggleOption(filter, key) {
  const picked = draft.get(filter.key) || []
  const next = picked.includes(key) ? picked.filter((candidate) => candidate !== key) : [...picked, key]
  setValue(filter, next.length ? next : null)
}

// The 8 options most listings have (Excel rows 25 and 74), and whatever is
// ticked further down; everything once "Prikaži još" is pressed, and every
// match while the search field has text.
function visibleOptions(filter) {
  const sorted = sortOptionsByUse(filter.options)
  const text = foldSearchText(searchTexts[filter.key] || '').trim()
  if (text) return sorted.filter((option) => foldSearchText(option.name).includes(text))
  if (expanded[filter.key]) return sorted
  const picked = draft.get(filter.key) || []
  return sorted.filter((option, index) => index < LIST_PREVIEW_COUNT || picked.includes(option.key))
}

function hiddenCount(filter) {
  if (expanded[filter.key] || (searchTexts[filter.key] || '').trim()) return 0
  return filter.options.length - visibleOptions(filter).length
}

function clearAll() {
  draft.clear()
  emit('clear')
}

function apply() {
  emit('apply', new Map(draft))
}

function onKeydown(event) {
  if (event.key === 'Escape' && props.open) emit('close')
}

// The page behind must not scroll while the panel is up.
watch(
  () => props.open,
  (isOpen) => {
    if (import.meta.server) return
    document.body.style.overflow = isOpen ? 'hidden' : ''
  },
)

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  if (!import.meta.server) document.body.style.overflow = ''
})
</script>

<style lang="scss" scoped>
// Everything sits below the 104px header (Figma 682:1431/682:1432).
$header-height: 104px;

.filter-panel-root {
  position: fixed;
  inset: $header-height 0 0 0;
  z-index: $z-modal;
}

.filter-panel-scrim {
  position: absolute;
  inset: 0;
  background: rgba(6, 27, 49, 0.45);
}

.filter-panel {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  width: 460px;
  max-width: 100%;
  background: $color-surface;
  border-radius: 24px 0 0 24px;
  box-shadow: -12px 0 40px rgba(6, 27, 49, 0.18);
}

.filter-panel-header {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  padding: 24px 20px 20px 28px;
  border-bottom: 1px solid $color-border;
}

.filter-panel-title {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  color: $color-text;
}

.filter-panel-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border: none;
  border-radius: $radius-pill;
  background: $color-background;
  cursor: pointer;
}

.filter-panel-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 24px 28px;
  display: flex;
  flex-direction: column;
  gap: 26px;
}

.fp-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

// On a phone the Opremljenost note goes under its title instead of over it.
.fp-section-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 12px;
}

.fp-section-title {
  flex: 1 0 auto;
  font-size: 15px;
  font-weight: 500;
  color: $color-text;
}

.fp-section-note {
  flex-shrink: 0;
  font-size: 13px;
  color: $color-text-muted;
}

.fp-field-row {
  display: flex;
  gap: 12px;
}

.fp-field {
  flex: 1;
  min-width: 0;
  padding: 13px 16px;
  border: 1px solid $color-border;
  border-radius: $radius-input;
  background: $color-background;
  font-family: $font-family-base;
  font-size: 14px;
  color: $color-text;
}

.fp-field:focus {
  outline: none;
  border-color: $color-primary;
}

// T115: the search over a long Opremljenost list, the od/do fields' look.
.fp-search {
  flex: none;
  width: 100%;
  padding: 11px 16px;
}

.fp-empty {
  margin: 0;
  font-size: 14px;
  color: $color-text-muted;
}

.fp-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.fp-chip {
  padding: 9px 14px;
  border: 1px solid $color-border;
  border-radius: $radius-pill;
  background: $color-surface;
  font-family: $font-family-base;
  font-size: 13px;
  color: $color-text;
  cursor: pointer;
  white-space: nowrap;
}

.fp-chip-active {
  background: $color-accent-tint;
  border: 1.5px solid $color-primary;
  padding: 8.5px 13.5px;
  font-weight: 500;
  color: $color-primary;
}

.fp-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.fp-option {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}

// The real control stays in the DOM for keyboard and assistive tech; the
// styled square next to it is what the visitor sees.
.fp-option-input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.fp-checkbox {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  border: 1.5px solid $color-border;
  border-radius: 5px;
  background: $color-surface;
}

.fp-checkbox img {
  display: block;
  opacity: 0;
}

.fp-option-input:checked ~ .fp-checkbox {
  background: $color-primary;
  border-color: $color-primary;
}

.fp-option-input:checked ~ .fp-checkbox img {
  opacity: 1;
}

.fp-option-input:focus-visible ~ .fp-checkbox {
  outline: 2px solid $color-primary;
  outline-offset: 2px;
}

.fp-option-label {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  color: $color-text-muted;
}

.fp-option-input:checked ~ .fp-option-label {
  color: $color-text;
}

.fp-more {
  align-self: flex-start;
  border: none;
  background: none;
  padding: 0;
  font-family: $font-family-base;
  font-size: 13px;
  font-weight: 500;
  color: $color-primary;
  cursor: pointer;
}

.fp-switch-row {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
}

.fp-switch-label {
  flex: 1;
  min-width: 0;
  font-size: 15px;
  font-weight: 500;
  color: $color-text;
}

.fp-switch {
  position: relative;
  width: 44px;
  height: 26px;
  flex-shrink: 0;
  border-radius: $radius-pill;
  background: rgba($color-text, 0.18);
  transition: background-color 0.15s ease;
}

.fp-switch-knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: $color-surface;
  transition: transform 0.15s ease;
}

.fp-option-input:checked ~ .fp-switch {
  background: $color-primary;
}

.fp-option-input:checked ~ .fp-switch .fp-switch-knob {
  transform: translateX(18px);
}

.filter-panel-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
  padding: 18px 28px 22px;
  border-top: 1px solid $color-border;
  background: $color-surface;
}

.fp-clear {
  flex: 1;
  min-width: 0;
  border: none;
  background: none;
  padding: 0;
  text-align: left;
  font-family: $font-family-base;
  font-size: 14px;
  font-weight: 500;
  color: $color-text-muted;
  cursor: pointer;
}

.fp-apply {
  flex-shrink: 0;
  padding: 15px 26px;
  border: none;
  border-radius: $radius-pill;
  background: linear-gradient(to right, $color-gradient-start, $color-gradient-mid);
  font-family: $font-family-base;
  font-size: 15px;
  font-weight: 500;
  color: $color-surface;
  cursor: pointer;
}

.filter-panel-enter-active,
.filter-panel-leave-active {
  transition: opacity 0.2s ease;
}

.filter-panel-enter-active .filter-panel,
.filter-panel-leave-active .filter-panel {
  transition: transform 0.22s ease;
}

.filter-panel-enter-from,
.filter-panel-leave-to {
  opacity: 0;
}

.filter-panel-enter-from .filter-panel,
.filter-panel-leave-to .filter-panel {
  transform: translateX(100%);
}

@include respond-below(md) {
  .filter-panel {
    width: 100%;
    border-radius: 0;
  }
}
</style>
