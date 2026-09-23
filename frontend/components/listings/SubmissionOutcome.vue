<template>
  <section class="outcome">
    <div class="outcome-card" :class="`is-${tone}`">
      <header class="outcome-head">
        <span class="outcome-mark">
          <img v-if="tone === 'success'" src="/images/icons/check-success-64.svg" alt="" class="outcome-mark-check" />
          <img v-else src="/images/icons/x-danger-28.svg" alt="" class="outcome-mark-x" />
        </span>
        <h1 class="outcome-title">{{ title }}</h1>
        <p class="outcome-text">{{ text }}</p>
      </header>

      <div v-if="listing" class="outcome-summary">
        <div class="outcome-listing">
          <img v-if="listing.coverPhotoUrl" :src="listing.coverPhotoUrl" alt="" class="outcome-listing-photo" />
          <span v-else class="outcome-listing-photo is-empty" />
          <div class="outcome-listing-text">
            <p class="outcome-listing-title">{{ listing.title }}</p>
            <p v-if="listingMeta" class="outcome-listing-meta">{{ listingMeta }}</p>
          </div>
        </div>
        <div v-for="row in rows" :key="row.label" class="outcome-row">
          <span class="outcome-row-label">{{ row.label }}</span>
          <span class="outcome-row-value">{{ row.value }}</span>
        </div>
      </div>

      <p v-if="note" class="outcome-note">{{ note }}</p>

      <div class="outcome-next">
        <p class="outcome-next-title">
          {{ t('submission.nextTitle') }}
          <img src="/images/icons/info-circle.svg" alt="" class="outcome-next-icon" />
        </p>
        <ol class="outcome-steps">
          <li v-for="(step, index) in steps" :key="step.title" class="outcome-step">
            <span class="outcome-step-number">{{ index + 1 }}</span>
            <span class="outcome-step-text">
              <span class="outcome-step-title">{{ step.title }}</span>
              <span class="outcome-step-desc">{{ step.text }}</span>
            </span>
          </li>
        </ol>
      </div>

      <div class="outcome-actions">
        <NuxtLink :to="primary.to" class="outcome-btn is-primary">{{ primary.label }}</NuxtLink>
        <NuxtLink :to="secondary.to" class="outcome-btn is-secondary">{{ secondary.label }}</NuxtLink>
      </div>
    </div>
  </section>
</template>

<script setup>
// Dizajn 29 (601:514, 601:627): the card both review outcomes share, sent and not approved.
const props = defineProps({
  tone: { type: String, default: 'success' }, // success | danger
  title: { type: String, required: true },
  text: { type: String, required: true },
  listing: { type: Object, default: null }, // GET /listings/:id/submission
  rows: { type: Array, default: () => [] }, // [{ label, value }]
  note: { type: String, default: '' },
  steps: { type: Array, required: true }, // [{ title, text }]
  primary: { type: Object, required: true }, // { label, to }
  secondary: { type: Object, required: true },
})
const { t } = useI18n()

// "Igraonice · Beograd, Vračar"
const listingMeta = computed(() => {
  const l = props.listing
  if (!l) return ''
  const place = [l.cityName, l.cityAreaName].filter(Boolean).join(', ')
  return [l.categoryName, place].filter(Boolean).join(' · ')
})
</script>

<style lang="scss" scoped>
$outcome-success-bg: #cdfad1;
$outcome-danger-bg: #fdeff1;

.outcome {
  display: flex;
  justify-content: center;
  padding: 56px 16px 72px;
  background: $color-background;
}

.outcome-card {
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 640px;
  max-width: 100%;
  padding: 36px;
  border-radius: $radius-panel;
  background: $color-surface;
  box-shadow: 0 8px 24px rgba(97, 115, 133, 0.1);

  &.is-danger {
    padding-bottom: 32px;
  }
}

.outcome-head {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  text-align: center;
}

.outcome-mark {
  position: relative;
  width: 64px;
  height: 64px;
  border-radius: $radius-pill;
  background: $outcome-success-bg;

  .is-danger & {
    background: $outcome-danger-bg;
  }
}

.outcome-mark-check {
  display: block;
  width: 64px;
  height: 64px;
}

.outcome-mark-x {
  position: absolute;
  top: 18px;
  left: 18px;
  width: 28px;
  height: 28px;
}

.outcome-title {
  margin: 0;
  font-size: 28px;
  font-weight: 400;
  line-height: 36px;
  letter-spacing: -0.7px;
  color: $color-text;
}

.outcome-text {
  margin: 0;
  font-size: 14px;
  font-weight: 300;
  line-height: 22px;
  color: $color-text-muted;
}

.outcome-summary {
  overflow: hidden;
  border-radius: $radius-card;
  background: $color-background;
}

.outcome-listing {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
}

.outcome-listing-photo {
  flex-shrink: 0;
  width: 64px;
  height: 52px;
  border-radius: 12px;
  object-fit: cover;

  &.is-empty {
    background: $color-border;
  }
}

.outcome-listing-text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.outcome-listing-title,
.outcome-listing-meta {
  margin: 0;
  line-height: normal;
  overflow-wrap: anywhere;
}

.outcome-listing-title {
  font-size: 14px;
  font-weight: 500;
  color: $color-text;
}

.outcome-listing-meta {
  font-size: 12px;
  font-weight: 300;
  color: $color-text-muted;
}

// The frame's top stroke sits inside the row, so the border takes a pixel of the padding.
.outcome-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 11px 18px 12px;
  border-top: 1px solid $color-border;
  font-size: 13px;
  line-height: normal;
}

.outcome-row-label {
  flex-shrink: 0;
  font-weight: 300;
  color: $color-text-muted;
}

.outcome-row-value {
  min-width: 0;
  font-weight: 400;
  text-align: right;
  color: $color-text;
  overflow-wrap: anywhere;
}

.outcome-note {
  margin: 0;
  padding: 13px 16px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  color: $color-warning;
  background: $color-warning-bg;

  .is-danger & {
    color: $color-error;
    background: $outcome-danger-bg;
  }
}

.outcome-next {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.outcome-next-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 15px;
  font-weight: 500;
  line-height: normal;
  color: $color-text;
}

.outcome-next-icon {
  width: 16px;
  height: 16px;
}

.outcome-steps {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.outcome-step {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.outcome-step-number {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: $radius-pill;
  font-size: 11px;
  font-weight: 500;
  line-height: normal;
  color: $color-primary;
  background: $color-accent-tint;
}

.outcome-step-text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.outcome-step-title {
  font-size: 13px;
  font-weight: 500;
  line-height: normal;
  color: $color-text;
}

.outcome-step-desc {
  font-size: 12px;
  font-weight: 300;
  line-height: 18px;
  color: $color-text-muted;
}

// The frame clips this row, which hides the primary button's shadow; kept that way.
.outcome-actions {
  display: flex;
  gap: 12px;
  overflow: hidden;
}

.outcome-btn {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  min-width: 0;
  padding: 15px;
  border-radius: $radius-button;
  font-size: 15px;
  font-weight: 500;
  line-height: normal;
  text-align: center;
  text-decoration: none;

  &.is-primary {
    color: $color-surface;
    background: linear-gradient(90deg, $color-gradient-start 0%, $color-gradient-mid 100%);
    box-shadow: 0 8px 18px rgba(9, 87, 223, 0.28);
  }

  &.is-secondary {
    color: $color-text;
    background: $color-background;
  }
}

@include respond-below(sm) {
  .outcome {
    padding-top: 32px;
    padding-bottom: 48px;
  }

  .outcome-card {
    padding: 28px 20px;

    &.is-danger {
      padding-bottom: 24px;
    }
  }

  .outcome-actions {
    flex-direction: column;
  }
}
</style>
