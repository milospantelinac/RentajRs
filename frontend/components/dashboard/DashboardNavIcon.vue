<template>
  <FontAwesomeIcon :icon="ICONS[name]" />
</template>

<script setup>
// Shared icon set between DashboardNav (sidebar) and DashboardBottomNav
// (mobile tab bar) — same visual language on both, one place to edit.
const ICONS = {
  home: 'house',
  list: 'list',
  inbox: 'inbox',
  card: 'credit-card',
  calendar: 'calendar-days',
  heart: 'heart',
  message: 'comment-dots',
  gear: 'gear',
  shield: 'shield-halved',
  more: 'ellipsis',
}

defineProps({ name: { type: String, required: true } })
</script>
