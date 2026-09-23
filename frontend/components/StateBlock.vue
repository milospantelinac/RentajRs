<template>
  <div class="state-block" :class="{ 'is-error': error, 'is-card': card }">
    <span v-if="iconMarkup" class="state-block-icon" aria-hidden="true" v-html="iconMarkup" />
    <FontAwesomeIcon v-else-if="fallbackIcon" :icon="fallbackIcon" class="state-block-icon" aria-hidden="true" />
    <p class="state-block-title">{{ title }}</p>
    <p v-if="text" class="state-block-text">{{ text }}</p>
    <slot />
  </div>
</template>

<script setup>
// Dizajn 44: one empty/error block for the whole platform, instead of a copy
// per screen: a 48px icon in grey, a Medium 17 title, one Light 13 sentence
// and a single action. The two frames the ticket points at (380:1415 Sačuvano,
// 519:588 Poruke) draw a full list, not an empty one, so the values come from
// the ticket itself and the block borrows the container of the content it
// stands in for: a white raised card when it replaces one (`card`), nothing
// when a card already holds it. A failed load keeps the same structure and
// turns the icon and the title red.
const props = defineProps({
  // A dashboard menu icon name, or one of the state-only icons, see
  // utils/stateIcons.js. Dizajn 45: a name Figma draws no icon for (the admin
  // panel's screens) falls back to that name's glyph, as the menus do.
  icon: { type: String, default: '' },
  title: { type: String, required: true },
  text: { type: String, default: '' },
  error: { type: Boolean, default: false },
  card: { type: Boolean, default: false },
})

const iconMarkup = computed(() => (props.icon ? getStateIconMarkup(props.icon) : null))
const fallbackIcon = computed(() => (props.icon ? getNavIconFallback(props.icon) : null))
</script>

<style lang="scss" scoped>
.state-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 24px;
  text-align: center;
}

// The raised card of the dashboard's own content cards (Dizajn 38's six
// sections), so a block standing on its own reads as the card it replaces.
.state-block.is-card {
  border-radius: $radius-card;
  background: $color-surface;
  box-shadow:
    0 6px 20px rgba(97, 115, 133, 0.08),
    0 1px 3px rgba(97, 115, 133, 0.05);
}

.state-block-icon {
  display: inline-flex;
  width: 48px;
  height: 48px;
  margin-bottom: 12px;
  color: $color-text-muted;
}

.state-block-icon :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
}

.state-block-title {
  font-size: 17px;
  font-weight: 500;
  line-height: normal;
  color: $color-text;
}

.state-block-text {
  max-width: 420px;
  margin-top: 4px;
  font-size: 13px;
  font-weight: 300;
  line-height: normal;
  color: $color-text-muted;
}

.state-block.is-error .state-block-icon,
.state-block.is-error .state-block-title {
  color: $color-error;
}

// 357:503, the dashboard's grey button. The action is a link on one page and a
// button on the next, so it comes through the slot and is styled from here; a
// page whose action has a look of its own (the blue "Dodaj oglas") passes its
// own class instead.
.state-block :deep(.state-block-action) {
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

.state-block :deep(.state-block-action:hover) {
  color: $color-primary;
  text-decoration: none;
}

@include mobile-only {
  .state-block {
    padding: 32px 16px;
  }
}
</style>
