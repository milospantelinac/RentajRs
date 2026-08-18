<template>
  <div>
    <h2 class="text-section-title mb-3">{{ t('admin.content') }}</h2>

    <div class="content-tabs mb-4">
      <button
        class="btn btn-sm"
        :class="tab === 'pages' ? 'btn-primary-flat' : 'btn-tertiary'"
        @click="tab = 'pages'"
      >{{ t('admin.staticPages') }}</button>
      <button
        class="btn btn-sm"
        :class="tab === 'faq' ? 'btn-primary-flat' : 'btn-tertiary'"
        @click="tab = 'faq'"
      >{{ t('admin.faqManagement') }}</button>
      <button
        class="btn btn-sm"
        :class="tab === 'video' ? 'btn-primary-flat' : 'btn-tertiary'"
        @click="tab = 'video'"
      >{{ t('admin.homepageVideo') }}</button>
    </div>

    <!-- Static pages (Rich Text Editor) -->
    <section v-if="tab === 'pages'">
      <div v-for="slug in PAGE_SLUGS" :key="slug" class="card mb-4">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <p class="text-body mb-0"><strong>{{ t(`legalPages.${SLUG_TITLE_KEY[slug]}`) }}</strong></p>
            <div class="form-row-inline">
              <button
                class="btn btn-sm"
                :class="activeLang[slug] !== 'EN' ? 'btn-primary-flat' : 'btn-tertiary'"
                @click="activeLang[slug] = 'SR'"
              >SR</button>
              <button
                class="btn btn-sm"
                :class="activeLang[slug] === 'EN' ? 'btn-primary-flat' : 'btn-tertiary'"
                @click="activeLang[slug] = 'EN'"
              >EN</button>
            </div>
          </div>

          <template v-if="pageForms[slug] && pageForms[slug][activeLang[slug] || 'SR']">
            <div class="form-group mb-2">
              <label class="form-label">{{ t('admin.pageTitle') }}</label>
              <input v-model="pageForms[slug][activeLang[slug] || 'SR'].title" type="text" class="form-control" />
            </div>
            <div class="form-group mb-2">
              <label class="form-label">{{ t('admin.pageBody') }}</label>
              <RichTextEditor v-model="pageForms[slug][activeLang[slug] || 'SR'].bodyHtml" />
            </div>
            <label class="form-row-inline mb-2">
              <input v-model="pageForms[slug][activeLang[slug] || 'SR'].published" type="checkbox" class="form-checkbox" />
              {{ t('admin.pagePublished') }}
            </label>
            <p v-if="savedPage[slug + (activeLang[slug] || 'SR')]" class="text-success mb-2">{{ t('dashboard.changesSaved') }}</p>
            <button class="btn btn-primary-flat btn-sm" @click="savePage(slug, activeLang[slug] || 'SR')">{{ t('common.save') }}</button>
          </template>
        </div>
      </div>
    </section>

    <!-- FAQ (plain text) -->
    <section v-else-if="tab === 'faq'">
      <div class="form-row-inline mb-3">
        <button
          class="btn btn-sm"
          :class="faqLang !== 'EN' ? 'btn-primary-flat' : 'btn-tertiary'"
          @click="faqLang = 'SR'"
        >SR</button>
        <button
          class="btn btn-sm"
          :class="faqLang === 'EN' ? 'btn-primary-flat' : 'btn-tertiary'"
          @click="faqLang = 'EN'"
        >EN</button>
      </div>

      <div v-for="(item, idx) in faqsByLang" :key="item.id" class="card mb-3">
        <div class="card-body">
          <div class="form-group mb-2">
            <label class="form-label">{{ t('admin.faqQuestion') }}</label>
            <input v-model="item.question" type="text" class="form-control" />
          </div>
          <div class="form-group mb-2">
            <label class="form-label">{{ t('admin.faqAnswer') }}</label>
            <textarea v-model="item.answer" class="form-control" rows="3"></textarea>
          </div>
          <label class="form-row-inline mb-2">
            <input v-model="item.published" type="checkbox" class="form-checkbox" />
            {{ t('admin.pagePublished') }}
          </label>
          <div class="form-row-inline">
            <button class="btn btn-primary-flat btn-sm" @click="saveFaq(item)">{{ t('common.save') }}</button>
            <button class="btn btn-tertiary btn-sm" :disabled="idx === 0" @click="reorderFaq(item, -1)">↑ {{ t('admin.moveUp') }}</button>
            <button class="btn btn-tertiary btn-sm" :disabled="idx === faqsByLang.length - 1" @click="reorderFaq(item, 1)">↓ {{ t('admin.moveDown') }}</button>
            <button class="btn btn-danger btn-sm" @click="removeFaq(item)">{{ t('admin.deleteFaqItem') }}</button>
          </div>
          <p v-if="savedFaq[item.id]" class="text-success mt-2 mb-0">{{ t('dashboard.changesSaved') }}</p>
        </div>
      </div>

      <button class="btn btn-tertiary btn-sm" @click="addFaq">+ {{ t('admin.addFaqItem') }}</button>
    </section>

    <!-- Homepage video -->
    <section v-else>
      <div class="card">
        <div class="card-body">
          <p class="text-muted mb-3">{{ t('admin.homepageVideoHint') }}</p>
          <div class="form-group mb-3">
            <label class="form-label">{{ t('admin.videoUrl') }}</label>
            <input v-model="videoUrlForm" type="url" class="form-control" placeholder="https://www.youtube.com/watch?v=..." />
          </div>
          <p v-if="savedVideo" class="text-success mb-2">{{ t('dashboard.changesSaved') }}</p>
          <div class="form-row-inline">
            <button class="btn btn-primary-flat btn-sm" @click="saveVideoUrl">{{ t('common.save') }}</button>
            <button class="btn btn-tertiary btn-sm" :disabled="!videoUrlForm" @click="clearVideoUrl">{{ t('admin.clearVideoUrl') }}</button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })
const { t } = useI18n()
const api = useApi()

const PAGE_SLUGS = ['o-nama', 'uslovi-koriscenja', 'politika-privatnosti']
const SLUG_TITLE_KEY = {
  'o-nama': 'aboutTitle',
  'uslovi-koriscenja': 'termsTitle',
  'politika-privatnosti': 'privacyTitle',
}

const tab = ref('pages')

// -- Static pages ---------------------------------------------------------

const { data: pages } = await useAsyncData('admin-static-pages', () => api.get('/admin/static-pages'))

const activeLang = reactive({})
const pageForms = reactive({})
const savedPage = reactive({})

for (const row of pages.value || []) {
  pageForms[row.slug] = pageForms[row.slug] || {}
  pageForms[row.slug][row.language] = { title: row.title, bodyHtml: row.bodyHtml, published: row.published }
}

async function savePage(slug, language) {
  const form = pageForms[slug][language]
  await api.patch(`/admin/static-pages/${slug}/${language}`, form)
  savedPage[slug + language] = true
  setTimeout(() => { savedPage[slug + language] = false }, 2000)
}

// -- FAQ --------------------------------------------------------------------

const { data: allFaqs } = await useAsyncData('admin-faqs', () => api.get('/admin/faqs'))
const faqList = ref((allFaqs.value || []).map((f) => ({ ...f })))
const faqLang = ref('SR')
const savedFaq = reactive({})

const faqsByLang = computed(() =>
  faqList.value.filter((f) => f.language === faqLang.value).sort((a, b) => a.displayOrder - b.displayOrder),
)

async function saveFaq(item) {
  await api.patch(`/admin/faqs/${item.id}`, {
    question: item.question,
    answer: item.answer,
    published: item.published,
  })
  savedFaq[item.id] = true
  setTimeout(() => { savedFaq[item.id] = false }, 2000)
}

async function addFaq() {
  const created = await api.post('/admin/faqs', { language: faqLang.value, question: '', answer: '' })
  faqList.value.push(created)
}

async function removeFaq(item) {
  if (!window.confirm(t('admin.confirmDeleteFaq'))) return
  await api.delete(`/admin/faqs/${item.id}`)
  faqList.value = faqList.value.filter((f) => f.id !== item.id)
}

async function reorderFaq(item, direction) {
  const list = faqsByLang.value
  const idx = list.findIndex((f) => f.id === item.id)
  const swapWith = list[idx + direction]
  if (!swapWith) return
  const a = item.displayOrder
  const b = swapWith.displayOrder
  item.displayOrder = b
  swapWith.displayOrder = a
  await Promise.all([
    api.patch(`/admin/faqs/${item.id}`, { displayOrder: item.displayOrder }),
    api.patch(`/admin/faqs/${swapWith.id}`, { displayOrder: swapWith.displayOrder }),
  ])
}

// -- Homepage video ---------------------------------------------------------

const { data: settings } = await useAsyncData('admin-settings-for-content', () => api.get('/admin/settings'))
const videoSetting = (settings.value || []).find((s) => s.key === 'homepage_video_url')
const videoUrlForm = ref(typeof videoSetting?.value === 'string' ? videoSetting.value : '')
const savedVideo = ref(false)

async function saveVideoUrl() {
  // UpdateSettingDto's @IsDefined() rejects null, so an empty string is the
  // "no video" sentinel here — getHomepageVideoUrl() already treats a blank
  // string the same as unset.
  await api.patch('/admin/settings/homepage_video_url', { value: videoUrlForm.value.trim() })
  savedVideo.value = true
  setTimeout(() => { savedVideo.value = false }, 2000)
}

function clearVideoUrl() {
  videoUrlForm.value = ''
  saveVideoUrl()
}

useSeoMeta({ title: t('admin.content') })
</script>

<style lang="scss" scoped>
.content-tabs {
  display: flex;
  gap: 8px;
}

.form-row-inline {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
