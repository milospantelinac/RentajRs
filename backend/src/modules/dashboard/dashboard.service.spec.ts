import { DashboardService } from './dashboard.service';

describe('DashboardService#getOnboarding (R106 new-owner checklist)', () => {
  function makeService(counts: {
    listingCount: number;
    workingHoursCount: number;
    blockedTermCount: number;
    icalCount: number;
    bankAccount: string | null;
  }) {
    const prisma = {
      listing: { count: jest.fn().mockResolvedValue(counts.listingCount) },
      workingHours: { count: jest.fn().mockResolvedValue(counts.workingHoursCount) },
      blockedTerm: { count: jest.fn().mockResolvedValue(counts.blockedTermCount) },
      icalSource: { count: jest.fn().mockResolvedValue(counts.icalCount) },
      user: { findUniqueOrThrow: jest.fn().mockResolvedValue({ bankAccount: counts.bankAccount }) },
    };
    return new DashboardService(prisma as any, {} as any, {} as any);
  }

  it('reports allDone: false for a brand new owner with nothing set up', async () => {
    const service = makeService({
      listingCount: 0,
      workingHoursCount: 0,
      blockedTermCount: 0,
      icalCount: 0,
      bankAccount: null,
    });
    const onboarding = await (service as any).getOnboarding('user1');
    expect(onboarding).toEqual({
      hasListing: false,
      hasAvailability: false,
      hasIcal: false,
      hasBankAccount: false,
      allDone: false,
    });
  });

  it('reports allDone: true once every checklist item is satisfied', async () => {
    const service = makeService({
      listingCount: 1,
      workingHoursCount: 1,
      blockedTermCount: 0,
      icalCount: 1,
      bankAccount: '160-1234-56',
    });
    const onboarding = await (service as any).getOnboarding('user1');
    expect(onboarding.allDone).toBe(true);
  });

  it('treats availability as satisfied by either working hours or a manual block', async () => {
    const service = makeService({
      listingCount: 1,
      workingHoursCount: 0,
      blockedTermCount: 2,
      icalCount: 0,
      bankAccount: '160-1234-56',
    });
    const onboarding = await (service as any).getOnboarding('user1');
    expect(onboarding.hasAvailability).toBe(true);
    expect(onboarding.allDone).toBe(false); // still missing hasIcal
  });

  it('is not fooled by a single missing item (stays not-done)', async () => {
    const service = makeService({
      listingCount: 1,
      workingHoursCount: 1,
      blockedTermCount: 0,
      icalCount: 1,
      bankAccount: null,
    });
    const onboarding = await (service as any).getOnboarding('user1');
    expect(onboarding.hasBankAccount).toBe(false);
    expect(onboarding.allDone).toBe(false);
  });
});

describe('DashboardService#getCounts (Dizajn 30 menu counters)', () => {
  it('counts requests awaiting this owner and conversations unread on either side', async () => {
    const prisma = {
      booking: { count: jest.fn().mockResolvedValue(4) },
      conversation: { count: jest.fn().mockResolvedValue(2) },
    };
    const service = new DashboardService(prisma as any, {} as any, {} as any);

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
