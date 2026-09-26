<template>
  <div>
    <DashboardPageHeader :title="t('admin.content')" :subtitle="t('admin.subtitle.content')" />

    <div class="admin-switch mb-4">
      <button class="admin-switch-btn" :class="{ 'is-active': tab === 'pages' }" @click="tab = 'pages'">
        {{ t('admin.staticPages') }}
      </button>
      <button class="admin-switch-btn" :class="{ 'is-active': tab === 'faq' }" @click="tab = 'faq'">
        {{ t('admin.faqManagement') }}
      </button>
      <button class="admin-switch-btn" :class="{ 'is-active': tab === 'video' }" @click="tab = 'video'">
        {{ t('admin.homepageVideo') }}
      </button>
    </div>

    <!-- Static pages (Rich Text Editor) -->
    <section v-if="tab === 'pages'">
      <div v-for="slug in PAGE_SLUGS" :key="slug" class="admin-card content-card">
        <div class="content-head">
          <p class="admin-card-title">{{ t(`legalPages.${SLUG_TITLE_KEY[slug]}`) }}</p>
          <div class="admin-switch admin-switch-sm">
            <button
              class="admin-switch-btn"
              :class="{ 'is-active': activeLang[slug] !== 'EN' }"
              @click="activeLang[slug] = 'SR'"
            >SR</button>
            <button
              class="admin-switch-btn"
              :class="{ 'is-active': activeLang[slug] === 'EN' }"
              @click="activeLang[slug] = 'EN'"
            >EN</button>
          </div>
        </div>

        <template v-if="pageForms[slug] && pageForms[slug][activeLang[slug] || 'SR']">
          <div class="form-group">
            <label class="form-label">{{ t('admin.pageTitle') }}</label>
            <input v-model="pageForms[slug][activeLang[slug] || 'SR'].title" type="text" class="form-control" />
          </div>
          <div class="form-group">
            <label class="form-label">{{ t('admin.pageBody') }}</label>
            <RichTextEditor v-model="pageForms[slug][activeLang[slug] || 'SR'].bodyHtml" />
          </div>
          <label class="admin-check-row">
            <input v-model="pageForms[slug][activeLang[slug] || 'SR'].published" type="checkbox" class="admin-check" />
            {{ t('admin.pagePublished') }}
          </label>
          <div class="content-actions">
            <button class="btn btn-primary-flat btn-sm" @click="savePage(slug, activeLang[slug] || 'SR')">{{ t('common.save') }}</button>
            <p v-if="savedPage[slug + (activeLang[slug] || 'SR')]" class="form-success">{{ t('dashboard.changesSaved') }}</p>
          </div>
        </template>
      </div>
    </section>

    <!-- FAQ (plain text) -->
    <section v-else-if="tab === 'faq'">
      <div class="admin-switch admin-switch-sm mb-4">
        <button class="admin-switch-btn" :class="{ 'is-active': faqLang !== 'EN' }" @click="faqLang = 'SR'">SR</button>
        <button class="admin-switch-btn" :class="{ 'is-active': faqLang === 'EN' }" @click="faqLang = 'EN'">EN</button>
      </div>

      <StateBlock
        v-if="!faqsByLang.length"
        card
        icon="content"
        :title="t('admin.empty.faq.title')"
        :text="t('admin.empty.faq.text')"
      >
        <button type="button" class="state-block-action" @click="addFaq">{{ t('admin.addFaqItem') }}</button>
      </StateBlock>

      <template v-else>
        <div v-for="(item, idx) in faqsByLang" :key="item.id" class="admin-card content-card">
          <div class="form-group">
            <label class="form-label">{{ t('admin.faqQuestion') }}</label>
            <input v-model="item.question" type="text" class="form-control" />
          </div>
          <div class="form-group">
            <label class="form-label">{{ t('admin.faqAnswer') }}</label>
            <textarea v-model="item.answer" class="form-control" rows="3"></textarea>
          </div>
          <label class="admin-check-row">
            <input v-model="item.published" type="checkbox" class="admin-check" />
            {{ t('admin.pagePublished') }}
          </label>
          <div class="content-actions">
            <button class="btn btn-primary-flat btn-sm" @click="saveFaq(item)">{{ t('common.save') }}</button>
            <div class="admin-actions content-row-actions">
              <button class="admin-action" :disabled="idx === 0" @click="reorderFaq(item, -1)">↑ {{ t('admin.moveUp') }}</button>
              <button class="admin-action" :disabled="idx === faqsByLang.length - 1" @click="reorderFaq(item, 1)">↓ {{ t('admin.moveDown') }}</button>
              <button class="admin-action admin-action-danger" @click="removeFaq(item)">{{ t('admin.deleteFaqItem') }}</button>
            </div>
            <p v-if="savedFaq[item.id]" class="form-success">{{ t('dashboard.changesSaved') }}</p>
          </div>
        </div>
      </template>

      <button v-if="faqsByLang.length" class="btn btn-tertiary btn-sm mt-4" @click="addFaq">+ {{ t('admin.addFaqItem') }}</button>
    </section>

    <!-- Homepage video -->
    <section v-else>
      <div class="admin-card content-card">
        <p class="admin-card-note">{{ t('admin.homepageVideoHint') }}</p>

        <div class="form-group">
          <label class="form-label">{{ t('admin.videoUrl') }}</label>
          <input v-model="videoUrlForm" type="url" class="form-control" placeholder="https://www.youtube.com/watch?v=..." />
        </div>
        <div class="content-actions">
          <button class="btn btn-primary-flat btn-sm" @click="saveVideoUrl">{{ t('common.save') }}</button>
          <button class="btn btn-tertiary btn-sm" :disabled="!videoUrlForm" @click="clearVideoUrl">{{ t('admin.clearVideoUrl') }}</button>
          <p v-if="savedVideo" class="form-success">{{ t('dashboard.changesSaved') }}</p>
        </div>
      </div>

      <div class="admin-card content-card">
        <div>
          <p class="admin-card-title">{{ t('admin.videoThumbnail') }}</p>
          <p class="admin-card-note">{{ t('admin.videoThumbnailHint') }}</p>
        </div>

        <img v-if="thumbnailUrl" :src="thumbnailUrl" alt="" class="video-thumb-preview" />

        <p v-if="thumbnailError" class="form-error">{{ thumbnailError }}</p>

        <div class="content-actions">
          <label class="btn btn-tertiary btn-sm">
            {{ uploadingThumbnail ? t('common.loading') : t('admin.videoThumbnailUpload') }}
            <input type="file" accept="image/*" class="visually-hidden" :disabled="uploadingThumbnail" @change="uploadThumbnail" />
          </label>
          <button v-if="thumbnailUrl" class="admin-action admin-action-danger" :disabled="uploadingThumbnail" @click="removeThumbnail">
            {{ t('common.delete') }}
          </button>
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

// -- Homepage video poster --------------------------------------------------
// Stored as the homepage_video_thumbnail setting; the upload endpoint writes
// the setting itself, so this screen only needs to hold the resulting URL.
const thumbSetting = (settings.value || []).find((s) => s.key === 'homepage_video_thumbnail')
const thumbnailUrl = ref(typeof thumbSetting?.value === 'string' ? thumbSetting.value : '')
const uploadingThumbnail = ref(false)
const thumbnailError = ref('')

async function uploadThumbnail(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return

  thumbnailError.value = ''
  uploadingThumbnail.value = true
  try {
    const body = new FormData()
    body.append('file', file)
    const res = await api.post('/admin/homepage-video-thumbnail', body)
    thumbnailUrl.value = res.thumbnailUrl || ''
  } catch (e) {
    thumbnailError.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    uploadingThumbnail.value = false
  }
}

async function removeThumbnail() {
  thumbnailError.value = ''
  uploadingThumbnail.value = true
  try {
    await api.delete('/admin/homepage-video-thumbnail')
    thumbnailUrl.value = ''
  } catch (e) {
    thumbnailError.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    uploadingThumbnail.value = false
  }
}

useSeoMeta({ title: t('admin.content') })
</script>

<style lang="scss" scoped>
// The dashboard's content card (Dizajn 38): 22/24 of padding, 18 between the
// fields inside.
.content-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 18px;
  padding: 22px 24px;
}

.content-card > .form-group,
.content-card > .admin-card-note,
.content-card > .video-thumb-preview {
  width: 100%;
}

.content-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}

.content-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
}

.content-row-actions {
  gap: 16px;
}

// Same 1293:653 crop the homepage frame uses, so the admin sees exactly how
// the poster will sit behind the play button.
.video-thumb-preview {
  display: block;
  width: 100%;
  max-width: 420px;
  aspect-ratio: 1293 / 653;
  object-fit: cover;
  border-radius: $radius-card;
}

@include mobile-only {
  .content-card {
    padding: 18px 16px;
  }
}
</style>
