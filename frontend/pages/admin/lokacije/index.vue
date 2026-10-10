<template>
  <div>
    <DashboardPageHeader :title="t('admin.locations')" :subtitle="t('admin.subtitle.locations')">
      <template #actions>
        <button v-if="tab === 'regions'" class="btn btn-primary-flat btn-sm" @click="openRegionForm(null)">{{ t('admin.loc.newRegion') }}</button>
        <button v-else class="btn btn-primary-flat btn-sm" @click="openCreateCity">{{ t('admin.loc.newCity') }}</button>
      </template>
    </DashboardPageHeader>

    <div class="admin-switch loc-tabs" role="tablist">
      <button
        v-for="key in TABS"
        :key="key"
        type="button"
        role="tab"
        class="admin-switch-btn"
        :class="{ 'is-active': tab === key }"
        :aria-selected="tab === key"
        @click="tab = key"
      >{{ t(`admin.loc.tabs.${key}`) }}</button>
    </div>
    <p v-if="notice" class="loc-notice" role="status">{{ notice }}</p>

    <!-- Mesta: some six thousand, so searched and paged on the server. -->
    <template v-if="tab === 'cities'">
      <div class="admin-filters loc-filters">
        <input
          v-model="filters.q"
          type="search"
          class="admin-field admin-field-search"
          :placeholder="t('admin.loc.searchPlaceholder')"
          :aria-label="t('admin.loc.searchPlaceholder')"
        />
        <select v-model="filters.regionId" class="admin-field loc-filter-select" :aria-label="t('admin.loc.region')">
          <option value="">{{ t('admin.loc.allRegions') }}</option>
          <option v-for="r in regions" :key="r.id" :value="r.id">{{ r.name }}</option>
        </select>
        <select v-model="filters.visibility" class="admin-field loc-filter-select" :aria-label="t('admin.loc.visibility')">
          <option value="all">{{ t('admin.loc.visibilityAll') }}</option>
          <option value="visible">{{ t('admin.loc.visibilityVisible') }}</option>
          <option value="hidden">{{ t('admin.loc.visibilityHidden') }}</option>
        </select>
        <label class="admin-check-row">
          <input v-model="filters.withListings" type="checkbox" class="admin-check" /> {{ t('admin.loc.withListings') }}
        </label>
      </div>

      <div class="admin-card admin-card-table">
        <p v-if="citiesError" class="admin-card-body form-error">{{ citiesError }}</p>
        <p v-else-if="!cityPage.items.length" class="admin-card-body admin-card-note">
          {{ citiesLoading ? t('admin.loc.loading') : t('admin.loc.noResults') }}
        </p>
        <table v-else class="admin-table loc-table">
          <thead>
            <tr>
              <th>{{ t('admin.loc.place') }}</th>
              <th>{{ t('admin.loc.municipality') }}</th>
              <th>{{ t('admin.loc.region') }}</th>
              <th>{{ t('admin.listingCount') }}</th>
              <th>{{ t('admin.statusLabel') }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in cityPage.items" :key="c.id">
              <td :data-label="t('admin.loc.place')">
                <div class="admin-cell-pair">
                  <NuxtLink :to="`/admin/lokacije/${c.id}`" class="admin-cell-name loc-link">{{ c.name }}</NuxtLink>
                  <span class="admin-cell-sub">/{{ c.slug }}<template v-if="c.areaCount"> · {{ t('admin.loc.areaCount', { count: c.areaCount }) }}</template></span>
                </div>
              </td>
              <td :data-label="t('admin.loc.municipality')">{{ c.municipality || '-' }}</td>
              <td :data-label="t('admin.loc.region')">{{ c.region?.name }}</td>
              <td :data-label="t('admin.listingCount')">
                {{ t('admin.cat.activeOfTotal', { active: c.activeListingCount, total: c.listingCount }) }}
              </td>
              <td :data-label="t('admin.statusLabel')">
                <span class="admin-pill" :class="c.hidden ? 'admin-pill-warning' : 'admin-pill-success'">
                  {{ c.hidden ? t('admin.loc.hidden') : t('admin.loc.visible') }}
                </span>
              </td>
              <td class="admin-cell-actions">
                <div class="admin-actions loc-actions">
                  <NuxtLink :to="`/admin/lokacije/${c.id}`" class="admin-action">{{ t('admin.cat.open') }}</NuxtLink>
                  <button class="admin-action" @click="setCityHidden(c, !c.hidden)">
                    {{ c.hidden ? t('admin.loc.show') : t('admin.loc.hide') }}
                  </button>
                  <button class="admin-action admin-action-danger" @click="deleteCity(c)">{{ t('common.delete') }}</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="cityPage.total > cityPage.pageSize" class="loc-pager">
        <button class="btn btn-tertiary btn-sm" :disabled="filters.page <= 1" @click="filters.page -= 1">{{ t('admin.loc.previous') }}</button>
        <span class="admin-card-note">{{ t('admin.loc.pageOf', { page: filters.page, pages: pageCount, total: cityPage.total }) }}</span>
        <button class="btn btn-tertiary btn-sm" :disabled="filters.page >= pageCount" @click="filters.page += 1">{{ t('admin.loc.next') }}</button>
      </div>
      <p v-else-if="cityPage.total" class="admin-card-note loc-total">{{ t('admin.loc.total', { total: cityPage.total }) }}</p>
    </template>

    <!-- Okruzi -->
    <div v-else-if="tab === 'regions'" class="admin-card admin-card-table">
      <table class="admin-table loc-table">
        <thead>
          <tr>
            <th>{{ t('admin.loc.region') }}</th>
            <th>{{ t('admin.loc.placesCount') }}</th>
            <th>{{ t('admin.listingCount') }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in regions" :key="r.id">
            <td :data-label="t('admin.loc.region')">
              <div class="admin-cell-pair">
                <span class="admin-cell-name">{{ r.name }}</span>
                <span class="admin-cell-sub">{{ r.slug }}</span>
              </div>
            </td>
            <td :data-label="t('admin.loc.placesCount')">
              <button class="admin-action" @click="showRegionPlaces(r)">{{ r.cityCount }}</button>
            </td>
            <td :data-label="t('admin.listingCount')">{{ r.listingCount }}</td>
            <td class="admin-cell-actions">
              <div class="admin-actions loc-actions">
                <button class="admin-action" @click="openRegionForm(r)">{{ t('admin.loc.rename') }}</button>
                <button class="admin-action admin-action-danger" @click="deleteRegion(r)">{{ t('common.delete') }}</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Istorija izmena -->
    <div v-else-if="tab === 'history'" class="admin-card admin-card-table">
      <StateBlock v-if="!history.length" icon="locations" :title="t('admin.loc.historyEmpty')" text="" />
      <LocationHistoryTable v-else :rows="history" :regions="regions" />
    </div>

    <!-- Novo mesto -->
    <div v-if="createOpen" class="admin-modal-backdrop" @click.self="createOpen = false">
      <form class="admin-modal admin-card loc-modal" @submit.prevent="createCity">
        <div class="admin-card-body loc-form">
          <p class="admin-card-title">{{ t('admin.loc.newCity') }}</p>
          <div class="form-group">
            <label class="form-label" for="loc-new-name">{{ t('admin.loc.name') }}</label>
            <input id="loc-new-name" v-model="createForm.name" type="text" class="form-control" maxlength="100" required />
          </div>
          <div class="loc-grid">
            <div class="form-group">
              <label class="form-label" for="loc-new-region">{{ t('admin.loc.region') }}</label>
              <select id="loc-new-region" v-model="createForm.regionId" class="form-control form-select" required>
                <option value="" disabled>{{ t('admin.loc.chooseRegion') }}</option>
                <option v-for="r in regions" :key="r.id" :value="r.id">{{ r.name }}</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="loc-new-municipality">{{ t('admin.loc.municipality') }}</label>
              <input id="loc-new-municipality" v-model="createForm.municipality" type="text" class="form-control" maxlength="100" />
            </div>
            <div class="form-group">
              <label class="form-label" for="loc-new-kind">{{ t('admin.loc.kind') }}</label>
              <select id="loc-new-kind" v-model="createForm.kind" class="form-control form-select">
                <option v-for="kind in KINDS" :key="kind" :value="kind">{{ t(`admin.loc.kinds.${kind}`) }}</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="loc-new-locative">{{ t('admin.loc.locative') }}</label>
              <input id="loc-new-locative" v-model="createForm.nameLocative" type="text" class="form-control" maxlength="100" />
            </div>
          </div>
          <p class="admin-card-note">{{ t('admin.loc.locativeHint') }}</p>
          <p v-if="createError" class="form-error">{{ createError }}</p>
          <div class="loc-row-actions">
            <button type="submit" class="btn btn-primary-flat btn-sm" :disabled="saving || !createForm.name.trim() || !createForm.regionId">
              {{ t('admin.loc.createAndOpen') }}
            </button>
            <button type="button" class="btn btn-tertiary btn-sm" @click="createOpen = false">{{ t('common.cancel') }}</button>
          </div>
        </div>
      </form>
    </div>

    <!-- Novi okrug / preimenovanje -->
    <div v-if="regionForm" class="admin-modal-backdrop" @click.self="regionForm = null">
      <form class="admin-modal admin-card loc-modal" @submit.prevent="saveRegion">
        <div class="admin-card-body loc-form">
          <p class="admin-card-title">{{ regionForm.id ? t('admin.loc.renameRegion') : t('admin.loc.newRegion') }}</p>
          <div class="form-group">
            <label class="form-label" for="loc-region-name">{{ t('admin.loc.name') }}</label>
            <input id="loc-region-name" v-model="regionForm.name" type="text" class="form-control" maxlength="100" required />
          </div>
          <div v-if="regionForm.id" class="form-group">
            <label class="form-label" for="loc-region-slug">{{ t('admin.cat.slug') }}</label>
            <input id="loc-region-slug" v-model="regionForm.slug" type="text" class="form-control" maxlength="100" />
          </div>
          <p v-if="regionError" class="form-error">{{ regionError }}</p>
          <div class="loc-row-actions">
            <button type="submit" class="btn btn-primary-flat btn-sm" :disabled="saving || !regionForm.name.trim()">{{ t('common.save') }}</button>
            <button type="button" class="btn btn-tertiary btn-sm" @click="regionForm = null">{{ t('common.cancel') }}</button>
          </div>
        </div>
      </form>
    </div>

    <!-- In use: never deleted blind (T129's rule), hidden instead. -->
    <div v-if="inUse" class="admin-modal-backdrop" @click.self="inUse = null">
      <div class="admin-modal admin-card" role="dialog" aria-modal="true" :aria-label="inUse.title">
        <div class="admin-card-body loc-form">
          <p class="admin-card-title">{{ inUse.title }}</p>
          <p class="loc-description">{{ inUse.text }}</p>
          <div class="loc-row-actions">
            <button v-if="inUse.hide" class="btn btn-primary-flat btn-sm" @click="hideInstead">{{ t('admin.loc.hideInstead') }}</button>
            <button class="btn btn-tertiary btn-sm" @click="inUse = null">{{ t('common.close') }}</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
// T119: Administracija > Lokacije. The okrugs, the places (every settlement of
// Serbia) and, on each place's own screen, the parts of a city; the panel's
// rules from T129: a search, live listing counts, "Sakrij" where a delete
// would leave listings without a place, and every change in the history.
definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })
const { t } = useI18n()
const api = useApi()
const route = useRoute()

const TABS = ['cities', 'regions', 'history']
const KINDS = ['VILLAGE', 'TOWN', 'SEAT']
const tab = ref(TABS.includes(route.query.tab) ? route.query.tab : 'cities')
watch(tab, (value) => navigateTo({ query: { ...route.query, tab: value } }, { replace: true }))

const notice = ref('')
const saving = ref(false)

// -- Okruzi ------------------------------------------------------------------

const { data: regionRows, refresh: refreshRegions } = await useAsyncData('admin-location-regions', () =>
  api.get('/admin/locations/regions'),
)
const regions = computed(() => regionRows.value || [])

// -- Mesta ---------------------------------------------------------------------

const filters = reactive({
  q: typeof route.query.q === 'string' ? route.query.q : '',
  regionId: typeof route.query.okrug === 'string' ? route.query.okrug : '',
  visibility: 'all',
  withListings: false,
  page: 1,
})
const PAGE_SIZE = 50
const cityPage = ref({ items: [], total: 0, page: 1, pageSize: PAGE_SIZE })
const citiesLoading = ref(false)
const citiesError = ref('')
const pageCount = computed(() => Math.max(1, Math.ceil(cityPage.value.total / cityPage.value.pageSize)))

let loadId = 0
async function loadCities() {
  const id = ++loadId
  citiesLoading.value = true
  citiesError.value = ''
  try {
    const page = await api.get('/admin/locations/cities', {
      query: {
        q: filters.q.trim() || undefined,
        regionId: filters.regionId || undefined,
        visibility: filters.visibility,
        withListings: filters.withListings ? '1' : undefined,
        page: filters.page,
        pageSize: PAGE_SIZE,
      },
    })
    if (id === loadId) cityPage.value = page
  } catch (e) {
    if (id === loadId) citiesError.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    if (id === loadId) citiesLoading.value = false
  }
}

let searchTimer = null
watch(
  () => [filters.q, filters.regionId, filters.visibility, filters.withListings],
  () => {
    filters.page = 1
    clearTimeout(searchTimer)
    searchTimer = setTimeout(loadCities, 250)
  },
)
watch(() => filters.page, loadCities)
onMounted(loadCities)

function showRegionPlaces(region) {
  filters.regionId = region.id
  tab.value = 'cities'
}

async function setCityHidden(city, hidden) {
  try {
    await api.patch(`/admin/locations/cities/${city.id}`, { hidden })
    city.hidden = hidden
    notice.value = t(hidden ? 'admin.loc.hiddenNotice' : 'admin.loc.shownNotice', { name: city.name })
  } catch (e) {
    alert(extractErrorMessage(e, t('auth.genericError')))
  }
}

// -- Novo mesto ---------------------------------------------------------------

const createOpen = ref(false)
const createError = ref('')
const createForm = reactive({ name: '', regionId: '', municipality: '', kind: 'VILLAGE', nameLocative: '' })

function openCreateCity() {
  Object.assign(createForm, { name: '', regionId: filters.regionId || '', municipality: '', kind: 'VILLAGE', nameLocative: '' })
  createError.value = ''
  createOpen.value = true
}

async function createCity() {
  saving.value = true
  createError.value = ''
  try {
    const city = await api.post('/admin/locations/cities', {
      name: createForm.name.trim(),
      regionId: createForm.regionId,
      municipality: createForm.municipality.trim() || undefined,
      kind: createForm.kind,
      nameLocative: createForm.nameLocative.trim() || undefined,
    })
    createOpen.value = false
    await navigateTo(`/admin/lokacije/${city.id}`)
  } catch (e) {
    createError.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    saving.value = false
  }
}

// -- Okrug: novi, preimenovanje, brisanje ----------------------------------------

const regionForm = ref(null)
const regionError = ref('')

function openRegionForm(region) {
  regionForm.value = region ? { id: region.id, name: region.name, slug: region.slug } : { id: null, name: '', slug: '' }
  regionError.value = ''
}

async function saveRegion() {
  const form = regionForm.value
  saving.value = true
  regionError.value = ''
  try {
    if (form.id) await api.patch(`/admin/locations/regions/${form.id}`, { name: form.name.trim(), slug: form.slug.trim() || undefined })
    else await api.post('/admin/locations/regions', { name: form.name.trim() })
    regionForm.value = null
    await refreshRegions()
  } catch (e) {
    regionError.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    saving.value = false
  }
}

async function deleteRegion(region) {
  if (region.cityCount) {
    inUse.value = { title: t('admin.loc.regionInUseTitle'), text: t('admin.loc.regionInUse', { name: region.name, count: region.cityCount }) }
    return
  }
  if (!confirm(t('admin.loc.deleteRegionConfirm', { name: region.name }))) return
  try {
    await api.delete(`/admin/locations/regions/${region.id}`)
    await refreshRegions()
  } catch (e) {
    alert(extractErrorMessage(e, t('auth.genericError')))
  }
}

// -- Brisanje mesta -----------------------------------------------------------------

const inUse = ref(null)

async function deleteCity(city) {
  if (city.listingCount > 0) {
    inUse.value = cityInUse(city, city.listingCount)
    return
  }
  if (!confirm(t('admin.loc.deleteCityConfirm', { name: city.name }))) return
  try {
    await api.delete(`/admin/locations/cities/${city.id}`)
    await Promise.all([loadCities(), refreshRegions()])
  } catch (e) {
    if (e?.data?.code === 'CITY_IN_USE') inUse.value = cityInUse(city, e.data.listingCount || 0)
    else alert(extractErrorMessage(e, t('auth.genericError')))
  }
}

function cityInUse(city, count) {
  return {
    title: t('admin.loc.cityInUseTitle'),
    text: t('admin.loc.cityInUse', { name: city.name, count }),
    hide: city.hidden ? null : () => setCityHidden(city, true),
  }
}

async function hideInstead() {
  const run = inUse.value?.hide
  inUse.value = null
  if (run) await run()
}

// -- Istorija izmena ------------------------------------------------------------------

const { data: historyRows } = await useAsyncData(
  'admin-location-history',
  () => (tab.value === 'history' ? api.get('/admin/locations/history') : Promise.resolve([])),
  { watch: [tab] },
)
const history = computed(() => historyRows.value || [])

useSeoMeta({ title: t('admin.locations') })
</script>

<style lang="scss" scoped>
.loc-tabs {
  margin-bottom: 20px;
}

.loc-notice {
  margin: 0 0 16px;
  font-size: 14px;
  color: $color-text;
}

.loc-filters {
  align-items: center;
}

.loc-filter-select {
  width: auto;
  min-width: 170px;
}

.loc-link {
  color: inherit;
  text-decoration: none;
}

.loc-link:hover {
  color: $color-primary;
}

.loc-pager {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 16px;
}

.loc-total {
  margin-top: 12px;
  text-align: center;
}

@include respond-above(lg) {
  .loc-actions {
    flex-wrap: nowrap;
    gap: 14px;
  }
}

.loc-modal {
  max-width: 560px;
  max-height: calc(100vh - 32px);
  overflow-y: auto;
}

.loc-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.loc-form .form-group {
  margin-bottom: 0;
}

.loc-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

@include respond-above(md) {
  .loc-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.loc-description {
  font-size: 14px;
  line-height: 21px;
  color: $color-text;
  overflow-wrap: anywhere;
}

.loc-row-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}
</style>
