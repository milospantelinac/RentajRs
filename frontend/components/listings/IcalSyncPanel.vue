<template>
  <div class="ical-panel">
    <div class="form-group mb-3">
      <label class="form-label">{{ t('listing.icalExportLabel') }}</label>
      <p class="text-muted mb-2">{{ t('listing.icalExportHint') }}</p>
      <div class="ical-export-row">
        <input :value="exportUrl" type="text" class="form-control" readonly @focus="$event.target.select()" />
        <button type="button" class="btn btn-tertiary btn-sm" @click="copyExportUrl">
          {{ copied ? t('common.copied') : t('common.copy') }}
        </button>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">{{ t('listing.icalImportLabel') }}</label>
      <p class="text-muted mb-2">{{ t('listing.icalImportHint') }}</p>

      <div v-if="sources.length" class="ical-source-list mb-3">
        <div v-for="s in sources" :key="s.id" class="ical-source-row">
          <span class="text-body">{{ s.name }}</span>
          <span v-if="s.lastError" class="text-error ical-source-error">{{ t('listing.icalSyncError') }}</span>
          <button type="button" class="btn btn-tertiary btn-sm" :disabled="removingId === s.id" @click="removeSource(s.id)">
            {{ t('listing.deleteListing') }}
          </button>
        </div>
      </div>

      <div class="ical-add-form">
        <input v-model="newName" type="text" class="form-control" :placeholder="t('listing.icalSourceName')" />
        <input v-model="newUrl" type="text" class="form-control" placeholder="https://...ics" />
        <button type="button" class="btn btn-primary-flat btn-sm" :disabled="adding || !newName || !newUrl" @click="addSource">
          {{ t('common.add') }}
        </button>
      </div>
      <p v-if="error" class="form-error mt-2">{{ error }}</p>
    </div>
  </div>
</template>

<script setup>
// RNT-092 — the backend has always fully supported iCal export/import
// (R64/R65), but nothing in the UI ever surfaced it, so an owner had no way
// to actually reach the feature the pricing page promises. Gated the same
// way the backend itself gates it: PER_STAY + a package with hasIcal.
const props = defineProps({
  listingId: { type: String, required: true },
  icalExportToken: { type: String, default: null },
})

const { t } = useI18n()
const api = useApi()
const config = useRuntimeConfig()

const exportUrl = computed(() => `${config.public.apiBase}/ical/${props.icalExportToken}.ics`)
const copied = ref(false)
async function copyExportUrl() {
  await navigator.clipboard.writeText(exportUrl.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}

const sources = ref([])
const newName = ref('')
const newUrl = ref('')
const adding = ref(false)
const removingId = ref(null)
const error = ref('')

async function loadSources() {
  sources.value = await api.get(`/listings/${props.listingId}/availability/ical-sources`)
}

async function addSource() {
  adding.value = true
  error.value = ''
  try {
    await api.post(`/listings/${props.listingId}/availability/ical-sources`, { name: newName.value, url: newUrl.value })
    newName.value = ''
    newUrl.value = ''
    await loadSources()
  } catch (e) {
    error.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    adding.value = false
  }
}

async function removeSource(id) {
  removingId.value = id
  try {
    await api.delete(`/listings/${props.listingId}/availability/ical-sources/${id}`)
    await loadSources()
  } finally {
    removingId.value = null
  }
}

onMounted(loadSources)
</script>

<style lang="scss" scoped>
.ical-export-row {
  display: flex;
  gap: 8px;
}

.ical-source-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ical-source-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border: 1px solid $color-border;
  border-radius: $radius-input;
}

.ical-source-error {
  color: $color-error;
  font-size: $font-size-muted;
}

.ical-add-form {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.ical-add-form .form-control {
  flex: 1;
  min-width: 160px;
}
</style>
