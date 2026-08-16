import { toNestPaySafeAscii } from './ascii-transliterate';

describe('toNestPaySafeAscii', () => {
  it('returns falsy input unchanged', () => {
    expect(toNestPaySafeAscii('')).toBe('');
  });

  it('transliterates Serbian Latin diacritics to plain ASCII', () => {
    expect(toNestPaySafeAscii('čćšžđ')).toBe('ccszdj');
    expect(toNestPaySafeAscii('ČĆŠŽĐ')).toBe('CCSZDj');
  });

  it('transliterates a realistic name and company', () => {
    expect(toNestPaySafeAscii('Miloš Đorđević')).toBe('Milos Djordjevic');
    expect(toNestPaySafeAscii('Šumadija d.o.o.')).toBe('Sumadija d.o.o.');
  });

  it('normalizes an em dash to a hyphen', () => {
    expect(toNestPaySafeAscii('Rentaj — oglas')).toBe('Rentaj - oglas');
  });

  it('normalizes curly quotes to straight quotes', () => {
    expect(toNestPaySafeAscii('“citat” i ‘nešto’')).toBe('"citat" i \'nesto\'');
  });

  it('drops any remaining non-ASCII characters rather than throwing', () => {
    expect(toNestPaySafeAscii('emoji 🚗 test')).toBe('emoji  test');
  });

  it('leaves plain ASCII untouched', () => {
    expect(toNestPaySafeAscii('Plain ASCII 123')).toBe('Plain ASCII 123');
  });
});
