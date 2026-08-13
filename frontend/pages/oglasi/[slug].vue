<template>
  <div v-if="listing" class="listing-page">
    <div class="container py-4">
      <nav class="breadcrumbs text-muted mb-3">
        <NuxtLink :to="`/${listing.category.slug}`">{{ listing.category.name }}</NuxtLink>
        <span> / </span>
        <span>{{ listing.city?.name }}</span>
      </nav>

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
              <NuxtLink
                v-if="listing.bookingModel !== 'NO_BOOKING'"
                :to="`/oglasi/${listing.slug}/rezervisi`"
                class="btn btn-primary-flat btn-block mt-3"
              >
                {{ t('listing.sendRequest') }}
              </NuxtLink>
              <NuxtLink v-else :to="`/oglasi/${listing.slug}/poruka`" class="btn btn-primary-flat btn-block mt-3">
                {{ t('listing.contactOwner') }}
              </NuxtLink>
            </div>
          </div>

          <div class="card">
            <div class="card-body owner-card">
              <img v-if="listing.owner?.avatarUrl" :src="listing.owner.avatarUrl" alt="" class="owner-avatar" />
              <div>
                <NuxtLink :to="`/vlasnik/${listing.owner?.profileSlug}`" class="text-body">
                  <strong>{{ listing.owner?.firstName }} {{ listing.owner?.lastName }}</strong>
                </NuxtLink>
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
  <div v-else class="container py-6">
    <p class="text-muted">{{ t('listing.noResults') }}</p>
  </div>
</template>

<script setup>
const { t } = useI18n()
const api = useApi()
const route = useRoute()
const activePhoto = ref(0)

const { data: listing } = await useAsyncData(`listing-${route.params.slug}`, async () => {
  try {
    return await api.get(`/listings/public/${route.params.slug}`)
  } catch {
    return null
  }
})

if (!listing.value) {
  throw createError({ statusCode: 404, statusMessage: 'Listing not found' })
}

const { data: reviews } = await useAsyncData(`listing-reviews-${route.params.slug}`, () =>
  api.get(`/listings/${listing.value.id}/reviews`),
)

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

useSeoMeta({
  title: () => listing.value?.title,
  description: () => listing.value?.description?.slice(0, 160),
  ogTitle: () => listing.value?.title,
  ogImage: () => listing.value?.photos?.[0]?.url,
})

// Structured data (Ch.14.4) — Product schema is the closest fit for a
// priced, bookable listing without inventing a custom vocabulary.
useHead(() => ({
  script: listing.value
    ? [
        {
          type: 'application/ld+json',
          innerHTML: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: listing.value.title,
            description: listing.value.description,
            image: listing.value.photos?.map((p) => p.url) ?? [],
            offers: {
              '@type': 'Offer',
              price: listing.value.price,
              priceCurrency: 'RSD',
            },
            ...(listing.value.reviewCount > 0
              ? {
                  aggregateRating: {
                    '@type': 'AggregateRating',
                    ratingValue: listing.value.avgRating,
                    reviewCount: listing.value.reviewCount,
                  },
                }
              : {}),
          }),
        },
      ]
    : [],
}))
</script>

<style lang="scss" scoped>
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
