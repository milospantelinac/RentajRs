<template>
  <div>
    <div class="form-row-inline mb-4">
      <input v-model="search" type="text" class="form-control" :placeholder="t('admin.searchUsers')" @keyup.enter="load" />
      <button class="btn btn-tertiary btn-sm" @click="load">{{ t('common.search') }}</button>
    </div>

    <table class="table table-responsive-cards">
      <thead>
        <tr>
          <th>{{ t('auth.email') }}</th>
          <th>{{ t('admin.statusLabel') }}</th>
          <th>{{ t('admin.disputeHistory') }}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="u in users" :key="u.id">
          <td :data-label="t('auth.email')">
            {{ u.firstName }} {{ u.lastName }} — {{ u.email }}
            <span v-if="u.verified" class="badge badge-success">{{ t('admin.verified') }}</span>
          </td>
          <td :data-label="t('admin.statusLabel')">
            <span class="badge" :class="u.blocked ? 'badge-critical' : 'badge-success'">
              {{ u.blocked ? t('admin.blocked') : t('common.yes') }}
            </span>
          </td>
          <td :data-label="t('admin.disputeHistory')">
            <span v-if="u.warningsCount" class="badge badge-warning mr-1">{{ t('admin.warningsCount', { count: u.warningsCount }) }}</span>
            <span v-if="isRestricted(u)" class="badge badge-critical">{{ t('admin.restrictedUntil', { date: formatDate(u.restrictedUntil) }) }}</span>
          </td>
          <td :data-label="''">
            <button v-if="!u.blocked" class="btn btn-danger btn-sm" @click="openBlock(u)">{{ t('admin.blockUser') }}</button>
            <button v-else class="btn btn-tertiary btn-sm" @click="unblock(u.id)">{{ t('admin.unblockUser') }}</button>
          </td>
        </tr>
      </tbody>
    </table>

    <div v-if="blockTarget" class="modal-backdrop" @click.self="blockTarget = null">
      <div class="modal-panel card">
        <div class="card-body">
          <h3 class="text-section-title mb-3">{{ t('admin.blockUser') }}: {{ blockTarget.email }}</h3>
          <div class="form-group mb-3">
            <label class="form-label">{{ t('admin.blockReason') }}</label>
            <input v-model="blockReason" type="text" class="form-control" />
          </div>
          <div class="d-flex reply-actions">
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

const search = ref('')
const users = ref([])

async function load() {
  const query = search.value ? `?search=${encodeURIComponent(search.value)}` : ''
  users.value = await api.get(`/admin/users${query}`)
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
.form-row-inline {
  display: flex;
  gap: 8px;
}

.reply-actions {
  gap: 8px;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
}

.modal-panel {
  width: 100%;
  max-width: 420px;
}
</style>
