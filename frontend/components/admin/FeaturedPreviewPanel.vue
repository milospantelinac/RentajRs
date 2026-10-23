<template>
  <div>
    <form class="admin-card feat-preview-form" @submit.prevent="load">
      <div class="admin-card-body feat-form">
        <div>
          <p class="admin-card-title">{{ t('admin.featured.preview.title') }}</p>
          <p class="admin-card-note">{{ t('admin.featured.preview.note') }}</p>
        </div>
        <div class="feat-grid">
          <div class="form-group">
            <label class="form-label" for="feat-preview-category">{{ t('admin.featured.preview.category') }}</label>
            <select id="feat-preview-category" v-model="categorySlug" class="form-control form-select">
              <option value="">{{ t('admin.featured.preview.allCategories') }}</option>
              <option v-for="category in categories" :key="category.id" :value="category.slug">{{ category.label }}</option>
            </select>
          </div>
          <div class="form-group">
            <span class="form-label">{{ t('admin.featured.preview.city') }}</span>
            <!-- Shaped like the wizard's place field (uredi.vue .location-place). -->
            <div class="feat-place">
              <LocationAutocomplete
                v-model="place"
                class="feat-place-field"
                :with-areas="false"
                :placeholder="t('admin.featured.preview.anyCity')"
                :aria-label="t('admin.featured.preview.city')"
              />
            </div>
          </div>
        </div>
        <div class="feat-actions">
          <button type="submit" class="btn btn-primary-flat btn-sm" :disabled="loading">{{ t('admin.featured.preview.show') }}</button>
        </div>
      </div>
    </form>

    <p v-if="error" class="form-error feat-message" role="alert">{{ error }}</p>

    <template v-if="result">
      <p v-if="!result.enabled" class="admin-card-note feat-warning feat-message">{{ t('admin.featured.preview.disabled') }}</p>
      <StateBlock
        v-if="!result.candidates.length"
        card
        icon="featured"
        :title="t('admin.featured.preview.emptyTitle')"
        :text="t('admin.featured.preview.emptyText')"
      />
      <div v-else class="admin-card admin-card-table">
        <div class="admin-card-head">
          <div>
            <p class="admin-card-title">
              {{ t('admin.featured.preview.topTitle', { count: result.top.length, max: result.searchTopCount }) }}
            </p>
            <p class="admin-card-note">{{ t('admin.featured.preview.orderNote') }}</p>
          </div>
        </div>
        <table class="admin-table">
          <thead>
            <tr>
              <th>{{ t('admin.featured.col.listing') }}</th>
              <th>{{ t('admin.featured.preview.shownToday') }}</th>
              <th>{{ t('admin.featured.col.status') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in result.candidates" :key="row.listingId">
              <td :data-label="t('admin.featured.col.listing')">
                <div class="admin-cell-pair">
                  <span class="admin-cell-name">{{ row.title }}</span>
                  <span class="admin-cell-sub">{{ row.owner }} · {{ t('admin.featured.preview.until', { date: formatFeaturedDay(row.expiresAt) }) }}</span>
                </div>
              </td>
              <td :data-label="t('admin.featured.preview.shownToday')">{{ row.shownToday }}</td>
              <td :data-label="t('admin.featured.col.status')">
                <span v-if="row.inTop" class="admin-pill admin-pill-success">{{ t('admin.featured.preview.inTop') }}</span>
                <span v-else-if="!row.reason" class="admin-pill admin-pill-info">{{ t('admin.featured.preview.nextTurn') }}</span>
                <span v-else class="admin-pill admin-pill-neutral">{{ t(`admin.featured.hidden.${row.reason}`) }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<script setup>
// Probni prikaz: for a category page (and a city), every featured listing
// that could top it, today's turns, and which ones would be on top right now.
// Nothing is counted, so looking changes nothing.
import { placeCity } from '~/utils/places'
import { formatFeaturedDay } from '~/utils/featuredAdmin'

const { t } = useI18n()
const api = useApi()

const categories = ref([])
const categorySlug = ref('')
const place = ref(null)
const result = ref(null)
const loading = ref(false)
const error = ref('')

onMounted(async () => {
  try {
    const tree = await api.get('/categories')
    categories.value = tree.flatMap((category) => [
      { id: category.id, slug: category.slug, label: category.name },
      ...(category.children || []).map((child) => ({ id: child.id, slug: child.slug, label: `${category.name} / ${child.name}` })),
    ])
  } catch {
    categories.value = []
  }
  await load()
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    const city = placeCity(place.value)
    result.value = await api.get('/admin/featured/preview', {
      query: { ...(categorySlug.value ? { categorySlug: categorySlug.value } : {}), ...(city ? { cityId: city.id } : {}) },
    })
  } catch (e) {
    error.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
.feat-preview-form {
  margin-bottom: 20px;
}

.feat-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.feat-form .form-group {
  margin-bottom: 0;
}

.feat-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

@include respond-above(md) {
  .feat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.feat-actions {
  display: flex;
  gap: 10px;
}

.feat-place {
  display: flex;
  align-items: center;
  height: 52px;
  padding: 0 12px 0 18px;
  border-radius: $radius-input;
  background-color: $color-background;
  color: $color-text;
  font-size: 15px;
  cursor: text;
  transition:
    background-color 0.15s ease,
    box-shadow 0.15s ease;
}

.feat-place:focus-within {
  background-color: $color-surface;
  box-shadow: inset 0 0 0 1.5px $color-primary;
}

.feat-place-field {
  flex: 1;
  min-width: 0;
  height: 100%;
}

.feat-message {
  margin-bottom: 16px;
}

.feat-warning {
  color: $color-warning;
}
</style>
