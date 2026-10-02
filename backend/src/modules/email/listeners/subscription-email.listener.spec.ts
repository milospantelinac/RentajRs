import { SubscriptionEmailListener } from './subscription-email.listener';

describe('SubscriptionEmailListener#onCheckoutFailed', () => {
  const user = { id: 'u1', email: 'ivana@example.com', language: 'SR' };
  const pkg = { id: 'pkg-standard', key: 'STANDARD' };
  const listing = { id: 'l1', title: 'Sala za proslave' };
  const event = { userId: 'u1', packageId: 'pkg-standard', amount: 334_000n, listingId: 'l1', renewsSubscriptionId: null };

  function setup(rows: { user?: unknown; pkg?: unknown; listing?: unknown } = {}) {
    const found = { user, pkg, listing, ...rows };
    const prisma = {
      user: { findUnique: jest.fn(async () => found.user) },
      package: { findUnique: jest.fn(async () => found.pkg) },
      listing: { findUnique: jest.fn(async () => found.listing) },
    };
    const email = { send: jest.fn(async () => undefined) };
    const listener = new SubscriptionEmailListener(prisma as any, email as any, { get: () => 'http://front' } as any);
    return { listener, email, prisma };
  }

  it('names the package, the amount and the listing, and links back to the package choice', async () => {
    const { listener, email, prisma } = setup();
    await listener.onCheckoutFailed(event);

    expect(prisma.listing.findUnique).toHaveBeenCalledWith({ where: { id: 'l1' }, select: { id: true, title: true } });
    expect(email.send.mock.calls).toEqual([
      [
        {
          key: 'subscription_checkout_failed',
          to: 'ivana@example.com',
          language: 'SR',
          userId: 'u1',
          context: { paket: 'STANDARD', iznos: '3.340 RSD', oglas: 'Sala za proslave' },
          buttonUrl: 'http://front/oglasi/l1/paket',
        },
      ],
    ]);
  });

  it('keeps the renewed package in the link, as the failure page does', async () => {
    const { listener, email } = setup();
    await listener.onCheckoutFailed({ ...event, renewsSubscriptionId: 's1' });
    expect(email.send).toHaveBeenCalledWith(expect.objectContaining({ buttonUrl: 'http://front/oglasi/l1/paket?obnova=s1' }));
  });

  it.each(['user', 'pkg', 'listing'])('sends nothing when the %s is gone', async (missing) => {
    const { listener, email } = setup({ [missing]: null });
    await listener.onCheckoutFailed(event);
    expect(email.send).not.toHaveBeenCalled();
  });
});
