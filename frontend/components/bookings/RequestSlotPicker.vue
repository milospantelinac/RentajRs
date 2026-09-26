<template>
  <div class="slots">
    <div class="slots-head">
      <h2 class="slots-title">{{ t('bookingForm.slotsTitle') }}</h2>
      <!-- Dizajn 40 (user decision): seven days at a time, with the calendar's
           arrow buttons (373:412) for the weeks before and after. -->
      <div v-if="dayKeys.length" class="slots-arrows">
        <button type="button" class="slots-arrow" :disabled="!canGoBack" :aria-label="t('bookingForm.prevDays')" @click="shiftWindow(-7)">
          <img src="/images/icons/chevron-left-18.svg" alt="" />
        </button>
        <button type="button" class="slots-arrow" :disabled="!canGoForward" :aria-label="t('bookingForm.nextDays')" @click="shiftWindow(7)">
          <img src="/images/icons/chevron-right-18.svg" alt="" />
        </button>
      </div>
    </div>

    <p v-if="!dayKeys.length" class="slots-empty">{{ t('booking.noSlots') }}</p>

    <template v-else>
      <div class="slots-days" role="group" :aria-label="t('bookingForm.slotsTitle')">
        <button
          v-for="day in windowDays"
          :key="day.key"
          type="button"
          class="slots-day"
          :class="{ 'is-selected': day.key === viewedDay, 'is-closed': !day.free }"
          :disabled="!day.free"
          :aria-pressed="day.key === viewedDay"
          @click="viewedDay = day.key"
        >
          <span class="slots-day-weekday">{{ day.weekday }}</span>
          <span class="slots-day-date">{{ day.date }}</span>
          <span class="slots-day-note">{{ day.note }}</span>
        </button>
      </div>

      <div v-if="viewedDayEntry" class="slots-list">
        <p class="slots-list-title">{{ viewedHeading }}</p>
        <div class="slots-grid">
          <button
            v-for="slot in viewedDayEntry.slots"
            :key="slot.id"
            type="button"
            class="slots-slot"
            :class="{ 'is-selected': slot.id === modelValue, 'is-taken': slot.taken }"
            :disabled="slot.taken"
            :aria-pressed="slot.id === modelValue"
            @click="emit('update:modelValue', slot.id)"
          >
            <span class="slots-slot-time">{{ slot.time }}</span>
            <span class="slots-slot-price">{{ slot.taken ? t('bookingForm.slotTaken') : slot.price }}</span>
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
// Dizajn 40, 538:557: the days of a listing with defined slots (538:843) and
// the slots of the day in view (538:874), taken ones grey and closed (T74).
// `entries` come from buildSlotEntries (utils/bookingRequestForm.js).
const props = defineProps({
  entries: { type: Array, required: true },
  modelValue: { type: String, default: null },
})
const emit = defineEmits(['update:modelValue'])

const { t } = useI18n()

// Entries are sorted by start, so their days are too.
const dayKeys = computed(() => [...new Set(props.entries.map((entry) => entry.day))])
const firstDay = computed(() => dayKeys.value[0] || null)
const lastDay = computed(() => dayKeys.value[dayKeys.value.length - 1] || null)

const windowStart = ref(null)
const viewedDay = ref(null)

// Windows are counted in whole weeks from the first day with a slot, so the
// arrows always land on the same seven days.
function windowFor(key) {
  const offset = Math.max(0, daysBetweenKeys(firstDay.value, key))
  return addDaysToKey(firstDay.value, Math.floor(offset / 7) * 7)
}

function firstFreeDayFrom(start) {
  const end = addDaysToKey(start, 7)
  return props.entries.find((entry) => !entry.taken && entry.day >= start && entry.day < end)?.day || null
}

// The chosen slot's day, else the first day a slot is still free.
function placeWindow() {
  if (!firstDay.value) {
    windowStart.value = null
    viewedDay.value = null
    return
  }
  const chosen = props.entries.find((entry) => entry.id === props.modelValue)
  const target = chosen?.day || props.entries.find((entry) => !entry.taken)?.day || firstDay.value
  windowStart.value = windowFor(target)
  viewedDay.value = chosen?.day || firstFreeDayFrom(windowStart.value)
}

watch(
  () => props.entries,
  () => {
    const stillThere = windowStart.value && firstDay.value && windowStart.value >= windowFor(firstDay.value) && windowStart.value <= lastDay.value
    if (!stillThere) placeWindow()
  },
  { immediate: true },
)

const windowDays = computed(() => (windowStart.value ? buildSlotDays(t, props.entries, windowStart.value) : []))
const viewedDayEntry = computed(() => windowDays.value.find((day) => day.key === viewedDay.value) || null)
const viewedHeading = computed(() => (viewedDayEntry.value ? formatSlotsHeading(t, viewedDayEntry.value.key) : ''))

const canGoBack = computed(() => !!windowStart.value && windowStart.value > firstDay.value)
const canGoForward = computed(() => !!windowStart.value && addDaysToKey(windowStart.value, 7) <= lastDay.value)

function shiftWindow(days) {
  windowStart.value = addDaysToKey(windowStart.value, days)
  viewedDay.value = firstFreeDayFrom(windowStart.value)
}
</script>

<style lang="scss" scoped>
// 538:557: the title, the days and the slots 16 apart.
.slots {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

// The arrows are not in the frame; they hang in the title's 21px row so
// nothing below moves.
.slots-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  height: 21px;
}

// 538:842
.slots-title {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  line-height: normal;
  color: $color-text;
}

.slots-arrows {
  display: flex;
  gap: 6px;
}

.slots-arrow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 1px solid $color-border;
  border-radius: 8px;
  background: $color-surface;
  cursor: pointer;
  transition: border-color 0.15s ease;
}

.slots-arrow img {
  width: 18px;
  height: 18px;
}

.slots-arrow:hover:not(:disabled) {
  border-color: $color-primary;
}

.slots-arrow:disabled {
  opacity: 0.4;
  cursor: default;
}

.slots-empty {
  margin: 0;
  font-size: 14px;
  font-weight: 300;
  line-height: normal;
  color: $color-text-muted;
}

// 538:843
.slots-days {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

// 538:844: the strokes are drawn inside, as inset shadows, so a selected day
// (1.5px) is as wide as the others.
.slots-day {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 12px 14px;
  border: 0;
  border-radius: 14px;
  background: $color-surface;
  box-shadow: inset 0 0 0 1px $color-border;
  font-family: $font-family-base;
  line-height: normal;
  cursor: pointer;
  transition: box-shadow 0.15s ease;
}

.slots-day:hover:not(:disabled):not(.is-selected) {
  box-shadow: inset 0 0 0 1px $color-primary;
}

.slots-day-weekday {
  font-size: 12px;
  font-weight: 400;
  color: $color-text-muted;
}

.slots-day-date {
  font-size: 15px;
  font-weight: 500;
  color: $color-text;
}

.slots-day-note {
  font-size: 11px;
  font-weight: 300;
  color: $color-text-muted;
}

// 538:848
.slots-day.is-selected {
  background: $color-accent-tint;
  box-shadow: inset 0 0 0 1.5px $color-primary;
}

.slots-day.is-selected .slots-day-date {
  color: $color-primary;
}

// 538:856
.slots-day.is-closed {
  background: $color-background;
  opacity: 0.55;
  cursor: default;
}

// 538:872
.slots-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.slots-list-title {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  line-height: normal;
  color: $color-text;
}

// 538:874: 228 wide cards, 10 apart.
.slots-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 228px));
  gap: 10px;
}

// 538:875
.slots-slot {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  min-width: 0;
  padding: 12px 16px;
  border: 0;
  border-radius: 12px;
  background: $color-surface;
  box-shadow: inset 0 0 0 1px $color-border;
  font-family: $font-family-base;
  line-height: normal;
  text-align: left;
  cursor: pointer;
  transition: box-shadow 0.15s ease;
}

.slots-slot:hover:not(:disabled):not(.is-selected) {
  box-shadow: inset 0 0 0 1px $color-primary;
}

.slots-slot-time {
  font-size: 15px;
  font-weight: 500;
  color: $color-text;
  white-space: nowrap;
}

.slots-slot-price {
  font-size: 13px;
  font-weight: 300;
  color: $color-text-muted;
}

// 538:878
.slots-slot.is-selected {
  background: $color-accent-tint;
  box-shadow: inset 0 0 0 1.5px $color-primary;
}

.slots-slot.is-selected .slots-slot-time {
  color: $color-primary;
}

// 538:881
.slots-slot.is-taken {
  background: $color-background;
  opacity: 0.6;
  cursor: default;
}

.slots-slot.is-taken .slots-slot-time {
  color: $color-text-muted;
}

@include respond-below(md) {
  .slots-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
