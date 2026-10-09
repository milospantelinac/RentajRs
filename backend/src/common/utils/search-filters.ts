import { FilterControl, FilterPlacement, PriceUnit } from '@prisma/client';

/** T115: one option of a search filter, merged across the subcategories that share it. */
export type SearchFilterOption = {
  id: string;
  key: string;
  name: string;
  /** Every AttributeOption id that stands for this option (one per subcategory). */
  ids: string[];
  /** Live listings that have it, for "the 8 most common first" in Opremljenost. */
  listingCount: number;
};

/** "N+" of a MIN or GUESTS filter; for a list, the options from N up. */
export type SearchFilterChoice = { value: number; optionIds: string[] };

/** T115: one filter of /pretraga as GET /search/filters describes it. */
export type SearchFilter = {
  key: string;
  control: FilterControl;
  placement: FilterPlacement;
  attributeKey: string | null;
  /** The attribute's name, or the option's for an OPTION_TOGGLE. */
  name: string | null;
  unit: string | null;
  attributeIds: string[];
  options: SearchFilterOption[];
  choices: SearchFilterChoice[];
  /** OPTION_TOGGLE: every id of the option that has to be ticked. */
  optionIds: string[];
};

type AttributeWithOptions = { id: string; options: Array<{ id: string; key: string; name: string }> };

/**
 * One entry per option key across the attributes behind a filter (T64: Stanovi
 * and Kuće each have their own "Klima" row), with the live listing counts summed.
 */
export function mergeFilterOptions(attributes: AttributeWithOptions[], counts: Map<string, number>): SearchFilterOption[] {
  const merged = new Map<string, SearchFilterOption>();
  for (const attribute of attributes) {
    for (const option of attribute.options) {
      const count = counts.get(option.id) ?? 0;
      const entry = merged.get(option.key);
      if (entry) {
        entry.ids.push(option.id);
        entry.listingCount += count;
      } else {
        merged.set(option.key, { id: option.id, key: option.key, name: option.name, ids: [option.id], listingCount: count });
      }
    }
  }
  return [...merged.values()];
}

/** The number an option of preset sizes names: 20 for "20 m²", 1000 for "Preko 1000 m²". */
export function optionNumber(name: string): number | null {
  const match = name.replace(',', '.').match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

/** The unit after that number ("m²" of "20 m²"), for the "20+ m²" of a MIN pill over a list. */
export function optionUnit(name: string): string | null {
  const match = name.match(/\d+(?:[.,]\d+)?\s*(.+)$/);
  return match ? match[1].trim() : null;
}

/**
 * The choices of a MIN filter. A number attribute (Broj soba of a house) takes
 * the threshold itself; a list of preset sizes (Površina of a warehouse) takes
 * every option from the threshold up, and a threshold no option reaches is left out.
 */
export function minFilterChoices(attributeType: string, options: SearchFilterOption[], thresholds: number[]): SearchFilterChoice[] {
  if (attributeType !== 'LIST') return thresholds.map((value) => ({ value, optionIds: [] }));
  return thresholds
    .map((value) => ({
      value,
      optionIds: options.filter((option) => (optionNumber(option.name) ?? -Infinity) >= value).flatMap((option) => option.ids),
    }))
    .filter((choice) => choice.optionIds.length > 0);
}

// The order of the unit chips after the category's own default unit.
const PRICE_UNIT_ORDER: PriceUnit[] = ['NIGHT', 'DAY', 'HOUR', 'SLOT', 'GUEST', 'MONTH', 'YEAR'];

/**
 * T115 (Excel row 160): the units a category's prices come in, for the Cena
 * pill. A parent reads its subcategories; its own default unit comes first.
 */
export function searchPriceUnits(defaultUnit: PriceUnit, leaves: Array<{ allowedPriceUnits: PriceUnit[] }>): PriceUnit[] {
  const units = new Set(leaves.flatMap((leaf) => leaf.allowedPriceUnits));
  const rank = (unit: PriceUnit) => (unit === defaultUnit ? -1 : PRICE_UNIT_ORDER.indexOf(unit));
  return [...units].sort((a, b) => rank(a) - rank(b));
}
