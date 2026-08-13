<template>
  <div>
    <h2 class="text-section-title mb-3">{{ t('admin.settings') }}</h2>
    <div v-for="s in settings" :key="s.key" class="card mb-3">
      <div class="card-body">
        <p class="text-body mb-1"><strong>{{ s.key }}</strong></p>
        <p v-if="s.description" class="text-muted mb-2">{{ s.description }}</p>
        <div class="form-group mb-2">
          <label class="form-label">{{ t('admin.settingValue') }} (JSON)</label>
          <textarea v-model="forms[s.key]" class="form-control" rows="2"></textarea>
        </div>
        <p v-if="errors[s.key]" class="form-error mb-2">{{ errors[s.key] }}</p>
        <button class="btn btn-primary-flat btn-sm" @click="save(s.key)">{{ t('admin.saveSetting') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })
const { t } = useI18n()
const api = useApi()

const { data: settings } = await useAsyncData('admin-settings', () => api.get('/admin/settings'))

const forms = reactive({})
const errors = reactive({})
for (const s of settings.value || []) {
  forms[s.key] = JSON.stringify(s.value)
}

async function save(key) {
  errors[key] = ''
  let value
  try {
    value = JSON.parse(forms[key])
  } catch {
    errors[key] = t('auth.genericError')
    return
  }
  await api.patch(`/admin/settings/${key}`, { value })
}

useSeoMeta({ title: t('admin.settings') })
</script>
