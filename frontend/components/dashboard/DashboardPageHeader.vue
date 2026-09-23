<template>
  <header class="dash-page-header" :class="{ 'dash-page-header-greeting': greeting }">
    <div class="dash-page-heading">
      <h1 class="dash-page-title">{{ title }}</h1>
      <p v-if="subtitle" class="dash-page-subtitle">{{ subtitle }}</p>
    </div>
    <div v-if="$slots.actions" class="dash-page-actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<script setup>
// Dizajn 30: the title every dashboard page opens with, 32 above its first
// card as in 357:406. The inner pages draw it Regular 30/38 (380:496, 378:495,
// 380:1309, 380:760) with a Light 14 line under it and a button on the right
// (380:498); the home page greets in 34/42 over a Light 15 line (357:494).
defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  greeting: { type: Boolean, default: false },
})
</script>

<style lang="scss" scoped>
.dash-page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 32px;
}

.dash-page-heading {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.dash-page-title {
  font-size: 30px;
  font-weight: 400;
  line-height: 38px;
  letter-spacing: -0.9px;
  color: $color-text;
}

.dash-page-subtitle {
  font-size: 14px;
  font-weight: 300;
  line-height: normal;
  color: $color-text-muted;
}

.dash-page-actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 12px;
}

// 357:494
.dash-page-header-greeting .dash-page-heading {
  gap: 6px;
}

.dash-page-header-greeting .dash-page-title {
  font-size: 34px;
  line-height: 42px;
  letter-spacing: -1.1px;
}

.dash-page-header-greeting .dash-page-subtitle {
  font-size: 15px;
}

@include mobile-only {
  .dash-page-header {
    flex-wrap: wrap;
    margin-bottom: 24px;
  }
}
</style>
