import { BookingEmailListener } from './booking-email.listener';

describe('BookingEmailListener#onAwaitingPayment', () => {
  it('escapes the stored text it puts into the payment details block', async () => {
    const booking = {
      id: '3f2b1c9e-0d4a-4b7e-9a51-6c8d2e7f1a00',
      amountDue: 540_000n,
      paymentDeadline: new Date('2027-06-10T18:00:00Z'),
      ipsQrData: null,
      cancellationTermsSnapshot: 'Besplatno otkazivanje do 3 dana pre početka <b>!</b>',
      listing: { title: 'Sala' },
      guest: { id: 'g1', email: 'gost@example.com', language: 'SR' },
      owner: { id: 'o1', bankAccount: '160-0000000012345-<67>' },
    };
    const prisma = { booking: { findUnique: jest.fn(async () => booking) } };
    const email = { send: jest.fn(async () => undefined) };
    const listener = new BookingEmailListener(prisma as any, email as any, { get: () => 'http://front' } as any, {} as any);
    await listener.onAwaitingPayment({ bookingId: booking.id });

    const { key, extraMjml } = (email.send.mock.calls as any)[0][0];
    expect(key).toBe('booking_payment_instructions');
    expect(extraMjml).toContain('Račun: 160-0000000012345-&lt;67&gt;</mj-text>');
    expect(extraMjml).toContain('Uslovi otkazivanja: Besplatno otkazivanje do 3 dana pre početka &lt;b&gt;!&lt;/b&gt;</mj-text>');
    expect(extraMjml).toContain('Poziv na broj: 3f2b1c9e0d4a4b7e9a51</mj-text>');
  });
});

describe('BookingEmailListener#onNoShowDisputeResolved (T90)', () => {
  const booking = {
    id: 'b1',
    listing: { title: 'Sala' },
    guest: { id: 'g1', email: 'gost@example.com', language: 'SR' },
    owner: { id: 'o1', email: 'vlasnik@example.com', language: 'EN' },
  };

  async function decide(outcome: string) {
    const prisma = { booking: { findUnique: jest.fn(async () => booking) } };
    const email = { send: jest.fn(async () => undefined) };
    const listener = new BookingEmailListener(prisma as any, email as any, { get: () => 'http://front' } as any, {} as any);
    await listener.onNoShowDisputeResolved({ bookingId: 'b1', outcome: outcome as any });
    return (email.send.mock.calls as any[]).map(([opts]) => [opts.key, opts.to, opts.language, opts.buttonUrl]);
  }

  it('tells both sides the mark was removed', async () => {
    expect(await decide('OVERTURN_NO_SHOW')).toEqual([
      ['booking_no_show_overturned_guest', 'gost@example.com', 'SR', 'http://front/rezervacije/b1'],
      ['booking_no_show_overturned_owner', 'vlasnik@example.com', 'EN', 'http://front/rezervacije/b1'],
    ]);
  });

  it('tells both sides the mark stays, whatever happened to the account', async () => {
    for (const outcome of ['NO_ACTION', 'WARNING', 'RESTRICTION', 'BLOCK']) {
      expect((await decide(outcome)).map(([key]) => key)).toEqual(['booking_no_show_upheld_guest', 'booking_no_show_upheld_owner']);
    }
  });
});

describe('BookingEmailListener#onRequested request details (T127)', () => {
  async function ownerEmail(booking: Record<string, unknown>, children: boolean) {
    const full = {
      id: 'b1',
      listing: { title: 'Igraonica', categoryId: 'c1' },
      guest: { id: 'g1', email: 'gost@example.com', language: 'SR' },
      owner: { id: 'o1', email: 'vlasnik@example.com', language: 'SR' },
      guestCount: null,
      adultCount: null,
      ...booking,
    };
    const prisma = { booking: { findUnique: jest.fn(async () => full) } };
    const email = { send: jest.fn(async () => undefined) };
    const taxonomy = {
      resolveAttributesForCategory: jest.fn(async () => (children ? [{ key: 'kapacitet_dece' }] : [])),
      getCategoryTree: jest.fn(async () => [{ id: 'c1', slug: 'igraonice' }]),
    };
    const listener = new BookingEmailListener(prisma as any, email as any, { get: () => 'http://front' } as any, taxonomy as any);
    await listener.onRequested({ bookingId: 'b1' });
    const calls = email.send.mock.calls as any[];
    expect(calls.find((call) => call[0].key === 'booking_requested_guest')[0].extraMjml).toBeUndefined();
    return calls.find((call) => call[0].key === 'booking_requested_owner')[0].extraMjml as string;
  }

  it("names a playroom's hours, children and adults", async () => {
    const mjml = await ownerEmail(
      { priceUnit: 'HOUR', startsAt: new Date('2026-10-12T14:00:00Z'), endsAt: new Date('2026-10-12T16:00:00Z'), guestCount: 12, adultCount: 3 },
      true,
    );
    expect(mjml).toContain('Detalji zahteva');
    expect(mjml).toContain('Termin: 12. oktobar 2026., 16:00 - 18:00</mj-text>');
    expect(mjml).toContain('Broj dece: 12</mj-text>');
    expect(mjml).toContain('Broj odraslih: 3</mj-text>');
  });

  it("names a stay's dates and guests, and a vehicle's dates alone", async () => {
    const stay = await ownerEmail(
      { priceUnit: 'NIGHT', startsAt: new Date('2026-10-12T00:00:00Z'), endsAt: new Date('2026-10-14T00:00:00Z'), guestCount: 2 },
      false,
    );
    expect(stay).toContain('Termin: 12. oktobar 2026. - 14. oktobar 2026.</mj-text>');
    expect(stay).toContain('Broj gostiju: 2</mj-text>');
    const car = await ownerEmail({ priceUnit: 'DAY', startsAt: new Date('2026-10-12T00:00:00Z'), endsAt: new Date('2026-10-13T00:00:00Z') }, false);
    expect(car).not.toContain('Broj');
    const months = await ownerEmail({ priceUnit: 'MONTH', startsAt: new Date('2026-11-01T00:00:00Z'), endsAt: new Date('2027-01-01T00:00:00Z') }, false);
    expect(months).toContain('Termin: novembar 2026. - decembar 2026.</mj-text>');
  });
});
