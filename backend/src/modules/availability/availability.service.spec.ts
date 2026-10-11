import { BadRequestException, ConflictException, ForbiddenException, Logger, NotFoundException } from '@nestjs/common';
import * as dns from 'dns';
import { AvailabilityService } from './availability.service';

const i18n = { t: jest.fn((key: string) => key) };

// Production refuses feeds on private addresses; local development allows them.
function configWith(allowPrivateAddresses: boolean) {
  return { get: jest.fn((key: string) => (key === 'ical.allowPrivateAddresses' ? allowPrivateAddresses : undefined)) };
}

// Hosts under .internal stand for machines inside the server's network.
function mockLookup() {
  return jest.spyOn(dns.promises, 'lookup').mockImplementation(async (host: any) => {
    const address = String(host).endsWith('.internal') ? '10.0.0.5' : '93.184.216.34';
    return [{ address, family: 4 }] as any;
  });
}

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
  let lookup: jest.SpyInstance;
  let warn: jest.SpyInstance;
  beforeEach(() => {
    fetchMock.mockReset();
    lookup = mockLookup();
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    lookup.mockRestore();
    warn.mockRestore();
  });

  function makeService(options: { listing?: Record<string, any>; hasIcal?: boolean; existing?: boolean; allowPrivate?: boolean } = {}) {
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
    const config = configWith(options.allowPrivate ?? false);
    return { service: new AvailabilityService(prisma as any, events as any, i18n as any, config as any), prisma, events };
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
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: 'manual' });
    expect(lookup).toHaveBeenCalledWith('www.airbnb.com', { all: true });
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

  it.each([
    ['a host that resolves inside the network', 'http://calendar.internal/feed.ics'],
    ['a loopback address', 'http://127.0.0.1:5432/'],
    ['the cloud metadata address', 'http://169.254.169.254/latest/meta-data/'],
    ['an IPv6 loopback', 'http://[::1]:6379/'],
  ])('answers %s as unreachable and never fetches it', async (_label, url) => {
    const { service, prisma } = makeService();
    const error = await service.addIcalSource('u1', 'l1', { url }).catch((e) => e);
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.message).toBe('errors.ICAL_URL_UNREACHABLE');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(prisma.icalSource.create).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('non-public host'));
  });

  it('answers a redirect into the network as unreachable without following it', async () => {
    fetchMock.mockResolvedValueOnce({
      status: 302,
      ok: false,
      headers: { get: (name: string) => (name === 'location' ? 'http://169.254.169.254/latest/meta-data/' : null) },
      body: { cancel: jest.fn().mockResolvedValue(undefined) },
    });
    const { service, prisma } = makeService();
    const error = await service.addIcalSource('u1', 'l1', { url: 'https://feeds.example.com/cal.ics' }).catch((e) => e);
    expect(error.message).toBe('errors.ICAL_URL_UNREACHABLE');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(prisma.icalSource.create).not.toHaveBeenCalled();
  });

  it('reads a feed from a private address where that is allowed (local development)', async () => {
    fetchMock.mockResolvedValue(respond(200, FEED));
    const { service, prisma } = makeService({ allowPrivate: true });
    const row = await service.addIcalSource('u1', 'l1', { url: 'http://127.0.0.1:3399/good.ics' });
    expect(row).toMatchObject({ name: '127.0.0.1', status: 'ACTIVE' });
    expect(prisma.icalSource.create).toHaveBeenCalled();
    expect(lookup).not.toHaveBeenCalled();
  });
});

describe('AvailabilityService#syncIcalSource', () => {
  const fetchMock = jest.fn();
  const originalFetch = global.fetch;
  let lookup: jest.SpyInstance;
  beforeAll(() => {
    global.fetch = fetchMock as any;
  });
  afterAll(() => {
    global.fetch = originalFetch;
  });
  beforeEach(() => {
    fetchMock.mockReset();
    lookup = mockLookup();
  });
  afterEach(() => lookup.mockRestore());

  function makePrisma(source: Record<string, any>) {
    return {
      icalSource: { findUniqueOrThrow: jest.fn().mockResolvedValue(sourceRow(source)), update: jest.fn() },
      icalOccupancy: { findMany: jest.fn(), update: jest.fn() },
      blockedTerm: { deleteMany: jest.fn() },
    };
  }

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
    const service = new AvailabilityService(prisma as any, events as any, i18n as any, configWith(false) as any);

    await service.syncIcalSource('src1');

    expect(prisma.icalSource.update).toHaveBeenCalledWith({ where: { id: 'src1' }, data: { failureCount: 3, lastError: 'NOT_CALENDAR' } });
    expect(prisma.blockedTerm.deleteMany).not.toHaveBeenCalled();
    expect(prisma.icalOccupancy.update).not.toHaveBeenCalled();
    expect(events.emit).toHaveBeenCalledWith('availability.ical_sync_failed', { listingId: 'l1', sourceId: 'src1' });
  });

  it('does not fetch a stored address that points inside the network and counts it as a failed sync', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const prisma = makePrisma({ url: 'https://calendar.internal/feed.ics', failureCount: 0, lastSyncedAt: new Date() });
    const service = new AvailabilityService(prisma as any, { emit: jest.fn() } as any, i18n as any, configWith(false) as any);

    await service.syncIcalSource('src1');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(prisma.icalSource.update).toHaveBeenCalledWith({ where: { id: 'src1' }, data: { failureCount: 1, lastError: 'NON_PUBLIC_ADDRESS' } });
    expect(prisma.blockedTerm.deleteMany).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('src1'));
    warn.mockRestore();
  });

  it('checks the address when config leaves the setting out', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const prisma = makePrisma({ url: 'http://127.0.0.1:3399/good.ics' });
    const service = new AvailabilityService(prisma as any, { emit: jest.fn() } as any, i18n as any, { get: () => undefined } as any);

    await service.syncIcalSource('src1');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(prisma.icalSource.update.mock.calls[0][0].data.lastError).toBe('NON_PUBLIC_ADDRESS');
    warn.mockRestore();
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
    return { service: new AvailabilityService(prisma as any, {} as any, i18n as any, configWith(false) as any), prisma };
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
    return { service: new AvailabilityService(prisma as any, {} as any, i18n as any, configWith(false) as any), prisma };
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

describe('AvailabilityService working hours (T127)', () => {
  const rsd = (value: number) => BigInt(value * 100);
  function hoursService(rules: { overrides?: any[]; ranges?: any[]; hours?: any[]; block?: any }) {
    const prisma = {
      slotPriceOverride: { findMany: jest.fn(async () => rules.overrides ?? []) },
      hourlyPriceRange: { findMany: jest.fn(async () => rules.ranges ?? []) },
      workingHours: { findMany: jest.fn(async () => rules.hours ?? []) },
      blockedTerm: { findFirst: jest.fn(async () => rules.block ?? null) },
    };
    return { service: new AvailabilityService(prisma as any, { emit: jest.fn() } as any, i18n as any, configWith(false) as any), prisma };
  }
  // Belgrade runs on UTC+2 until 25 October 2026: 12. 10. is a Monday, 10. 10. a Saturday.
  const at = (iso: string) => new Date(iso);
  const prices = (units: Array<{ price: bigint; kind: string }>) => units.map((u) => `${u.kind} ${Number(u.price) / 100}`);

  it('prices each hour at the rate of its own part of the working hours', async () => {
    const { service } = hoursService({ ranges: [{ dayOfWeek: null, startTime: '16:00', endTime: '20:00', price: rsd(1200) }] });
    const units = await service.getWorkingHoursPrices('l1', at('2026-10-12T13:00:00Z'), at('2026-10-12T15:00:00Z'), rsd(1000), rsd(1500));
    expect(prices(units)).toEqual(['BASE 1000', 'RANGE 1200']);
  });

  it('takes the weekend price on a Saturday where no range covers the hour', async () => {
    const { service } = hoursService({ ranges: [{ dayOfWeek: null, startTime: '16:00', endTime: '20:00', price: rsd(1200) }] });
    const units = await service.getWorkingHoursPrices('l1', at('2026-10-10T13:00:00Z'), at('2026-10-10T15:00:00Z'), rsd(1000), rsd(1500));
    expect(prices(units)).toEqual(['WEEKEND 1500', 'RANGE 1200']);
  });

  it("puts the date's special price and that weekday's own range first", async () => {
    const { service, prisma } = hoursService({
      overrides: [{ startTime: '17:00', endTime: '18:00', price: rsd(3000) }],
      ranges: [
        { dayOfWeek: null, startTime: '16:00', endTime: '20:00', price: rsd(1200) },
        { dayOfWeek: 1, startTime: '16:00', endTime: '17:00', price: rsd(1100) },
      ],
    });
    const units = await service.getWorkingHoursPrices('l1', at('2026-10-12T14:00:00Z'), at('2026-10-12T17:00:00Z'), rsd(1000), null);
    expect(prices(units)).toEqual(['RANGE 1100', 'SPECIAL 3000', 'RANGE 1200']);
    expect(prisma.slotPriceOverride.findMany).toHaveBeenCalledWith({ where: { listingId: 'l1', date: new Date('2026-10-12T00:00:00Z') } });
  });

  it('keeps a Saturday evening that runs past midnight on Saturday, ranges across midnight included', async () => {
    const plain = hoursService({});
    const night = await plain.service.getWorkingHoursPrices('l1', at('2026-10-10T21:00:00Z'), at('2026-10-10T23:00:00Z'), rsd(5000), rsd(6000));
    expect(prices(night)).toEqual(['WEEKEND 6000', 'WEEKEND 6000']);
    const ranged = hoursService({ ranges: [{ dayOfWeek: null, startTime: '22:00', endTime: '02:00', price: rsd(7000) }] });
    const late = await ranged.service.getWorkingHoursPrices('l1', at('2026-10-10T19:00:00Z'), at('2026-10-11T00:00:00Z'), rsd(5000), rsd(6000));
    expect(prices(late)).toEqual(['WEEKEND 6000', 'RANGE 7000', 'RANGE 7000', 'RANGE 7000', 'RANGE 7000']);
  });

  it('prices a term that only starts after midnight as the evening whose working hours it is in (T141)', async () => {
    const hours = [
      { dayOfWeek: 1, startsAt: '10:00', endsAt: '01:00' },
      { dayOfWeek: 2, startsAt: '10:00', endsAt: '01:00' },
      { dayOfWeek: 6, startsAt: '14:00', endsAt: '02:00' },
    ];
    const monday = hoursService({
      hours,
      overrides: [{ startTime: '23:00', endTime: '01:00', price: rsd(9000) }],
      ranges: [
        { dayOfWeek: 1, startTime: '22:00', endTime: '01:00', price: rsd(6000) },
        { dayOfWeek: 2, startTime: '10:00', endTime: '16:00', price: rsd(3500) },
      ],
    });
    // Tue 00:00 to 01:00 is Monday night: Monday's special price for that date.
    const night = await monday.service.getWorkingHoursPrices('l1', at('2026-10-12T22:00:00Z'), at('2026-10-12T23:00:00Z'), rsd(1500), null);
    expect(prices(night)).toEqual(['SPECIAL 9000']);
    expect(monday.prisma.slotPriceOverride.findMany).toHaveBeenCalledWith({ where: { listingId: 'l1', date: new Date('2026-10-12T00:00:00Z') } });

    const plain = hoursService({ hours, ranges: [{ dayOfWeek: 1, startTime: '22:00', endTime: '01:00', price: rsd(6000) }] });
    const mondayNight = await plain.service.getWorkingHoursPrices('l1', at('2026-10-12T22:00:00Z'), at('2026-10-12T23:00:00Z'), rsd(1500), null);
    expect(prices(mondayNight)).toEqual(['RANGE 6000']);
    // Tuesday's own hours stay Tuesday's.
    const tuesday = await plain.service.getWorkingHoursPrices('l1', at('2026-10-13T08:00:00Z'), at('2026-10-13T09:00:00Z'), rsd(1500), null);
    expect(prices(tuesday)).toEqual(['BASE 1500']);
    // Sun 00:00 to 02:00 is Saturday night: still the weekend price.
    const saturdayNight = await plain.service.getWorkingHoursPrices('l1', at('2026-10-10T22:00:00Z'), at('2026-10-11T00:00:00Z'), rsd(5000), rsd(6000));
    expect(prices(saturdayNight)).toEqual(['WEEKEND 6000', 'WEEKEND 6000']);
  });

  it('closes the hours after midnight of a day the owner blocked as a whole (T141)', async () => {
    const hours = [{ dayOfWeek: 1, startsAt: '10:00', endsAt: '01:00' }];
    const blocked = hoursService({ hours, block: { id: 'b1' } });
    // Tue 00:00 to 01:00 is Monday night; Monday 12. 10. runs from 11. 10. 22:00 UTC.
    await expect(blocked.service.isInBlockedWorkingDay('l1', at('2026-10-12T22:00:00Z'), at('2026-10-12T23:00:00Z'))).resolves.toBe(true);
    expect(blocked.prisma.blockedTerm.findFirst).toHaveBeenCalledWith({
      where: {
        listingId: 'l1',
        source: 'MANUAL',
        startsAt: { lte: new Date('2026-10-11T22:00:00Z') },
        endsAt: { gte: new Date('2026-10-12T22:00:00Z') },
      },
      select: { id: true },
    });
    // A term on the day itself overlaps the block, which settles it on its own.
    blocked.prisma.blockedTerm.findFirst.mockClear();
    await expect(blocked.service.isInBlockedWorkingDay('l1', at('2026-10-12T20:00:00Z'), at('2026-10-12T21:00:00Z'))).resolves.toBe(false);
    expect(blocked.prisma.blockedTerm.findFirst).not.toHaveBeenCalled();
    const open = hoursService({ hours });
    await expect(open.service.isInBlockedWorkingDay('l1', at('2026-10-12T22:00:00Z'), at('2026-10-12T23:00:00Z'))).resolves.toBe(false);
  });

  it('accepts a term only inside one window of the working hours', async () => {
    const { service } = hoursService({
      hours: [
        { dayOfWeek: 1, startsAt: '10:00', endsAt: '20:00' },
        { dayOfWeek: 5, startsAt: '20:00', endsAt: '02:00' },
      ],
    });
    const fits = (from: string, to: string) => service.fitsWorkingHours('l1', at(from), at(to));
    await expect(fits('2026-10-12T16:00:00Z', '2026-10-12T18:00:00Z')).resolves.toBe(true); // Mon 18 to 20
    await expect(fits('2026-10-12T17:00:00Z', '2026-10-12T19:00:00Z')).resolves.toBe(false); // Mon 19 to 21
    await expect(fits('2026-10-12T07:00:00Z', '2026-10-12T09:00:00Z')).resolves.toBe(false); // Mon 9 to 11
    await expect(fits('2026-10-16T21:00:00Z', '2026-10-16T23:00:00Z')).resolves.toBe(true); // Fri 23 to Sat 1
    await expect(fits('2026-10-16T22:00:00Z', '2026-10-16T23:00:00Z')).resolves.toBe(true); // Sat 0 to 1, Friday's window
    await expect(fits('2026-10-16T23:00:00Z', '2026-10-17T01:00:00Z')).resolves.toBe(false); // Sat 1 to 3
    await expect(fits('2026-10-13T08:00:00Z', '2026-10-13T10:00:00Z')).resolves.toBe(false); // Tuesday is closed
  });
});

describe('AvailabilityService keeps to the way a listing is booked (T140, T121)', () => {
  const from = new Date('2026-10-10T00:00:00Z');
  const to = new Date('2026-11-10T00:00:00Z');

  function modeService(listing: Record<string, any> | null) {
    const prisma = {
      listing: {
        findUnique: jest.fn().mockResolvedValue(listing),
        updateMany: jest.fn(async () => ({ count: 1 })),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      blockedTerm: { findMany: jest.fn().mockResolvedValue([{ id: 'b1', source: 'MANUAL' }]) },
      workingHours: { findMany: jest.fn().mockResolvedValue([{ dayOfWeek: 5, startsAt: '15:00', endsAt: '00:00' }]) },
      hourlyPriceRange: { findMany: jest.fn().mockResolvedValue([{ startTime: '15:00', endTime: '18:00', price: 11100n }]) },
      slotPriceOverride: { findMany: jest.fn().mockResolvedValue([{ startTime: '15:00', endTime: '16:00', price: 30000n }]) },
      definedSlot: {
        findMany: jest.fn().mockResolvedValue([{ id: 's1', price: 6000000n }]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(async ({ data }: any) => ({ id: 's2', ...data })),
        deleteMany: jest.fn(async () => ({ count: 1 })),
        aggregate: jest.fn().mockResolvedValue({ _min: { price: 4500000n } }),
        groupBy: jest.fn(),
      },
      datePriceOverride: {
        findMany: jest.fn().mockResolvedValue([{ date: from, price: 800000n }]),
        upsert: jest.fn(async ({ create }: any) => create),
      },
    };
    return { prisma, service: new AvailabilityService(prisma as any, { emit: jest.fn() } as any, i18n as any, configWith(false) as any) };
  }
  const owned = (overrides: Record<string, any>) => ({ id: 'l1', userId: 'u1', price: 0n, ...overrides });
  const kinds = (data: any) =>
    Object.entries(data)
      .filter(([, rows]) => (rows as unknown[]).length)
      .map(([key]) => key);

  it("shows a listing on working hours its hours and their prices only, never slots another way left behind", async () => {
    const { prisma, service } = modeService(owned({ bookingModel: 'PER_SLOT', slotSubmode: 'WORKING_HOURS' }));
    const data = await service.getAvailability('l1', from, to);
    expect(kinds(data)).toEqual(['blocked', 'workingHours', 'hourlyPriceRanges', 'slotPriceOverrides']);
    expect(prisma.definedSlot.findMany).not.toHaveBeenCalled();
  });

  it('shows a listing on defined slots its slots only', async () => {
    const { prisma, service } = modeService(owned({ bookingModel: 'PER_SLOT', slotSubmode: 'DEFINED_SLOTS' }));
    const data = await service.getAvailability('l1', from, to);
    expect(kinds(data)).toEqual(['blocked', 'definedSlots']);
    expect(data.definedSlots[0].price).toBe(60000);
    expect(prisma.workingHours.findMany).not.toHaveBeenCalled();
  });

  it("shows a stay its date prices, and a listing without booking only what is blocked", async () => {
    const stay = modeService(owned({ bookingModel: 'PER_STAY', slotSubmode: null }));
    expect(kinds(await stay.service.getAvailability('l1', from, to))).toEqual(['blocked', 'datePriceOverrides']);

    const contact = modeService(owned({ bookingModel: 'NO_BOOKING', slotSubmode: 'WORKING_HOURS' }));
    expect(kinds(await contact.service.getAvailability('l1', from, to))).toEqual(['blocked']);
  });

  it('writes a way only while the listing is saved with it, blocked dates always', async () => {
    const hours = modeService(owned({ bookingModel: 'PER_SLOT', slotSubmode: 'WORKING_HOURS' }));
    const slot = { startsAt: '2026-10-16T12:00:00.000Z', endsAt: '2026-10-16T21:30:00.000Z', price: 60000 };
    await expect(hours.service.createDefinedSlot('u1', 'l1', slot as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(i18n.t).toHaveBeenCalledWith('errors.AVAILABILITY_MODE_NOT_SAVED');
    await expect(hours.service.setDatePrice('u1', 'l1', { date: '2026-10-16', price: 9000 } as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(hours.prisma.definedSlot.create).not.toHaveBeenCalled();
    expect(hours.prisma.datePriceOverride.upsert).not.toHaveBeenCalled();

    const slots = modeService(owned({ bookingModel: 'PER_SLOT', slotSubmode: 'DEFINED_SLOTS' }));
    await expect(slots.service.setWorkingHours('u1', 'l1', { hours: [] } as any)).rejects.toBeInstanceOf(BadRequestException);
    await expect(slots.service.setHourlyPriceRanges('u1', 'l1', { ranges: [] } as any)).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      slots.service.setSlotPriceOverride('u1', 'l1', { date: '2026-10-16', startTime: '15:00', endTime: '16:00', price: 300 } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('moves the price shown as "Od X RSD" with every slot added or removed (T121)', async () => {
    const { prisma, service } = modeService(owned({ bookingModel: 'PER_SLOT', slotSubmode: 'DEFINED_SLOTS' }));
    const slot = { startsAt: '2026-10-16T12:00:00.000Z', endsAt: '2026-10-16T21:30:00.000Z', price: 45000 };

    await service.createDefinedSlot('u1', 'l1', slot as any);
    await service.deleteDefinedSlot('u1', 'l1', 's2');

    expect(prisma.definedSlot.aggregate.mock.calls[0][0].where).toEqual({
      listingId: 'l1',
      startsAt: { gt: expect.any(Date) },
      price: { not: null },
    });
    expect(prisma.listing.updateMany).toHaveBeenCalledTimes(2);
    expect(prisma.listing.updateMany).toHaveBeenCalledWith({
      where: { id: 'l1', bookingModel: 'PER_SLOT', slotSubmode: 'DEFINED_SLOTS', price: { not: 4500000n } },
      data: { price: 4500000n },
    });
  });
});

describe('AvailabilityService#refreshDefinedSlotPrices (T121)', () => {
  it('gives each listing on defined slots its cheapest slot ahead, 0 with none left, and writes only a change', async () => {
    const prisma = {
      listing: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'cheaper', price: 6000000n },
          { id: 'same', price: 450000n },
          { id: 'passed', price: 800000n },
        ]),
        update: jest.fn(),
      },
      definedSlot: {
        groupBy: jest.fn().mockResolvedValue([
          { listingId: 'cheaper', _min: { price: 5000000n } },
          { listingId: 'same', _min: { price: 450000n } },
        ]),
      },
    };
    const service = new AvailabilityService(prisma as any, { emit: jest.fn() } as any, i18n as any, configWith(false) as any);

    await service.refreshDefinedSlotPrices();

    expect(prisma.listing.findMany.mock.calls[0][0].where).toEqual({
      bookingModel: 'PER_SLOT',
      slotSubmode: 'DEFINED_SLOTS',
      status: { not: 'DELETED' },
    });
    expect(prisma.definedSlot.groupBy.mock.calls[0][0].where).toMatchObject({
      listingId: { in: ['cheaper', 'same', 'passed'] },
      price: { not: null },
    });
    expect(prisma.listing.update.mock.calls).toEqual([
      [{ where: { id: 'cheaper' }, data: { price: 5000000n } }],
      [{ where: { id: 'passed' }, data: { price: 0n } }],
    ]);
  });
});

describe('AvailabilityService step 3 made simpler (T141)', () => {
  const owner = { id: 'l1', userId: 'u1', price: 0n, bookingModel: 'PER_SLOT', slotSubmode: 'DEFINED_SLOTS' };

  function stepService(
    options: { listing?: Record<string, any>; existing?: any[]; slot?: any; booked?: boolean; duplicate?: boolean } = {},
  ) {
    const prisma: any = {
      listing: {
        findUnique: jest.fn().mockResolvedValue({ ...owner, ...options.listing }),
        update: jest.fn(async ({ data }: any) => ({ ...owner, ...data })),
        updateMany: jest.fn(async () => ({ count: 1 })),
      },
      definedSlot: {
        findMany: jest.fn().mockResolvedValue(options.existing ?? []),
        createMany: jest.fn(async ({ data }: any) => ({ count: data.length })),
        findFirst: jest.fn(async ({ where }: any) => {
          if (where.id === 's1') return options.slot ?? null;
          return options.duplicate ? { id: 's9' } : null;
        }),
        update: jest.fn(async ({ data }: any) => ({ id: 's1', listingId: 'l1', ...data })),
        aggregate: jest.fn().mockResolvedValue({ _min: { price: 1200000n } }),
      },
      blockedTerm: { findFirst: jest.fn().mockResolvedValue(options.booked ? { id: 'b1' } : null) },
      workingHours: { deleteMany: jest.fn(async () => ({})), createMany: jest.fn(async () => ({})) },
      hourlyPriceRange: { deleteMany: jest.fn(async () => ({})), createMany: jest.fn(async () => ({})) },
    };
    prisma.$transaction = jest.fn((ops: Promise<unknown>[]) => Promise.all(ops));
    const service = new AvailabilityService(prisma as any, { emit: jest.fn() } as any, i18n as any, configWith(false) as any);
    return { prisma, service };
  }
  const weekend = [
    { startTime: '10:00', endTime: '12:00', price: 12000 },
    { startTime: '12:30', endTime: '14:30', price: 12000 },
    { startTime: '15:00', endTime: '17:00', price: 15000 },
  ];
  const made = (prisma: any) => prisma.definedSlot.createMany.mock.calls[0][0].data;
  const iso = (slot: any) => `${slot.startsAt.toISOString()} ${slot.endsAt.toISOString()}`;
  const slotOne = () => ({
    id: 's1',
    listingId: 'l1',
    startsAt: new Date('2026-10-10T08:00:00Z'),
    endsAt: new Date('2026-10-10T10:00:00Z'),
  });

  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    jest.setSystemTime(new Date('2026-10-01T10:00:00Z'));
  });
  afterEach(() => jest.useRealTimers());

  it('makes the template slots on every chosen weekday, in Belgrade time across the clock change', async () => {
    const { prisma, service } = stepService();
    // 3./4. to 24./25. 10. are four weekends; Belgrade moves to UTC+1 on 25. 10.
    const result = await service.generateDefinedSlots('u1', 'l1', {
      days: [7, 6],
      slots: weekend,
      from: '2026-10-03',
      to: '2026-10-25',
    });

    expect(result).toMatchObject({ created: 24, skipped: 0 });
    const slots = made(prisma);
    expect(slots).toHaveLength(24);
    expect(iso(slots[0])).toBe('2026-10-03T08:00:00.000Z 2026-10-03T10:00:00.000Z');
    expect(slots[0]).toMatchObject({ listingId: 'l1', price: 1200000n, maxBookings: 1 });
    expect(iso(slots[slots.length - 3])).toBe('2026-10-25T09:00:00.000Z 2026-10-25T11:00:00.000Z');
    expect(slots[slots.length - 1].price).toBe(1500000n);
    expect(prisma.listing.update).toHaveBeenCalledWith({
      where: { id: 'l1' },
      data: { slotTemplate: { days: [6, 7], slots: weekend, from: '2026-10-03', to: '2026-10-25' } },
    });
    expect(prisma.listing.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { price: 1200000n } }));
  });

  it('only adds: skips what would overlap a slot already there and leaves out what has passed', async () => {
    jest.setSystemTime(new Date('2026-10-03T09:00:00Z')); // Saturday 11:00 in Belgrade
    const { prisma, service } = stepService({
      // Sunday 12:30 to 13:30
      existing: [{ startsAt: new Date('2026-10-04T10:30:00Z'), endsAt: new Date('2026-10-04T11:30:00Z') }],
    });
    const result = await service.generateDefinedSlots('u1', 'l1', {
      days: [6, 7],
      slots: weekend,
      from: '2026-10-03',
      to: '2026-10-04',
    });

    expect(result).toMatchObject({ created: 4, skipped: 1 });
    expect(made(prisma).map(iso)).toEqual([
      '2026-10-03T10:30:00.000Z 2026-10-03T12:30:00.000Z',
      '2026-10-03T13:00:00.000Z 2026-10-03T15:00:00.000Z',
      '2026-10-04T08:00:00.000Z 2026-10-04T10:00:00.000Z',
      '2026-10-04T13:00:00.000Z 2026-10-04T15:00:00.000Z',
    ]);
  });

  it('ends a slot that runs past midnight on the next day', async () => {
    const { prisma, service } = stepService();
    await service.generateDefinedSlots('u1', 'l1', {
      days: [6],
      slots: [{ startTime: '22:00', endTime: '02:00', price: 30000 }],
      from: '2026-10-03',
      to: '2026-10-03',
    });
    expect(made(prisma).map(iso)).toEqual(['2026-10-03T20:00:00.000Z 2026-10-04T00:00:00.000Z']);
  });

  it('refuses slots of a day that overlap, a slot without length and a range backwards or over a year', async () => {
    const { prisma, service } = stepService();
    const generate = (dto: Record<string, any>) =>
      service.generateDefinedSlots('u1', 'l1', {
        days: [6],
        slots: weekend,
        from: '2026-10-03',
        to: '2026-10-10',
        ...dto,
      } as any);
    const row = (startTime: string, endTime: string) => ({ startTime, endTime, price: 1 });

    await expect(generate({ slots: [row('10:00', '12:00'), row('11:00', '13:00')] })).rejects.toThrow(
      'errors.SLOT_TEMPLATE_OVERLAP',
    );
    await expect(generate({ slots: [row('22:00', '02:00'), row('01:00', '03:00')] })).rejects.toThrow(
      'errors.SLOT_TEMPLATE_OVERLAP',
    );
    await expect(generate({ slots: [row('10:00', '10:00')] })).rejects.toThrow('errors.SLOT_TIMES_EQUAL');
    await expect(generate({ to: '2026-10-02' })).rejects.toThrow('errors.SLOT_RANGE_INVALID');
    await expect(generate({ to: '2027-11-03' })).rejects.toThrow('errors.SLOT_RANGE_TOO_LONG');
    expect(prisma.definedSlot.createMany).not.toHaveBeenCalled();
    expect(prisma.listing.update).not.toHaveBeenCalled();
  });

  it('changes one slot, its day, times and price, and nothing else', async () => {
    const { prisma, service } = stepService({ slot: slotOne() });
    const updated = await service.updateDefinedSlot('u1', 'l1', 's1', {
      date: '2026-10-11',
      startTime: '11:00',
      endTime: '13:00',
      price: 9000,
    });

    expect(prisma.definedSlot.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { startsAt: new Date('2026-10-11T09:00:00Z'), endsAt: new Date('2026-10-11T11:00:00Z'), price: 900000n },
    });
    expect(updated.price).toBe(9000);
    expect(prisma.definedSlot.createMany).not.toHaveBeenCalled();
    expect(prisma.listing.update).not.toHaveBeenCalled();
    expect(prisma.listing.updateMany).toHaveBeenCalled();
  });

  it('keeps the time of a slot a booking holds but lets its price change', async () => {
    const booked = stepService({ slot: slotOne(), booked: true });
    await expect(
      booked.service.updateDefinedSlot('u1', 'l1', 's1', {
        date: '2026-10-10',
        startTime: '11:00',
        endTime: '13:00',
        price: 9000,
      }),
    ).rejects.toThrow('errors.DEFINED_SLOT_BOOKED');
    expect(booked.prisma.blockedTerm.findFirst).toHaveBeenCalledWith({
      where: {
        listingId: 'l1',
        source: 'BOOKING',
        startsAt: { lt: new Date('2026-10-10T10:00:00Z') },
        endsAt: { gt: new Date('2026-10-10T08:00:00Z') },
      },
      select: { id: true },
    });

    const priced = stepService({ slot: slotOne(), booked: true });
    await priced.service.updateDefinedSlot('u1', 'l1', 's1', {
      date: '2026-10-10',
      startTime: '10:00',
      endTime: '12:00',
      price: 9000,
    });
    expect(priced.prisma.blockedTerm.findFirst).not.toHaveBeenCalled();
    expect(priced.prisma.definedSlot.update.mock.calls[0][0].data.price).toBe(900000n);
  });

  it('refuses moving a slot onto another one, into the past, or a slot it cannot find', async () => {
    const elsewhere = { startTime: '10:00', endTime: '12:00', price: 9000 };
    const twin = stepService({ slot: slotOne(), duplicate: true });
    await expect(twin.service.updateDefinedSlot('u1', 'l1', 's1', { date: '2026-10-11', ...elsewhere })).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(i18n.t).toHaveBeenCalledWith('errors.DEFINED_SLOT_DUPLICATE', expect.anything());

    const past = stepService({ slot: slotOne() });
    await expect(past.service.updateDefinedSlot('u1', 'l1', 's1', { date: '2026-09-30', ...elsewhere })).rejects.toThrow(
      'errors.DEFINED_SLOT_IN_PAST',
    );

    const missing = stepService();
    await expect(
      missing.service.updateDefinedSlot('u1', 'l1', 's1', { date: '2026-10-11', ...elsewhere }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('saves working hours and their prices in one write, touching periods allowed, overlapping ones refused', async () => {
    const { prisma, service } = stepService({ listing: { slotSubmode: 'WORKING_HOURS' } });
    await service.setWorkingSchedule('u1', 'l1', {
      hours: [
        { dayOfWeek: 1, startsAt: '10:00', endsAt: '14:00' },
        { dayOfWeek: 1, startsAt: '14:00', endsAt: '22:00' },
        { dayOfWeek: 5, startsAt: '18:00', endsAt: '02:00' },
      ],
      ranges: [{ startTime: '14:00', endTime: '22:00', price: 4200 }],
    } as any);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.workingHours.createMany.mock.calls[0][0].data).toHaveLength(3);
    expect(prisma.hourlyPriceRange.createMany.mock.calls[0][0].data).toEqual([
      { listingId: 'l1', dayOfWeek: null, startTime: '14:00', endTime: '22:00', price: 420000n },
    ]);

    await expect(
      service.setWorkingSchedule('u1', 'l1', {
        hours: [
          { dayOfWeek: 5, startsAt: '18:00', endsAt: '02:00' },
          { dayOfWeek: 5, startsAt: '01:00', endsAt: '03:00' },
        ],
        ranges: [],
      } as any),
    ).rejects.toThrow('errors.WORKING_HOURS_OVERLAP');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);

    const slots = stepService();
    await expect(slots.service.setWorkingSchedule('u1', 'l1', { hours: [], ranges: [] } as any)).rejects.toThrow(
      'errors.AVAILABILITY_MODE_NOT_SAVED',
    );
  });
});
