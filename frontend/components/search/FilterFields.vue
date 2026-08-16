<template>
  <div>
    <div class="form-group mb-3">
      <label class="form-label">{{ t('listing.price') }}</label>
      <div class="row">
        <div class="col-6">
          <input v-model.number="query.priceMin" type="number" class="form-control" placeholder="min" />
        </div>
        <div class="col-6">
          <input v-model.number="query.priceMax" type="number" class="form-control" placeholder="max" />
        </div>
      </div>
    </div>

    <div class="form-row-inline mb-3">
      <input id="onlineBooking" v-model="query.onlineBookingOnly" type="checkbox" class="form-checkbox" />
      <label for="onlineBooking" class="text-muted">{{ t('search.onlineBookingOnly') }}</label>
    </div>

    <div v-if="filterableAttributes.length" class="mb-3">
      <p class="text-label mb-2">{{ t('listing.stepAttributes') }}</p>
      <div v-for="attr in filterableAttributes" :key="attr.id" class="form-group mb-3">
        <label class="form-label">{{ attr.name }}</label>
        <div v-if="attr.filterType === 'RANGE'" class="row">
          <div class="col-6">
            <input type="number" class="form-control" placeholder="min" @change="$emit('set-attr', attr.id, 'min', $event.target.value)" />
          </div>
          <div class="col-6">
            <input type="number" class="form-control" placeholder="max" @change="$emit('set-attr', attr.id, 'max', $event.target.value)" />
          </div>
        </div>
        <div v-else-if="attr.filterType === 'TOGGLE'" class="form-row-inline">
          <input type="checkbox" class="form-checkbox" @change="$emit('set-attr', attr.id, 'boolean', $event.target.checked)" />
        </div>
        <select
          v-else
          class="form-control form-select"
          @change="$emit('set-attr', attr.id, 'optionIds', $event.target.value ? [$event.target.value] : [])"
        >
          <option value="">—</option>
          <option v-for="opt in attr.options" :key="opt.id" :value="opt.id">{{ opt.name }}</option>
        </select>
      </div>
    </div>

    <button v-if="showSearchButton" class="btn btn-tertiary btn-block" @click="$emit('search')">{{ t('common.search') }}</button>
  </div>
</template>

<script setup>
// RNT-053 — this renders in both the always-visible desktop sidebar and the
// mobile filter drawer; the drawer needs its own "apply" button since it's a
// modal the top search bar isn't reachable from, but the sidebar sits right
// next to that same top bar, so a second button there was a literal
// duplicate action on the same screen.
defineProps({
  query: { type: Object, required: true },
  filterableAttributes: { type: Array, default: () => [] },
  showSearchButton: { type: Boolean, default: true },
})
defineEmits(['set-attr', 'search'])
const { t } = useI18n()
</script>
