<template>
  <section class="thread" :aria-label="header ? header.name : t('dashboard.conversations')">
    <template v-if="conversation">
      <header class="thread-head">
        <NuxtLink to="/kontrolna-tabla/poruke" class="thread-back" :aria-label="t('conversations.back')" :title="t('conversations.back')">
          <img src="/images/icons/chevron-left-muted.svg" alt="" width="16" height="16" />
        </NuxtLink>
        <div class="thread-heading">
          <h2 class="thread-name">{{ header.name }}</h2>
          <!-- 380:1002: the term wraps as a whole, never inside its date or hours. -->
          <p class="thread-meta">
            {{ header.listing }}<template v-if="header.term">&nbsp;· <span class="thread-meta-term">{{ header.term }}</span></template>
          </p>
        </div>
        <NuxtLink v-if="header.action" :to="header.action.to" class="thread-open">{{ header.action.label }}</NuxtLink>
      </header>

      <div ref="scrollerEl" class="thread-messages" role="log" :aria-label="header.name">
        <div class="thread-log">
          <div v-for="message in bubbles" :key="message.id" class="thread-message" :class="{ 'is-mine': message.mine }">
            <div class="thread-bubble">
              <p v-if="message.text" class="thread-text">{{ message.text }}</p>
              <div v-if="message.attachments.length" class="thread-files">
                <a
                  v-for="file in message.attachments"
                  :key="file.id"
                  :href="file.url"
                  target="_blank"
                  rel="noopener"
                  class="thread-file"
                  :class="{ 'is-image': file.image }"
                >
                  <img v-if="file.image" :src="file.url" :alt="file.name" class="thread-file-thumb" />
                  <template v-else>
                    <img src="/images/icons/paperclip.svg" alt="" width="18" height="18" class="thread-file-icon" />
                    <span class="thread-file-name">{{ file.name }}</span>
                  </template>
                </a>
              </div>
              <time class="thread-time" :datetime="message.sentAt">{{ message.time }}</time>
            </div>
          </div>
        </div>
      </div>

      <form v-if="conversation.canReply" class="thread-composer" @submit.prevent="send">
        <p v-if="pendingFile" class="thread-pending">
          <img src="/images/icons/paperclip.svg" alt="" width="18" height="18" />
          <span class="thread-pending-name">{{ pendingFile.name }}</span>
          <button type="button" class="thread-pending-remove" @click="pendingFile = null">{{ t('conversations.removeAttachment') }}</button>
        </p>
        <p v-if="composerError" class="thread-error" role="alert">{{ composerError }}</p>
        <div class="thread-compose">
          <input
            ref="fileInputEl"
            type="file"
            :accept="ATTACHMENT_ACCEPT"
            class="thread-file-input"
            tabindex="-1"
            aria-hidden="true"
            @change="onFileSelected"
          />
          <button type="button" class="thread-attach" :aria-label="t('conversations.attach')" :title="t('conversations.attach')" @click="fileInputEl?.click()">
            <img src="/images/icons/paperclip.svg" alt="" width="18" height="18" />
          </button>
          <input
            v-model="content"
            type="text"
            class="thread-input"
            maxlength="4000"
            autocomplete="off"
            :placeholder="t('conversations.placeholder')"
            :aria-label="t('conversations.messageLabel')"
          />
          <button type="submit" class="thread-send" :disabled="sending">{{ t('conversations.send') }}</button>
        </div>
      </form>
      <p v-else class="thread-closed">{{ t('conversations.removedNote') }}</p>
    </template>

    <!-- Dizajn 44 inside the conversation's own card; the list stays beside it. -->
    <StateBlock
      v-else
      icon="messages"
      :error="loadError"
      :title="t(loadError ? 'conversations.threadErrorTitle' : 'conversations.notFoundTitle')"
      :text="t(loadError ? 'conversations.loadErrorText' : 'conversations.notFoundText')"
    >
      <button v-if="loadError" type="button" class="state-block-action" @click="refresh()">{{ t('errorPage.tryAgain') }}</button>
      <NuxtLink v-else to="/kontrolna-tabla/poruke" class="state-block-action">{{ t('conversations.back') }}</NuxtLink>
    </StateBlock>
  </section>
</template>

<script setup>
// Dizajn 37, frame 380:998: one conversation beside the list (poruke.vue).
// Loading it marks it read on the server; sending, attachments (R85) and the
// read marks work as before.
import {
  ATTACHMENT_ONLY_TEXT,
  CONVERSATIONS_INBOX,
  buildConversationHeader,
  buildMessageBubbles,
  hasNewerMessage,
} from '~/utils/conversations'

definePageMeta({ middleware: 'auth', layout: 'dashboard' })
const { t } = useI18n()
const api = useApi()
const route = useRoute()
const dashboardCounts = useDashboardCountsStore()
const inbox = inject(CONVERSATIONS_INBOX, null)

const MAX_ATTACHMENT_MB = 5
const ALLOWED_ATTACHMENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const ATTACHMENT_ACCEPT = ALLOWED_ATTACHMENT_TYPES.join(',')

const conversationId = route.params.id

const { data, error, refresh } = await useAsyncData(`conversation-${conversationId}`, async () => {
  try {
    return { conversation: await api.get(`/conversations/${conversationId}`) }
  } catch (e) {
    // A made-up id, someone else's conversation and a missing one all read
    // "not found".
    if ([400, 403, 404].includes(e?.response?.status)) return { conversation: null }
    throw e
  }
})

const conversation = computed(() => data.value?.conversation ?? null)
const loadError = computed(() => !!error.value)
const now = inbox?.now ?? ref(Date.now())
const header = computed(() => (conversation.value ? buildConversationHeader(t, conversation.value) : null))
const bubbles = computed(() => buildMessageBubbles(t, conversation.value?.messages, now.value))

const content = ref('')
const scrollerEl = ref(null)
const fileInputEl = ref(null)
const pendingFile = ref(null)
const attachError = ref('')
const sendError = ref('')
const sending = ref(false)
const composerError = computed(() => attachError.value || sendError.value)

// The message list scrolls bottom up (column-reverse), so it opens at the
// newest message before any script runs and stays there as messages and
// images arrive; 0 is the bottom.
function scrollToBottom() {
  if (scrollerEl.value) scrollerEl.value.scrollTop = 0
}

async function reload({ toBottom = false } = {}) {
  try {
    const fresh = await api.get(`/conversations/${conversationId}`)
    data.value = { conversation: fresh }
    // Reading it again marked any new message read.
    inbox?.markRead(conversationId)
    dashboardCounts.refresh()
  } catch {
    // a failed refresh keeps the messages already shown
    return
  }
  if (!toBottom) return
  await nextTick()
  scrollToBottom()
}

// The list refreshes every 30 seconds; a newer message there brings this
// conversation up to date.
watch(
  () => inbox?.entry(conversationId)?.lastMessage?.sentAt,
  () => {
    if (!conversation.value || sending.value) return
    if (hasNewerMessage(inbox.entry(conversationId), conversation.value.messages)) reload()
  },
)

function onFileSelected(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  attachError.value = ''
  if (!file) return
  if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type)) {
    attachError.value = t('conversations.attachmentTypeError')
    return
  }
  if (file.size > MAX_ATTACHMENT_MB * 1024 * 1024) {
    attachError.value = t('conversations.attachmentSizeError', { max: MAX_ATTACHMENT_MB })
    return
  }
  pendingFile.value = file
}

async function send() {
  if (sending.value) return
  // R85: an attachment rides on a message that is already sent
  // (POST .../messages/:id/attachments), so a file sent alone still needs some
  // text; the paperclip stands in for it.
  const text = content.value.trim() || (pendingFile.value ? ATTACHMENT_ONLY_TEXT : '')
  if (!text) return

  sending.value = true
  sendError.value = ''
  attachError.value = ''
  try {
    const message = await api.post(`/conversations/${conversationId}/messages`, { content: text })
    // The text is out, so it leaves the field even if the file fails next.
    content.value = ''
    if (pendingFile.value) {
      const formData = new FormData()
      formData.append('file', pendingFile.value)
      await api.post(`/conversations/messages/${message.id}/attachments`, formData)
      pendingFile.value = null
    }
  } catch (e) {
    // T107: a failed send, or a message that went out while its file didn't,
    // says why in Serbian instead of leaving the composer silent.
    sendError.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    // Reloaded either way, since the text may have gone through even when the
    // attachment step is what threw; the list then shows it as the latest.
    await reload({ toBottom: true })
    await inbox?.refresh()
    sending.value = false
  }
}

// The load above marked the conversation read, so the list says so too; the
// layout refreshes the menu counter once the page has rendered (page:finish).
onMounted(() => {
  if (conversation.value) inbox?.markRead(conversationId)
})

useSeoMeta({
  title: () => (header.value ? `${header.value.name} - ${t('dashboard.conversations')}` : t('dashboard.conversations')),
})
</script>

<style lang="scss" scoped>
// 380:998: the white raised card beside the list. poruke.vue sets how tall it
// may grow; past that the messages scroll inside.
.thread {
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  min-width: 0;
  max-height: var(--inbox-panel-max, none);
  overflow: hidden;
  border-radius: $radius-card;
  background: $color-surface;
  box-shadow: $shadow-card;
}

// 380:999
.thread-head {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 12px;
  padding: 16px 22px;
  background: $color-background;
}

// Only below xl, where the conversation takes the page without the list.
.thread-back {
  display: none;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  margin-left: -8px;
  border-radius: $radius-button;
}

.thread-back:hover {
  background: $color-surface;
}

// 380:1000
.thread-heading {
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.thread-name {
  overflow: hidden;
  font-size: 16px;
  font-weight: 500;
  line-height: normal;
  color: $color-text;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.thread-meta {
  font-size: 12px;
  font-weight: 300;
  line-height: normal;
  color: $color-text-muted;
}

.thread-meta-term {
  white-space: nowrap;
}

// 380:1003, with the soft button's hover from Dizajn 35.
.thread-open {
  flex-shrink: 0;
  padding: 10px 16px;
  border-radius: $radius-button;
  background: $color-accent-tint;
  font-size: 13px;
  font-weight: 500;
  line-height: normal;
  color: $color-primary;
  white-space: nowrap;
  transition: box-shadow 0.15s ease;
}

.thread-open:hover {
  box-shadow: inset 0 0 0 1px $color-primary;
  color: $color-primary;
  text-decoration: none;
}

// 380:1005. Reversed so a long conversation starts at its end.
.thread-messages {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column-reverse;
  min-height: 0;
  padding: 22px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.thread-log {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.thread-message {
  display: flex;
}

// 380:1010
.thread-message.is-mine {
  justify-content: flex-end;
}

// 380:1007: 420 wide however short the message.
.thread-bubble {
  display: flex;
  flex-direction: column;
  gap: 5px;
  width: 420px;
  max-width: 100%;
  padding: 12px 16px;
  border-radius: $radius-button;
  background: $color-background;
}

.thread-message.is-mine .thread-bubble {
  background: $color-accent-tint;
}

.thread-text {
  font-size: 13px;
  font-weight: 400;
  line-height: 20px;
  color: $color-text;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.thread-time {
  font-size: 11px;
  font-weight: 300;
  line-height: normal;
  color: $color-text-muted;
}

.thread-message.is-mine .thread-time {
  text-align: right;
}

// Attachments have no frame; they sit in the bubble as white tiles.
.thread-files {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.thread-message.is-mine .thread-files {
  justify-content: flex-end;
}

.thread-file {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  padding: 8px 12px;
  border-radius: $radius-input;
  background: $color-surface;
  box-shadow: inset 0 0 0 1px $color-border;
  font-size: 13px;
  font-weight: 400;
  line-height: normal;
  color: $color-primary;
}

.thread-file:hover {
  color: $color-primary;
  text-decoration: underline;
}

.thread-file.is-image {
  padding: 0;
  overflow: hidden;
}

.thread-file-thumb {
  width: 96px;
  height: 96px;
  object-fit: cover;
}

.thread-file-icon {
  flex-shrink: 0;
}

.thread-file-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

// 380:1018: the line on top sits inside the 16 of padding.
.thread-composer,
.thread-closed {
  flex-shrink: 0;
  padding: 15px 22px 18px;
  border-top: 1px solid $color-border;
  background: $color-background;
}

.thread-composer {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.thread-compose {
  display: flex;
  align-items: center;
  gap: 12px;
}

.thread-file-input {
  display: none;
}

// 483:539
.thread-attach {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  border-radius: $radius-button;
  background: $color-surface;
  box-shadow: inset 0 0 0 1px $color-border;
  cursor: pointer;
  transition: box-shadow 0.15s ease;
}

.thread-attach:hover {
  box-shadow: inset 0 0 0 1px $color-primary;
}

// 380:1019, with the Dizajn 6 focus ring.
.thread-input {
  flex: 1 1 0;
  min-width: 0;
  height: 44px;
  margin: 0;
  padding: 0 16px;
  border: 0;
  border-radius: $radius-input;
  background: $color-surface;
  box-shadow: inset 0 0 0 1px $color-border;
  font-family: $font-family-base;
  font-size: 14px;
  font-weight: 400;
  line-height: normal;
  color: $color-text;
}

.thread-input::placeholder {
  color: $color-text-muted;
  opacity: 1;
}

.thread-input:focus {
  outline: none;
  box-shadow: inset 0 0 0 1.5px $color-primary;
}

// 380:1021
.thread-send {
  flex-shrink: 0;
  height: 44px;
  padding: 0 22px;
  border: 0;
  border-radius: $radius-button;
  background: linear-gradient(90deg, $color-gradient-start 0%, $color-gradient-mid 100%);
  font-family: $font-family-base;
  font-size: 14px;
  font-weight: 500;
  line-height: normal;
  color: $color-surface;
  white-space: nowrap;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.thread-send:hover {
  opacity: 0.92;
}

.thread-send:disabled {
  opacity: 0.6;
  cursor: default;
}

.thread-back:focus-visible,
.thread-open:focus-visible,
.thread-attach:focus-visible,
.thread-send:focus-visible,
.thread-file:focus-visible {
  outline: 2px solid $color-primary;
  outline-offset: 2px;
}

.thread-pending {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: 13px;
  font-weight: 400;
  line-height: normal;
  color: $color-text;
}

.thread-pending-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.thread-pending-remove {
  flex-shrink: 0;
  padding: 0;
  border: 0;
  background: none;
  font-family: $font-family-base;
  font-size: 13px;
  font-weight: 500;
  color: $color-error;
  cursor: pointer;
}

.thread-error {
  font-size: 13px;
  font-weight: 400;
  line-height: 18px;
  color: $color-error;
}

.thread-closed {
  font-size: 13px;
  font-weight: 300;
  line-height: 20px;
  color: $color-text-muted;
}

@include respond-below(xl) {
  .thread-back {
    display: inline-flex;
  }
}

@include mobile-only {
  .thread-head {
    flex-wrap: wrap;
    padding: 14px 16px;
  }

  // A phone gives the button a row of its own under the name.
  .thread-open {
    flex: 1 0 100%;
    text-align: center;
  }

  .thread-messages {
    padding: 16px;
  }

  .thread-composer,
  .thread-closed {
    padding: 13px 16px 16px;
  }

  .thread-compose {
    gap: 8px;
  }

  .thread-send {
    padding: 0 16px;
  }
}
</style>
