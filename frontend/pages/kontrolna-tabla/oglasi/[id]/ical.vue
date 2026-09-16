<template>
  <div class="ical">
    <NuxtLink to="/kontrolna-tabla/oglasi" class="ical-breadcrumb">
      <img src="/images/icons/chevron-left-muted.svg" alt="" width="16" height="16" />
      <span class="ical-breadcrumb-text">{{ breadcrumb }}</span>
    </NuxtLink>

    <header class="ical-heading">
      <h1 class="ical-title">{{ t('ical.title') }}</h1>
      <p class="ical-subtitle">{{ t('ical.subtitle') }}</p>
    </header>

    <!-- Dizajn 44: a failed load and a listing that can't connect calendars
         both say so in one card, in place of the two the frame draws. -->
    <section v-if="error" class="ical-card ical-state is-error">
      <DashboardNavIcon name="bookings" class="ical-state-icon" />
      <p class="ical-state-title">{{ t('ical.loadErrorTitle') }}</p>
      <p class="ical-state-text">{{ t('ical.loadErrorText') }}</p>
      <button type="button" class="ical-state-button" @click="reload()">{{ t('errorPage.tryAgain') }}</button>
    </section>

    <section v-else-if="locked" class="ical-card ical-state">
      <DashboardNavIcon name="bookings" class="ical-state-icon" />
      <p class="ical-state-title">{{ t(`ical.locked.${locked.key}.title`) }}</p>
      <p class="ical-state-text">{{ t(`ical.locked.${locked.key}.text`) }}</p>
      <NuxtLink :to="locked.action.to" class="ical-state-button">{{ locked.action.label }}</NuxtLink>
    </section>

    <template v-else>
      <section class="ical-card" aria-labelledby="ical-export-title">
        <h2 id="ical-export-title" class="ical-card-title">{{ t('ical.exportTitle') }}</h2>
        <p class="ical-card-text">{{ t('ical.exportText') }}</p>
        <div class="ical-row">
          <input
            ref="exportInput"
            :value="exportUrl"
            type="text"
            class="ical-field"
            readonly
            :aria-label="t('ical.exportLabel')"
            @focus="$event.target.select()"
          />
          <button type="button" class="ical-button ical-copy" @click="copyExportUrl">
            {{ copied ? t('common.copied') : t('common.copy') }}
          </button>
        </div>
      </section>

      <section class="ical-card" aria-labelledby="ical-sources-title">
        <h2 id="ical-sources-title" class="ical-card-title">{{ t('ical.sourcesTitle') }}</h2>

        <p v-if="removeError" class="ical-alert" role="alert">
          <img src="/images/icons/field-error.svg" alt="" width="16" height="16" />
          {{ removeError }}
        </p>

        <ul v-if="rows.length" class="ical-list">
          <li v-for="row in rows" :key="row.id" class="ical-source">
            <div class="ical-source-text">
              <p class="ical-source-name" :title="row.url">{{ row.name }}</p>
              <p class="ical-source-detail" :class="{ 'is-error': row.failed }">{{ row.detail }}</p>
            </div>
            <span class="ical-pill" :class="{ 'is-error': row.failed }">{{ row.statusText }}</span>
            <button
              type="button"
              class="ical-remove"
              :disabled="removingId === row.id"
              :aria-label="t('ical.removeLabel', { name: row.name })"
              @click="removeSource(row)"
            >
              {{ t('ical.remove') }}
            </button>
          </li>
        </ul>

        <!-- Dizajn 44 inside the list's own box; the form right under it is the action. -->
        <div v-else class="ical-list ical-empty">
          <DashboardNavIcon name="bookings" class="ical-state-icon" />
          <p class="ical-state-title">{{ t('ical.emptyTitle') }}</p>
          <p class="ical-state-text">{{ t('ical.emptyText') }}</p>
        </div>

        <form class="ical-add" novalidate @submit.prevent="addSource">
          <div class="ical-row ical-add-row">
            <input
              ref="addInput"
              v-model="newUrl"
              type="text"
              inputmode="url"
              class="ical-field"
              :class="{ 'is-invalid': addError }"
              :placeholder="t('ical.addPlaceholder')"
              :aria-label="t('ical.addLabel')"
              :aria-invalid="addError ? 'true' : undefined"
              :aria-describedby="addError ? 'ical-add-error' : undefined"
              autocomplete="off"
              spellcheck="false"
              @input="addError = ''"
            />
            <button type="submit" class="ical-button ical-button-primary" :disabled="adding">
              {{ adding ? t('ical.adding') : t('ical.add') }}
            </button>
          </div>
          <p v-if="addError" id="ical-add-error" class="ical-error" role="alert">
            <img src="/images/icons/field-error.svg" alt="" width="15" height="15" />
            {{ addError }}
          </p>
        </form>

        <p class="ical-note">
          <img src="/images/icons/info-circle.svg" alt="" width="16" height="16" />
          <span>{{ t('ical.note') }}</span>
        </p>
      </section>
    </template>
  </div>
</template>

<script setup>
// Dizajn 33 (frame 572:641): one listing's calendar sync, under Moji oglasi.
// The feed other platforms read, the calendars this listing imports and the
// form that adds one; the backend fetches an address before keeping it and
// imports it at once, then every hour.
import { buildIcalSourceRow, formatIcalBreadcrumb, getIcalExportUrl, getIcalLockedState } from '~/utils/icalSync'

definePageMeta({ middleware: 'auth', layout: 'dashboard' })
const { t } = useI18n()
const api = useApi()
const route = useRoute()
const config = useRuntimeConfig()
const listingId = route.params.id

const { data: overview, error, refresh } = await useAsyncData(`ical-${listingId}`, () =>
  api.get(`/listings/${listingId}/availability/ical`).catch((e) => {
    // Someone else's listing, a deleted one or a made-up id: this page doesn't exist for them.
    if ([400, 403, 404].includes(e?.response?.status)) return null
    throw e
  }),
)
if (!error.value && !overview.value) {
  throw createError({ statusCode: 404, statusMessage: 'Listing not found', fatal: true })
}

const breadcrumb = computed(() => (overview.value ? formatIcalBreadcrumb(t, overview.value.listing) : t('listing.myListings')))
const locked = computed(() =>
  overview.value && overview.value.availability !== 'AVAILABLE' ? getIcalLockedState(t, overview.value) : null,
)
const exportUrl = computed(() =>
  overview.value?.exportToken ? getIcalExportUrl(config.public.siteUrl, overview.value.exportToken) : '',
)

// The server's clock renders the "pre 12 minuta" lines and the browser keeps
// them moving, so hydration reads the same text.
const now = useState(`ical-now-${listingId}`, () => Date.now())
const rows = computed(() => (overview.value?.sources || []).map((source) => buildIcalSourceRow(t, source, now.value)))

let clockTimer
onMounted(() => {
  clockTimer = setInterval(() => (now.value = Date.now()), 30_000)
})
onUnmounted(() => {
  clearInterval(clockTimer)
  clearTimeout(copiedTimer)
})

async function reload() {
  await refresh()
  now.value = Date.now()
}

const exportInput = ref(null)
const copied = ref(false)
let copiedTimer
async function copyExportUrl() {
  try {
    await navigator.clipboard.writeText(exportUrl.value)
  } catch {
    // No clipboard API (an insecure origin): the selected field is copied the old way.
    exportInput.value?.select()
    document.execCommand('copy')
  }
  copied.value = true
  clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => (copied.value = false), 2000)
}

const addInput = ref(null)
const newUrl = ref('')
const adding = ref(false)
const addError = ref('')

async function addSource() {
  const url = newUrl.value.trim()
  if (!url) {
    addError.value = t('ical.urlRequired')
    addInput.value?.focus()
    return
  }
  adding.value = true
  addError.value = ''
  removeError.value = ''
  try {
    await api.post(`/listings/${listingId}/availability/ical-sources`, { url })
    newUrl.value = ''
    await reload()
  } catch (e) {
    addError.value = extractErrorMessage(e, t('auth.genericError'))
    addInput.value?.focus()
  } finally {
    adding.value = false
  }
}

const removingId = ref(null)
const removeError = ref('')

async function removeSource(row) {
  const index = rows.value.findIndex((item) => item.id === row.id)
  removingId.value = row.id
  removeError.value = ''
  try {
    await api.delete(`/listings/${listingId}/availability/ical-sources/${row.id}`)
    await reload()
    // Focus stays in the list: the row that took this one's place, or the form.
    await nextTick()
    const buttons = document.querySelectorAll('.ical-remove')
    ;(buttons[Math.min(index, buttons.length - 1)] || addInput.value)?.focus()
  } catch (e) {
    removeError.value = extractErrorMessage(e, t('auth.genericError'))
    // A calendar already removed elsewhere leaves the list too.
    await reload().catch(() => {})
  } finally {
    removingId.value = null
  }
}

useSeoMeta({ title: t('ical.title') })
</script>

<style lang="scss" scoped>
// Dizajn 33, frame 572:728: the breadcrumb, the heading and two white cards,
// 20 apart. This frame's content column has none of the 4 / 8 padding
// 357:493 gives the dashboard's, so the page takes it back.
$ical-danger-bg: #fcd8e0;
$ical-danger-border: #f43f5e;

.ical {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin: -4px -8px 0;
}

// 572:924
.ical-breadcrumb {
  display: flex;
  align-self: flex-start;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  font-size: 14px;
  font-weight: 400;
  line-height: normal;
  color: $color-text-muted;
}

.ical-breadcrumb img {
  display: block;
  flex-shrink: 0;
}

.ical-breadcrumb-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ical-breadcrumb:hover {
  color: $color-primary;
}

// 572:928
.ical-heading {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ical-title {
  font-size: 26px;
  font-weight: 600;
  line-height: normal;
  color: $color-text;
}

.ical-subtitle {
  font-size: 14px;
  font-weight: 300;
  line-height: normal;
  color: $color-text-muted;
}

// 572:931, 572:939: Figma's stroke sits inside the 26 / 28 padding.
.ical-card {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 25px 27px;
  border: 1px solid $color-border;
  border-radius: 20px;
  background: $color-surface;
}

// 572:932
.ical-card-title {
  font-size: 17px;
  font-weight: 600;
  line-height: normal;
  color: $color-text;
}

// 572:933
.ical-card-text {
  font-size: 14px;
  font-weight: 400;
  line-height: 21px;
  color: $color-text-muted;
}

// 572:934, 572:963
.ical-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

// 572:935, 572:964: 46 tall on the page grey. The stroke is an inset shadow so
// focus and error can draw Dizajn 6's 1.5px one without moving the text.
.ical-field {
  flex: 1 1 0;
  min-width: 0;
  height: 46px;
  margin: 0;
  padding: 0 16px;
  border: 0;
  border-radius: $radius-input;
  background-color: $color-background;
  box-shadow: inset 0 0 0 1px $color-border;
  font-family: $font-family-base;
  font-size: 14px;
  font-weight: 400;
  line-height: normal;
  color: $color-text;
  text-overflow: ellipsis;
  transition:
    background-color 0.15s ease,
    box-shadow 0.15s ease;
}

.ical-field::placeholder {
  color: $color-text-muted;
  opacity: 1;
}

.ical-field:focus {
  outline: none;
  background-color: $color-surface;
  box-shadow: inset 0 0 0 1.5px $color-primary;
}

.ical-field.is-invalid {
  background-color: $ical-danger-bg;
  box-shadow: inset 0 0 0 1.5px $ical-danger-border;
}

// 572:937: 22 either side of "Kopiraj"; the width holds when it reads "Kopirano".
.ical-button {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  height: 46px;
  padding: 0 12px;
  border: 0;
  border-radius: $radius-button;
  background-color: $color-surface;
  box-shadow: inset 0 0 0 1px $color-border;
  font-family: $font-family-base;
  font-size: 14px;
  font-weight: 500;
  line-height: normal;
  color: $color-text;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    box-shadow 0.15s ease,
    color 0.15s ease;
}

.ical-copy {
  min-width: 89px;
}

.ical-copy:hover {
  box-shadow: inset 0 0 0 1px $color-primary;
  color: $color-primary;
}

// 572:966: 22 either side of "Dodaj kalendar"; the width holds while it checks the address.
.ical-button-primary {
  min-width: 139px;
  background-color: $color-primary;
  box-shadow: none;
  color: $color-surface;
}

.ical-button-primary:hover:not(:disabled) {
  background-color: $color-dark;
}

.ical-button-primary:disabled {
  cursor: progress;
  opacity: 0.7;
}

.ical-alert {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-radius: $radius-input;
  background: #fdeff1;
  font-size: 13px;
  line-height: normal;
  color: $color-error;
}

// 572:941: rows 66 tall, the lines between them drawn inside the rows.
.ical-list {
  margin: 0;
  padding: 0;
  border: 1px solid $color-border;
  border-radius: 14px;
  background: $color-surface;
  list-style: none;
  overflow: hidden;
}

// 572:942
.ical-source {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 17px 15px;
}

.ical-source + .ical-source {
  border-top: 1px solid $color-border;
}

.ical-source:last-child {
  padding-bottom: 14px;
}

// 572:943
.ical-source-text {
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.ical-source-name {
  overflow: hidden;
  font-size: 15px;
  font-weight: 500;
  line-height: normal;
  color: $color-text;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ical-source-detail {
  font-size: 12px;
  font-weight: 300;
  line-height: normal;
  color: $color-text-muted;
  overflow-wrap: anywhere;
}

// 572:959
.ical-source-detail.is-error {
  color: $color-error;
}

// 572:946, 572:960
.ical-pill {
  flex-shrink: 0;
  padding: 6px 12px;
  border-radius: $radius-pill;
  background: #cdfad1;
  font-size: 12px;
  font-weight: 500;
  line-height: normal;
  color: #1db82b;
  white-space: nowrap;
}

.ical-pill.is-error {
  background: #fdeff1;
  color: $color-error;
}

// 572:948
.ical-remove {
  flex-shrink: 0;
  padding: 0;
  border: 0;
  background: none;
  font-family: $font-family-base;
  font-size: 13px;
  font-weight: 500;
  line-height: normal;
  color: $color-primary;
  white-space: nowrap;
  cursor: pointer;
}

.ical-remove:hover:not(:disabled) {
  text-decoration: underline;
}

.ical-remove:disabled {
  cursor: progress;
  opacity: 0.5;
}

// 214:438: Dizajn 6's message under the field.
.ical-error {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 8px;
  font-size: 13px;
  line-height: normal;
  color: $color-error;
}

.ical-error img {
  flex-shrink: 0;
}

// 572:968
.ical-note {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 14px 16px;
  border-radius: $radius-input;
  background: $color-accent-tint;
  font-size: 13px;
  font-weight: 400;
  line-height: 20px;
  color: $color-primary;
}

.ical-note img {
  display: block;
  flex-shrink: 0;
}

// Dizajn 44: an icon, a title, one sentence and one button, centred.
.ical-state {
  align-items: center;
  gap: 0;
  padding: 47px 23px;
  text-align: center;
}

.ical-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 31px 23px 33px;
  text-align: center;
}

.ical-state-icon {
  width: 48px;
  height: 48px;
  margin-bottom: 12px;
  color: $color-text-muted;
}

.ical-state-title {
  font-size: 17px;
  font-weight: 500;
  line-height: normal;
  color: $color-text;
}

.ical-state-text {
  max-width: 420px;
  margin-top: 4px;
  font-size: 13px;
  font-weight: 300;
  line-height: normal;
  color: $color-text-muted;
}

.ical-state.is-error .ical-state-icon,
.ical-state.is-error .ical-state-title {
  color: $color-error;
}

// 357:503, the dashboard's grey button.
.ical-state-button {
  display: inline-flex;
  align-items: center;
  margin-top: 16px;
  padding: 11px 20px;
  border: 0;
  border-radius: $radius-button;
  background: $color-background;
  font-family: $font-family-base;
  font-size: 13px;
  font-weight: 500;
  line-height: normal;
  color: $color-text;
  white-space: nowrap;
  cursor: pointer;
}

.ical-state-button:hover {
  color: $color-primary;
}

@include mobile-only {
  .ical {
    margin: 0;
  }

  .ical-card {
    padding: 19px 15px;
  }

  .ical-state {
    padding: 39px 15px;
  }

  .ical-add-row {
    flex-direction: column;
    align-items: stretch;
  }

  .ical-add-row .ical-field {
    flex: none;
  }

  // The name and its line on top, the pill and "Ukloni" under them.
  .ical-source {
    flex-wrap: wrap;
    row-gap: 10px;
    padding: 13px 15px 14px;
  }

  .ical-source:last-child {
    padding-bottom: 13px;
  }

  .ical-source-text {
    flex-basis: 100%;
  }

  .ical-pill {
    margin-right: auto;
  }
}
</style>
