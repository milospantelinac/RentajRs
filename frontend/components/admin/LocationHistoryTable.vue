<template>
  <table class="admin-table">
    <thead>
      <tr>
        <th>{{ t('admin.cat.historyWhen') }}</th>
        <th>{{ t('admin.cat.historyWho') }}</th>
        <th>{{ t('admin.cat.historyWhat') }}</th>
        <th>{{ t('admin.cat.historyChanges') }}</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="row in rows" :key="row.id">
        <td :data-label="t('admin.cat.historyWhen')">{{ formatDateTime(row.createdAt) }}</td>
        <td :data-label="t('admin.cat.historyWho')">
          {{ [row.user?.firstName, row.user?.lastName].filter(Boolean).join(' ') || row.user?.email || '-' }}
        </td>
        <td :data-label="t('admin.cat.historyWhat')">
          {{ actionLabel(row) }}<span v-if="subject(row)" class="admin-cell-sub loc-history-subject">{{ subject(row) }}</span>
        </td>
        <td :data-label="t('admin.cat.historyChanges')">
          <ul v-if="changesOf(row).length" class="loc-history-diff">
            <li v-for="change in changesOf(row)" :key="change.field">
              <strong>{{ change.label }}</strong>: {{ change.from }} → {{ change.to }}
            </li>
          </ul>
          <span v-else class="admin-cell-sub">{{ row.action.endsWith('.update') ? t('admin.cat.historyNoDiff') : '' }}</span>
        </td>
      </tr>
    </tbody>
  </table>
</template>

<script setup>
// T119: the history of Administracija > Lokacije, from the AdminLog rows the
// location admin writes (region.*, city.*, area.*), read like the category
// screen's history: who, when, and the fields that changed.
const props = defineProps({
  rows: { type: Array, required: true },
  regions: { type: Array, default: () => [] },
})

const { t } = useI18n()

const FIELDS = ['name', 'slug', 'municipality', 'kind', 'nameLocative', 'regionId', 'hidden', 'listingsMoved']

function actionLabel(row) {
  // The locale keys use _ for the action's dot, which vue-i18n reads as nesting.
  const key = `admin.loc.actions.${row.action.replace('.', '_')}`
  const label = t(key)
  return label === key ? row.action : label
}

// Which okrug, place or part the row is about; deleted ones only live here.
function subject(row) {
  return (row.newValue || row.oldValue || {}).name || ''
}

const regionName = (id) => props.regions.find((region) => region.id === id)?.name || id

function show(field, value) {
  if (value === undefined || value === null || value === '') return t('admin.cat.empty')
  if (typeof value === 'boolean') return value ? t('admin.cat.yes') : t('admin.cat.no')
  if (field === 'regionId') return regionName(value)
  if (field === 'kind') return t(`admin.loc.kinds.${value}`)
  return String(value)
}

function changesOf(row) {
  // A new or deleted row lists nothing: its name is in the "what" column.
  if (!row.oldValue || !row.newValue) return []
  return FIELDS.filter((field) => field in row.oldValue || field in row.newValue)
    .filter((field) => JSON.stringify(row.oldValue[field] ?? null) !== JSON.stringify(row.newValue[field] ?? null))
    .filter((field) => field !== 'listingsMoved' || row.newValue.listingsMoved)
    .map((field) => ({
      field,
      label: t(`admin.loc.fields.${field}`),
      from: field === 'listingsMoved' ? '0' : show(field, row.oldValue[field]),
      to: show(field, row.newValue[field]),
    }))
}
</script>

<style lang="scss" scoped>
.loc-history-subject {
  display: block;
}

.loc-history-diff {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  line-height: 1.5;
}
</style>
