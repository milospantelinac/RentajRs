<template>
  <div>
    <!-- The rule: who counts as a leader, and how long their one free period lasts. -->
    <form class="admin-card feat-rule" @submit.prevent="saveRule">
      <div class="admin-card-body feat-form">
        <div>
          <p class="admin-card-title">{{ t('admin.featured.leaders.ruleTitle') }}</p>
          <p class="admin-card-note">{{ t('admin.featured.leaders.ruleNote') }}</p>
        </div>
        <div class="feat-grid">
          <div class="form-group">
            <label class="form-label" for="feat-leader-cutoff">{{ t('admin.featured.leaders.cutoff') }}</label>
            <input id="feat-leader-cutoff" v-model="rule.cutoffDate" type="date" class="form-control" />
            <p class="admin-card-note feat-hint">{{ t('admin.featured.leaders.cutoffHint') }}</p>
          </div>
          <div class="form-group">
            <label class="form-label" for="feat-leader-days">{{ t('admin.featured.leaders.days') }}</label>
            <input id="feat-leader-days" v-model.number="rule.days" type="number" min="1" max="365" class="form-control feat-days-input" required />
            <p class="admin-card-note feat-hint">{{ t('admin.featured.leaders.daysHint') }}</p>
          </div>
        </div>
        <p v-if="ruleMessage" class="form-success" role="status">{{ ruleMessage }}</p>
        <p v-if="ruleError" class="form-error" role="alert">{{ ruleError }}</p>
        <div class="feat-actions">
          <button type="submit" class="btn btn-primary-flat btn-sm" :disabled="ruleSaving">{{ t('common.save') }}</button>
        </div>
      </div>
    </form>

    <div class="feat-toolbar">
      <div class="feat-add">
        <input
          v-model="userQuery"
          type="search"
          class="admin-field admin-field-search"
          autocomplete="off"
          :placeholder="t('admin.featured.leaders.addPlaceholder')"
          :aria-label="t('admin.featured.leaders.add')"
          @input="searchUsers"
        />
        <ul v-if="userResults.length" class="feat-pick-list">
          <li v-for="user in userResults" :key="user.id">
            <button type="button" class="feat-pick" @click="setOverride(user.id, true)">
              <span class="feat-pick-title">{{ user.name }}</span>
              <span class="feat-pick-sub">
                {{ user.email }} · {{ t('admin.featured.leaders.activeListings', { count: user.activeListings }) }}
              </span>
            </button>
          </li>
        </ul>
      </div>
      <button type="button" class="btn btn-primary-flat btn-sm" :disabled="grantingAll || !unusedCount" @click="grantAll">
        {{ t('admin.featured.leaders.grantAll', { count: unusedCount }) }}
      </button>
    </div>

    <p v-if="message" class="form-success feat-message" role="status">{{ message }}</p>
    <p v-if="actionError" class="form-error feat-message" role="alert">{{ actionError }}</p>

    <StateBlock v-if="failed" card error icon="featured" :title="t('admin.loadErrorTitle')" :text="t('admin.loadErrorText')">
      <button type="button" class="state-block-action" @click="load">{{ t('errorPage.tryAgain') }}</button>
    </StateBlock>

    <StateBlock
      v-else-if="!loading && !leaders.length"
      card
      icon="featured"
      :title="t('admin.featured.leaders.emptyTitle')"
      :text="t('admin.featured.leaders.emptyText')"
    />

    <div v-else class="admin-card admin-card-table">
      <div class="feat-table-scroll">
      <table class="admin-table admin-table-tight feat-table">
        <thead>
          <tr>
            <th>{{ t('admin.featured.leaders.colOwner') }}</th>
            <th>{{ t('admin.featured.leaders.colFirst') }}</th>
            <th>{{ t('admin.featured.leaders.colHow') }}</th>
            <th>{{ t('admin.featured.leaders.colBenefit') }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="leader in leaders" :key="leader.userId" :class="{ 'feat-row-out': !leader.leader }">
            <td :data-label="t('admin.featured.leaders.colOwner')">
              <div class="admin-cell-pair">
                <span class="admin-cell-name">{{ leader.name || '-' }}</span>
                <span class="admin-cell-sub">{{ leader.email }}</span>
              </div>
            </td>
            <td :data-label="t('admin.featured.leaders.colFirst')">{{ formatFeaturedDay(leader.firstPublishedAt) }}</td>
            <td :data-label="t('admin.featured.leaders.colHow')">
              <span class="admin-pill" :class="howPill(leader)">{{ howLabel(leader) }}</span>
            </td>
            <td :data-label="t('admin.featured.leaders.colBenefit')">
              <div class="admin-cell-pair">
                <span>{{ benefitLabel(leader) }}</span>
                <span v-if="leader.benefit.listingTitle" class="admin-cell-sub">{{ leader.benefit.listingTitle }}</span>
                <select
                  v-if="leader.leader && leader.benefit.state === 'UNUSED' && leader.activeListings.length > 1"
                  v-model="pickedListing[leader.userId]"
                  class="admin-field feat-listing-select"
                  :aria-label="t('admin.featured.leaders.pickListing')"
                >
                  <option v-for="listing in leader.activeListings" :key="listing.id" :value="listing.id">
                    {{ listing.title }}{{ listing.categoryName ? ` (${listing.categoryName})` : '' }}
                  </option>
                </select>
                <span v-else-if="leader.leader && leader.benefit.state === 'UNUSED' && !leader.activeListings.length" class="admin-cell-sub">
                  {{ t('admin.featured.leaders.noActiveListing') }}
                </span>
              </div>
            </td>
            <td class="admin-cell-actions">
              <div class="admin-actions">
                <button
                  v-if="leader.leader && leader.benefit.state === 'UNUSED' && leader.activeListings.length"
                  type="button"
                  class="admin-action"
                  @click="grantOne(leader)"
                >{{ t('admin.featured.leaders.grant') }}</button>
                <button v-if="leader.leader && leader.override !== true" type="button" class="admin-action" @click="setOverride(leader.userId, false)">
                  {{ t('admin.featured.leaders.exclude') }}
                </button>
                <button v-if="leader.override === true" type="button" class="admin-action" @click="setOverride(leader.userId, null)">
                  {{ t('admin.featured.leaders.remove') }}
                </button>
                <button v-if="leader.override === false" type="button" class="admin-action" @click="setOverride(leader.userId, null)">
                  {{ t('admin.featured.leaders.include') }}
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>
  </div>
</template>

<script setup>
// Lideri: the owners promised a free featured period. The rule makes every
// owner whose first listing went live by a date a leader; the admin adds or
// keeps out anyone by hand. Each leader gets one period: it starts by itself
// when a leader's listing goes live, or here with "Dodeli" (one) and
// "Dodeli svima" (every leader who has not had it and has a live listing).
import { formatFeaturedDay } from '~/utils/featuredAdmin'

const { t } = useI18n()
const api = useApi()

const leaders = ref([])
const loading = ref(true)
const failed = ref(false)
const message = ref('')
const actionError = ref('')
const pickedListing = reactive({})

const rule = reactive({ cutoffDate: '', days: 30 })
const ruleSaving = ref(false)
const ruleMessage = ref('')
const ruleError = ref('')

const unusedCount = computed(
  () => leaders.value.filter((l) => l.leader && l.benefit.state === 'UNUSED' && l.activeListings.length).length,
)

async function load() {
  loading.value = true
  failed.value = false
  try {
    const data = await api.get('/admin/featured/leaders')
    leaders.value = data.leaders
    rule.cutoffDate = data.rule.cutoffDate || ''
    rule.days = data.rule.days
    for (const leader of data.leaders) {
      if (leader.activeListings.length && !pickedListing[leader.userId]) pickedListing[leader.userId] = leader.activeListings[0].id
    }
  } catch {
    leaders.value = []
    failed.value = true
  } finally {
    loading.value = false
  }
}

onMounted(load)

async function saveRule() {
  ruleSaving.value = true
  ruleMessage.value = ''
  ruleError.value = ''
  try {
    await api.put('/admin/featured/leaders/rule', { cutoffDate: rule.cutoffDate || null, days: rule.days })
    ruleMessage.value = t('dashboard.changesSaved')
    await load()
  } catch (e) {
    ruleError.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    ruleSaving.value = false
  }
}

function howLabel(leader) {
  if (leader.override === true) return t('admin.featured.leaders.howManual')
  if (leader.override === false) return t('admin.featured.leaders.howExcluded')
  return t('admin.featured.leaders.howRule')
}

function howPill(leader) {
  if (leader.override === false) return 'admin-pill-neutral'
  return leader.override === true ? 'admin-pill-info' : 'admin-pill-success'
}

function benefitLabel(leader) {
  const { state, until } = leader.benefit
  if (state === 'LIVE') return t('admin.featured.leaders.benefitLive', { date: formatFeaturedDay(until) })
  if (state === 'USED') return t('admin.featured.leaders.benefitUsed', { date: formatFeaturedDay(until) })
  if (state === 'WAITING') return t('admin.featured.leaders.benefitWaiting')
  return t('admin.featured.leaders.benefitUnused')
}

async function setOverride(userId, override) {
  actionError.value = ''
  try {
    await api.put(`/admin/featured/leaders/${userId}`, { override })
    userQuery.value = ''
    userResults.value = []
    message.value = t('dashboard.changesSaved')
    await load()
  } catch (e) {
    actionError.value = extractErrorMessage(e, t('auth.genericError'))
  }
}

async function grantOne(leader) {
  actionError.value = ''
  try {
    const outcome = await api.post(`/admin/featured/leaders/${leader.userId}/grant`, {
      listingId: pickedListing[leader.userId] || leader.activeListings[0].id,
    })
    message.value =
      outcome.status === 'STARTED'
        ? t('admin.featured.leaders.granted', { name: leader.name, date: formatFeaturedDay(outcome.expiresAt) })
        : t('admin.featured.leaders.grantedWaiting', { name: leader.name })
    await load()
  } catch (e) {
    actionError.value = extractErrorMessage(e, t('auth.genericError'))
  }
}

const grantingAll = ref(false)
async function grantAll() {
  if (!confirm(t('admin.featured.leaders.grantAllConfirm', { count: unusedCount.value, days: rule.days }))) return
  grantingAll.value = true
  actionError.value = ''
  try {
    const summary = await api.post('/admin/featured/leaders/grant-all', {})
    message.value = t('admin.featured.leaders.grantAllDone', { started: summary.started, waiting: summary.waiting })
    if (summary.skipped.length) {
      actionError.value = summary.skipped.map((skip) => `${skip.name || '-'}: ${skip.reason}`).join(' · ')
    }
    await load()
  } catch (e) {
    actionError.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    grantingAll.value = false
  }
}

const userQuery = ref('')
const userResults = ref([])
let userTimer = null

function searchUsers() {
  clearTimeout(userTimer)
  const q = userQuery.value.trim()
  if (q.length < 2) {
    userResults.value = []
    return
  }
  userTimer = setTimeout(async () => {
    try {
      userResults.value = await api.get('/admin/featured/users', { query: { q } })
    } catch {
      userResults.value = []
    }
  }, 250)
}

onBeforeUnmount(() => clearTimeout(userTimer))
</script>

<style lang="scss" scoped>
.feat-rule {
  margin-bottom: 20px;
}

.feat-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.feat-form .form-group {
  margin-bottom: 0;
}

.feat-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

@include respond-above(md) {
  .feat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.feat-hint {
  margin-top: 6px;
}

.feat-days-input {
  width: 110px;
}

.feat-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.feat-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.feat-add {
  position: relative;
  flex: 1 1 320px;
  max-width: 420px;
}

.feat-add .admin-field {
  width: 100%;
}

.feat-pick-list {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 5;
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 6px;
  border-radius: $radius-input;
  background: $color-surface;
  box-shadow: $shadow-card;
  list-style: none;
}

.feat-pick {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  padding: 8px 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.feat-pick:hover {
  background: $color-accent-tint;
}

.feat-pick-title {
  font-size: 14px;
  font-weight: 500;
  color: $color-text;
}

.feat-pick-sub {
  font-size: 12px;
  color: $color-text-muted;
}

.feat-message {
  margin-bottom: 16px;
}

.feat-row-out {
  opacity: 0.6;
}

// A tablet scrolls the table sideways rather than squeezing its words.
@include respond-above(md) {
  .feat-table-scroll {
    overflow-x: auto;
  }

  .feat-table {
    min-width: 760px;
  }

  .feat-table td:first-child {
    min-width: 200px;
  }
}

.feat-listing-select {
  max-width: 260px;
  margin-top: 6px;
}
</style>
