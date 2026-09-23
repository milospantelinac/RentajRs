<template>
  <div>
    <DashboardPageHeader :title="t('admin.settings')" :subtitle="t('admin.subtitle.settings')" />

    <div v-if="pending" class="admin-card setting-card" aria-hidden="true">
      <SkeletonBox width="200px" height="17px" />
      <SkeletonBox width="64%" height="13px" />
      <SkeletonBox width="100%" height="51px" radius="12px" />
      <SkeletonBox width="120px" height="36px" radius="12px" />
    </div>

    <StateBlock
      v-else-if="error"
      card
      error
      icon="settings"
      :title="t('admin.loadErrorTitle')"
      :text="t('admin.loadErrorText')"
    >
      <button type="button" class="state-block-action" @click="refresh()">{{ t('errorPage.tryAgain') }}</button>
    </StateBlock>

    <StateBlock
      v-else-if="!settings?.length"
      card
      icon="settings"
      :title="t('admin.empty.settings.title')"
      :text="t('admin.empty.settings.text')"
    />

    <template v-else>
      <div v-for="s in settings" :key="s.key" class="admin-card setting-card">
        <div>
          <p class="admin-card-title setting-key">{{ s.key }}</p>
          <p v-if="s.description" class="admin-card-note">{{ s.description }}</p>
        </div>
        <div class="form-group">
          <label class="form-label">{{ t('admin.settingValue') }} (JSON)</label>
          <textarea v-model="forms[s.key]" class="form-control" rows="2"></textarea>
        </div>
        <p v-if="errors[s.key]" class="form-error">{{ errors[s.key] }}</p>
        <div class="setting-actions">
          <button class="btn btn-primary-flat btn-sm" @click="save(s.key)">{{ t('admin.saveSetting') }}</button>
          <p v-if="saved[s.key]" class="form-success">{{ t('dashboard.changesSaved') }}</p>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })
const { t } = useI18n()
const api = useApi()

const { data: settings, pending, error, refresh } = await useAsyncData('admin-settings', () => api.get('/admin/settings'))

const forms = reactive({})
const errors = reactive({})
const saved = reactive({})

watch(
  settings,
  (rows) => {
    for (const s of rows || []) {
      if (forms[s.key] === undefined) forms[s.key] = JSON.stringify(s.value)
    }
  },
  { immediate: true },
)

async function save(key) {
  errors[key] = ''
  saved[key] = false
  let value
  try {
    value = JSON.parse(forms[key])
  } catch {
    errors[key] = t('auth.genericError')
    return
  }
  await api.patch(`/admin/settings/${key}`, { value })
  saved[key] = true
  setTimeout(() => { saved[key] = false }, 2000)
}

useSeoMeta({ title: t('admin.settings') })
</script>

<style lang="scss" scoped>
.setting-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 22px 24px;
}

.setting-key {
  overflow-wrap: anywhere;
}

.setting-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

@include mobile-only {
  .setting-card {
    padding: 18px 16px;
  }
}
</style>
