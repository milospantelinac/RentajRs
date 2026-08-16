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
        <div v-if="m.attachments?.length" class="thread-attachments">
          <a
            v-for="att in m.attachments"
            :key="att.id"
            :href="att.url"
            target="_blank"
            rel="noopener"
            class="thread-attachment"
          >
            <img v-if="att.type?.startsWith('image/')" :src="att.url" :alt="att.filename" class="thread-attachment-thumb" />
            <span v-else class="thread-attachment-file">📎 {{ att.filename }}</span>
          </a>
        </div>
        <p class="text-label">{{ new Date(m.sentAt).toLocaleString('sr-RS') }}</p>
      </div>
    </div>

    <p v-if="attachError" class="form-error mb-2">{{ attachError }}</p>
    <p v-if="pendingFile" class="text-muted pending-file mb-2">
      📎 {{ pendingFile.name }}
      <button type="button" class="pending-file-remove" @click="pendingFile = null">{{ t('common.cancel') }}</button>
    </p>

    <div class="form-row-inline thread-composer">
      <input ref="fileInputEl" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" class="thread-file-input" @change="onFileSelected" />
      <button type="button" class="btn btn-tertiary btn-icon" :title="t('dashboard.attachFile')" @click="fileInputEl.click()">📎</button>
      <input v-model="content" type="text" class="form-control" :placeholder="t('dashboard.typeMessage')" @keyup.enter="send" />
      <button class="btn btn-primary-flat" :disabled="sending" @click="send">{{ t('dashboard.send') }}</button>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ middleware: 'auth', layout: 'dashboard' })
const { t } = useI18n()
const api = useApi()
const route = useRoute()
const auth = useAuthStore()

const MAX_ATTACHMENT_MB = 5
const ALLOWED_ATTACHMENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

const conversation = ref(null)
const content = ref('')
const fileInputEl = ref(null)
const pendingFile = ref(null)
const attachError = ref('')
const sending = ref(false)

async function load() {
  conversation.value = await api.get(`/conversations/${route.params.id}`)
}

function onFileSelected(evt) {
  const file = evt.target.files?.[0]
  evt.target.value = ''
  attachError.value = ''
  if (!file) return
  if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type)) {
    attachError.value = t('dashboard.attachmentTypeError')
    return
  }
  if (file.size > MAX_ATTACHMENT_MB * 1024 * 1024) {
    attachError.value = t('dashboard.attachmentSizeError', { max: MAX_ATTACHMENT_MB })
    return
  }
  pendingFile.value = file
}

async function send() {
  // R85 attachments ride on an already-sent message (POST .../messages/:id/attachments),
  // so a file-only send still needs some text — a paperclip placeholder covers that.
  const text = content.value.trim() || (pendingFile.value ? '📎' : '')
  if (!text) return

  sending.value = true
  try {
    const message = await api.post(`/conversations/${route.params.id}/messages`, { content: text })
    if (pendingFile.value) {
      const formData = new FormData()
      formData.append('file', pendingFile.value)
      await api.post(`/conversations/messages/${message.id}/attachments`, formData)
    }
    content.value = ''
    pendingFile.value = null
    await load()
  } finally {
    sending.value = false
  }
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

.thread-file-input {
  display: none;
}

.thread-attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 8px 0;
}

.thread-attachment {
  display: block;
}

.thread-attachment-thumb {
  width: 96px;
  height: 96px;
  object-fit: cover;
  border-radius: $radius-input;
  border: 1px solid $color-border;
}

.thread-attachment-file {
  display: inline-block;
  padding: 6px 10px;
  border-radius: $radius-input;
  border: 1px solid $color-border;
  background: $color-background;
  font-size: $font-size-muted;
  color: $color-primary;
}

.pending-file {
  display: flex;
  align-items: center;
  gap: 10px;
}

.pending-file-remove {
  border: none;
  background: none;
  color: $color-error;
  font-size: $font-size-muted;
  cursor: pointer;
  text-decoration: underline;
}
</style>
