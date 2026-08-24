<template>
  <div class="listing-page">
    <div class="container py-4">
      <p v-if="preview" class="preview-banner mb-3">{{ t('listing.previewBanner') }}</p>

      <div class="breadcrumb-row mb-3">
        <nav class="breadcrumbs text-muted">
          <NuxtLink :to="`/${listing.category.slug}`">{{ listing.category.name }}</NuxtLink>
          <span> / </span>
          <span>{{ listing.city?.name }}</span>
        </nav>
        <button
          v-if="!preview"
          type="button"
          class="favorite-btn"
          :class="{ 'favorite-btn-active': isFavorited }"
          :disabled="togglingFavorite"
          :aria-label="t(isFavorited ? 'listing.unsaveListing' : 'listing.saveListing')"
          @click="toggleFavorite"
        >
          <FontAwesomeIcon icon="heart" />
          {{ t(isFavorited ? 'listing.savedListing' : 'listing.saveListing') }}
        </button>
      </div>

      <h1 class="text-page-title mb-2">{{ listing.title }}</h1>
      <p class="text-muted mb-4">
        {{ listing.city?.name }}<span v-if="listing.cityArea">, {{ listing.cityArea.name }}</span>
        <span v-if="listing.reviewCount > 0">
          ·
          <span v-if="listing.reviewCount >= 3">★ {{ Number(listing.avgRating).toFixed(1) }}</span>
          ({{ listing.reviewCount }} {{ t('listing.reviews') }})
        </span>
      </p>

      <div class="row">
        <div class="col-12 col-lg-8">
          <div class="listing-gallery mb-4">
            <img
              v-if="listing.photos?.length"
              :src="listing.photos[activePhoto]?.url"
              :alt="listing.photos[activePhoto]?.altText || listing.title"
              class="listing-gallery-main"
            />
            <div v-if="listing.photos?.length > 1" class="listing-gallery-thumbs">
              <img
                v-for="(photo, i) in listing.photos"
                :key="photo.id"
                :src="photo.url"
                :alt="photo.altText || ''"
                :class="{ 'listing-thumb-active': i === activePhoto }"
                class="listing-thumb"
                @click="activePhoto = i"
              />
            </div>
          </div>

          <section class="mb-4">
            <p class="text-body listing-description">{{ listing.description }}</p>
          </section>

          <!-- T55 — the wizard's "Video (YouTube link)" field saved fine but
               nothing on the public page ever read it back. -->
          <section v-if="youtubeEmbedUrl" class="mb-4">
            <h2 class="text-section-title mb-3">{{ t('listing.videoSection') }}</h2>
            <div class="listing-video-wrap">
              <iframe
                :src="youtubeEmbedUrl"
                class="listing-video-frame"
                title="YouTube video"
                frameborder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen
              ></iframe>
            </div>
          </section>

          <section v-if="listing.attributes?.length" class="mb-4">
            <h2 class="text-section-title mb-3">{{ t('listing.stepAttributes') }}</h2>
            <div class="row">
              <div v-for="attr in listing.attributes.filter((a) => a.value)" :key="attr.id" class="col-6 col-md-4 mb-2">
                <span class="text-muted">{{ attr.name }}:</span>
                <strong> {{ formatAttrValue(attr) }}</strong>
              </div>
            </div>
          </section>

          <section v-if="listing.faqs?.length" class="mb-4">
            <h2 class="text-section-title mb-3">{{ t('listing.faq') }}</h2>
            <div v-for="faq in listing.faqs" :key="faq.id" class="mb-3">
              <p class="text-body"><strong>{{ faq.question }}</strong></p>
              <p class="text-muted">{{ faq.answer }}</p>
            </div>
          </section>

          <section class="mb-4">
            <h2 class="text-section-title mb-3">{{ t('listing.reviews') }}</h2>
            <p v-if="!reviews?.length" class="text-muted">{{ t('reviews.noReviewsYet') }}</p>
            <div v-for="review in reviews" :key="review.id" class="mb-3 card">
              <div class="card-body-sm">
                <p class="text-body">★ {{ review.rating }}/5 — {{ review.author?.firstName }}</p>
                <p v-if="review.comment" class="text-muted">{{ review.comment }}</p>
                <p v-if="review.reply" class="text-muted owner-reply">↳ {{ review.reply.content }}</p>
              </div>
            </div>
          </section>
        </div>

        <div class="col-12 col-lg-4">
          <div class="card mb-3">
            <div class="card-body">
              <p class="text-page-title mb-1">
                {{ formatPrice(listing.price) }}
                <span class="text-muted text-body"> / {{ t(`listing.unit${unitLabel(listing.priceUnit)}`) }}</span>
              </p>
              <button v-if="preview" type="button" class="btn btn-primary-flat btn-block mt-3" disabled>
                {{ ctaLabel }}
              </button>
              <template v-else>
                <NuxtLink
                  v-if="showBookingCta"
                  :to="`/oglasi/${listing.slug}/rezervisi`"
                  class="btn btn-primary-flat btn-block mt-3"
                >
                  {{ t('listing.sendRequest') }}
                </NuxtLink>
                <NuxtLink v-else-if="listing.canMessage" :to="`/oglasi/${listing.slug}/poruka`" class="btn btn-primary-flat btn-block mt-3">
                  {{ t('listing.contactOwner') }}
                </NuxtLink>
                <a v-else-if="listing.owner?.phone" :href="`tel:${listing.owner.phone}`" class="btn btn-primary-flat btn-block mt-3">
                  {{ t('listing.callOwner') }}: {{ listing.owner.phone }}
                </a>
                <p v-else class="text-muted mt-3 mb-0">{{ t('listing.contactUnavailable') }}</p>
              </template>
            </div>
          </div>

          <div class="card">
            <div class="card-body owner-card">
              <img v-if="listing.owner?.avatarUrl" :src="listing.owner.avatarUrl" alt="" class="owner-avatar" />
              <div>
                <NuxtLink v-if="listing.owner?.profileSlug" :to="`/vlasnik/${listing.owner.profileSlug}`" class="text-body">
                  <strong>{{ listing.owner?.firstName }} {{ listing.owner?.lastName }}</strong>
                </NuxtLink>
                <span v-else class="text-body"><strong>{{ listing.owner?.firstName }} {{ listing.owner?.lastName }}</strong></span>
                <p class="text-muted mb-0">
                  {{ t('listing.memberSince') }} {{ new Date(listing.owner?.createdAt).getFullYear() }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
// Shared between the public listing page and the wizard's "preview as
// guest" step (RNT-031) — the whole point of reusing this component is that
// the preview can never drift from what publishing will actually look like.
const props = defineProps({
  listing: { type: Object, required: true },
  reviews: { type: Array, default: () => [] },
  preview: { type: Boolean, default: false },
})

const { t } = useI18n()
const auth = useAuthStore()
const favoritesStore = useFavoritesStore()
const activePhoto = ref(0)

// T53 — no page anywhere could actually add to "Sačuvano" (Kontrolna tabla
// → Sačuvano already existed as a list view, GET /users/me/favorites and
// the favorite endpoints already existed backend-side, but nothing in the
// UI ever called them). Only checked for logged-in, non-preview viewing —
// the preview step already disables every other CTA the same way.
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

// The listing's bookingModel is the owner's preference; canBook/canMessage
// reflect what the listing's current package actually supports (Osnovni/
// BASIC has neither) — both must hold before the guest is offered a CTA
// the backend would otherwise reject.
const showBookingCta = computed(() => props.listing.bookingModel !== 'NO_BOOKING' && props.listing.canBook)
const ctaLabel = computed(() => {
  if (showBookingCta.value) return t('listing.sendRequest')
  if (props.listing.canMessage) return t('listing.contactOwner')
  if (props.listing.owner?.phone) return t('listing.callOwner')
  return t('listing.contactUnavailable')
})

// Handles youtube.com/watch?v=, youtu.be/, and youtube.com/embed/ links —
// whatever an owner is likely to paste from the address bar or share button.
const youtubeEmbedUrl = computed(() => {
  const url = props.listing.videoUrl
  if (!url) return null
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/)
  return match ? `https://www.youtube.com/embed/${match[1]}` : null
})

function formatPrice(value) {
  return new Intl.NumberFormat('sr-RS').format(value || 0) + ' RSD'
}

function unitLabel(unit) {
  return unit ? unit.charAt(0) + unit.slice(1).toLowerCase() : ''
}

function formatAttrValue(attr) {
  const v = attr.value
  if (!v) return ''
  if (v.valueBoolean !== null && v.valueBoolean !== undefined) return v.valueBoolean ? t('common.yes') : t('common.no')
  if (v.valueNumber !== null && v.valueNumber !== undefined) return `${v.valueNumber}${attr.unit ? ' ' + attr.unit : ''}`
  return v.valueText || ''
}
</script>

<style lang="scss" scoped>
.preview-banner {
  background: $color-background;
  border: 1px solid $color-border;
  border-radius: $radius-button;
  padding: 10px 16px;
  font-size: $font-size-label;
}

.breadcrumb-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.favorite-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid $color-border;
  border-radius: $radius-button;
  background: $color-surface;
  color: $color-text-muted;
  font-size: $font-size-label;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}

.favorite-btn:hover {
  border-color: $color-primary;
  color: $color-primary;
}

.favorite-btn-active {
  border-color: $color-primary;
  color: $color-primary;
}

.listing-video-wrap {
  position: relative;
  width: 100%;
  padding-top: 56.25%;
  border-radius: $radius-card;
  overflow: hidden;
}

.listing-video-frame {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
}

.listing-gallery-main {
  width: 100%;
  height: 420px;
  object-fit: cover;
  border-radius: $radius-card;
}

.listing-gallery-thumbs {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  overflow-x: auto;
}

.listing-thumb {
  width: 80px;
  height: 60px;
  object-fit: cover;
  border-radius: $radius-input;
  cursor: pointer;
  opacity: 0.6;
}

.listing-thumb-active {
  opacity: 1;
  outline: 2px solid $color-primary;
}

.listing-description {
  white-space: pre-line;
}

.owner-card {
  display: flex;
  align-items: center;
  gap: 12px;
}

.owner-avatar {
  width: 48px;
  height: 48px;
  border-radius: $radius-pill;
  object-fit: cover;
}

.owner-reply {
  padding-left: 12px;
  border-left: 2px solid $color-border;
}
</style>
