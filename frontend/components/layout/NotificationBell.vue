<template>
  <div class="notif-bell">
    <button class="notif-bell-trigger" :aria-label="t('nav.notifications')" @click="toggle">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M6 10a6 6 0 1112 0c0 3.2 1 5 1.6 5.8.3.4 0 1-.5 1H4.9c-.5 0-.8-.6-.5-1C5 15 6 13.2 6 10Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
        <path d="M10 20a2 2 0 004 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
      </svg>
      <span v-if="unreadCount > 0" class="notif-bell-dot" />
    </button>

    <div v-if="open" class="notif-dropdown card">
      <div class="notif-dropdown-header">
        <span class="text-label">{{ t('nav.notifications') }}</span>
        <button v-if="unreadCount > 0" class="notif-mark-all" @click="markAllRead">{{ t('nav.markAllRead') }}</button>
      </div>
      <p v-if="!items.length" class="text-muted notif-empty">{{ t('nav.noNotifications') }}</p>
      <div v-for="item in items" :key="item.id" class="notif-item" :class="{ 'notif-item-unread': !item.readAt }" @click="openItem(item)">
        <p class="text-body notif-item-title">{{ item.title }}</p>
        <p class="text-muted notif-item-content">{{ item.content }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
const { t } = useI18n()
const api = useApi()

const open = ref(false)
const items = ref([])
const unreadCount = ref(0)
let pollHandle = null

async function refreshCount() {
  try {
    const res = await api.get('/notifications/unread-count')
    unreadCount.value = res.count
  } catch {
    // best-effort — don't let a poll failure surface to the user
  }
}

async function loadItems() {
  items.value = await api.get('/notifications')
}

async function toggle() {
  open.value = !open.value
  if (open.value) await loadItems()
}

async function markAllRead() {
  await api.post('/notifications/read-all', {})
  items.value = items.value.map((i) => ({ ...i, readAt: i.readAt || new Date().toISOString() }))
  unreadCount.value = 0
}

async function openItem(item) {
  if (!item.readAt) {
    await api.post(`/notifications/${item.id}/read`, {})
    item.readAt = new Date().toISOString()
    unreadCount.value = Math.max(0, unreadCount.value - 1)
  }
  open.value = false
  if (item.linkUrl) {
    const url = new URL(item.linkUrl)
    await navigateTo(url.pathname + url.search)
  }
}

onMounted(() => {
  refreshCount()
  pollHandle = setInterval(refreshCount, 30_000)
})
onUnmounted(() => {
  if (pollHandle) clearInterval(pollHandle)
})
</script>

<style lang="scss" scoped>
.notif-bell {
  position: relative;
}

.notif-bell-trigger {
  position: relative;
  width: 40px;
  height: 40px;
  border-radius: $radius-pill;
  border: none;
  background: $color-background;
  color: $color-text-muted;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s ease;
}

.notif-bell-trigger:hover {
  background: $color-border;
}

.notif-bell-dot {
  position: absolute;
  top: 8px;
  right: 9px;
  width: 9px;
  height: 9px;
  border-radius: $radius-pill;
  background: $color-error;
  border: 2px solid $color-surface;
  box-shadow: 0 0 0 1px rgba(229, 72, 77, 0.35);
}

.notif-dropdown {
  position: absolute;
  top: 44px;
  right: 0;
  width: 320px;
  max-height: 420px;
  overflow-y: auto;
  padding: 8px;
  z-index: $z-dropdown;
}

.notif-dropdown-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px 8px;
}

.notif-mark-all {
  border: none;
  background: none;
  color: $color-primary;
  font-size: $font-size-label;
  cursor: pointer;
}

.notif-empty {
  padding: 16px 8px;
  text-align: center;
}

.notif-item {
  padding: 10px 8px;
  border-radius: $radius-button;
  cursor: pointer;
}

.notif-item:hover {
  background: $color-background;
}

.notif-item-unread {
  background: $color-background;
}

.notif-item-title {
  font-weight: 600;
  margin-bottom: 2px;
}

.notif-item-content {
  font-size: $font-size-muted;
}
</style>
