import { BadRequestException } from '@nestjs/common';
import { grantFeatured } from './featured-grant';

const NOW = new Date('2026-10-23T10:00:00Z');
const DAY = 86_400_000;

interface Setup {
  listing?: Record<string, unknown> | null;
  categoryTaken?: number;
  ownerLive?: number;
  ownerWaiting?: number;
  liveForListing?: boolean;
  request?: Record<string, unknown> | null;
  otherWaiting?: boolean;
  rules?: Record<string, unknown>;
}

function setup(options: Setup = {}) {
  const listing =
    options.listing === null
      ? null
      : {
          id: 'l1',
          userId: 'owner',
          categoryId: 'stanovi',
          status: 'ACTIVE',
          user: { blocked: false, restrictedUntil: null },
          ...options.listing,
        };
  const tx = {
    $executeRaw: jest.fn(),
    listing: { findUnique: jest.fn().mockResolvedValue(listing) },
    setting: { findUnique: jest.fn().mockResolvedValue({ value: { maxPerCategory: 2, ...options.rules } }) },
    featuredListing: {
      findFirst: jest.fn().mockResolvedValue(options.liveForListing ? { id: 'live' } : null),
      // An owner's count names the owner; the category's does not.
      count: jest.fn(async ({ where }: any) => (where.listing.userId ? (options.ownerLive ?? 0) : (options.categoryTaken ?? 0))),
      create: jest.fn(async ({ data }: any) => ({ id: 'f-new', ...data })),
    },
    featuredRequest: {
      findUnique: jest.fn().mockResolvedValue(options.request ?? null),
      findFirst: jest.fn().mockResolvedValue(options.otherWaiting ? { id: 'other' } : null),
      count: jest.fn(async ({ where }: any) => (where.listing.userId ? (options.ownerWaiting ?? 0) : 0)),
      create: jest.fn(async ({ data }: any) => ({ id: 'r-new', ...data })),
      update: jest.fn(async ({ where, data }: any) => ({ id: where.id, ...data })),
    },
  };
  const prisma = { $transaction: jest.fn(async (work: (client: typeof tx) => unknown) => work(tx)) };
  const events = { emit: jest.fn() };
  const i18n = { t: jest.fn((key: string) => key) };
  const grant = (input: Partial<Parameters<typeof grantFeatured>[3]> = {}) =>
    grantFeatured(prisma as any, events as any, i18n as any, { listingId: 'l1', source: 'ADMIN', days: 30, adminId: 'admin', ...input }, NOW);
  return { tx, events, i18n, grant };
}

describe('grantFeatured', () => {
  it('starts a period from now when the category has a free place', async () => {
    const { tx, events, grant } = setup({ categoryTaken: 1 });
    const outcome = await grant({ source: 'LEADER', days: 30, adminId: null });

    expect(outcome).toEqual({ status: 'STARTED', featuredId: 'f-new', expiresAt: new Date(NOW.getTime() + 30 * DAY) });
    expect(tx.featuredListing.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ listingId: 'l1', startsAt: NOW, source: 'LEADER', free: true, price: 0n, durationDays: 30 }),
    });
    expect(tx.$executeRaw).toHaveBeenCalled();
    expect(events.emit).toHaveBeenCalledWith('featured.started', { featuredId: 'f-new' });
  });

  it('puts the listing in the queue when every place is taken', async () => {
    const { tx, events, grant } = setup({ categoryTaken: 2 });
    const outcome = await grant();

    expect(outcome).toEqual({ status: 'WAITING', requestId: 'r-new', alreadyWaiting: false });
    expect(tx.featuredListing.create).not.toHaveBeenCalled();
    expect(tx.featuredRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ listingId: 'l1', status: 'WAITING', source: 'ADMIN', durationDays: 30, decidedByUserId: 'admin' }),
    });
    expect(events.emit).toHaveBeenCalledWith('featured.waiting', { requestId: 'r-new' });
  });

  it("follows a category's own limit", async () => {
    const { tx, grant } = setup({ categoryTaken: 2, rules: { categoryLimits: { stanovi: 3 } } });
    await expect(grant()).resolves.toMatchObject({ status: 'STARTED' });
    expect(tx.featuredRequest.create).not.toHaveBeenCalled();
  });

  it('leaves a request that already waits as it is, without a second email', async () => {
    const request = { id: 'r1', listingId: 'l1', status: 'WAITING', decidedAt: NOW, decidedByUserId: 'admin', note: null };
    const { tx, events, grant } = setup({ categoryTaken: 2, request });
    const outcome = await grant({ requestId: 'r1', adminId: null });

    expect(outcome).toEqual({ status: 'WAITING', requestId: 'r1', alreadyWaiting: true });
    expect(tx.featuredRequest.update).not.toHaveBeenCalled();
    expect(events.emit).not.toHaveBeenCalled();
  });

  it('marks the request it answers approved, with the period', async () => {
    const request = { id: 'r1', listingId: 'l1', status: 'PENDING', decidedAt: null, decidedByUserId: null, note: null };
    const { tx, grant } = setup({ request });
    await grant({ requestId: 'r1', source: 'REQUEST' });

    expect(tx.featuredRequest.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: expect.objectContaining({ status: 'APPROVED', featuredId: 'f-new', decidedByUserId: 'admin', decidedAt: NOW }),
    });
  });

  it.each([
    ['a listing that is not live', { listing: { status: 'EXPIRED' } }, 'errors.FEATURED_LISTING_NOT_ACTIVE'],
    ['a blocked owner', { listing: { user: { blocked: true, restrictedUntil: null } } }, 'errors.FEATURED_OWNER_NOT_ELIGIBLE'],
    [
      'an owner under a restriction',
      { listing: { user: { blocked: false, restrictedUntil: new Date(NOW.getTime() + DAY) } } },
      'errors.FEATURED_OWNER_NOT_ELIGIBLE',
    ],
    ['a listing featured already', { liveForListing: true }, 'errors.FEATURED_ALREADY'],
    ['a listing already in the queue', { otherWaiting: true }, 'errors.FEATURED_ALREADY_WAITING'],
    ['an owner at the limit of the category', { ownerLive: 1 }, 'errors.FEATURED_OWNER_LIMIT'],
    ['an owner waiting in the category', { ownerWaiting: 1 }, 'errors.FEATURED_OWNER_LIMIT'],
  ])('refuses %s', async (_name, options, message) => {
    const { tx, grant } = setup(options as Setup);
    await expect(grant()).rejects.toThrow(BadRequestException);
    await expect(grant()).rejects.toThrow(message);
    expect(tx.featuredListing.create).not.toHaveBeenCalled();
    expect(tx.featuredRequest.create).not.toHaveBeenCalled();
  });
});
