<template>
  <div>
    <DashboardPageHeader :title="t('adminListings.addTitle')" :subtitle="t('adminListings.addSubtitle')" />

    <section class="admin-card owner-card">
      <div class="admin-card-body owner-body">
        <label for="owner-search" class="form-label">{{ t('adminListings.ownerSearchLabel') }}</label>
        <input
          id="owner-search"
          v-model="query"
          type="search"
          class="admin-field owner-search"
          :placeholder="t('adminListings.ownerSearchPlaceholder')"
          autocomplete="off"
        />
        <p class="admin-card-note">{{ t('adminListings.ownerSearchHint') }}</p>

        <p v-if="searching" class="admin-card-note">{{ t('common.loading') }}</p>
        <p v-else-if="error" class="form-error mb-0" role="alert">{{ error }}</p>
        <p v-else-if="searched && !owners.length" class="admin-card-note">{{ t('adminListings.ownerNone') }}</p>

        <ul v-if="owners.length" class="owner-list">
          <li v-for="owner in owners" :key="owner.id">
            <button type="button" class="owner-row" :disabled="owner.blocked || owner.restricted" @click="choose(owner)">
              <span class="owner-main">
                <span class="admin-cell-name">{{ owner.name }}</span>
                <span class="admin-cell-sub">{{ owner.email }}</span>
              </span>
              <span class="admin-pills owner-pills">
                <span v-if="owner.blocked" class="admin-pill admin-pill-critical">{{ t('adminListings.ownerBlocked') }}</span>
                <span v-else-if="owner.restricted" class="admin-pill admin-pill-critical">{{ t('adminListings.ownerRestricted') }}</span>
                <template v-else>
                  <span v-if="!owner.hasPhone" class="admin-pill admin-pill-warning">{{ t('adminListings.ownerNoPhone') }}</span>
                  <span v-if="!owner.emailVerified" class="admin-pill admin-pill-neutral">{{ t('adminListings.ownerUnverified') }}</span>
                  <span class="admin-pill admin-pill-info">{{ t(`adminListings.ownerListings${srPluralCategory(owner.listingCount)}`, { count: owner.listingCount }) }}</span>
                </template>
              </span>
            </button>
          </li>
        </ul>
        <p v-if="owners.some((owner) => !owner.blocked && !owner.restricted && !owner.hasPhone)" class="admin-card-note">
          {{ t('adminListings.ownerNoPhoneHint') }}
        </p>
      </div>
    </section>

    <NuxtLink to="/admin/oglasi" class="admin-action owner-back">{{ t('adminListings.backToList') }}</NuxtLink>
  </div>
</template>

<script setup>
// Administracija > Oglasi, "Dodaj oglas": the listing belongs to an existing
// user (the user, 2026-10-22), so the admin picks the account first; the
// category and the wizard follow, the same ones owners use (/oglasi/novi?vlasnik=).
definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })
const { t } = useI18n()
const api = useApi()

const query = ref('')
const owners = ref([])
const searching = ref(false)
const searched = ref(false)
const error = ref('')

let timer = null
let latest = 0
watch(query, (value) => {
  clearTimeout(timer)
  const term = value.trim()
  if (term.length < 2) {
    owners.value = []
    searched.value = false
    return
  }
  timer = setTimeout(() => search(term), 300)
})

async function search(term) {
  const ticket = ++latest
  searching.value = true
  error.value = ''
  try {
    const found = await api.get(`/admin/listings/owners?search=${encodeURIComponent(term)}`)
    // A slower answer to an older query never replaces a newer one.
    if (ticket !== latest) return
    owners.value = found
    searched.value = true
  } catch (e) {
    if (ticket !== latest) return
    owners.value = []
    error.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    if (ticket === latest) searching.value = false
  }
}

function choose(owner) {
  navigateTo(`/oglasi/novi?vlasnik=${owner.id}`)
}

onBeforeUnmount(() => clearTimeout(timer))

useSeoMeta({ title: () => t('adminListings.addTitle') })
</script>

<style lang="scss" scoped>
.owner-card {
  max-width: 760px;
}

.owner-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.owner-body .form-label,
.owner-body .admin-card-note {
  margin: 0;
}

.owner-search {
  width: 100%;
}

.owner-list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid $color-border;
  border-radius: $radius-input;
  overflow: hidden;
}

.owner-list li + li {
  border-top: 1px solid $color-border;
}

.owner-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  width: 100%;
  padding: 12px 16px;
  border: 0;
  background: $color-surface;
  font-family: $font-family-base;
  text-align: left;
  cursor: pointer;
}

.owner-row:hover:not(:disabled),
.owner-row:focus-visible {
  background: $color-accent-tint;
  outline: none;
}

.owner-row:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.owner-main {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  overflow-wrap: anywhere;
}

.owner-pills {
  justify-content: flex-end;
}

.owner-back {
  display: inline-block;
  margin-top: 16px;
}
</style>
