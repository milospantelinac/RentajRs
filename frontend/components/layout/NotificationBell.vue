<template>
  <div class="notif-bell">
    <button class="notif-bell-trigger" @click="toggle">
      <span class="notif-bell-icon">🔔</span>
      <span v-if="unreadCount > 0" class="notif-bell-badge">{{ unreadCount > 9 ? '9+' : unreadCount }}</span>
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
  border: none;
  background: none;
  cursor: pointer;
  padding: 6px;
  font-size: 18px;
  line-height: 1;
}

.notif-bell-badge {
  position: absolute;
  top: 0;
  right: 0;
  background: $color-error;
  color: $color-surface;
  font-size: 10px;
  font-weight: 700;
  min-width: 16px;
  height: 16px;
  border-radius: $radius-pill;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 3px;
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
