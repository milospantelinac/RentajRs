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
