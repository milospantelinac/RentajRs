<template>
  <div>
    <BackLink fallback="/admin/lokacije" class="mb-4" />

    <StateBlock v-if="loadError" card error icon="locations" :title="t('admin.loc.notFound')" :text="loadError" />

    <template v-else-if="city">
      <DashboardPageHeader :title="city.name" :subtitle="`/${city.slug}`">
        <template #actions>
          <span class="admin-pill" :class="city.hidden ? 'admin-pill-warning' : 'admin-pill-success'">
            {{ city.hidden ? t('admin.loc.hidden') : t('admin.loc.visible') }}
          </span>
        </template>
      </DashboardPageHeader>
      <p class="admin-card-note loc-counts">
        {{ t('admin.loc.listingsLine', { total: city.listingCount, active: city.activeListingCount }) }}
      </p>

      <form class="admin-card loc-card" @submit.prevent="saveCity">
        <div class="admin-card-body loc-form">
          <div class="loc-grid">
            <div class="form-group">
              <label class="form-label" for="loc-name">{{ t('admin.loc.name') }}</label>
              <input id="loc-name" v-model="form.name" type="text" class="form-control" maxlength="100" required />
            </div>
            <div class="form-group">
              <label class="form-label" for="loc-slug">{{ t('admin.cat.slug') }}</label>
              <input id="loc-slug" v-model="form.slug" type="text" class="form-control" maxlength="120" required />
              <p class="admin-card-note loc-hint">{{ t('admin.loc.slugHint', { slug: form.slug || city.slug }) }}</p>
            </div>
            <div class="form-group">
              <label class="form-label" for="loc-region">{{ t('admin.loc.region') }}</label>
              <select id="loc-region" v-model="form.regionId" class="form-control form-select">
                <option v-for="r in regions" :key="r.id" :value="r.id">{{ r.name }}</option>
              </select>
              <p v-if="form.regionId !== city.regionId && city.listingCount" class="admin-card-note loc-hint">
                {{ t('admin.loc.moveHint', { count: city.listingCount }) }}
              </p>
            </div>
            <div class="form-group">
              <label class="form-label" for="loc-municipality">{{ t('admin.loc.municipality') }}</label>
              <input id="loc-municipality" v-model="form.municipality" type="text" class="form-control" maxlength="100" />
            </div>
            <div class="form-group">
              <label class="form-label" for="loc-kind">{{ t('admin.loc.kind') }}</label>
              <select id="loc-kind" v-model="form.kind" class="form-control form-select">
                <option v-for="kind in KINDS" :key="kind" :value="kind">{{ t(`admin.loc.kinds.${kind}`) }}</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="loc-locative">{{ t('admin.loc.locative') }}</label>
              <input id="loc-locative" v-model="form.nameLocative" type="text" class="form-control" maxlength="100" />
              <p class="admin-card-note loc-hint">{{ t('admin.loc.locativeHint') }}</p>
            </div>
          </div>
          <label class="admin-check-row">
            <input v-model="form.hidden" type="checkbox" class="admin-check" /> {{ t('admin.loc.hiddenCheck') }}
          </label>
          <p class="admin-card-note">{{ t('admin.loc.hiddenHint') }}</p>
          <p v-if="saveError" class="form-error">{{ saveError }}</p>
          <p v-else-if="savedNotice" class="loc-saved" role="status">{{ savedNotice }}</p>
          <div class="loc-row-actions">
            <button type="submit" class="btn btn-primary-flat btn-sm" :disabled="saving || !form.name.trim() || !form.slug.trim()">
              {{ t('common.save') }}
            </button>
            <button type="button" class="btn btn-danger btn-sm" @click="deleteCity">{{ t('admin.loc.deleteCity') }}</button>
          </div>
        </div>
      </form>

      <!-- Delovi grada: where a listing of this place is, for the guests before a booking (Dizajn 26). -->
      <div class="admin-card loc-card">
        <div class="admin-card-head">
          <p class="admin-card-title">{{ t('admin.loc.areas') }}</p>
        </div>
        <div class="admin-card-body loc-form">
          <p class="admin-card-note">{{ t('admin.loc.areasHint') }}</p>
          <ul v-if="city.areas.length" class="loc-areas">
            <li v-for="area in city.areas" :key="area.id" class="loc-area">
              <template v-if="editingArea?.id === area.id">
                <input
                  v-model="editingArea.name"
                  type="text"
                  class="form-control loc-area-input"
                  maxlength="100"
                  :aria-label="t('admin.loc.areaName')"
                  @keydown.enter.prevent="saveArea(area)"
                />
                <button class="btn btn-primary-flat btn-sm" :disabled="!editingArea.name.trim()" @click="saveArea(area)">{{ t('common.save') }}</button>
                <button class="btn btn-tertiary btn-sm" @click="editingArea = null">{{ t('common.cancel') }}</button>
              </template>
              <template v-else>
                <span class="loc-area-name">{{ area.name }}</span>
                <span class="admin-cell-sub">{{ t('admin.loc.areaListings', { count: area.listingCount }) }}</span>
                <span v-if="area.hidden" class="admin-pill admin-pill-warning">{{ t('admin.loc.hidden') }}</span>
                <div class="admin-actions loc-area-actions">
                  <button class="admin-action" @click="editingArea = { id: area.id, name: area.name }">{{ t('admin.loc.rename') }}</button>
                  <button class="admin-action" @click="setAreaHidden(area, !area.hidden)">
                    {{ area.hidden ? t('admin.loc.show') : t('admin.loc.hide') }}
                  </button>
                  <button class="admin-action admin-action-danger" @click="deleteArea(area)">{{ t('common.delete') }}</button>
                </div>
              </template>
            </li>
          </ul>
          <p v-else class="admin-card-note">{{ t('admin.loc.noAreas') }}</p>
          <form class="loc-area-new" @submit.prevent="addArea">
            <input
              v-model="newArea"
              type="text"
              class="form-control loc-area-input"
              maxlength="100"
              :placeholder="t('admin.loc.areaName')"
              :aria-label="t('admin.loc.areaName')"
            />
            <button type="submit" class="btn btn-primary-flat btn-sm" :disabled="!newArea.trim()">{{ t('admin.loc.addArea') }}</button>
          </form>
          <p v-if="!city.areas.length && city.listingCount" class="admin-card-note">{{ t('admin.loc.firstAreaHint', { count: city.listingCount }) }}</p>
          <p v-if="areaError" class="form-error">{{ areaError }}</p>
        </div>
      </div>

      <div class="admin-card admin-card-table loc-card">
        <div class="admin-card-head">
          <p class="admin-card-title">{{ t('admin.loc.tabs.history') }}</p>
        </div>
        <StateBlock v-if="!history.length" icon="locations" :title="t('admin.loc.historyEmptyCity')" text="" />
        <LocationHistoryTable v-else :rows="history" :regions="regions" />
      </div>
    </template>

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
// T119: one place of Administracija > Lokacije: its name, URL, okrug,
// municipality, kind and locative, hiding it, its parts (delovi grada) and
// its history. A new okrug moves the place's listings along; a new URL
// leaves the old city pages redirecting to the new ones.
definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })
const { t } = useI18n()
const api = useApi()
const route = useRoute()

const KINDS = ['VILLAGE', 'TOWN', 'SEAT']

const { data: city, error, refresh } = await useAsyncData(`admin-location-${route.params.id}`, () =>
  api.get(`/admin/locations/cities/${route.params.id}`),
)
const { data: regionRows } = await useAsyncData('admin-location-regions', () => api.get('/admin/locations/regions'))
const regions = computed(() => regionRows.value || [])
const loadError = computed(() => (error.value ? extractErrorMessage(error.value, t('auth.genericError')) : ''))

const { data: historyRows, refresh: refreshHistory } = await useAsyncData(`admin-location-history-${route.params.id}`, () =>
  api.get(`/admin/locations/cities/${route.params.id}/history`),
)
const history = computed(() => historyRows.value || [])

// -- The place ----------------------------------------------------------------

const form = reactive({ name: '', slug: '', regionId: '', municipality: '', kind: 'VILLAGE', nameLocative: '', hidden: false })
function fillForm() {
  if (!city.value) return
  Object.assign(form, {
    name: city.value.name,
    slug: city.value.slug,
    regionId: city.value.regionId,
    municipality: city.value.municipality || '',
    kind: city.value.kind,
    nameLocative: city.value.nameLocative || '',
    hidden: city.value.hidden,
  })
}
watch(city, fillForm, { immediate: true })

const saving = ref(false)
const saveError = ref('')
const savedNotice = ref('')

async function saveCity() {
  const slug = form.slug.trim()
  if (slug !== city.value.slug && !confirm(t('admin.loc.slugChangeConfirm', { from: city.value.slug, to: slug }))) return
  saving.value = true
  saveError.value = ''
  savedNotice.value = ''
  try {
    const result = await api.patch(`/admin/locations/cities/${city.value.id}`, {
      name: form.name.trim(),
      slug,
      regionId: form.regionId,
      municipality: form.municipality.trim(),
      kind: form.kind,
      nameLocative: form.nameLocative.trim(),
      hidden: form.hidden,
    })
    savedNotice.value = result.listingsMoved ? t('admin.loc.savedMoved', { count: result.listingsMoved }) : t('admin.loc.saved')
    await Promise.all([refresh(), refreshHistory()])
  } catch (e) {
    saveError.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    saving.value = false
  }
}

const inUse = ref(null)

async function deleteCity() {
  if (city.value.listingCount) {
    inUse.value = {
      title: t('admin.loc.cityInUseTitle'),
      text: t('admin.loc.cityInUse', { name: city.value.name, count: city.value.listingCount }),
      hide: city.value.hidden ? null : () => patchCity({ hidden: true }),
    }
    return
  }
  if (!confirm(t('admin.loc.deleteCityConfirm', { name: city.value.name }))) return
  try {
    await api.delete(`/admin/locations/cities/${city.value.id}`)
    await navigateTo('/admin/lokacije')
  } catch (e) {
    alert(extractErrorMessage(e, t('auth.genericError')))
  }
}

async function patchCity(body) {
  try {
    await api.patch(`/admin/locations/cities/${city.value.id}`, body)
    await Promise.all([refresh(), refreshHistory()])
  } catch (e) {
    alert(extractErrorMessage(e, t('auth.genericError')))
  }
}

async function hideInstead() {
  const run = inUse.value?.hide
  inUse.value = null
  if (run) await run()
}

// -- Delovi grada ---------------------------------------------------------------

const newArea = ref('')
const editingArea = ref(null)
const areaError = ref('')

async function afterAreaChange() {
  areaError.value = ''
  await Promise.all([refresh(), refreshHistory()])
}

async function addArea() {
  try {
    await api.post(`/admin/locations/cities/${city.value.id}/areas`, { name: newArea.value.trim() })
    newArea.value = ''
    await afterAreaChange()
  } catch (e) {
    areaError.value = extractErrorMessage(e, t('auth.genericError'))
  }
}

async function saveArea(area) {
  try {
    await api.patch(`/admin/locations/areas/${area.id}`, { name: editingArea.value.name.trim() })
    editingArea.value = null
    await afterAreaChange()
  } catch (e) {
    areaError.value = extractErrorMessage(e, t('auth.genericError'))
  }
}

async function setAreaHidden(area, hidden) {
  try {
    await api.patch(`/admin/locations/areas/${area.id}`, { hidden })
    await afterAreaChange()
  } catch (e) {
    areaError.value = extractErrorMessage(e, t('auth.genericError'))
  }
}

async function deleteArea(area) {
  const offerHide = (count) => ({
    title: t('admin.loc.areaInUseTitle'),
    text: t('admin.loc.areaInUse', { name: area.name, count }),
    hide: area.hidden ? null : () => setAreaHidden(area, true),
  })
  if (area.listingCount) {
    inUse.value = offerHide(area.listingCount)
    return
  }
  if (!confirm(t('admin.loc.deleteAreaConfirm', { name: area.name }))) return
  try {
    await api.delete(`/admin/locations/areas/${area.id}`)
    await afterAreaChange()
  } catch (e) {
    if (e?.data?.code === 'AREA_IN_USE') inUse.value = offerHide(e.data.listingCount || 0)
    else areaError.value = extractErrorMessage(e, t('auth.genericError'))
  }
}

useSeoMeta({ title: () => (city.value ? `${city.value.name} - ${t('admin.locations')}` : t('admin.locations')) })
</script>

<style lang="scss" scoped>
.loc-counts {
  margin: -8px 0 20px;
}

.loc-card + .loc-card {
  margin-top: 20px;
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

.loc-hint {
  margin-top: 6px;
}

.loc-saved {
  margin: 0;
  font-size: 14px;
  color: $color-success;
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
}

.loc-areas {
  margin: 0;
  padding: 0;
  list-style: none;
}

.loc-area {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  padding: 12px 0;
  border-bottom: 1px solid $color-border;
}

.loc-area:first-child {
  padding-top: 0;
}

.loc-area-name {
  font-size: 14px;
  font-weight: 500;
  color: $color-text;
}

.loc-area-actions {
  margin-left: auto;
  gap: 14px;
}

.loc-area-new {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.loc-area-input {
  flex: 1 1 220px;
  max-width: 360px;
}
</style>
