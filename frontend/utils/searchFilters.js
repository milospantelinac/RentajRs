// T115: the /pretraga filters as GET /search/filters describes them, shared by
// the bar (pages/pretraga.vue), "Više filtera" (FilterPanel.vue) and the
// wizard's step Detalji, which lists what guests can filter by.
//
// What the visitor picked is kept per filter key:
//   SELECT        one option key
//   MULTI_SELECT  option keys, any of them (Marka vozila)
//   ALL_OF        option keys, all of them (Opremljenost)
//   MIN           the threshold, "2+" is 2
//   RANGE         { min, max }
//   TOGGLE, OPTION_TOGGLE  true
// GUESTS and AREA write query.guests and query.cityAreaIds instead.

import { getFilterAttributeLabel } from './listingAttributes'

// "Opremljenost" opens on the options most listings have (Excel rows 25, 74).
export const LIST_PREVIEW_COUNT = 8
// Longer lists get a search field (the merged Nekretnine list has about 30).
export const LIST_SEARCH_FROM = 20

export function getSearchFilterLabel(filter, t) {
  if (filter.control === 'GUESTS') {
    return t(filter.attributeKey === 'kapacitet_dece' ? 'search.filterChildren' : 'search.filterGuests')
  }
  if (filter.control === 'AREA') return t('search.filterArea')
  if (filter.key === 'ljubimci') return t('search.filterPets')
  return getFilterAttributeLabel(filter, t)
}

// "4+ gostiju", "10+ dece", "2+", "20+ m²".
export function getSearchChoiceLabel(filter, value, t) {
  if (filter.control === 'GUESTS') {
    return t(filter.attributeKey === 'kapacitet_dece' ? 'search.childrenOption' : 'search.guestsOption', { count: value })
  }
  return filter.unit ? `${value}+ ${filter.unit}` : `${value}+`
}

// Whether a filter carries a value; GUESTS and AREA live on the query.
export function isSelectionSet(filter, value) {
  if (value === undefined || value === null || value === '') return false
  if (Array.isArray(value)) return value.length > 0
  if (filter.control === 'RANGE') return value.min != null || value.max != null
  return true
}

// The "Više filtera" badge counts each ticked option of a list, one for the rest.
export function countSelection(filter, value) {
  if (!isSelectionSet(filter, value)) return 0
  return Array.isArray(value) ? value.length : 1
}

// The search body's `attributes`, from what the visitor picked.
export function buildAttributeFilters(filters, selections) {
  const out = []
  for (const filter of filters) {
    const value = selections.get(filter.key)
    if (!isSelectionSet(filter, value)) continue
    const base = { attributeIds: filter.attributeIds }
    const picked = Array.isArray(value) ? filter.options.filter((option) => value.includes(option.key)) : []
    switch (filter.control) {
      case 'SELECT': {
        const option = filter.options.find((candidate) => candidate.key === value)
        if (option) out.push({ ...base, optionIds: [option.ids] })
        break
      }
      case 'MULTI_SELECT':
        if (picked.length) out.push({ ...base, optionIds: [picked.flatMap((option) => option.ids)] })
        break
      case 'ALL_OF':
        if (picked.length) out.push({ ...base, optionIds: picked.map((option) => option.ids) })
        break
      case 'MIN': {
        const choice = filter.choices.find((candidate) => candidate.value === value)
        if (choice) out.push(choice.optionIds.length ? { ...base, optionIds: [choice.optionIds] } : { ...base, min: choice.value })
        break
      }
      case 'RANGE':
        out.push({
          ...base,
          ...(value.min != null ? { min: value.min } : {}),
          ...(value.max != null ? { max: value.max } : {}),
        })
        break
      case 'TOGGLE':
        out.push({ ...base, boolean: true })
        break
      case 'OPTION_TOGGLE':
        out.push({ ...base, optionIds: [filter.optionIds] })
        break
    }
  }
  return out
}

// Most listings first, the seed's order between equals.
export function sortOptionsByUse(options) {
  return options
    .map((option, index) => ({ option, index }))
    .sort((a, b) => (b.option.listingCount || 0) - (a.option.listingCount || 0) || a.index - b.index)
    .map((entry) => entry.option)
}

// For the option search: "Đakuzi" is found by "dakuz" and "djakuzi", "Roštilj" by "rostilj".
export function foldSearchText(text) {
  return String(text)
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/dj/g, 'd')
}
