<template>
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <template v-if="name === 'home'">
      <path d="M4 12 12 4l8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M6 10v9a1 1 0 0 0 1 1h3v-5a2 2 0 0 1 2-2 2 2 0 0 1 2 2v5h3a1 1 0 0 0 1-1v-9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    </template>
    <template v-else-if="name === 'list'">
      <path d="M8 6h12M8 12h12M8 18h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
      <circle cx="4" cy="6" r="1" fill="currentColor" />
      <circle cx="4" cy="12" r="1" fill="currentColor" />
      <circle cx="4" cy="18" r="1" fill="currentColor" />
    </template>
    <template v-else-if="name === 'inbox'">
      <path d="M4 12h4l1.5 3h5L16 12h4" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
      <path d="M5 7l-1 5v6a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6l-1-5a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
    </template>
    <template v-else-if="name === 'card'">
      <rect x="3.5" y="6" width="17" height="12" rx="2" stroke="currentColor" stroke-width="1.8" />
      <path d="M3.5 10h17" stroke="currentColor" stroke-width="1.8" />
    </template>
    <template v-else-if="name === 'calendar'">
      <rect x="4" y="5.5" width="16" height="14.5" rx="2" stroke="currentColor" stroke-width="1.8" />
      <path d="M4 10h16M8 3.5v3M16 3.5v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
    </template>
    <template v-else-if="name === 'heart'">
      <path
        d="M12 20s-7-4.35-9.5-8.5C.7 8 2 4.5 5.5 4.5c2 0 3.5 1.2 4.5 2.7 1-1.5 2.5-2.7 4.5-2.7C18 4.5 19.3 8 21.5 11.5 19 15.65 12 20 12 20Z"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linejoin="round"
      />
    </template>
    <template v-else-if="name === 'message'">
      <path d="M4 5.5h16a1 1 0 0 1 1 1V15a1 1 0 0 1-1 1H9l-4 3.5V16H4a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
    </template>
    <template v-else-if="name === 'gear'">
      <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8" />
      <path
        d="M12 3.5v2M12 18.5v2M20.5 12h-2M5.5 12h-2M17.7 6.3l-1.4 1.4M7.7 16.3l-1.4 1.4M17.7 17.7l-1.4-1.4M7.7 7.7 6.3 6.3"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
      />
    </template>
    <template v-else-if="name === 'shield'">
      <path d="M12 3.5l7 3v5c0 5-3 8-7 9-4-1-7-4-7-9v-5l7-3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
    </template>
    <template v-else-if="name === 'more'">
      <rect x="4" y="4" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.8" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.8" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.8" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.8" />
    </template>
  </svg>
</template>

<script setup>
// Shared icon set between DashboardNav (sidebar) and DashboardBottomNav
// (mobile tab bar) — same visual language on both, one place to edit.
defineProps({ name: { type: String, required: true } })
</script>
