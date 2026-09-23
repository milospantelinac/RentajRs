<template>
  <div class="inbox" :class="{ 'is-split': openId }">
    <DashboardPageHeader class="inbox-header" :title="t('dashboard.conversations')" :subtitle="summary" />

    <!-- Dizajn 44: a failed load and an empty inbox both say so where the
         list would be. -->
    <StateBlock
      v-if="!openId && error"
      card
      error
      icon="messages"
      class="inbox-state"
      :title="t('conversations.loadErrorTitle')"
      :text="t('conversations.loadErrorText')"
    >
      <button type="button" class="state-block-action" @click="refresh()">{{ t('errorPage.tryAgain') }}</button>
    </StateBlock>

    <StateBlock
      v-else-if="!openId && !rows.length"
      card
      icon="messages"
      class="inbox-state"
      :title="t('conversations.emptyTitle')"
      :text="t('conversations.emptyText')"
    >
      <NuxtLink to="/pretraga" class="state-block-action">{{ t('dashboard.browseListings') }}</NuxtLink>
    </StateBlock>

    <div v-else class="inbox-split">
      <nav v-if="rows.length || error" class="inbox-list" :aria-label="t('dashboard.conversations')">
        <p v-if="error" class="inbox-list-error" role="alert">
          {{ t('conversations.listErrorText') }}
          <button type="button" class="inbox-list-retry" @click="refresh()">{{ t('errorPage.tryAgain') }}</button>
        </p>
        <NuxtLink
          v-for="row in rows"
          :key="row.id"
          :to="row.to"
          class="inbox-row"
          :class="{ 'is-active': row.active, 'is-unread': row.unread }"
        >
          <span class="inbox-avatar" aria-hidden="true">
            <img v-if="row.avatarUrl" :src="row.avatarUrl" alt="" class="inbox-avatar-photo" />
            <template v-else>{{ row.initials }}</template>
          </span>
          <span class="inbox-row-text">
            <span class="inbox-row-top">
              <span class="inbox-row-name">{{ row.name }}</span>
              <time class="inbox-row-time" :datetime="row.sentAt">{{ row.time }}</time>
            </span>
            <span class="inbox-row-listing">{{ row.listing }}</span>
            <span class="inbox-row-preview">{{ row.preview }}</span>
          </span>
          <span v-if="row.unread" class="inbox-row-dot" />
        </NuxtLink>
      </nav>

      <NuxtPage v-if="openId" />
    </div>
  </div>
</template>

<script setup>
// Dizajn 37: the conversations of this user, as guest and as owner, newest
// first with the unread ones on top (R82). Frame 519:588 is the list alone;
// with a conversation open (380:867, poruke/[id].vue) the list narrows to 360
// beside it, and below xl the open conversation takes the page.
import { CONVERSATIONS_INBOX, buildConversationRow, formatConversationsSummary } from '~/utils/conversations'

definePageMeta({ middleware: 'auth', layout: 'dashboard' })
const { t } = useI18n()
const api = useApi()
const route = useRoute()

// The list keeps up with new messages at the menu counters' pace while the
// tab is in view.
const POLL_MS = 30_000

const openId = computed(() => (typeof route.params.id === 'string' ? route.params.id : null))

const { data, error, refresh } = await useAsyncData('conversations', () => api.get('/conversations'))
const conversations = computed(() => data.value || [])

// One clock for the server render and hydration ("juče" has to agree), moved
// on with every refresh.
const now = useState('conversations-now', () => Date.now())

const rows = computed(() =>
  conversations.value.map((conversation) => buildConversationRow(t, conversation, { activeId: openId.value, now: now.value })),
)
const summary = computed(() => (error.value ? '' : formatConversationsSummary(t, conversations.value, openId.value)))

let lastRefreshAt = Date.now()

// A background refresh never replaces the list with an error; the retry
// button is there for a list that didn't load in the first place.
async function refreshQuietly({ force = false } = {}) {
  if (error.value || (!force && document.visibilityState !== 'visible')) return
  lastRefreshAt = Date.now()
  try {
    data.value = await api.get('/conversations')
    now.value = Date.now()
  } catch {
    // like the menu counters: a failed poll keeps what the page shows
  }
}

function markRead(id) {
  const conversation = conversations.value.find((c) => c.id === id)
  if (conversation) conversation.unreadCount = 0
}

provide(CONVERSATIONS_INBOX, {
  entry: (id) => conversations.value.find((c) => c.id === id) || null,
  markRead,
  refresh: () => refreshQuietly({ force: true }),
  now,
})

// Leaving a conversation leaves it read, as its load marked it on the server.
watch(openId, (_, previousId) => {
  if (previousId) markRead(previousId)
})

function onVisibilityChange() {
  if (document.visibilityState === 'visible' && Date.now() - lastRefreshAt >= POLL_MS) refreshQuietly()
}

let pollHandle = null
onMounted(() => {
  now.value = Date.now()
  lastRefreshAt = Date.now()
  pollHandle = setInterval(() => refreshQuietly(), POLL_MS)
  document.addEventListener('visibilitychange', onVisibilityChange)
})

onBeforeUnmount(() => {
  clearInterval(pollHandle)
  document.removeEventListener('visibilitychange', onVisibilityChange)
})

useSeoMeta({ title: t('dashboard.conversations') })
</script>

<style lang="scss" scoped>
$inbox-unread-dot: #f43f5e;

// 380:954 starts at 312,132 with no padding of its own, so the page steps out
// of the layout's 4 / 8 (as sacuvano.vue and pretplate.vue do).
.inbox {
  margin: -4px -8px 0;
}

// 380:955: the cards start 20 under the heading plus the split's own 4.
.dash-page-header.inbox-header {
  margin-bottom: 20px;
}

// 380:958 and 519:679. The open conversation (poruke/[id].vue) reads the
// height limit: both cards end above the bottom of the window, whose top
// edge sits 216 down the page, and scroll inside instead.
.inbox-split {
  --inbox-panel-max: max(420px, calc(100vh - 248px));
  display: flex;
  align-items: flex-start;
  gap: 32px;
  padding: 4px 8px 8px;
}

// 519:680: the whole width while no conversation is open.
.inbox-list {
  flex: 1 1 0;
  min-width: 0;
  overflow: hidden;
  border-radius: $radius-card;
  background: $color-surface;
  box-shadow: $shadow-card;
}

// 380:959
.inbox.is-split .inbox-list {
  flex: 0 0 360px;
  width: 360px;
  max-height: var(--inbox-panel-max);
  overflow-y: auto;
}

// 380:960: 82 tall rows; a Figma stroke sits inside the row, so a row under
// the line gives up a pixel of its top padding.
.inbox-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  color: $color-text;
  text-decoration: none;
}

.inbox-row + .inbox-row,
.inbox-list-error + .inbox-row {
  padding-top: 13px;
  border-top: 1px solid $color-border;
}

.inbox-row:hover {
  background: $color-background;
  color: $color-text;
  text-decoration: none;
}

.inbox-row.is-active {
  background: $color-accent-tint;
}

.inbox-row:focus-visible {
  outline: 2px solid $color-primary;
  outline-offset: -2px;
}

// 380:961
.inbox-avatar {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  overflow: hidden;
  border: 1px solid $color-border;
  border-radius: $radius-pill;
  background: $color-surface;
  font-size: 13px;
  font-weight: 500;
  line-height: normal;
  color: $color-primary;
}

.inbox-avatar-photo {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

// 380:963
.inbox-row-text {
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  line-height: normal;
}

.inbox-row-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.inbox-row-name,
.inbox-row-listing,
.inbox-row-preview {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.inbox-row-name {
  font-size: 14px;
  font-weight: 400;
  color: $color-text;
}

.inbox-row-time {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 300;
  color: $color-text-muted;
  white-space: nowrap;
}

.inbox-row-listing,
.inbox-row-preview {
  font-size: 12px;
  font-weight: 300;
  color: $color-text-muted;
}

// 380:965, 380:968: an unread conversation names its sender and shows the
// message in full ink, with the dot on the right.
.inbox-row.is-unread .inbox-row-name {
  font-weight: 500;
}

.inbox-row.is-unread .inbox-row-preview {
  font-weight: 400;
  color: $color-text;
}

.inbox-row-dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: $radius-pill;
  background: $inbox-unread-dot;
}

.inbox-list-error {
  padding: 14px 18px;
  font-size: 13px;
  font-weight: 300;
  line-height: 20px;
  color: $color-error;
}

.inbox-list-retry {
  display: block;
  margin-top: 4px;
  padding: 0;
  border: 0;
  background: none;
  font-family: $font-family-base;
  font-size: 13px;
  font-weight: 500;
  color: $color-primary;
  cursor: pointer;
}

// Dizajn 44's block stands where the list would, inside the page's own
// step-out of the layout padding.
.state-block.inbox-state {
  margin: 4px 8px 8px;
}

// Below xl the list and an open conversation don't fit side by side, so the
// conversation takes the page and its header links back to the list.
@include respond-below(xl) {
  .inbox.is-split .inbox-list {
    display: none;
  }
}

@include mobile-only {
  .inbox {
    margin: 0;
  }

  .inbox-split {
    --inbox-panel-max: max(360px, calc(100dvh - 300px));
    padding: 0;
  }

  .state-block.inbox-state {
    margin: 0;
  }

  .inbox-row {
    padding-right: 14px;
    padding-left: 14px;
  }
}
</style>
