<template>
  <div>
    <h1 class="text-page-title mb-4">{{ t('dashboard.conversations') }}</h1>
    <p v-if="!conversations?.length" class="text-muted">{{ t('dashboard.noConversations') }}</p>
    <div v-for="c in conversations" :key="c.id" class="card mb-2 conv-card" @click="navigateTo(`/kontrolna-tabla/poruke/${c.id}`)">
      <div class="card-body-sm conv-row">
        <div>
          <p class="text-body conv-title">{{ c.listing?.title }}</p>
          <p class="text-muted">{{ c.counterpart?.firstName }} {{ c.counterpart?.lastName }}</p>
        </div>
        <span v-if="c.unreadCount > 0" class="badge badge-info">{{ c.unreadCount }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ middleware: 'auth', layout: 'dashboard' })
const { t } = useI18n()
const api = useApi()
const { data: conversations } = await useAsyncData('conversations', () => api.get('/conversations'))
useSeoMeta({ title: t('dashboard.conversations') })
</script>

<style lang="scss" scoped>
.conv-card {
  cursor: pointer;
}
.conv-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.conv-title {
  font-weight: 600;
}
</style>
