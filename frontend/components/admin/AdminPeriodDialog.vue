<template>
  <!-- Administracija > Oglasi, "Trajanje" (no frame): a free package's end moves
       either way, goes away or comes now; a paid package only gets time on top,
       as a gift, for every listing it carries (the user, 2026-10-22). -->
  <div class="admin-modal-backdrop" @click.self="close">
    <div class="admin-modal admin-card period-dialog" role="dialog" aria-modal="true" aria-labelledby="period-dialog-title">
      <div class="admin-card-body period-body">
        <div>
          <p id="period-dialog-title" class="admin-card-title">{{ t('adminListings.periodTitle') }}</p>
          <p v-if="info" class="admin-card-note period-listing">
            {{ info.listing.title || t('myListings.untitled') }} · {{ info.listing.owner.name }}
          </p>
        </div>

        <p v-if="loading" class="admin-card-note">{{ t('common.loading') }}</p>

        <template v-else-if="info?.package">
          <dl class="period-facts">
            <div class="period-fact">
              <dt>{{ t('adminListings.packageLabel') }}</dt>
              <dd>
                {{ info.package.key }}
                <span class="admin-pill" :class="info.package.free ? 'admin-pill-info' : 'admin-pill-neutral'">
                  {{ info.package.free ? t('adminListings.free') : t('adminListings.paid') }}
                </span>
              </dd>
            </div>
            <div class="period-fact">
              <dt>{{ t('adminListings.validUntil') }}</dt>
              <dd>{{ currentEndText }}</dd>
            </div>
            <div v-if="info.package.continuedUntil" class="period-fact">
              <dt>{{ t('adminListings.continuedLabel') }}</dt>
              <dd>{{ t('adminListings.continuedUntil', { date: formatListingDate(info.package.continuedUntil) }) }}</dd>
            </div>
            <div v-if="info.package.grantedBy" class="period-fact">
              <dt>{{ t('adminListings.grantedBy') }}</dt>
              <dd>{{ info.package.grantedBy }}</dd>
            </div>
            <div v-if="info.package.note" class="period-fact">
              <dt>{{ t('adminListings.noteLabel') }}</dt>
              <dd>{{ info.package.note }}</dd>
            </div>
          </dl>

          <p v-if="!info.package.changeable" class="admin-card-note">{{ t('adminListings.periodNotChangeable') }}</p>

          <template v-else>
            <div v-if="info.package.free" class="admin-switch admin-switch-sm" role="radiogroup" :aria-label="t('adminListings.periodTitle')">
              <button
                v-for="option in freeModes"
                :key="option"
                type="button"
                role="radio"
                class="admin-switch-btn"
                :class="{ 'is-active': mode === option }"
                :aria-checked="mode === option"
                @click="mode = option"
              >
                {{ t(`adminListings.mode.${option}`) }}
              </button>
            </div>
            <p v-else class="admin-card-note">{{ t('adminListings.giftExplain') }}</p>

            <p v-if="!info.package.free && info.package.otherListings.length" class="period-warning">
              {{ t('adminListings.giftWholePackage', { listings: info.package.otherListings.map((other) => other.title || t('myListings.untitled')).join(', ') }) }}
            </p>

            <template v-if="mode === 'EXTEND' || mode === 'SET'">
              <div class="period-amount">
                <input
                  v-model.number="amount"
                  type="number"
                  inputmode="numeric"
                  min="1"
                  :max="MAX_PERIOD[unit]"
                  class="admin-field period-amount-input"
                  :aria-label="t(`adminListings.amountLabel.${unit}`)"
                />
                <div class="admin-switch admin-switch-sm" role="radiogroup">
                  <button
                    v-for="option in ['MONTHS', 'DAYS']"
                    :key="option"
                    type="button"
                    role="radio"
                    class="admin-switch-btn"
                    :class="{ 'is-active': unit === option }"
                    :aria-checked="unit === option"
                    @click="setUnit(option)"
                  >
                    {{ t(`adminListings.unitWord.${option}${srPluralCategory(amount || 0)}`) }}
                  </button>
                </div>
              </div>
              <div class="period-quick">
                <button
                  v-for="quick in QUICK_PERIODS[unit]"
                  :key="quick"
                  type="button"
                  class="period-quick-btn"
                  :class="{ 'is-active': amount === quick }"
                  @click="amount = quick"
                >
                  {{ t(`adminListings.quick.${unit}${srPluralCategory(quick)}`, { count: quick }) }}
                </button>
              </div>
            </template>

            <p class="period-result" :class="{ 'is-danger': mode === 'END_NOW', 'is-invalid': needsAmount && !periodOk }">{{ resultText }}</p>
          </template>
        </template>

        <p v-else-if="info" class="admin-card-note">{{ t('adminListings.noPackage') }}</p>

        <p v-if="error" class="form-error mb-0" role="alert">{{ error }}</p>

        <div class="period-actions">
          <button
            v-if="info?.package?.changeable"
            type="button"
            class="btn"
            :class="mode === 'END_NOW' ? 'btn-danger' : 'btn-primary-flat'"
            :disabled="!canSave || busy"
            @click="save"
          >
            {{ busy ? t('common.loading') : t(`adminListings.save.${mode}`) }}
          </button>
          <button type="button" class="btn btn-tertiary" :disabled="busy" @click="close">{{ t('common.close') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
// The template reads these constants too, which Nuxt's auto-imports do not reach.
import { MAX_PERIOD, QUICK_PERIODS } from '~/utils/freePeriod'

const props = defineProps({
  listingId: { type: String, required: true },
})
const emit = defineEmits(['close', 'changed'])
const { t } = useI18n()
const api = useApi()

const info = ref(null)
const loading = ref(true)
const busy = ref(false)
const error = ref('')
const mode = ref('EXTEND')
const unit = ref('MONTHS')
const amount = ref(1)

onMounted(async () => {
  try {
    info.value = await api.get(`/admin/listings/${props.listingId}/period`)
  } catch (e) {
    error.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    loading.value = false
  }
})

const pkg = computed(() => info.value?.package || null)
const running = computed(() => pkg.value?.status === 'ACTIVE')
const noEnd = computed(() => running.value && !pkg.value?.expiresAt)

// What a free package can do now: no end is refused while a paid continuation
// waits behind it, and only a running package can end now.
const freeModes = computed(() => {
  const modes = ['EXTEND', 'SET']
  if (!pkg.value?.continuedUntil && !noEnd.value) modes.push('UNLIMITED')
  if (running.value) modes.push('END_NOW')
  return modes
})

const currentEndText = computed(() => {
  if (!pkg.value) return ''
  if (noEnd.value) return t('adminListings.endsNeverShort')
  if (!pkg.value.expiresAt) return '-'
  const date = formatListingDate(pkg.value.expiresAt)
  return running.value && new Date(pkg.value.expiresAt).getTime() > Date.now() ? date : t('adminListings.endedOn', { date })
})

function setUnit(next) {
  if (next === unit.value) return
  unit.value = next
  amount.value = QUICK_PERIODS[next][0]
}

const needsAmount = computed(() => mode.value === 'EXTEND' || mode.value === 'SET')
const periodOk = computed(() => isValidPeriod(amount.value, unit.value))

// Extending counts from the running end; an ended package, or one with no end, from today.
const extendBase = computed(() => {
  const end = pkg.value?.expiresAt ? new Date(pkg.value.expiresAt) : null
  return running.value && end && end.getTime() > Date.now() ? end : new Date()
})

const resultText = computed(() => {
  if (mode.value === 'UNLIMITED') return t('adminListings.result.UNLIMITED')
  if (mode.value === 'END_NOW') return t('adminListings.result.END_NOW')
  if (!periodOk.value) return t(`adminListings.amountInvalid.${unit.value}`, { max: MAX_PERIOD[unit.value] })
  const from = mode.value === 'SET' ? new Date() : extendBase.value
  return t('adminListings.result.newEnd', { date: formatPeriodEnd(from, amount.value, unit.value) })
})

const canSave = computed(() => !!pkg.value?.changeable && (!needsAmount.value || periodOk.value))

async function save() {
  if (!canSave.value) return
  if (mode.value === 'END_NOW' && !confirm(t('adminListings.endNowConfirm'))) return
  busy.value = true
  error.value = ''
  try {
    const updated = await api.post(`/admin/listings/${props.listingId}/period`, {
      mode: mode.value,
      ...(needsAmount.value ? { amount: amount.value, unit: unit.value } : {}),
    })
    emit('changed', updated)
  } catch (e) {
    error.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    busy.value = false
  }
}

function close() {
  if (!busy.value) emit('close')
}
</script>

<style lang="scss" scoped>
.period-dialog {
  max-width: 520px;
  max-height: calc(100vh - 32px);
  overflow-y: auto;
}

.period-body {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.period-listing {
  margin-top: 6px;
}

.period-facts {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
}

.period-fact {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  font-size: 14px;
}

.period-fact dt {
  flex: 0 0 150px;
  font-weight: 400;
  color: $color-text-muted;
}

.period-fact dd {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: $color-text;
  overflow-wrap: anywhere;
}

.period-warning {
  margin: 0;
  padding: 10px 14px;
  border-radius: $radius-input;
  background: $color-warning-bg;
  font-size: 13px;
  line-height: 18px;
  color: $color-text;
}

.period-amount {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.period-amount-input {
  width: 110px;
}

.period-quick {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.period-quick-btn {
  padding: 6px 12px;
  border: 1px solid $color-border;
  border-radius: $radius-pill;
  background: $color-surface;
  font-family: $font-family-base;
  font-size: 13px;
  color: $color-text;
  cursor: pointer;
}

.period-quick-btn:hover,
.period-quick-btn.is-active {
  border-color: $color-primary;
  color: $color-primary;
}

.period-result {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: $color-primary;
}

.period-result.is-danger,
.period-result.is-invalid {
  color: $color-error;
}

.period-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

@include mobile-only {
  .period-fact dt {
    flex-basis: 100%;
  }
}
</style>
