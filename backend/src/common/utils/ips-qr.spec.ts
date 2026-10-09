import {
  bankTransferPayee,
  bookingBankTransfer,
  bookingPaymentReference,
  buildIpsQrPayload,
  formatBankAccount,
  normalizeBankAccount,
} from './ips-qr';

// Every expected payload below was accepted by the NBS validator
// (https://nbs.rs/QRcode/api/qr/v1/validate) when T142 was fixed.
describe('normalizeBankAccount', () => {
  it('pads the middle part to 13 digits', () => {
    expect(normalizeBankAccount('160-1234-60')).toBe('160000000000123460');
    expect(normalizeBankAccount('160-0000000001234-60')).toBe('160000000000123460');
  });

  it('takes 18 digits as they are', () => {
    expect(normalizeBankAccount('160000000000123460')).toBe('160000000000123460');
  });

  it('refuses control digits that do not check out (mod 97)', () => {
    expect(normalizeBankAccount('160-55555555555-55')).toBeNull();
    expect(normalizeBankAccount('160-0000000012345-67')).toBeNull();
  });

  it('refuses anything that is not an account', () => {
    expect(normalizeBankAccount('')).toBeNull();
    expect(normalizeBankAccount(null)).toBeNull();
    expect(normalizeBankAccount('160-12a4-60')).toBeNull();
    expect(normalizeBankAccount('160-00000000001234-60')).toBeNull();
  });
});

describe('formatBankAccount', () => {
  it('writes a valid account in full', () => {
    expect(formatBankAccount('160-1234-60')).toBe('160-0000000001234-60');
  });

  it('leaves an invalid one as it was typed', () => {
    expect(formatBankAccount('160-55555555555-55')).toBe('160-55555555555-55');
  });
});

describe('buildIpsQrPayload', () => {
  const base = {
    recipientAccount: '160-1234-60',
    recipientName: 'Petar Petrović',
    amountPara: 2_000_000n,
    purpose: 'Mrčin bager',
    referenceNumber: '1e3a4ad3d7504312b143',
  };
  const field = (payload: string | null, tag: string) =>
    payload!.split('|').find((f) => f.startsWith(`${tag}:`))?.slice(tag.length + 1);

  it('builds the payload the NBS validator accepts', () => {
    expect(buildIpsQrPayload(base)).toBe(
      'K:PR|V:01|C:1|R:160000000000123460|N:Petar Petrović|I:RSD20000,00|SF:221|S:Mrčin bager|RO:001e3a4ad3d7504312b143',
    );
  });

  it('writes the amount with a decimal comma', () => {
    expect(field(buildIpsQrPayload({ ...base, amountPara: 150_050n }), 'I')).toBe('RSD1500,50');
    expect(field(buildIpsQrPayload({ ...base, amountPara: 5n }), 'I')).toBe('RSD0,05');
  });

  it('makes no code for an account banks would refuse', () => {
    expect(buildIpsQrPayload({ ...base, recipientAccount: '160-55555555555-55' })).toBeNull();
  });

  it('puts a seat in the second line of N when it fits whole', () => {
    const payload = buildIpsQrPayload({ ...base, recipientName: 'Rentaj d.o.o.', recipientPlace: 'Bulevar 10, Beograd' });
    expect(field(payload, 'N')).toBe('Rentaj d.o.o.\r\nBulevar 10, Beograd');
  });

  it('leaves the seat out when name and seat pass 70 characters', () => {
    const payload = buildIpsQrPayload({ ...base, recipientName: 'A'.repeat(40), recipientPlace: 'B'.repeat(29) });
    expect(field(payload, 'N')).toBe('A'.repeat(40));
  });

  it('cuts a long name at 70 characters', () => {
    expect(field(buildIpsQrPayload({ ...base, recipientName: 'A'.repeat(100) }), 'N')).toHaveLength(70);
  });

  it('cuts a long purpose at a word, within 35 characters', () => {
    const payload = buildIpsQrPayload({ ...base, purpose: 'Igraonica Balončići Vračar Beograd centar' });
    expect(field(payload, 'S')).toBe('Igraonica Balončići Vračar Beograd');
  });

  it('writes Cyrillic in Latin and drops what the validator refuses', () => {
    const enDash = String.fromCharCode(0x2013);
    const payload = buildIpsQrPayload({ ...base, recipientName: 'Ђорђе Љубић', purpose: `Сала ${enDash} Café [VIP] | a\\b` });
    expect(field(payload, 'N')).toBe('Đorđe Ljubić');
    expect(field(payload, 'S')).toBe('Sala - Cafe (VIP) ab');
  });

  it('keeps what a compatibility form spells out', () => {
    expect(field(buildIpsQrPayload({ ...base, purpose: 'Магацин 200 м²' }), 'S')).toBe('Magacin 200 m2');
  });

  it('leaves out S and RO when there is nothing to put in them', () => {
    const payload = buildIpsQrPayload({ ...base, purpose: '||', referenceNumber: null });
    expect(payload).toBe('K:PR|V:01|C:1|R:160000000000123460|N:Petar Petrović|I:RSD20000,00|SF:221');
  });
});

describe('bankTransferPayee', () => {
  const person = { firstName: 'Petar', lastName: 'Petrović' };

  it('pays a person under first and last name', () => {
    expect(bankTransferPayee({ ...person, buyerType: 'PERSON', companyName: 'Firma', billingAddress: 'Ulica 1' })).toEqual({
      name: 'Petar Petrović',
      place: null,
    });
  });

  it('pays a company under its name and seat', () => {
    expect(bankTransferPayee({ ...person, buyerType: 'COMPANY', companyName: 'Rentaj d.o.o.', billingAddress: 'Bulevar 10, Beograd' })).toEqual({
      name: 'Rentaj d.o.o.',
      place: 'Bulevar 10, Beograd',
    });
  });

  it('falls back to the person when the company has no name', () => {
    expect(bankTransferPayee({ ...person, buyerType: 'COMPANY', companyName: ' ' }).name).toBe('Petar Petrović');
  });
});

describe('bookingBankTransfer', () => {
  it('shows the same payee, account and reference the code carries', () => {
    const booking = { id: '1e3a4ad3-d750-4312-b143-7c1f00000000', amountDue: 2_000_000n };
    const owner = { firstName: 'Petar', lastName: 'Petrović', buyerType: 'COMPANY', companyName: 'Rentaj d.o.o.', bankAccount: '160-1234-60' };
    const { details, qrPayload } = bookingBankTransfer(booking, owner, 'Sala');
    expect(details).toEqual({
      recipientName: 'Rentaj d.o.o.',
      recipientAccount: '160-0000000001234-60',
      amountRsd: 20000,
      purpose: 'Sala',
      referenceNumber: bookingPaymentReference(booking.id),
    });
    expect(details.referenceNumber).toBe('1e3a4ad3d7504312b143');
    expect(qrPayload).toBe('K:PR|V:01|C:1|R:160000000000123460|N:Rentaj d.o.o.|I:RSD20000,00|SF:221|S:Sala|RO:001e3a4ad3d7504312b143');
  });
});
