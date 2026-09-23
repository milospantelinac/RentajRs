import { canGuestCancel, getFreeCancellationUntil } from './guest-cancellation';

describe('guest cancellation (Dizajn 39)', () => {
  const startsAt = new Date('2026-09-19T12:00:00Z');
  const booking = (overrides: Record<string, unknown> = {}) => ({
    startsAt,
    status: 'CONFIRMED' as const,
    paymentMethod: 'CASH' as const,
    cancellationPolicyType: 'FREE_UNTIL_DAYS' as const,
    cancellationThreshold: 5,
    ...overrides,
  });

  it('ends free cancellation the set number of days or hours before the start', () => {
    expect(getFreeCancellationUntil(booking())).toEqual(new Date('2026-09-14T12:00:00Z'));
    expect(getFreeCancellationUntil(booking({ cancellationPolicyType: 'FREE_UNTIL_HOURS', cancellationThreshold: 48 }))).toEqual(
      new Date('2026-09-17T12:00:00Z'),
    );
  });

  it('has no free period without a policy, with no cancellation, or without a threshold', () => {
    expect(getFreeCancellationUntil(booking({ cancellationPolicyType: null, cancellationThreshold: null }))).toBeNull();
    expect(getFreeCancellationUntil(booking({ cancellationPolicyType: 'NO_CANCELLATION', cancellationThreshold: null }))).toBeNull();
    expect(getFreeCancellationUntil(booking({ cancellationThreshold: 0 }))).toBeNull();
  });

  it('lets the guest withdraw a request and cancel while payment is awaited, whatever the policy', () => {
    const noPolicy = { cancellationPolicyType: 'NO_CANCELLATION', cancellationThreshold: null };
    expect(canGuestCancel(booking({ status: 'REQUESTED', paymentMethod: 'BANK_TRANSFER', ...noPolicy }))).toBe(true);
    expect(canGuestCancel(booking({ status: 'AWAITING_PAYMENT', paymentMethod: 'BANK_TRANSFER', ...noPolicy }))).toBe(true);
  });

  it('lets the guest cancel a confirmed cash booking only while its free cancellation lasts', () => {
    expect(canGuestCancel(booking(), new Date('2026-09-14T11:59:00Z'))).toBe(true);
    expect(canGuestCancel(booking(), new Date('2026-09-14T12:00:00Z'))).toBe(false);
    expect(canGuestCancel(booking({ cancellationPolicyType: 'NO_CANCELLATION', cancellationThreshold: null }), new Date('2026-09-01T00:00:00Z'))).toBe(false);
    expect(canGuestCancel(booking({ cancellationPolicyType: null, cancellationThreshold: null }), new Date('2026-09-01T00:00:00Z'))).toBe(false);
  });

  it('never lets the guest cancel a paid booking or a closed one', () => {
    const early = new Date('2026-09-01T00:00:00Z');
    expect(canGuestCancel(booking({ paymentMethod: 'BANK_TRANSFER' }), early)).toBe(false);
    for (const status of ['COMPLETED', 'CANCELLED', 'REJECTED', 'EXPIRED', 'NO_SHOW'] as const) {
      expect(canGuestCancel(booking({ status }), early)).toBe(false);
    }
  });
});
