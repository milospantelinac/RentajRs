<template>
  <div>
    <StateBlock v-if="failed" card error icon="featured" :title="t('admin.loadErrorTitle')" :text="t('admin.loadErrorText')">
      <button type="button" class="state-block-action" @click="load">{{ t('errorPage.tryAgain') }}</button>
    </StateBlock>

    <StateBlock
      v-else-if="!loading && !rows.length"
      card
      icon="featured"
      :title="t('admin.featured.history.emptyTitle')"
      :text="t('admin.featured.history.emptyText')"
    />

    <div v-else class="admin-card admin-card-table">
      <table class="admin-table">
        <thead>
          <tr>
            <th>{{ t('admin.featured.history.when') }}</th>
            <th>{{ t('admin.featured.history.who') }}</th>
            <th>{{ t('admin.featured.history.what') }}</th>
            <th>{{ t('admin.featured.history.details') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id">
            <td :data-label="t('admin.featured.history.when')">{{ formatDateTime(row.createdAt) }}</td>
            <td :data-label="t('admin.featured.history.who')">{{ row.who || '-' }}</td>
            <td :data-label="t('admin.featured.history.what')">{{ actionLabel(row) }}</td>
            <td :data-label="t('admin.featured.history.details')">
              <span class="feat-details">{{ details(row) || '-' }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
// Istorija: every grant, change of an end, early end, decided request,
// leader change and change of the rules, with who did it and when (AdminLog).
import { formatFeaturedDay } from '~/utils/featuredAdmin'
import { formatDateTime } from '~/utils/formatDateTime'

const { t } = useI18n()
const api = useApi()

const rows = ref([])
const loading = ref(true)
const failed = ref(false)

async function load() {
  loading.value = true
  failed.value = false
  try {
    rows.value = await api.get('/admin/featured/history')
  } catch {
    rows.value = []
    failed.value = true
  } finally {
    loading.value = false
  }
}

onMounted(load)

const SETTING_LABELS = {
  featured_rules: 'settingRules',
  featured_leaders: 'settingLeaders',
  ranking_weights: 'settingRanking',
}

function actionLabel(row) {
  if (row.action === 'update_setting') return t(`admin.featured.history.${SETTING_LABELS[row.entityId] || 'settingRules'}`)
  const key = row.action.replace('featured.', '')
  return t(`admin.featured.history.action.${key}`)
}

// The few facts worth reading from the stored before and after.
function details(row) {
  const after = row.newValue || {}
  const before = row.oldValue || {}
  const parts = []
  if (after.listing) parts.push(after.listing)
  if (after.days) parts.push(t('admin.featured.history.days', { count: after.days }))
  if (after.source) parts.push(t(`admin.featured.source.${after.source}`))
  if (after.status) parts.push(t(`admin.featured.history.status.${after.status}`))
  if (after.reason) parts.push(after.reason)
  if (after.note) parts.push(after.note)
  if (row.action === 'featured.change_end' || row.action === 'featured.end') {
    parts.push(`${formatFeaturedDay(before.expiresAt)} → ${formatFeaturedDay(after.expiresAt)}`)
  }
  if (row.action === 'featured.leader_set') {
    parts.push(after.email, t(`admin.featured.history.override.${String(after.leaderOverride)}`))
  }
  if (row.action === 'update_setting') {
    const changed = Object.keys(after).filter((key) => JSON.stringify(after[key]) !== JSON.stringify(before[key]))
    parts.push(changed.map((key) => `${key}: ${JSON.stringify(before[key])} → ${JSON.stringify(after[key])}`).join(', '))
  }
  return parts.filter(Boolean).join(' · ')
}
</script>

<style lang="scss" scoped>
.feat-details {
  font-size: 13px;
  color: $color-text-muted;
  word-break: break-word;
}
</style>
