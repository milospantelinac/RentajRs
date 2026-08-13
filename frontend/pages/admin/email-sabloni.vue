<template>
  <div>
    <h2 class="text-section-title mb-3">{{ t('admin.emailTemplates') }}</h2>

    <div class="form-row-inline mb-4">
      <input v-model="search" type="text" class="form-control" :placeholder="t('admin.searchTemplates')" />
    </div>

    <div v-for="key in filteredKeys" :key="key" class="card mb-3">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <p class="text-body mb-0"><strong>{{ key }}</strong></p>
          <div class="form-row-inline">
            <button
              class="btn btn-sm"
              :class="activeLang[key] !== 'EN' ? 'btn-primary-flat' : 'btn-tertiary'"
              @click="activeLang[key] = 'SR'"
            >SR</button>
            <button
              class="btn btn-sm"
              :class="activeLang[key] === 'EN' ? 'btn-primary-flat' : 'btn-tertiary'"
              @click="activeLang[key] = 'EN'"
            >EN</button>
          </div>
        </div>

        <template v-if="forms[key] && forms[key][activeLang[key] || 'SR']">
          <div class="form-group mb-2">
            <label class="form-label">{{ t('admin.subject') }}</label>
            <input v-model="forms[key][activeLang[key] || 'SR'].subject" type="text" class="form-control" />
          </div>
          <div class="form-group mb-2">
            <label class="form-label">{{ t('admin.heading') }}</label>
            <input v-model="forms[key][activeLang[key] || 'SR'].heading" type="text" class="form-control" />
          </div>
          <div class="form-group mb-2">
            <label class="form-label">{{ t('admin.bodyText') }}</label>
            <textarea v-model="forms[key][activeLang[key] || 'SR'].bodyText" class="form-control" rows="2"></textarea>
          </div>
          <div class="form-group mb-2">
            <label class="form-label">{{ t('admin.buttonLabel') }}</label>
            <input v-model="forms[key][activeLang[key] || 'SR'].buttonLabel" type="text" class="form-control" />
          </div>
          <p v-if="saved[key + (activeLang[key] || 'SR')]" class="text-success mb-2">{{ t('dashboard.changesSaved') }}</p>
          <button class="btn btn-primary-flat btn-sm" @click="save(key, activeLang[key] || 'SR')">{{ t('common.save') }}</button>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })
const { t } = useI18n()
const api = useApi()

const { data: templates } = await useAsyncData('admin-email-templates', () => api.get('/admin/email-templates'))

const search = ref('')
const keys = [...new Set((templates.value || []).map((row) => row.key))].sort()
const filteredKeys = computed(() => keys.filter((k) => k.toLowerCase().includes(search.value.toLowerCase())))

const activeLang = reactive({})
const forms = reactive({})
const saved = reactive({})

for (const row of templates.value || []) {
  forms[row.key] = forms[row.key] || {}
  forms[row.key][row.language] = {
    subject: row.subject,
    heading: row.heading,
    bodyText: row.bodyText,
    buttonLabel: row.buttonLabel || '',
  }
}

async function save(key, language) {
  await api.patch(`/admin/email-templates/${key}/${language}`, forms[key][language])
  saved[key + language] = true
  setTimeout(() => { saved[key + language] = false }, 2000)
}

useSeoMeta({ title: t('admin.emailTemplates') })
</script>

<style lang="scss" scoped>
.form-row-inline {
  display: flex;
  gap: 8px;
}
</style>
