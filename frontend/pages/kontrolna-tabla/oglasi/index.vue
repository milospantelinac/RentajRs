<template>
  <div>
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h1 class="text-page-title">{{ t('listing.myListings') }}</h1>
      <NuxtLink to="/oglasi/novi" class="btn btn-primary-flat">{{ t('nav.addListing') }}</NuxtLink>
    </div>

    <p v-if="!listings?.length" class="text-muted">{{ t('listing.noListingsYet') }}</p>

    <table v-else class="table table-responsive-cards">
      <thead>
        <tr>
          <th>{{ t('listing.title') }}</th>
          <th>{{ t('common.search') }}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="listing in listings" :key="listing.id">
          <td :data-label="t('listing.title')">{{ listing.title || t('listing.statusDraft') }}</td>
          <td :data-label="t('common.search')">
            <span class="badge" :class="statusBadge(listing.status)">{{ t(`listing.status${statusLabel(listing.status)}`) }}</span>
          </td>
          <td :data-label="''">
            <NuxtLink v-if="listing.status === 'ACTIVE'" :to="`/oglasi/${listing.slug}`" class="btn btn-tertiary btn-sm">
              {{ t('listing.viewListing') }}
            </NuxtLink>
            <NuxtLink :to="`/oglasi/${listing.id}/uredi`" class="btn btn-tertiary btn-sm">{{ t('listing.editListing') }}</NuxtLink>
            <button class="btn btn-danger btn-sm" @click="remove(listing.id)">{{ t('listing.deleteListing') }}</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
definePageMeta({ middleware: 'auth', layout: 'dashboard' })
const { t } = useI18n()
const api = useApi()

const { data: listings, refresh } = await useAsyncData('my-listings', () => api.get('/listings/mine'))

function statusLabel(status) {
  const map = { DRAFT: 'Draft', PENDING_APPROVAL: 'PendingApproval', REJECTED: 'Rejected', ACTIVE: 'Active', EXPIRED: 'Expired' }
  return map[status] || 'Draft'
}
function statusBadge(status) {
  const map = { DRAFT: 'badge-neutral', PENDING_APPROVAL: 'badge-warning', REJECTED: 'badge-critical', ACTIVE: 'badge-success', EXPIRED: 'badge-critical' }
  return map[status] || 'badge-neutral'
}

async function remove(id) {
  if (!confirm(t('listing.confirmDelete'))) return
  await api.delete(`/listings/${id}`)
  await refresh()
}

useSeoMeta({ title: t('listing.myListings') })
</script>
