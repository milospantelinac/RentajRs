<template>
  <div v-if="conversation" class="thread-page">
    <div class="thread-header">
      <NuxtLink to="/kontrolna-tabla/poruke" class="thread-back-link" :aria-label="t('dashboard.backToConversations')">←</NuxtLink>
      <div class="thread-header-info">
        <p class="thread-counterpart-name">{{ counterpartName }}</p>
        <NuxtLink :to="`/oglasi/${conversation.listing?.slug}`" class="thread-listing-link">{{ conversation.listing?.title }}</NuxtLink>
      </div>
    </div>

    <p v-if="conversation.booking" class="text-muted mb-4">
      {{ new Date(conversation.booking.startsAt).toLocaleDateString('sr-RS') }} —
      {{ new Intl.NumberFormat('sr-RS').format(conversation.booking.totalAmount || 0) }} RSD
      <NuxtLink :to="`/rezervacije/${conversation.booking.id}`">{{ t('common.seeAll') }}</NuxtLink>
    </p>

    <div class="thread-messages">
      <div v-for="m in conversation.messages" :key="m.id" class="thread-message" :class="{ 'thread-message-mine': m.sender.id === auth.user?.id }">
        <img v-if="m.sender.avatarUrl" :src="m.sender.avatarUrl" alt="" class="thread-avatar" />
        <span v-else class="thread-avatar thread-avatar-placeholder">{{ initials(m.sender) }}</span>
        <div class="thread-message-body">
          <p class="thread-sender-name">{{ m.sender.firstName }}</p>
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
          <p class="thread-message-meta">
            {{ formatDateTime(m.sentAt) }}
            <span v-if="m.sender.id === auth.user?.id" class="thread-read-status">
              · {{ m.readAt ? t('dashboard.messageRead') : t('dashboard.messageSent') }}
            </span>
          </p>
        </div>
      </div>
    </div>

    <p v-if="attachError" class="form-error mb-2">{{ attachError }}</p>
    <p v-if="sendError" class="form-error mb-2">{{ sendError }}</p>
    <p v-if="pendingFile" class="text-muted pending-file mb-2">
      📎 {{ pendingFile.name }}
      <button type="button" class="pending-file-remove" @click="pendingFile = null">{{ t('common.cancel') }}</button>
    </p>

    <div class="form-row-inline thread-composer">
      <input ref="fileInputEl" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" class="thread-file-input" @change="onFileSelected" />
      <button type="button" class="btn btn-tertiary btn-icon" :aria-label="t('dashboard.attachFile')" :title="t('dashboard.attachFile')" @click="fileInputEl.click()">
        <FontAwesomeIcon icon="paperclip" />
      </button>
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
const sendError = ref('')
const sending = ref(false)

async function load() {
  conversation.value = await api.get(`/conversations/${route.params.id}`)
}

const counterpartName = computed(() => {
  const c = conversation.value?.counterpart
  if (!c) return ''
  return `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim()
})

function initials(user) {
  return `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase()
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
  sendError.value = ''
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
  } catch (e) {
    // T107 — this used to have no catch at all: a failed send (or a
    // message that sent but whose attachment upload then failed) left the
    // guest staring at an unresponsive composer with nothing in Serbian
    // explaining why. Reload regardless, since the text message itself may
    // have gone through even when the attachment step is what threw.
    sendError.value = extractErrorMessage(e, t('auth.genericError'))
    await load()
  } finally {
    sending.value = false
  }
}

onMounted(load)
useSeoMeta({ title: () => (counterpartName.value ? `${counterpartName.value} — ${t('dashboard.conversations')}` : t('dashboard.conversations')) })
</script>

<style lang="scss" scoped>
.thread-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.thread-back-link {
  font-size: 22px;
  line-height: 1;
  color: $color-text-muted;
  text-decoration: none;
  flex-shrink: 0;
}

.thread-back-link:hover {
  color: $color-primary;
}

.thread-header-info {
  min-width: 0;
}

.thread-counterpart-name {
  font-size: $font-size-section-title;
  font-weight: $font-weight-section-title;
  margin: 0;
}

.thread-listing-link {
  font-size: $font-size-muted;
  color: $color-text-muted;
  text-decoration: none;
}

.thread-listing-link:hover {
  text-decoration: underline;
}

.thread-messages {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.thread-message {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  max-width: 75%;
}

.thread-message-mine {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.thread-message-body {
  min-width: 0;
  padding: 10px 14px;
  border-radius: $radius-card;
  background: $color-surface;
  border: 1px solid $color-border;
}

.thread-message-mine .thread-message-body {
  background: rgba($color-primary, 0.12);
  border-color: rgba($color-primary, 0.3);
}

.thread-avatar {
  width: 32px;
  height: 32px;
  border-radius: $radius-pill;
  object-fit: cover;
  flex-shrink: 0;
}

.thread-avatar-placeholder {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: $color-dark;
  color: $color-surface;
  font-size: 11px;
  font-weight: 600;
}

.thread-sender-name {
  font-size: $font-size-label;
  font-weight: 600;
  margin: 0 0 2px;
}

.thread-message-meta {
  font-size: $font-size-label;
  color: $color-text-muted;
  margin: 4px 0 0;
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
