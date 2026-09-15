<template>
  <div class="search-page">
    <div class="container search-top">
      <!-- Dizajn 8 — one bar across the full 1216 content column: term,
           separator, city, primary action. -->
      <form class="search-bar" @submit.prevent="runSearch">
        <div class="search-bar-term">
          <img src="/images/icons/search-line.svg" alt="" class="search-bar-icon" width="18" height="18" />
          <input
            v-model="query.q"
            type="text"
            class="search-bar-input"
            :placeholder="t('search.queryPlaceholder')"
            :aria-label="t('common.search')"
          />
        </div>
        <span class="search-bar-separator" aria-hidden="true" />
        <div class="search-bar-city">
          <img src="/images/icons/pin-line.svg" alt="" class="search-bar-icon" width="18" height="18" />
          <SelectMenu
            v-model="query.cityId"
            :options="cityOptions"
            :placeholder="t('search.allCities')"
            :aria-label="t('search.cityLabel')"
            variant="bare"
            @update:model-value="onCityChange"
          />
        </div>
        <button type="submit" class="search-bar-submit">{{ t('search.submit') }}</button>
      </form>

      <div class="category-tiles">
        <button
          v-for="tile in categoryTiles"
          :key="tile.slug || 'all'"
          type="button"
          class="category-tile"
          :class="{ 'category-tile-active': tile.slug === activeCategorySlug }"
          :aria-pressed="tile.slug === activeCategorySlug"
          @click="selectCategoryTile(tile)"
        >
          <CategoryTileIcon :slug="tile.iconSlug" />
          <span class="category-tile-label">{{ tile.name }}</span>
        </button>
      </div>

      <!-- Dizajn 10 — subcategory pills with their listing counts; the first
           one reselects the parent ("Sve nekretnine"). -->
      <div v-if="subcategoryPills.length" class="subcategory-row">
        <button
          v-for="pill in subcategoryPills"
          :key="pill.slug"
          type="button"
          class="subcategory-pill"
          :class="{ 'subcategory-pill-active': pill.slug === query.categorySlug }"
          @click="selectSubcategoryPill(pill)"
        >
          <span class="subcategory-pill-label">{{ pill.name }}</span>
          <span class="subcategory-pill-count">{{ pill.count }}</span>
        </button>
      </div>

      <div class="filter-bar">
        <FilterPill
          :label="t('search.filterPrice')"
          :value="priceLabel"
          :active="Boolean(query.priceMin || query.priceMax)"
          :panel-width="300"
        >
          <template #default="{ close }">
            <div class="filter-panel-row">
              <label class="filter-panel-field">
                <span class="filter-panel-label">{{ t('search.priceFrom') }}</span>
                <input v-model.number="priceDraft.min" type="number" min="0" class="form-control" />
              </label>
              <label class="filter-panel-field">
                <span class="filter-panel-label">{{ t('search.priceTo') }}</span>
                <input v-model.number="priceDraft.max" type="number" min="0" class="form-control" />
              </label>
            </div>
            <div class="filter-panel-actions">
              <button type="button" class="btn btn-text btn-sm" @click="clearPrice(close)">{{ t('search.reset') }}</button>
              <button type="button" class="btn btn-primary-flat btn-sm" @click="applyPrice(close)">{{ t('search.apply') }}</button>
            </div>
          </template>
        </FilterPill>

        <FilterPill
          :label="t('search.filterDate')"
          :value="dateLabel"
          :active="Boolean(query.dateFrom || query.dateTo)"
          :panel-width="320"
        >
          <template #default="{ close }">
            <div class="filter-panel-row">
              <label class="filter-panel-field">
                <span class="filter-panel-label">{{ t('search.dateFrom') }}</span>
                <input v-model="dateDraft.from" type="date" class="form-control" />
              </label>
              <label class="filter-panel-field">
                <span class="filter-panel-label">{{ t('search.dateTo') }}</span>
                <input v-model="dateDraft.to" type="date" class="form-control" />
              </label>
            </div>
            <div class="filter-panel-actions">
              <button type="button" class="btn btn-text btn-sm" @click="clearDates(close)">{{ t('search.reset') }}</button>
              <button type="button" class="btn btn-primary-flat btn-sm" @click="applyDates(close)">{{ t('search.apply') }}</button>
            </div>
          </template>
        </FilterPill>

        <FilterPill
          :label="t('search.filterCapacity')"
          :value="capacityLabel"
          :active="Boolean(query.guests)"
          :panel-width="220"
        >
          <template #default="{ close }">
            <ul class="filter-option-list">
              <li v-for="option in capacityOptions" :key="option.value || 'any'">
                <button
                  type="button"
                  class="filter-option"
                  :class="{ 'filter-option-selected': String(option.value) === String(query.guests || '') }"
                  @click="applyCapacity(option.value, close)"
                >
                  {{ option.label }}
                </button>
              </li>
            </ul>
          </template>
        </FilterPill>

        <!-- Dizajn 10 — the bar also carries the chosen category's own
             single-choice filters; ranges and multi-selects stay in the
             panel, where they have room for their real controls. -->
        <FilterPill
          v-for="attr in barAttributes"
          :key="attr.key"
          :label="attr.name"
          :value="attrPillValue(attr)"
          :active="Boolean(attrSelectedOption(attr))"
          :panel-width="240"
        >
          <template #default="{ close }">
            <ul class="filter-option-list">
              <li>
                <button
                  type="button"
                  class="filter-option"
                  :class="{ 'filter-option-selected': !attrSelectedOption(attr) }"
                  @click="applyAttrOption(attr, null, close)"
                >
                  {{ t('search.anyValue') }}
                </button>
              </li>
              <li v-for="opt in attr.options" :key="opt.id">
                <button
                  type="button"
                  class="filter-option"
                  :class="{ 'filter-option-selected': attrSelectedOption(attr) === opt.id }"
                  @click="applyAttrOption(attr, opt.id, close)"
                >
                  {{ opt.name }}
                </button>
              </li>
            </ul>
          </template>
        </FilterPill>
        <FilterPill
          :label="t('search.filterArea')"
          :value="areaLabel"
          :active="query.cityAreaIds.length > 0"
          :panel-width="240"
        >
          <template #default="{ close }">
            <p v-if="!query.cityId" class="filter-panel-hint">{{ t('search.allCities') }}</p>
            <ul v-else class="filter-option-list">
              <li v-for="option in areaOptions" :key="option.value || 'any'">
                <button
                  type="button"
                  class="filter-option"
                  :class="{ 'filter-option-selected': option.value ? query.cityAreaIds.includes(option.value) : !query.cityAreaIds.length }"
                  @click="applyArea(option.value, close)"
                >
                  {{ option.label }}
                </button>
              </li>
            </ul>
          </template>
        </FilterPill>

        <button
          type="button"
          class="filter-toggle-pill"
          :class="{ 'filter-toggle-pill-active': query.onlineBookingOnly }"
          role="switch"
          :aria-checked="query.onlineBookingOnly"
          @click="toggleOnlineOnly"
        >
          <span class="filter-toggle-label">{{ t('search.onlineOnlyShort') }}</span>
          <span class="filter-switch" aria-hidden="true"><span class="filter-switch-knob" /></span>
        </button>

        <button type="button" class="filter-more-btn" @click="panelOpen = true">
          <img src="/images/icons/sliders.svg" alt="" width="16" height="16" />
          {{ t('search.moreFilters') }}
          <span v-if="panelFilterCount" class="filter-more-count">{{ panelFilterCount }}</span>
        </button>

        <button v-if="hasAnyFilter" type="button" class="filter-clear-all" @click="clearAllFilters">
          {{ t('search.clearAll') }}
        </button>
      </div>
    </div>

    <div class="container">
      <hr class="search-divider" />

      <div class="search-split">
        <section class="search-results">
          <header class="results-header">
            <div>
              <h1 class="results-title">{{ resultsTitle }}</h1>
              <p class="results-subtitle">{{ resultsSubtitle }}</p>
            </div>
            <div class="results-sort">
              <span class="results-sort-label">{{ t('search.sortLabel') }}</span>
              <SelectMenu
                v-model="query.sort"
                :options="sortOptions"
                :aria-label="t('search.sortLabel')"
                variant="bare"
                @update:model-value="runSearch"
              />
            </div>
          </header>

          <div class="search-mobile-toolbar">
            <button type="button" class="btn btn-tertiary btn-sm" @click="mapOpenMobile = !mapOpenMobile">
              {{ mapOpenMobile ? t('search.showList') : t('search.showMap') }}
            </button>
          </div>

          <p v-if="loading && !results.length" class="text-muted">{{ t('common.loading') }}</p>

          <div v-else-if="searchError" class="empty-results card">
            <div class="card-body text-center">
              <p class="form-error mb-0">{{ searchError }}</p>
            </div>
          </div>

          <template v-else-if="results.length">
            <div class="results-grid" :class="{ 'mobile-hidden': mapOpenMobile }">
              <ListingCard v-for="listing in results" :key="listing.id" :listing="listing" />
            </div>

            <div class="results-pagination" :class="{ 'mobile-hidden': mapOpenMobile }">
              <p class="results-shown">{{ t('search.shownOfTotal', { shown: results.length, total }) }}</p>
              <button v-if="results.length < total" type="button" class="results-load-more" :disabled="loading" @click="loadMore">
                {{ loading ? t('common.loading') : t('search.loadMore') }}
              </button>
            </div>
          </template>

          <div v-else class="empty-results card">
            <div class="card-body text-center">
              <p class="text-body mb-3">{{ hasAnyFilter ? t('search.noResultsWithFilters') : t('search.noResults') }}</p>
              <button class="btn btn-tertiary mb-3" @click="tryRelaxedSearch">{{ t('search.relaxSearch') }}</button>
              <div class="form-row-inline notify-form">
                <input v-model="notifyEmail" type="email" class="form-control" :placeholder="t('auth.email')" />
                <button class="btn btn-primary-flat" @click="submitNotify">{{ t('search.notifyMe') }}</button>
              </div>
              <p v-if="notifySent" class="text-success mt-2">{{ t('search.notifySent') }}</p>
            </div>
          </div>
        </section>

        <aside class="search-map-col" :class="{ 'mobile-hidden': !mapOpenMobile }">
          <div class="search-map-frame" :class="{ 'search-map-frame-expanded': mapExpanded }">
            <ListingMap :listings="results" @bounds-change="onBoundsChange" />

            <label class="map-live-toggle">
              <input v-model="searchAsIMove" type="checkbox" class="map-live-checkbox" />
              <span>{{ t('search.searchAsIMove') }}</span>
            </label>

            <button v-if="mapMovedManually && !searchAsIMove" type="button" class="map-search-area-btn" @click="searchThisArea">
              {{ t('search.searchThisArea') }}
            </button>

            <button type="button" class="map-expand-btn" @click="mapExpanded = !mapExpanded">
              {{ mapExpanded ? t('common.close') : t('search.expandMap') }}
            </button>
          </div>
          <p class="search-map-note">{{ t('search.mapStaysNote') }}</p>
        </aside>
      </div>
    </div>

    <FilterPanel
      :open="panelOpen"
      :query="query"
      :attribute-filters="attributeFilters"
      :filterable-attributes="filterableAttributes"
      :city-areas="cityAreas"
      :total="total"
      @close="panelOpen = false"
      @apply="applyPanelFilters"
      @clear="clearAllFilters"
    />
  </div>
</template>

<script setup>
const { t, locale } = useI18n()
const api = useApi()
const route = useRoute()
const router = useRouter()

const categories = ref([])
const cities = ref([])
const cityAreas = ref([])
const selectedCategory = ref(null)
const filterableAttributes = ref([])
const results = ref([])
const total = ref(0)
const loading = ref(false)
const searchError = ref('')
const panelOpen = ref(false)
const mapOpenMobile = ref(false)
const mapExpanded = ref(false)
const searchAsIMove = ref(false)
const notifyEmail = ref('')
const notifySent = ref(false)
const mapMovedManually = ref(false)

const query = reactive({
  q: route.query.q || '',
  categorySlug: route.query.categorySlug || '',
  cityId: route.query.cityId || '',
  cityAreaIds: route.query.cityAreaIds ? String(route.query.cityAreaIds).split(',').filter(Boolean) : [],
  priceMin: route.query.priceMin ? Number(route.query.priceMin) : null,
  priceMax: route.query.priceMax ? Number(route.query.priceMax) : null,
  dateFrom: route.query.dateFrom || '',
  dateTo: route.query.dateTo || '',
  guests: route.query.guests ? Number(route.query.guests) : null,
  onlineBookingOnly: route.query.onlineBookingOnly === '1',
  sort: route.query.sort || 'relevance',
  page: 1,
  pageSize: 24,
})

const attributeFilters = reactive(new Map())

// Drafts so a half-typed price/date range doesn't fire a search on every
// keystroke — the popover applies them explicitly.
const priceDraft = reactive({ min: query.priceMin, max: query.priceMax })
const dateDraft = reactive({ from: query.dateFrom, to: query.dateTo })

// -- Options -----------------------------------------------------------

const cityOptions = computed(() => [
  { value: '', label: t('search.allCities') },
  ...cities.value.map((c) => ({ value: c.id, label: c.name })),
])

const areaOptions = computed(() => [
  { value: '', label: t('search.anyValue') },
  ...cityAreas.value.map((a) => ({ value: a.id, label: a.name })),
])

const capacityOptions = computed(() => [
  { value: '', label: t('search.anyValue') },
  ...[2, 4, 6, 8, 10, 20, 50].map((n) => ({ value: n, label: t('search.capacityOption', { count: n }) })),
])

const sortOptions = computed(() => [
  { value: 'relevance', label: t('search.sortRelevance') },
  { value: 'price_asc', label: t('search.sortPriceAsc') },
  { value: 'price_desc', label: t('search.sortPriceDesc') },
  { value: 'newest', label: t('search.sortNewest') },
])

// The tile row leads with "Sve" (no category) and then the six real
// categories in the order the ticket spells out.
const categoryTiles = computed(() => [
  { slug: '', iconSlug: ALL_CATEGORIES_SLUG, name: t('search.allCategories'), category: null },
  ...sortSearchCategories(categories.value).map((c) => ({ slug: c.slug, iconSlug: c.slug, name: c.name, category: c })),
])

// A subcategory keeps its parent's tile highlighted.
const activeCategorySlug = computed(() => selectedCategory.value?.slug || '')

// Dizajn 10 — "Sve <kategorija>" first, then each child, each with the count
// the categories endpoint reports (a parent's is its whole subtree).
const subcategoryPills = computed(() => {
  const parent = selectedCategory.value
  if (!parent?.children?.length) return []
  return [
    // Just "Sve": the ticket's own examples decline the determiner with the
    // category's grammatical gender ("Sve nekretnine", "Sva vozila", "Svi
    // prostori"), which isn't derivable from the name — and the tile above
    // already says which category this is. Raised on the card.
    { slug: parent.slug, name: t('search.allCategories'), count: parent.listingCount ?? 0 },
    ...parent.children.map((child) => ({ slug: child.slug, name: child.name, count: child.listingCount ?? 0 })),
  ]
})

function selectSubcategoryPill(pill) {
  if (pill.slug === query.categorySlug) return
  const child = selectedCategory.value?.children?.find((c) => c.slug === pill.slug)
  return child ? selectSubcategory(child) : selectCategory(selectedCategory.value)
}

// -- Filter labels ------------------------------------------------------

const numberFormat = computed(() => new Intl.NumberFormat(locale.value === 'en' ? 'en-US' : 'sr-RS'))

const priceLabel = computed(() => {
  const { priceMin: min, priceMax: max } = query
  if (min && max) return `${numberFormat.value.format(min)} – ${numberFormat.value.format(max)} RSD`
  if (min) return `${numberFormat.value.format(min)}+ RSD`
  if (max) return `< ${numberFormat.value.format(max)} RSD`
  return ''
})

const dateLabel = computed(() => {
  const { dateFrom: from, dateTo: to } = query
  if (!from && !to) return ''
  const fmt = (iso, withMonth) =>
    new Date(iso).toLocaleDateString(locale.value === 'en' ? 'en-US' : 'sr-RS', withMonth ? { day: 'numeric', month: 'short' } : { day: 'numeric' })
  if (from && to) {
    const sameMonth = new Date(from).getMonth() === new Date(to).getMonth()
    return `${fmt(from, !sameMonth)} – ${fmt(to, true)}`
  }
  return fmt(from || to, true)
})

const capacityLabel = computed(() =>
  query.guests ? t('search.capacityOption', { count: query.guests }) : '',
)

const areaLabel = computed(() => {
  const ids = query.cityAreaIds
  if (!ids.length) return ''
  if (ids.length === 1) return cityAreas.value.find((a) => a.id === ids[0])?.name || ''
  return t('search.areasSelected', { count: ids.length })
})

const attributeFilterCount = computed(() => {
  let count = 0
  for (const entry of attributeFilters.values()) {
    if (entry.min != null || entry.max != null) count += 1
    if (entry.boolean) count += 1
    if (entry.optionIds?.length) count += entry.optionIds.length
  }
  return count
})

// The bar already surfaces price, date, capacity, area and online booking as
// their own pills, so the badge on "Više filtera" counts only what lives
// exclusively inside the panel — the category's own attributes.
const panelFilterCount = attributeFilterCount

const hasAnyFilter = computed(
  () =>
    Boolean(query.q) ||
    Boolean(query.cityId) ||
    query.cityAreaIds.length > 0 ||
    Boolean(query.categorySlug) ||
    Boolean(query.priceMin || query.priceMax) ||
    Boolean(query.dateFrom || query.dateTo) ||
    Boolean(query.guests) ||
    query.onlineBookingOnly ||
    attributeFilterCount.value > 0,
)

// -- Results header ------------------------------------------------------

// Dizajn 10 — the heading follows the choice: "Nekretnine u Beogradu" once a
// category is picked, "Oglasi u Beogradu" otherwise. The city is in the
// locative (from the City row), since Serbian city names decline irregularly.
const resultsTitle = computed(() => {
  const city = cities.value.find((c) => c.id === query.cityId)
  const cityName = city ? city.nameLocative || city.name : ''
  const category = activeSubcategory.value?.name || selectedCategory.value?.name || ''

  if (category && cityName) return t('search.categoryInCity', { category, city: cityName })
  if (category) return category
  if (cityName) return t('search.listingsInCity', { city: cityName })
  return t('search.listingsAll')
})

const activeSubcategory = computed(
  () => selectedCategory.value?.children?.find((ch) => ch.slug === query.categorySlug) || null,
)

// Every filter the visitor has actually set — the tally the design puts next
// to the result count once a category is chosen.
const appliedFilterCount = computed(() => {
  let count = 0
  if (query.q) count += 1
  if (query.cityId) count += 1
  if (query.cityAreaIds.length) count += 1
  if (query.priceMin || query.priceMax) count += 1
  if (query.dateFrom || query.dateTo) count += 1
  if (query.guests) count += 1
  if (query.onlineBookingOnly) count += 1
  return count + attributeFilterCount.value
})

// Serbian declines both numbers independently ("1 oglas · 2 filtera
// primenjena"), so the two halves are pluralised separately and joined.
const resultsSubtitle = computed(() => {
  const listings = t(`search.listingsCount${srPluralCategory(total.value)}`, { count: total.value })
  if (!selectedCategory.value) return `${listings} ${t('search.inAllCategories')}`
  if (!appliedFilterCount.value) return listings
  const filters = t(`search.filtersApplied${srPluralCategory(appliedFilterCount.value)}`, {
    count: appliedFilterCount.value,
  })
  return `${listings} · ${filters}`
})

// -- Filter actions ------------------------------------------------------

function applyPrice(close) {
  query.priceMin = priceDraft.min || null
  query.priceMax = priceDraft.max || null
  close()
  runSearch()
}

function clearPrice(close) {
  priceDraft.min = null
  priceDraft.max = null
  applyPrice(close)
}

function applyDates(close) {
  query.dateFrom = dateDraft.from || ''
  query.dateTo = dateDraft.to || ''
  close()
  runSearch()
}

function clearDates(close) {
  dateDraft.from = ''
  dateDraft.to = ''
  applyDates(close)
}

function applyCapacity(value, close) {
  query.guests = value || null
  close()
  runSearch()
}

// The bar's pill is a single pick; the Dizajn 9 panel can tick several, and
// both write into the same array.
function applyArea(value, close) {
  query.cityAreaIds = value ? [value] : []
  close()
  runSearch()
}

// Only single-choice option lists fit a pill; RANGE and CHECKBOX_GROUP
// attributes keep their fuller controls inside the filter panel.
const barAttributes = computed(() =>
  filterableAttributes.value.filter(
    (a) =>
      Array.isArray(a.options) &&
      a.options.length &&
      a.type !== 'CHECKBOX_GROUP' &&
      a.filterType !== 'RANGE' &&
      a.filterType !== 'TOGGLE',
  ),
)

function attrSelectedOption(attr) {
  return attributeFilters.get(attr.attributeIds.join(','))?.optionIds?.[0]?.[0] ?? null
}

function attrPillValue(attr) {
  const selected = attrSelectedOption(attr)
  return selected ? (attr.options.find((o) => o.id === selected)?.name ?? '') : ''
}

function applyAttrOption(attr, optionId, close) {
  const key = attr.attributeIds.join(',')
  if (optionId) attributeFilters.set(key, { attributeIds: attr.attributeIds, optionIds: [[optionId]] })
  else attributeFilters.delete(key)
  close()
  runSearch()
}
function toggleOnlineOnly() {
  query.onlineBookingOnly = !query.onlineBookingOnly
  runSearch()
}

// Dizajn 9 — the panel edits its own draft and hands the whole set over at
// once, so nothing re-searches until "Prikaži N oglasa" is pressed.
function applyPanelFilters(payload) {
  query.priceMin = payload.priceMin
  query.priceMax = payload.priceMax
  query.dateFrom = payload.dateFrom
  query.dateTo = payload.dateTo
  query.guests = payload.guests
  query.cityAreaIds = payload.cityAreaIds
  query.onlineBookingOnly = payload.onlineBookingOnly

  attributeFilters.clear()
  for (const [key, value] of payload.attributes) attributeFilters.set(key, value)

  // Keep the bar's own popovers showing what the panel just set.
  priceDraft.min = payload.priceMin
  priceDraft.max = payload.priceMax
  dateDraft.from = payload.dateFrom
  dateDraft.to = payload.dateTo

  panelOpen.value = false
  runSearch()
}

async function onCityChange() {
  // A city area only means something inside its own city.
  query.cityAreaIds = []
  await loadCityAreas()
  runSearch()
}

async function loadCityAreas() {
  const city = cities.value.find((c) => c.id === query.cityId)
  if (!city) {
    cityAreas.value = []
    return
  }
  try {
    cityAreas.value = await api.get(`/locations/cities/${city.slug}/areas`)
  } catch {
    cityAreas.value = []
  }
}

function selectCategoryTile(tile) {
  if (!tile.slug) return clearCategory()
  return selectCategory(tile.category)
}

// RNT-053 — filters used to live only in component state: a refresh or a
// shared link silently dropped everything the visitor had just set up.
function syncUrlFromQuery() {
  router.replace({
    query: {
      q: query.q || undefined,
      categorySlug: query.categorySlug || undefined,
      cityId: query.cityId || undefined,
      cityAreaIds: query.cityAreaIds.length ? query.cityAreaIds.join(',') : undefined,
      priceMin: query.priceMin || undefined,
      priceMax: query.priceMax || undefined,
      dateFrom: query.dateFrom || undefined,
      dateTo: query.dateTo || undefined,
      guests: query.guests || undefined,
      onlineBookingOnly: query.onlineBookingOnly ? '1' : undefined,
      sort: query.sort !== 'relevance' ? query.sort : undefined,
    },
  })
}

function clearCategory() {
  selectedCategory.value = null
  query.categorySlug = ''
  attributeFilters.clear()
  filterableAttributes.value = []
  runSearch()
}

function clearAllFilters() {
  query.q = ''
  query.cityId = ''
  query.cityAreaIds = []
  query.priceMin = null
  query.priceMax = null
  query.dateFrom = ''
  query.dateTo = ''
  query.guests = null
  query.onlineBookingOnly = false
  selectedCategory.value = null
  query.categorySlug = ''
  priceDraft.min = null
  priceDraft.max = null
  dateDraft.from = ''
  dateDraft.to = ''
  cityAreas.value = []
  attributeFilters.clear()
  filterableAttributes.value = []
  runSearch()
}

function setAttrFilter(attributeIds, key, value) {
  const mapKey = attributeIds.join(',')
  const current = attributeFilters.get(mapKey) || { attributeIds }
  if (value === '' || value === null || (Array.isArray(value) && value.length === 0)) {
    delete current[key]
  } else {
    current[key] = key === 'min' || key === 'max' ? Number(value) : value
  }
  attributeFilters.set(mapKey, current)
}

async function selectCategory(cat) {
  selectedCategory.value = cat
  query.categorySlug = cat.slug
  attributeFilters.clear()
  filterableAttributes.value = await api.get(`/search/filters?categorySlug=${cat.slug}`)
  runSearch()
}

// T64/T68/T69 — a subcategory (e.g. "Kuće i vikendice", "Putnička vozila")
// has its own filterable attributes, distinct from its parent's. This used to
// leave the panel showing whatever the parent chip had fetched (often
// nothing, since several parents carry no attributes of their own).
async function selectSubcategory(child) {
  query.categorySlug = child.slug
  attributeFilters.clear()
  filterableAttributes.value = await api.get(`/search/filters?categorySlug=${child.slug}`)
  runSearch()
}

async function runSearch() {
  // A fresh top-level search (search bar, filters, category) should override
  // whatever area the user had previously framed on the map — otherwise
  // typing a new query while panned across the country silently returns
  // nothing.
  query.mapNorth = query.mapSouth = query.mapEast = query.mapWest = undefined
  mapMovedManually.value = false
  query.page = 1
  await executeSearch()
}

async function searchThisArea() {
  mapMovedManually.value = false
  query.page = 1
  await executeSearch()
}

// Dizajn 8 — the design replaces prev/next paging with "Prikaži još oglasa",
// so a further page is appended to what is already on screen rather than
// replacing it. Same endpoint, same page size.
async function loadMore() {
  query.page += 1
  await executeSearch({ append: true })
}

// T109 — cityId (and the other fields below) default to '' in `query`, not
// undefined; the backend's DTO validates cityId as a UUID when present, so
// posting the raw reactive object as-is (as tryRelaxedSearch used to) always
// failed validation the moment no city was picked — the common case, since
// nothing defaults it. Shared so relaxed search can't drift from what a
// normal search already sends correctly.
function buildSearchBody() {
  return {
    ...query,
    priceMin: query.priceMin || undefined,
    priceMax: query.priceMax || undefined,
    guests: query.guests || undefined,
    cityId: query.cityId || undefined,
    cityAreaId: undefined,
    cityAreaIds: query.cityAreaIds.length ? query.cityAreaIds : undefined,
    categorySlug: query.categorySlug || undefined,
    dateFrom: query.dateFrom || undefined,
    dateTo: query.dateTo || undefined,
    attributes: attributeFilters.size ? Array.from(attributeFilters.values()) : undefined,
  }
}

// T109 — none of these ever caught a failed request, so a network blip or a
// server error left `loading` stuck true forever: the UI just sat on
// "Učitavanje" with no way out short of leaving the page. Centralizing the
// try/catch/finally here covers every entry point (initial search, "Pretraži
// ovo područje", pagination) in one place.
async function executeSearch({ append = false } = {}) {
  syncUrlFromQuery()
  loading.value = true
  searchError.value = ''
  try {
    const response = await api.post('/search', buildSearchBody())
    results.value = append ? [...results.value, ...response.results] : response.results
    total.value = response.total
  } catch (e) {
    searchError.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    loading.value = false
  }
}

// T109 — "Proširi pretragu" (QA: click left it stuck on "Učitavanje"
// indefinitely). Two bugs compounded here: no error handling (fixed above,
// same pattern), and posting `query` raw instead of through
// buildSearchBody() — with cityId defaulting to '' rather than unset, the
// very first relaxed search with no city picked always failed backend UUID
// validation, which used to just hang forever instead of surfacing anything.
async function tryRelaxedSearch() {
  loading.value = true
  searchError.value = ''
  try {
    const response = await api.post('/search/relaxed', buildSearchBody())
    results.value = response.results
    total.value = response.total
  } catch (e) {
    searchError.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    loading.value = false
  }
}

async function submitNotify() {
  await api.post('/search/notify-empty', { search: query, email: notifyEmail.value })
  notifySent.value = true
}

function onBoundsChange(bounds) {
  query.mapNorth = bounds.north
  query.mapSouth = bounds.south
  query.mapEast = bounds.east
  query.mapWest = bounds.west
  // With "Pretraži dok pomeram mapu" ticked the pan itself is the search;
  // otherwise it surfaces the "Pretraži ovo područje" button instead, the UX
  // the Bible describes (Ch.24.5).
  if (searchAsIMove.value) {
    query.page = 1
    executeSearch()
  } else {
    mapMovedManually.value = true
  }
}

onMounted(async () => {
  ;[categories.value, cities.value] = await Promise.all([api.get('/categories'), api.get('/locations/cities')])
  if (query.categorySlug) {
    selectedCategory.value =
      categories.value.find((c) => c.slug === query.categorySlug) ||
      categories.value.find((c) => c.children?.some((ch) => ch.slug === query.categorySlug))
    if (selectedCategory.value) {
      filterableAttributes.value = await api.get(`/search/filters?categorySlug=${query.categorySlug}`)
    }
  }
  if (query.cityId) await loadCityAreas()
  await runSearch()
})

useSeoMeta({ title: t('common.search') })
</script>

<style lang="scss" scoped>
.search-top {
  padding-top: 30px;
}

// -- Search bar (Figma 158:183) -----------------------------------------

.search-bar {
  display: flex;
  align-items: center;
  padding: 6px;
  border: 1px solid $color-border;
  border-radius: $radius-input;
  background: $color-surface;
}

.search-bar-term {
  display: flex;
  flex: 1;
  min-width: 0;
  align-items: center;
  gap: 12px;
  height: 52px;
  padding: 0 18px;
}

.search-bar-icon {
  display: block;
  flex-shrink: 0;
}

.search-bar-input {
  flex: 1;
  min-width: 0;
  border: none;
  background: none;
  font-family: $font-family-base;
  font-size: 15px;
  color: $color-text;
}

.search-bar-input::placeholder {
  color: $color-text-muted;
}

.search-bar-input:focus {
  outline: none;
}

.search-bar-separator {
  width: 1px;
  height: 28px;
  flex-shrink: 0;
  background: $color-border;
}

.search-bar-city {
  display: flex;
  align-items: center;
  gap: 11px;
  height: 52px;
  padding: 0 16px 0 18px;
  flex-shrink: 0;
}

// The bare SelectMenu carries the hero's muted 14px styling; here the city
// reads as a chosen value, per Figma 158:194.
.search-bar-city :deep(.select-menu-trigger) {
  font-size: 15px;
  font-weight: 500;
  color: $color-text;
}

.search-bar-city :deep(.select-menu-chevron) {
  width: 16px;
  height: 16px;
}

.search-bar-submit {
  flex-shrink: 0;
  height: 52px;
  padding: 0 28px;
  border: none;
  border-radius: $radius-input;
  background: linear-gradient(
    to right,
    $color-gradient-start 0%,
    $color-gradient-mid 55%,
    $color-gradient-end 100%
  );
  color: $color-surface;
  font-family: $font-family-base;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
}

// -- Category tiles (Figma 158:200) --------------------------------------

.category-tiles {
  display: flex;
  gap: 6px;
  margin-top: 24px;
}

.category-tile {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 12px 11px;
  border: 1px solid $color-border;
  border-radius: 16px;
  background: $color-surface;
  color: $color-text;
  cursor: pointer;
}

// Figma tints the icon separately from the label: the mark stays the light
// #CED6DE while the tile is idle, and only the label carries $color-text.
.category-tile :deep(.category-tile-icon) {
  color: #ced6de;
}

.category-tile-label {
  font-family: $font-family-base;
  font-size: 12px;
  line-height: 1.25;
  text-align: center;
  width: 100%;
}

.category-tile-active {
  background: $color-accent-tint;
  border: 1.5px solid $color-primary;
  padding: 11.5px 11.5px 10.5px;
  color: $color-primary;
}

.category-tile-active :deep(.category-tile-icon) {
  color: $color-primary;
}

.category-tile-active .category-tile-label {
  font-weight: 500;
}

// -- Subcategories (Figma 519:548) ----------------------------------------

.subcategory-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 26px;
}

// Figma puts 20px between the subcategory row and the filter bar, against the
// 26px the filter bar keeps when it follows the category tiles directly.
.subcategory-row + .filter-bar {
  margin-top: 20px;
}

.subcategory-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border: 1px solid $color-border;
  border-radius: $radius-pill;
  background: $color-surface;
  font-family: $font-family-base;
  cursor: pointer;
  white-space: nowrap;
}

.subcategory-pill-label {
  font-size: 14px;
  font-weight: 500;
  color: $color-text;
}

.subcategory-pill-count {
  font-size: 13px;
  color: $color-text-muted;
}

// The active subcategory is solid blue, unlike the tinted category tile above
// it — the design uses the stronger fill to separate the two rows.
.subcategory-pill-active {
  background: $color-primary;
  border-color: $color-primary;
}

.subcategory-pill-active .subcategory-pill-label,
.subcategory-pill-active .subcategory-pill-count {
  color: $color-surface;
}

// -- Filter bar (Figma 619:514) ------------------------------------------

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 26px;
  padding-bottom: 20px;
}

.filter-toggle-pill {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px 8px 16px;
  border: 1px solid $color-border;
  border-radius: $radius-pill;
  background: $color-surface;
  font-family: $font-family-base;
  cursor: pointer;
  white-space: nowrap;
}

.filter-toggle-label {
  font-size: 14px;
  color: $color-text;
}

.filter-toggle-pill-active {
  background: $color-accent-tint;
  border: 1.5px solid $color-primary;
  padding: 7.5px 13.5px 7.5px 15.5px;
}

.filter-toggle-pill-active .filter-toggle-label {
  font-weight: 500;
  color: $color-primary;
}

.filter-switch {
  position: relative;
  display: inline-block;
  width: 38px;
  height: 22px;
  flex-shrink: 0;
  border-radius: $radius-pill;
  background: rgba($color-text, 0.18);
  transition: background-color 0.15s ease;
}

.filter-switch-knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: $color-surface;
  transition: transform 0.15s ease;
}

.filter-toggle-pill-active .filter-switch {
  background: $color-primary;
}

.filter-toggle-pill-active .filter-switch-knob {
  transform: translateX(16px);
}

.filter-more-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border: 1px solid $color-text;
  border-radius: $radius-pill;
  background: $color-surface;
  font-family: $font-family-base;
  font-size: 14px;
  font-weight: 500;
  color: $color-text;
  cursor: pointer;
  white-space: nowrap;
}

.filter-more-count {
  padding: 2px 7px;
  border-radius: $radius-pill;
  background: $color-primary;
  color: $color-surface;
  font-size: 12px;
  font-weight: 500;
}

.filter-clear-all {
  border: none;
  background: none;
  font-family: $font-family-base;
  font-size: 14px;
  font-weight: 500;
  color: $color-text-muted;
  cursor: pointer;
}

// Filter popover contents
.filter-panel-row {
  display: flex;
  gap: 12px;
}

.filter-panel-field {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
}

.filter-panel-label {
  font-size: $font-size-label;
  color: $color-text-muted;
}

.filter-panel-hint {
  margin: 0;
  font-size: $font-size-muted;
  color: $color-text-muted;
}

.filter-panel-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 14px;
}

.filter-option-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 260px;
  overflow-y: auto;
}

.filter-option {
  width: 100%;
  padding: 9px 10px;
  border: none;
  border-radius: 8px;
  background: none;
  font-family: $font-family-base;
  font-size: 14px;
  color: $color-text;
  text-align: left;
  cursor: pointer;
}

.filter-option:hover {
  background: $color-background;
}

.filter-option-selected {
  background: $color-accent-tint;
  color: $color-primary;
  font-weight: 500;
}

// -- Split (Figma 158:218) ------------------------------------------------

.search-divider {
  height: 1px;
  margin: 0;
  border: none;
  background: $color-border;
}

.search-split {
  display: flex;
  align-items: flex-start;
  gap: 32px;
  padding-top: 32px;
}

.search-results {
  flex: 1;
  min-width: 0;
}

// Figma: results 632 and map 552 of the 1216 content column.
.search-map-col {
  flex: 0 0 552px;
  position: sticky;
  top: 120px;
}

.results-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 26px;
}

.results-title {
  margin: 0;
  font-size: 26px;
  font-weight: 500;
  line-height: 1.25;
  color: $color-text;
}

.results-subtitle {
  margin: 6px 0 0;
  font-size: 15px;
  color: $color-text-muted;
}

.results-sort {
  display: flex;
  align-items: center;
  gap: 5px;
  height: 46px;
  padding: 0 16px 0 18px;
  border-radius: $radius-input;
  background: $color-background;
  flex-shrink: 0;
}

.results-sort-label {
  font-size: 14px;
  color: $color-text-muted;
  white-space: nowrap;
}

.results-sort :deep(.select-menu-trigger) {
  font-size: 14px;
  font-weight: 500;
  color: $color-text;
}

.results-sort :deep(.select-menu-chevron) {
  width: 16px;
  height: 16px;
}

// Two cards per row, 32px apart (Figma 619:548).
.results-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px 32px;
}

.results-pagination {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 44px 0 90px;
}

.results-shown {
  margin: 0;
  font-size: 14px;
  color: $color-text-muted;
}

.results-load-more {
  height: 48px;
  padding: 0 28px;
  border: none;
  border-radius: 8px;
  background: $color-background;
  font-family: $font-family-base;
  font-size: 15px;
  font-weight: 500;
  color: $color-text;
  cursor: pointer;
}

.results-load-more:disabled {
  opacity: 0.6;
  cursor: default;
}

// -- Map column ----------------------------------------------------------

.search-map-frame {
  position: relative;
  height: 900px;
  max-height: calc(100vh - 160px);
  border-radius: 14px;
  overflow: hidden;
}

.search-map-frame-expanded {
  position: fixed;
  inset: 16px;
  height: auto;
  max-height: none;
  z-index: $z-modal;
  box-shadow: $shadow-card;
}

// Figma 682:1376 — the footnote under the map, sized to the column.
.search-map-note {
  margin: 10px 0 0;
  font-size: 13px;
  color: $color-text-muted;
}

.map-live-toggle {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: $z-dropdown;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px 8px 12px;
  border: 1px solid $color-border;
  border-radius: $radius-pill;
  background: $color-surface;
  font-size: 13px;
  color: $color-text;
  cursor: pointer;
  white-space: nowrap;
}

.map-live-checkbox {
  width: 16px;
  height: 16px;
  margin: 0;
  accent-color: $color-primary;
  cursor: pointer;
}

.map-expand-btn {
  position: absolute;
  right: 16px;
  bottom: 16px;
  z-index: $z-dropdown;
  height: 34px;
  padding: 0 14px;
  border: 1px solid $color-border;
  border-radius: $radius-pill;
  background: $color-surface;
  font-family: $font-family-base;
  font-size: 13px;
  color: $color-text;
  cursor: pointer;
}

.map-search-area-btn {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: $z-dropdown;
  height: 34px;
  padding: 0 14px;
  border: none;
  border-radius: $radius-pill;
  background: $color-primary;
  color: $color-surface;
  font-family: $font-family-base;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  box-shadow: $shadow-card;
}

// -- Mobile ---------------------------------------------------------------

.search-mobile-toolbar {
  display: none;
  margin-bottom: 16px;
}

@include respond-below(lg) {
  .search-split {
    flex-direction: column;
  }

  .search-map-col {
    flex: 1 1 auto;
    width: 100%;
    position: static;
  }

  .search-map-frame {
    height: 480px;
  }

  .category-tiles {
    overflow-x: auto;
    scrollbar-width: none;
  }

  .category-tile {
    flex: 0 0 132px;
  }
}

@include mobile-only {
  .search-mobile-toolbar {
    display: flex;
  }

  .mobile-hidden {
    display: none;
  }

  .results-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .results-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .search-bar {
    flex-wrap: wrap;
  }

  .search-bar-separator {
    display: none;
  }

  .search-bar-term,
  .search-bar-city {
    flex: 1 1 100%;
  }

  .search-bar-submit {
    flex: 1 1 100%;
  }
}

// -- Drawer / empty state (unchanged behaviour) ---------------------------

.filter-drawer-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: $z-modal-backdrop;
  display: flex;
  justify-content: flex-end;
}

.filter-drawer {
  width: 88%;
  max-width: 380px;
  height: 100%;
  border-radius: 0;
  overflow-y: auto;
  padding: 16px;
  animation: slide-in 0.2s ease-out;
}

@keyframes slide-in {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

.filter-drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.filter-drawer-close {
  border: none;
  background: none;
  color: $color-primary;
  font-size: $font-size-muted;
  cursor: pointer;
}

.empty-results {
  padding: 32px;
}

.notify-form {
  max-width: 360px;
  margin: 0 auto;
  justify-content: center;
}
</style>
