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
        <!-- T61 — the "amenities" attribute is named "Sadržaji"/"Oprema"
             differently per category in the underlying data; always shown as
             "Opremljenost" here instead. Keyed off attr.key rather than
             attr.type=CHECKBOX_GROUP, since that type also covers unrelated
             multiselects (e.g. Igraonice's "Uzrast dece") that must keep
             their own label. -->
        <label class="form-label">{{ ['sadrzaji', 'oprema'].includes(attr.key) ? t('listing.amenities') : attr.name }}</label>
        <div v-if="attr.filterType === 'RANGE'" class="row">
          <div class="col-6">
            <input type="number" class="form-control" placeholder="min" @change="$emit('set-attr', attr.attributeIds, 'min', $event.target.value)" />
          </div>
          <div class="col-6">
            <input type="number" class="form-control" placeholder="max" @change="$emit('set-attr', attr.attributeIds, 'max', $event.target.value)" />
          </div>
        </div>
        <div v-else-if="attr.filterType === 'TOGGLE'" class="form-row-inline">
          <input type="checkbox" class="form-checkbox" @change="$emit('set-attr', attr.attributeIds, 'boolean', $event.target.checked)" />
        </div>
        <!-- T62 — checkbox list instead of a single-select <select>, so a
             guest can pick several amenities at once; every selected option
             is sent together and combined with AND on the backend. -->
        <div v-else-if="attr.type === 'CHECKBOX_GROUP'" class="filter-checkbox-list">
          <label v-for="opt in attr.options" :key="opt.id" class="form-row-inline filter-checkbox-option">
            <input
              type="checkbox"
              class="form-checkbox"
              :value="opt.id"
              @change="toggleOption(attr, opt, $event.target.checked)"
            />
            <span class="text-muted">{{ opt.name }}</span>
          </label>
        </div>
        <select
          v-else
          class="form-control form-select"
          @change="$emit('set-attr', attr.attributeIds, 'optionIds', $event.target.value ? [[$event.target.value]] : [])"
        >
          <option value="">—</option>
          <option v-for="opt in attr.options" :key="opt.id" :value="opt.id">{{ opt.name }}</option>
        </select>
      </div>
    </div>

    <button v-if="showSearchButton" class="btn btn-tertiary btn-block" @click="$emit('search')">{{ t('search.applyFilters') }}</button>
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
const emit = defineEmits(['set-attr', 'search'])
const { t } = useI18n()

const selectedOptions = new Map() // attr.id -> Map<optionKey, ids[]>, local UI state for the checkbox list

function toggleOption(attr, opt, checked) {
  const selected = selectedOptions.get(attr.id) ?? new Map()
  if (checked) selected.set(opt.key, opt.ids)
  else selected.delete(opt.key)
  selectedOptions.set(attr.id, selected)
  // One group per selected amenity — see AttributeFilterInput.optionIds on
  // the backend: each group lists every id representing that one logical
  // option (plural only when this filter merged the same amenity across
  // several subcategories' own option rows, T64).
  emit('set-attr', attr.attributeIds, 'optionIds', Array.from(selected.values()))
}
</script>

<style lang="scss" scoped>
.filter-checkbox-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 220px;
  overflow-y: auto;
}

.filter-checkbox-option {
  gap: 8px;
}
</style>
