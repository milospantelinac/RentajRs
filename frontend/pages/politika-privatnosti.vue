<template>
  <LegalDocument v-if="page" :page="page" :subtitle="t('legalPages.privacySubtitle')" />
</template>

<script setup>
// Dizajn 48: the text is admin-edited (Administracija > Sadrzaj); the shared
// LegalDocument lays it out as frame 1652:3356.
const { t } = useI18n()
const api = useApi()

const { data: page } = await useAsyncData('static-page-politika-privatnosti', () => api.get('/static-pages/politika-privatnosti'))

useSeoMeta({ title: () => page.value?.title || t('legalPages.privacyTitle'), description: t('legalPages.privacySubtitle'), robots: 'noindex,follow' })
</script>
