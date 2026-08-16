<template>
  <div class="search-page">
    <div class="search-bar-section">
      <div class="container">
        <div class="row align-items-center">
          <div class="col-12 col-md-4 mb-2 mb-md-0">
            <input v-model="query.q" type="text" class="form-control" :placeholder="t('common.search')" @keyup.enter="runSearch" />
          </div>
          <div class="col-6 col-md-3 mb-2 mb-md-0">
            <select v-model="query.cityId" class="form-control form-select" @change="runSearch">
              <option value="">{{ t('search.allCities') }}</option>
              <option v-for="c in cities" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </div>
          <div class="col-6 col-md-3 mb-2 mb-md-0">
            <select v-model="query.sort" class="form-control form-select" @change="runSearch">
              <option value="relevance">{{ t('search.sortRelevance') }}</option>
              <option value="price_asc">{{ t('search.sortPriceAsc') }}</option>
              <option value="price_desc">{{ t('search.sortPriceDesc') }}</option>
              <option value="newest">{{ t('search.sortNewest') }}</option>
            </select>
          </div>
        </div>
        <div class="row align-items-center mt-2">
          <div class="col-6 col-md-3 mb-2 mb-md-0">
            <input v-model="query.dateFrom" type="date" class="form-control" :aria-label="t('search.dateFrom')" @change="runSearch" />
          </div>
          <div class="col-6 col-md-3 mb-2 mb-md-0">
            <input v-model="query.dateTo" type="date" class="form-control" :aria-label="t('search.dateTo')" @change="runSearch" />
          </div>
          <div class="col-12 col-md-2">
            <button class="btn btn-primary-flat btn-block" @click="runSearch">{{ t('common.search') }}</button>
          </div>
        </div>
      </div>
    </div>

    <div class="category-nav-section">
      <div class="container">
        <div class="category-nav-row">
          <button
            v-for="cat in categories"
            :key="cat.id"
            class="category-nav-chip"
            :class="{ 'category-nav-chip-active': selectedCategory?.id === cat.id }"
            @click="selectCategory(cat)"
          >
            {{ cat.name }}
          </button>
        </div>
        <div v-if="selectedCategory?.children?.length" class="category-nav-row category-nav-row-sub">
          <button
            v-for="child in selectedCategory.children"
            :key="child.id"
            class="category-nav-chip category-nav-chip-sub"
            :class="{ 'category-nav-chip-active': query.categorySlug === child.slug }"
            @click="selectSubcategory(child)"
          >
            {{ child.name }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="filtersOpenMobile" class="filter-drawer-backdrop d-none-md" @click.self="filtersOpenMobile = false">
      <aside class="filter-drawer card">
        <div class="filter-drawer-header">
          <span class="text-section-title">{{ t('search.filters') }}</span>
          <button class="filter-drawer-close" @click="filtersOpenMobile = false">{{ t('common.close') }}</button>
        </div>
        <FilterFields
          :query="query"
          :filterable-attributes="filterableAttributes"
          @set-attr="setAttrFilter"
          @search="runSearch(); filtersOpenMobile = false"
        />
      </aside>
    </div>

    <div class="container search-body">
      <div class="row">
        <aside class="col-12 col-md-3 mb-4 mb-md-0 d-none-mobile">
          <div class="card">
            <div class="card-body">
              <FilterFields
                :query="query"
                :filterable-attributes="filterableAttributes"
                :show-search-button="false"
                @set-attr="setAttrFilter"
                @search="runSearch"
              />
            </div>
          </div>
        </aside>

        <section class="col-12 col-md-9">
          <div class="search-toolbar mb-3">
            <button class="btn btn-tertiary btn-sm" @click="filtersOpenMobile = !filtersOpenMobile">
              {{ t('search.filters') }}
            </button>
            <button class="btn btn-tertiary btn-sm" @click="mapOpenMobile = !mapOpenMobile">
              {{ mapOpenMobile ? t('search.showList') : t('search.showMap') }}
            </button>
          </div>

          <div v-if="activeFilterChips.length" class="active-filters mb-3">
            <span class="active-filter-chip" v-for="chip in activeFilterChips" :key="chip.key" @click="chip.clear">
              {{ chip.label }} ✕
            </span>
            <button class="active-filter-clear-all" @click="clearAllFilters">{{ t('search.clearAllFilters') }}</button>
          </div>

          <div v-if="loading" class="text-muted">{{ t('common.loading') }}</div>

          <template v-else-if="results.length">
            <p class="text-muted results-count mb-3">{{ t('search.resultsCount', { count: total }) }}</p>
            <!-- R158: list and map toggle on mobile, sit side by side (stacked here) on desktop. -->
            <div class="row mb-4" :class="{ 'mobile-hidden': mapOpenMobile }">
              <div v-for="listing in results" :key="listing.id" class="col-6 col-md-4 mb-4">
                <ListingCard :listing="listing" />
              </div>
            </div>
            <div class="search-map-wrap mb-4" :class="{ 'mobile-hidden': !mapOpenMobile }">
              <button v-if="mapMovedManually" class="btn btn-primary-flat btn-sm map-search-area-btn" @click="searchThisArea">
                {{ t('search.searchThisArea') }}
              </button>
              <ListingMap :listings="results" @bounds-change="onBoundsChange" />
            </div>

            <nav v-if="totalPages > 1" class="search-pagination">
              <button class="btn btn-tertiary btn-sm" :disabled="query.page <= 1" @click="goToPage(query.page - 1)">
                {{ t('listing.back') }}
              </button>
              <span class="text-muted">{{ query.page }} / {{ totalPages }}</span>
              <button class="btn btn-tertiary btn-sm" :disabled="query.page >= totalPages" @click="goToPage(query.page + 1)">
                {{ t('common.next') }}
              </button>
            </nav>
          </template>

          <div v-else class="empty-results card">
            <div class="card-body text-center">
              <p class="text-body mb-3">{{ activeFilterChips.length ? t('search.noResultsWithFilters') : t('search.noResults') }}</p>
              <button class="btn btn-tertiary mb-3" @click="tryRelaxedSearch">{{ t('search.relaxSearch') }}</button>
              <div class="form-row-inline notify-form">
                <input v-model="notifyEmail" type="email" class="form-control" :placeholder="t('auth.email')" />
                <button class="btn btn-primary-flat" @click="submitNotify">{{ t('search.notifyMe') }}</button>
              </div>
              <p v-if="notifySent" class="text-success mt-2">{{ t('search.notifySent') }}</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
const { t } = useI18n()
const api = useApi()
const route = useRoute()
const router = useRouter()

const categories = ref([])
const cities = ref([])
const selectedCategory = ref(null)
const filterableAttributes = ref([])
const results = ref([])
const total = ref(0)
const loading = ref(false)
const filtersOpenMobile = ref(false)
const mapOpenMobile = ref(false)
const notifyEmail = ref('')
const notifySent = ref(false)
const mapMovedManually = ref(false)

const query = reactive({
  q: route.query.q || '',
  categorySlug: route.query.categorySlug || '',
  cityId: route.query.cityId || '',
  priceMin: route.query.priceMin ? Number(route.query.priceMin) : null,
  priceMax: route.query.priceMax ? Number(route.query.priceMax) : null,
  dateFrom: route.query.dateFrom || '',
  dateTo: route.query.dateTo || '',
  onlineBookingOnly: route.query.onlineBookingOnly === '1',
  sort: route.query.sort || 'relevance',
  page: 1,
  pageSize: 24,
})

const attributeFilters = reactive(new Map())

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / query.pageSize)))

// RNT-053 — filters used to live only in component state: a refresh or a
// shared link silently dropped everything the visitor had just set up.
function syncUrlFromQuery() {
  router.replace({
    query: {
      q: query.q || undefined,
      categorySlug: query.categorySlug || undefined,
      cityId: query.cityId || undefined,
      priceMin: query.priceMin || undefined,
      priceMax: query.priceMax || undefined,
      dateFrom: query.dateFrom || undefined,
      dateTo: query.dateTo || undefined,
      onlineBookingOnly: query.onlineBookingOnly ? '1' : undefined,
      sort: query.sort !== 'relevance' ? query.sort : undefined,
    },
  })
}

const activeFilterChips = computed(() => {
  const chips = []
  if (query.cityId) {
    const city = cities.value.find((c) => c.id === query.cityId)
    if (city) chips.push({ key: 'city', label: city.name, clear: () => { query.cityId = ''; runSearch() } })
  }
  if (query.dateFrom && query.dateTo) {
    chips.push({
      key: 'date',
      label: `${query.dateFrom} → ${query.dateTo}`,
      clear: () => { query.dateFrom = ''; query.dateTo = ''; runSearch() },
    })
  }
  if (query.priceMin || query.priceMax) {
    const label = query.priceMin && query.priceMax
      ? `${query.priceMin}–${query.priceMax} RSD`
      : query.priceMin
        ? `${query.priceMin}+ RSD`
        : `${t('listing.price')} < ${query.priceMax} RSD`
    chips.push({ key: 'price', label, clear: () => { query.priceMin = null; query.priceMax = null; runSearch() } })
  }
  if (query.onlineBookingOnly) {
    chips.push({ key: 'onlineBooking', label: t('search.onlineBookingOnly'), clear: () => { query.onlineBookingOnly = false; runSearch() } })
  }
  if (selectedCategory.value) {
    chips.push({ key: 'category', label: selectedCategory.value.name, clear: () => clearCategory() })
  }
  return chips
})

function clearCategory() {
  selectedCategory.value = null
  query.categorySlug = ''
  attributeFilters.clear()
  filterableAttributes.value = []
  runSearch()
}

function clearAllFilters() {
  query.cityId = ''
  query.priceMin = null
  query.priceMax = null
  query.dateFrom = ''
  query.dateTo = ''
  query.onlineBookingOnly = false
  selectedCategory.value = null
  query.categorySlug = ''
  attributeFilters.clear()
  filterableAttributes.value = []
  runSearch()
}

function setAttrFilter(attributeId, key, value) {
  const current = attributeFilters.get(attributeId) || { attributeId };
  if (value === '' || value === null || (Array.isArray(value) && value.length === 0)) {
    delete current[key]
  } else {
    current[key] = key === 'min' || key === 'max' ? Number(value) : value
  }
  attributeFilters.set(attributeId, current)
}

async function selectCategory(cat) {
  selectedCategory.value = cat
  query.categorySlug = cat.slug
  attributeFilters.clear()
  filterableAttributes.value = await api.get(`/search/filters?categorySlug=${cat.slug}`)
  runSearch()
}

function selectSubcategory(child) {
  query.categorySlug = child.slug
  runSearch()
}

async function runSearch() {
  // A fresh top-level search (search bar, filters, category) should override
  // whatever area the user had previously framed on the map — otherwise
  // typing a new query while panned across the country silently returns
  // nothing.
  query.mapNorth = query.mapSouth = query.mapEast = query.mapWest = undefined
  mapMovedManually.value = false
  loading.value = true
  query.page = 1
  await executeSearch()
  loading.value = false
}

async function searchThisArea() {
  mapMovedManually.value = false
  loading.value = true
  query.page = 1
  await executeSearch()
  loading.value = false
}

async function goToPage(page) {
  query.page = page
  loading.value = true
  await executeSearch()
  loading.value = false
}

async function executeSearch() {
  syncUrlFromQuery()
  const body = {
    ...query,
    priceMin: query.priceMin || undefined,
    priceMax: query.priceMax || undefined,
    cityId: query.cityId || undefined,
    categorySlug: query.categorySlug || undefined,
    dateFrom: query.dateFrom || undefined,
    dateTo: query.dateTo || undefined,
    attributes: attributeFilters.size ? Array.from(attributeFilters.values()) : undefined,
  }
  const response = await api.post('/search', body)
  results.value = response.results
  total.value = response.total
}

async function tryRelaxedSearch() {
  loading.value = true
  const response = await api.post('/search/relaxed', query)
  results.value = response.results
  total.value = response.total
  loading.value = false
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
  // Doesn't search yet — surfaces the "Pretraži ovo područje" button instead,
  // same UX the Bible itself describes (Ch.24.5) for this feature.
  mapMovedManually.value = true
}

onMounted(async () => {
  ;[categories.value, cities.value] = await Promise.all([api.get('/categories'), api.get('/locations/cities')])
  if (query.categorySlug) {
    selectedCategory.value =
      categories.value.find((c) => c.slug === query.categorySlug) ||
      categories.value.find((c) => c.children?.some((ch) => ch.slug === query.categorySlug))
  }
  await runSearch()
})

useSeoMeta({ title: t('common.search') })
</script>

<style lang="scss" scoped>
.search-bar-section {
  background: $color-surface;
  border-bottom: 1px solid $color-border;
  padding: 16px 0;
}

.category-nav-section {
  background: $color-background;
  border-bottom: 1px solid $color-border;
  padding: 10px 0;
}

.category-nav-row {
  display: flex;
  gap: 8px;
  overflow-x: auto;
}

.category-nav-row-sub {
  margin-top: 8px;
}

.category-nav-chip {
  flex-shrink: 0;
  padding: 6px 14px;
  border-radius: $radius-pill;
  border: 1px solid $color-border;
  background: $color-surface;
  font-size: $font-size-muted;
  color: $color-text;
  cursor: pointer;
  white-space: nowrap;
}

.category-nav-chip-sub {
  background: transparent;
}

.category-nav-chip-active {
  border-color: $color-primary;
  color: $color-primary;
  font-weight: 600;
}

.search-body {
  padding: 24px 0 48px;
}

.search-toolbar {
  display: none;
  gap: 8px;
}

@include mobile-only {
  .search-toolbar {
    display: flex;
  }
  .mobile-hidden {
    display: none;
  }
}

.search-map-wrap {
  position: relative;
  height: 500px;
}

.map-search-area-btn {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: $z-dropdown;
  box-shadow: $shadow-card;
}

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
  max-width: 340px;
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

.search-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.empty-results {
  padding: 32px;
}

.results-count {
  font-size: $font-size-muted;
}

.active-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.active-filter-chip {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  border-radius: $radius-pill;
  border: 1px solid $color-border;
  background: $color-surface;
  font-size: $font-size-muted;
  color: $color-text;
  cursor: pointer;
}

.active-filter-chip:hover {
  border-color: $color-primary;
  color: $color-primary;
}

.active-filter-clear-all {
  border: none;
  background: none;
  color: $color-text-muted;
  font-size: $font-size-muted;
  text-decoration: underline;
  cursor: pointer;
}

.notify-form {
  max-width: 360px;
  margin: 0 auto;
  justify-content: center;
}
</style>
