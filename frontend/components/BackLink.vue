<template>
  <button
    type="button"
    class="btn btn-tertiary btn-sm back-link"
    :class="{ 'back-link-light': variant === 'light' }"
    @click="goBack"
  >
    ← {{ t('common.back') }}
  </button>
</template>

<script setup>
// T110 — a consistent "← Nazad" for pages opened as a step in some other
// flow (booking request, contact owner, booking detail, owner profile,
// package purchase...). Real browser history-back rather than a fixed
// route: several of these pages have more than one legitimate entry point
// (e.g. "Izaberi paket" is reached both from the listing wizard and from
// Pretplate → nadogradnja), so a hardcoded destination would be wrong for
// whichever flow didn't write it. `fallback` only matters when there's no
// in-app history to go back to at all (a bookmarked link, a new tab, a
// notification opened straight from the OS) — window.history.state.back is
// how Vue Router's own history records "is there a previous SPA entry".
const props = defineProps({
  fallback: { type: String, default: '/' },
  // 'light' — for placement over a dark/gradient background (e.g. the
  // listing wizard's hero band), where the default dark-text tertiary
  // button would be nearly invisible.
  variant: { type: String, default: 'default' },
})

const { t } = useI18n()
const router = useRouter()

function goBack() {
  if (typeof window !== 'undefined' && window.history.state?.back) {
    router.back()
  } else {
    router.push(props.fallback)
  }
}
</script>

<style lang="scss" scoped>
.back-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.back-link-light {
  border-color: rgba(255, 255, 255, 0.4);
  color: $color-surface;
}

.back-link-light:hover:not(:disabled) {
  border-color: $color-surface;
  color: $color-surface;
}
</style>
