import { SubscriptionsService } from './subscriptions.service';
import { periodEnd } from '../../common/utils/free-listing-period';
import { LISTING_COUNTS_CACHE_KEY } from '../taxonomy/taxonomy.service';

// Administracija > Oglasi: packages an admin gives without payment, and
// "Trajanje". The same small in-memory stand-in for Prisma as the renewal spec.
type Row = Record<string, any>;
type Tables = Record<string, Row[]>;

const DAY = 86_400_000;

function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([key, cond]) => {
    const value = row[key];
    if (cond !== null && typeof cond === 'object' && !(cond instanceof Date)) {
      if ('not' in cond) return value !== cond.not;
      if ('in' in cond) return cond.in.includes(value);
      if ('lt' in cond) return value != null && value < cond.lt;
      if ('gt' in cond) return value != null && value > cond.gt;
      throw new Error(`the fake has no filter for ${key}: ${JSON.stringify(cond)}`);
    }
    return value === cond;
  });
}

function makePrisma(tables: Tables) {
  let nextId = 1;
  const withRelations = (row: Row | null, include?: Row) => {
    if (!row) return row;
    const out = { ...row };
    if (!include) return out;
    if (include.package) out.package = tables.package.find((p) => p.id === row.packageId);
    if (include.listings) {
      const spec = include.listings === true ? {} : include.listings;
      out.listings = tables.listing.filter((l) => l.subscriptionId === row.id && matches(l, spec.where));
    }
    return out;
  };
  const sortBy = (rows: Row[], orderBy?: Row) => {
    if (!orderBy) return rows;
    const [[key, dir]] = Object.entries(orderBy);
    return [...rows].sort((a, b) => (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0) * (dir === 'desc' ? -1 : 1));
  };
  const model = (name: string) => ({
    findUnique: jest.fn(async ({ where, include }: Row) => withRelations(tables[name].find((r) => matches(r, where)) ?? null, include)),
    findUniqueOrThrow: jest.fn(async ({ where, include }: Row) => {
      const row = tables[name].find((r) => matches(r, where));
      if (!row) throw new Error(`${name} not found`);
      return withRelations(row, include);
    }),
    findFirst: jest.fn(async ({ where, include, orderBy }: Row) => {
      const row = sortBy(tables[name].filter((r) => matches(r, where)), orderBy)[0];
      return withRelations(row ?? null, include);
    }),
    findMany: jest.fn(async ({ where, include }: Row = {}) =>
      tables[name].filter((r) => matches(r, where)).map((r) => withRelations(r, include)),
    ),
    count: jest.fn(async ({ where }: Row) => tables[name].filter((r) => matches(r, where)).length),
    create: jest.fn(async ({ data }: Row) => {
      const row = { id: `${name}-${nextId++}`, createdAt: new Date(), ...data };
      tables[name].push(row);
      return { ...row };
    }),
    update: jest.fn(async ({ where, data }: Row) => {
      const row = tables[name].find((r) => matches(r, where));
      if (!row) throw new Error(`${name} to update not found`);
      Object.assign(row, data);
      return { ...row };
    }),
    updateMany: jest.fn(async ({ where, data }: Row) => {
      const rows = tables[name].filter((r) => matches(r, where));
      rows.forEach((row) => Object.assign(row, data));
      return { count: rows.length };
    }),
  });
  return Object.fromEntries(Object.keys(tables).map((name) => [name, model(name)])) as any;
}

const packages = [
  { id: 'pkg-basic', key: 'BASIC', listingLimit: 1, hasBookings: false, priceMonthly: 149_000n, priceYearly: 1_639_000n },
  { id: 'pkg-standard', key: 'STANDARD', listingLimit: 1, hasBookings: true, priceMonthly: 334_000n, priceYearly: 3_674_000n },
  { id: 'pkg-pro', key: 'PRO', listingLimit: 4, hasBookings: true, priceMonthly: 864_800n, priceYearly: 9_490_000n },
];

function setup(rows: Partial<Tables>) {
  const tables: Tables = {
    package: packages,
    user: [{ id: 'u1', firstName: 'Ivana', lastName: 'Marković', emailVerified: true, buyerType: 'PERSON' }],
    subscription: [],
    listing: [],
    bankedDay: [],
    ...rows,
  };
  const prisma = makePrisma(tables);
  const cache = { del: jest.fn(async () => undefined) };
  const events = { emit: jest.fn() };
  const service = new SubscriptionsService(
    prisma,
    cache as any,
    { markPendingApproval: jest.fn() } as any,
    {} as any,
    {} as any,
    {} as any,
    { t: (key: string) => key } as any,
    events as any,
    { get: () => 'http://front' } as any,
  );
  return { service, tables, events, cache };
}

const listing = (extra: Row) => ({ userId: 'u1', status: 'ACTIVE', bookingModel: 'PER_SLOT', publishedAt: new Date('2026-08-01'), ...extra });
const free = (extra: Row) => ({
  userId: 'u1',
  packageId: 'pkg-standard',
  billingCycle: 'MONTHLY',
  priceAtPurchase: 0n,
  grantedByAdminId: 'admin',
  renewsSubscriptionId: null,
  startsAt: new Date(Date.now() - 20 * DAY),
  ...extra,
});
const paid = (extra: Row) => free({ priceAtPurchase: 334_000n, grantedByAdminId: null, ...extra });

describe('SubscriptionsService#createAdminGrant', () => {
  it('opens a running package with no price, filed under the admin who gave it', async () => {
    const { service, tables } = setup({ listing: [listing({ id: 'l1', status: 'DRAFT' })] });
    const end = new Date(Date.now() + 30 * DAY);
    await service.createAdminGrant('admin', {
      userId: 'u1',
      listingId: 'l1',
      packageId: 'pkg-standard',
      expiresAt: end,
      billingCycle: 'MONTHLY',
      note: '  partner  ',
    });
    expect(tables.subscription[0]).toMatchObject({
      userId: 'u1',
      status: 'ACTIVE',
      priceAtPurchase: 0n,
      expiresAt: end,
      grantedByAdminId: 'admin',
      grantNote: 'partner',
    });
    expect(tables.subscription[0].startsAt).toBeInstanceOf(Date);
  });

  it('still keeps Osnovni away from a listing guests book online', async () => {
    const { service, tables } = setup({ listing: [listing({ id: 'l1', status: 'DRAFT' })] });
    await expect(
      service.createAdminGrant('admin', { userId: 'u1', listingId: 'l1', packageId: 'pkg-basic', expiresAt: null, billingCycle: 'YEARLY' }),
    ).rejects.toThrow('errors.PACKAGE_INCOMPATIBLE_BOOKING_MODEL');
    expect(tables.subscription).toHaveLength(0);
  });
});

describe('SubscriptionsService#adminChangePeriod', () => {
  it('extends a running free package from its own end', async () => {
    const end = periodEnd(new Date(Date.now() + 10 * DAY), 0, 'DAYS');
    const { service, tables } = setup({ subscription: [free({ id: 's1', status: 'ACTIVE', expiresAt: end })] });
    await service.adminChangePeriod('s1', { mode: 'EXTEND', amount: 2, unit: 'MONTHS' });
    expect(tables.subscription[0].expiresAt).toEqual(periodEnd(end, 2, 'MONTHS'));
  });

  it('sets a new end from today, which may be sooner', async () => {
    const { service, tables } = setup({ subscription: [free({ id: 's1', status: 'ACTIVE', expiresAt: new Date(Date.now() + 200 * DAY) })] });
    const { before, after } = await service.adminChangePeriod('s1', { mode: 'SET', amount: 5, unit: 'DAYS' });
    const expected = periodEnd(new Date(), 5, 'DAYS');
    expect(tables.subscription[0].expiresAt).toEqual(expected);
    expect(before.expiresAt!.getTime()).toBeGreaterThan(expected.getTime());
    expect(after).toEqual({ status: 'ACTIVE', expiresAt: expected });
  });

  it('takes the end away, and puts one back later', async () => {
    const { service, tables } = setup({ subscription: [free({ id: 's1', status: 'ACTIVE', expiresAt: new Date(Date.now() + 5 * DAY) })] });
    await service.adminChangePeriod('s1', { mode: 'UNLIMITED' });
    expect(tables.subscription[0].expiresAt).toBeNull();
    await service.adminChangePeriod('s1', { mode: 'EXTEND', amount: 1, unit: 'MONTHS' });
    expect(tables.subscription[0].expiresAt).toEqual(periodEnd(new Date(), 1, 'MONTHS'));
  });

  it('brings an ended free package back, and its listings into search', async () => {
    const { service, tables, cache } = setup({
      subscription: [free({ id: 's1', status: 'EXPIRED', expiresAt: new Date(Date.now() - 3 * DAY) })],
      listing: [listing({ id: 'l1', status: 'EXPIRED', subscriptionId: 's1' }), listing({ id: 'l2', status: 'DELETED', subscriptionId: 's1' })],
    });
    await service.adminChangePeriod('s1', { mode: 'EXTEND', amount: 10, unit: 'DAYS' });
    expect(tables.subscription[0]).toMatchObject({ status: 'ACTIVE', expiresAt: periodEnd(new Date(), 10, 'DAYS') });
    expect(tables.listing.map((l) => l.status)).toEqual(['ACTIVE', 'DELETED']);
    expect(cache.del).toHaveBeenCalledWith(LISTING_COUNTS_CACHE_KEY);
  });

  it('ends a free package now: the listing leaves search and the owner is told', async () => {
    const { service, tables, events } = setup({
      subscription: [free({ id: 's1', status: 'ACTIVE', expiresAt: null })],
      listing: [listing({ id: 'l1', subscriptionId: 's1' })],
    });
    const { after } = await service.adminChangePeriod('s1', { mode: 'END_NOW' });
    expect(after.status).toBe('EXPIRED');
    expect(tables.subscription[0].status).toBe('EXPIRED');
    expect(tables.listing[0].status).toBe('EXPIRED');
    expect(events.emit).toHaveBeenCalledWith('subscription.expired', { subscriptionId: 's1', listingIds: ['l1'] });
  });

  it('starts a continuation the owner already paid for at once when the free one ends now', async () => {
    const end = new Date(Date.now() + 10 * DAY);
    const { service, tables, events } = setup({
      subscription: [
        free({ id: 's1', status: 'ACTIVE', expiresAt: end }),
        paid({ id: 's2', status: 'SCHEDULED', renewsSubscriptionId: 's1', startsAt: end, expiresAt: new Date(end.getTime() + 30 * DAY) }),
      ],
      listing: [listing({ id: 'l1', subscriptionId: 's1' })],
    });
    await service.adminChangePeriod('s1', { mode: 'END_NOW' });
    const renewal = tables.subscription.find((s) => s.id === 's2')!;
    expect(renewal.status).toBe('ACTIVE');
    // The whole paid month, from now.
    expect(renewal.expiresAt.getTime() - renewal.startsAt.getTime()).toBe(30 * DAY);
    expect(renewal.startsAt.getTime()).toBeLessThanOrEqual(Date.now());
    expect(tables.listing[0]).toMatchObject({ status: 'ACTIVE', subscriptionId: 's2' });
    expect(events.emit).not.toHaveBeenCalledWith('subscription.expired', expect.anything());
  });

  it('refuses no end while a paid continuation waits behind the package', async () => {
    const end = new Date(Date.now() + 10 * DAY);
    const { service } = setup({
      subscription: [free({ id: 's1', status: 'ACTIVE', expiresAt: end }), paid({ id: 's2', status: 'SCHEDULED', renewsSubscriptionId: 's1', startsAt: end })],
    });
    await expect(service.adminChangePeriod('s1', { mode: 'UNLIMITED' })).rejects.toThrow('errors.PERIOD_UNLIMITED_RENEWED');
  });

  it('gives a paid package extra time and moves the paid renewals queued behind it', async () => {
    const end = periodEnd(new Date(Date.now() + 4 * DAY), 0, 'DAYS');
    const later = new Date(end.getTime() + 30 * DAY);
    const { service, tables } = setup({
      subscription: [
        paid({ id: 's1', status: 'ACTIVE', expiresAt: end }),
        paid({ id: 's2', status: 'SCHEDULED', renewsSubscriptionId: 's1', startsAt: end, expiresAt: later }),
        paid({ id: 's3', status: 'SCHEDULED', renewsSubscriptionId: 's2', startsAt: later, expiresAt: new Date(later.getTime() + 30 * DAY) }),
      ],
    });
    await service.adminChangePeriod('s1', { mode: 'EXTEND', amount: 7, unit: 'DAYS' });
    const newEnd = periodEnd(end, 7, 'DAYS');
    const shift = newEnd.getTime() - end.getTime();
    const [s1, s2, s3] = tables.subscription;
    expect(s1.expiresAt).toEqual(newEnd);
    expect(s2.startsAt).toEqual(newEnd);
    expect(s2.expiresAt.getTime()).toBe(later.getTime() + shift);
    expect(s3.startsAt.getTime()).toBe(later.getTime() + shift);
  });

  it('only lets a paid package grow', async () => {
    const { service } = setup({ subscription: [paid({ id: 's1', status: 'ACTIVE', expiresAt: new Date(Date.now() + DAY) })] });
    for (const change of [{ mode: 'SET', amount: 1, unit: 'DAYS' }, { mode: 'UNLIMITED' }, { mode: 'END_NOW' }] as const) {
      await expect(service.adminChangePeriod('s1', change)).rejects.toThrow('errors.PERIOD_PAID_EXTEND_ONLY');
    }
  });

  it('leaves a package that waits for payment or its first approval alone', async () => {
    const { service } = setup({ subscription: [paid({ id: 's1', status: 'PENDING_ACTIVATION', expiresAt: null })] });
    await expect(service.adminChangePeriod('s1', { mode: 'EXTEND', amount: 1, unit: 'MONTHS' })).rejects.toThrow(
      'errors.PERIOD_NOT_CHANGEABLE',
    );
  });
});

describe('SubscriptionsService and free packages for the owner', () => {
  it('has nothing to renew on a free package with no end', async () => {
    const { service } = setup({
      subscription: [free({ id: 's1', status: 'ACTIVE', expiresAt: null })],
      listing: [listing({ id: 'l1', subscriptionId: 's1' })],
    });
    const renewal = await service.getRenewal('u1', 's1');
    expect(renewal).toMatchObject({ renewable: false, reason: 'NOT_RENEWABLE' });
  });

  it('lets the owner pay to continue a free package that has an end', async () => {
    const { service } = setup({
      subscription: [free({ id: 's1', status: 'ACTIVE', expiresAt: new Date(Date.now() + 5 * DAY) })],
      listing: [listing({ id: 'l1', subscriptionId: 's1' })],
    });
    expect(await service.getRenewal('u1', 's1')).toMatchObject({ renewable: true, reason: null });
  });

  it('keeps a free Pro to the listing it was given for', async () => {
    const { service } = setup({
      subscription: [free({ id: 's1', status: 'ACTIVE', packageId: 'pkg-pro', expiresAt: new Date(Date.now() + 5 * DAY) })],
      listing: [listing({ id: 'l1', subscriptionId: 's1' }), listing({ id: 'l2', status: 'DRAFT', subscriptionId: null, createdByAdminId: null })],
    });
    await expect(service.purchaseForListing('u1', { listingId: 'l2', existingSubscriptionId: 's1' } as any)).rejects.toThrow(
      'errors.SUBSCRIPTION_FREE_NOT_SHARED',
    );
  });

  it('does not sell a package for a listing an admin is still preparing', async () => {
    const { service } = setup({ listing: [listing({ id: 'l1', status: 'DRAFT', subscriptionId: null, createdByAdminId: 'admin' })] });
    await expect(
      service.initCheckout('u1', { listingId: 'l1', packageId: 'pkg-standard', billingCycle: 'MONTHLY' } as any),
    ).rejects.toThrow('errors.LISTING_ADMIN_DRAFT');
  });

  it('shows the owner a free package without the admin or the note', async () => {
    const { service } = setup({
      subscription: [free({ id: 's1', status: 'ACTIVE', expiresAt: null, grantNote: 'samo za admine' })],
      listing: [listing({ id: 'l1', subscriptionId: 's1' })],
    });
    const [mine] = await service.getMySubscriptions('u1');
    expect(mine).toMatchObject({ id: 's1', freeGrant: true, priceAtPurchase: 0 });
    expect(mine).not.toHaveProperty('grantNote');
    expect(mine).not.toHaveProperty('grantedByAdminId');
  });
});
