<template>
  <div>
    <DashboardPageHeader class="mylist-header" :title="t('listing.myListings')" :subtitle="summary">
      <template #actions>
        <NuxtLink to="/oglasi/novi" class="mylist-add"><span aria-hidden="true">{{ PLUS }}</span>{{ t('nav.addListing') }}</NuxtLink>
      </template>
    </DashboardPageHeader>

    <div v-if="showUpdatedBanner" class="updated-banner mb-4">{{ t('listing.changesSavedMessage') }}</div>

    <!-- Dizajn 44: a failed load and an owner without listings both say so
         inside the card the table would fill. -->
    <section v-if="error" class="mylist-card mylist-state is-error">
      <DashboardNavIcon name="listings" class="mylist-state-icon" />
      <p class="mylist-state-title">{{ t('myListings.loadErrorTitle') }}</p>
      <p class="mylist-state-text">{{ t('myListings.loadErrorText') }}</p>
      <button type="button" class="mylist-button" @click="refresh()">{{ t('errorPage.tryAgain') }}</button>
    </section>

    <section v-else-if="!allListings.length" class="mylist-card mylist-state">
      <DashboardNavIcon name="listings" class="mylist-state-icon" />
      <p class="mylist-state-title">{{ t('myListings.emptyTitle') }}</p>
      <p class="mylist-state-text">{{ t('myListings.emptyText') }}</p>
      <NuxtLink to="/oglasi/novi" class="mylist-add mylist-state-action"><span aria-hidden="true">{{ PLUS }}</span>{{ t('nav.addListing') }}</NuxtLink>
    </section>

    <template v-else>
      <nav class="mylist-tabs" :aria-label="t('myListings.tabsLabel')">
        <NuxtLink
          v-for="tab in tabs"
          :key="tab.key"
          :to="tab.to"
          class="mylist-tab"
          :class="{ 'is-active': tab.active }"
          :aria-current="tab.active ? 'page' : undefined"
        >
          <span class="mylist-tab-label">{{ tab.label }}</span>
          <span class="mylist-tab-count">{{ tab.count }}</span>
        </NuxtLink>
      </nav>

      <p v-if="deleteError" class="mylist-alert" role="alert">
        <img src="/images/icons/field-error.svg" alt="" width="16" height="16" />
        {{ deleteError }}
      </p>

      <div class="mylist-card" role="table" :aria-label="t('listing.myListings')">
        <div class="mylist-head" role="row">
          <span class="mylist-field-listing" role="columnheader">{{ t('myListings.columns.listing') }}</span>
          <span class="mylist-field-status" role="columnheader">{{ t('myListings.columns.status') }}</span>
          <span class="mylist-field-package" role="columnheader">{{ t('myListings.columns.package') }}</span>
          <span class="mylist-field-bookings" role="columnheader">{{ t('myListings.columns.bookings') }}</span>
          <span class="mylist-field-actions" role="columnheader">{{ t('myListings.columns.actions') }}</span>
        </div>

        <div v-for="row in rows" :key="row.id" class="mylist-row" :class="{ 'is-live': row.live }" role="row">
          <div class="mylist-field-listing mylist-listing" role="cell">
            <img v-if="row.cover" :src="row.cover" alt="" class="mylist-thumb" width="64" height="46" loading="lazy" />
            <span v-else class="mylist-thumb mylist-thumb-empty" />
            <div class="mylist-text">
              <p class="mylist-title">{{ row.title }}</p>
              <p v-if="row.meta" class="mylist-meta">{{ row.meta }}</p>
            </div>
          </div>

          <div class="mylist-field-status" role="cell">
            <NuxtLink
              v-if="row.rejectedUrl"
              :to="row.rejectedUrl"
              class="mylist-pill"
              :class="`mylist-pill-${row.status}`"
              :title="t('myListings.rejectedLink')"
            >{{ row.statusText }}</NuxtLink>
            <span v-else class="mylist-pill" :class="`mylist-pill-${row.status}`">{{ row.statusText }}</span>
          </div>

          <div class="mylist-field-package mylist-pair" :class="{ 'is-empty': !row.published }" role="cell">
            <span class="mylist-cell-label">{{ t('myListings.columns.package') }}</span>
            <p class="mylist-value">{{ row.package.name }}</p>
            <p v-if="row.package.text" class="mylist-sub" :class="{ 'is-urgent': row.package.urgent }">{{ row.package.text }}</p>
          </div>

          <div class="mylist-field-bookings mylist-pair" :class="{ 'is-empty': !row.bookings }" role="cell">
            <span class="mylist-cell-label">{{ t('myListings.columns.bookings') }}</span>
            <p class="mylist-value">{{ row.bookings ? row.bookings.count : '-' }}</p>
            <p v-if="row.bookings" class="mylist-sub">
              <!-- A line breaks between the open items, not inside "1 čeka uplatu". -->
              <template v-for="(item, index) in row.bookings.open" :key="item">
                {{ index ? ' ' : '' }}<span class="mylist-open">{{ item }}{{ index < row.bookings.open.length - 1 ? ',' : '' }}</span>
              </template>
              <template v-if="!row.bookings.open.length">-</template>
            </p>
          </div>

          <div class="mylist-field-actions mylist-actions" role="cell">
            <NuxtLink :to="row.editUrl" class="mylist-edit">{{ t('listing.editListing') }}</NuxtLink>
            <div class="mylist-more" @focusout="onMenuFocusOut($event, row.id)">
              <button
                type="button"
                class="mylist-more-button"
                aria-haspopup="menu"
                :aria-expanded="openMenuId === row.id ? 'true' : 'false'"
                :aria-controls="`mylist-menu-${row.id}`"
                :aria-label="t('myListings.moreActions', { title: row.title })"
                @click="toggleMenu(row.id, $event)"
              >
                <img src="/images/icons/more-dots-20.svg" alt="" width="20" height="20" />
              </button>
              <div v-if="openMenuId === row.id" :id="`mylist-menu-${row.id}`" class="mylist-menu" role="menu" @keydown="onMenuKeydown">
                <NuxtLink :to="row.viewUrl" class="mylist-menu-item" role="menuitem">{{ t('myListings.view') }}</NuxtLink>
                <button type="button" class="mylist-menu-item is-danger" role="menuitem" @click="remove(row)">
                  {{ t('listing.deleteListing') }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="!rows.length" class="mylist-state mylist-state-tab" role="row">
          <div role="cell">
            <DashboardNavIcon name="listings" class="mylist-state-icon" />
            <p class="mylist-state-title">{{ t(`myListings.emptyTab.${activeTab}.title`) }}</p>
            <p class="mylist-state-text">{{ t(`myListings.emptyTab.${activeTab}.text`) }}</p>
            <NuxtLink :to="LIST_PATH" class="mylist-button">{{ t('myListings.showAll') }}</NuxtLink>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
// RNT-060 — the owner's biggest gap: nowhere to see or manage listings
// (including drafts) outside guessing the direct /uredi URL. Also carries
// each listing's subscription info, since a package is bought per-listing
// (ADR-004) and this is where an owner checks what they're actually paying for.
// Dizajn 32 (frame 380:406) lays it out as a table with status tabs; the tab
// sits in ?status= so a link can open one.
import {
  MY_LISTINGS_TABS,
  buildMyListingRow,
  countMyListings,
  filterMyListings,
  formatMyListingsSummary,
  getMyListingsTab,
} from '~/utils/myListings'

definePageMeta({ middleware: 'auth', layout: 'dashboard' })
const { t } = useI18n()
const api = useApi()
const route = useRoute()

const LIST_PATH = '/kontrolna-tabla/oglasi'
// 380:499 reads "+  Dodaj oglas"; an interpolation keeps both spaces, which the template compiler would condense.
const PLUS = '+  '

const { data: listings, error, refresh } = await useAsyncData('my-listings', () => api.get('/listings/mine'))
const allListings = computed(() => listings.value || [])

// T41 — editing a listing that already has a package attached skips the
// package-selection detour entirely (see uredi.vue's finishEditing); this is
// where that confirmation actually surfaces, same banner pattern as pretplate.vue.
const showUpdatedBanner = computed(() => route.query.updated === '1')

const summary = computed(() => formatMyListingsSummary(t, allListings.value))

const activeTab = computed(() => getMyListingsTab(route.query.status))

const tabs = computed(() =>
  MY_LISTINGS_TABS.map((key) => ({
    key,
    label: t(`myListings.tabs.${key}`),
    count: countMyListings(allListings.value, key),
    to: key === 'ALL' ? LIST_PATH : { path: LIST_PATH, query: { status: key } },
    active: key === activeTab.value,
  })),
)

const now = Date.now()
const rows = computed(() => filterMyListings(allListings.value, activeTab.value).map((listing) => buildMyListingRow(t, listing, now)))

// 474:409: the "⋯" menu of one row at a time.
const openMenuId = ref(null)

async function toggleMenu(id, event) {
  if (openMenuId.value === id) {
    openMenuId.value = null
    return
  }
  openMenuId.value = id
  // Opened from the keyboard (a click with no pointer), focus moves into the menu.
  if (event.detail === 0) {
    await nextTick()
    document.querySelector(`#mylist-menu-${id} [role="menuitem"]`)?.focus()
  }
}

function onMenuKeydown(event) {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
  event.preventDefault()
  const items = [...event.currentTarget.querySelectorAll('[role="menuitem"]')]
  const step = event.key === 'ArrowDown' ? 1 : -1
  const index = items.indexOf(document.activeElement)
  items[(index + step + items.length) % items.length]?.focus()
}

function onMenuFocusOut(event, id) {
  if (openMenuId.value === id && !event.currentTarget.contains(event.relatedTarget)) openMenuId.value = null
}

function onDocumentClick(event) {
  if (openMenuId.value && !event.target.closest?.('.mylist-more')) openMenuId.value = null
}

function onDocumentKeydown(event) {
  if (event.key !== 'Escape' || !openMenuId.value) return
  const id = openMenuId.value
  openMenuId.value = null
  document.querySelector(`[aria-controls="mylist-menu-${id}"]`)?.focus()
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onDocumentKeydown)
})
onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onDocumentKeydown)
})

const deleteError = ref('')

watch(
  () => route.query.status,
  () => {
    openMenuId.value = null
    deleteError.value = ''
  },
)

// The API refuses a listing with open requests or bookings; its message is shown above the table.
async function remove(row) {
  openMenuId.value = null
  if (!confirm(t('listing.confirmDelete'))) return
  deleteError.value = ''
  try {
    await api.delete(`/listings/${row.id}`)
    await refresh()
  } catch (e) {
    deleteError.value = extractErrorMessage(e, t('auth.genericError'))
  }
}

useSeoMeta({ title: t('listing.myListings') })
</script>

<style lang="scss" scoped>
// Dizajn 32, frame 380:493: the title bar, the status tabs and the table, 20 apart.

// 380:627: Figma dashes each side and corner of the 64x46 picture on its own,
// 4 long, centred on the ends, with the gaps stretched to a whole number of
// dashes (4 / 4 on the long sides, 4 / 3.33 on the short ones, one per corner).
$mylist-dash-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 46' fill='none' stroke='%23000'%3E%3Cg stroke-dasharray='4 4' stroke-dashoffset='2'%3E%3Cpath d='M12 .5h40'/%3E%3Cpath d='M12 45.5h40'/%3E%3C/g%3E%3Cg stroke-dasharray='4 3.333' stroke-dashoffset='2'%3E%3Cpath d='M.5 12v22'/%3E%3Cpath d='M63.5 12v22'/%3E%3C/g%3E%3Cg stroke-dasharray='4 5.032' stroke-dashoffset='2'%3E%3Cpath d='M52 .5a11.5 11.5 0 0 1 11.5 11.5'/%3E%3Cpath d='M63.5 34a11.5 11.5 0 0 1-11.5 11.5'/%3E%3Cpath d='M12 45.5A11.5 11.5 0 0 1 .5 34'/%3E%3Cpath d='M.5 12A11.5 11.5 0 0 1 12 .5'/%3E%3C/g%3E%3C/svg%3E");

.dash-page-header.mylist-header {
  margin-bottom: 20px;
}

.updated-banner {
  padding: 12px 16px;
  border-radius: $radius-card;
  background: rgba($color-success, 0.1);
  border: 1px solid rgba($color-success, 0.35);
  color: $color-success;
  font-size: $font-size-body;
}

// 380:498
.mylist-add {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  padding: 13px 20px;
  border-radius: $radius-button;
  background: linear-gradient(90deg, $color-gradient-start 0%, $color-gradient-mid 100%);
  font-size: 14px;
  font-weight: 500;
  line-height: normal;
  color: $color-surface;
  white-space: pre;
  transition: opacity 0.15s ease;
}

.mylist-add:hover {
  color: $color-surface;
  opacity: 0.92;
}

// 380:501
.mylist-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
}

// 380:502 selected, 380:505 the others
.mylist-tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: $radius-pill;
  background: $color-surface;
  font-size: 13px;
  line-height: normal;
  white-space: nowrap;
}

.mylist-tab-label {
  font-weight: 400;
  color: $color-text;
}

.mylist-tab-count {
  font-weight: 300;
  color: $color-text-muted;
}

.mylist-tab.is-active {
  background: $color-accent-tint;
}

.mylist-tab.is-active .mylist-tab-label {
  font-weight: 500;
}

.mylist-tab.is-active .mylist-tab-label,
.mylist-tab.is-active .mylist-tab-count,
.mylist-tab:hover .mylist-tab-label {
  color: $color-primary;
}

.mylist-alert {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 20px;
  padding: 12px 16px;
  border-radius: $radius-input;
  background: #fdeff1;
  font-size: 13px;
  line-height: normal;
  color: $color-error;
}

// 380:526: one white card. Nothing in it clips, so a row's "⋯" menu can hang
// over the rows below and past the last one.
.mylist-card {
  border-radius: $radius-card;
  background: $color-surface;
  box-shadow:
    0 6px 20px rgba(97, 115, 133, 0.08),
    0 1px 3px rgba(97, 115, 133, 0.05);
}

// 380:527
.mylist-head {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 13px 22px;
  border-radius: $radius-card $radius-card 0 0;
  background: $color-background;
  font-size: 11px;
  font-weight: 500;
  line-height: normal;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: $color-text-muted;
}

// The frame's column widths. Below 1400 the listing column keeps 288 and the
// four others give way, down to what their content needs at 1200.
.mylist-field-listing {
  flex: 1 1 0;
  min-width: 288px;
}

.mylist-field-status {
  flex: 0 1 140px;
  min-width: 100px;
}

.mylist-field-package {
  flex: 0 1 210px;
  min-width: 140px;
}

.mylist-field-bookings {
  flex: 0 1 120px;
  min-width: 96px;
}

.mylist-field-actions {
  flex: 0 1 150px;
  min-width: 80px;
}

// 380:533: 74 tall with the 1px line inside, as the Figma stroke is.
.mylist-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 13px 22px 14px;
  border-top: 1px solid $color-border;
}

// 380:534
.mylist-listing {
  display: flex;
  align-items: center;
  gap: 14px;
}

.mylist-thumb {
  flex: 0 0 64px;
  width: 64px;
  height: 46px;
  border-radius: $radius-input;
  object-fit: cover;
}

// 380:627: the dashes are the SVG mask above, a CSS dashed border has its own rhythm.
.mylist-thumb-empty {
  position: relative;
  background: $color-background;
}

.mylist-thumb-empty::before {
  content: '';
  position: absolute;
  inset: 0;
  background-color: $color-border;
  -webkit-mask: $mylist-dash-mask center / 100% 100% no-repeat;
  mask: $mylist-dash-mask center / 100% 100% no-repeat;
}

.mylist-text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  overflow-wrap: anywhere;
}

// 380:629: a listing that is not live reads grey.
.mylist-title {
  font-size: 14px;
  font-weight: 500;
  line-height: normal;
  color: $color-text-muted;
}

.is-live .mylist-title {
  color: $color-text;
}

// 570:519: a long reason wraps to a second line.
.mylist-meta {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  font-size: 12px;
  font-weight: 300;
  line-height: normal;
  color: $color-text-muted;
}

.mylist-field-status {
  display: flex;
  align-items: center;
}

// 380:540, 380:632, 380:653, 570:521
.mylist-pill {
  padding: 5px 10px;
  border-radius: $radius-pill;
  font-size: 11px;
  font-weight: 500;
  line-height: normal;
  white-space: nowrap;
}

.mylist-pill-ACTIVE {
  background: #cdfad1;
  color: #178c24;
}

.mylist-pill-PENDING_APPROVAL {
  background: $color-warning-bg;
  color: $color-warning;
}

.mylist-pill-DRAFT {
  background: $color-background;
  color: $color-text-muted;
}

// The frame draws no expired listing; like a rejected one it is offline until the owner acts.
.mylist-pill-REJECTED,
.mylist-pill-EXPIRED {
  background: #fdeff1;
  color: $color-error;
}

a.mylist-pill:hover {
  color: $color-error;
  text-decoration: underline;
}

// 380:542, 380:545
.mylist-pair {
  display: flex;
  flex-direction: column;
  gap: 3px;
  overflow-wrap: anywhere;
}

.mylist-value {
  font-size: 13px;
  font-weight: 400;
  line-height: normal;
  color: $color-text;
}

.mylist-sub {
  font-size: 12px;
  font-weight: 300;
  line-height: normal;
  color: $color-text-muted;
}

// 380:567
.mylist-sub.is-urgent {
  color: $color-error;
}

.mylist-open {
  display: inline-block;
}

// 380:634: a listing that never went live.
.mylist-pair.is-empty .mylist-value {
  color: $color-text-muted;
}

// The column names come back above the values once the header row is gone.
.mylist-cell-label {
  display: none;
}

// 380:548
.mylist-actions {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

// 380:640: the next step for a listing that is not live, in blue.
.mylist-edit {
  font-size: 13px;
  font-weight: 500;
  line-height: normal;
  color: $color-primary;
  white-space: nowrap;
}

.is-live .mylist-edit {
  color: $color-text;
}

.mylist-edit:hover,
.is-live .mylist-edit:hover {
  color: $color-primary;
  text-decoration: underline;
}

.mylist-more {
  display: flex;
}

.mylist-more-button {
  position: relative;
  display: flex;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
}

// A larger round target behind the 20px dots, shown on hover (474:409 draws
// the open menu without it).
.mylist-more-button::before {
  content: '';
  position: absolute;
  inset: -6px;
  border-radius: 50%;
  background: $color-background;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.mylist-more-button:hover::before {
  opacity: 1;
}

.mylist-more-button img {
  position: relative;
}

// 474:409: 1 under the row's actions, from their left edge, with a border and no shadow.
.mylist-menu {
  position: absolute;
  top: calc(100% + 1px);
  left: 0;
  z-index: $z-dropdown;
  display: flex;
  flex-direction: column;
  width: 168px;
  padding: 5px 0;
  border: 1px solid $color-border;
  border-radius: $radius-input;
  background: $color-surface;
}

// 474:410, 474:412
.mylist-menu-item {
  display: block;
  width: 100%;
  padding: 9px 13px;
  border: 0;
  background: none;
  font-size: 14px;
  font-weight: 400;
  line-height: normal;
  color: $color-text;
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
}

.mylist-menu-item:hover,
.mylist-menu-item:focus-visible {
  background: $color-background;
  color: $color-text;
}

.mylist-menu-item.is-danger,
.mylist-menu-item.is-danger:hover {
  color: $color-error;
}

// Dizajn 44: an icon, a title, one sentence and one button.
.mylist-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 24px;
  text-align: center;
}

.mylist-state-tab {
  border-top: 1px solid $color-border;
}

.mylist-state-tab > div {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.mylist-state-icon {
  width: 48px;
  height: 48px;
  margin-bottom: 12px;
  color: $color-text-muted;
}

.mylist-state-title {
  font-size: 17px;
  font-weight: 500;
  line-height: normal;
  color: $color-text;
}

.mylist-state-text {
  max-width: 420px;
  margin-top: 4px;
  font-size: 13px;
  font-weight: 300;
  line-height: normal;
  color: $color-text-muted;
}

.mylist-state.is-error .mylist-state-icon,
.mylist-state.is-error .mylist-state-title {
  color: $color-error;
}

.mylist-state-action {
  margin-top: 16px;
}

// 357:503, the home page's grey button.
.mylist-button {
  display: inline-flex;
  align-items: center;
  margin-top: 16px;
  padding: 11px 20px;
  border: 0;
  border-radius: $radius-button;
  background: $color-background;
  font-size: 13px;
  font-weight: 500;
  line-height: normal;
  color: $color-text;
  white-space: nowrap;
  cursor: pointer;
}

.mylist-button:hover {
  color: $color-primary;
}

// Below xl the columns no longer fit: each row becomes a small card with the
// listing and its state on top and the package, bookings and actions under them.
@include respond-below(xl) {
  .mylist-head {
    display: none;
  }

  .mylist-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
    grid-template-areas:
      'listing listing status'
      'package bookings actions';
    align-items: start;
    gap: 16px;
    padding: 17px 22px 18px;
  }

  .mylist-head + .mylist-row,
  .mylist-head + .mylist-state-tab {
    border-top: 0;
  }

  .mylist-head + .mylist-row {
    padding-top: 18px;
  }

  .mylist-field-listing,
  .mylist-field-status,
  .mylist-field-package,
  .mylist-field-bookings,
  .mylist-field-actions {
    min-width: 0;
  }

  .mylist-listing {
    grid-area: listing;
  }

  .mylist-field-status {
    grid-area: status;
    align-self: center;
  }

  .mylist-field-package {
    grid-area: package;
  }

  .mylist-field-bookings {
    grid-area: bookings;
  }

  .mylist-actions {
    grid-area: actions;
    align-self: center;
    gap: 20px;
  }

  .mylist-cell-label {
    display: block;
    margin-bottom: 1px;
    font-size: 11px;
    font-weight: 500;
    line-height: normal;
    letter-spacing: 0.6px;
    text-transform: uppercase;
    color: $color-text-muted;
  }

  .mylist-menu {
    right: 0;
    left: auto;
  }
}

@include mobile-only {
  .mylist-row {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    grid-template-areas:
      'listing listing'
      'status status'
      'package bookings'
      'actions actions';
    gap: 12px 16px;
    padding: 15px 16px 16px;
  }

  .mylist-head + .mylist-row {
    padding-top: 16px;
  }

  // Under the listing's text, not under its picture.
  .mylist-field-status {
    margin-top: -4px;
    padding-left: 78px;
  }

  .mylist-actions {
    justify-content: space-between;
  }

  // A touch target of 44.
  .mylist-more-button::before {
    inset: -12px;
  }

  .mylist-state {
    padding: 32px 16px;
  }
}
</style>
