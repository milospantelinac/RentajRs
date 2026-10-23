import { AdminListingsService } from './admin-listings.service';
import { periodEnd } from '../../common/utils/free-listing-period';

const i18n = { t: (key: string) => key };

function setup(rows: { listing?: any; user?: any; package?: any } = {}) {
  const prisma = {
    listing: {
      findUnique: jest.fn(async () => rows.listing ?? null),
      findMany: jest.fn(async () => []),
      count: jest.fn(async () => 0),
    },
    user: { findUnique: jest.fn(async () => rows.user ?? null), findMany: jest.fn(async () => []) },
    package: { findUnique: jest.fn(async () => rows.package ?? null) },
    subscription: { delete: jest.fn(async () => ({})), findMany: jest.fn(async () => []) },
    adminLog: { create: jest.fn(async () => ({})) },
  };
  const listings = {
    createDraft: jest.fn(async (userId: string, dto: any, adminId: string) => ({ id: 'l-new', userId, ...dto, createdByAdminId: adminId })),
    getReadiness: jest.fn(async () => ({ ready: true, checklist: {} })),
    publishByAdmin: jest.fn(async () => ({ id: 'l1', slug: 'vikendica-abc', status: 'ACTIVE' })),
  };
  const subscriptions = {
    createAdminGrant: jest.fn(async () => ({ id: 'sub-free' })),
    adminAssignFreeFeatured: jest.fn(async () => ({})),
    adminChangePeriod: jest.fn(async () => ({ before: { status: 'ACTIVE', expiresAt: null }, after: { status: 'ACTIVE', expiresAt: null } })),
  };
  const taxonomy = { getCategoryNames: jest.fn(async () => new Map()) };
  const events = { emit: jest.fn() };
  const service = new AdminListingsService(prisma as any, listings as any, subscriptions as any, taxonomy as any, i18n as any, events as any);
  return { service, prisma, listings, subscriptions, events };
}

const adminDraft = (extra: any = {}) => ({
  id: 'l1',
  userId: 'owner',
  status: 'DRAFT',
  subscriptionId: null,
  createdByAdminId: 'admin',
  user: { id: 'owner', blocked: false, anonymizedAt: null },
  ...extra,
});
const standard = { id: 'pkg-standard', key: 'STANDARD', active: true };

describe('AdminListingsService#createForOwner', () => {
  it('opens a draft in the owner name, marked as added by the admin', async () => {
    const { service, listings, prisma } = setup({ user: { id: 'owner', blocked: false, anonymizedAt: null } });
    const created = await service.createForOwner('admin', { userId: 'owner', categoryId: 'cat' });
    expect(listings.createDraft).toHaveBeenCalledWith('owner', { categoryId: 'cat' }, 'admin');
    expect(created).toMatchObject({ id: 'l-new', createdByAdminId: 'admin' });
    expect(prisma.adminLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'admin', action: 'listing.admin_created', entityType: 'Listing', entityId: 'l-new' }),
    });
  });

  it('only for an account that exists and is not blocked', async () => {
    await expect(setup().service.createForOwner('admin', { userId: 'x', categoryId: 'c' })).rejects.toThrow('errors.OWNER_NOT_FOUND');
    await expect(
      setup({ user: { id: 'x', anonymizedAt: new Date() } }).service.createForOwner('admin', { userId: 'x', categoryId: 'c' }),
    ).rejects.toThrow('errors.OWNER_NOT_FOUND');
    await expect(
      setup({ user: { id: 'x', blocked: true, anonymizedAt: null } }).service.createForOwner('admin', { userId: 'x', categoryId: 'c' }),
    ).rejects.toThrow('errors.OWNER_BLOCKED');
  });
});

describe('AdminListingsService#publish', () => {
  it('publishes for months on the chosen package, with a free featured slot, and tells the owner', async () => {
    const { service, subscriptions, listings, events, prisma } = setup({ listing: adminDraft(), package: standard });
    const result = await service.publish('admin', 'l1', { packageId: 'pkg-standard', duration: 'MONTHS', amount: 3, featuredDays: 15, note: 'partner' });
    const expected = periodEnd(new Date(), 3, 'MONTHS');
    expect(subscriptions.createAdminGrant).toHaveBeenCalledWith('admin', {
      userId: 'owner',
      listingId: 'l1',
      packageId: 'pkg-standard',
      expiresAt: expected,
      billingCycle: 'MONTHLY',
      note: 'partner',
    });
    expect(listings.publishByAdmin).toHaveBeenCalledWith('admin', 'l1', 'sub-free');
    expect(subscriptions.adminAssignFreeFeatured).toHaveBeenCalledWith('admin', 'l1', 15);
    expect(events.emit).toHaveBeenCalledWith('listing.published_by_admin', { listingId: 'l1', subscriptionId: 'sub-free' });
    expect(prisma.adminLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'listing.published_free', entityId: 'l1' }) });
    expect(result).toMatchObject({ id: 'l1', slug: 'vikendica-abc', status: 'ACTIVE', expiresAt: expected, package: 'STANDARD' });
  });

  it('publishes with no end', async () => {
    const { service, subscriptions } = setup({ listing: adminDraft(), package: standard });
    await service.publish('admin', 'l1', { packageId: 'pkg-standard', duration: 'UNLIMITED' });
    expect(subscriptions.createAdminGrant).toHaveBeenCalledWith('admin', expect.objectContaining({ expiresAt: null, billingCycle: 'YEARLY' }));
  });

  it('refuses a listing an owner added, one already published and one not ready', async () => {
    await expect(
      setup({ listing: adminDraft({ createdByAdminId: null }), package: standard }).service.publish('admin', 'l1', {
        packageId: 'pkg-standard',
        duration: 'UNLIMITED',
      }),
    ).rejects.toThrow('errors.LISTING_NOT_ADMIN_ADDED');
    await expect(
      setup({ listing: adminDraft({ subscriptionId: 's', status: 'ACTIVE' }), package: standard }).service.publish('admin', 'l1', {
        packageId: 'pkg-standard',
        duration: 'UNLIMITED',
      }),
    ).rejects.toThrow('errors.LISTING_ALREADY_PUBLISHED');
    const notReady = setup({ listing: adminDraft(), package: standard });
    notReady.listings.getReadiness.mockResolvedValueOnce({ ready: false, checklist: { hasPhone: false } });
    await expect(notReady.service.publish('admin', 'l1', { packageId: 'pkg-standard', duration: 'UNLIMITED' })).rejects.toThrow(
      'errors.LISTING_NOT_READY',
    );
    expect(notReady.subscriptions.createAdminGrant).not.toHaveBeenCalled();
  });

  it('refuses a period longer than allowed', async () => {
    const { service } = setup({ listing: adminDraft(), package: standard });
    await expect(service.publish('admin', 'l1', { packageId: 'pkg-standard', duration: 'MONTHS', amount: 121 })).rejects.toThrow(
      'errors.PERIOD_TOO_LONG_MONTHS',
    );
    await expect(service.publish('admin', 'l1', { packageId: 'pkg-standard', duration: 'DAYS', amount: 3651 })).rejects.toThrow(
      'errors.PERIOD_TOO_LONG_DAYS',
    );
  });

  it('leaves no package behind when the publish itself fails', async () => {
    const { service, listings, prisma, events } = setup({ listing: adminDraft(), package: standard });
    listings.publishByAdmin.mockRejectedValueOnce(new Error('db down'));
    await expect(service.publish('admin', 'l1', { packageId: 'pkg-standard', duration: 'DAYS', amount: 30 })).rejects.toThrow('db down');
    expect(prisma.subscription.delete).toHaveBeenCalledWith({ where: { id: 'sub-free' } });
    expect(events.emit).not.toHaveBeenCalled();
  });
});

describe('AdminListingsService#changePeriod', () => {
  const onPackage = { id: 'l1', status: 'ACTIVE', subscriptionId: 's1', user: { firstName: 'A', lastName: 'B', email: 'a@b' }, subscription: null };

  it('changes the package the listing is on, logs it and tells the owner', async () => {
    const { service, subscriptions, events, prisma } = setup({ listing: onPackage });
    await service.changePeriod('admin', 'l1', { mode: 'EXTEND', amount: 2, unit: 'MONTHS' });
    expect(subscriptions.adminChangePeriod).toHaveBeenCalledWith('s1', { mode: 'EXTEND', amount: 2, unit: 'MONTHS' });
    expect(prisma.adminLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'listing.period_changed' }) });
    expect(events.emit).toHaveBeenCalledWith('listing.period_changed_by_admin', { listingId: 'l1', subscriptionId: 's1' });
  });

  it('leaves "Završi odmah" to the email every ended package sends', async () => {
    const { service, events } = setup({ listing: onPackage });
    await service.changePeriod('admin', 'l1', { mode: 'END_NOW' });
    expect(events.emit).not.toHaveBeenCalled();
  });

  it('needs a package, and a period that is not too long', async () => {
    await expect(
      setup({ listing: { ...onPackage, subscriptionId: null } }).service.changePeriod('admin', 'l1', { mode: 'UNLIMITED' }),
    ).rejects.toThrow('errors.LISTING_NO_PACKAGE');
    await expect(
      setup({ listing: onPackage }).service.changePeriod('admin', 'l1', { mode: 'SET', amount: 4000, unit: 'DAYS' }),
    ).rejects.toThrow('errors.PERIOD_TOO_LONG_DAYS');
  });
});

describe('AdminListingsService#list', () => {
  it('finds by every word of the title or the owner, and filters free ones', async () => {
    const { service, prisma } = setup();
    await service.list({ search: 'marko vila', filter: 'free', page: 2 });
    const args = (prisma.listing.findMany.mock.calls as any[])[0][0];
    expect(args.skip).toBe(25);
    expect(args.where.status).toEqual({ not: 'DELETED' });
    expect(args.where.subscription).toEqual({ grantedByAdminId: { not: null } });
    expect(args.where.AND).toHaveLength(2);
    expect(args.where.AND[0].OR).toContainEqual({ user: { email: { contains: 'marko', mode: 'insensitive' } } });
  });
});
