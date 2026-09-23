<template>
  <div>
    <DashboardPageHeader :title="t('admin.emailTemplates')" :subtitle="t('admin.subtitle.emailTemplates')" />

    <div class="admin-filters">
      <input v-model="search" type="search" class="admin-field admin-field-search" :placeholder="t('admin.searchTemplates')" />
    </div>

    <div v-if="pending" class="admin-card template-card" aria-hidden="true">
      <SkeletonBox width="220px" height="17px" />
      <SkeletonBox width="100%" height="51px" radius="12px" />
      <SkeletonBox width="100%" height="51px" radius="12px" />
      <SkeletonBox width="136px" height="36px" radius="12px" />
    </div>

    <StateBlock
      v-else-if="error"
      card
      error
      icon="emails"
      :title="t('admin.loadErrorTitle')"
      :text="t('admin.loadErrorText')"
    >
      <button type="button" class="state-block-action" @click="refresh()">{{ t('errorPage.tryAgain') }}</button>
    </StateBlock>

    <StateBlock
      v-else-if="!filteredKeys.length"
      card
      icon="emails"
      :title="t(search ? 'admin.empty.templatesSearch.title' : 'admin.empty.templates.title')"
      :text="t(search ? 'admin.empty.templatesSearch.text' : 'admin.empty.templates.text')"
    >
      <button v-if="search" type="button" class="state-block-action" @click="search = ''">{{ t('admin.clearSearch') }}</button>
    </StateBlock>

    <template v-else>
      <div v-for="key in filteredKeys" :key="key" class="admin-card template-card">
        <div class="template-head">
          <p class="admin-card-title template-key">{{ key }}</p>
          <div class="admin-switch admin-switch-sm">
            <button
              class="admin-switch-btn"
              :class="{ 'is-active': activeLang[key] !== 'EN' }"
              @click="activeLang[key] = 'SR'"
            >SR</button>
            <button
              class="admin-switch-btn"
              :class="{ 'is-active': activeLang[key] === 'EN' }"
              @click="activeLang[key] = 'EN'"
            >EN</button>
          </div>
        </div>

        <template v-if="forms[key] && forms[key][activeLang[key] || 'SR']">
          <div class="form-group">
            <label class="form-label">{{ t('admin.subject') }}</label>
            <input v-model="forms[key][activeLang[key] || 'SR'].subject" type="text" class="form-control" />
          </div>
          <div class="form-group">
            <label class="form-label">{{ t('admin.heading') }}</label>
            <input v-model="forms[key][activeLang[key] || 'SR'].heading" type="text" class="form-control" />
          </div>
          <div class="form-group">
            <label class="form-label">{{ t('admin.bodyText') }}</label>
            <textarea v-model="forms[key][activeLang[key] || 'SR'].bodyText" class="form-control" rows="3"></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">{{ t('admin.buttonLabel') }}</label>
            <input v-model="forms[key][activeLang[key] || 'SR'].buttonLabel" type="text" class="form-control" />
          </div>
          <div class="template-actions">
            <button class="btn btn-primary-flat btn-sm" @click="save(key, activeLang[key] || 'SR')">{{ t('common.save') }}</button>
            <p v-if="saved[key + (activeLang[key] || 'SR')]" class="form-success">{{ t('dashboard.changesSaved') }}</p>
          </div>
        </template>
      </div>
    </template>
  </div>
</template>

<script setup>
definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })
const { t } = useI18n()
const api = useApi()

const { data: templates, pending, error, refresh } = await useAsyncData('admin-email-templates', () => api.get('/admin/email-templates'))

const search = ref('')
const keys = computed(() => [...new Set((templates.value || []).map((row) => row.key))].sort())
const filteredKeys = computed(() => keys.value.filter((k) => k.toLowerCase().includes(search.value.toLowerCase())))

const activeLang = reactive({})
const forms = reactive({})
const saved = reactive({})

watch(
  templates,
  (rows) => {
    for (const row of rows || []) {
      forms[row.key] = forms[row.key] || {}
      forms[row.key][row.language] = {
        subject: row.subject,
        heading: row.heading,
        bodyText: row.bodyText,
        buttonLabel: row.buttonLabel || '',
      }
    }
  },
  { immediate: true },
)

async function save(key, language) {
  await api.patch(`/admin/email-templates/${key}/${language}`, forms[key][language])
  saved[key + language] = true
  setTimeout(() => { saved[key + language] = false }, 2000)
}

useSeoMeta({ title: t('admin.emailTemplates') })
</script>

<style lang="scss" scoped>
// One card per template, the dashboard's content card (Dizajn 38): 22/24 of
// padding and 18 between the fields inside.
.template-card {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 22px 24px;
}

.template-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.template-key {
  overflow-wrap: anywhere;
}

.template-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

@include mobile-only {
  .template-card {
    padding: 18px 16px;
  }
}
</style>
