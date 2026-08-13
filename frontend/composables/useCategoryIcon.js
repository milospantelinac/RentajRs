// Category.icon stores a semantic key (Ch.17), not a glyph — this maps the
// known seed keys to an emoji so category chips/cards show something better
// than the raw key. No icon library is installed anywhere else in the
// project, so this stays dependency-free rather than pulling one in just
// for ~15 glyphs.
const ICONS = {
  home: '🏠',
  building: '🏢',
  house: '🏡',
  bed: '🛏️',
  party: '🎉',
  hall: '🏛️',
  meeting: '💼',
  toy: '🧸',
  car: '🚗',
  sedan: '🚙',
  van: '🚐',
  excavator: '🚜',
  warehouse: '📦',
  tools: '🛠️',
  other: '🏷️',
}

export function useCategoryIcon(key) {
  return ICONS[key] || ICONS.other
}
