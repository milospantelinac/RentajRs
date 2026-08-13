<template>
  <div v-if="conversation" class="thread-page">
    <h1 class="text-page-title mb-1">{{ conversation.listing?.title }}</h1>
    <p v-if="conversation.booking" class="text-muted mb-4">
      {{ new Date(conversation.booking.startsAt).toLocaleDateString('sr-RS') }} —
      {{ new Intl.NumberFormat('sr-RS').format(conversation.booking.totalAmount || 0) }} RSD
      <NuxtLink :to="`/rezervacije/${conversation.booking.id}`">{{ t('common.seeAll') }}</NuxtLink>
    </p>

    <div class="thread-messages">
      <div v-for="m in conversation.messages" :key="m.id" class="thread-message" :class="{ 'thread-message-mine': m.sender.id === auth.user?.id }">
        <p class="text-body">{{ m.content }}</p>
        <p class="text-label">{{ new Date(m.sentAt).toLocaleString('sr-RS') }}</p>
      </div>
    </div>

    <div class="form-row-inline thread-composer">
      <input v-model="content" type="text" class="form-control" :placeholder="t('dashboard.typeMessage')" @keyup.enter="send" />
      <button class="btn btn-primary-flat" @click="send">{{ t('dashboard.send') }}</button>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ middleware: 'auth', layout: 'dashboard' })
const { t } = useI18n()
const api = useApi()
const route = useRoute()
const auth = useAuthStore()

const conversation = ref(null)
const content = ref('')

async function load() {
  conversation.value = await api.get(`/conversations/${route.params.id}`)
}

async function send() {
  if (!content.value.trim()) return
  await api.post(`/conversations/${route.params.id}/messages`, { content: content.value })
  content.value = ''
  await load()
}

onMounted(load)
useSeoMeta({ title: t('dashboard.conversations') })
</script>

<style lang="scss" scoped>
.thread-messages {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.thread-message {
  max-width: 70%;
  padding: 10px 14px;
  border-radius: $radius-card;
  background: $color-surface;
  border: 1px solid $color-border;
}

.thread-message-mine {
  align-self: flex-end;
  background: $color-background;
}

.thread-composer {
  position: sticky;
  bottom: 16px;
}
</style>
