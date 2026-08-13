<template>
  <div v-if="listing" class="container message-page py-4">
    <div class="row justify-content-center">
      <div class="col-12 col-md-6">
        <h1 class="text-page-title mb-4">{{ t('listing.contactOwner') }}</h1>
        <div class="card">
          <div class="card-body">
            <div class="form-group mb-3">
              <textarea v-model="content" class="form-control" rows="5" :placeholder="t('booking.message')" />
            </div>
            <p v-if="error" class="form-error mb-3">{{ error }}</p>
            <button class="btn btn-primary-flat btn-block" :disabled="sending" @click="send">
              {{ sending ? t('common.loading') : t('common.continue') }}
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

const { data: listing } = await useAsyncData(`msg-listing-${route.params.oglasSlug}`, () =>
  api.get(`/listings/public/${route.params.oglasSlug}`),
)

const content = ref('')
const error = ref('')
const sending = ref(false)

async function send() {
  error.value = ''
  sending.value = true
  try {
    const message = await api.post('/conversations', { listingId: listing.value.id, content: content.value })
    await navigateTo(`/kontrolna-tabla/poruke/${message.conversationId}`)
  } catch (e) {
    error.value = e?.data?.message?.[0] || e?.data?.message || t('auth.genericError')
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
