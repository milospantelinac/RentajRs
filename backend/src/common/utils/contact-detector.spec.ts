import { containsContactInfo } from './contact-detector';

describe('containsContactInfo', () => {
  it('returns false for empty or plain text', () => {
    expect(containsContactInfo('')).toBe(false);
    expect(containsContactInfo(null as unknown as string)).toBe(false);
    expect(containsContactInfo('Stan je prostran i svetao, blizu centra grada.')).toBe(false);
  });

  it('detects phone numbers', () => {
    expect(containsContactInfo('Zovite me na 061 234 5678')).toBe(true);
    expect(containsContactInfo('+381601234567 dostupan sam uvek')).toBe(true);
  });

  it('detects email addresses', () => {
    expect(containsContactInfo('Pišite na pera@example.com za detalje')).toBe(true);
  });

  it('detects links', () => {
    expect(containsContactInfo('Pogledajte www.mojsajt.rs za više slika')).toBe(true);
    expect(containsContactInfo('http://example.com/stan')).toBe(true);
  });

  it('detects social handles', () => {
    expect(containsContactInfo('Pratite me na Instagram: @pera_petrovic')).toBe(true);
    expect(containsContactInfo('viber 0611234567')).toBe(true);
  });

  it('does not false-positive on ordinary punctuation', () => {
    expect(containsContactInfo('Cena je 50 e. Dogovor je moguc.')).toBe(false);
  });
});
