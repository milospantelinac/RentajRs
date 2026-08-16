import { BadRequestException } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';

describe('SubscriptionsService#assertPackageCompatibleWithListing (Ch.11.2 package-tier enforcement)', () => {
  const i18n = { t: jest.fn((key: string) => key) };

  function makeService(prisma: any) {
    return new SubscriptionsService(
      prisma,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      i18n as any,
      {} as any,
      {} as any,
    );
  }

  beforeEach(() => i18n.t.mockClear());

  it('rejects a bookable listing when the package does not include bookings (Osnovni/BASIC)', async () => {
    const prisma = {
      listing: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'l1', bookingModel: 'PER_STAY' }) },
      package: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'p1', hasBookings: false }) },
    };
    const service = makeService(prisma);
    await expect(
      (service as any).assertPackageCompatibleWithListing('l1', 'p1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows a bookable listing when the package includes bookings (Pro)', async () => {
    const prisma = {
      listing: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'l1', bookingModel: 'PER_STAY' }) },
      package: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'p1', hasBookings: true }) },
    };
    const service = makeService(prisma);
    await expect((service as any).assertPackageCompatibleWithListing('l1', 'p1')).resolves.toBeUndefined();
  });

  it('allows a NO_BOOKING listing on a package without bookings', async () => {
    const prisma = {
      listing: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'l1', bookingModel: 'NO_BOOKING' }) },
      package: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'p1', hasBookings: false }) },
    };
    const service = makeService(prisma);
    await expect((service as any).assertPackageCompatibleWithListing('l1', 'p1')).resolves.toBeUndefined();
  });
});
