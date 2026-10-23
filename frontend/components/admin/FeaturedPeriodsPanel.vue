<template>
  <div>
    <!-- How full each category is: its places, taken and free, and its queue. -->
    <div class="admin-card feat-capacity">
      <div class="admin-card-head">
        <div>
          <p class="admin-card-title">{{ t('admin.featured.capacityTitle') }}</p>
          <p class="admin-card-note">{{ t('admin.featured.capacityNote') }}</p>
        </div>
      </div>
      <div class="admin-card-body">
        <p v-if="!capacity.length" class="admin-card-note">{{ t('admin.featured.capacityEmpty') }}</p>
        <ul v-else class="feat-capacity-list">
          <li v-for="row in capacity" :key="row.categoryId" class="feat-capacity-row">
            <span class="feat-capacity-name">{{ row.name || '-' }}</span>
            <span class="feat-capacity-bar" aria-hidden="true">
              <span
                class="feat-capacity-fill"
                :class="{ 'is-full': row.taken >= row.limit }"
                :style="{ width: `${Math.min(100, (row.taken / row.limit) * 100)}%` }"
              />
            </span>
            <span class="feat-capacity-count">
              {{ t('admin.featured.capacityCount', { taken: row.taken, limit: row.limit }) }}
              <template v-if="row.waiting"> · {{ t('admin.featured.capacityWaiting', { count: row.waiting }) }}</template>
            </span>
          </li>
        </ul>
      </div>
    </div>

    <div class="feat-toolbar">
      <div class="admin-switch admin-switch-sm" role="tablist">
        <button
          v-for="key in STATES"
          :key="key"
          type="button"
          role="tab"
          class="admin-switch-btn"
          :class="{ 'is-active': state === key }"
          :aria-selected="state === key"
          @click="state = key"
        >{{ t(`admin.featured.periodState.${key}`) }}</button>
      </div>
      <button type="button" class="btn btn-primary-flat btn-sm" @click="openGrant">{{ t('admin.featured.grantButton') }}</button>
    </div>

    <p v-if="message" class="form-success feat-message" role="status">{{ message }}</p>
    <p v-if="actionError" class="form-error feat-message" role="alert">{{ actionError }}</p>

    <StateBlock v-if="failed" card error icon="featured" :title="t('admin.loadErrorTitle')" :text="t('admin.loadErrorText')">
      <button type="button" class="state-block-action" @click="load">{{ t('errorPage.tryAgain') }}</button>
    </StateBlock>

    <StateBlock
      v-else-if="!loading && !periods.length"
      card
      icon="featured"
      :title="t(`admin.featured.empty.${state}.title`)"
      :text="t(`admin.featured.empty.${state}.text`)"
    />

    <!-- A tablet scrolls the table sideways rather than squeezing its words. -->
    <div v-else class="admin-card admin-card-table">
      <div class="feat-table-scroll">
      <table class="admin-table admin-table-tight feat-table">
        <thead>
          <tr>
            <th>{{ t('admin.featured.col.listing') }}</th>
            <th>{{ t('admin.featured.col.source') }}</th>
            <th>{{ t('admin.featured.col.period') }}</th>
            <th>{{ t('admin.featured.col.shown') }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="period in periods" :key="period.id">
            <td :data-label="t('admin.featured.col.listing')">
              <div class="admin-cell-pair">
                <NuxtLink :to="`/oglasi/${period.listing.slug}`" target="_blank" class="admin-cell-name feat-link">
                  {{ period.listing.title }}
                </NuxtLink>
                <span class="admin-cell-sub">{{ period.listing.categoryName || '-' }}</span>
                <span class="admin-cell-sub">{{ personLabel(period.owner) }}</span>
                <span v-if="period.live && period.hiddenReason" class="admin-cell-sub feat-warning">
                  {{ t(`admin.featured.hidden.${period.hiddenReason}`) }}
                </span>
                <span v-if="period.note" class="admin-cell-sub">{{ t('admin.featured.noteLabel') }}: {{ period.note }}</span>
              </div>
            </td>
            <td :data-label="t('admin.featured.col.source')">
              <span class="admin-pill" :class="featuredSourcePill(period.source)">{{ t(`admin.featured.source.${period.source}`) }}</span>
            </td>
            <td :data-label="t('admin.featured.col.period')">
              <div class="admin-cell-pair">
                <span class="feat-nowrap">{{ formatFeaturedDay(period.startsAt) }} - {{ formatFeaturedDay(period.expiresAt) }}</span>
                <span v-if="period.live" class="admin-cell-sub">{{ featuredDaysLeft(t, period.expiresAt) }}</span>
                <span v-if="period.assignedBy" class="admin-cell-sub">{{ t('admin.featured.assignedBy', { name: period.assignedBy }) }}</span>
              </div>
            </td>
            <td :data-label="t('admin.featured.col.shown')">
              <div class="admin-cell-pair">
                <span>{{ period.stats.searchImpressions + period.stats.homeImpressions }}</span>
                <span class="admin-cell-sub">
                  {{ t('admin.featured.shownSplit', { search: period.stats.searchImpressions, home: period.stats.homeImpressions }) }}
                </span>
                <span class="admin-cell-sub">{{ t('admin.featured.openedCount', { count: period.stats.clicks }) }}</span>
              </div>
            </td>
            <td class="admin-cell-actions">
              <div v-if="period.live" class="admin-actions">
                <button type="button" class="admin-action" @click="openChangeEnd(period)">{{ t('admin.featured.changeEnd') }}</button>
                <button type="button" class="admin-action admin-action-danger" @click="endNow(period)">{{ t('admin.featured.endNow') }}</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>

    <!-- "Istakni oglas": any live listing, now, for as long as the admin says. -->
    <div v-if="grant.open" class="admin-modal-backdrop" @click.self="grant.open = false">
      <form class="admin-modal admin-card" @submit.prevent="submitGrant">
        <div class="admin-card-body feat-form">
          <p class="admin-card-title">{{ t('admin.featured.grantTitle') }}</p>
          <div class="form-group">
            <label class="form-label" for="feat-grant-search">{{ t('admin.featured.grantListing') }}</label>
            <input
              id="feat-grant-search"
              v-model="grant.q"
              type="search"
              class="form-control"
              autocomplete="off"
              :placeholder="t('admin.featured.grantSearchPlaceholder')"
              @input="searchListings"
            />
            <ul v-if="grant.results.length" class="feat-pick-list">
              <li v-for="listing in grant.results" :key="listing.id">
                <button
                  type="button"
                  class="feat-pick"
                  :class="{ 'is-picked': grant.listing?.id === listing.id }"
                  :disabled="!!listing.featuredUntil"
                  @click="grant.listing = listing"
                >
                  <span class="feat-pick-title">{{ listing.title }}</span>
                  <span class="feat-pick-sub">
                    {{ [listing.categoryName, listing.owner].filter(Boolean).join(' · ') }}
                    <template v-if="listing.featuredUntil"> · {{ t('admin.featured.alreadyUntil', { date: formatFeaturedDay(listing.featuredUntil) }) }}</template>
                  </span>
                </button>
              </li>
            </ul>
            <p v-else-if="grant.q.trim().length >= 2 && !grant.searching" class="admin-card-note feat-hint">
              {{ t('admin.featured.grantNoResults') }}
            </p>
          </div>
          <div class="form-group">
            <label class="form-label" for="feat-grant-days">{{ t('admin.featured.daysLabel') }}</label>
            <div class="feat-days">
              <input id="feat-grant-days" v-model.number="grant.days" type="number" min="1" max="365" class="form-control feat-days-input" required />
              <button v-for="days in QUICK_DAYS" :key="days" type="button" class="admin-action" @click="grant.days = days">
                {{ t('admin.featured.daysQuick', { count: days }) }}
              </button>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="feat-grant-note">{{ t('admin.featured.noteLabel') }}</label>
            <textarea
              id="feat-grant-note"
              v-model="grant.note"
              class="form-control"
              rows="2"
              maxlength="500"
              :placeholder="t('admin.featured.notePlaceholder')"
            />
          </div>
          <p class="admin-card-note">{{ t('admin.featured.grantHint') }}</p>
          <p v-if="grant.error" class="form-error">{{ grant.error }}</p>
          <div class="feat-actions">
            <button type="submit" class="btn btn-primary-flat btn-sm" :disabled="!grant.listing || grant.saving">
              {{ t('admin.featured.grantSubmit') }}
            </button>
            <button type="button" class="btn btn-tertiary btn-sm" @click="grant.open = false">{{ t('common.cancel') }}</button>
          </div>
        </div>
      </form>
    </div>

    <!-- "Promeni kraj": later lengthens, earlier shortens. -->
    <div v-if="endForm.period" class="admin-modal-backdrop" @click.self="endForm.period = null">
      <form class="admin-modal admin-card" @submit.prevent="submitChangeEnd">
        <div class="admin-card-body feat-form">
          <p class="admin-card-title">{{ t('admin.featured.changeEndTitle') }}</p>
          <p class="admin-card-note">
            {{ endForm.period.listing.title }} · {{ t('admin.featured.currentEnd', { date: formatFeaturedDay(endForm.period.expiresAt) }) }}
          </p>
          <div class="form-group">
            <label class="form-label" for="feat-end-date">{{ t('admin.featured.newEnd') }}</label>
            <input id="feat-end-date" v-model="endForm.date" type="date" class="form-control" required />
            <div class="feat-days feat-days-under">
              <button v-for="days in QUICK_DAYS" :key="days" type="button" class="admin-action" @click="extendBy(days)">
                {{ t('admin.featured.extendBy', { count: days }) }}
              </button>
            </div>
            <p class="admin-card-note feat-hint">{{ t('admin.featured.newEndHint') }}</p>
          </div>
          <p v-if="endForm.error" class="form-error">{{ endForm.error }}</p>
          <div class="feat-actions">
            <button type="submit" class="btn btn-primary-flat btn-sm" :disabled="!endForm.date || endForm.saving">{{ t('common.save') }}</button>
            <button type="button" class="btn btn-tertiary btn-sm" @click="endForm.period = null">{{ t('common.cancel') }}</button>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
// Aktivni: who is featured now (and, on the second switch, who was in the
// last 90 days), with how often each was shown and opened; feature a listing
// directly, move a period's end, or end it now.
import {
  dateInputAtTimeOf,
  featuredDaysLeft,
  featuredSourcePill,
  formatFeaturedDay,
  personLabel,
  toDateInput,
} from '~/utils/featuredAdmin'

const { t } = useI18n()
const api = useApi()

const STATES = ['live', 'ended']
const QUICK_DAYS = [7, 15, 30]
const DAY_MS = 86_400_000

const state = ref('live')
const periods = ref([])
const capacity = ref([])
const loading = ref(true)
const failed = ref(false)
const message = ref('')
const actionError = ref('')

async function load() {
  loading.value = true
  failed.value = false
  try {
    const [rows, places] = await Promise.all([
      api.get('/admin/featured/periods', { query: { state: state.value } }),
      api.get('/admin/featured/capacity'),
    ])
    periods.value = rows
    capacity.value = places
  } catch {
    periods.value = []
    failed.value = true
  } finally {
    loading.value = false
  }
}

watch(state, load)
onMounted(load)

// -- Feature a listing ----------------------------------------------------------

const grant = reactive({ open: false, q: '', results: [], searching: false, listing: null, days: 30, note: '', error: '', saving: false })
let searchTimer = null

async function openGrant() {
  Object.assign(grant, { open: true, q: '', results: [], listing: null, note: '', error: '', saving: false })
  try {
    const settings = await api.get('/admin/featured/settings')
    grant.days = settings.rules.defaultDays
  } catch {
    grant.days = 30
  }
}

function searchListings() {
  clearTimeout(searchTimer)
  const q = grant.q.trim()
  if (q.length < 2) {
    grant.results = []
    return
  }
  grant.searching = true
  searchTimer = setTimeout(async () => {
    try {
      grant.results = await api.get('/admin/featured/listings', { query: { q } })
    } catch {
      grant.results = []
    } finally {
      grant.searching = false
    }
  }, 250)
}

async function submitGrant() {
  grant.saving = true
  grant.error = ''
  try {
    const outcome = await api.post('/admin/featured/grant', {
      listingId: grant.listing.id,
      days: grant.days,
      ...(grant.note.trim() ? { note: grant.note.trim() } : {}),
    })
    message.value =
      outcome.status === 'STARTED'
        ? t('admin.featured.grantStarted', { title: grant.listing.title, date: formatFeaturedDay(outcome.expiresAt) })
        : t('admin.featured.grantWaiting', { title: grant.listing.title })
    actionError.value = ''
    grant.open = false
    await load()
  } catch (e) {
    grant.error = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    grant.saving = false
  }
}

// -- Move or end a period ------------------------------------------------------------

const endForm = reactive({ period: null, date: '', error: '', saving: false })

function openChangeEnd(period) {
  Object.assign(endForm, { period, date: toDateInput(period.expiresAt), error: '', saving: false })
}

function extendBy(days) {
  endForm.date = toDateInput(new Date(endForm.period.expiresAt).getTime() + days * DAY_MS)
}

async function submitChangeEnd() {
  endForm.saving = true
  endForm.error = ''
  try {
    const expiresAt = dateInputAtTimeOf(endForm.date, endForm.period.expiresAt)
    await api.patch(`/admin/featured/periods/${endForm.period.id}`, { expiresAt: expiresAt.toISOString() })
    message.value = t('admin.featured.endChanged', { title: endForm.period.listing.title })
    actionError.value = ''
    endForm.period = null
    await load()
  } catch (e) {
    endForm.error = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    endForm.saving = false
  }
}

async function endNow(period) {
  if (!confirm(t('admin.featured.endNowConfirm', { title: period.listing.title }))) return
  try {
    await api.post(`/admin/featured/periods/${period.id}/end`, {})
    message.value = t('admin.featured.ended', { title: period.listing.title })
    actionError.value = ''
    await load()
  } catch (e) {
    actionError.value = extractErrorMessage(e, t('auth.genericError'))
  }
}

onBeforeUnmount(() => clearTimeout(searchTimer))
</script>

<style lang="scss" scoped>
.feat-capacity {
  margin-bottom: 20px;
}

.feat-capacity-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.feat-capacity-row {
  display: grid;
  grid-template-columns: minmax(0, 180px) minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  font-size: 14px;
}

.feat-capacity-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}

.feat-capacity-bar {
  height: 8px;
  border-radius: $radius-pill;
  background: $color-background;
  overflow: hidden;
}

.feat-capacity-fill {
  display: block;
  height: 100%;
  border-radius: $radius-pill;
  background: $color-primary;
}

.feat-capacity-fill.is-full {
  background: $color-warning;
}

.feat-capacity-count {
  color: $color-text-muted;
  white-space: nowrap;
}

.feat-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.feat-message {
  margin-bottom: 16px;
}

.feat-link:hover {
  color: $color-primary;
}

.feat-nowrap {
  white-space: nowrap;
}

@include respond-above(md) {
  .feat-table-scroll {
    overflow-x: auto;
  }

  .feat-table {
    min-width: 760px;
  }

  .feat-table td:first-child {
    min-width: 220px;
  }
}

.feat-warning {
  color: $color-warning;
}

.feat-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.feat-form .form-group {
  margin-bottom: 0;
}

.feat-hint {
  margin-top: 6px;
}

.feat-pick-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 240px;
  margin: 8px 0 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

.feat-pick {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid $color-border;
  border-radius: $radius-input;
  background: $color-surface;
  text-align: left;
  cursor: pointer;
}

.feat-pick:hover:not(:disabled) {
  border-color: $color-primary;
}

.feat-pick.is-picked {
  border-color: $color-primary;
  background: $color-accent-tint;
}

.feat-pick:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.feat-pick-title {
  font-size: 14px;
  font-weight: 500;
  color: $color-text;
}

.feat-pick-sub {
  font-size: 12px;
  color: $color-text-muted;
}

.feat-days {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.feat-days-under {
  margin-top: 8px;
}

.feat-days-input {
  width: 110px;
}

.feat-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

@include mobile-only {
  .feat-capacity-row {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .feat-capacity-bar {
    grid-column: 1 / -1;
    grid-row: 2;
  }
}
</style>
