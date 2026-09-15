export function useLocalizedFormValidation() {
  const { t } = useI18n()

  function messageFor(el) {
    const v = el.validity
    if (v.valueMissing) return el.type === 'checkbox' ? t('validation.requiredCheckbox') : t('validation.required')
    if (v.typeMismatch) return t('validation.email')
    if (v.tooShort) return t('validation.minLength', { min: el.minLength })
    if (v.tooLong) return t('validation.maxLength', { max: el.maxLength })
    if (v.patternMismatch) return el.dataset.patternMessage || t('validation.pattern')
    return t('validation.invalid')
  }

  // `invalid` doesn't bubble, so this must be bound with `.capture` on an
  // ancestor (the <form>) to catch it on the way down to the field.
  function onInvalidCapture(event) {
    const el = event.target
    if (!el || typeof el.setCustomValidity !== 'function') return
    el.setCustomValidity(messageFor(el))
  }

  function onInputCapture(event) {
    const el = event.target
    if (!el || typeof el.setCustomValidity !== 'function') return
    el.setCustomValidity('')
  }

  return { onInvalidCapture, onInputCapture, messageFor }
}

// Same localized messages, shown under each field (keyed by its `name`)
// instead of in the browser's bubble — Dizajn 6 field errors.
export function useInlineFormValidation() {
  const { onInvalidCapture, onInputCapture, messageFor } = useLocalizedFormValidation()
  const fieldErrors = reactive({})
  let focusPending = false

  function onInvalid(event) {
    onInvalidCapture(event)
    event.preventDefault()
    const el = event.target
    if (el.name) fieldErrors[el.name] = messageFor(el)
    // Cancelling the bubble also stops the browser focusing the first invalid field.
    if (!focusPending) {
      focusPending = true
      el.focus()
      nextTick(() => {
        focusPending = false
      })
    }
  }

  function onInput(event) {
    onInputCapture(event)
    const name = event.target.name
    if (name && fieldErrors[name]) fieldErrors[name] = ''
  }

  return { fieldErrors, onInvalid, onInput }
}
