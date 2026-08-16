import { buildIpsQrPayload } from './ips-qr';

describe('buildIpsQrPayload', () => {
  const baseInput = {
    recipientAccount: '160-0000000012345-67',
    recipientName: 'Petar Petrović',
    amountRsd: 1500,
    purpose: 'Rezervacija oglasa',
    referenceNumber: 'RJ-000123',
  };

  it('builds a pipe-delimited payload with all required fields', () => {
    const payload = buildIpsQrPayload(baseInput);
    const fields = payload.split('|');
    expect(fields).toContain('K:PR');
    expect(fields).toContain('V:01');
    expect(fields).toContain('C:1');
    expect(fields).toContain('SF:289');
  });

  it('strips dashes/spaces from the recipient account', () => {
    const payload = buildIpsQrPayload(baseInput);
    expect(payload).toContain('R:160000000001234567');
    expect(payload).not.toContain('R:160-');
  });

  it('formats the amount with two decimals and the RSD prefix', () => {
    const payload = buildIpsQrPayload({ ...baseInput, amountRsd: 1500 });
    expect(payload).toContain('I:RSD1500.00');
  });

  it('truncates a recipient name longer than 70 characters', () => {
    const longName = 'A'.repeat(100);
    const payload = buildIpsQrPayload({ ...baseInput, recipientName: longName });
    const field = payload.split('|').find((f) => f.startsWith('N:'))!;
    expect(field.slice(2).length).toBe(70);
  });

  it('truncates a purpose longer than 35 characters', () => {
    const longPurpose = 'B'.repeat(60);
    const payload = buildIpsQrPayload({ ...baseInput, purpose: longPurpose });
    const field = payload.split('|').find((f) => f.startsWith('S:'))!;
    expect(field.slice(2).length).toBe(35);
  });

  it('includes the reference number as-is', () => {
    const payload = buildIpsQrPayload(baseInput);
    expect(payload).toContain('RO:RJ-000123');
  });
});
