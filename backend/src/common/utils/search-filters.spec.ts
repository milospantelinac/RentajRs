import { mergeFilterOptions, minFilterChoices, optionNumber, optionUnit, searchPriceUnits } from './search-filters';

describe('mergeFilterOptions', () => {
  it('merges the same option of two subcategories and sums their listings', () => {
    const merged = mergeFilterOptions(
      [
        { id: 'a1', options: [{ id: 'o1', key: 'klima', name: 'Klima' }, { id: 'o2', key: 'wifi', name: 'WiFi' }] },
        { id: 'a2', options: [{ id: 'o3', key: 'klima', name: 'Klima' }] },
      ],
      new Map([
        ['o1', 2],
        ['o3', 5],
      ]),
    );
    expect(merged).toEqual([
      { id: 'o1', key: 'klima', name: 'Klima', ids: ['o1', 'o3'], listingCount: 7 },
      { id: 'o2', key: 'wifi', name: 'WiFi', ids: ['o2'], listingCount: 0 },
    ]);
  });
});

describe('optionNumber', () => {
  it('reads the size an option names', () => {
    expect(optionNumber('20 m²')).toBe(20);
    expect(optionNumber('Preko 1000 m²')).toBe(1000);
    expect(optionNumber('0.75 m³')).toBe(0.75);
    expect(optionNumber('Garsonjera')).toBeNull();
  });
});

describe('optionUnit', () => {
  it('reads the unit after the number', () => {
    expect(optionUnit('20 m²')).toBe('m²');
    expect(optionUnit('Preko 1000 m²')).toBe('m²');
    expect(optionUnit('Garsonjera')).toBeNull();
  });
});

describe('minFilterChoices', () => {
  const sizes = ['20 m²', '50 m²', '100 m²', '200 m²', '300 m²', '500 m²', '1000 m²', 'Preko 1000 m²'].map((name, i) => ({
    id: `o${i}`,
    key: `k${i}`,
    name,
    ids: [`o${i}`],
    listingCount: 0,
  }));

  it('takes every preset size from the threshold up', () => {
    const choices = minFilterChoices('LIST', sizes, [20, 500]);
    expect(choices[0]).toEqual({ value: 20, optionIds: ['o0', 'o1', 'o2', 'o3', 'o4', 'o5', 'o6', 'o7'] });
    expect(choices[1]).toEqual({ value: 500, optionIds: ['o5', 'o6', 'o7'] });
  });

  it('leaves out a threshold no option reaches', () => {
    expect(minFilterChoices('LIST', sizes.slice(0, 2), [20, 100]).map((c) => c.value)).toEqual([20]);
  });

  it('keeps a number attribute to the threshold itself', () => {
    expect(minFilterChoices('NUMBER', [], [1, 2])).toEqual([
      { value: 1, optionIds: [] },
      { value: 2, optionIds: [] },
    ]);
  });
});

describe('searchPriceUnits', () => {
  it('lists the default unit first, then the rest in a fixed order', () => {
    expect(searchPriceUnits('SLOT', [{ allowedPriceUnits: ['HOUR', 'SLOT'] }])).toEqual(['SLOT', 'HOUR']);
    expect(
      searchPriceUnits('NIGHT', [{ allowedPriceUnits: ['NIGHT', 'MONTH'] }, { allowedPriceUnits: ['MONTH', 'NIGHT'] }]),
    ).toEqual(['NIGHT', 'MONTH']);
  });

  it('reads a parent through its subcategories', () => {
    expect(searchPriceUnits('SLOT', [{ allowedPriceUnits: ['SLOT', 'GUEST'] }, { allowedPriceUnits: ['HOUR'] }])).toEqual([
      'SLOT',
      'HOUR',
      'GUEST',
    ]);
  });
});
