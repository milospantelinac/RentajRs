<template>
  <div v-if="profile" class="container py-4">
    <div class="row">
      <div class="col-12 col-md-4 mb-4">
        <div class="card">
          <div class="card-body owner-profile">
            <img v-if="profile.avatarUrl" :src="profile.avatarUrl" alt="" class="owner-profile-avatar" />
            <span v-else class="owner-profile-avatar owner-profile-avatar-placeholder">
              {{ profile.firstName?.[0] }}{{ profile.lastName?.[0] }}
            </span>
            <h1 class="text-section-title mt-3">{{ profile.firstName }} {{ profile.lastName }}</h1>
            <p v-if="profile.avgRating" class="text-muted">★ {{ profile.avgRating.toFixed(1) }} ({{ profile.reviewCount }} {{ t('listing.reviews') }})</p>
            <p class="text-muted">{{ t('listing.memberSince') }} {{ new Date(profile.createdAt).getFullYear() }}</p>
            <p v-if="profile.avgResponseTimeMinutes" class="text-muted">
              {{ t('listing.responseTime') }}: {{ profile.avgResponseTimeMinutes }} min
            </p>
          </div>
        </div>
      </div>

      <div class="col-12 col-md-8">
        <h2 class="text-section-title mb-3">{{ t('listing.myListings') }}</h2>
        <div class="row">
          <div v-for="l in profile.listings" :key="l.id" class="col-6 col-md-4 mb-3">
            <NuxtLink :to="`/oglasi/${l.slug}`" class="card card-interactive listing-tile">
              <img v-if="l.photos?.[0]" :src="l.photos[0].url" :alt="l.photos[0].altText || ''" class="listing-tile-img" />
              <div class="card-body-sm">
                <p class="text-body">{{ l.title }}</p>
                <p class="text-muted">{{ new Intl.NumberFormat('sr-RS').format(l.price) }} RSD</p>
              </div>
            </NuxtLink>
          </div>
        </div>

        <h2 class="text-section-title mt-4 mb-3">{{ t('listing.reviews') }}</h2>
        <p v-if="!profile.reviewsReceived?.length" class="text-muted">{{ t('reviews.noReviewsYet') }}</p>
        <div v-for="review in profile.reviewsReceived" :key="review.id" class="mb-3 card">
          <div class="card-body-sm">
            <p class="text-body">★ {{ review.rating }}/5 — {{ review.author?.firstName }}</p>
            <p class="text-muted">{{ review.comment }}</p>
            <p v-if="review.reply" class="text-muted owner-reply">↳ {{ review.reply.content }}</p>
            <template v-else-if="isOwnProfile">
              <div v-if="replyingTo === review.id" class="reply-form mt-2">
                <textarea v-model="replyText" class="form-control" rows="2" :placeholder="t('reviews.replyPlaceholder')" maxlength="1000"></textarea>
                <div class="d-flex reply-actions mt-2">
                  <button class="btn btn-primary-flat btn-sm" :disabled="!replyText || sendingReply" @click="sendReply(review)">
                    {{ t('reviews.sendReply') }}
                  </button>
                  <button class="btn btn-tertiary btn-sm" @click="replyingTo = null">{{ t('common.cancel') }}</button>
                </div>
              </div>
              <button v-else class="btn btn-tertiary btn-sm mt-2" @click="replyingTo = review.id; replyText = ''">
                {{ t('reviews.ownerReply') }}
              </button>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const { t } = useI18n()
const api = useApi()
const route = useRoute()
const auth = useAuthStore()

const { data: profile } = await useAsyncData(`owner-${route.params.slug}`, async () => {
  try {
    return await api.get(`/users/profile/${route.params.slug}`)
  } catch {
    return null
  }
})

if (!profile.value) {
  throw createError({ statusCode: 404, statusMessage: 'Profile not found' })
}

const isOwnProfile = computed(() => auth.user?.id === profile.value?.id)
const replyingTo = ref(null)
const replyText = ref('')
const sendingReply = ref(false)

async function sendReply(review) {
  sendingReply.value = true
  try {
    const reply = await api.post(`/reviews/${review.id}/reply`, { content: replyText.value })
    review.reply = reply
    replyingTo.value = null
  } finally {
    sendingReply.value = false
  }
}

useSeoMeta({ title: () => `${profile.value?.firstName} ${profile.value?.lastName}` })
</script>

<style lang="scss" scoped>
.owner-profile {
  text-align: center;
}

.owner-profile-avatar {
  width: 96px;
  height: 96px;
  border-radius: $radius-pill;
  object-fit: cover;
}

.owner-profile-avatar-placeholder {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: $color-dark;
  color: $color-surface;
  font-size: 28px;
  font-weight: 600;
}

.listing-tile {
  display: block;
}

.listing-tile-img {
  width: 100%;
  height: 100px;
  object-fit: cover;
  border-radius: $radius-card $radius-card 0 0;
}

.owner-reply {
  padding-left: 12px;
  border-left: 2px solid $color-border;
}

.reply-actions {
  gap: 8px;
}
</style>
