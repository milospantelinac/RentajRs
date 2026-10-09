import { maskPhone } from './phone-mask';

describe('maskPhone (T134)', () => {
  it('keeps the national prefix and hides the rest', () => {
    expect(maskPhone('064 123 4567')).toBe('064 *** ***');
    expect(maskPhone('0621234567')).toBe('062 *** ***');
    expect(maskPhone('(011) 123-4567')).toBe('011 *** ***');
  });

  it('writes a Serbian number stored internationally the national way', () => {
    expect(maskPhone('+381 62 123 4567')).toBe('062 *** ***');
    expect(maskPhone('+381621234567')).toBe('062 *** ***');
    expect(maskPhone('00381 64 1234 567')).toBe('064 *** ***');
  });

  it('keeps the start of a foreign number instead', () => {
    expect(maskPhone('+387 65 123 456')).toBe('+387 *** ***');
    expect(maskPhone('00387 65 123 456')).toBe('+387 *** ***');
  });

  it('never carries more than the prefix', () => {
    for (const phone of ['064 123 4567', '+381 62 123 4567', '+387 65 123 456']) {
      const masked = maskPhone(phone);
      expect(masked.replace(/\D/g, '').length).toBeLessThanOrEqual(3);
      expect(masked).not.toContain('123');
    }
  });
});
