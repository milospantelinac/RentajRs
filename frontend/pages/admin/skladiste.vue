<template>
  <div>
    <DashboardPageHeader :title="t('admin.storagePage.title')" :subtitle="t('admin.storagePage.subtitle')" />

    <StateBlock
      v-if="loadError"
      card
      error
      icon="storage"
      :title="forbidden ? t('admin.storagePage.forbiddenTitle') : t('admin.loadErrorTitle')"
      :text="forbidden ? t('admin.storagePage.forbiddenText') : t('admin.loadErrorText')"
    >
      <button v-if="!forbidden" type="button" class="state-block-action" @click="refresh()">{{ t('errorPage.tryAgain') }}</button>
    </StateBlock>

    <template v-else-if="overview">
      <!-- 1. Veza sa skladištem -->
      <section class="admin-card">
        <div class="admin-card-head">
          <p class="admin-card-title">{{ t('admin.storagePage.connectionTitle') }}</p>
          <button type="button" class="btn btn-tertiary btn-sm" :disabled="checking" @click="checkNow">
            {{ checking ? t('admin.storagePage.checking') : t('admin.storagePage.checkNow') }}
          </button>
        </div>
        <div class="admin-card-body">
          <div class="st-status" :class="`is-${healthState}`">
            <img :src="HEALTH_ICONS[healthState]" alt="" class="st-status-icon" />
            <div>
              <p class="st-status-title">{{ t(`admin.storagePage.health.${healthState}`) }}</p>
              <p class="st-muted">
                {{ health.last
                  ? t('admin.storagePage.checkedAt', { time: formatDateTime(health.last.checkedAt), ms: health.last.latencyMs })
                  : t('admin.storagePage.autoCheckHint') }}
              </p>
            </div>
          </div>

          <p v-if="failedCheck" class="st-alert is-critical">
            <img src="/images/icons/field-error.svg" alt="" class="st-icon" />
            <span>{{ t('admin.storagePage.failedStep', { step: t(`admin.storagePage.checks.${failedCheck.name}`), detail: failedCheck.detail || '' }) }}</span>
          </p>

          <details class="st-details">
            <summary>
              <span>{{ t('admin.storagePage.connectionDetails') }}</span>
              <img src="/images/icons/chevron-down.svg" alt="" class="st-details-chevron" />
            </summary>
            <div class="st-details-body">
              <template v-if="health.last">
                <p class="st-section-label">{{ t('admin.storagePage.stepsTitle') }}</p>
                <ul class="st-steps">
                  <li v-for="item in health.last.checks" :key="item.name">
                    <img :src="item.ok ? '/images/icons/check-success.svg' : '/images/icons/field-error.svg'" alt="" class="st-icon" />
                    <span>{{ t(`admin.storagePage.checks.${item.name}`) }}</span>
                    <span v-if="item.detail" class="st-muted">{{ item.detail }}</span>
                  </li>
                </ul>
              </template>

              <p class="st-section-label">{{ t('admin.storagePage.envTitle') }}</p>
              <dl class="st-facts">
                <div v-for="fact in connectionFacts" :key="fact.label">
                  <dt>{{ fact.label }}</dt>
                  <dd>{{ fact.value }}</dd>
                </div>
              </dl>
              <p class="st-note">
                <img src="/images/icons/info-circle.svg" alt="" class="st-icon" />
                <span>{{ t('admin.storagePage.envHint') }}</span>
              </p>
            </div>
          </details>
        </div>
      </section>

      <!-- 2. Fajlovi za brisanje -->
      <section class="admin-card">
        <div class="admin-card-head">
          <div>
            <p class="admin-card-title">{{ t('admin.storagePage.reviewTitle') }}</p>
            <p class="admin-card-note">{{ t('admin.storagePage.reviewHint') }}</p>
          </div>
          <button type="button" class="btn btn-primary-flat btn-sm" :disabled="scanRunning || startingScan" @click="startScan">
            {{ scanRunning ? t('admin.storagePage.scanRunning') : t('admin.storagePage.startScan') }}
          </button>
        </div>
        <div class="admin-card-body">
          <p class="st-meta">
            <img src="/images/icons/clock-line.svg" alt="" class="st-icon" />
            <span>{{ lastScanText }}</span>
          </p>
          <p v-if="scanError" class="form-error">{{ scanError }}</p>

          <p v-if="lastDoneScan?.warning" class="st-alert is-critical">
            <img src="/images/icons/field-error.svg" alt="" class="st-icon" />
            <span>{{ t('admin.storagePage.warning') }}</span>
          </p>
          <p v-if="overview.overdueAccountAttachments" class="st-alert is-warning">
            <img src="/images/icons/info-circle.svg" alt="" class="st-icon" />
            <span>{{ t('admin.storagePage.overdue', { count: overview.overdueAccountAttachments }) }}</span>
          </p>

          <div v-if="lastDoneScan" class="st-tabs" role="tablist">
            <button
              v-for="tab in tabs"
              :key="tab.reason"
              type="button"
              role="tab"
              class="st-tab"
              :class="{ 'is-active': reasonFilter === tab.reason }"
              :aria-selected="reasonFilter === tab.reason"
              @click="setReason(tab.reason)"
            >
              {{ t(`admin.storagePage.tabs.${tab.reason || 'all'}`) }}
              <span class="st-tab-count">{{ tab.count }}</span>
            </button>
          </div>

          <div v-if="lastDoneScan && !items.length && !loadingItems" class="st-empty">
            <img src="/images/icons/check-success.svg" alt="" class="st-empty-icon" />
            <p>{{ t('admin.storagePage.nothingToDelete') }}</p>
          </div>

          <template v-else-if="items.length">
            <label class="st-select-all">
              <input type="checkbox" class="admin-check" :checked="allSelected" @change="toggleAll" />
              {{ t('admin.storagePage.selectAll', { count: items.length }) }}
            </label>
            <ul class="st-list">
              <li v-for="item in items" :key="item.id" class="st-item" :class="{ 'is-selected': selected.has(item.id) }">
                <input
                  type="checkbox"
                  class="admin-check"
                  :checked="selected.has(item.id)"
                  :aria-label="itemTitle(item)"
                  @change="toggle(item.id)"
                />
                <img v-if="item.previewUrl" :src="item.previewUrl" alt="" class="st-thumb" loading="lazy" />
                <span v-else class="st-thumb st-thumb-file"><img src="/images/icons/paperclip.svg" alt="" /></span>
                <div class="st-item-text" :title="item.location">
                  <p class="st-item-title">{{ itemTitle(item) }}</p>
                  <p class="st-item-sub" :class="{ 'is-overdue': item.overdue }">{{ itemSubtitle(item) }}</p>
                </div>
                <div class="st-item-size">
                  <span>{{ formatBytes(item.bytes) }}</span>
                  <span class="st-muted">{{ plural('fileCount', item.files) }}</span>
                </div>
              </li>
            </ul>
            <button v-if="items.length < itemsTotal" type="button" class="btn btn-text btn-sm st-more" :disabled="loadingItems" @click="loadItems(true)">
              {{ t('admin.storagePage.showMore', { shown: items.length, total: itemsTotal }) }}
            </button>
          </template>

          <div v-if="selected.size" class="st-bulk">
            <span>{{ t('admin.storagePage.selectedSummary', { count: selected.size, size: formatBytes(selectedBytes) }) }}</span>
            <div class="st-bulk-actions">
              <button type="button" class="btn btn-tertiary btn-sm" :disabled="deciding" @click="keepSelected">{{ t('admin.storagePage.keep') }}</button>
              <button type="button" class="btn btn-danger btn-sm" :disabled="deciding" @click="confirmDelete = true">{{ t('admin.storagePage.delete') }}</button>
            </div>
          </div>

          <p v-if="decisionResult" class="st-result">
            <img src="/images/icons/check-success.svg" alt="" class="st-icon" />
            <span>{{ decisionResult }}</span>
          </p>
          <p v-if="decisionError" class="form-error">{{ decisionError }}</p>

          <div class="st-holds">
            <button type="button" class="btn btn-text btn-sm" @click="toggleHolds">
              {{ t(holdsOpen ? 'admin.storagePage.holdsHide' : 'admin.storagePage.holdsShow', { count: overview.holds }) }}
            </button>
            <template v-if="holdsOpen">
              <p class="st-muted">{{ t('admin.storagePage.holdsHint') }}</p>
              <p v-if="!holds.length" class="st-muted">{{ t('admin.storagePage.noHolds') }}</p>
              <ul v-else class="st-hold-list">
                <li v-for="hold in holds" :key="hold.id">
                  <div class="st-item-text" :title="hold.location">
                    <p class="st-item-title">{{ t(`admin.storagePage.tabs.${hold.reason}`) }}</p>
                    <p class="st-item-sub">{{ t('admin.storagePage.keptBy', { time: formatDate(hold.createdAt), who: hold.createdBy || '-' }) }}</p>
                  </div>
                  <button type="button" class="btn btn-text btn-sm" @click="removeHold(hold.id)">{{ t('admin.storagePage.removeHold') }}</button>
                </li>
              </ul>
            </template>
          </div>
        </div>
      </section>

      <!-- 3. Zauzeće -->
      <section class="admin-card">
        <div class="admin-card-head">
          <div>
            <p class="admin-card-title">{{ t('admin.storagePage.usageTitle') }}</p>
            <p class="admin-card-note">{{ t('admin.storagePage.usageHint') }}</p>
          </div>
        </div>
        <div class="admin-card-body">
          <p v-if="!usage" class="st-muted">{{ t('admin.storagePage.noUsageYet') }}</p>
          <template v-else>
            <div class="st-kpis">
              <div class="st-kpi">
                <p class="st-kpi-label">{{ t('admin.storagePage.kpiStored') }}</p>
                <p class="st-kpi-value">{{ formatBytes(totalBytes) }}</p>
                <p class="st-muted">{{ plural('fileCount', totalFiles) }}</p>
              </div>
              <div class="st-kpi">
                <p class="st-kpi-label">{{ t('admin.storagePage.kpiCost') }}</p>
                <p class="st-kpi-value">{{ formatEur(estimatedCost) }}</p>
                <p class="st-muted">{{ t('admin.storagePage.kpiCostSub') }}</p>
              </div>
              <div class="st-kpi">
                <p class="st-kpi-label">{{ t('admin.storagePage.kpiIncluded') }}</p>
                <div class="st-meter" role="meter" :aria-valuenow="includedPercent" aria-valuemin="0" aria-valuemax="100">
                  <span :style="{ width: Math.min(100, Math.max(includedPercent, 1)) + '%' }"></span>
                </div>
                <p class="st-muted">{{ t('admin.storagePage.kpiIncludedSub', { share: formatPercent(includedPercent), tb: settings.pricing.includedTb }) }}</p>
              </div>
            </div>

            <p class="st-section-label">{{ t('admin.storagePage.byKind') }}</p>
            <ul class="st-bars">
              <li v-for="row in usageRows" :key="row.kind">
                <span class="st-bar-label">
                  {{ t(`admin.storagePage.kinds.${row.kind}`) }}
                  <span class="st-muted">{{ row.items }}</span>
                </span>
                <span class="st-bar-track"><span :style="{ width: row.share + '%' }"></span></span>
                <span class="st-bar-value">{{ formatBytes(row.bytes) }}</span>
              </li>
            </ul>

            <p class="st-section-label">{{ t('admin.storagePage.growthTitle') }}</p>
            <p v-if="usageHistory.length < 2" class="st-muted">{{ t('admin.storagePage.growthEmpty') }}</p>
            <template v-else>
              <div class="st-columns" aria-hidden="true">
                <div v-for="(point, index) in usageHistory" :key="point.id" class="st-column">
                  <span class="st-column-bar" :style="{ height: point.share + '%' }">
                    <span v-if="index === usageHistory.length - 1" class="st-column-label">{{ formatBytes(point.bytes) }}</span>
                  </span>
                  <span class="st-column-tip">{{ formatDate(point.at) }} · {{ formatBytes(point.bytes) }}</span>
                </div>
              </div>
              <div class="st-columns-axis" aria-hidden="true">
                <span>{{ formatDate(usageHistory[0].at) }}</span>
                <span>{{ formatDate(usageHistory[usageHistory.length - 1].at) }}</span>
              </div>
              <table class="visually-hidden">
                <caption>{{ t('admin.storagePage.growthTitle') }}</caption>
                <tbody>
                  <tr v-for="point in usageHistory" :key="point.id">
                    <td>{{ formatDate(point.at) }}</td>
                    <td>{{ formatBytes(point.bytes) }}</td>
                  </tr>
                </tbody>
              </table>
            </template>
          </template>
        </div>
      </section>

      <!-- 4. Pravila -->
      <section class="admin-card">
        <div class="admin-card-head">
          <div>
            <p class="admin-card-title">{{ t('admin.storagePage.policyTitle') }}</p>
            <p class="admin-card-note">{{ t('admin.storagePage.policyHint') }}</p>
          </div>
        </div>
        <div class="admin-card-body">
          <div v-for="group in SETTING_GROUPS" :key="group.key" class="st-group">
            <p class="st-section-label">{{ t(`admin.storagePage.groups.${group.key}`) }}</p>
            <div v-for="field in group.fields" :key="field.key" class="st-setting">
              <div class="st-setting-text">
                <label :for="`st-${field.key}`" class="st-setting-label">{{ t(`admin.storagePage.fields.${field.key}`) }}</label>
                <p class="st-muted">{{ t(`admin.storagePage.fieldHelp.${field.key}`) }}</p>
              </div>
              <select v-if="field.key === 'scanFrequency'" :id="`st-${field.key}`" v-model="form.scanFrequency" class="form-control form-select st-setting-control">
                <option v-for="value in ['weekly', 'daily', 'off']" :key="value" :value="value">{{ t(`admin.storagePage.frequencies.${value}`) }}</option>
              </select>
              <div v-else class="st-setting-control st-unit-field">
                <input
                  :id="`st-${field.key}`"
                  v-model.number="form[field.key]"
                  type="number"
                  class="form-control"
                  :min="field.min"
                  :max="field.max"
                  :step="field.step || 1"
                />
                <span class="st-unit">{{ t(`admin.storagePage.units.${field.unit}`) }}</span>
              </div>
            </div>
          </div>
          <div class="st-save">
            <p v-if="settingsError" class="form-error">{{ settingsError }}</p>
            <p v-else-if="settingsSaved && !settingsDirty" class="st-result">
              <img src="/images/icons/check-success.svg" alt="" class="st-icon" />
              <span>{{ t('dashboard.changesSaved') }}</span>
            </p>
            <button type="button" class="btn btn-primary-flat" :disabled="!settingsDirty || savingSettings" @click="saveSettings">
              {{ savingSettings ? t('common.loading') : t('admin.storagePage.save') }}
            </button>
          </div>
        </div>
      </section>

      <!-- 5. Stari fajlovi -->
      <section class="admin-card">
        <div class="admin-card-head">
          <div>
            <p class="admin-card-title">{{ t('admin.storagePage.migrationTitle') }}</p>
            <p class="admin-card-note">{{ t('admin.storagePage.migrationHint') }}</p>
          </div>
        </div>
        <div class="admin-card-body">
          <div v-if="!legacyTotal" class="st-status is-ok">
            <img src="/images/icons/check-circle.svg" alt="" class="st-status-icon" />
            <div>
              <p class="st-status-title">{{ t('admin.storagePage.migrationDone') }}</p>
              <p class="st-muted">{{ t('admin.storagePage.migrationDoneText') }}</p>
            </div>
          </div>
          <template v-else>
            <p>{{ plural('migrationWaiting', legacyTotal) }}</p>
            <ul class="st-chips">
              <li v-for="row in legacyRows" :key="row.type" class="st-chip">
                {{ t(`admin.storagePage.kinds.${row.type}`) }} <strong>{{ row.count }}</strong>
              </li>
            </ul>
            <div class="st-actions">
              <button type="button" class="btn btn-tertiary btn-sm" :disabled="migrationRunning" @click="startMigration(true)">
                {{ t('admin.storagePage.migrationDryRun') }}
              </button>
              <button type="button" class="btn btn-primary-flat btn-sm" :disabled="migrationRunning" @click="confirmMigration = true">
                {{ t('admin.storagePage.migrationRun') }}
              </button>
            </div>
          </template>
          <p v-if="migrationError" class="form-error">{{ migrationError }}</p>

          <div v-if="migrationRun" class="st-run">
            <p class="st-meta">
              <img :src="migrationRun.status === 'failed' ? '/images/icons/field-error.svg' : migrationRun.status === 'done' ? '/images/icons/check-success.svg' : '/images/icons/clock-line.svg'" alt="" class="st-icon" />
              <span>
                {{ t(`admin.storagePage.migrationStatus.${migrationRun.status}`, {
                  kind: t(migrationRun.dryRun ? 'admin.storagePage.migrationDryRunName' : 'admin.storagePage.migrationRunName'),
                  time: formatDateTime(migrationRun.finishedAt || migrationRun.startedAt),
                }) }}
                <template v-if="migrationRun.error">({{ migrationRun.error }})</template>
              </span>
            </p>
            <ul v-if="migrationRun.report?.counts?.length" class="st-run-list">
              <li v-for="count in migrationRun.report.counts" :key="count.type">
                <span>{{ t(`admin.storagePage.kinds.${count.type}`) }}</span>
                <span class="st-muted">{{ t(migrationRun.dryRun ? 'admin.storagePage.migrationCountsDry' : 'admin.storagePage.migrationCounts', count) }}</span>
              </li>
            </ul>
            <p v-else-if="migrationRun.status === 'done'" class="st-muted">{{ t('admin.storagePage.migrationNothing') }}</p>
            <details v-if="migrationRun.report?.notes?.length" class="st-details st-details-small">
              <summary>
                <span>{{ t('admin.storagePage.migrationNotes', { count: migrationRun.report.notes.length }) }}</span>
                <img src="/images/icons/chevron-down.svg" alt="" class="st-details-chevron" />
              </summary>
              <ul class="st-notes">
                <li v-for="(note, index) in migrationRun.report.notes" :key="index">{{ note }}</li>
              </ul>
            </details>
          </div>
        </div>
      </section>

      <!-- 6. Pretraga po linku -->
      <section class="admin-card">
        <div class="admin-card-head">
          <div>
            <p class="admin-card-title">{{ t('admin.storagePage.lookupTitle') }}</p>
            <p class="admin-card-note">{{ t('admin.storagePage.lookupHint') }}</p>
          </div>
        </div>
        <div class="admin-card-body">
          <form class="st-search" @submit.prevent="lookup">
            <span class="st-search-field">
              <img src="/images/icons/search-line.svg" alt="" class="st-icon" />
              <input v-model="lookupQuery" type="text" class="admin-field" :placeholder="t('admin.storagePage.lookupPlaceholder')" :aria-label="t('admin.storagePage.lookupTitle')" />
            </span>
            <button type="submit" class="btn btn-primary-flat" :disabled="!lookupQuery.trim() || lookingUp">{{ t('admin.storagePage.lookupButton') }}</button>
          </form>
          <p v-if="lookupError" class="form-error">{{ lookupError }}</p>

          <div v-if="lookupResult" class="st-lookup">
            <p v-if="!lookupResult.recognized" class="st-muted">{{ t('admin.storagePage.lookupUnknown') }}</p>
            <template v-else>
              <div class="st-lookup-head">
                <p class="st-item-title">{{ t(`admin.storagePage.kinds.${lookupResult.kind}`) }}</p>
                <span class="admin-pill admin-pill-neutral">{{ t(`admin.storagePage.where.${lookupResult.where}`) }}</span>
                <span v-if="lookupResult.held" class="admin-pill admin-pill-info">{{ t('admin.storagePage.lookupHeld') }}</span>
                <span v-if="lookupResult.pending" class="admin-pill admin-pill-warning">{{ t(`admin.storagePage.tabs.${lookupResult.pending}`) }}</span>
              </div>
              <p class="st-path">{{ lookupResult.location }}</p>

              <p class="st-section-label">{{ t('admin.storagePage.lookupUsedBy') }}</p>
              <p v-if="!lookupResult.usedBy.length" class="st-muted">{{ t('admin.storagePage.lookupUnused') }}</p>
              <ul v-else class="st-run-list">
                <li v-for="use in lookupResult.usedBy" :key="use.type + use.id">
                  <span>
                    {{ t(`admin.storagePage.useTypes.${use.type}`) }}:
                    <NuxtLink v-if="use.link" :to="use.link">{{ use.label }}</NuxtLink>
                    <template v-else>{{ use.label }}</template>
                  </span>
                  <span v-if="use.detail" class="st-muted">{{ use.detail }}</span>
                </li>
              </ul>

              <p class="st-section-label">{{ t('admin.storagePage.lookupFiles') }}</p>
              <p v-if="!lookupResult.files.length" class="form-error">{{ t('admin.storagePage.lookupNoFiles') }}</p>
              <ul v-else class="st-run-list">
                <li v-for="file in lookupResult.files" :key="file.name">
                  <span>{{ file.name }}</span>
                  <span class="st-muted">{{ formatBytes(file.bytes) }}</span>
                </li>
              </ul>
            </template>
          </div>
        </div>
      </section>

      <!-- 7. Istorija -->
      <section class="admin-card">
        <div class="admin-card-head">
          <div>
            <p class="admin-card-title">{{ t('admin.storagePage.historyTitle') }}</p>
            <p class="admin-card-note">{{ t('admin.storagePage.historyHint') }}</p>
          </div>
        </div>
        <div class="admin-card-body">
          <p v-if="!history.length" class="st-muted">{{ t('admin.storagePage.noHistory') }}</p>
          <template v-else>
            <ul class="st-history">
              <li v-for="entry in visibleHistory" :key="entry.id">
                <div class="st-item-text">
                  <p class="st-item-title">{{ t(`admin.storagePage.actions.${entry.action.replace('storage.', '')}`) }}</p>
                  <p v-if="historyDetail(entry)" class="st-item-sub">{{ historyDetail(entry) }}</p>
                </div>
                <p class="st-history-meta">{{ formatDateTime(entry.at) }} · {{ entry.by }}</p>
              </li>
            </ul>
            <button v-if="history.length > HISTORY_SHOWN" type="button" class="btn btn-text btn-sm st-more" @click="historyAll = !historyAll">
              {{ historyAll ? t('admin.storagePage.historyFewer') : t('admin.storagePage.historyAll', { count: history.length }) }}
            </button>
          </template>
        </div>
      </section>
    </template>

    <div v-if="confirmDelete" class="admin-modal-backdrop" @click.self="confirmDelete = false">
      <div class="admin-modal admin-card">
        <div class="admin-card-body">
          <p class="admin-card-title mb-3">{{ plural('confirmDeleteTitle', selected.size) }}</p>
          <p class="mb-3">{{ t('admin.storagePage.confirmDeleteText', { size: formatBytes(selectedBytes) }) }}</p>
          <label v-if="lastDoneScan?.warning" class="admin-check-row mb-3">
            <input v-model="warningAccepted" type="checkbox" class="admin-check" />
            {{ t('admin.storagePage.confirmWarning') }}
          </label>
          <div class="st-actions">
            <button type="button" class="btn btn-danger btn-sm" :disabled="deciding || (lastDoneScan?.warning && !warningAccepted)" @click="deleteSelected">
              {{ t('admin.storagePage.confirmDeleteButton') }}
            </button>
            <button type="button" class="btn btn-tertiary btn-sm" @click="confirmDelete = false">{{ t('common.cancel') }}</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="confirmMigration" class="admin-modal-backdrop" @click.self="confirmMigration = false">
      <div class="admin-modal admin-card">
        <div class="admin-card-body">
          <p class="admin-card-title mb-3">{{ t('admin.storagePage.confirmMigrationTitle') }}</p>
          <p class="mb-3">{{ t('admin.storagePage.confirmMigrationText', { count: legacyTotal }) }}</p>
          <div class="st-actions">
            <button type="button" class="btn btn-primary-flat btn-sm" @click="startMigration(false)">{{ t('admin.storagePage.migrationRun') }}</button>
            <button type="button" class="btn btn-tertiary btn-sm" @click="confirmMigration = false">{{ t('common.cancel') }}</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
// T143: Administracija > Skladište, everything about stored files on one page.
// The storage check only lists what could go; nothing is deleted until an
// admin ticks it here and confirms (decided with the user on 2026-10-11).
definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })
const { t } = useI18n()
const api = useApi()

const POLL_MS = 2000
const ITEMS_PAGE = 100
const HISTORY_SHOWN = 10
const USAGE_KINDS = ['listingPhoto', 'avatar', 'categoryImage', 'homepagePoster', 'attachment', 'other']
const REASONS = ['ORPHAN', 'DELETED_LISTING', 'DELETED_ACCOUNT']
const HEALTH_ICONS = {
  ok: '/images/icons/check-circle.svg',
  failed: '/images/icons/field-error.svg',
  unknown: '/images/icons/clock-line.svg',
}
// The rule fields, grouped the way the card shows them; the limits are the backend's (POLICY_LIMITS).
const SETTING_GROUPS = [
  {
    key: 'retention',
    fields: [
      { key: 'listingPhotoRetentionDays', unit: 'days', min: 1, max: 365 },
      { key: 'accountAttachmentRetentionDays', unit: 'days', min: 1, max: 365 },
      { key: 'scanFrequency' },
    ],
  },
  {
    key: 'sizes',
    fields: [
      { key: 'photoMaxMb', unit: 'mb', min: 1, max: 20 },
      { key: 'attachmentMaxMb', unit: 'mb', min: 1, max: 20 },
    ],
  },
  {
    key: 'pricing',
    fields: [
      { key: 'baseMonthlyEur', unit: 'eur', min: 0, step: 0.01 },
      { key: 'includedTb', unit: 'tb', min: 0, step: 0.1 },
      { key: 'extraTbEur', unit: 'eur', min: 0, step: 0.01 },
    ],
  },
]
const PRICING_FIELDS = ['baseMonthlyEur', 'includedTb', 'extraTbEur']

const { data: overview, error: loadError, refresh } = await useAsyncData('admin-storage', () => api.get('/admin/storage'))
const forbidden = computed(() => loadError.value?.statusCode === 403)

const health = computed(() => overview.value?.health ?? { last: null, lastOkAt: null, lastFailure: null })
const settings = computed(() => overview.value?.settings ?? { pricing: { baseMonthlyEur: 0, includedTb: 1, extraTbEur: 0 } })
const lastScan = computed(() => overview.value?.scans?.[0] ?? null)
const lastDoneScan = computed(() => overview.value?.scans?.find((scan) => scan.status === 'DONE') ?? null)
const scanRunning = computed(() => lastScan.value?.status === 'RUNNING')
const migrationRun = computed(() => overview.value?.migration?.run ?? null)
const migrationRunning = computed(() => migrationRun.value?.status === 'running')
const legacyRows = computed(() =>
  Object.entries(overview.value?.migration?.legacy ?? {})
    .filter(([, count]) => count > 0)
    .map(([type, count]) => ({ type, count })),
)
const legacyTotal = computed(() => legacyRows.value.reduce((sum, row) => sum + row.count, 0))

// -- Connection ---------------------------------------------------------------

const checking = ref(false)
const healthState = computed(() => {
  if (!health.value.last) return 'unknown'
  return health.value.last.ok ? 'ok' : 'failed'
})
const failedCheck = computed(() => health.value.last?.checks?.find((item) => !item.ok) ?? null)
const connectionFacts = computed(() => {
  const c = overview.value?.connection ?? {}
  const facts = [{ label: t('admin.storagePage.driver'), value: t(`admin.storagePage.drivers.${c.driver}`) }]
  if (c.driver === 's3') {
    facts.push(
      { label: t('admin.storagePage.endpoint'), value: `${c.endpoint} (${c.region})` },
      { label: t('admin.storagePage.publicBucket'), value: c.publicBucket },
      { label: t('admin.storagePage.privateBucket'), value: c.privateBucket },
      { label: t('admin.storagePage.accessKey'), value: c.accessKey },
    )
  } else {
    facts.push({ label: t('admin.storagePage.localDir'), value: c.localDir })
  }
  facts.push({ label: t('admin.storagePage.publicBaseUrl'), value: c.publicBaseUrl })
  const versioning = health.value.last?.versioning
  if (versioning?.public || versioning?.private) {
    facts.push({
      label: t('admin.storagePage.versioning'),
      value: t('admin.storagePage.versioningValue', {
        public: versioningLabel(versioning.public),
        private: versioningLabel(versioning.private),
      }),
    })
  }
  return facts
})

async function checkNow() {
  checking.value = true
  try {
    await api.post('/admin/storage/health')
    await refresh()
  } finally {
    checking.value = false
  }
}

function versioningLabel(value) {
  if (value === 'Enabled') return t('admin.storagePage.versioningOn')
  if (value === 'Suspended') return t('admin.storagePage.versioningSuspended')
  if (value === 'Off') return t('admin.storagePage.versioningOff')
  return t('admin.storagePage.versioningUnknown')
}

// -- Rules ----------------------------------------------------------------------

// One flat field per input; the prices go back under `pricing` when saved.
const form = reactive({})
const savingSettings = ref(false)
const settingsSaved = ref(false)
const settingsError = ref('')

function flatten(value) {
  return value ? { ...value, ...value.pricing, pricing: undefined } : {}
}

function applySettings(value) {
  Object.assign(form, flatten(value))
}
applySettings(overview.value?.settings)

const settingsDirty = computed(() =>
  SETTING_GROUPS.flatMap((group) => group.fields).some(
    (field) => form[field.key] !== flatten(overview.value?.settings)[field.key],
  ),
)

function settingsPayload() {
  const pricing = Object.fromEntries(PRICING_FIELDS.map((key) => [key, form[key]]))
  const rest = Object.fromEntries(
    SETTING_GROUPS.flatMap((group) => group.fields)
      .map((field) => field.key)
      .filter((key) => !PRICING_FIELDS.includes(key))
      .map((key) => [key, form[key]]),
  )
  return { ...rest, pricing }
}

async function saveSettings() {
  savingSettings.value = true
  settingsSaved.value = false
  settingsError.value = ''
  try {
    await api.put('/admin/storage/settings', settingsPayload())
    await refresh()
    applySettings(overview.value?.settings)
    settingsSaved.value = true
    loadHistory()
  } catch (error) {
    settingsError.value = extractErrorMessage(error, t('auth.genericError'))
  } finally {
    savingSettings.value = false
  }
}

// -- Storage check: the list to decide on -----------------------------------------

const items = ref([])
const itemsTotal = ref(0)
const reasonFilter = ref('')
const loadingItems = ref(false)
const selected = ref(new Set())
const startingScan = ref(false)
const scanError = ref('')
const deciding = ref(false)
const decisionResult = ref('')
const decisionError = ref('')
const confirmDelete = ref(false)
const warningAccepted = ref(false)

const tabs = computed(() => {
  const pending = overview.value?.pending ?? []
  const count = (reason) => pending.find((group) => group.reason === reason)?.items ?? 0
  return [
    { reason: '', count: pending.reduce((sum, group) => sum + group.items, 0) },
    ...REASONS.map((reason) => ({ reason, count: count(reason) })),
  ]
})
const lastScanText = computed(() => {
  const scan = lastScan.value
  if (!scan) return t('admin.storagePage.noScanYet')
  const who = scan.triggeredBy || t('admin.storagePage.bySchedule')
  return t(`admin.storagePage.scanStatus.${scan.status}`, { time: formatDateTime(scan.finishedAt || scan.startedAt), who })
})
const allSelected = computed(() => items.value.length > 0 && items.value.every((item) => selected.value.has(item.id)))
const selectedBytes = computed(() =>
  items.value.filter((item) => selected.value.has(item.id)).reduce((sum, item) => sum + item.bytes, 0),
)

async function loadItems(more = false) {
  loadingItems.value = true
  try {
    const params = new URLSearchParams({ skip: String(more ? items.value.length : 0), take: String(ITEMS_PAGE) })
    if (reasonFilter.value) params.set('reason', reasonFilter.value)
    const page = await api.get(`/admin/storage/items?${params}`)
    items.value = more ? [...items.value, ...page.items] : page.items
    itemsTotal.value = page.total
    if (!more) selected.value = new Set()
  } finally {
    loadingItems.value = false
  }
}

function setReason(reason) {
  reasonFilter.value = reason
  loadItems()
}

function toggle(id) {
  const next = new Set(selected.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selected.value = next
}

function toggleAll() {
  selected.value = allSelected.value ? new Set() : new Set(items.value.map((item) => item.id))
}

async function startScan() {
  startingScan.value = true
  scanError.value = ''
  decisionResult.value = ''
  try {
    await api.post('/admin/storage/scans')
    await refresh()
  } catch (error) {
    scanError.value = extractErrorMessage(error, t('auth.genericError'))
  } finally {
    startingScan.value = false
  }
}

async function deleteSelected() {
  await decide('delete')
  confirmDelete.value = false
  warningAccepted.value = false
}

function keepSelected() {
  return decide('keep')
}

async function decide(action) {
  deciding.value = true
  decisionResult.value = ''
  decisionError.value = ''
  try {
    const result = await api.post(`/admin/storage/items/${action}`, { ids: [...selected.value] })
    decisionResult.value =
      action === 'delete' ? t('admin.storagePage.deleteResult', result) : t('admin.storagePage.keepResult', result)
    await refresh()
    // A group emptied by this decision gives way to the whole list.
    if (reasonFilter.value && !overview.value?.pending?.some((group) => group.reason === reasonFilter.value)) {
      reasonFilter.value = ''
    }
    await Promise.all([loadItems(), loadHistory()])
    if (holdsOpen.value) await loadHolds()
  } catch (error) {
    decisionError.value = extractErrorMessage(error, t('auth.genericError'))
  } finally {
    deciding.value = false
  }
}

function itemTitle(item) {
  const context = item.context || {}
  if (item.reason === 'DELETED_LISTING' && context.title) return context.title
  if (item.reason === 'DELETED_ACCOUNT' && context.filename) return context.filename
  return t(`admin.storagePage.kinds.${item.kind}`)
}

function itemSubtitle(item) {
  const context = item.context || {}
  if (item.reason === 'DELETED_LISTING') {
    return t('admin.storagePage.listingSub', { date: formatDate(context.deletedAt), due: formatDate(item.dueAt) })
  }
  if (item.reason === 'DELETED_ACCOUNT') {
    return t('admin.storagePage.accountSub', { date: formatDate(context.accountDeletedAt), due: formatDate(item.dueAt) })
  }
  return t('admin.storagePage.orphanSub', { date: formatDate(item.lastModified) })
}

// -- Kept files -----------------------------------------------------------------------

const holds = ref([])
const holdsOpen = ref(false)

async function loadHolds() {
  holds.value = await api.get('/admin/storage/holds')
}

async function toggleHolds() {
  holdsOpen.value = !holdsOpen.value
  if (holdsOpen.value) await loadHolds()
}

async function removeHold(id) {
  await api.delete(`/admin/storage/holds/${id}`)
  await Promise.all([loadHolds(), refresh(), loadHistory()])
}

// -- Usage ---------------------------------------------------------------------------

// Hetzner bills decimal terabytes.
const TB = 1e12
const usage = computed(() => lastDoneScan.value?.usage ?? null)
const totalBytes = computed(() => (usage.value ? usage.value.public.bytes + usage.value.private.bytes : 0))
const totalFiles = computed(() => (usage.value ? usage.value.public.files + usage.value.private.files : 0))
const usageRows = computed(() => {
  const rows = USAGE_KINDS.map((kind) => ({ kind, ...(usage.value?.kinds?.[kind] ?? { items: 0, files: 0, bytes: 0 }) }))
  const largest = Math.max(1, ...rows.map((row) => row.bytes))
  return rows.filter((row) => row.files > 0).map((row) => ({ ...row, share: Math.max(1, (row.bytes / largest) * 100) }))
})
const estimatedCost = computed(() => {
  const pricing = settings.value.pricing
  return pricing.baseMonthlyEur + Math.max(0, totalBytes.value / TB - pricing.includedTb) * pricing.extraTbEur
})
const includedPercent = computed(() => {
  const included = settings.value.pricing.includedTb
  return included ? (totalBytes.value / (included * TB)) * 100 : 0
})
const usageHistory = computed(() => {
  const points = (overview.value?.scans ?? [])
    .filter((scan) => scan.status === 'DONE' && scan.usage)
    .map((scan) => ({ id: scan.id, at: scan.finishedAt, bytes: scan.usage.public.bytes + scan.usage.private.bytes }))
    .reverse()
  const largest = Math.max(1, ...points.map((point) => point.bytes))
  return points.map((point) => ({ ...point, share: Math.max(2, (point.bytes / largest) * 100) }))
})

// -- Files from before T143 ---------------------------------------------------------------

const confirmMigration = ref(false)
const migrationError = ref('')

async function startMigration(dryRun) {
  confirmMigration.value = false
  migrationError.value = ''
  try {
    await api.post('/admin/storage/migration', { dryRun })
    await refresh()
  } catch (error) {
    migrationError.value = extractErrorMessage(error, t('auth.genericError'))
  }
}

// -- Lookup ---------------------------------------------------------------------------------

const lookupQuery = ref('')
const lookupResult = ref(null)
const lookupError = ref('')
const lookingUp = ref(false)

async function lookup() {
  lookingUp.value = true
  lookupError.value = ''
  try {
    lookupResult.value = await api.get(`/admin/storage/lookup?q=${encodeURIComponent(lookupQuery.value.trim())}`)
  } catch (error) {
    lookupError.value = extractErrorMessage(error, t('auth.genericError'))
  } finally {
    lookingUp.value = false
  }
}

// -- History ----------------------------------------------------------------------------------

const history = ref([])
const historyAll = ref(false)
const visibleHistory = computed(() => (historyAll.value ? history.value : history.value.slice(0, HISTORY_SHOWN)))

async function loadHistory() {
  history.value = await api.get('/admin/storage/history').catch(() => history.value)
}

function historyDetail(entry) {
  const value = entry.newValue || {}
  switch (entry.action) {
    case 'storage.files_deleted':
      return t('admin.storagePage.deleteResult', value)
    case 'storage.files_kept':
      return t('admin.storagePage.keepResult', { kept: value.kept })
    case 'storage.settings_updated': {
      const before = entry.oldValue || {}
      return Object.keys(value)
        .filter((key) => JSON.stringify(value[key]) !== JSON.stringify(before[key]))
        .map((key) => t(`admin.storagePage.settingNames.${key}`))
        .join(', ')
    }
    case 'storage.migration_started':
      return t(value.dryRun ? 'admin.storagePage.migrationDryRunName' : 'admin.storagePage.migrationRunName')
    case 'storage.migration_finished':
      return (value.counts || []).map((count) => `${t(`admin.storagePage.kinds.${count.type}`)}: ${count.moved}`).join(', ')
    default:
      return ''
  }
}

// -- Formatting -----------------------------------------------------------------------------------

/** A string whose words follow the count (1 fajl, 2 fajla, 5 fajlova). */
function plural(key, count) {
  return t(`admin.storagePage.${key}${srPluralCategory(count)}`, { count })
}

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1000)))
  return `${(bytes / 1000 ** index).toLocaleString('sr-RS', { maximumFractionDigits: index ? 1 : 0 })} ${units[index]}`
}

function formatEur(value) {
  return `${value.toLocaleString('sr-RS', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
}

function formatPercent(value) {
  if (value > 0 && value < 0.01) return '< 0,01'
  return value.toLocaleString('sr-RS', { maximumFractionDigits: 2 })
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString('sr-RS', { day: 'numeric', month: 'numeric', year: 'numeric' }) : '-'
}

// -- Loading and following what runs ---------------------------------------------------------------

let pollTimer = null
function schedulePoll() {
  clearTimeout(pollTimer)
  if (scanRunning.value || migrationRunning.value) pollTimer = setTimeout(() => refresh(), POLL_MS)
}
watch(
  () => [scanRunning.value, migrationRunning.value],
  ([scan, migration], previous) => {
    // A check that just finished has a new list; a finished move a new history entry.
    if (previous?.[0] && !scan) loadItems()
    if (previous?.[1] && !migration) loadHistory()
  },
)
watch(overview, schedulePoll)
onBeforeUnmount(() => clearTimeout(pollTimer))

onMounted(() => {
  if (!overview.value) return
  loadItems()
  loadHistory()
  schedulePoll()
})

useSeoMeta({ title: t('admin.storagePage.title') })
</script>

<style lang="scss" scoped>
.st-muted {
  font-size: 13px;
  font-weight: 300;
  line-height: 1.4;
  color: $color-text-muted;
}

.st-icon {
  flex: 0 0 auto;
  width: 16px;
  height: 16px;
}

.st-section-label {
  margin: 24px 0 10px;
  font-size: 13px;
  font-weight: 500;
  color: $color-text-muted;
}

.st-section-label:first-child {
  margin-top: 0;
}

// -- Connection -------------------------------------------------------------------

.st-status {
  display: flex;
  align-items: center;
  gap: 14px;
}

.st-status-icon {
  flex: 0 0 auto;
  width: 36px;
  height: 36px;
}

.st-status-title {
  font-size: 17px;
  font-weight: 500;
  color: $color-text;
}

.st-status.is-failed .st-status-title {
  color: $color-error;
}

.st-alert,
.st-note,
.st-meta,
.st-result {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 14px;
  line-height: 1.45;
}

.st-alert {
  margin-top: 14px;
  padding: 12px 14px;
  border-radius: $radius-input;
}

.st-alert .st-icon,
.st-note .st-icon,
.st-meta .st-icon,
.st-result .st-icon {
  margin-top: 2px;
}

.st-alert.is-critical {
  background: #fdeff1;
  color: $color-error;
}

.st-alert.is-warning {
  background: $color-warning-bg;
  color: $color-text;
}

.st-note {
  margin-top: 14px;
  font-size: 13px;
  color: $color-text-muted;
}

.st-meta {
  color: $color-text-muted;
}

.st-result {
  margin-top: 14px;
  color: $color-text;
}

.st-details {
  margin-top: 18px;
  border-top: 1px solid $color-border;
}

.st-details summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 0 0;
  font-size: 14px;
  font-weight: 500;
  color: $color-primary;
  list-style: none;
  cursor: pointer;
}

.st-details summary::-webkit-details-marker {
  display: none;
}

.st-details-chevron {
  width: 16px;
  height: 16px;
  transition: transform 0.15s ease;
}

.st-details[open] .st-details-chevron {
  transform: rotate(180deg);
}

.st-details-body {
  padding-top: 16px;
}

.st-details-small {
  margin-top: 14px;
}

.st-steps {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 14px;
}

.st-steps li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
}

.st-facts {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px 24px;
  margin: 0;
}

.st-facts dt {
  font-size: 12px;
  font-weight: 400;
  color: $color-text-muted;
}

.st-facts dd {
  margin: 2px 0 0;
  font-size: 14px;
  word-break: break-all;
}

// -- The list to decide on --------------------------------------------------------------

.st-meta + .form-error {
  margin-top: 8px;
}

.st-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 18px;
}

.st-tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 0 14px;
  border: 1px solid $color-border;
  border-radius: $radius-pill;
  background: $color-surface;
  font-family: $font-family-base;
  font-size: 13px;
  font-weight: 500;
  color: $color-text;
  cursor: pointer;
}

.st-tab:hover {
  border-color: $color-primary;
}

.st-tab.is-active {
  border-color: $color-primary;
  background: $color-accent-tint;
  color: $color-primary;
}

.st-tab-count {
  min-width: 20px;
  padding: 1px 6px;
  border-radius: $radius-pill;
  background: $color-background;
  font-size: 12px;
  text-align: center;
  color: $color-text-muted;
}

.st-tab.is-active .st-tab-count {
  background: $color-surface;
  color: $color-primary;
}

.st-empty {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 18px;
  padding: 18px;
  border-radius: $radius-input;
  background: $color-background;
  font-size: 14px;
  color: $color-text-muted;
}

.st-empty-icon {
  width: 18px;
  height: 18px;
}

.st-select-all {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin: 18px 0 8px;
  font-size: 13px;
  color: $color-text-muted;
  cursor: pointer;
}

.st-list,
.st-hold-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.st-item,
.st-hold-list li {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 8px;
  border-top: 1px solid $color-border;
}

.st-item.is-selected {
  background: $color-accent-tint;
}

.st-thumb {
  flex: 0 0 auto;
  width: 56px;
  height: 42px;
  border-radius: 6px;
  object-fit: cover;
  background: $color-background;
}

.st-thumb-file {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.st-thumb-file img {
  width: 18px;
  height: 18px;
}

.st-item-text {
  flex: 1 1 auto;
  min-width: 0;
}

.st-item-title {
  overflow: hidden;
  font-size: 14px;
  font-weight: 500;
  color: $color-text;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.st-item-sub {
  margin-top: 2px;
  font-size: 13px;
  font-weight: 300;
  color: $color-text-muted;
}

.st-item-sub.is-overdue {
  color: $color-error;
}

.st-item-size {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: flex-end;
  font-size: 14px;
}

.st-more {
  margin-top: 8px;
}

.st-bulk {
  position: sticky;
  bottom: 12px;
  z-index: 2;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 14px;
  padding: 12px 16px;
  border-radius: $radius-input;
  background: $color-dark;
  font-size: 14px;
  color: $color-surface;
}

.st-bulk-actions {
  display: flex;
  gap: 8px;
}

.st-bulk .btn-danger {
  border-color: #ff8a9a;
  color: #ffd5db;
}

.st-holds {
  margin-top: 18px;
  padding-top: 12px;
  border-top: 1px solid $color-border;
}

.st-holds > .btn-text {
  padding-left: 0;
}

.st-hold-list {
  margin-top: 8px;
}

// -- Usage ----------------------------------------------------------------------------

.st-kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.st-kpi {
  padding: 16px;
  border: 1px solid $color-border;
  border-radius: $radius-input;
}

.st-kpi-label {
  font-size: 13px;
  color: $color-text-muted;
}

.st-kpi-value {
  margin: 4px 0 2px;
  font-size: 24px;
  font-weight: 600;
  line-height: 1.2;
  color: $color-text;
}

.st-meter {
  height: 8px;
  margin: 12px 0 8px;
  border-radius: 4px;
  background: $color-accent-tint;
  overflow: hidden;
}

.st-meter span {
  display: block;
  height: 100%;
  border-radius: 4px;
  background: $color-primary;
}

.st-bars {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.st-bars li {
  display: grid;
  grid-template-columns: minmax(150px, 220px) 1fr 76px;
  align-items: center;
  gap: 12px;
  font-size: 14px;
}

.st-bar-label .st-muted {
  margin-left: 4px;
}

.st-bar-track {
  height: 8px;
  border-radius: 0 4px 4px 0;
}

.st-bar-track span {
  display: block;
  height: 100%;
  border-radius: 0 4px 4px 0;
  background: $color-primary;
}

.st-bar-value {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.st-columns {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  height: 120px;
  padding-top: 20px;
  border-bottom: 1px solid $color-border;
}

.st-column {
  position: relative;
  display: flex;
  flex: 1 1 0;
  align-items: flex-end;
  justify-content: center;
  height: 100%;
}

.st-column-bar {
  position: relative;
  display: block;
  width: 100%;
  max-width: 24px;
  border-radius: 4px 4px 0 0;
  background: $color-primary;
}

// The latest value, on its column's cap.
.st-column-label {
  position: absolute;
  bottom: calc(100% + 4px);
  left: 50%;
  transform: translateX(-50%);
  font-size: 12px;
  white-space: nowrap;
  color: $color-text;
}

.st-column-tip {
  position: absolute;
  bottom: calc(100% + 6px);
  z-index: 3;
  display: none;
  padding: 6px 8px;
  border-radius: 6px;
  background: $color-dark;
  font-size: 12px;
  white-space: nowrap;
  color: $color-surface;
}

.st-column:hover .st-column-tip {
  display: block;
}

.st-column:hover .st-column-bar {
  opacity: 0.85;
}

.st-columns-axis {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  font-size: 12px;
  color: $color-text-muted;
}

// -- Rules -----------------------------------------------------------------------------

.st-group + .st-group {
  margin-top: 8px;
}

.st-setting {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 24px;
  padding: 14px 0;
  border-top: 1px solid $color-border;
}

.st-setting-text {
  flex: 1 1 320px;
}

.st-setting-label {
  font-size: 14px;
  font-weight: 500;
  color: $color-text;
}

.st-setting-control {
  flex: 0 0 200px;
  max-width: 100%;
}

.st-unit-field {
  position: relative;
}

.st-unit-field .form-control {
  padding-right: 56px;
}

.st-unit {
  position: absolute;
  top: 50%;
  right: 14px;
  transform: translateY(-50%);
  font-size: 13px;
  color: $color-text-muted;
  pointer-events: none;
}

.st-save {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 8px;
  padding-top: 16px;
  border-top: 1px solid $color-border;
}

.st-save .st-result {
  margin-top: 0;
}

// -- Files from before T143 ----------------------------------------------------------------

.st-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
}

.st-chip {
  padding: 6px 12px;
  border-radius: $radius-pill;
  background: $color-background;
  font-size: 13px;
}

.st-chip strong {
  margin-left: 4px;
  font-weight: 600;
}

.st-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 16px;
}

.st-run {
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid $color-border;
}

.st-run-list,
.st-notes {
  display: grid;
  gap: 6px;
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
  font-size: 14px;
}

.st-run-list li {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px 16px;
}

.st-notes {
  font-size: 13px;
  color: $color-text-muted;
}

// -- Lookup -----------------------------------------------------------------------------------

.st-search {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.st-search-field {
  position: relative;
  flex: 1 1 360px;
}

.st-search-field .st-icon {
  position: absolute;
  top: 50%;
  left: 14px;
  transform: translateY(-50%);
}

.st-search-field .admin-field {
  width: 100%;
  padding-left: 40px;
}

.st-lookup {
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid $color-border;
}

.st-lookup-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.st-path {
  margin-top: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  color: $color-text-muted;
  word-break: break-all;
}

// -- History -----------------------------------------------------------------------------------

.st-history {
  margin: 0;
  padding: 0;
  list-style: none;
}

.st-history li {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 2px 24px;
  padding: 12px 0;
  border-top: 1px solid $color-border;
}

.st-history li:first-child {
  border-top: 0;
  padding-top: 0;
}

.st-history .st-item-title {
  white-space: normal;
}

.st-history-meta {
  font-size: 13px;
  color: $color-text-muted;
  white-space: nowrap;
}

@include mobile-only {
  .st-item {
    align-items: flex-start;
  }

  .st-kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .st-kpi {
    padding: 12px;
  }

  .st-kpi:last-child {
    grid-column: 1 / -1;
  }

  .st-kpi-value {
    font-size: 20px;
  }

  // Above the phone's bottom menu.
  .st-bulk {
    bottom: 96px;
  }

  .st-bars li {
    grid-template-columns: 1fr 76px;
  }

  .st-bar-track {
    grid-column: 1 / -1;
    order: 3;
  }
}
</style>
