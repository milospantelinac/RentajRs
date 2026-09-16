import { DashboardService } from './dashboard.service';

type TestListing = { id: string; bookingModel: 'PER_STAY' | 'PER_SLOT' | 'NO_BOOKING'; priceUnit: string };

describe('DashboardService#getOnboarding (R106 new-owner checklist)', () => {
  function makeService(counts: {
    listings: TestListing[];
    workingHoursCount?: number;
    definedSlotCount?: number;
    blockedTermCount?: number;
    icalCount?: number;
    bankAccount: string | null;
  }) {
    const prisma = {
      listing: { findMany: jest.fn().mockResolvedValue(counts.listings) },
      workingHours: { count: jest.fn().mockResolvedValue(counts.workingHoursCount ?? 0) },
      definedSlot: { count: jest.fn().mockResolvedValue(counts.definedSlotCount ?? 0) },
      blockedTerm: { count: jest.fn().mockResolvedValue(counts.blockedTermCount ?? 0) },
      icalSource: { count: jest.fn().mockResolvedValue(counts.icalCount ?? 0) },
      user: { findUniqueOrThrow: jest.fn().mockResolvedValue({ bankAccount: counts.bankAccount }) },
    };
    return new DashboardService(prisma as any, {} as any, {} as any, {} as any);
  }

  const stay: TestListing = { id: 'stay1', bookingModel: 'PER_STAY', priceUnit: 'NIGHT' };
  const playroom: TestListing = { id: 'slot1', bookingModel: 'PER_SLOT', priceUnit: 'SLOT' };

  it('shows all four steps, none done, to someone with no listing yet', async () => {
    const service = makeService({ listings: [], bankAccount: null });
    const onboarding = await (service as any).getOnboarding('user1');
    expect(onboarding).toEqual({
      steps: [
        { key: 'listing', done: false, actionUrl: '/oglasi/novi' },
        { key: 'availability', done: false, actionUrl: '/oglasi/novi' },
        { key: 'ical', done: false, actionUrl: '/oglasi/novi' },
        { key: 'bankAccount', done: false, actionUrl: '/kontrolna-tabla/podesavanja' },
      ],
      allDone: false,
    });
  });

  it('reports allDone: true once every step of a stay owner is satisfied', async () => {
    const service = makeService({ listings: [stay], workingHoursCount: 1, icalCount: 1, bankAccount: '160-1234-56' });
    const onboarding = await (service as any).getOnboarding('user1');
    expect(onboarding.steps.map((s: any) => s.key)).toEqual(['listing', 'availability', 'ical', 'bankAccount']);
    expect(onboarding.allDone).toBe(true);
  });

  it('leaves iCal out for listings booked by slot, so a playroom owner can finish', async () => {
    const service = makeService({ listings: [playroom], definedSlotCount: 3, bankAccount: '160-1234-56' });
    const onboarding = await (service as any).getOnboarding('user1');
    expect(onboarding.steps.map((s: any) => s.key)).toEqual(['listing', 'availability', 'bankAccount']);
    expect(onboarding.allDone).toBe(true);
  });

  it('leaves iCal out for monthly stays and availability out for listings without booking', async () => {
    const service = makeService({
      listings: [
        { id: 'm1', bookingModel: 'PER_STAY', priceUnit: 'MONTH' },
        { id: 'n1', bookingModel: 'NO_BOOKING', priceUnit: 'DAY' },
      ],
      bankAccount: null,
    });
    const onboarding = await (service as any).getOnboarding('user1');
    expect(onboarding.steps.map((s: any) => s.key)).toEqual(['listing', 'availability', 'bankAccount']);
    expect(onboarding.steps[1].actionUrl).toBe('/oglasi/m1/uredi?korak=availability');

    const noBooking = makeService({ listings: [{ id: 'n1', bookingModel: 'NO_BOOKING', priceUnit: 'DAY' }], bankAccount: null });
    const onlyNoBooking = await (noBooking as any).getOnboarding('user1');
    expect(onlyNoBooking.steps.map((s: any) => s.key)).toEqual(['listing', 'bankAccount']);
  });

  it('treats availability as satisfied by working hours, defined slots or a calendar block', async () => {
    for (const counts of [{ workingHoursCount: 1 }, { definedSlotCount: 2 }, { blockedTermCount: 2 }]) {
      const service = makeService({ listings: [stay], ...counts, bankAccount: '160-1234-56' });
      const onboarding = await (service as any).getOnboarding('user1');
      expect(onboarding.steps.find((s: any) => s.key === 'availability').done).toBe(true);
      expect(onboarding.allDone).toBe(false); // still missing iCal
    }
  });

  it("links a step to the listing's own page, or to Moji oglasi when there are several", async () => {
    const one = await (makeService({ listings: [stay, playroom], bankAccount: null }) as any).getOnboarding('user1');
    expect(one.steps.find((s: any) => s.key === 'availability').actionUrl).toBe('/kontrolna-tabla/oglasi');
    // Dizajn 33: connected calendars have their own page.
    expect(one.steps.find((s: any) => s.key === 'ical').actionUrl).toBe('/kontrolna-tabla/oglasi/stay1/ical');

    const two = await (makeService({ listings: [stay, { ...stay, id: 'stay2' }], bankAccount: null }) as any).getOnboarding('user1');
    expect(two.steps.find((s: any) => s.key === 'ical').actionUrl).toBe('/kontrolna-tabla/oglasi');
  });

  it('is not fooled by a single missing item (stays not-done)', async () => {
    const service = makeService({ listings: [stay], workingHoursCount: 1, icalCount: 1, bankAccount: null });
    const onboarding = await (service as any).getOnboarding('user1');
    expect(onboarding.steps.find((s: any) => s.key === 'bankAccount').done).toBe(false);
    expect(onboarding.allDone).toBe(false);
  });
});

describe('DashboardService attention items (Dizajn 31)', () => {
  it('splits the review reminder by side and links each to its completed bookings', async () => {
    const prisma = {
      booking: { count: jest.fn().mockResolvedValue(0) },
      conversation: { count: jest.fn().mockResolvedValue(0) },
    };
    const reviews = {
      getMyPendingReviews: jest.fn().mockResolvedValue([
        { bookingId: 'b1', direction: 'OWNER_TO_GUEST' },
        { bookingId: 'b2', direction: 'OWNER_TO_GUEST' },
        { bookingId: 'b3', direction: 'GUEST_TO_OWNER' },
      ]),
    };
    const service = new DashboardService(prisma as any, reviews as any, {} as any, {} as any);

    await expect((service as any).getGuestAttention('user1')).resolves.toEqual([
      { urgency: 'info', title: 'pending_reviews_owner', actionUrl: '/kontrolna-tabla/rezervacije?role=owner&status=COMPLETED', count: 2 },
      { urgency: 'info', title: 'pending_reviews_guest', actionUrl: '/kontrolna-tabla/rezervacije?role=guest&status=COMPLETED', count: 1 },
    ]);
  });

  it("sends a term conflict to the conflicting listing's calendar, or to Moji oglasi for several", async () => {
    const makePrisma = (listingIds: string[]) => ({
      booking: { count: jest.fn().mockResolvedValue(0) },
      dispute: { findMany: jest.fn().mockResolvedValue(listingIds.map((listingId) => ({ listingId }))) },
      icalSource: { findMany: jest.fn().mockResolvedValue([]) },
      subscription: { count: jest.fn().mockResolvedValue(0) },
      listing: { count: jest.fn().mockResolvedValue(0) },
      conversation: { count: jest.fn().mockResolvedValue(0) },
    });

    const single = new DashboardService(makePrisma(['l1', 'l1']) as any, {} as any, {} as any, {} as any);
    await expect((single as any).getOwnerAttention('user1')).resolves.toEqual([
      { urgency: 'critical', title: 'term_conflict', actionUrl: '/oglasi/l1/uredi?korak=availability', count: 2 },
    ]);

    const several = new DashboardService(makePrisma(['l1', 'l2']) as any, {} as any, {} as any, {} as any);
    const [item] = await (several as any).getOwnerAttention('user1');
    expect(item.actionUrl).toBe('/kontrolna-tabla/oglasi');
  });

  it('opens the rejected tab of Moji oglasi for rejected listings (Dizajn 32)', async () => {
    const prisma = {
      booking: { count: jest.fn().mockResolvedValue(0) },
      dispute: { findMany: jest.fn().mockResolvedValue([]) },
      icalSource: { findMany: jest.fn().mockResolvedValue([]) },
      subscription: { count: jest.fn().mockResolvedValue(0) },
      listing: { count: jest.fn().mockResolvedValue(2) },
      conversation: { count: jest.fn().mockResolvedValue(0) },
    };
    const service = new DashboardService(prisma as any, {} as any, {} as any, {} as any);
    await expect((service as any).getOwnerAttention('user1')).resolves.toEqual([
      { urgency: 'decision', title: 'rejected_listings', actionUrl: '/kontrolna-tabla/oglasi?status=REJECTED', count: 2 },
    ]);
  });

  it("warns about calendars that keep failing and opens the listing's iCal page (Dizajn 33)", async () => {
    const makePrisma = (listingIds: string[]) => ({
      booking: { count: jest.fn().mockResolvedValue(0) },
      dispute: { findMany: jest.fn().mockResolvedValue([]) },
      icalSource: { findMany: jest.fn().mockResolvedValue(listingIds.map((listingId) => ({ listingId }))) },
      subscription: { count: jest.fn().mockResolvedValue(0) },
      listing: { count: jest.fn().mockResolvedValue(0) },
      conversation: { count: jest.fn().mockResolvedValue(0) },
    });

    const single = makePrisma(['l1', 'l1']);
    await expect((new DashboardService(single as any, {} as any, {} as any, {} as any) as any).getOwnerAttention('user1')).resolves.toEqual([
      { urgency: 'critical', title: 'ical_sync_failed', actionUrl: '/kontrolna-tabla/oglasi/l1/ical', count: 2 },
    ]);
    expect(single.icalSource.findMany).toHaveBeenCalledWith({
      where: { active: true, failureCount: { gte: 3 }, listing: { userId: 'user1', status: { not: 'DELETED' } } },
      select: { listingId: true },
    });

    const several = new DashboardService(makePrisma(['l1', 'l2']) as any, {} as any, {} as any, {} as any);
    const [item] = await (several as any).getOwnerAttention('user1');
    expect(item.actionUrl).toBe('/kontrolna-tabla/oglasi');
  });
});

describe('DashboardService#getStats', () => {
  it('counts only the active listings of an owner', async () => {
    const prisma = {
      booking: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
      listing: { count: jest.fn().mockResolvedValue(3), findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new DashboardService(prisma as any, {} as any, {} as any, {} as any);

    const stats = await (service as any).getStats('user1', true);
    expect(stats.listingCount).toBe(3);
    expect(prisma.listing.count).toHaveBeenCalledWith({ where: { userId: 'user1', status: 'ACTIVE' } });
  });
});

describe('DashboardService#getUpcoming (Dizajn 31 "Sledećih 7 dana")', () => {
  it('lists requests, unpaid and confirmed bookings with the other side and the guest noun', async () => {
    const booking = (id: string, overrides: object) => ({
      id,
      status: 'CONFIRMED',
      startsAt: new Date('2026-09-19T14:00:00Z'),
      endsAt: new Date('2026-09-19T16:00:00Z'),
      priceUnit: 'SLOT',
      guestCount: 18,
      guestId: 'guest1',
      listing: { title: 'Igraonica Balončići', slug: 'igraonica', categoryId: 'cat-kids', city: { name: 'Beograd' }, cityArea: { name: 'Vračar' } },
      guest: { firstName: 'Milica', lastName: 'Jovanović' },
      owner: { firstName: 'Ivana', lastName: 'Marković' },
      ...overrides,
    });
    const prisma = {
      booking: {
        findMany: jest.fn().mockResolvedValue([
          booking('b1', {}),
          booking('b2', {
            status: 'REQUESTED',
            guestId: 'user1',
            listing: { title: 'Sala', slug: 'sala', categoryId: 'cat-hall', city: { name: 'Niš' }, cityArea: null },
          }),
        ]),
      },
    };
    const taxonomy = {
      resolveAttributesForCategory: jest.fn(async (id: string) => (id === 'cat-kids' ? [{ key: 'kapacitet_dece' }] : [{ key: 'kapacitet_ljudi' }])),
    };
    const service = new DashboardService(prisma as any, {} as any, {} as any, taxonomy as any);

    const rows = await (service as any).getUpcoming('user1');
    expect(prisma.booking.findMany.mock.calls[0][0].where.status).toEqual({ in: ['REQUESTED', 'AWAITING_PAYMENT', 'CONFIRMED'] });
    expect(rows[0]).toMatchObject({
      id: 'b1',
      role: 'owner',
      guestUnit: 'children',
      counterpartName: 'Milica J.',
      listing: { title: 'Igraonica Balončići', place: 'Vračar' },
    });
    expect(rows[1]).toMatchObject({ id: 'b2', status: 'REQUESTED', role: 'guest', guestUnit: 'guests', counterpartName: 'Ivana M.', listing: { place: 'Niš' } });
  });
});

describe('DashboardService#getCounts (Dizajn 30 menu counters)', () => {
  it('counts requests awaiting this owner and conversations unread on either side', async () => {
    const prisma = {
      booking: { count: jest.fn().mockResolvedValue(4) },
      conversation: { count: jest.fn().mockResolvedValue(2) },
    };
    const service = new DashboardService(prisma as any, {} as any, {} as any, {} as any);

    await expect(service.getCounts('user1')).resolves.toEqual({ bookingRequests: 4, unreadConversations: 2 });
    expect(prisma.booking.count).toHaveBeenCalledWith({ where: { ownerId: 'user1', status: 'REQUESTED' } });
    expect(prisma.conversation.count).toHaveBeenCalledWith({
      where: {
        OR: [
          { ownerId: 'user1', unreadOwnerCount: { gt: 0 } },
          { guestId: 'user1', unreadGuestCount: { gt: 0 } },
        ],
      },
    });
  });
});
