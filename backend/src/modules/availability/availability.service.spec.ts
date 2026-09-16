import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AvailabilityService } from './availability.service';

const i18n = { t: jest.fn((key: string) => key) };

const FEED = ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:a1', 'DTSTART;VALUE=DATE:20261003', 'DTEND;VALUE=DATE:20261006', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');

function listingRow(overrides: Record<string, any> = {}) {
  return {
    id: 'l1',
    userId: 'u1',
    title: 'Stan na Vračaru',
    status: 'ACTIVE',
    bookingModel: 'PER_STAY',
    priceUnit: 'NIGHT',
    subscriptionId: 's1',
    icalExportToken: 'tok-123',
    ...overrides,
  };
}

function sourceRow(overrides: Record<string, any> = {}) {
  return { id: 'src1', listingId: 'l1', name: 'Airbnb', url: 'https://www.airbnb.com/1.ics', lastSyncedAt: null, lastError: null, failureCount: 0, active: true, ...overrides };
}

function respond(status: number, body: string) {
  return { ok: status >= 200 && status < 300, status, text: async () => body };
}

describe('AvailabilityService#addIcalSource (Dizajn 33)', () => {
  const fetchMock = jest.fn();
  const originalFetch = global.fetch;
  beforeAll(() => {
    global.fetch = fetchMock as any;
  });
  afterAll(() => {
    global.fetch = originalFetch;
  });
  beforeEach(() => fetchMock.mockReset());

  function makeService(options: { listing?: Record<string, any>; hasIcal?: boolean; existing?: boolean } = {}) {
    let created: any = null;
    const prisma = {
      listing: { findUnique: jest.fn().mockResolvedValue(listingRow(options.listing)) },
      subscription: { findUnique: jest.fn().mockResolvedValue({ package: { hasIcal: options.hasIcal ?? true } }) },
      icalSource: {
        findFirst: jest.fn().mockResolvedValue(options.existing ? { id: 'old' } : null),
        create: jest.fn(async ({ data }) => (created = sourceRow({ id: 'new', ...data }))),
        findUniqueOrThrow: jest.fn(async () => created),
        update: jest.fn(async ({ data }) => (created = { ...created, ...data })),
      },
      icalOccupancy: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(async ({ data }) => ({ id: 'occ1', ...data })),
        update: jest.fn(),
      },
      blockedTerm: { create: jest.fn(async ({ data }) => ({ id: 'bt1', ...data })), deleteMany: jest.fn() },
    };
    const events = { emit: jest.fn() };
    return { service: new AvailabilityService(prisma as any, events as any, i18n as any), prisma, events };
  }

  it.each([
    [{ listing: { priceUnit: 'MONTH' } }, BadRequestException, 'errors.LISTING_NOT_BOOKABLE'],
    [{ listing: { bookingModel: 'PER_SLOT', priceUnit: 'HOUR' } }, BadRequestException, 'errors.LISTING_NOT_BOOKABLE'],
    [{ listing: { status: 'PENDING_APPROVAL' } }, BadRequestException, 'errors.ICAL_LISTING_NOT_ACTIVE'],
    [{ hasIcal: false }, ForbiddenException, 'errors.PACKAGE_FEATURE_NOT_INCLUDED'],
  ])('refuses a listing that cannot use iCal (%j)', async (options, type, message) => {
    const { service, prisma } = makeService(options);
    const error = await service.addIcalSource('u1', 'l1', { url: 'https://www.airbnb.com/1.ics' }).catch((e) => e);
    expect(error).toBeInstanceOf(type);
    expect(error.message).toBe(message);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(prisma.icalSource.create).not.toHaveBeenCalled();
  });

  it("refuses the listing's own export feed and a calendar that is already connected, without fetching", async () => {
    const own = makeService();
    const ownError = await own.service.addIcalSource('u1', 'l1', { url: 'https://rentaj.rs/ical/tok-123.ics' }).catch((e) => e);
    expect(ownError).toBeInstanceOf(BadRequestException);
    expect(ownError.message).toBe('errors.ICAL_SOURCE_OWN_FEED');

    const duplicate = makeService({ existing: true });
    const duplicateError = await duplicate.service.addIcalSource('u1', 'l1', { url: 'webcal://www.airbnb.com/1.ics' }).catch((e) => e);
    expect(duplicateError).toBeInstanceOf(ConflictException);
    expect(duplicateError.message).toBe('errors.ICAL_SOURCE_DUPLICATE');
    // The webcal link is compared as the https feed it stands for.
    expect(duplicate.prisma.icalSource.findFirst).toHaveBeenCalledWith({ where: { listingId: 'l1', url: 'https://www.airbnb.com/1.ics' }, select: { id: true } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['a network failure', () => Promise.reject(new TypeError('fetch failed')), 'errors.ICAL_URL_UNREACHABLE'],
    ['a 404', () => Promise.resolve(respond(404, 'Not found')), 'errors.ICAL_URL_UNREACHABLE'],
    ['a sign-in page', () => Promise.resolve(respond(200, '<!doctype html><title>Log in</title>')), 'errors.ICAL_URL_NOT_CALENDAR'],
  ])('keeps nothing when the address gives %s', async (_label, answer, message) => {
    fetchMock.mockImplementation(answer);
    const { service, prisma } = makeService();
    const error = await service.addIcalSource('u1', 'l1', { url: 'https://www.airbnb.com/1.ics' }).catch((e) => e);
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.message).toBe(message);
    expect(prisma.icalSource.create).not.toHaveBeenCalled();
  });

  it('names the calendar after its address and imports it at once from the same response', async () => {
    fetchMock.mockResolvedValue(respond(200, FEED));
    const { service, prisma } = makeService();

    const row = await service.addIcalSource('u1', 'l1', { url: ' webcal://www.airbnb.com/1.ics ' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://www.airbnb.com/1.ics');
    expect(prisma.icalSource.create).toHaveBeenCalledWith({ data: { listingId: 'l1', name: 'Airbnb', url: 'https://www.airbnb.com/1.ics' } });
    expect(prisma.blockedTerm.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ listingId: 'l1', source: 'ICAL', icalSourceId: 'new', startsAt: new Date('2026-10-03T00:00:00Z') }),
    });
    expect(row).toEqual({
      id: 'new',
      name: 'Airbnb',
      url: 'https://www.airbnb.com/1.ics',
      lastSyncedAt: expect.any(Date),
      status: 'ACTIVE',
      error: null,
    });
  });

  it('keeps a name the caller sends', async () => {
    fetchMock.mockResolvedValue(respond(200, FEED));
    const { service, prisma } = makeService();
    await service.addIcalSource('u1', 'l1', { url: 'https://www.airbnb.com/1.ics', name: '  Airbnb soba 2 ' });
    expect(prisma.icalSource.create.mock.calls[0][0].data.name).toBe('Airbnb soba 2');
  });
});

describe('AvailabilityService#syncIcalSource', () => {
  const fetchMock = jest.fn();
  const originalFetch = global.fetch;
  beforeAll(() => {
    global.fetch = fetchMock as any;
  });
  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('treats a feed that stops being a calendar as a failed sync and keeps what it imported (Dizajn 33)', async () => {
    fetchMock.mockResolvedValue(respond(200, '<html>Session expired</html>'));
    const prisma = {
      icalSource: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(sourceRow({ failureCount: 2, lastSyncedAt: new Date() })),
        update: jest.fn(),
      },
      icalOccupancy: { findMany: jest.fn(), update: jest.fn() },
      blockedTerm: { deleteMany: jest.fn() },
    };
    const events = { emit: jest.fn() };
    const service = new AvailabilityService(prisma as any, events as any, i18n as any);

    await service.syncIcalSource('src1');

    expect(prisma.icalSource.update).toHaveBeenCalledWith({ where: { id: 'src1' }, data: { failureCount: 3, lastError: 'NOT_CALENDAR' } });
    expect(prisma.blockedTerm.deleteMany).not.toHaveBeenCalled();
    expect(prisma.icalOccupancy.update).not.toHaveBeenCalled();
    expect(events.emit).toHaveBeenCalledWith('availability.ical_sync_failed', { listingId: 'l1', sourceId: 'src1' });
  });
});

describe('AvailabilityService#removeIcalSource', () => {
  function makeService(source: Record<string, any> | null) {
    const prisma = {
      listing: { findUnique: jest.fn().mockResolvedValue(listingRow()) },
      icalSource: { findFirst: jest.fn().mockResolvedValue(source), delete: jest.fn().mockReturnValue('delete-source') },
      icalOccupancy: { deleteMany: jest.fn().mockReturnValue('delete-occupancies') },
      blockedTerm: { deleteMany: jest.fn().mockReturnValue('delete-blocks') },
      $transaction: jest.fn(async (operations: unknown[]) => operations),
    };
    return { service: new AvailabilityService(prisma as any, {} as any, i18n as any), prisma };
  }

  it("leaves another listing's calendar and its imported dates alone (Dizajn 33)", async () => {
    const { service, prisma } = makeService(null);
    const error = await service.removeIcalSource('u1', 'l1', 'foreign').catch((e) => e);
    expect(error).toBeInstanceOf(NotFoundException);
    expect(error.message).toBe('errors.ICAL_SOURCE_NOT_FOUND');
    expect(prisma.icalSource.findFirst).toHaveBeenCalledWith({ where: { id: 'foreign', listingId: 'l1' }, select: { id: true } });
    expect(prisma.icalOccupancy.deleteMany).not.toHaveBeenCalled();
    expect(prisma.blockedTerm.deleteMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('removes its own calendar with the dates it imported, in one transaction', async () => {
    const { service, prisma } = makeService({ id: 'src1' });
    await expect(service.removeIcalSource('u1', 'l1', 'src1')).resolves.toEqual({ message: 'ok' });
    expect(prisma.icalOccupancy.deleteMany).toHaveBeenCalledWith({ where: { sourceId: 'src1' } });
    expect(prisma.blockedTerm.deleteMany).toHaveBeenCalledWith({ where: { icalSourceId: 'src1' } });
    expect(prisma.icalSource.delete).toHaveBeenCalledWith({ where: { id: 'src1' } });
    expect(prisma.$transaction).toHaveBeenCalledWith(['delete-occupancies', 'delete-blocks', 'delete-source']);
  });

  it("refuses someone else's listing", async () => {
    const { service } = makeService({ id: 'src1' });
    await expect(service.removeIcalSource('u2', 'l1', 'src1')).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('AvailabilityService#getIcalOverview (Dizajn 33)', () => {
  function makeService(listing: Record<string, any> | null, sources: any[] = []) {
    const prisma = {
      listing: {
        findUnique: jest.fn().mockResolvedValue(listing),
        update: jest.fn(async ({ data }) => ({ ...listing, ...data })),
      },
      icalSource: { findMany: jest.fn().mockResolvedValue(sources) },
    };
    return { service: new AvailabilityService(prisma as any, {} as any, i18n as any), prisma };
  }

  const withPlace = (overrides: Record<string, any> = {}) =>
    listingRow({ city: { name: 'Beograd' }, cityArea: { name: 'Vračar' }, subscription: { package: { hasIcal: true } }, ...overrides });

  it('returns the breadcrumb, the feed token and the calendars with their state', async () => {
    const synced = new Date('2026-09-16T12:48:00Z');
    const { service, prisma } = makeService(withPlace(), [
      sourceRow({ lastSyncedAt: synced }),
      sourceRow({ id: 'src2', name: 'Booking.com', lastSyncedAt: synced, lastError: 'HTTP 404', failureCount: 1 }),
      sourceRow({ id: 'src3', name: 'Google Calendar', lastError: 'NOT_CALENDAR' }),
      sourceRow({ id: 'src4', name: 'Vrbo' }),
    ]);

    const overview = await service.getIcalOverview('u1', 'l1');

    expect(prisma.icalSource.findMany).toHaveBeenCalledWith({ where: { listingId: 'l1' }, orderBy: [{ name: 'asc' }, { url: 'asc' }] });
    expect(overview).toMatchObject({
      listing: { id: 'l1', title: 'Stan na Vračaru', status: 'ACTIVE', cityName: 'Beograd', cityAreaName: 'Vračar' },
      availability: 'AVAILABLE',
      exportToken: 'tok-123',
    });
    expect(overview.sources.map(({ id, status, error }) => ({ id, status, error }))).toEqual([
      { id: 'src1', status: 'ACTIVE', error: null },
      { id: 'src2', status: 'ERROR', error: 'UNREACHABLE' },
      { id: 'src3', status: 'ERROR', error: 'NOT_CALENDAR' },
      { id: 'src4', status: 'PENDING', error: null },
    ]);
    expect(overview.sources[0]).not.toHaveProperty('failureCount');
  });

  it('gives a stay without a feed token one', async () => {
    const { service, prisma } = makeService(withPlace({ icalExportToken: null }));
    const overview = await service.getIcalOverview('u1', 'l1');
    expect(prisma.listing.update).toHaveBeenCalledWith({ where: { id: 'l1' }, data: { icalExportToken: expect.any(String) } });
    expect(overview.exportToken).toEqual(expect.stringMatching(/^[0-9a-f-]{36}$/));
  });

  it('shows no feed and no calendars while the listing cannot use them', async () => {
    const { service, prisma } = makeService(withPlace({ subscription: { package: { hasIcal: false } } }));
    const overview = await service.getIcalOverview('u1', 'l1');
    expect(overview).toMatchObject({ availability: 'NO_ICAL_PACKAGE', exportToken: null, sources: [] });
    expect(prisma.icalSource.findMany).not.toHaveBeenCalled();
  });

  it("refuses a deleted listing and someone else's", async () => {
    await expect(makeService(null).service.getIcalOverview('u1', 'l1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(makeService(withPlace({ status: 'DELETED' })).service.getIcalOverview('u1', 'l1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(makeService(withPlace()).service.getIcalOverview('u2', 'l1')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
