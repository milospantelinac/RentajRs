<template>
  <!-- Dizajn 22: the time fields of 239:287 ("soft", 252:330) and 532:514
       ("boxed", 532:837), picked from 30 minute steps. Dizajn 23 adds the rules
       step's fields ("field", 258:293) and an empty choice for a time that isn't set. -->
  <span class="time-select" :class="`time-select-${variant}`">
    <select
      :id="id"
      class="time-select-control"
      :value="modelValue"
      :aria-label="ariaLabel"
      @change="$emit('update:modelValue', $event.target.value)"
    >
      <option v-if="placeholder" value="">{{ placeholder }}</option>
      <option v-for="time in options" :key="time" :value="time">{{ time }}</option>
    </select>
    <img src="/images/icons/chevron-down.svg" alt="" class="time-select-chevron" />
  </span>
</template>

<script setup>
const props = defineProps({
  modelValue: { type: String, default: '' },
  variant: { type: String, default: 'soft' },
  id: { type: String, default: undefined },
  ariaLabel: { type: String, default: undefined },
  placeholder: { type: String, default: '' },
})

defineEmits(['update:modelValue'])

const STEP_TIMES = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`)

// A time saved before the list existed (any minute) stays selectable.
const options = computed(() =>
  props.modelValue && !STEP_TIMES.includes(props.modelValue) ? [...STEP_TIMES, props.modelValue].sort() : STEP_TIMES,
)
</script>

<style lang="scss" scoped>
.time-select {
  position: relative;
  display: block;
  min-width: 0;
}

// 252:330: 44 tall, no stroke, the value 16 in and the 16px chevron 14 from the right.
.time-select-control {
  display: block;
  width: 100%;
  height: 44px;
  margin: 0;
  padding: 0 38px 0 16px;
  border: 0;
  border-radius: $radius-input;
  background-color: $color-background;
  color: $color-text;
  font-family: $font-family-base;
  font-size: 14px;
  font-weight: 400;
  line-height: normal;
  appearance: none;
  cursor: pointer;
}

.time-select-control:focus-visible {
  outline: none;
  background-color: $color-surface;
  box-shadow: inset 0 0 0 1.5px $color-primary;
}

.time-select-chevron {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 16px;
  height: 16px;
  pointer-events: none;
}

// 532:837: a 1px stroke, the value 14 in and the 14px chevron 14 from the right.
.time-select-boxed .time-select-control {
  padding: 0 34px 0 14px;
  box-shadow: inset 0 0 0 1px $color-border;
}

.time-select-boxed .time-select-control:focus-visible {
  box-shadow: inset 0 0 0 1.5px $color-primary;
}

.time-select-boxed .time-select-chevron {
  top: 15px;
  width: 14px;
  height: 14px;
}

// 258:293: 47 tall, the value 18 in and the chevron 18 from the right.
.time-select-field .time-select-control {
  height: 47px;
  padding: 0 44px 0 18px;
  font-size: 15px;
}

.time-select-field .time-select-chevron {
  top: 15.5px;
  right: 18px;
}
</style>
