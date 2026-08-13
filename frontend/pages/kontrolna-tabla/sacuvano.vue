<template>
  <div>
    <h1 class="text-page-title mb-4">{{ t('nav.favorites') }}</h1>
    <p v-if="!favorites?.length" class="text-muted">{{ t('dashboard.noFavorites') }}</p>
    <div class="row">
      <div v-for="f in favorites" :key="f.listingId" class="col-6 col-md-3 mb-4">
        <ListingCard :listing="{ ...f.listing, price: f.listing.price, coverPhoto: f.listing.photos?.[0] }" />
        <p v-if="f.priceDropped" class="text-success text-muted mt-1">{{ t('dashboard.priceDropped') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ middleware: 'auth', layout: 'dashboard' })
const { t } = useI18n()
const api = useApi()
const { data: favorites } = await useAsyncData('favorites', () => api.get('/users/me/favorites'))
useSeoMeta({ title: t('nav.favorites') })
</script>
