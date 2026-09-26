<template>
  <div>
    <DashboardPageHeader :title="t('admin.users')" :subtitle="t('admin.subtitle.users')" />

    <div class="admin-filters">
      <input
        v-model="search"
        type="search"
        class="admin-field admin-field-search"
        :placeholder="t('admin.searchUsers')"
        @keyup.enter="load"
      />
      <button class="btn btn-tertiary btn-sm" @click="load">{{ t('common.search') }}</button>
    </div>

    <!-- Dizajn 44: the rows load in their own shape, and a failed load or an
         empty result says so inside the card the table would fill. -->
    <StateBlock
      v-if="failed"
      card
      error
      icon="users"
      :title="t('admin.loadErrorTitle')"
      :text="t('admin.loadErrorText')"
    >
      <button type="button" class="state-block-action" @click="load">{{ t('errorPage.tryAgain') }}</button>
    </StateBlock>

    <StateBlock
      v-else-if="!loading && !users.length"
      card
      icon="users"
      :title="t(searched ? 'admin.empty.usersSearch.title' : 'admin.empty.users.title')"
      :text="t(searched ? 'admin.empty.usersSearch.text' : 'admin.empty.users.text')"
    >
      <button v-if="searched" type="button" class="state-block-action" @click="clearSearch">{{ t('admin.clearSearch') }}</button>
    </StateBlock>

    <div v-else class="admin-card admin-card-table">
      <table class="admin-table">
        <thead>
          <tr>
            <th>{{ t('admin.userLabel') }}</th>
            <th>{{ t('admin.statusLabel') }}</th>
            <th>{{ t('admin.disputeHistory') }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <template v-if="loading">
            <tr v-for="index in SKELETON_ROWS" :key="`loading-${index}`" aria-hidden="true">
              <td>
                <SkeletonBox width="46%" height="15px" />
                <SkeletonBox class="admin-skeleton-sub" width="62%" height="13px" />
              </td>
              <td><SkeletonBox width="74px" height="21px" radius="999px" /></td>
              <td><SkeletonBox width="96px" height="21px" radius="999px" /></td>
              <td><SkeletonBox width="64px" height="15px" /></td>
            </tr>
          </template>
          <template v-else>
            <tr v-for="u in users" :key="u.id">
              <td :data-label="t('admin.userLabel')">
                <div class="admin-cell-pair">
                  <span class="admin-cell-name">{{ u.firstName }} {{ u.lastName }}</span>
                  <span class="admin-cell-sub">{{ u.email }}</span>
                </div>
              </td>
              <td :data-label="t('admin.statusLabel')">
                <div class="admin-pills">
                  <span class="admin-pill" :class="u.blocked ? 'admin-pill-critical' : 'admin-pill-success'">
                    {{ u.blocked ? t('admin.blocked') : t('admin.userActive') }}
                  </span>
                  <span v-if="u.verified" class="admin-pill admin-pill-info">{{ t('admin.verified') }}</span>
                </div>
              </td>
              <td :data-label="t('admin.disputeHistory')">
                <div v-if="u.warningsCount || isRestricted(u)" class="admin-pills">
                  <span v-if="u.warningsCount" class="admin-pill admin-pill-warning">{{ t('admin.warningsCount', { count: u.warningsCount }) }}</span>
                  <span v-if="isRestricted(u)" class="admin-pill admin-pill-critical">{{ t('admin.restrictedUntil', { date: formatDate(u.restrictedUntil) }) }}</span>
                </div>
                <span v-else class="admin-cell-sub">{{ t('admin.noDisputeHistory') }}</span>
              </td>
              <td class="admin-cell-actions">
                <div class="admin-actions">
                  <button v-if="!u.blocked" class="admin-action admin-action-danger" @click="openBlock(u)">{{ t('admin.blockUser') }}</button>
                  <button v-else class="admin-action" @click="unblock(u.id)">{{ t('admin.unblockUser') }}</button>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <div v-if="blockTarget" class="admin-modal-backdrop" @click.self="blockTarget = null">
      <div class="admin-modal admin-card">
        <div class="admin-card-body">
          <p class="admin-card-title">{{ t('admin.blockUser') }}</p>
          <p class="admin-card-note mb-3">{{ blockTarget.email }}</p>
          <div class="form-group mb-4">
            <label class="form-label">{{ t('admin.blockReason') }}</label>
            <input v-model="blockReason" type="text" class="form-control" />
          </div>
          <div class="admin-modal-actions">
            <button class="btn btn-danger btn-sm" :disabled="!blockReason" @click="confirmBlock">{{ t('admin.blockUser') }}</button>
            <button class="btn btn-tertiary btn-sm" @click="blockTarget = null">{{ t('common.cancel') }}</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })
const { t } = useI18n()
const api = useApi()

const SKELETON_ROWS = 5

const search = ref('')
const users = ref([])
// Dizajn 44 needs to tell "still loading" from "nothing to show" and from
// "the load failed"; the page itself still fetches exactly when it used to.
const loading = ref(true)
const failed = ref(false)
const searched = ref(false)

async function load() {
  loading.value = true
  failed.value = false
  searched.value = !!search.value
  try {
    const query = search.value ? `?search=${encodeURIComponent(search.value)}` : ''
    users.value = await api.get(`/admin/users${query}`)
  } catch {
    users.value = []
    failed.value = true
  } finally {
    loading.value = false
  }
}

function clearSearch() {
  search.value = ''
  return load()
}

const blockTarget = ref(null)
const blockReason = ref('')
function openBlock(u) {
  blockTarget.value = u
  blockReason.value = ''
}
async function confirmBlock() {
  await api.post(`/admin/users/${blockTarget.value.id}/block`, { reason: blockReason.value })
  blockTarget.value = null
  await load()
}
async function unblock(id) {
  await api.post(`/admin/users/${id}/unblock`, {})
  await load()
}

function isRestricted(u) {
  return u.restrictedUntil && new Date(u.restrictedUntil).getTime() > Date.now()
}
function formatDate(value) {
  return new Date(value).toLocaleDateString('sr-RS')
}

onMounted(load)
useSeoMeta({ title: t('admin.users') })
</script>

<style lang="scss" scoped>
.admin-modal-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
