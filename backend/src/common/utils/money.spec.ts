import { paraToRsd, rsdToPara } from './money';

describe('rsdToPara', () => {
  it('converts whole dinars to para (x100)', () => {
    expect(rsdToPara(100)).toBe(10000n);
  });

  it('rounds fractional dinars to the nearest para', () => {
    expect(rsdToPara(99.999)).toBe(10000n);
    expect(rsdToPara(10.004)).toBe(1000n);
  });

  it('handles zero', () => {
    expect(rsdToPara(0)).toBe(0n);
  });
});

describe('paraToRsd', () => {
  it('converts para back to whole dinars', () => {
    expect(paraToRsd(10000n)).toBe(100);
  });

  it('returns null for null or undefined input', () => {
    expect(paraToRsd(null)).toBeNull();
    expect(paraToRsd(undefined)).toBeNull();
  });

  it('round-trips with rsdToPara', () => {
    expect(paraToRsd(rsdToPara(1234))).toBe(1234);
  });
});
