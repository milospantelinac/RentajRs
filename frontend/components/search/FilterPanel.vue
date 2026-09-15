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

          <div class="filter-panel-body">
            <!-- Cena -->
            <section class="fp-section">
              <div class="fp-section-head">
                <span class="fp-section-title">{{ t('search.pricePerNight') }}</span>
                <span v-if="priceSummary" class="fp-section-note">{{ priceSummary }}</span>
              </div>
              <div class="fp-range">
                <span class="fp-range-track" />
                <span class="fp-range-fill" :style="rangeFillStyle" />
                <input
                  v-model.number="sliderMin"
                  type="range"
                  class="fp-range-input"
                  :min="0"
                  :max="priceCeiling"
                  :step="priceStep"
                  :aria-label="t('search.priceFrom')"
                />
                <input
                  v-model.number="sliderMax"
                  type="range"
                  class="fp-range-input"
                  :min="0"
                  :max="priceCeiling"
                  :step="priceStep"
                  :aria-label="t('search.priceTo')"
                />
              </div>
              <div class="fp-field-row">
                <input v-model.number="draft.priceMin" type="number" min="0" class="fp-field" :placeholder="t('search.priceFrom')" />
                <input v-model.number="draft.priceMax" type="number" min="0" class="fp-field" :placeholder="t('search.priceTo')" />
              </div>
            </section>

            <!-- Datum -->
            <section class="fp-section">
              <div class="fp-section-head">
                <span class="fp-section-title">{{ t('search.availabilityDate') }}</span>
              </div>
              <div class="fp-field-row">
                <input v-model="draft.dateFrom" type="date" class="fp-field" :aria-label="t('search.dateFrom')" />
                <input v-model="draft.dateTo" type="date" class="fp-field" :aria-label="t('search.dateTo')" />
              </div>
            </section>

            <!-- Kapacitet -->
            <section class="fp-section">
              <div class="fp-section-head">
                <span class="fp-section-title">{{ t('search.filterCapacity') }}</span>
              </div>
              <div class="fp-chips">
                <button
                  v-for="option in capacityChips"
                  :key="option.value || 'any'"
                  type="button"
                  class="fp-chip"
                  :class="{ 'fp-chip-active': String(option.value) === String(draft.guests || '') }"
                  @click="draft.guests = option.value || null"
                >
                  {{ option.label }}
                </button>
              </div>
            </section>

            <!-- The sections below come from whatever the chosen category
                 exposes as filterable, so no category loses a filter it had.
                 Numeric attributes keep their od/do pair, single-choice lists
                 render as pills, and multi-choice ones as a checkbox list. -->
            <section v-for="attr in rangeAttributes" :key="attr.key" class="fp-section">
              <div class="fp-section-head">
                <span class="fp-section-title">{{ attr.name }}</span>
                <span v-if="attr.unit" class="fp-section-note">{{ attr.unit }}</span>
              </div>
              <div class="fp-field-row">
                <input
                  type="number"
                  class="fp-field"
                  :placeholder="t('search.priceFrom')"
                  :value="attrRangeValue(attr, 'min')"
                  @input="setAttrRange(attr, 'min', $event.target.value)"
                />
                <input
                  type="number"
                  class="fp-field"
                  :placeholder="t('search.priceTo')"
                  :value="attrRangeValue(attr, 'max')"
                  @input="setAttrRange(attr, 'max', $event.target.value)"
                />
              </div>
            </section>

            <section v-for="attr in chipAttributes" :key="attr.key" class="fp-section">
              <div class="fp-section-head">
                <span class="fp-section-title">{{ attr.name }}</span>
              </div>
              <div class="fp-chips">
                <button
                  type="button"
                  class="fp-chip"
                  :class="{ 'fp-chip-active': !attrOptionSelected(attr) }"
                  @click="setAttrOption(attr, null)"
                >
                  {{ t('search.anyValue') }}
                </button>
                <button
                  v-for="opt in attr.options"
                  :key="opt.id"
                  type="button"
                  class="fp-chip"
                  :class="{ 'fp-chip-active': attrOptionSelected(attr) === opt.id }"
                  @click="setAttrOption(attr, opt.id)"
                >
                  {{ opt.name }}
                </button>
              </div>
            </section>

            <section v-for="attr in toggleAttributes" :key="attr.key" class="fp-section">
              <label class="fp-switch-row">
                <span class="fp-switch-label">{{ attr.name }}</span>
                <input
                  type="checkbox"
                  class="fp-option-input"
                  :checked="attrBooleanValue(attr)"
                  @change="setAttrBoolean(attr, $event.target.checked)"
                />
                <span class="fp-switch" aria-hidden="true"><span class="fp-switch-knob" /></span>
              </label>
            </section>

            <!-- Deo grada -->
            <section v-if="cityAreas.length" class="fp-section">
              <div class="fp-section-head">
                <span class="fp-section-title">{{ t('search.filterArea') }}</span>
              </div>
              <ul class="fp-list">
                <li v-for="area in visibleAreas" :key="area.id">
                  <label class="fp-option">
                    <input
                      type="checkbox"
                      class="fp-option-input"
                      :checked="draft.cityAreaIds.includes(area.id)"
                      @change="toggleArea(area.id)"
                    />
                    <span class="fp-checkbox" aria-hidden="true">
                      <img src="/images/icons/check-small.svg" alt="" width="12" height="12" />
                    </span>
                    <span class="fp-option-label">{{ area.name }}</span>
                  </label>
                </li>
              </ul>
              <button v-if="cityAreas.length > areaLimit" type="button" class="fp-more" @click="areaLimit = cityAreas.length">
                {{ t('search.showMoreCount', { count: cityAreas.length - areaLimit }) }}
              </button>
            </section>

            <!-- Opremljenost i ostali višestruki izbori -->
            <section v-for="attr in listAttributes" :key="attr.key" class="fp-section">
              <div class="fp-section-head">
                <span class="fp-section-title">{{ attributeLabel(attr) }}</span>
                <span class="fp-section-note">{{ t('search.allSelectedNote') }}</span>
              </div>
              <ul class="fp-list">
                <li v-for="opt in visibleOptions(attr)" :key="opt.id">
                  <label class="fp-option">
                    <input
                      type="checkbox"
                      class="fp-option-input"
                      :checked="isOptionChecked(attr, opt.id)"
                      @change="toggleAttrOption(attr, opt.id)"
                    />
                    <span class="fp-checkbox" aria-hidden="true">
                      <img src="/images/icons/check-small.svg" alt="" width="12" height="12" />
                    </span>
                    <span class="fp-option-label">{{ opt.name }}</span>
                  </label>
                </li>
              </ul>
              <button
                v-if="attr.options.length > (optionLimits[attr.key] || DEFAULT_OPTION_LIMIT)"
                type="button"
                class="fp-more"
                @click="optionLimits[attr.key] = attr.options.length"
              >
                {{ t('search.showMoreCount', { count: attr.options.length - (optionLimits[attr.key] || DEFAULT_OPTION_LIMIT) }) }}
              </button>
            </section>

            <!-- Online rezervacija -->
            <section class="fp-section">
              <div class="fp-section-head">
                <span class="fp-section-title">{{ t('search.onlineBookingTitle') }}</span>
              </div>
              <label class="fp-switch-row">
                <span class="fp-switch-label">{{ t('search.onlineBookingOnly') }}</span>
                <input v-model="draft.onlineBookingOnly" type="checkbox" class="fp-option-input" />
                <span class="fp-switch" aria-hidden="true"><span class="fp-switch-knob" /></span>
              </label>
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
 * oglasa" is pressed.
 */
const props = defineProps({
  open: { type: Boolean, default: false },
  query: { type: Object, required: true },
  attributeFilters: { type: Object, required: true },
  filterableAttributes: { type: Array, default: () => [] },
  cityAreas: { type: Array, default: () => [] },
  total: { type: Number, default: 0 },
})

const emit = defineEmits(['close', 'apply', 'clear'])

const { t } = useI18n()

const DEFAULT_OPTION_LIMIT = 5
const priceCeiling = 100000
const priceStep = 500

const areaLimit = ref(DEFAULT_OPTION_LIMIT)
const optionLimits = reactive({})

const draft = reactive({
  priceMin: null,
  priceMax: null,
  dateFrom: '',
  dateTo: '',
  guests: null,
  cityAreaIds: [],
  onlineBookingOnly: false,
  attributes: new Map(),
})

// Re-seed from the live query every time the panel opens, so a cancelled
// edit never leaks into the next one.
watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return
    draft.priceMin = props.query.priceMin ?? null
    draft.priceMax = props.query.priceMax ?? null
    draft.dateFrom = props.query.dateFrom || ''
    draft.dateTo = props.query.dateTo || ''
    draft.guests = props.query.guests ?? null
    draft.cityAreaIds = [...(props.query.cityAreaIds || [])]
    draft.onlineBookingOnly = Boolean(props.query.onlineBookingOnly)
    draft.attributes = new Map(
      Array.from(props.attributeFilters.entries()).map(([key, value]) => [key, { ...value, optionIds: value.optionIds ? [...value.optionIds] : undefined }]),
    )
    areaLimit.value = DEFAULT_OPTION_LIMIT
    for (const key of Object.keys(optionLimits)) delete optionLimits[key]
  },
  { immediate: true },
)

const capacityChips = computed(() => [
  { value: '', label: t('search.anyValue') },
  ...[2, 4, 6, 8, 10].map((n) => ({ value: n, label: `${n}+` })),
])

const withOptions = computed(() =>
  props.filterableAttributes.filter((a) => Array.isArray(a.options) && a.options.length),
)

const rangeAttributes = computed(() => props.filterableAttributes.filter((a) => a.filterType === 'RANGE'))
const toggleAttributes = computed(() => props.filterableAttributes.filter((a) => a.filterType === 'TOGGLE'))
// T62 — CHECKBOX_GROUP is the multi-select kind, combined with AND on the
// backend; every other option list stays a single choice.
const listAttributes = computed(() => withOptions.value.filter((a) => a.type === 'CHECKBOX_GROUP'))
const chipAttributes = computed(() =>
  withOptions.value.filter((a) => a.type !== 'CHECKBOX_GROUP' && a.filterType !== 'RANGE' && a.filterType !== 'TOGGLE'),
)

const visibleAreas = computed(() => props.cityAreas.slice(0, areaLimit.value))

function visibleOptions(attr) {
  return attr.options.slice(0, optionLimits[attr.key] || DEFAULT_OPTION_LIMIT)
}

// T61: shared with the wizard's step Detalji, which lists the same filters.
function attributeLabel(attr) {
  return getFilterAttributeLabel(attr, t)
}

const priceSummary = computed(() => {
  const { priceMin: min, priceMax: max } = draft
  if (!min && !max) return ''
  const fmt = (n) => new Intl.NumberFormat('sr-RS').format(n)
  if (min && max) return `${fmt(min)} – ${fmt(max)} RSD`
  return min ? `${fmt(min)}+ RSD` : `< ${fmt(max)} RSD`
})

const rangeFillStyle = computed(() => {
  const min = draft.priceMin || 0
  const max = draft.priceMax || priceCeiling
  return {
    left: `${(min / priceCeiling) * 100}%`,
    right: `${100 - (max / priceCeiling) * 100}%`,
  }
})

// The two range inputs need real numbers even when nothing is set yet, so an
// untouched slider shows the full span rather than parking both thumbs at 0.
const sliderMin = computed({
  get: () => draft.priceMin ?? 0,
  set: (value) => {
    draft.priceMin = Number(value)
    clampRange('min')
  },
})

const sliderMax = computed({
  get: () => draft.priceMax ?? priceCeiling,
  set: (value) => {
    draft.priceMax = Number(value)
    clampRange('max')
  },
})

function clampRange(edge) {
  if (draft.priceMin != null && draft.priceMax != null && draft.priceMin > draft.priceMax) {
    if (edge === 'min') draft.priceMax = draft.priceMin
    else draft.priceMin = draft.priceMax
  }
}

function toggleArea(id) {
  const index = draft.cityAreaIds.indexOf(id)
  if (index === -1) draft.cityAreaIds.push(id)
  else draft.cityAreaIds.splice(index, 1)
}

function attrKey(attr) {
  return attr.attributeIds.join(',')
}

/** Single-choice attributes (the chip rows) hold one option group. */
function attrOptionSelected(attr) {
  const entry = draft.attributes.get(attrKey(attr))
  return entry?.optionIds?.[0]?.[0] ?? null
}

function setAttrOption(attr, optionId) {
  const key = attrKey(attr)
  if (!optionId) {
    draft.attributes.delete(key)
  } else {
    draft.attributes.set(key, { attributeIds: attr.attributeIds, optionIds: [[optionId]] })
  }
  draft.attributes = new Map(draft.attributes)
}

function attrRangeValue(attr, edge) {
  const value = draft.attributes.get(attrKey(attr))?.[edge]
  return value ?? ''
}

function setAttrRange(attr, edge, raw) {
  const key = attrKey(attr)
  const entry = { attributeIds: attr.attributeIds, ...(draft.attributes.get(key) || {}) }
  if (raw === '' || raw === null) delete entry[edge]
  else entry[edge] = Number(raw)
  if (entry.min == null && entry.max == null) draft.attributes.delete(key)
  else draft.attributes.set(key, entry)
  draft.attributes = new Map(draft.attributes)
}

function attrBooleanValue(attr) {
  return Boolean(draft.attributes.get(attrKey(attr))?.boolean)
}

function setAttrBoolean(attr, checked) {
  const key = attrKey(attr)
  if (checked) draft.attributes.set(key, { attributeIds: attr.attributeIds, boolean: true })
  else draft.attributes.delete(key)
  draft.attributes = new Map(draft.attributes)
}

function isOptionChecked(attr, optionId) {
  const entry = draft.attributes.get(attrKey(attr))
  return Boolean(entry?.optionIds?.some((group) => group.includes(optionId)))
}

// Multi-select amenities: every picked option is its own group, and the
// backend requires a listing to match all of them (T62's AND semantics).
function toggleAttrOption(attr, optionId) {
  const key = attrKey(attr)
  const entry = draft.attributes.get(key) || { attributeIds: attr.attributeIds, optionIds: [] }
  const groups = (entry.optionIds || []).filter((group) => !group.includes(optionId))
  if (groups.length === (entry.optionIds || []).length) groups.push([optionId])
  if (groups.length) draft.attributes.set(key, { ...entry, optionIds: groups })
  else draft.attributes.delete(key)
  draft.attributes = new Map(draft.attributes)
}

function clearAll() {
  draft.priceMin = null
  draft.priceMax = null
  draft.dateFrom = ''
  draft.dateTo = ''
  draft.guests = null
  draft.cityAreaIds = []
  draft.onlineBookingOnly = false
  draft.attributes = new Map()
  emit('clear')
}

function apply() {
  emit('apply', {
    priceMin: draft.priceMin || null,
    priceMax: draft.priceMax || null,
    dateFrom: draft.dateFrom || '',
    dateTo: draft.dateTo || '',
    guests: draft.guests || null,
    cityAreaIds: [...draft.cityAreaIds],
    onlineBookingOnly: draft.onlineBookingOnly,
    attributes: new Map(draft.attributes),
  })
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

.fp-section-head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.fp-section-title {
  flex: 1;
  min-width: 0;
  font-size: 15px;
  font-weight: 500;
  color: $color-text;
}

.fp-section-note {
  flex-shrink: 0;
  font-size: 13px;
  color: $color-text-muted;
}

// Range slider — two native inputs stacked over a shared track so keyboard
// and screen readers get real controls (Figma 682:1443).
.fp-range {
  position: relative;
  height: 20px;
}

.fp-range-track,
.fp-range-fill {
  position: absolute;
  top: 8px;
  height: 4px;
  border-radius: 2px;
}

.fp-range-track {
  left: 0;
  right: 0;
  background: $color-border;
}

.fp-range-fill {
  background: $color-primary;
}

.fp-range-input {
  position: absolute;
  inset: 0;
  width: 100%;
  margin: 0;
  background: none;
  pointer-events: none;
  appearance: none;
}

.fp-range-input::-webkit-slider-thumb {
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: $color-surface;
  border: 2px solid $color-primary;
  box-shadow: 0 1px 4px rgba(6, 27, 49, 0.2);
  pointer-events: auto;
  cursor: pointer;
}

.fp-range-input::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: $color-surface;
  border: 2px solid $color-primary;
  pointer-events: auto;
  cursor: pointer;
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
  font-size: 14px;
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
