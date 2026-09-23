import { BadRequestException } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { PACKAGE_ENDING_WITHOUT_RENEWAL } from '../../common/utils/subscription-renewal';

// A small in-memory stand-in for the Prisma calls the renewal paths make.
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
    // Prisma hands out copies, not the stored rows.
    if (!row) return row;
    const out = { ...row };
    if (!include) return out;
    if (include.package) out.package = tables.package.find((p) => p.id === row.packageId);
    if (include.listings) {
      const spec = include.listings === true ? {} : include.listings;
      out.listings = tables.listing.filter((l) => l.subscriptionId === row.id && matches(l, spec.where));
    }
    if (include.invoices) out.invoices = tables.invoice.filter((i) => i.transactionId === row.id);
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
    findFirstOrThrow: jest.fn(async ({ where, orderBy }: Row) => {
      const row = sortBy(tables[name].filter((r) => matches(r, where)), orderBy)[0];
      if (!row) throw new Error(`${name} not found`);
      return { ...row };
    }),
    findMany: jest.fn(async ({ where }: Row = {}) => tables[name].filter((r) => matches(r, where)).map((r) => ({ ...r }))),
    count: jest.fn(async ({ where }: Row) => tables[name].filter((r) => matches(r, where)).length),
    create: jest.fn(async ({ data }: Row) => {
      const row = { id: `${name}-${nextId++}`, createdAt: new Date(), ...data };
      tables[name].push(row);
      return row;
    }),
    update: jest.fn(async ({ where, data }: Row) => {
      const row = tables[name].find((r) => matches(r, where));
      if (!row) throw new Error(`${name} to update not found`);
      Object.assign(row, data);
      return row;
    }),
    updateMany: jest.fn(async ({ where, data }: Row) => {
      const rows = tables[name].filter((r) => matches(r, where));
      rows.forEach((row) => Object.assign(row, data));
      return { count: rows.length };
    }),
    delete: jest.fn(async ({ where }: Row) => {
      const index = tables[name].findIndex((r) => matches(r, where));
      return tables[name].splice(index, 1)[0];
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
    transaction: [],
    invoice: [],
    ...rows,
  };
  const prisma = makePrisma(tables);
  const listings = { markPendingApproval: jest.fn(async () => ({})) };
  const cache = { delByPrefix: jest.fn(async () => undefined) };
  const nestpay = {
    buildCheckoutForm: jest.fn(async () => ({ actionUrl: 'https://bank', fields: {} })),
    verifyCallback: jest.fn(async (body: Row) => ({ valid: true, approved: true, oid: body.oid, transId: 'T1' })),
  };
  const fiscalization = { issueDocument: jest.fn(async () => ({ documentNumber: 'R-1', externalId: 'X-1' })) };
  const i18n = { t: (key: string) => key };
  const events = { emit: jest.fn() };
  const config = { get: () => 'http://front' };
  const service = new SubscriptionsService(
    prisma,
    cache as any,
    listings as any,
    {} as any,
    nestpay as any,
    fiscalization as any,
    i18n as any,
    events as any,
    config as any,
  );
  return { service, tables, listings, events, cache };
}

const checkout = (extra: Row) => ({
  listingId: 'l1',
  packageId: 'pkg-standard',
  billingCycle: 'MONTHLY',
  firstName: 'Ivana',
  lastName: 'Marković',
  email: 'ivana@example.com',
  isCompany: false,
  termsAccepted: true,
  ...extra,
});

const listing = (extra: Row) => ({ userId: 'u1', status: 'ACTIVE', bookingModel: 'PER_SLOT', publishedAt: new Date('2026-08-01'), ...extra });
const subscription = (extra: Row) => ({
  userId: 'u1',
  packageId: 'pkg-standard',
  billingCycle: 'MONTHLY',
  priceAtPurchase: 334_000n,
  renewsSubscriptionId: null,
  pendingListingId: null,
  createdAt: new Date('2026-08-20'),
  ...extra,
});

describe('SubscriptionsService renewal checkout', () => {
  const running = () => subscription({ id: 's1', status: 'ACTIVE', expiresAt: new Date(Date.now() + 3 * DAY) });

  it('opens a checkout that renews the package of the listing', async () => {
    const { service, tables } = setup({ subscription: [running()], listing: [listing({ id: 'l1', subscriptionId: 's1' })] });
    await service.initCheckout('u1', checkout({ renewSubscriptionId: 's1' }) as any);
    const opened = tables.subscription.find((s) => s.status === 'AWAITING_PAYMENT');
    expect(opened).toMatchObject({ renewsSubscriptionId: 's1', pendingListingId: 'l1', packageId: 'pkg-standard' });
  });

  it('keeps the same package', async () => {
    const { service } = setup({ subscription: [running()], listing: [listing({ id: 'l1', subscriptionId: 's1' })] });
    await expect(service.initCheckout('u1', checkout({ renewSubscriptionId: 's1', packageId: 'pkg-pro' }) as any)).rejects.toThrow(
      'errors.SUBSCRIPTION_RENEWAL_SAME_PACKAGE',
    );
  });

  it('refuses a second renewal while the next period is already paid for', async () => {
    const { service } = setup({
      subscription: [running(), subscription({ id: 's2', status: 'SCHEDULED', renewsSubscriptionId: 's1' })],
      listing: [listing({ id: 'l1', subscriptionId: 's1' })],
    });
    await expect(service.initCheckout('u1', checkout({ renewSubscriptionId: 's1' }) as any)).rejects.toThrow(
      'errors.SUBSCRIPTION_ALREADY_RENEWED',
    );
  });

  it('refuses a listing that is not on the package', async () => {
    const { service } = setup({
      subscription: [running(), subscription({ id: 's9', status: 'ACTIVE', expiresAt: new Date(Date.now() + DAY) })],
      listing: [listing({ id: 'l1', subscriptionId: 's9' }), listing({ id: 'l5', subscriptionId: 's1' })],
    });
    await expect(service.initCheckout('u1', checkout({ renewSubscriptionId: 's1' }) as any)).rejects.toThrow(
      'errors.SUBSCRIPTION_RENEWAL_NOT_ALLOWED',
    );
  });

  it('refuses a package whose only listing was deleted', async () => {
    const { service } = setup({
      subscription: [running()],
      listing: [listing({ id: 'l1', subscriptionId: 's1', status: 'DELETED' })],
    });
    await expect(service.initCheckout('u1', checkout({ renewSubscriptionId: 's1' }) as any)).rejects.toThrow(
      'errors.SUBSCRIPTION_RENEWAL_NOT_ALLOWED',
    );
    await expect(service.getRenewal('u1', 's1')).resolves.toMatchObject({ renewable: false, reason: 'NO_LISTINGS' });
  });

  it('refuses a renewal of a cancelled package', async () => {
    const { service } = setup({
      subscription: [subscription({ id: 's1', status: 'CANCELLED' })],
      listing: [listing({ id: 'l1', subscriptionId: 's1' })],
    });
    await expect(service.initCheckout('u1', checkout({ renewSubscriptionId: 's1' }) as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lets a live listing buy only Pro outside a renewal', async () => {
    const { service, tables } = setup({ subscription: [running()], listing: [listing({ id: 'l1', subscriptionId: 's1' })] });
    await expect(service.initCheckout('u1', checkout({}) as any)).rejects.toThrow('errors.SUBSCRIPTION_UPGRADE_PRO_ONLY');
    await service.initCheckout('u1', checkout({ packageId: 'pkg-pro' }) as any);
    expect(tables.subscription.find((s) => s.status === 'AWAITING_PAYMENT')).toMatchObject({ packageId: 'pkg-pro', renewsSubscriptionId: null });
  });

  it('refuses a first package for an expired listing', async () => {
    const { service } = setup({
      subscription: [subscription({ id: 's1', status: 'EXPIRED', expiresAt: new Date(Date.now() - DAY) })],
      listing: [listing({ id: 'l1', subscriptionId: 's1', status: 'EXPIRED' })],
    });
    await expect(service.initCheckout('u1', checkout({}) as any)).rejects.toThrow('errors.LISTING_PACKAGE_PURCHASE_NOT_ALLOWED');
  });

  it('describes when the new period would start', async () => {
    const { service } = setup({
      subscription: [running(), subscription({ id: 's3', status: 'EXPIRED', expiresAt: new Date(Date.now() - DAY) })],
      listing: [listing({ id: 'l1', subscriptionId: 's1', title: 'Sala' }), listing({ id: 'l3', subscriptionId: 's3', status: 'EXPIRED', title: 'Stan' })],
    });
    const now = await service.getRenewal('u1', 's1');
    expect(now).toMatchObject({ renewable: true, reason: null, package: { key: 'STANDARD', priceMonthly: 3340 } });
    expect(now.startsAt).toBeInstanceOf(Date);
    const later = await service.getRenewal('u1', 's3');
    expect(later).toMatchObject({ renewable: true, startsAt: null, listings: [{ id: 'l3', status: 'EXPIRED' }] });
    await expect(service.getRenewal('u2', 's1')).rejects.toThrow('errors.SUBSCRIPTION_NOT_FOUND');
  });
});

describe('SubscriptionsService renewal payment', () => {
  const paid = (extra: Row) =>
    subscription({ id: 'r1', status: 'AWAITING_PAYMENT', pendingListingId: 'l1', renewsSubscriptionId: 's1', ...extra });

  it('waits behind a package that still runs', async () => {
    const ends = new Date(Date.now() + 3 * DAY);
    const { service, tables, events } = setup({
      subscription: [subscription({ id: 's1', status: 'ACTIVE', expiresAt: ends }), paid({})],
      listing: [listing({ id: 'l1', subscriptionId: 's1' })],
    });
    const url = await service.handleNestPaySuccess({ oid: 'r1' });

    expect(url).toBe('http://front/kontrolna-tabla/pretplate?renewed=scheduled');
    expect(tables.subscription.find((s) => s.id === 'r1')).toMatchObject({
      status: 'SCHEDULED',
      startsAt: ends,
      expiresAt: new Date(ends.getTime() + 30 * DAY),
      renewsSubscriptionId: 's1',
      pendingListingId: null,
    });
    expect(tables.listing[0].subscriptionId).toBe('s1');
    expect(tables.invoice).toHaveLength(1);
    expect(events.emit).toHaveBeenCalledWith('subscription.renewed', { userId: 'u1', subscriptionId: 'r1' });
  });

  it('lines a second paid renewal up behind the first', async () => {
    const ends = new Date(Date.now() + 3 * DAY);
    const firstEnds = new Date(ends.getTime() + 30 * DAY);
    const { service, tables } = setup({
      subscription: [
        subscription({ id: 's1', status: 'ACTIVE', expiresAt: ends }),
        subscription({ id: 'r0', status: 'SCHEDULED', renewsSubscriptionId: 's1', startsAt: ends, expiresAt: firstEnds }),
        paid({ billingCycle: 'YEARLY' }),
      ],
      listing: [listing({ id: 'l1', subscriptionId: 's1' })],
    });
    await service.handleNestPaySuccess({ oid: 'r1' });
    expect(tables.subscription.find((s) => s.id === 'r1')).toMatchObject({
      status: 'SCHEDULED',
      renewsSubscriptionId: 'r0',
      startsAt: firstEnds,
      expiresAt: new Date(firstEnds.getTime() + 365 * DAY),
    });
  });

  it('starts at once after the package ended and brings the listings back', async () => {
    const windowEnd = new Date(Date.now() + 10 * DAY - 60_000);
    const { service, tables, listings, cache } = setup({
      subscription: [
        subscription({ id: 's1', status: 'EXPIRED', packageId: 'pkg-pro', expiresAt: new Date(Date.now() - 5 * DAY) }),
        paid({ packageId: 'pkg-pro' }),
      ],
      listing: [
        listing({ id: 'l1', subscriptionId: 's1', status: 'EXPIRED' }),
        listing({ id: 'l2', subscriptionId: 's1', status: 'ACTIVE' }),
        listing({ id: 'l3', subscriptionId: 's1', status: 'EXPIRED', publishedAt: null }),
        listing({ id: 'l4', subscriptionId: 's1', status: 'DELETED' }),
      ],
      bankedDay: [{ id: 'b1', listingId: 'l2', days: 15, originPackageId: 'pkg-standard', usedAt: null, validFrom: new Date(), validUntil: windowEnd }],
    });
    const before = Date.now();
    const url = await service.handleNestPaySuccess({ oid: 'r1' });

    expect(url).toBe('http://front/kontrolna-tabla/pretplate?renewed=active');
    const renewal = tables.subscription.find((s) => s.id === 'r1')!;
    expect(renewal.status).toBe('ACTIVE');
    expect(renewal.startsAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(renewal.expiresAt.getTime() - renewal.startsAt.getTime()).toBe(30 * DAY);
    const byId = Object.fromEntries(tables.listing.map((l) => [l.id, l]));
    expect(byId.l1).toMatchObject({ subscriptionId: 'r1', status: 'ACTIVE' });
    expect(byId.l2).toMatchObject({ subscriptionId: 'r1', status: 'ACTIVE' });
    // Never approved: back to review instead of into search.
    expect(byId.l3).toMatchObject({ subscriptionId: 'r1', status: 'EXPIRED' });
    expect(listings.markPendingApproval).toHaveBeenCalledWith('l3', 'r1');
    expect(byId.l4).toMatchObject({ subscriptionId: 's1', status: 'DELETED' });
    // The running window's ten days wait for the new period to end.
    expect(tables.bankedDay).toHaveLength(2);
    expect(tables.bankedDay[0]).toMatchObject({ id: 'b1', usedAt: expect.any(Date) });
    expect(tables.bankedDay[1]).toMatchObject({ listingId: 'l2', days: 10, originPackageId: 'pkg-standard' });
    expect(tables.bankedDay[1].validUntil ?? null).toBeNull();
    expect(cache.delByPrefix).toHaveBeenCalledWith('taxonomy:category:');
  });

  it('closes a package that ended but was not swept yet', async () => {
    const { service, tables } = setup({
      subscription: [subscription({ id: 's1', status: 'ACTIVE', expiresAt: new Date(Date.now() - 60_000) }), paid({})],
      listing: [listing({ id: 'l1', subscriptionId: 's1' })],
    });
    await service.handleNestPaySuccess({ oid: 'r1' });
    expect(tables.subscription.find((s) => s.id === 's1')!.status).toBe('EXPIRED');
    expect(tables.subscription.find((s) => s.id === 'r1')!.status).toBe('ACTIVE');
    expect(tables.listing[0]).toMatchObject({ subscriptionId: 'r1', status: 'ACTIVE' });
  });

  it('sends a declined renewal back to its renewal page', async () => {
    const { service, tables } = setup({
      subscription: [subscription({ id: 's1', status: 'ACTIVE', expiresAt: new Date(Date.now() + DAY) }), paid({})],
      listing: [listing({ id: 'l1', subscriptionId: 's1' })],
    });
    (service as any).nestpay.verifyCallback.mockResolvedValueOnce({ valid: true, approved: false, oid: 'r1', procReturnCode: '05' });
    const url = await service.handleNestPaySuccess({ oid: 'r1' });
    expect(url).toBe('http://front/oglasi/l1/placanje-neuspesno?obnova=s1');
    expect(tables.subscription.map((s) => s.id)).toEqual(['s1']);
  });
});

describe('SubscriptionsService expiry with renewals', () => {
  it('hands the listings to the paid renewal without a gap or an email', async () => {
    const { service, tables, events } = setup({
      subscription: [
        subscription({ id: 's1', status: 'ACTIVE', expiresAt: new Date(Date.now() - 60_000) }),
        subscription({ id: 'r1', status: 'SCHEDULED', renewsSubscriptionId: 's1', startsAt: new Date(Date.now() - 60_000) }),
      ],
      listing: [listing({ id: 'l1', subscriptionId: 's1' }), listing({ id: 'l2', subscriptionId: 's1', status: 'DELETED' })],
      bankedDay: [{ id: 'b1', listingId: 'l1', days: 12, usedAt: null, validFrom: null, validUntil: null }],
    });
    jest.spyOn(service as any, 'sendExpiringSoonReminders').mockResolvedValue(undefined);
    await service.processSubscriptionExpiry();

    expect(tables.subscription.map((s) => [s.id, s.status])).toEqual([
      ['s1', 'EXPIRED'],
      ['r1', 'ACTIVE'],
    ]);
    expect(tables.listing.map((l) => [l.id, l.subscriptionId, l.status])).toEqual([
      ['l1', 'r1', 'ACTIVE'],
      ['l2', 's1', 'DELETED'],
    ]);
    // The carried-over days still wait for the renewal to end.
    expect(tables.bankedDay[0]).toMatchObject({ validFrom: null, validUntil: null, usedAt: null });
    expect(events.emit).not.toHaveBeenCalled();
  });

  it('takes live listings offline, leaves deleted ones alone and says which went', async () => {
    const { service, tables, events } = setup({
      subscription: [subscription({ id: 's1', status: 'ACTIVE', packageId: 'pkg-pro', expiresAt: new Date(Date.now() - 60_000) })],
      listing: [
        listing({ id: 'l1', subscriptionId: 's1' }),
        listing({ id: 'l2', subscriptionId: 's1' }),
        listing({ id: 'l3', subscriptionId: 's1', status: 'DELETED' }),
        listing({ id: 'l4', subscriptionId: 's1', status: 'PENDING_APPROVAL', publishedAt: null }),
      ],
      bankedDay: [{ id: 'b1', listingId: 'l2', days: 5, usedAt: null, validFrom: null, validUntil: null }],
    });
    jest.spyOn(service as any, 'sendExpiringSoonReminders').mockResolvedValue(undefined);
    await service.processSubscriptionExpiry();

    const status = Object.fromEntries(tables.listing.map((l) => [l.id, l.status]));
    expect(status).toEqual({ l1: 'EXPIRED', l2: 'ACTIVE', l3: 'DELETED', l4: 'EXPIRED' });
    expect(tables.bankedDay[0].validUntil).toBeInstanceOf(Date);
    expect(events.emit).toHaveBeenCalledWith('subscription.expired', { subscriptionId: 's1', listingIds: ['l1'] });
  });

  it('stays quiet when no live listing left search', async () => {
    const { service, events } = setup({
      subscription: [subscription({ id: 's1', status: 'ACTIVE', expiresAt: new Date(Date.now() - 60_000) })],
      listing: [],
    });
    jest.spyOn(service as any, 'sendExpiringSoonReminders').mockResolvedValue(undefined);
    await service.processSubscriptionExpiry();
    expect(events.emit).not.toHaveBeenCalled();
  });

  it('reminds only about packages whose end takes a listing out of search', async () => {
    const { service } = setup({});
    const prisma = (service as any).prisma;
    prisma.subscription.findMany = jest.fn(async () => []);
    await (service as any).sendExpiringSoonReminders();
    expect(prisma.subscription.findMany).toHaveBeenCalledTimes(3);
    for (const [query] of prisma.subscription.findMany.mock.calls) {
      expect(query.where).toMatchObject(PACKAGE_ENDING_WITHOUT_RENEWAL);
      expect(query.where.renewals).toEqual({ none: { status: 'SCHEDULED' } });
    }
  });
});
