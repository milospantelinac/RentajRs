<template>
  <div v-if="listing" class="container message-page py-4">
    <div class="row justify-content-center">
      <div class="col-12 col-md-6">
        <BackLink :fallback="`/oglasi/${route.params.slug}`" class="mb-3" />
        <h1 class="text-page-title mb-1">{{ t('listing.contactOwner') }}</h1>
        <p class="text-muted mb-4">
          {{ t('listing.messageAboutListing') }} <strong>{{ listing.title }}</strong> —
          {{ ownerName }}
        </p>
        <div class="card">
          <div class="card-body">
            <div class="form-group mb-3">
              <textarea v-model="content" class="form-control" rows="5" :placeholder="t('booking.message')" />
            </div>
            <p v-if="error" class="form-error mb-3">{{ error }}</p>
            <button class="btn btn-primary-flat btn-block" :disabled="sending" @click="send">
              {{ sending ? t('common.loading') : t('listing.sendMessageAction') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ middleware: 'auth' })
const { t } = useI18n()
const api = useApi()
const route = useRoute()

const { data: listing } = await useAsyncData(`msg-listing-${route.params.slug}`, () =>
  api.get(`/listings/public/${route.params.slug}`),
)

if (listing.value && !listing.value.canMessage) {
  await navigateTo(`/oglasi/${listing.value.slug}`)
}

// "Marko P.", as the listing's page names the owner; the full name comes with
// a confirmed booking (T80).
const ownerName = computed(() => {
  const owner = listing.value?.owner
  if (!owner) return ''
  return [owner.firstName, owner.lastInitial ? `${owner.lastInitial}.` : ''].filter(Boolean).join(' ')
})

const content = ref('')
const error = ref('')
const sending = ref(false)
// Dizajn 39: "Pošalji poruku vlasniku" on the guest's booking ties the new
// conversation to that booking, which its header then shows (Dizajn 37).
const bookingId = typeof route.query.rezervacija === 'string' ? route.query.rezervacija : undefined

async function send() {
  error.value = ''
  sending.value = true
  try {
    const message = await api.post('/conversations', { listingId: listing.value.id, bookingId, content: content.value })
    await navigateTo(`/kontrolna-tabla/poruke/${message.conversationId}`)
  } catch (e) {
    error.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    sending.value = false
  }
}

useSeoMeta({ title: t('listing.contactOwner') })
</script>

<style lang="scss" scoped>
.message-page {
  padding: 32px 0 64px;
}
</style>
