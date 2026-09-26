<template>
  <div class="auth-password">
    <input
      :id="id"
      v-bind="$attrs"
      :value="modelValue"
      :type="visible ? 'text' : 'password'"
      class="auth-input auth-input-password"
      @input="$emit('update:modelValue', $event.target.value)"
    />
    <button
      type="button"
      class="auth-eye"
      :aria-label="visible ? t('auth.hidePassword') : t('auth.showPassword')"
      :aria-pressed="visible"
      @click="visible = !visible"
    >
      <img :src="visible ? '/images/icons/eye-brand.svg' : '/images/icons/eye.svg'" alt="" />
    </button>
  </div>
</template>

<script setup>
// Styled by assets/scss/_auth.scss — /prijava and /registracija are its only users.
defineOptions({ inheritAttrs: false })
defineProps({ modelValue: { type: String, default: '' }, id: { type: String, default: undefined } })
defineEmits(['update:modelValue'])
const { t } = useI18n()
const visible = ref(false)
</script>
