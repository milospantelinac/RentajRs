<template>
  <LegalDocument v-if="page" :page="page" :subtitle="t('legalPages.termsSubtitle')" />
</template>

<script setup>
// Dizajn 49: the text is admin-edited (Administracija > Sadrzaj); the shared
// LegalDocument lays it out as frame 1652:3441.
const { t } = useI18n()
const api = useApi()

const { data: page } = await useAsyncData('static-page-uslovi-koriscenja', () => api.get('/static-pages/uslovi-koriscenja'))

useSeoMeta({ title: () => page.value?.title || t('legalPages.termsTitle'), description: t('legalPages.termsSubtitle'), robots: 'noindex,follow' })
</script>
