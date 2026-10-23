<template>
  <div>
    <DashboardPageHeader :title="t('admin.featured.title')" :subtitle="t('admin.featured.subtitle')" />

    <div class="admin-switch featured-tabs" role="tablist">
      <button
        v-for="key in TABS"
        :key="key"
        type="button"
        role="tab"
        class="admin-switch-btn"
        :class="{ 'is-active': tab === key }"
        :aria-selected="tab === key"
        @click="tab = key"
      >
        {{ t(`admin.featured.tabs.${key}`) }}
        <span v-if="key === 'requests' && pendingCount" class="featured-tab-count">{{ pendingCount }}</span>
      </button>
    </div>

    <FeaturedPeriodsPanel v-if="tab === 'active'" />
    <FeaturedRequestsPanel v-else-if="tab === 'requests'" @changed="loadPendingCount" />
    <FeaturedLeadersPanel v-else-if="tab === 'leaders'" />
    <FeaturedPreviewPanel v-else-if="tab === 'preview'" />
    <FeaturedSettingsPanel v-else-if="tab === 'settings'" />
    <FeaturedHistoryPanel v-else />
  </div>
</template>

<script setup>
// T129 point 6: everything about featured listings in one place. Who is
// featured and until when (with how often each was shown and opened), the
// owners' requests and the queue of a full category, the leaders' program,
// a preview of who would top a search now, the rules, and every change made.
definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })
const { t } = useI18n()
const api = useApi()
const route = useRoute()

const TABS = ['active', 'requests', 'leaders', 'preview', 'settings', 'history']
const tab = ref(TABS.includes(route.query.tab) ? route.query.tab : 'active')
watch(tab, (value) => navigateTo({ query: { ...route.query, tab: value } }, { replace: true }))

// The requests tab says how many wait for a decision.
const pendingCount = ref(0)
async function loadPendingCount() {
  try {
    const requests = await api.get('/admin/featured/requests', { query: { status: 'PENDING' } })
    pendingCount.value = requests.length
  } catch {
    pendingCount.value = 0
  }
}
onMounted(loadPendingCount)

useSeoMeta({ title: t('admin.featured.title') })
</script>

<style lang="scss" scoped>
.featured-tabs {
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.featured-tab-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  margin-left: 6px;
  padding: 0 5px;
  border-radius: $radius-pill;
  background: $color-primary;
  color: $color-surface;
  font-size: 11px;
  font-weight: 500;
}

// On the open tab's blue the count turns white.
.admin-switch-btn.is-active .featured-tab-count {
  background: $color-surface;
  color: $color-primary;
}
</style>
