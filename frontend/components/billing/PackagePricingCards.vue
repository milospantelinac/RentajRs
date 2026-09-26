<template>
  <div class="package-pricing">
    <!-- Dizajn 12 — grey capsule with the active option as a white pill. -->
    <div class="package-period" role="tablist" :aria-label="t('billing.periodSwitch')">
      <button
        type="button"
        role="tab"
        class="package-period-option"
        :class="{ 'package-period-option-active': cycle === 'MONTHLY' }"
        :aria-selected="cycle === 'MONTHLY'"
        @click="$emit('update:cycle', 'MONTHLY')"
      >
        {{ t('billing.monthly') }}
      </button>
      <button
        type="button"
        role="tab"
        class="package-period-option"
        :class="{ 'package-period-option-active': cycle === 'YEARLY' }"
        :aria-selected="cycle === 'YEARLY'"
        @click="$emit('update:cycle', 'YEARLY')"
      >
        {{ t('billing.yearly') }}
      </button>
    </div>

    <div v-if="$slots['after-toggle']" class="package-after-toggle">
      <slot name="after-toggle" />
    </div>

    <div class="package-grid">
      <div v-for="pkg in packages" :key="pkg.id" class="package-tier">
        <div
          class="package-card"
          :class="{
            'package-card-highlight': pkg.key === highlightKey,
            'package-card-disabled': disabledKeys.includes(pkg.key),
          }"
        >
          <p class="package-name">{{ pkg.key }}</p>

          <div class="package-price-block">
            <p class="package-price">
              <span class="package-amount">{{ formatPrice(cycle === 'YEARLY' ? pkg.priceYearly : pkg.priceMonthly) }}</span>
              <span class="package-unit">/ {{ cycle === 'YEARLY' ? t('billing.year') : t('billing.month') }}</span>
            </p>
            <template v-if="cycle === 'YEARLY'">
              <p v-if="yearlySavings(pkg) > 0" class="package-savings">
                {{ t('billing.yearlySavings', { amount: formatPrice(yearlySavings(pkg)) }) }}
              </p>
              <p class="package-monthly">{{ t('billing.monthlyBilledOnce', { amount: formatPrice(pkg.priceMonthly) }) }}</p>
            </template>
          </div>

          <div class="package-divider" />

          <ul class="package-features">
            <li v-for="feature in featuresOf(pkg)" :key="feature.key" class="package-feature" :class="{ 'package-feature-off': !feature.on }">
              <img :src="feature.on ? '/images/icons/feature-check.svg' : '/images/icons/feature-x.svg'" alt="" class="package-feature-icon" />
              <span>{{ feature.label }}</span>
            </li>
          </ul>

          <div class="package-cta">
            <p v-if="disabledKeys.includes(pkg.key)" class="package-disabled-note">{{ disabledReason }}</p>
            <slot v-else name="cta" :pkg="pkg" />
          </div>
        </div>
        <p class="package-vat-footnote">{{ t('billing.vatFootnote') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
// RNT-041 — the owner asked for /cenovnik and /oglasi/{id}/paket to show
// identical package info; this is the one place that logic lives now so
// the two pages can't drift apart again the way they did before.
defineProps({
  packages: { type: Array, required: true },
  cycle: { type: String, required: true },
  highlightKey: { type: String, default: null },
  // DODATNA LOGIKA za pakete — package keys to show disabled with
  // disabledReason explaining why (e.g. Osnovni once the listing already
  // uses online booking). Empty on /cenovnik, where there's no listing
  // context to gate against.
  disabledKeys: { type: Array, default: () => [] },
  disabledReason: { type: String, default: '' },
})
defineEmits(['update:cycle'])

const { t } = useI18n()

function formatPrice(value) {
  return `${new Intl.NumberFormat('sr-RS').format(value || 0)} RSD`
}

function yearlySavings(pkg) {
  return pkg.priceMonthly * 12 - pkg.priceYearly
}

// Same list, same order for every package so the rows line up across the
// three cards; what a package lacks stays in the list, crossed out, rather
// than disappearing — that contrast is the whole point of the comparison.
function featuresOf(pkg) {
  const listings = t(`billing.featureListings${pkg.listingLimit > 1 ? 'UpTo' : srPluralCategory(pkg.listingLimit)}`, {
    count: pkg.listingLimit,
  })
  const rows = [
    { key: 'listings', label: listings, on: true },
    { key: 'visible', label: t('billing.featureVisible30Days'), on: true },
  ]
  if (pkg.key === 'BASIC') {
    rows.push(
      { key: 'gallery', label: t('billing.featureGalleryDescription'), on: true },
      { key: 'contact', label: t('billing.featureContactInfo'), on: true },
    )
  } else {
    rows.push(
      { key: 'basic', label: t('billing.featureAllFromBasic'), on: true },
      { key: 'support', label: t('billing.featurePrioritySupport'), on: true },
    )
  }
  rows.push(
    { key: 'bookings', label: t('billing.featureBookings'), on: pkg.hasBookings },
    { key: 'messaging', label: t('billing.featureMessaging'), on: pkg.hasMessaging },
    { key: 'reviews', label: t('billing.featureReviews'), on: pkg.hasReviews },
    { key: 'ical', label: t('billing.featureIcal'), on: pkg.hasIcal },
  )
  return rows
}
</script>

<style lang="scss" scoped>
.package-pricing {
  display: flex;
  flex-direction: column;
  align-items: center;
}

// -- Period switch (Figma 199:322) ------------------------------------------

.package-period {
  display: inline-flex;
  padding: 5px;
  border-radius: $radius-input;
  background: $color-background;
}

.package-period-option {
  height: 42px;
  padding: 0 24px;
  border: 0;
  border-radius: $radius-input;
  background: transparent;
  color: $color-text;
  font-size: 15px;
  font-weight: 400;
  cursor: pointer;
  transition:
    background 0.15s ease,
    box-shadow 0.15s ease;
}

.package-period-option-active {
  background: $color-surface;
  font-weight: 500;
  box-shadow: 0 2px 12px rgba(97, 115, 133, 0.07);
}

.package-after-toggle {
  margin-top: 20px;
}

// -- Cards (Figma 220:287) ---------------------------------------------------

// Three equal columns, 32 apart; stretch keeps every card the height of the
// tallest one so the CTAs line up along one bottom edge.
.package-grid {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 32px;
  align-items: stretch;
  // Cenovnik puts a pill under the switch and the cards 56px below that;
  // Izaberite paket has no pill and sits them 44px under the switch itself.
  margin-top: var(--package-grid-offset, 56px);
}

.package-tier {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.package-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 22px;
  // Figma's 30/28 padding is measured from the outer edge with the stroke
  // drawn inside it; in CSS the 1px border sits outside the padding, so it
  // comes off here to keep the content box (328px) the same.
  padding: 29px 27px;
  background: $color-surface;
  border: 1px solid $color-border;
  border-radius: $radius-card;
}

// Figma draws the highlighted card's 1.5px brand border in place of the 1px
// neutral one; the extra half pixel goes to an inset shadow so the card
// doesn't grow and push its neighbours out of line.
.package-card-highlight {
  border-color: $color-primary;
  box-shadow: inset 0 0 0 0.5px $color-primary;
}

// Line heights below are pinned to Figma's text-box heights (16 / 45 / 18);
// 'normal' resolves to fractional values that drift the CTA row by a pixel.
.package-name {
  font-size: 13px;
  line-height: 16px;
  font-weight: 500;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  color: $color-text-muted;
}

.package-price-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.package-price {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 8px;
}

.package-amount {
  font-size: 36px;
  line-height: 45px;
  font-weight: 500;
  color: $color-text;
  white-space: nowrap;
}

.package-unit {
  font-size: 15px;
  color: $color-text-muted;
}

.package-savings {
  font-size: 14px;
  line-height: 18px;
  font-weight: 500;
  color: #178c24;
}

.package-monthly {
  font-size: 14px;
  line-height: 18px;
  color: $color-text-muted;
}

.package-divider {
  height: 1px;
  background: $color-border;
}

.package-features {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.package-feature {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  font-size: 15px;
  line-height: 22px;
  color: $color-text;
}

.package-feature-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.package-feature-off {
  color: #b5bfcc;
  text-decoration: line-through;
}

// Pushed to the bottom of the card so all three buttons share a baseline even
// when one card's list wraps onto an extra line.
.package-cta {
  margin-top: auto;
}

.package-cta :slotted(.package-cta-btn) {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 52px;
  border: 0;
  border-radius: 8px;
  background: linear-gradient(90deg, $color-gradient-start 0%, $color-gradient-mid 55%, $color-gradient-end 100%);
  color: $color-surface;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: filter 0.15s ease;
}

.package-cta :slotted(.package-cta-btn:hover) {
  filter: brightness(1.06);
}

// Figma 593:529 — a package this listing can't use: the whole card at 55%,
// sized to its own content (no CTA to line up), with the reason where the
// button would otherwise be.
.package-card-disabled {
  flex: 0 0 auto;
  opacity: 0.55;
}

.package-disabled-note {
  font-size: 13px;
  font-weight: 300;
  line-height: 20px;
  color: $color-text-muted;
}

.package-vat-footnote {
  font-size: 12px;
  color: $color-text-muted;
}

@include respond-below(lg) {
  .package-grid {
    grid-template-columns: minmax(0, 1fr);
    max-width: 440px;
    gap: 24px;
    margin-top: 40px;
  }
}
</style>
