<template>
  <div v-if="dashboard">
    <DashboardPageHeader
      greeting
      :title="t('dashboard.greeting', { name: auth.user?.firstName })"
      :subtitle="dashboard.attentionItems.length ? thingsWaitingText : t('dashboard.allCaughtUp')"
    />

    <section v-if="dashboard.attentionItems.length" class="home-tasks">
      <div
        v-for="item in dashboard.attentionItems"
        :key="item.title"
        class="home-task"
        :class="{ 'home-task-info': item.urgency === 'info' }"
      >
        <span class="home-task-bar" aria-hidden="true" />
        <div class="home-task-body">
          <div class="home-task-text">
            <p class="home-task-title">{{ attentionText(item) }}</p>
            <p v-if="te(`attention.hint.${item.title}`)" class="home-task-hint">{{ t(`attention.hint.${item.title}`) }}</p>
          </div>
          <NuxtLink :to="item.actionUrl" class="home-button">{{ attentionAction(item) }}</NuxtLink>
        </div>
      </div>
    </section>

    <!-- T97: every number says what it counts; the frame's line under it is
         the short version, the tooltip keeps the long one. -->
    <section class="home-stats">
      <div v-for="stat in stats" :key="stat.key" class="home-stat" :title="stat.explanation">
        <p class="home-stat-label">{{ stat.label }}</p>
        <p class="home-stat-value">{{ stat.value }}</p>
        <p class="home-stat-hint">{{ stat.hint }}</p>
      </div>
    </section>

    <div class="home-panels">
      <section class="home-panel home-upcoming">
        <div class="home-panel-head">
          <h2 class="home-panel-title">{{ t('dashboard.upcoming') }}</h2>
          <NuxtLink :to="bookingsUrl" class="home-panel-link">{{ t('dashboard.upcomingSeeAll') }}</NuxtLink>
        </div>

        <ul v-if="upcoming.length" class="home-upcoming-list">
          <li v-for="row in upcoming" :key="row.id">
            <NuxtLink :to="`/rezervacije/${row.id}`" class="home-upcoming-row">
              <span class="home-upcoming-when">
                <span class="home-upcoming-day">{{ row.day }}</span>
                <span class="home-upcoming-time">{{ row.time }}</span>
              </span>
              <span class="home-upcoming-what">
                <span class="home-upcoming-listing">{{ row.listing }}</span>
                <span v-if="row.meta" class="home-upcoming-meta">{{ row.meta }}</span>
              </span>
              <span class="home-pill" :class="`home-pill-${row.status}`">{{ row.statusText }}</span>
            </NuxtLink>
          </li>
        </ul>

        <!-- The frame draws no empty list; this follows Dizajn 44's rule. -->
        <StateBlock
          v-else
          icon="bookings"
          class="home-empty"
          :title="t('dashboard.noUpcoming')"
          :text="t('dashboard.noUpcomingText')"
        >
          <NuxtLink :to="emptyAction.to" class="home-button home-empty-button">{{ emptyAction.label }}</NuxtLink>
        </StateBlock>
      </section>

      <section v-if="dashboard.onboarding" class="home-panel home-onboarding">
        <div class="home-onboarding-head">
          <div class="home-panel-head">
            <h2 class="home-panel-title">{{ t('dashboard.onboardingTitle') }}</h2>
            <span class="home-onboarding-count">
              {{ t('dashboard.onboardingProgress', { done: doneSteps, total: steps.length }) }}
            </span>
          </div>
          <div class="home-progress" role="progressbar" :aria-valuenow="doneSteps" aria-valuemin="0" :aria-valuemax="steps.length">
            <span class="home-progress-fill" :style="{ width: `${(doneSteps / steps.length) * 100}%` }" />
          </div>
        </div>

        <ul class="home-steps">
          <li v-for="step in steps" :key="step.key" class="home-step" :class="{ 'is-done': step.done }">
            <span class="home-step-mark">
              <img v-if="step.done" src="/images/icons/check-onboarding-20.svg" alt="" width="20" height="20" />
            </span>
            <span class="home-step-text">{{ t(STEP_TEXT[step.key]) }}</span>
            <NuxtLink v-if="!step.done" :to="step.actionUrl" class="home-step-link">
              {{ t(`dashboard.onboardingAction.${step.key}`) }}
            </NuxtLink>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ middleware: 'auth', layout: 'dashboard' })
const { t, te } = useI18n()
const api = useApi()
const auth = useAuthStore()

const { data: dashboard } = await useAsyncData('dashboard', () => api.get('/dashboard'))

const STEP_TEXT = {
  listing: 'dashboard.onboardingListing',
  availability: 'dashboard.onboardingAvailability',
  ical: 'dashboard.onboardingIcal',
  bankAccount: 'dashboard.onboardingBankAccount',
}

// 357:505: the review reminder continues something already started, the
// rest ask the user to look at something (357:503). Only guests review
// since Dizajn 43.
const CONTINUE_ITEMS = ['pending_reviews_guest']

const thingsWaitingText = computed(() => {
  const count = dashboard.value.attentionItems.length
  return t(`dashboard.thingsWaiting${srPluralCategory(count)}`, { count })
})

// T85 — most attention item titles carry a count and need a plural form per
// count (attention.new_requestsOne/Few/Many); a few are fixed phrases with no
// real plural (attention.term_conflict) and just keep their single key.
function attentionText(item) {
  const pluralKey = `attention.${item.title}${srPluralCategory(item.count)}`
  const key = te(pluralKey) ? pluralKey : `attention.${item.title}`
  return t(key, { count: item.count })
}

function attentionAction(item) {
  return CONTINUE_ITEMS.includes(item.title) ? t('common.continue') : t('attention.actionReview')
}

function formatPrice(value) {
  return `${new Intl.NumberFormat('sr-RS').format(value || 0)} RSD`
}

const stats = computed(() => {
  const s = dashboard.value.stats
  return [
    { key: 'listings', value: s.listingCount },
    { key: 'bookings', value: s.bookingCount },
    { key: 'value', value: formatPrice(s.confirmedValue) },
    // The frame's empty rating is an em dash; a hyphen stands in for it.
    { key: 'rating', value: s.avgRating ? s.avgRating.toFixed(1) : '-' },
  ].map((stat) => ({
    ...stat,
    label: t(`dashboard.${stat.key}`),
    hint: t(`dashboard.${stat.key}Hint`),
    explanation: t(`dashboard.${stat.key}Explanation`),
  }))
})

const bookingsUrl = computed(() => `/kontrolna-tabla/rezervacije?role=${dashboard.value.isOwner ? 'owner' : 'guest'}`)

const emptyAction = computed(() =>
  dashboard.value.isOwner
    ? { to: '/kontrolna-tabla/oglasi', label: t('listing.myListings') }
    : { to: '/pretraga', label: t('dashboard.browseListings') },
)

const upcoming = computed(() => {
  const weekdays = t('listing.calendarWeekdays').split(',')
  return dashboard.value.upcomingBookings.map((booking) => {
    const guests = booking.guestCount
      ? t(`dashboard.upcomingGuests.${booking.guestUnit}${srPluralCategory(booking.guestCount)}`, { count: booking.guestCount })
      : ''
    const place = booking.listing.place
    return {
      id: booking.id,
      status: booking.status,
      day: formatUpcomingDay(booking.startsAt, weekdays),
      time: formatUpcomingTimes(booking) ?? t('dashboard.upcomingUntil', { date: formatUpcomingDay(booking.endsAt, weekdays) }),
      listing: place ? `${booking.listing.title} - ${place}` : booking.listing.title,
      meta: [booking.counterpartName, guests].filter(Boolean).join(' · '),
      statusText: t(`dashboard.upcomingStatus.${booking.status}`),
    }
  })
})

const steps = computed(() => dashboard.value.onboarding?.steps || [])
const doneSteps = computed(() => steps.value.filter((step) => step.done).length)

useSeoMeta({ title: t('dashboard.overview') })
</script>

<style lang="scss" scoped>
// Dizajn 31, frame 357:493: under the greeting, the task cards, the four
// numbers, then "Sledećih 7 dana" beside "Dobrodošli na Rentaj", each block
// 32 apart. The two card rows sit 8 in from the task cards (357:513, 357:530).

// 357:497
.home-tasks {
  display: flex;
  flex-direction: column;
  gap: 32px;
  margin-bottom: 32px;
}

.home-task {
  display: flex;
  overflow: hidden;
  border-radius: $radius-card;
  background: $color-surface;
  box-shadow:
    0 6px 20px rgba(97, 115, 133, 0.08),
    0 1px 3px rgba(97, 115, 133, 0.05);
}

// 357:498 red, 357:506 blue
.home-task-bar {
  flex: 0 0 5px;
  background: #f43f5e;
}

.home-task-info .home-task-bar {
  background: $color-primary;
}

.home-task-body {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 16px;
  min-width: 0;
  padding: 18px 20px 18px 22px;
}

.home-task-text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.home-task-title {
  font-size: 15px;
  font-weight: 500;
  line-height: normal;
  color: $color-text;
}

.home-task-hint {
  font-size: 12px;
  font-weight: 300;
  line-height: normal;
  color: $color-text-muted;
}

// 357:503
.home-button {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  padding: 11px 20px;
  border-radius: $radius-button;
  background: $color-background;
  font-size: 13px;
  font-weight: 500;
  line-height: normal;
  color: $color-text;
  white-space: nowrap;
}

.home-button:hover {
  color: $color-primary;
}

// 357:513
.home-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 32px;
  margin-bottom: 32px;
  padding: 4px 8px 8px;
}

// 357:514: 114 tall with the last line 8 above the bottom edge.
.home-stat {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  min-height: 114px;
  padding: 20px 22px 8px;
  overflow: hidden;
  border-radius: $radius-card;
  background: $color-surface;
  box-shadow: $shadow-card;
}

.home-stat-label {
  font-size: 12px;
  font-weight: 500;
  line-height: normal;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  color: $color-text-muted;
}

.home-stat-value {
  font-size: 30px;
  font-weight: 600;
  line-height: normal;
  letter-spacing: -0.8px;
  color: $color-text;
}

.home-stat-hint {
  font-size: 12px;
  font-weight: 300;
  line-height: 17px;
  color: $color-text-muted;
}

// 357:530
.home-panels {
  display: flex;
  align-items: flex-start;
  gap: 32px;
  padding: 4px 8px 8px;
}

.home-panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 20px 22px 22px;
  overflow: hidden;
  border-radius: $radius-card;
  background: $color-surface;
  box-shadow: $shadow-card;
}

.home-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.home-panel-title {
  font-size: 17px;
  font-weight: 500;
  line-height: normal;
  color: $color-text;
}

.home-panel-link {
  font-size: 13px;
  font-weight: 500;
  line-height: normal;
  color: $color-primary;
  white-space: nowrap;
}

// 357:531
.home-upcoming {
  flex: 1;
  gap: 14px;
}

.home-upcoming-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

// 357:536
.home-upcoming-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  border-radius: $radius-input;
  background: $color-background;
  color: $color-text;
}

.home-upcoming-when {
  display: flex;
  flex: 0 0 110px;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.home-upcoming-what {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.home-upcoming-day,
.home-upcoming-listing {
  font-size: 13px;
  line-height: normal;
  color: $color-text;
}

.home-upcoming-day {
  font-weight: 500;
}

.home-upcoming-listing {
  font-weight: 400;
}

.home-upcoming-time,
.home-upcoming-meta {
  font-size: 12px;
  font-weight: 300;
  line-height: normal;
  color: $color-text-muted;
}

.home-upcoming-listing,
.home-upcoming-meta {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.home-upcoming-row:hover .home-upcoming-listing {
  color: $color-primary;
}

// 357:543, 357:552, 357:570
.home-pill {
  flex-shrink: 0;
  padding: 5px 10px;
  border-radius: $radius-pill;
  font-size: 11px;
  font-weight: 500;
  line-height: normal;
  white-space: nowrap;
}

.home-pill-CONFIRMED {
  background: #cdfad1;
  color: #178c24;
}

.home-pill-AWAITING_PAYMENT {
  background: $color-warning-bg;
  color: $color-warning;
}

.home-pill-REQUESTED {
  background: $color-accent-tint;
  color: $color-primary;
}

// Dizajn 44: the block sits inside the panel, tighter than a page of its
// own, and the panel is narrower than the sentence ever needs.
.state-block.home-empty {
  padding: 20px 16px 8px;
}

.home-empty-button {
  margin-top: 16px;
}

// 357:572
.home-onboarding {
  flex: 0 0 330px;
  gap: 16px;
}

.home-onboarding-head {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.home-onboarding-count {
  font-size: 13px;
  font-weight: 500;
  line-height: normal;
  color: $color-text-muted;
  white-space: nowrap;
}

// 357:577
.home-progress {
  position: relative;
  height: 6px;
  overflow: hidden;
  border-radius: $radius-pill;
  background: $color-background;
}

.home-progress-fill {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  border-radius: $radius-pill;
  background: linear-gradient(90deg, $color-gradient-start, $color-gradient-mid);
}

// 357:579
.home-steps {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

// 357:590 still to do, 357:580 done
.home-step {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 14px;
  border-radius: $radius-input;
  background: $color-accent-tint;
}

.home-step.is-done {
  background: $color-background;
}

// 357:591: the 1.5 stroke is an inset shadow, a border would snap to 1.
.home-step-mark {
  flex: 0 0 20px;
  height: 20px;
  border-radius: 50%;
  background: $color-surface;
  box-shadow: inset 0 0 0 1.5px $color-border;
}

.is-done .home-step-mark {
  background: #cdfad1;
  box-shadow: none;
}

.home-step-text {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 400;
  line-height: normal;
  color: $color-text;
}

.is-done .home-step-text {
  color: $color-text-muted;
}

.home-step-link {
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 500;
  line-height: normal;
  color: $color-primary;
}

// Below xl the content column is too narrow for four numbers and two panels
// in a row.
@include respond-below(xl) {
  .home-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .home-panels {
    flex-direction: column;
    align-items: stretch;
  }

  // A column keeps each panel at its own height.
  .home-panels .home-panel {
    flex: none;
  }
}

// A narrow row puts the state beside the day and the listing under both.
@include respond-below(lg) {
  .home-upcoming-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px 12px;
  }

  .home-upcoming-when {
    grid-area: 1 / 1;
  }

  .home-pill {
    grid-area: 1 / 2;
    align-self: start;
  }

  .home-upcoming-what {
    grid-area: 2 / 1 / 3 / 3;
  }
}

@include mobile-only {
  .home-tasks {
    gap: 16px;
    margin-bottom: 24px;
  }

  .home-task-body {
    padding: 16px;
  }

  .home-stats {
    gap: 16px;
    margin-bottom: 24px;
    padding: 0;
  }

  .home-stat {
    padding: 16px 16px 8px;
  }

  .home-panels {
    gap: 24px;
    padding: 0;
  }

  .home-panel {
    padding: 18px 16px 16px;
  }
}
</style>
