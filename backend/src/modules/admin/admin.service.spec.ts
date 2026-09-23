import { AdminService } from './admin.service';

describe('AdminService#listDisputes paymentHeldUntil (T94)', () => {
  const DAY = 86_400_000;
  const deadline = new Date(Date.UTC(2026, 8, 22, 18, 58));
  const heldUntil = new Date(deadline.getTime() + 7 * DAY);

  const dispute = (id: string, type: string, status: string, bookingStatus: string | null) => ({
    id,
    type,
    status,
    booking: bookingStatus ? { id: `${id}-booking`, status: bookingStatus, paymentDeadline: deadline } : null,
  });

  it('says how long an open payment report holds its unpaid booking, and nothing for the rest', async () => {
    const prisma = {
      dispute: {
        findMany: jest.fn().mockResolvedValue([
          dispute('open', 'UNCONFIRMED_PAYMENT', 'NEW', 'AWAITING_PAYMENT'),
          dispute('taken', 'UNCONFIRMED_PAYMENT', 'IN_PROGRESS', 'AWAITING_PAYMENT'),
          dispute('closed', 'UNCONFIRMED_PAYMENT', 'RESOLVED', 'AWAITING_PAYMENT'),
          dispute('confirmed', 'UNCONFIRMED_PAYMENT', 'NEW', 'CONFIRMED'),
          dispute('noShow', 'DISPUTED_NO_SHOW', 'NEW', 'NO_SHOW'),
          dispute('noBooking', 'UNCONFIRMED_PAYMENT', 'NEW', null),
        ]),
      },
    };
    const service = new AdminService(prisma as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any);

    const rows = await service.listDisputes();
    expect(rows.map((row) => [row.id, row.paymentHeldUntil])).toEqual([
      ['open', heldUntil],
      ['taken', heldUntil],
      ['closed', null],
      ['confirmed', null],
      ['noShow', null],
      ['noBooking', null],
    ]);
    expect(prisma.dispute.findMany.mock.calls[0][0].include.booking.select.paymentDeadline).toBe(true);
  });
});
