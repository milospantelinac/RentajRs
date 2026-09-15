// Dizajn 23 (258:293): the rules step's whole numbers. Keeps only the digits, drops
// leading zeros and puts the caret back after the digit it followed. Returns the
// number, or null once emptied.
export function applyIntegerInput(event, maxDigits = 4) {
  const input = event.target
  const digitsBeforeCaret = input.value.slice(0, input.selectionStart ?? input.value.length).replace(/\D/g, '').length
  const digits = input.value.replace(/\D/g, '').slice(0, maxDigits)
  const value = digits ? Number(digits) : null
  input.value = value === null ? '' : String(value)
  const droppedZeros = digits.length - input.value.length
  const caret = Math.max(0, Math.min(input.value.length, digitsBeforeCaret - droppedZeros))
  input.setSelectionRange(caret, caret)
  return value
}
