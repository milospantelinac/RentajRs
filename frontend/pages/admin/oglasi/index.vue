<template>
  <div>
    <DashboardPageHeader :title="t('admin.listings')" :subtitle="t('admin.subtitle.listings')" />

    <div class="listings-top">
      <NuxtLink to="/admin/oglasi/novi" class="btn btn-primary-flat listings-add">
        <FontAwesomeIcon icon="plus" aria-hidden="true" />
        {{ t('adminListings.add') }}
      </NuxtLink>
    </div>

    <!-- Back from publishing a listing an admin added. -->
    <div v-if="publishedNotice" class="admin-card listings-notice" role="status">
      <div class="admin-card-body listings-notice-body">
        <p class="listings-notice-text">{{ t('adminListings.publishedNotice') }}</p>
        <button type="button" class="admin-action" @click="dismissNotice">{{ t('common.close') }}</button>
      </div>
    </div>

    <div class="admin-filters">
      <input
        v-model="search"
        type="search"
        class="admin-field admin-field-search"
        :placeholder="t('adminListings.searchPlaceholder')"
        :aria-label="t('adminListings.searchPlaceholder')"
        @keyup.enter="applyFilters"
      />
      <select v-model="status" class="admin-field" :aria-label="t('admin.statusLabel')" @change="applyFilters">
        <option value="">{{ t('adminListings.allStatuses') }}</option>
        <option v-for="s in STATUSES" :key="s" :value="s">{{ t(STATUS_LABELS[s]) }}</option>
      </select>
      <select v-model="filter" class="admin-field" :aria-label="t('adminListings.filterLabel')" @change="applyFilters">
        <option value="">{{ t('adminListings.filterAll') }}</option>
        <option value="free">{{ t('adminListings.filterFree') }}</option>
        <option value="admin">{{ t('adminListings.filterAdmin') }}</option>
      </select>
      <button class="btn btn-tertiary btn-sm" @click="applyFilters">{{ t('common.search') }}</button>
    </div>

    <StateBlock v-if="failed" card error icon="listings" :title="t('admin.loadErrorTitle')" :text="loadError || t('admin.loadErrorText')">
      <button type="button" class="state-block-action" @click="load">{{ t('errorPage.tryAgain') }}</button>
    </StateBlock>

    <StateBlock
      v-else-if="!loading && !items.length"
      card
      icon="listings"
      :title="t(filtered ? 'adminListings.emptySearchTitle' : 'adminListings.emptyTitle')"
      :text="t(filtered ? 'adminListings.emptySearchText' : 'adminListings.emptyText')"
    >
      <button v-if="filtered" type="button" class="state-block-action" @click="clearFilters">{{ t('search.clearAllFilters') }}</button>
    </StateBlock>

    <template v-else>
      <div class="admin-card admin-card-table">
        <table class="admin-table admin-table-tight">
          <thead>
            <tr>
              <th>{{ t('adminListings.col.listing') }}</th>
              <th>{{ t('adminListings.col.owner') }}</th>
              <th>{{ t('admin.statusLabel') }}</th>
              <th>{{ t('adminListings.col.package') }}</th>
              <th>{{ t('adminListings.col.validUntil') }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <template v-if="loading">
              <tr v-for="index in SKELETON_ROWS" :key="`loading-${index}`" aria-hidden="true">
                <td><SkeletonBox width="82%" height="15px" /></td>
                <td><SkeletonBox width="70%" height="15px" /></td>
                <td><SkeletonBox width="86px" height="21px" radius="999px" /></td>
                <td><SkeletonBox width="72px" height="15px" /></td>
                <td><SkeletonBox width="88px" height="15px" /></td>
                <td><SkeletonBox width="120px" height="15px" /></td>
              </tr>
            </template>
            <template v-else>
              <tr v-for="row in rows" :key="row.id">
                <td :data-label="t('adminListings.col.listing')">
                  <div class="listing-cell">
                    <img v-if="row.cover" :src="row.cover" alt="" class="listing-thumb" />
                    <span v-else class="listing-thumb listing-thumb-empty" aria-hidden="true" />
                    <div class="admin-cell-pair">
                      <span class="admin-cell-name">{{ row.title }}</span>
                      <span class="admin-cell-sub">{{ row.meta }}</span>
                    </div>
                  </div>
                </td>
                <td :data-label="t('adminListings.col.owner')">
                  <div class="admin-cell-pair">
                    <span class="admin-cell-name">{{ row.owner.name }}</span>
                    <span class="admin-cell-sub">{{ row.owner.email }}</span>
                  </div>
                </td>
                <td :data-label="t('admin.statusLabel')">
                  <div class="admin-pills">
                    <span class="admin-pill" :class="row.statusClass">{{ row.statusText }}</span>
                    <span v-if="row.adminDraft" class="admin-pill admin-pill-info">{{ t('adminListings.adminDraft') }}</span>
                  </div>
                </td>
                <td :data-label="t('adminListings.col.package')">
                  <div v-if="row.package" class="admin-cell-pair">
                    <span class="admin-cell-name">{{ row.package.key }}</span>
                    <span class="admin-cell-sub" :class="{ 'is-free': row.package.free }">
                      {{ row.package.free ? t('adminListings.free') : t('adminListings.paid') }}
                    </span>
                  </div>
                  <span v-else class="admin-cell-sub">-</span>
                </td>
                <td :data-label="t('adminListings.col.validUntil')">
                  <div class="admin-cell-pair">
                    <span class="admin-cell-name" :class="{ 'is-ended': row.ended }">{{ row.validUntil }}</span>
                    <span v-if="row.continued" class="admin-cell-sub">{{ row.continued }}</span>
                    <span v-if="row.featured" class="admin-cell-sub">{{ row.featured }}</span>
                  </div>
                </td>
                <td class="admin-cell-actions">
                  <div class="admin-actions">
                    <NuxtLink v-if="row.adminDraft" :to="`/oglasi/${row.id}/uredi`" class="admin-action">{{ t('adminListings.continue') }}</NuxtLink>
                    <NuxtLink v-else-if="row.editable" :to="`/oglasi/${row.id}/uredi`" class="admin-action">{{ t('adminListings.edit') }}</NuxtLink>
                    <button v-if="row.package" type="button" class="admin-action" @click="periodListingId = row.id">
                      {{ t('adminListings.period') }}
                    </button>
                    <NuxtLink v-if="row.status === 'ACTIVE'" :to="`/oglasi/${row.slug}`" class="admin-action" target="_blank">
                      {{ t('adminListings.view') }}
                    </NuxtLink>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <div v-if="pageCount > 1" class="listings-pages">
        <button type="button" class="btn btn-tertiary btn-sm" :disabled="page <= 1 || loading" @click="goToPage(page - 1)">
          {{ t('adminListings.prevPage') }}
        </button>
        <span class="listings-page-of">{{ t('adminListings.pageOf', { page, total: pageCount }) }}</span>
        <button type="button" class="btn btn-tertiary btn-sm" :disabled="page >= pageCount || loading" @click="goToPage(page + 1)">
          {{ t('adminListings.nextPage') }}
        </button>
      </div>
    </template>

    <AdminPeriodDialog
      v-if="periodListingId"
      :listing-id="periodListingId"
      @close="periodListingId = ''"
      @changed="onPeriodChanged"
    />
  </div>
</template>

<script setup>
// Administracija > Oglasi (the user, 2026-10-22): every listing on the site,
// "Dodaj oglas" for an existing user without payment, and "Trajanje" to move
// the end of a free package or give a paid one extra time. No frame; the
// panel's own table, filters and dialogs.
definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })
const { t } = useI18n()
const api = useApi()
const route = useRoute()
const router = useRouter()

const SKELETON_ROWS = 6
const STATUSES = ['ACTIVE', 'PENDING_APPROVAL', 'DRAFT', 'EXPIRED', 'REJECTED', 'DELETED']
const STATUS_LABELS = {
  DRAFT: 'listing.statusDraft',
  PENDING_APPROVAL: 'listing.statusPendingApproval',
  REJECTED: 'listing.statusRejected',
  ACTIVE: 'listing.statusActive',
  EXPIRED: 'listing.statusExpired',
  DELETED: 'adminListings.statusDeleted',
}
const STATUS_CLASSES = {
  ACTIVE: 'admin-pill-success',
  PENDING_APPROVAL: 'admin-pill-warning',
  DRAFT: 'admin-pill-neutral',
  EXPIRED: 'admin-pill-critical',
  REJECTED: 'admin-pill-critical',
  DELETED: 'admin-pill-neutral',
}

const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
const status = ref(typeof route.query.status === 'string' ? route.query.status : '')
const filter = ref(typeof route.query.filter === 'string' ? route.query.filter : '')
const page = ref(Number(route.query.page) > 1 ? Number(route.query.page) : 1)
const items = ref([])
const total = ref(0)
const pageSize = ref(25)
const loading = ref(true)
const failed = ref(false)
const loadError = ref('')
const filtered = ref(false)
const periodListingId = ref('')
const publishedNotice = ref(typeof route.query.objavljen === 'string')

const pageCount = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

const rows = computed(() =>
  items.value.map((item) => {
    const pkg = item.package
    const now = Date.now()
    const end = pkg?.expiresAt ? new Date(pkg.expiresAt) : null
    const noEnd = pkg?.status === 'ACTIVE' && !end
    let validUntil = '-'
    if (noEnd) validUntil = t('adminListings.endsNeverShort')
    else if (end) validUntil = end.getTime() > now ? formatListingDate(end) : t('adminListings.endedOn', { date: formatListingDate(end) })
    return {
      ...item,
      title: item.title || t('myListings.untitled'),
      cover: item.coverPhotoUrl ? mediaVariant(item.coverPhotoUrl, 400) : '',
      meta: [item.categoryName, item.place, item.addedBy ? t('adminListings.addedBy', { name: item.addedBy }) : ''].filter(Boolean).join(' · '),
      statusText: t(STATUS_LABELS[item.status] || STATUS_LABELS.DRAFT),
      statusClass: STATUS_CLASSES[item.status] || 'admin-pill-neutral',
      validUntil,
      ended: !!end && end.getTime() <= now && !noEnd,
      continued: pkg?.continuedUntil ? t('adminListings.continuedUntil', { date: formatListingDate(pkg.continuedUntil) }) : '',
      featured: item.featuredUntil ? t('adminListings.featuredUntil', { date: formatListingDate(item.featuredUntil) }) : '',
    }
  }),
)

async function load() {
  loading.value = true
  failed.value = false
  loadError.value = ''
  filtered.value = !!(search.value.trim() || status.value || filter.value)
  try {
    const params = new URLSearchParams()
    if (search.value.trim()) params.set('search', search.value.trim())
    if (status.value) params.set('status', status.value)
    if (filter.value) params.set('filter', filter.value)
    if (page.value > 1) params.set('page', String(page.value))
    const query = params.toString() ? `?${params.toString()}` : ''
    const result = await api.get(`/admin/listings${query}`)
    items.value = result.items
    total.value = result.total
    pageSize.value = result.pageSize
  } catch (e) {
    items.value = []
    failed.value = true
    // A 403 means this admin lacks the permission for this page.
    loadError.value = (e?.response?.status ?? e?.status) === 403 ? t('adminListings.noPermission') : ''
  } finally {
    loading.value = false
  }
}

// The filters live in the address, so going back to the list keeps them.
function syncQuery() {
  const query = {}
  if (search.value.trim()) query.q = search.value.trim()
  if (status.value) query.status = status.value
  if (filter.value) query.filter = filter.value
  if (page.value > 1) query.page = String(page.value)
  router.replace({ query })
}

function applyFilters() {
  page.value = 1
  syncQuery()
  load()
}

function clearFilters() {
  search.value = ''
  status.value = ''
  filter.value = ''
  applyFilters()
}

function goToPage(next) {
  page.value = next
  syncQuery()
  load()
}

function dismissNotice() {
  publishedNotice.value = false
  syncQuery()
}

function onPeriodChanged() {
  periodListingId.value = ''
  load()
}

onMounted(load)

useSeoMeta({ title: () => t('admin.listings') })
</script>

<style lang="scss" scoped>
.listings-top {
  display: flex;
  justify-content: flex-end;
  margin: -8px 0 16px;
}

.listings-add {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.listings-notice {
  margin-bottom: 16px;
  border-color: $color-success;
}

.listings-notice-body {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.listings-notice-text {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: $color-text;
}

.listing-cell {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.listing-thumb {
  flex-shrink: 0;
  width: 56px;
  height: 40px;
  border-radius: 8px;
  object-fit: cover;
  background: $color-background;
}

.admin-cell-sub.is-free {
  font-weight: 500;
  color: $color-primary;
}

.admin-cell-name.is-ended {
  color: $color-error;
}

.listings-pages {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  margin-top: 16px;
}

.listings-page-of {
  font-size: 14px;
  color: $color-text-muted;
}

@include mobile-only {
  .listings-top {
    justify-content: stretch;
    margin-top: 0;
  }

  .listings-add {
    justify-content: center;
    width: 100%;
  }
}
</style>
