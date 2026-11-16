import { isValidPib, normalizePib } from './pib';

describe('PIB', () => {
  it('accepts a PIB whose check digit adds up', () => {
    expect(isValidPib('115213635')).toBe(true);
  });

  it('refuses one whose check digit does not', () => {
    expect(isValidPib('123456789')).toBe(false);
    expect(isValidPib('115213636')).toBe(false);
  });

  it('refuses anything that is not nine digits', () => {
    expect(isValidPib('')).toBe(false);
    expect(isValidPib(null)).toBe(false);
    expect(isValidPib(undefined)).toBe(false);
    expect(isValidPib('11521363')).toBe(false);
    expect(isValidPib('1152136350')).toBe(false);
    expect(isValidPib('11521363a')).toBe(false);
  });

  it('reads a PIB the way people write it', () => {
    expect(normalizePib(' RS 115 213 635 ')).toBe('115213635');
    expect(normalizePib('115-213-635')).toBe('115213635');
    expect(isValidPib('RS115213635')).toBe(true);
    expect(isValidPib('115 213 635')).toBe(true);
  });
});
