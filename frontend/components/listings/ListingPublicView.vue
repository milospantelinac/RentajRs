<template>
  <div class="listing-page">
    <div class="container">
      <p v-if="preview" class="preview-banner">{{ t('listing.previewBanner') }}</p>

      <nav class="listing-breadcrumb" :aria-label="t('common.breadcrumb')">
        <NuxtLink to="/">{{ t('nav.home') }}</NuxtLink>
        <span class="listing-breadcrumb-sep" aria-hidden="true">&rsaquo;</span>
        <NuxtLink :to="`/pretraga?categorySlug=${listing.category.slug}`">{{ listing.category.name }}</NuxtLink>
        <template v-if="listing.city">
          <span class="listing-breadcrumb-sep" aria-hidden="true">&rsaquo;</span>
          <NuxtLink :to="`/pretraga?categorySlug=${listing.category.slug}&cityId=${listing.city.id}`">
            {{ listing.city.name }}
          </NuxtLink>
        </template>
        <template v-if="listing.cityArea">
          <span class="listing-breadcrumb-sep" aria-hidden="true">&rsaquo;</span>
          <span class="listing-breadcrumb-current">{{ listing.cityArea.name }}</span>
        </template>
      </nav>

      <div class="listing-title-block">
        <div class="listing-title-row">
          <span class="listing-category-pill">{{ listing.category.name }}</span>
          <div v-if="!preview" class="listing-actions">
            <button
              type="button"
              class="listing-ghost-btn"
              :class="{ 'listing-ghost-btn-active': isFavorited }"
              :disabled="togglingFavorite"
              @click="toggleFavorite"
            >
              <img :src="isFavorited ? '/images/icons/heart-solid.svg' : '/images/icons/heart-line.svg'" alt="" class="listing-ghost-icon" />
              {{ t(isFavorited ? 'listing.savedListing' : 'listing.saveListingShort') }}
            </button>
            <button type="button" class="listing-ghost-btn" @click="share">
              <img src="/images/icons/share-line.svg" alt="" class="listing-ghost-icon" />
              {{ shareCopied ? t('listing.linkCopied') : t('listing.share') }}
            </button>
          </div>
        </div>

        <h1 class="listing-title">{{ listing.title }}</h1>

        <p v-if="showRating || listing.reviewCount > 0 || locationLabel" class="listing-meta">
          <template v-if="showRating">
            <img src="/images/icons/star-solid.svg" alt="" class="listing-meta-star" />
            <span class="listing-meta-rating">{{ Number(listing.avgRating).toFixed(2) }}</span>
            <span v-if="listing.reviewCount > 0 || locationLabel" class="listing-meta-sep" aria-hidden="true">·</span>
          </template>
          <template v-if="listing.reviewCount > 0">
            <span>{{ reviewCountLabel }}</span>
            <span v-if="locationLabel" class="listing-meta-sep" aria-hidden="true">·</span>
          </template>
          <template v-if="locationLabel">
            <img src="/images/icons/pin-muted.svg" alt="" class="listing-meta-pin" />
            <span>{{ locationLabel }}</span>
          </template>
        </p>
      </div>

      <div v-if="listing.photos?.length" class="listing-gallery-wrap">
        <ListingGallery :photos="listing.photos || []" :title="listing.title" :video-url="listing.videoUrl" />
      </div>

      <div class="listing-split">
        <div class="listing-main">
          <div v-if="keyFacts.length" class="listing-facts">
            <template v-for="(fact, i) in keyFacts" :key="fact.key">
              <span v-if="i > 0" class="listing-facts-sep" aria-hidden="true" />
              <span class="listing-fact">
                <AttributeIcon :name="fact.key" :size="22" class="listing-fact-icon" />
                <span class="listing-fact-value">{{ fact.value }}</span>
                <span class="listing-fact-label">{{ fact.label }}</span>
              </span>
            </template>
          </div>

          <div v-if="keyFacts.length" class="listing-divider" />

          <div class="listing-owner-brief">
            <img v-if="listing.owner?.avatarUrl" :src="listing.owner.avatarUrl" alt="" class="listing-owner-brief-avatar" />
            <span v-else class="listing-owner-brief-avatar listing-avatar-initials">{{ ownerInitials }}</span>
            <span class="listing-owner-brief-text">
              <span class="listing-owner-brief-name">{{ t('listing.rentedBy', { name: ownerName }) }}</span>
              <span class="listing-owner-brief-sub">{{ ownerSubline }}</span>
            </span>
          </div>

          <div class="listing-divider" />

          <section v-if="listing.description" class="listing-section">
            <h2 class="listing-section-title">{{ t('listing.description') }}</h2>
            <p ref="descriptionEl" class="listing-description" :class="{ 'listing-description-clamped': !descriptionExpanded }">
              {{ listing.description }}
            </p>
            <button v-if="descriptionOverflows" type="button" class="listing-link-btn" @click="descriptionExpanded = !descriptionExpanded">
              {{ t(descriptionExpanded ? 'listing.showLess' : 'listing.showMore') }}
            </button>
          </section>

          <div v-if="listing.description" class="listing-divider" />

          <section v-if="detailAttributes.length" class="listing-section">
            <h2 class="listing-section-title">{{ t('listing.stepAttributes') }}</h2>
            <dl class="listing-table">
              <template v-for="(pair, i) in detailPairs" :key="i">
                <div v-if="i > 0" class="listing-table-divider" />
                <div class="listing-table-row">
                  <div v-for="attr in pair" :key="attr.id" class="listing-table-cell">
                    <dt class="listing-table-key">{{ attr.name }}</dt>
                    <dd class="listing-table-value">{{ formatAttrValue(attr) }}</dd>
                  </div>
                </div>
              </template>
            </dl>
          </section>

          <div v-if="detailAttributes.length" class="listing-divider" />

          <!-- T51 — one unified "Opremljenost" section for every CHECKBOX_GROUP
               attribute (Sadržaji, and for Vozila/Mašine Oprema + Priključci
               merged together) instead of a separate row per attribute. -->
          <section v-if="amenityItems.length" class="listing-section">
            <h2 class="listing-section-title">{{ t('listing.amenities') }}</h2>
            <ul class="listing-amenities">
              <li v-for="item in visibleAmenities" :key="item.name" class="listing-amenity">
                <AttributeIcon :name="item.key" :size="22" class="listing-amenity-icon" />
                <span>{{ item.name }}</span>
              </li>
            </ul>
            <button
              v-if="amenityItems.length > AMENITY_PREVIEW_COUNT"
              type="button"
              class="listing-ghost-btn listing-ghost-btn-wide"
              @click="amenitiesExpanded = !amenitiesExpanded"
            >
              {{ amenitiesExpanded ? t('listing.showLess') : t(`listing.showAllAmenities${srPluralCategory(amenityItems.length)}`, { count: amenityItems.length }) }}
            </button>
          </section>

          <div v-if="amenityItems.length" class="listing-divider" />

          <section v-if="hasCoordinates" class="listing-section">
            <h2 class="listing-section-title">{{ t('listing.stepLocation') }}</h2>
            <ClientOnly>
              <ListingLocationMap :latitude="listing.latitude" :longitude="listing.longitude" />
              <template #fallback><div class="listing-map-placeholder" /></template>
            </ClientOnly>
            <p class="listing-location-name">{{ locationLabel }}</p>
            <p class="listing-fine-print">{{ t('listing.approximateLocationNote') }}</p>
          </section>

          <div v-if="hasCoordinates" class="listing-divider" />

          <section v-if="bookingTermPairs.length || workingHoursRows.length" class="listing-section">
            <h2 class="listing-section-title">{{ t('listing.bookingTerms') }}</h2>
            <dl v-if="bookingTermPairs.length" class="listing-table">
              <template v-for="(pair, i) in bookingTermPairs" :key="i">
                <div v-if="i > 0" class="listing-table-divider" />
                <div class="listing-table-row">
                  <div v-for="term in pair" :key="term.label" class="listing-table-cell">
                    <dt class="listing-table-key">{{ term.label }}</dt>
                    <dd class="listing-table-value">{{ term.value }}</dd>
                  </div>
                </div>
              </template>
            </dl>

            <!-- Ticket §8 — a PER_SLOT listing's "dostupnost" is its weekly
                 opening schedule, the counterpart of the check-in/check-out
                 pair Figma shows for a PER_STAY one. -->
            <template v-if="workingHoursRows.length">
              <h3 class="listing-subsection-title">{{ t('listing.workingHours') }}</h3>
              <dl class="listing-table">
                <template v-for="(row, i) in workingHoursRows" :key="row.label">
                  <div v-if="i > 0" class="listing-table-divider" />
                  <div class="listing-table-row">
                    <div class="listing-table-cell">
                      <dt class="listing-table-key">{{ row.label }}</dt>
                      <dd class="listing-table-value">{{ row.value }}</dd>
                    </div>
                  </div>
                </template>
              </dl>
            </template>
          </section>

          <div v-if="bookingTermPairs.length || workingHoursRows.length" class="listing-divider" />

          <!-- The listing's own FAQs, not the platform-wide ones FaqAccordion
               loads — same open/close behaviour, its own data. -->
          <section v-if="listing.faqs?.length" class="listing-section">
            <h2 class="listing-section-title">{{ t('listing.faq') }}</h2>
            <div class="listing-faqs">
              <div v-for="faq in listing.faqs" :key="faq.id" class="listing-faq">
                <button
                  type="button"
                  class="listing-faq-question"
                  :aria-expanded="openFaqId === faq.id"
                  @click="openFaqId = openFaqId === faq.id ? null : faq.id"
                >
                  <span>{{ faq.question }}</span>
                  <img
                    :src="openFaqId === faq.id ? '/images/icons/faq-minus.svg' : '/images/icons/faq-plus.svg'"
                    alt=""
                    class="listing-faq-icon"
                  />
                </button>
                <p v-show="openFaqId === faq.id" class="listing-faq-answer">{{ faq.answer }}</p>
              </div>
            </div>
          </section>

          <div v-if="listing.faqs?.length" class="listing-divider" />

          <section class="listing-section">
            <h2 class="listing-section-title">{{ t('listing.reviewsHeading') }}</h2>

            <div v-if="showRating" class="listing-review-score">
              <img src="/images/icons/star-solid.svg" alt="" class="listing-review-score-star" />
              <span class="listing-review-score-value">{{ Number(listing.avgRating).toFixed(2) }}</span>
              <span class="listing-meta-sep" aria-hidden="true">·</span>
              <span class="listing-review-score-count">{{ reviewCountLabel }}</span>
            </div>

            <p v-if="!reviews?.length" class="listing-empty">{{ t('reviews.noReviewsYet') }}</p>

            <div v-else class="listing-review-list">
              <article v-for="review in visibleReviews" :key="review.id" class="listing-review">
                <div class="listing-review-author">
                  <img v-if="review.author?.avatarUrl" :src="review.author.avatarUrl" alt="" class="listing-review-avatar" />
                  <span v-else class="listing-review-avatar listing-avatar-initials">{{ initialsOf(review.author) }}</span>
                  <span class="listing-review-author-text">
                    <span class="listing-review-author-name">{{ shortName(review.author) }}</span>
                    <span class="listing-review-date">{{ formatMonthYear(review.publishedAt || review.createdAt) }}</span>
                  </span>
                </div>
                <p v-if="review.comment" class="listing-review-text">{{ review.comment }}</p>
                <p v-if="review.reply" class="listing-review-reply">{{ review.reply.content }}</p>
              </article>
            </div>

            <button
              v-if="reviews.length > REVIEW_PREVIEW_COUNT"
              type="button"
              class="listing-ghost-btn listing-ghost-btn-wide"
              @click="reviewsExpanded = !reviewsExpanded"
            >
              {{ reviewsExpanded ? t('listing.showLess') : t(`listing.showAllReviews${srPluralCategory(reviews.length)}`, { count: reviews.length }) }}
            </button>
          </section>

          <div class="listing-divider" />

          <section class="listing-section">
            <h2 class="listing-section-title">{{ t('listing.ownerHeading') }}</h2>
            <div class="listing-owner-card">
              <div class="listing-owner-head">
                <img v-if="listing.owner?.avatarUrl" :src="listing.owner.avatarUrl" alt="" class="listing-owner-avatar" />
                <span v-else class="listing-owner-avatar listing-avatar-initials">{{ ownerInitials }}</span>
                <span class="listing-owner-head-text">
                  <NuxtLink v-if="listing.owner?.profileSlug" :to="`/vlasnik/${listing.owner.profileSlug}`" class="listing-owner-name">
                    {{ ownerName }}
                  </NuxtLink>
                  <span v-else class="listing-owner-name">{{ ownerName }}</span>
                  <span class="listing-owner-sub">{{ ownerSubline }}</span>
                </span>
              </div>
              <p v-if="listing.owner?.avgResponseTimeMinutes" class="listing-owner-response">
                {{ t('listing.responseTime') }}: {{ responseTimeLabel }}
              </p>
              <NuxtLink
                v-if="listing.canMessage && !preview"
                :to="`/oglasi/${listing.slug}/poruka`"
                class="listing-ghost-btn listing-ghost-btn-wide"
              >
                {{ t('listing.sendMessageAction') }}
              </NuxtLink>
              <p v-if="listing.canMessage" class="listing-fine-print">{{ t('listing.phoneAfterConfirmation') }}</p>
              <a v-else-if="listing.owner?.phone" :href="`tel:${listing.owner.phone}`" class="listing-ghost-btn listing-ghost-btn-wide">
                {{ t('listing.callOwner') }}: {{ listing.owner.phone }}
              </a>
            </div>
          </section>
        </div>

        <aside class="listing-aside">
          <div class="listing-aside-sticky">
            <ListingBookingPanel :listing="listing" :availability="availability" :preview="preview" />

            <div v-if="cancellationLine" class="listing-cancellation">
              <p class="listing-cancellation-head">
                <img src="/images/icons/clock-circle.svg" alt="" class="listing-cancellation-icon" />
                {{ t('listing.cancellationHeading') }}
              </p>
              <div class="listing-cancellation-body">
                <p class="listing-cancellation-title">{{ cancellationLine }}</p>
                <p class="listing-cancellation-sub">{{ t('listing.cancellationAfterDeadline') }}</p>
              </div>
              <p class="listing-fine-print">{{ t('listing.noMoneyThroughPlatform') }}</p>
            </div>
          </div>
        </aside>
      </div>

      <section v-if="similarListings.length" class="listing-similar">
        <div class="listing-similar-head">
          <h2 class="listing-similar-title">
            {{ t('listing.similarListings') }}
            <span v-if="cityLocative" class="listing-similar-title-muted">{{ t('listing.inCity', { city: cityLocative }) }}</span>
          </h2>
          <NuxtLink :to="allListingsLink" class="listing-similar-all">
            {{ t('listing.seeAllListings') }}
            <img src="/images/icons/arrow-right-brand.svg" alt="" class="listing-similar-all-icon" />
          </NuxtLink>
        </div>
        <div class="listing-similar-grid">
          <ListingCard v-for="item in similarListings" :key="item.id" :listing="item" />
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
// Dizajn 11 (Figma "Oglas — PER_STAY · Desktop 1440", node 97:2) — the public
// listing page, also used by the wizard's "preview as guest" step (RNT-031) so
// the preview can never drift from what publishing actually looks like.
//
// Display rule from the ticket: a field the owner never filled in renders
// nothing at all — no empty row, no dash — hence the v-ifs around every block
// rather than a placeholder value.
const props = defineProps({
  listing: { type: Object, required: true },
  reviews: { type: Array, default: () => [] },
  preview: { type: Boolean, default: false },
})

const AMENITY_PREVIEW_COUNT = 10
const REVIEW_PREVIEW_COUNT = 2

const { t, locale } = useI18n()
const api = useApi()
const auth = useAuthStore()
const favoritesStore = useFavoritesStore()

// -- Header ---------------------------------------------------------------

// R102 — an average only means something from three reviews on.
const showRating = computed(() => Number(props.listing.reviewCount) >= 3 && props.listing.avgRating != null)

const reviewCountLabel = computed(() =>
  t(`listing.reviewsCount${srPluralCategory(props.listing.reviewCount)}`, { count: props.listing.reviewCount }),
)

const locationLabel = computed(() =>
  [props.listing.cityArea?.name, props.listing.city?.name].filter(Boolean).join(', '),
)

const togglingFavorite = ref(false)
const isFavorited = computed(() => favoritesStore.isFavorited(props.listing.id))

if (!props.preview) {
  favoritesStore.ensureLoaded()
}

async function toggleFavorite() {
  if (!auth.isAuthenticated) {
    await navigateTo(`/prijava?redirect=/oglasi/${props.listing.slug}`)
    return
  }
  togglingFavorite.value = true
  try {
    await favoritesStore.toggle(props.listing.id)
  } finally {
    togglingFavorite.value = false
  }
}

// navigator.share is the native sheet on mobile; everywhere else copying the
// link is the useful equivalent, and the button says so once it has happened.
const shareCopied = ref(false)
async function share() {
  const url = window.location.href
  if (navigator.share) {
    await navigator.share({ title: props.listing.title, url }).catch(() => undefined)
    return
  }
  await navigator.clipboard?.writeText(url).catch(() => undefined)
  shareCopied.value = true
  setTimeout(() => (shareCopied.value = false), 2000)
}

// -- Owner ----------------------------------------------------------------

const ownerName = computed(() => {
  const owner = props.listing.owner
  if (!owner) return ''
  const lastInitial = owner.lastName ? `${owner.lastName.charAt(0)}.` : ''
  return [owner.firstName, lastInitial].filter(Boolean).join(' ')
})

const ownerInitials = computed(() => initialsOf(props.listing.owner))

const ownerSubline = computed(() => {
  const owner = props.listing.owner
  if (!owner) return ''
  const parts = []
  if (owner.createdAt) parts.push(t('listing.memberSinceYear', { year: new Date(owner.createdAt).getFullYear() }))
  if (owner.listingCount) {
    parts.push(t(`listing.ownerListingCount${srPluralCategory(owner.listingCount)}`, { count: owner.listingCount }))
  }
  return parts.join(' · ')
})

const responseTimeLabel = computed(() => {
  const minutes = props.listing.owner?.avgResponseTimeMinutes
  if (!minutes) return ''
  if (minutes < 60) return t('listing.responseWithinMinutes', { count: minutes })
  return t('listing.responseWithinHours', { count: Math.round(minutes / 60) })
})

function initialsOf(person) {
  if (!person) return ''
  return [person.firstName, person.lastName]
    .filter(Boolean)
    .map((part) => part.charAt(0).toLocaleUpperCase('sr-RS'))
    .join('')
}

function shortName(person) {
  if (!person) return ''
  const lastInitial = person.lastName ? `${person.lastName.charAt(0)}.` : ''
  return [person.firstName, lastInitial].filter(Boolean).join(' ')
}

function formatMonthYear(value) {
  if (!value) return ''
  // Plain 'sr-RS' resolves to Cyrillic; the platform is Latin throughout, so
  // the script has to be spelled out (same tag as listing.calendarLocale).
  const formatted = new Intl.DateTimeFormat(locale.value === 'en' ? 'en-GB' : 'sr-Latn-RS', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(value))
  return formatted.charAt(0).toLocaleUpperCase('sr-RS') + formatted.slice(1)
}

// -- Body sections --------------------------------------------------------

const keyFacts = computed(() => getListingKeyFacts(props.listing))

// Whether the clamp actually cut anything off depends on the column width, not
// on how many characters the owner wrote — a description that fits on desktop
// still overflows eight lines on a phone, and it used to be silently truncated
// there with no way to open it.
const descriptionEl = ref(null)
const descriptionExpanded = ref(false)
const descriptionOverflows = ref(false)

function measureDescription() {
  const el = descriptionEl.value
  if (!el || descriptionExpanded.value) return
  descriptionOverflows.value = el.scrollHeight > el.clientHeight + 1
}

// Dizajn 25: utils/listingAttributes.js decides which attributes are Detalji rows and
// which are Opremljenost items, so the wizard's step Detalji previews the same rows.
const detailAttributes = computed(() => getDetailAttributes(props.listing.attributes, t))

// Figma lays the table out as two 350px cells per row, so the flat list is
// chunked here rather than relying on a wrapping grid that would break the
// row dividers.
const detailPairs = computed(() => chunkPairs(detailAttributes.value))

const amenityItems = computed(() => getAmenityItems(props.listing.attributes))

const amenitiesExpanded = ref(false)
const visibleAmenities = computed(() =>
  amenitiesExpanded.value ? amenityItems.value : amenityItems.value.slice(0, AMENITY_PREVIEW_COUNT),
)

const reviewsExpanded = ref(false)
const visibleReviews = computed(() =>
  reviewsExpanded.value ? props.reviews : props.reviews.slice(0, REVIEW_PREVIEW_COUNT),
)

const hasCoordinates = computed(() => props.listing.latitude != null && props.listing.longitude != null)

const openFaqId = ref(null)

function formatAttrValue(attr) {
  return formatAttributeValue(attr, t)
}

function chunkPairs(items) {
  const pairs = []
  for (let i = 0; i < items.length; i += 2) pairs.push(items.slice(i, i + 2))
  return pairs
}

// -- Booking terms --------------------------------------------------------

const availability = ref(null)
const WEEKDAY_KEYS = ['dayMon', 'dayTue', 'dayWed', 'dayThu', 'dayFri', 'daySat', 'daySun']

const bookingTerms = computed(() => {
  const l = props.listing
  const rows = []
  if (l.pickupTime) rows.push({ label: t('listing.termArrival'), value: t('listing.termFromTime', { time: l.pickupTime }) })
  if (l.returnTime) rows.push({ label: t('listing.termDeparture'), value: t('listing.termUntilTime', { time: l.returnTime }) })
  // Dizajn 23: a defined slot has its own length, so neither the duration nor the
  // gap applies to it, and working hours count in hours even when priced per guest.
  const durationRules = !isDefinedSlotsListing(l)
  const durationUnit = getDurationUnit(l)
  if (durationRules && l.minDuration) {
    rows.push({
      label: t('listing.minDuration'),
      value: `${l.minDuration} ${srDurationUnitWord(durationUnit, l.minDuration)}`,
    })
  }
  if (durationRules && l.maxDuration) {
    rows.push({
      label: t('listing.maxDuration'),
      value: `${l.maxDuration} ${srDurationUnitWord(durationUnit, l.maxDuration)}`,
    })
  }
  if (durationRules && l.gapAfterMinutes) {
    rows.push({ label: t('listing.termGapAfter'), value: formatMinutes(l.gapAfterMinutes) })
  }
  if (l.earliestBookingHours) {
    rows.push({ label: t('listing.termEarliest'), value: durationLabel('termHours', l.earliestBookingHours) })
  }
  if (l.maxAdvanceBookingDays) {
    rows.push({ label: t('listing.termHorizon'), value: durationLabel('termDays', l.maxAdvanceBookingDays) })
  }
  const guestCap = maxGuestCap.value
  if (guestCap) rows.push({ label: t('listing.termGuests'), value: t('listing.termAtMost', { count: guestCap }) })
  return rows
})

const bookingTermPairs = computed(() => chunkPairs(bookingTerms.value))

// Dizajn 23: the lower of "Maks. broj gostiju" and the capacity from step Detalji.
const maxGuestCap = computed(() => getGuestCap(props.listing))

// One row per weekday the owner actually opened, with several windows on the
// same day joined rather than repeated as separate rows.
const workingHoursRows = computed(() => {
  const hours = availability.value?.workingHours ?? []
  if (!hours.length) return []
  const byDay = new Map()
  for (const entry of hours) {
    const list = byDay.get(entry.dayOfWeek) ?? []
    list.push(`${entry.startsAt}–${entry.endsAt}`)
    byDay.set(entry.dayOfWeek, list)
  }
  return [...byDay.keys()]
    .sort((a, b) => a - b)
    .map((day) => ({ label: t(`listing.${WEEKDAY_KEYS[day - 1]}`), value: byDay.get(day).join(', ') }))
})

// Serbian declines the unit noun with the number in front of it ("1 dan",
// "2 dana", "5 dana"), so every duration goes through the shared category.
function durationLabel(key, count) {
  return t(`listing.${key}${srPluralCategory(count)}`, { count })
}

function formatMinutes(minutes) {
  if (minutes % (60 * 24) === 0) return durationLabel('termDays', minutes / (60 * 24))
  if (minutes % 60 === 0) return durationLabel('termHours', minutes / 60)
  return durationLabel('termMinutes', minutes)
}

const cancellationLine = computed(() =>
  cancellationPolicyText(t, props.listing.cancellationPolicyType, props.listing.cancellationThreshold),
)

// -- Similar listings -----------------------------------------------------

const similarListings = ref([])
const cityLocative = computed(() => props.listing.city?.nameLocative || props.listing.city?.name || '')

const allListingsLink = computed(() => {
  const query = new URLSearchParams({ categorySlug: props.listing.category.slug })
  if (props.listing.city?.id) query.set('cityId', props.listing.city.id)
  return `/pretraga?${query.toString()}`
})

onMounted(async () => {
  measureDescription()
  window.addEventListener('resize', measureDescription)

  const [similar, avail] = await Promise.all([
    props.preview ? Promise.resolve(null) : api.get(`/search/similar?slug=${props.listing.slug}`).catch(() => null),
    api.get(`/listings/${props.listing.id}/availability`).catch(() => null),
  ])
  similarListings.value = similar?.results ?? []
  availability.value = avail
})

onBeforeUnmount(() => window.removeEventListener('resize', measureDescription))
</script>

<style lang="scss" scoped>
.listing-page {
  padding-bottom: 72px;
}

.preview-banner {
  margin-top: 24px;
  background: $color-background;
  border: 1px solid $color-border;
  border-radius: $radius-button;
  padding: 10px 16px;
  font-size: $font-size-label;
}

// -- Header ---------------------------------------------------------------

.listing-breadcrumb {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 28px;
  font-size: 14px;
  color: $color-text-muted;
}

.listing-breadcrumb a {
  color: $color-text-muted;
}

.listing-breadcrumb a:hover {
  color: $color-primary;
}

.listing-breadcrumb-current {
  font-weight: 500;
  color: $color-text;
}

.listing-title-block {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-top: 22px;
}

.listing-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.listing-category-pill {
  display: inline-flex;
  align-items: center;
  height: 42px;
  padding: 0 18px;
  border-radius: $radius-button;
  background: $color-accent-tint;
  color: $color-primary;
  font-size: 14px;
  font-weight: 500;
}

.listing-actions {
  display: flex;
  gap: 10px;
}

.listing-ghost-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 44px;
  padding: 0 18px;
  border: 0;
  border-radius: 8px;
  background: $color-background;
  color: $color-text;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease;
}

.listing-ghost-btn:hover {
  background: $color-accent-tint;
}

.listing-ghost-btn-active {
  color: $color-primary;
}

.listing-ghost-btn-wide {
  align-self: flex-start;
  padding: 0 22px;
}

.listing-ghost-icon {
  width: 18px;
  height: 18px;
}

// Figma 99:23 — 40/46 with -1.4px tracking. Deliberately not .text-page-title
// (48/56): the listing title sits above a full-width gallery and gets its own
// step on the scale.
.listing-title {
  font-size: 40px;
  font-weight: 400;
  line-height: 46px;
  letter-spacing: -1.4px;
  color: $color-text;
}

.listing-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 15px;
  color: $color-text-muted;
}

.listing-meta-rating {
  font-weight: 500;
  color: $color-text;
}

.listing-meta-star {
  width: 15px;
  height: 15px;
}

.listing-meta-pin {
  width: 15px;
  height: 15px;
}

.listing-gallery-wrap {
  padding-top: 30px;
}

// -- Split ----------------------------------------------------------------

.listing-split {
  display: grid;
  grid-template-columns: 760fr 400fr;
  column-gap: 56px;
  padding-top: 46px;
  align-items: start;
}

.listing-main {
  min-width: 0;
}

.listing-aside {
  min-width: 0;
}

.listing-aside-sticky {
  position: sticky;
  top: 128px; // 104px sticky header + 24px breathing room
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.listing-divider {
  height: 1px;
  background: $color-border;
}

.listing-section {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 18px;
  padding: 34px 0;
}

.listing-section-title {
  font-size: 20px;
  font-weight: 500;
  line-height: 1.25;
  color: $color-text;
}

.listing-subsection-title {
  font-size: 16px;
  font-weight: 500;
  color: $color-text;
}

.listing-empty {
  font-size: $font-size-body;
  color: $color-text-muted;
}

.listing-fine-print {
  font-size: 12px;
  font-weight: 300;
  line-height: 18px;
  color: $color-text-muted;
}

.listing-link-btn {
  padding: 0;
  border: 0;
  background: none;
  color: $color-primary;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
}

// -- Key facts ------------------------------------------------------------

.listing-facts {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 18px 8px;
}

.listing-fact {
  flex: 1 0 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 2px 0;
  text-align: center;
}

.listing-fact-icon {
  color: $color-text;
}

.listing-fact-value {
  font-size: 17px;
  font-weight: 600;
  color: $color-text;
}

.listing-fact-label {
  font-size: 12px;
  color: $color-text-muted;
}

.listing-facts-sep {
  width: 1px;
  height: 40px;
  flex-shrink: 0;
  background: $color-border;
}

// -- Owner ----------------------------------------------------------------

.listing-owner-brief {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 26px 0 30px;
}

.listing-owner-brief-avatar {
  width: 48px;
  height: 48px;
  border-radius: $radius-pill;
  object-fit: cover;
  flex-shrink: 0;
}

.listing-owner-brief-text {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.listing-owner-brief-name {
  font-size: 16px;
  font-weight: 500;
  color: $color-text;
}

.listing-owner-brief-sub {
  font-size: 14px;
  color: $color-text-muted;
}

.listing-avatar-initials {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #f1f4f8;
  color: $color-text-muted;
  font-size: 14px;
  font-weight: 500;
}

.listing-owner-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 18px;
  width: 100%;
  padding: 26px 28px;
  border: 1px solid $color-border;
  border-radius: $radius-card;
  background: $color-surface;
}

.listing-owner-head {
  display: flex;
  align-items: center;
  gap: 16px;
}

.listing-owner-avatar {
  width: 64px;
  height: 64px;
  border-radius: $radius-pill;
  object-fit: cover;
  flex-shrink: 0;
  font-size: 18px;
}

.listing-owner-head-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.listing-owner-name {
  font-size: 20px;
  font-weight: 500;
  color: $color-text;
}

.listing-owner-sub,
.listing-owner-response {
  font-size: 14px;
  color: $color-text-muted;
}

// -- Description ----------------------------------------------------------

.listing-description {
  font-size: 16px;
  line-height: 26px;
  color: $color-text-muted;
  white-space: pre-line;
  max-width: 700px;
}

.listing-description-clamped {
  display: -webkit-box;
  -webkit-line-clamp: 8;
  line-clamp: 8;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

// -- Two-column tables ----------------------------------------------------

.listing-table {
  width: 100%;
  margin: 0;
}

.listing-table-row {
  display: flex;
  gap: 60px;
  padding: 13px 0;
}

.listing-table-cell {
  flex: 1 0 0;
  min-width: 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  font-size: 15px;
}

.listing-table-key {
  color: $color-text-muted;
}

.listing-table-value {
  margin: 0;
  font-weight: 500;
  color: $color-text;
  text-align: right;
}

.listing-table-divider {
  height: 1px;
  background: #f1f4f8;
}

// -- Amenities ------------------------------------------------------------

.listing-amenities {
  list-style: none;
  margin: 0;
  padding: 0;
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr;
  column-gap: 60px;
}

.listing-amenity {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  font-size: 15px;
  color: $color-text;
}

.listing-amenity-icon {
  color: $color-text;
}

// -- Location -------------------------------------------------------------

.listing-map-placeholder {
  width: 100%;
  height: 300px;
  border-radius: $radius-card;
  background: $color-background;
}

.listing-location-name {
  font-size: 16px;
  font-weight: 500;
  color: $color-text;
}

// -- Listing FAQs ---------------------------------------------------------

.listing-faqs {
  width: 100%;
  display: flex;
  flex-direction: column;
}

.listing-faq + .listing-faq {
  border-top: 1px solid #f1f4f8;
}

.listing-faq-question {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
  padding: 16px 0;
  border: 0;
  background: none;
  color: $color-text;
  font-size: 16px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
}

.listing-faq-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.listing-faq-answer {
  padding: 0 0 16px;
  font-size: 15px;
  line-height: 24px;
  color: $color-text-muted;
  white-space: pre-line;
}

// -- Reviews --------------------------------------------------------------

.listing-review-score {
  display: flex;
  align-items: center;
  gap: 10px;
}

.listing-review-score-star {
  width: 20px;
  height: 20px;
}

.listing-review-score-value {
  font-size: 26px;
  font-weight: 500;
  color: $color-text;
}

.listing-review-score-count {
  font-size: 16px;
  color: $color-text-muted;
}

.listing-review-list {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  padding-top: 6px;
}

.listing-review {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px 22px;
  border: 1px solid $color-border;
  border-radius: $radius-card;
  background: $color-surface;
}

.listing-review-author {
  display: flex;
  align-items: center;
  gap: 12px;
}

.listing-review-avatar {
  width: 40px;
  height: 40px;
  border-radius: $radius-pill;
  object-fit: cover;
  flex-shrink: 0;
}

.listing-review-author-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.listing-review-author-name {
  font-size: 15px;
  font-weight: 500;
  color: $color-text;
}

.listing-review-date {
  font-size: 13px;
  color: $color-text-muted;
}

.listing-review-text {
  font-size: 15px;
  line-height: 24px;
  color: $color-text-muted;
}

.listing-review-reply {
  padding-left: 12px;
  border-left: 2px solid $color-border;
  font-size: 14px;
  line-height: 22px;
  color: $color-text-muted;
}

// -- Cancellation ---------------------------------------------------------

.listing-cancellation {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px 22px;
  border: 1px solid $color-border;
  border-radius: $radius-card;
  background: $color-surface;
}

.listing-cancellation-head {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 500;
  color: $color-text;
}

.listing-cancellation-icon {
  width: 20px;
  height: 20px;
}

.listing-cancellation-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 13px 16px;
  border-radius: $radius-button;
  background: $color-background;
}

.listing-cancellation-title {
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  color: $color-text;
}

.listing-cancellation-sub {
  font-size: 12px;
  font-weight: 300;
  line-height: 18px;
  color: $color-text-muted;
}

// -- Similar listings -----------------------------------------------------

.listing-similar {
  padding-top: 72px;
}

.listing-similar-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.listing-similar-title {
  font-size: 34px;
  font-weight: 400;
  line-height: 1.25;
  letter-spacing: -1.19px;
  color: $color-text;
}

.listing-similar-title-muted {
  color: $color-text-muted;
}

.listing-similar-all {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 500;
  color: #101a30;
  white-space: nowrap;
}

.listing-similar-all-icon {
  width: 16px;
  height: 16px;
}

.listing-similar-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 32px;
  padding-top: 30px;
}

// -- Responsive -----------------------------------------------------------

@include respond-below(lg) {
  .listing-split {
    grid-template-columns: 1fr;
    row-gap: 32px;
  }

  .listing-aside-sticky {
    position: static;
  }

  .listing-similar-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 24px;
  }
}

@include respond-below(md) {
  .listing-title {
    font-size: 28px;
    line-height: 34px;
    letter-spacing: -0.6px;
  }

  .listing-title-row {
    flex-wrap: wrap;
  }

  .listing-facts {
    flex-wrap: wrap;
    row-gap: 18px;
  }

  .listing-facts-sep {
    display: none;
  }

  .listing-fact {
    flex: 0 0 33.333%;
  }

  .listing-table-row {
    flex-direction: column;
    gap: 0;
    padding: 0;
  }

  .listing-table-cell {
    padding: 13px 0;
  }

  .listing-amenities,
  .listing-review-list {
    grid-template-columns: 1fr;
  }

  .listing-similar {
    padding-top: 48px;
  }

  .listing-similar-title {
    font-size: 26px;
    letter-spacing: -0.8px;
  }

  .listing-similar-grid {
    grid-template-columns: 1fr;
  }
}
</style>
