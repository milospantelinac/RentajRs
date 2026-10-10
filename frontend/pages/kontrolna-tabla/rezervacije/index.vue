<template>
  <div>
    <DashboardPageHeader class="bookreq-header" :title="title" />

    <div class="bookreq-controls">
      <nav class="bookreq-roles" :aria-label="t('bookingRequests.roleLabel')">
        <NuxtLink
          v-for="option in roleOptions"
          :key="option.role"
          :to="option.to"
          class="bookreq-role"
          :class="{ 'is-active': option.active }"
          :aria-current="option.active ? 'page' : undefined"
        >{{ option.label }}</NuxtLink>
      </nav>
      <select :value="status" class="bookreq-select" :aria-label="t('bookingRequests.statusLabel')" @change="setStatus($event.target.value)">
        <option value="">{{ t('common.all') }}</option>
        <option v-for="option in statusOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
      </select>
    </div>

    <!-- Dizajn 44: a failed load and a role without bookings say so in the
         card the table would fill; another role or status is loading in the
         shape of the rows that are coming. -->
    <StateBlock
      v-if="!pending && error"
      error
      :icon="stateIcon"
      class="bookreq-card"
      :class="cardClass"
      :title="t('bookingRequests.loadErrorTitle')"
      :text="t('bookingRequests.loadErrorText')"
    >
      <button type="button" class="state-block-action" @click="refresh()">{{ t('errorPage.tryAgain') }}</button>
    </StateBlock>

    <StateBlock
      v-else-if="!pending && !rows.length && !status"
      :icon="stateIcon"
      class="bookreq-card"
      :class="cardClass"
      :title="t(`bookingRequests.empty.${role}.title`)"
      :text="t(`bookingRequests.empty.${role}.text`)"
    >
      <NuxtLink :to="emptyAction.to" class="state-block-action">{{ emptyAction.label }}</NuxtLink>
    </StateBlock>

    <div v-else class="bookreq-card" :class="cardClass" role="table" :aria-label="title">
      <div class="bookreq-head" role="row">
        <span class="bookreq-cell-listing" role="columnheader">{{ t('booking.listingTitle') }}</span>
        <span class="bookreq-cell-term" role="columnheader">{{ termHeader }}</span>
        <span class="bookreq-cell-amount" role="columnheader">{{ t('booking.totalAmount') }}</span>
        <span class="bookreq-cell-status" role="columnheader">{{ t('common.status') }}</span>
        <span class="bookreq-cell-arrow" aria-hidden="true" />
      </div>

      <template v-if="pending">
        <div v-for="index in SKELETON_ROWS" :key="`loading-${index}`" class="bookreq-row" aria-hidden="true">
          <div class="bookreq-cell-listing bookreq-pair">
            <SkeletonBox width="58%" height="15px" />
            <SkeletonBox width="38%" height="13px" />
          </div>
          <div class="bookreq-cell-term bookreq-pair">
            <SkeletonBox width="82%" height="14px" />
            <SkeletonBox width="54%" height="13px" />
          </div>
          <div class="bookreq-cell-amount">
            <SkeletonBox width="76%" height="15px" />
          </div>
          <div class="bookreq-cell-status">
            <SkeletonBox width="104px" height="27px" radius="999px" />
          </div>
          <span class="bookreq-cell-arrow" />
        </div>
      </template>

      <template v-else>
        <div v-for="row in rows" :key="row.id" class="bookreq-row" role="row">
          <div class="bookreq-cell-listing bookreq-pair" role="cell">
            <NuxtLink :to="row.to" class="bookreq-link">{{ row.listing }}</NuxtLink>
            <p v-if="row.meta" class="bookreq-sub">{{ row.meta }}</p>
          </div>
          <div class="bookreq-cell-term bookreq-pair" role="cell">
            <p class="bookreq-date">{{ row.date }}</p>
            <p class="bookreq-sub">{{ row.time }}</p>
          </div>
          <p class="bookreq-cell-amount bookreq-amount" role="cell">{{ row.amount }}</p>
          <div class="bookreq-cell-status" role="cell">
            <span class="bookreq-pill" :class="`bookreq-pill-${row.status}`">{{ row.statusText }}</span>
            <span v-if="row.changeText" class="bookreq-pill bookreq-pill-change">{{ row.changeText }}</span>
          </div>
          <img src="/images/icons/chevron-right-faint.svg" alt="" width="16" height="16" class="bookreq-cell-arrow" />
        </div>

        <div v-if="!rows.length" class="bookreq-state-filtered" role="row">
          <div role="cell">
            <StateBlock
              :icon="stateIcon"
              :title="t('bookingRequests.empty.filtered.title')"
              :text="t('bookingRequests.empty.filtered.text')"
            >
              <!-- The router calls any link to this path current, whatever its query. -->
              <NuxtLink :to="{ query: { role } }" class="state-block-action" :aria-current="null">{{ t('bookingRequests.showAll') }}</NuxtLink>
            </StateBlock>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
// One list for both sides of a booking: ?role=owner is "Zahtevi za
// rezervaciju", the guest's side (the default) "Moje rezervacije". Dizajn 34
// (frame 378:493) draws the owner's, Dizajn 39 (380:671) the guest's; the role
// and the status both live in the URL, so the home page's task cards can open
// one filtered list (T96).
import { BOOKING_STATUSES, buildBookingRow, getBookingStatus, getBookingStatusLabel } from '~/utils/bookingRequests'

definePageMeta({ middleware: 'auth', layout: 'dashboard' })
const { t } = useI18n()
const api = useApi()
const route = useRoute()
const router = useRouter()

const role = computed(() => (route.query.role === 'owner' ? 'owner' : 'guest'))
const status = computed(() => getBookingStatus(route.query.status))

const { data: bookings, error, pending, refresh } = await useAsyncData(
  'my-bookings',
  () => api.get('/bookings/mine', { query: { role: role.value, ...(status.value ? { status: status.value } : {}) } }),
  { watch: [role, status] },
)

// Dizajn 44: the page itself arrives with its rows, so `pending` is only ever
// true for the re-fetch another role or status triggers - the one moment the
// table has nothing to show yet, and the one the skeleton rows fill.
const SKELETON_ROWS = 5

const title = computed(() => (role.value === 'owner' ? t('dashboard.requests') : t('dashboard.myBookings')))

// 380:773: the guest's table heads the term column "Termin" (the frame sets
// it in capitals, unlike its other headers) and casts a lighter shadow (380:770).
const termHeader = computed(() => (role.value === 'owner' ? t('booking.dateTime') : t('bookingRequests.termHeader')))
const cardClass = computed(() => ({ 'is-guest': role.value === 'guest' }))

// 378:497, 378:499
const roleOptions = computed(() =>
  [
    { role: 'guest', label: t('dashboard.bookingsAsGuest') },
    { role: 'owner', label: t('dashboard.bookingsAsOwner') },
  ].map((option) => ({
    ...option,
    to: { query: { ...route.query, role: option.role } },
    active: option.role === role.value,
  })),
)

const statusOptions = computed(() => BOOKING_STATUSES.map((value) => ({ value, label: getBookingStatusLabel(t, value) })))

function setStatus(value) {
  const query = { ...route.query }
  if (value) query.status = value
  else delete query.status
  router.replace({ query })
}

const rows = computed(() => (bookings.value || []).map((booking) => buildBookingRow(t, booking)))

const stateIcon = computed(() => (role.value === 'owner' ? 'requests' : 'bookings'))

const emptyAction = computed(() =>
  role.value === 'owner'
    ? { to: '/kontrolna-tabla/oglasi', label: t('listing.myListings') }
    : { to: '/pretraga', label: t('dashboard.browseListings') },
)

// T96: both nav links land on this page, so the tab title follows the role.
useSeoMeta({ title })
</script>

<style lang="scss" scoped>
// Dizajn 34, frame 378:493: the title, the role and status controls, and the
// table, 20 apart.
$bookreq-danger-bg: #fcd8e0;
$bookreq-success: #178c24;
$bookreq-success-bg: #cdfad1;
$bookreq-closed-bg: #f0f2f5;

.dash-page-header.bookreq-header {
  margin-bottom: 20px;
}

// 378:496
.bookreq-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.bookreq-roles {
  display: flex;
  gap: 12px;
}

// 378:497, and 378:499 for the selected one. Figma draws the stroke inside,
// so the padding gives up its pixel; the selected button keeps a clear border
// and the same size.
.bookreq-role {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 11px 21px;
  border: 1px solid $color-border;
  border-radius: $radius-button;
  background: $color-surface;
  font-size: 14px;
  font-weight: 500;
  line-height: normal;
  color: $color-text;
  white-space: nowrap;
}

.bookreq-role:hover {
  border-color: $color-primary;
  color: $color-primary;
}

.bookreq-role.is-active,
.bookreq-role.is-active:hover {
  border-color: transparent;
  background: $color-primary;
  color: $color-surface;
}

// 378:501
.bookreq-select {
  width: 300px;
  max-width: 100%;
  height: 42px;
  padding: 0 49px 0 17px;
  border: 1px solid $color-border;
  border-radius: $radius-input;
  background: $color-surface url('/images/icons/chevron-down-18.svg') no-repeat right 15px center / 18px 18px;
  font-family: inherit;
  font-size: 14px;
  font-weight: 400;
  line-height: normal;
  color: $color-text;
  cursor: pointer;
  appearance: none;
}

.bookreq-select:hover {
  border-color: $color-primary;
}

.bookreq-select:focus-visible {
  outline: none;
  border-color: $color-primary;
  box-shadow: 0 0 0 3px $color-accent-tint;
}

// 378:505
.bookreq-card {
  overflow: hidden;
  border-radius: $radius-card;
  background: $color-surface;
  box-shadow: $shadow-card;
}

// 380:770. Close to $shadow-card-wide, whose 1px layer is lighter.
.bookreq-card.is-guest {
  box-shadow:
    0 1px 3px rgba(97, 115, 133, 0.05),
    0 6px 20px rgba(97, 115, 133, 0.08);
}

// 378:506
.bookreq-head {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 22px;
  background: $color-background;
  font-size: 12px;
  font-weight: 500;
  line-height: normal;
  color: $color-text-muted;
}

// The row's widths, with the header on the same lines (the frame sets its
// header 14 to 19 to the right of the cells under it). Below 1400 the listing
// keeps 200 and the other columns give way down to what they need.
.bookreq-cell-listing {
  flex: 1 1 0;
  min-width: 200px;
}

.bookreq-cell-term {
  flex: 0 1 190px;
  min-width: 124px;
}

.bookreq-cell-amount {
  flex: 0 1 150px;
  min-width: 96px;
}

.bookreq-cell-status {
  display: flex;
  flex: 0 1 190px;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  min-width: 124px;
}

.bookreq-cell-arrow {
  display: block;
  flex: 0 0 16px;
  width: 16px;
  height: 16px;
}

// Only a spacer in the header, which keeps the 15 of its text.
.bookreq-head .bookreq-cell-arrow {
  height: auto;
}

// 378:511: 70 tall with the 1px line inside, as the Figma stroke is. The
// listing's link covers the whole row.
.bookreq-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 15px 22px 16px;
  border-top: 1px solid $color-border;
}

.bookreq-pair {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  overflow-wrap: anywhere;
}

// 378:513
.bookreq-link {
  font-size: 15px;
  font-weight: 500;
  line-height: normal;
  color: $color-text;
}

.bookreq-link::after {
  content: '';
  position: absolute;
  inset: 0;
}

.bookreq-link:focus-visible {
  outline: none;
}

.bookreq-link:focus-visible::after {
  outline: 2px solid $color-primary;
  outline-offset: -2px;
}

.bookreq-row:hover .bookreq-link {
  color: $color-primary;
}

// 378:514, 378:517
.bookreq-sub {
  font-size: 13px;
  font-weight: 300;
  line-height: normal;
  color: $color-text-muted;
}

// 378:516
.bookreq-date {
  font-size: 14px;
  font-weight: 400;
  line-height: normal;
  color: $color-text;
}

// 378:518
.bookreq-amount {
  font-size: 15px;
  font-weight: 500;
  line-height: normal;
  color: $color-text;
  white-space: nowrap;
}

// 378:520 and the other states of the column
.bookreq-pill {
  padding: 6px 12px;
  border-radius: $radius-pill;
  font-size: 12px;
  font-weight: 500;
  line-height: normal;
  white-space: nowrap;
}

.bookreq-pill-REQUESTED,
.bookreq-pill-AWAITING_PAYMENT {
  background: $color-warning-bg;
  color: $color-warning;
}

.bookreq-pill-CONFIRMED {
  background: $bookreq-success-bg;
  color: $bookreq-success;
}

.bookreq-pill-COMPLETED,
.bookreq-pill-EXPIRED {
  background: $color-background;
  color: $color-text-muted;
}

// The frame draws no no-show; like a declined request it ended badly.
.bookreq-pill-REJECTED,
.bookreq-pill-NO_SHOW {
  background: $bookreq-danger-bg;
  color: $color-error;
}

.bookreq-pill-CANCELLED {
  background: $bookreq-closed-bg;
  color: $color-text-muted;
}

// T136: no frame; a request for another term, in the accent tint.
.bookreq-pill-change {
  background: $color-accent-tint;
  color: $color-primary;
}

// Dizajn 44: the filtered empty state keeps the table row it stands in; the
// block itself brings the padding and the centring.
.bookreq-state-filtered {
  border-top: 1px solid $color-border;
}

// Below xl the four columns no longer fit: each row becomes a small card with
// the listing and its state on top and the term and total under them.
@include respond-below(xl) {
  .bookreq-head {
    display: none;
  }

  .bookreq-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      'listing status'
      'term amount';
    align-items: center;
    gap: 12px 16px;
    padding: 17px 22px 18px;
  }

  .bookreq-head + .bookreq-row,
  .bookreq-head + .bookreq-state-filtered {
    border-top: 0;
  }

  .bookreq-head + .bookreq-row {
    padding-top: 18px;
  }

  .bookreq-cell-listing,
  .bookreq-cell-term,
  .bookreq-cell-amount,
  .bookreq-cell-status {
    min-width: 0;
  }

  .bookreq-cell-listing {
    grid-area: listing;
  }

  .bookreq-cell-status {
    grid-area: status;
    justify-content: flex-end;
  }

  .bookreq-cell-term {
    grid-area: term;
  }

  .bookreq-cell-amount {
    grid-area: amount;
    text-align: right;
  }

  .bookreq-row .bookreq-cell-arrow {
    display: none;
  }
}

@include mobile-only {
  .bookreq-roles {
    flex: 1 1 100%;
  }

  .bookreq-role {
    flex: 1;
  }

  .bookreq-select {
    width: 100%;
  }

  .bookreq-row {
    grid-template-areas:
      'listing listing'
      'status status'
      'term amount';
    gap: 10px 16px;
    padding: 15px 16px 16px;
  }

  .bookreq-head + .bookreq-row {
    padding-top: 16px;
  }

  .bookreq-cell-status {
    justify-content: flex-start;
  }
}
</style>
