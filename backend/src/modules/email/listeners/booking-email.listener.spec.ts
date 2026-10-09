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
    const listener = new BookingEmailListener(prisma as any, email as any, { get: () => 'http://front' } as any);
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
    const listener = new BookingEmailListener(prisma as any, email as any, { get: () => 'http://front' } as any);
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
