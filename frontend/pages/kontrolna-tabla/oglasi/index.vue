<template>
  <div>
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h1 class="text-page-title">{{ t('listing.myListings') }}</h1>
      <NuxtLink to="/oglasi/novi" class="btn btn-primary-flat">{{ t('nav.addListing') }}</NuxtLink>
    </div>

    <div v-if="!listings?.length" class="empty-state card">
      <div class="card-body text-center">
        <p class="text-body mb-3">{{ t('listing.noListingsYet') }}</p>
        <NuxtLink to="/oglasi/novi" class="btn btn-primary-flat">{{ t('nav.addListing') }}</NuxtLink>
      </div>
    </div>

    <table v-else class="table table-responsive-cards">
      <thead>
        <tr>
          <th>{{ t('listing.title') }}</th>
          <th>{{ t('common.search') }}</th>
          <th>{{ t('billing.mySubscriptions') }}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="listing in listings" :key="listing.id">
          <td :data-label="t('listing.title')">
            <span :class="{ 'text-muted': !listing.title }">{{ listing.title || t('listing.statusDraft') }}</span>
            <p v-if="listing.status === 'DRAFT'" class="text-muted draft-hint mb-0">{{ t('listing.draftHint') }}</p>
          </td>
          <td :data-label="t('common.search')">
            <span class="badge" :class="statusBadge(listing)">{{ statusText(listing) }}</span>
          </td>
          <td :data-label="t('billing.mySubscriptions')">
            <span v-if="listing.subscription" class="text-muted">
              {{ listing.subscription.package?.key }}
              <template v-if="listing.subscription.expiresAt">
                · {{ t('billing.expiresOn') }} {{ new Date(listing.subscription.expiresAt).toLocaleDateString('sr-RS') }}
              </template>
            </span>
            <span v-else class="text-muted">—</span>
          </td>
          <td :data-label="''" class="actions-cell">
            <NuxtLink v-if="listing.status === 'ACTIVE'" :to="`/oglasi/${listing.slug}`" class="btn btn-tertiary btn-sm">
              {{ t('listing.viewListing') }}
            </NuxtLink>
            <NuxtLink :to="`/oglasi/${listing.id}/uredi`" class="btn btn-tertiary btn-sm">{{ t('listing.editListing') }}</NuxtLink>
            <button
              v-if="listing.status === 'ACTIVE'"
              class="btn btn-tertiary btn-sm"
              :disabled="togglingId === listing.id"
              @click="toggleAvailable(listing)"
            >
              {{ listing.available ? t('listing.pauseListing') : t('listing.resumeListing') }}
            </button>
            <button class="btn btn-danger btn-sm" @click="remove(listing.id)">{{ t('listing.deleteListing') }}</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
// RNT-060 — the owner's biggest gap: nowhere to see or manage listings
// (including drafts) outside guessing the direct /uredi URL. Also carries
// each listing's subscription info, since a package is bought per-listing
// (ADR-004) and this is where an owner checks what they're actually paying for.
definePageMeta({ middleware: 'auth', layout: 'dashboard' })
const { t } = useI18n()
const api = useApi()

const { data: listings, refresh } = await useAsyncData('my-listings', () => api.get('/listings/mine'))

function statusLabel(status) {
  const map = { DRAFT: 'Draft', PENDING_APPROVAL: 'PendingApproval', REJECTED: 'Rejected', ACTIVE: 'Active', EXPIRED: 'Expired' }
  return map[status] || 'Draft'
}
function statusBadge(listing) {
  if (listing.status === 'ACTIVE' && !listing.available) return 'badge-neutral'
  const map = { DRAFT: 'badge-neutral', PENDING_APPROVAL: 'badge-warning', REJECTED: 'badge-critical', ACTIVE: 'badge-success', EXPIRED: 'badge-critical' }
  return map[listing.status] || 'badge-neutral'
}
function statusText(listing) {
  if (listing.status === 'ACTIVE' && !listing.available) return t('listing.statusPaused')
  return t(`listing.status${statusLabel(listing.status)}`)
}

const togglingId = ref(null)
async function toggleAvailable(listing) {
  togglingId.value = listing.id
  try {
    await api.patch(`/listings/${listing.id}`, { available: !listing.available })
    await refresh()
  } finally {
    togglingId.value = null
  }
}

async function remove(id) {
  if (!confirm(t('listing.confirmDelete'))) return
  await api.delete(`/listings/${id}`)
  await refresh()
}

useSeoMeta({ title: t('listing.myListings') })
</script>

<style lang="scss" scoped>
.empty-state {
  padding: 32px;
}

.draft-hint {
  font-size: $font-size-muted;
}

.actions-cell {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
</style>
