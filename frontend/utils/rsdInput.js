// Dizajn 21 (249:319): RSD amounts are typed as "3.500", grouped the way
// ListingCard prints them. Shared by the wizard's price fields and the slot
// editors on the availability step (Dizajn 22).
const rsdInputFormatter = new Intl.NumberFormat('sr-RS')

export const RSD_INPUT_MAX_DIGITS = 9

export function formatRsdInput(value) {
  return value ? rsdInputFormatter.format(value) : ''
}

// Keeps only the digits, writes them back grouped, and puts the caret back
// after the digit it followed. Returns the amount, or null once emptied.
export function applyRsdInput(event) {
  const input = event.target
  const digitsBeforeCaret = input.value.slice(0, input.selectionStart ?? input.value.length).replace(/\D/g, '').length
  const digits = input.value.replace(/\D/g, '').slice(0, RSD_INPUT_MAX_DIGITS)
  const amount = digits ? Number(digits) : null
  const formatted = formatRsdInput(amount)
  input.value = formatted
  let caret = 0
  for (let seen = 0; caret < formatted.length && seen < digitsBeforeCaret; caret++) {
    if (/\d/.test(formatted[caret])) seen++
  }
  input.setSelectionRange(caret, caret)
  return amount
}
