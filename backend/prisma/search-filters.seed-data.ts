import { FilterControl, FilterPlacement } from '@prisma/client';

/**
 * T115: the /pretraga filters of every category, from Tamara's table
 * "Rentaj_filteri_kompletna_tabela_v3.xlsx" (Trello T115). The seed writes
 * these rows (seedCategoryNode) and migration 20261009210100 wrote the same
 * ones into existing databases. Price, date and online booking sit on every
 * page and have no rows.
 *
 * Each list runs bar first, then the panel, each in the table's order. A
 * parent's own list is its "Sve" view and reads its subcategories' attributes
 * as well; a subcategory inherits its parent's attributes (Sale za proslave).
 */
export interface FilterSeed {
  key: string;
  /** The attribute read; defaults to `key`, null for the area pill. */
  attributeKey?: string | null;
  optionKey?: string;
  placement: FilterPlacement;
  control: FilterControl;
  thresholds?: number[];
}

const { BAR, PANEL } = FilterPlacement;

const select = (key: string, placement: FilterPlacement): FilterSeed => ({ key, placement, control: FilterControl.SELECT });
const range = (key: string): FilterSeed => ({ key, placement: PANEL, control: FilterControl.RANGE });
const allOf = (key: string): FilterSeed => ({ key, placement: PANEL, control: FilterControl.ALL_OF });

// "Kapacitet" became "Broj gostiju", or "Broj dece" for Igraonice, read
// from the capacity the owner gives in wizard step Detalji.
const guests = (thresholds: number[], attributeKey = 'kapacitet_ljudi'): FilterSeed => ({
  key: 'guests',
  attributeKey,
  placement: BAR,
  control: FilterControl.GUESTS,
  thresholds,
});

// Shown once a city is picked; Građevinske mašine has none ("bitan je grad").
const area: FilterSeed = { key: 'area', attributeKey: null, placement: BAR, control: FilterControl.AREA };

// "Ljubimci dozvoljeni" is the amenity owners already tick, as a switch of its own.
const pets: FilterSeed = {
  key: 'ljubimci',
  attributeKey: 'sadrzaji',
  optionKey: 'kucni-ljubimci-dozvoljeni',
  placement: PANEL,
  control: FilterControl.OPTION_TOGGLE,
};

const STAY_GUESTS = [2, 4, 6, 8, 10, 20, 50];
const EVENT_SPACE = [
  guests([20, 50, 100, 200, 300]),
  select('tip_prostora', BAR),
  select('ketering', BAR),
  area,
  allOf('sadrzaji'),
];

export const SEARCH_FILTERS: Record<string, FilterSeed[]> = {
  nekretnine: [guests(STAY_GUESTS), area, range('kvadratura'), range('broj_kreveta'), range('broj_kupatila'), allOf('sadrzaji'), pets],
  stanovi: [guests(STAY_GUESTS), select('broj_soba', BAR), area, select('sprat', PANEL), range('kvadratura'), allOf('sadrzaji'), pets],
  'kuce-i-vikendice': [
    guests(STAY_GUESTS),
    { key: 'broj_soba', placement: BAR, control: FilterControl.MIN, thresholds: [1, 2, 3, 4, 5] },
    area,
    range('broj_kreveta'),
    range('broj_kupatila'),
    allOf('sadrzaji'),
    pets,
  ],
  sobe: [guests(STAY_GUESTS), select('kupatilo', BAR), area, range('broj_kreveta'), range('kvadratura'), allOf('sadrzaji'), pets],
  'prostori-za-proslave': EVENT_SPACE,
  'sale-za-proslave': EVENT_SPACE,
  'konferencijske-sale': EVENT_SPACE,
  igraonice: [guests([10, 20, 30, 50], 'kapacitet_dece'), select('uzrast_dece', BAR), area, allOf('sadrzaji')],
  vozila: [
    select('tip_vozila', BAR),
    select('menjac', BAR),
    select('gorivo', BAR),
    area,
    { key: 'marka_vozila', placement: PANEL, control: FilterControl.MULTI_SELECT },
    range('godina_proizvodnje'),
    allOf('oprema'),
  ],
  'putnicka-vozila': [
    select('tip_vozila', BAR),
    select('broj_sedista', BAR),
    select('menjac', BAR),
    area,
    select('gorivo', PANEL),
    { key: 'marka_vozila', placement: PANEL, control: FilterControl.MULTI_SELECT },
    select('pogon', PANEL),
    range('godina_proizvodnje'),
    allOf('oprema'),
    { key: 'dostava_na_adresu', placement: PANEL, control: FilterControl.TOGGLE },
  ],
  'dostavna-vozila': [
    select('tip_vozila', BAR),
    select('nosivost', BAR),
    area,
    select('zapremina_tovarnog_prostora', PANEL),
    select('duzina_tovarnog_prostora', PANEL),
    select('sirina_tovarnog_prostora', PANEL),
    select('visina_tovarnog_prostora', PANEL),
    { key: 'marka_vozila', placement: PANEL, control: FilterControl.MULTI_SELECT },
    select('menjac', PANEL),
    select('gorivo', PANEL),
    select('pogon', PANEL),
    range('godina_proizvodnje'),
    allOf('oprema'),
    { key: 'dostava_na_adresu', placement: PANEL, control: FilterControl.TOGGLE },
  ],
  'magacini-i-skladista': [
    // "Novo, umesto Kapaciteta": the preset sizes from 20 m² up.
    { key: 'povrsina', placement: BAR, control: FilterControl.MIN, thresholds: [20, 50, 100, 200, 500] },
    select('tip_prostora', BAR),
    area,
    allOf('sadrzaji'),
  ],
  'gradjevinske-masine': [
    select('tip_masine', BAR),
    { key: 'sa_rukovaocem', placement: BAR, control: FilterControl.TOGGLE },
    { key: 'dostava_na_lokaciju', placement: BAR, control: FilterControl.TOGGLE },
  ],
  ostalo: [area],
};
