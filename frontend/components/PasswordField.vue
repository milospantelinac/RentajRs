<template>
  <div class="password-field">
    <input
      :id="id"
      v-bind="$attrs"
      :value="modelValue"
      :type="visible ? 'text' : 'password'"
      class="form-control"
      @input="$emit('update:modelValue', $event.target.value)"
    />
    <button
      type="button"
      class="password-toggle"
      :aria-label="visible ? t('auth.hidePassword') : t('auth.showPassword')"
      @click="visible = !visible"
    >
      <svg v-if="visible" width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M3 3l18 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        <path
          d="M10.6 5.2A10.6 10.6 0 0 1 12 5c6.4 0 10 7 10 7a15.6 15.6 0 0 1-3.4 4.3M6.6 6.6C4 8.3 2 12 2 12s3.6 7 10 7c1.4 0 2.7-.3 3.8-.8"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <path d="M9.9 10a3 3 0 0 0 4.2 4.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
        <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8" />
      </svg>
    </button>
  </div>
</template>

<script setup>
defineOptions({ inheritAttrs: false })
defineProps({ modelValue: { type: String, default: '' }, id: { type: String, default: undefined } })
defineEmits(['update:modelValue'])
const { t } = useI18n()
const visible = ref(false)
</script>

<style lang="scss" scoped>
.password-field {
  position: relative;
}

.password-field .form-control {
  padding-right: 44px;
}

.password-toggle {
  position: absolute;
  top: 50%;
  right: 8px;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  background: none;
  border: none;
  color: $color-text-muted;
  cursor: pointer;
}

.password-toggle:hover {
  color: $color-text;
}
</style>
