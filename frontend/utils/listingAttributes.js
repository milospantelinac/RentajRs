// Dizajn 25: how the listing page's Detalji and Opremljenost sections read a listing's
// attributes. Step Detalji in the wizard previews the same rows, so both read them here.

// Uzrast dece is a CHECKBOX_GROUP of age brackets, but it says who the place is for, not
// what is in it: the listing shows it in Detalji as one range.
const AGE_RANGE_KEYS = new Set(['uzrast_dece'])

// T51: every other CHECKBOX_GROUP (Sadržaji, and Oprema and Priključci for Vozila and
// Mašine) goes into the single Opremljenost section, never a Detalji row (T57).
export function isAmenityAttribute(attr) {
  return attr.type === 'CHECKBOX_GROUP' && !AGE_RANGE_KEYS.has(attr.key)
}

function selectedOptionNames(attr) {
  return (attr.value?.valueOptionIds || []).map((id) => attr.options?.find((o) => o.id === id)?.name).filter(Boolean)
}

// T54/T57/T71: LIST and MULTISELECT values are option ids, shown by their names.
export function formatAttributeValue(attr, t) {
  const v = attr.value
  if (!v) return ''
  if (AGE_RANGE_KEYS.has(attr.key)) {
    const range = getAgeRange(selectedOptionNames(attr))
    if (!range) return ''
    const years = t(`listing.ageRangeYears${srPluralCategory(range.max)}`)
    return range.min === range.max ? `${range.min}+ ${years}` : `${range.min}-${range.max} ${years}`
  }
  if (v.valueBoolean !== null && v.valueBoolean !== undefined) return v.valueBoolean ? t('common.yes') : t('common.no')
  if (v.valueNumber !== null && v.valueNumber !== undefined) return `${v.valueNumber}${attr.unit ? ' ' + attr.unit : ''}`
  if (v.valueOptionIds?.length) return selectedOptionNames(attr).join(', ')
  return v.valueText || ''
}

// The Detalji rows, in the category's order. An attribute the owner left empty has none.
export function getDetailAttributes(attributes, t) {
  return (attributes || []).filter((attr) => !isAmenityAttribute(attr) && attr.value && formatAttributeValue(attr, t))
}

// The Opremljenost items, merged across the groups and deduplicated by name. Each keeps
// its option's key so the Dizajn 2 icon library can be addressed by it.
export function getAmenityItems(attributes) {
  const seen = new Map()
  for (const attr of attributes || []) {
    if (!isAmenityAttribute(attr) || !attr.value?.valueOptionIds?.length) continue
    for (const id of attr.value.valueOptionIds) {
      const option = attr.options?.find((o) => o.id === id)
      if (option?.name && !seen.has(option.name)) seen.set(option.name, { key: option.key || option.name, name: option.name })
    }
  }
  return Array.from(seen.values())
}

// T61: the amenities attribute is named differently per category in the data but always
// reads as "Opremljenost" in the search panel.
export function getFilterAttributeLabel(attr, t) {
  return ['sadrzaji', 'oprema'].includes(attr.key) ? t('listing.amenities') : attr.name
}
