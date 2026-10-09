import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Logger } from '@nestjs/common';
import { I18nContext, I18nService } from 'nestjs-i18n';
import {
  DatePriceOverride,
  DefinedSlot,
  HourlyPriceRange,
  IcalSource,
  Listing,
  OccupancySource,
  SlotPriceOverride,
  WorkingHours,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { isDefinedSlotsSetup, isWorkingHoursSetup, lowestUpcomingSlotPrice } from '../../common/utils/booking-models';
import { parseIcs, buildIcsCalendar, icalSourceName, isIcsCalendar, normalizeIcalUrl } from '../../common/utils/ics';
import { ICAL_FAILURE_ALERT_THRESHOLD, getIcalAvailability } from '../../common/utils/ical-availability';
import { NonPublicAddressError, fetchUserUrl } from '../../common/utils/outbound-fetch';
import { paraToRsd, rsdToPara } from '../../common/utils/money';
import { belgradeWallClock, toBelgradeDateOnly, toBelgradeHHMM, toBelgradeISODayOfWeek } from '../../common/utils/timezone';
import {
  SetWorkingHoursDto,
  CreateDefinedSlotDto,
  CreateManualBlockDto,
  SetDatePriceDto,
  SetHourlyPriceRangesDto,
  SetSlotPriceOverrideDto,
  AddIcalSourceDto,
} from './dto/availability.dto';

const ICAL_FETCH_TIMEOUT_MS = 15_000;
// Stored as lastError when a feed answers with something other than a calendar.
const ICAL_NOT_CALENDAR = 'NOT_CALENDAR';

/**
 * Dizajn 34: which rule priced a unit (an hour, a night, a month). A booking
 * keeps this with its total so the owner's request card can say
 * "2 sata × 4.200 RSD (vikend cena)". RANGE is a price for part of the
 * working hours, SPECIAL a price set for one date or one time slot.
 */
export type PriceKind = 'BASE' | 'WEEKEND' | 'RANGE' | 'SPECIAL';

export interface PricedUnit {
  price: bigint;
  kind: PriceKind;
}

/**
 * Dizajn 33: one fetch for adding a feed and for the hourly sync. A hanging
 * host no longer holds up the sync of every other feed, and a response that
 * isn't a calendar fails the same way an unreachable one does. The address is
 * the owner's, so fetchUserUrl keeps it (and every redirect) off the server's
 * own network.
 */
async function fetchIcalFeed(url: string, allowPrivateAddresses: boolean): Promise<string> {
  const response = await fetchUserUrl(url, { allowPrivateAddresses, signal: AbortSignal.timeout(ICAL_FETCH_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const text = await response.text();
  if (!isIcsCalendar(text)) throw new Error(ICAL_NOT_CALENDAR);
  return text;
}

/** What the iCal page shows for a connected calendar; the raw error stays in the database. */
function serializeIcalSource(source: IcalSource) {
  return {
    id: source.id,
    name: source.name,
    url: source.url,
    lastSyncedAt: source.lastSyncedAt,
    status: source.lastError ? 'ERROR' : source.lastSyncedAt ? 'ACTIVE' : 'PENDING',
    error: source.lastError ? (source.lastError === ICAL_NOT_CALENDAR ? 'NOT_CALENDAR' : 'UNREACHABLE') : null,
  };
}

@Injectable()
export class AvailabilityService {
  private readonly logger = new Logger(AvailabilityService.name);

  constructor(
    private prisma: PrismaService,
    private events: EventEmitter2,
    private i18n: I18nService,
    private config: ConfigService,
  ) {}

  /** Only local development may read feeds from private addresses (config `ical.allowPrivateAddresses`). */
  private get allowPrivateFeedAddresses(): boolean {
    return this.config.get<boolean>('ical.allowPrivateAddresses') === true;
  }

  // -- Core term-locking (used by BookingsService) ------------------------

  /**
   * The single choke point every term reservation goes through. Relies on
   * the database's GiST exclusion constraint (blocked_term_no_overlap,
   * migrations/*_constraints_and_extensions) as the actual source of truth
   * for "is this free" — a concurrent request racing this one will fail
   * atomically at the database level rather than both succeeding (R53: the
   * first request locks the term, the second is told it's taken).
   */
  async lockTerm(
    listingId: string,
    startsAt: Date,
    endsAt: Date,
    source: OccupancySource,
    opts: { bookingId?: string; icalSourceId?: string; note?: string } = {},
  ) {
    try {
      return await this.prisma.blockedTerm.create({
        data: {
          listingId,
          startsAt,
          endsAt,
          source,
          bookingId: opts.bookingId,
          icalSourceId: opts.icalSourceId,
          note: opts.note,
        },
      });
    } catch (err) {
      if (isExclusionViolation(err)) {
        throw new ConflictException(this.i18n.t('errors.TERM_NOT_AVAILABLE'));
      }
      throw err;
    }
  }

  async releaseTerm(blockedTermId: string) {
    await this.prisma.blockedTerm.delete({ where: { id: blockedTermId } }).catch(() => undefined);
  }

  async releaseTermsForBooking(bookingId: string) {
    await this.prisma.blockedTerm.deleteMany({ where: { bookingId } });
  }

  /**
   * Applies R70 — an obligatory gap immediately after a booking's own term.
   * The gap carries the booking's id, so releaseTermsForBooking() frees it
   * with the term when the booking is rejected, cancelled or expires.
   */
  async applyGapAfter(listingId: string, bookingId: string, bookingEnd: Date, gapMinutes: number) {
    if (gapMinutes <= 0) return;
    const gapEnd = new Date(bookingEnd.getTime() + gapMinutes * 60000);
    try {
      await this.prisma.blockedTerm.create({
        data: { listingId, bookingId, startsAt: bookingEnd, endsAt: gapEnd, source: 'GAP' },
      });
    } catch (err) {
      // A gap colliding with something else is a soft problem, not fatal to the booking itself.
      if (!isExclusionViolation(err)) throw err;
    }
  }

  // -- Public / owner reads ---------------------------------------------

  /**
   * T140: only what the listing is booked by right now: working hours and
   * their prices, or the defined slots, or a stay's date prices. Rows another
   * mode left behind never reach the listing, the booking card, the request
   * page or the wizard's editors. Blocked terms apply to every mode.
   */
  async getAvailability(listingId: string, from: Date, to: Date) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { bookingModel: true, slotSubmode: true },
    });
    const hours = !!listing && isWorkingHoursSetup(listing);
    const slots = !!listing && isDefinedSlotsSetup(listing);
    const stay = listing?.bookingModel === 'PER_STAY';
    const none = <T>(): Promise<T[]> => Promise.resolve([]);
    const [blocked, workingHours, hourlyPriceRanges, definedSlots, datePriceOverrides, slotPriceOverrides] =
      await Promise.all([
        this.prisma.blockedTerm.findMany({
          where: { listingId, startsAt: { lt: to }, endsAt: { gt: from } },
          select: { id: true, startsAt: true, endsAt: true, source: true },
        }),
        hours ? this.prisma.workingHours.findMany({ where: { listingId } }) : none<WorkingHours>(),
        hours
          ? this.prisma.hourlyPriceRange.findMany({ where: { listingId }, orderBy: { startTime: 'asc' } })
          : none<HourlyPriceRange>(),
        slots
          ? this.prisma.definedSlot.findMany({
              where: { listingId, startsAt: { gte: from, lt: to } },
              orderBy: { startsAt: 'asc' },
            })
          : none<DefinedSlot>(),
        stay
          ? this.prisma.datePriceOverride.findMany({
              where: { listingId, date: { gte: from, lt: to } },
              orderBy: { date: 'asc' },
            })
          : none<DatePriceOverride>(),
        hours
          ? this.prisma.slotPriceOverride.findMany({
              where: { listingId, date: { gte: from, lt: to } },
              orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
            })
          : none<SlotPriceOverride>(),
      ]);
    return {
      blocked,
      workingHours,
      hourlyPriceRanges: hourlyPriceRanges.map((r) => ({ ...r, price: paraToRsd(r.price) })),
      definedSlots: definedSlots.map((s) => ({ ...s, price: paraToRsd(s.price) })),
      datePriceOverrides: datePriceOverrides.map((o) => ({ date: o.date, price: paraToRsd(o.price) })),
      slotPriceOverrides: slotPriceOverrides.map((o) => ({ ...o, price: paraToRsd(o.price) })),
    };
  }

  // -- Owner management ----------------------------------------------------

  /** T84 — applies immediately regardless of listing status; edit moderation was removed. */
  async setWorkingHours(userId: string, listingId: string, dto: SetWorkingHoursDto) {
    this.assertBookedBy(await this.assertOwnership(userId, listingId), 'WORKING_HOURS');
    await this.prisma.$transaction([
      this.prisma.workingHours.deleteMany({ where: { listingId } }),
      this.prisma.workingHours.createMany({
        data: dto.hours.map((h) => ({ listingId, dayOfWeek: h.dayOfWeek, startsAt: h.startsAt, endsAt: h.endsAt })),
      }),
    ]);
    return { message: 'ok' };
  }

  /** T84 — applies immediately regardless of listing status; edit moderation was removed. */
  async createDefinedSlot(userId: string, listingId: string, dto: CreateDefinedSlotDto) {
    this.assertBookedBy(await this.assertOwnership(userId, listingId), 'DEFINED_SLOTS');
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    // T105 — "Kopiraj termin" (manual multi-select or the weekly "Ponavljaj"
    // helper) can land on a date that already has this exact term; create
    // everything else it asked for but refuse to silently double the one
    // that collides; the owner needs to know which date, not just that
    // "something" failed.
    const duplicate = await this.prisma.definedSlot.findFirst({ where: { listingId, startsAt, endsAt } });
    if (duplicate) {
      const isEn = I18nContext.current()?.lang === 'en';
      throw new ConflictException(
        this.i18n.t('errors.DEFINED_SLOT_DUPLICATE', {
          args: {
            date: startsAt.toLocaleDateString(isEn ? 'en-US' : 'sr-RS', { timeZone: 'Europe/Belgrade' }),
            startTime: toBelgradeHHMM(startsAt),
            endTime: toBelgradeHHMM(endsAt),
          },
        }),
      );
    }
    const slot = await this.prisma.definedSlot.create({
      data: {
        listingId,
        startsAt,
        endsAt,
        price: rsdToPara(dto.price),
        maxBookings: dto.maxBookings ?? 1,
      },
    });
    await this.refreshSlotPrice(listingId);
    return { ...slot, price: paraToRsd(slot.price) };
  }

  async deleteDefinedSlot(userId: string, listingId: string, slotId: string) {
    await this.assertOwnership(userId, listingId);
    await this.prisma.definedSlot.deleteMany({ where: { id: slotId, listingId } });
    await this.refreshSlotPrice(listingId);
    return { message: 'ok' };
  }

  /** T121: a slot added or removed can change the listing's "Od X RSD". */
  private async refreshSlotPrice(listingId: string) {
    const price = await lowestUpcomingSlotPrice(this.prisma, listingId);
    await this.prisma.listing.updateMany({
      where: { id: listingId, bookingModel: 'PER_SLOT', slotSubmode: 'DEFINED_SLOTS', price: { not: price } },
      data: { price },
    });
  }

  /**
   * T121: slots also pass, and with them a listing's lowest price ahead, so
   * every hour each listing on defined slots gets the price of its cheapest
   * slot still to come (0 once none is left, "Trenutno nema termina").
   */
  @Cron(CronExpression.EVERY_HOUR)
  async refreshDefinedSlotPrices() {
    const listings = await this.prisma.listing.findMany({
      where: { bookingModel: 'PER_SLOT', slotSubmode: 'DEFINED_SLOTS', status: { not: 'DELETED' } },
      select: { id: true, price: true },
    });
    if (!listings.length) return;
    const lowest = await this.prisma.definedSlot.groupBy({
      by: ['listingId'],
      where: { listingId: { in: listings.map((l) => l.id) }, startsAt: { gt: new Date() }, price: { not: null } },
      _min: { price: true },
    });
    const lowestByListing = new Map(lowest.map((row) => [row.listingId, row._min.price ?? 0n]));
    for (const listing of listings) {
      const price = lowestByListing.get(listing.id) ?? 0n;
      if (price !== listing.price) await this.prisma.listing.update({ where: { id: listing.id }, data: { price } });
    }
  }

  async createManualBlock(userId: string, listingId: string, dto: CreateManualBlockDto) {
    await this.assertOwnership(userId, listingId);
    return this.lockTerm(listingId, new Date(dto.startsAt), new Date(dto.endsAt), 'MANUAL', { note: dto.note });
  }

  async deleteManualBlock(userId: string, listingId: string, blockedTermId: string) {
    await this.assertOwnership(userId, listingId);
    const term = await this.prisma.blockedTerm.findFirst({ where: { id: blockedTermId, listingId } });
    if (!term || term.source !== 'MANUAL') throw new NotFoundException();
    await this.releaseTerm(blockedTermId);
    return { message: 'ok' };
  }

  /**
   * RNT-029 — per-date price override for PER_STAY listings, the "svaki
   * datum posebno mozes setovati cenu ili blokirati" ask from the owner's
   * audit decision. Upsert so re-setting the same date just changes the
   * price instead of erroring on the unique(listingId, date) constraint.
   */
  async setDatePrice(userId: string, listingId: string, dto: SetDatePriceDto) {
    this.assertBookedBy(await this.assertOwnership(userId, listingId), 'STAY');
    const date = new Date(`${dto.date}T00:00:00.000Z`);
    const override = await this.prisma.datePriceOverride.upsert({
      where: { listingId_date: { listingId, date } },
      create: { listingId, date, price: rsdToPara(dto.price) },
      update: { price: rsdToPara(dto.price) },
    });
    return { ...override, price: paraToRsd(override.price) };
  }

  async deleteDatePrice(userId: string, listingId: string, date: string) {
    await this.assertOwnership(userId, listingId);
    await this.prisma.datePriceOverride.deleteMany({ where: { listingId, date: new Date(`${date}T00:00:00.000Z`) } });
    return { message: 'ok' };
  }

  /**
   * "Po mesecu" pricing (Dodavanje Oglasa spec §3) reuses DatePriceOverride
   * exactly like day-level pricing does — the "date" is just the first of
   * the month, and setDatePrice/deleteDatePrice already work unmodified
   * (the frontend's month calendar just always passes a first-of-month
   * date). getNightlyPrices doesn't apply here since a monthly rate isn't
   * per-night; this is its month-count equivalent for booking creation.
   */
  async getMonthlyPrices(listingId: string, startMonth: Date, monthCount: number, basePrice: bigint): Promise<PricedUnit[]> {
    const monthStarts: Date[] = [];
    for (let i = 0; i < monthCount; i++) {
      monthStarts.push(new Date(Date.UTC(startMonth.getUTCFullYear(), startMonth.getUTCMonth() + i, 1)));
    }
    const overrides = await this.prisma.datePriceOverride.findMany({
      where: { listingId, date: { in: monthStarts } },
    });
    const overrideByMonth = new Map(overrides.map((o) => [o.date.toISOString().slice(0, 10), o.price]));
    return monthStarts.map((m) => {
      const override = overrideByMonth.get(m.toISOString().slice(0, 10));
      return override !== undefined ? { price: override, kind: 'SPECIAL' } : { price: basePrice, kind: 'BASE' };
    });
  }

  // -- PER_SLOT + WORKING_HOURS pricing ------------------------------------

  /** "Različita cena po delu radnog vremena" — full replace, same pattern as setWorkingHours. */
  async setHourlyPriceRanges(userId: string, listingId: string, dto: SetHourlyPriceRangesDto) {
    this.assertBookedBy(await this.assertOwnership(userId, listingId), 'WORKING_HOURS');
    await this.prisma.$transaction([
      this.prisma.hourlyPriceRange.deleteMany({ where: { listingId } }),
      this.prisma.hourlyPriceRange.createMany({
        data: dto.ranges.map((r) => ({
          listingId,
          dayOfWeek: r.dayOfWeek ?? null,
          startTime: r.startTime,
          endTime: r.endTime,
          price: rsdToPara(r.price),
        })),
      }),
    ]);
    return { message: 'ok' };
  }

  /** "Posebna cena za određeni datum/vremenski interval" exception. */
  async setSlotPriceOverride(userId: string, listingId: string, dto: SetSlotPriceOverrideDto) {
    this.assertBookedBy(await this.assertOwnership(userId, listingId), 'WORKING_HOURS');
    const override = await this.prisma.slotPriceOverride.create({
      data: {
        listingId,
        date: new Date(`${dto.date}T00:00:00.000Z`),
        startTime: dto.startTime,
        endTime: dto.endTime,
        price: rsdToPara(dto.price),
      },
    });
    return { ...override, price: paraToRsd(override.price) };
  }

  async deleteSlotPriceOverride(userId: string, listingId: string, overrideId: string) {
    await this.assertOwnership(userId, listingId);
    await this.prisma.slotPriceOverride.deleteMany({ where: { id: overrideId, listingId } });
    return { message: 'ok' };
  }

  /**
   * T127: the price of each hour of a working-hours booking, so a term that
   * runs from one part of the working hours into another pays each hour at
   * its own rate (it used to pay every hour at the start's). All hours count
   * to the day the term starts on: a Saturday evening that runs past
   * midnight keeps Saturday's ranges, special prices and weekend price.
   */
  async getWorkingHoursPrices(
    listingId: string,
    startsAt: Date,
    endsAt: Date,
    basePrice: bigint,
    weekendPrice: bigint | null,
  ): Promise<PricedUnit[]> {
    // T72: raw UTC getters read a booking's calendar day back shifted by
    // the Belgrade offset (e.g. a late-evening booking rolling into the next
    // UTC day), missing a same-day SlotPriceOverride; SlotPriceOverride.date
    // is itself a Belgrade calendar day, so both sides need the same zone.
    const dateOnly = toBelgradeDateOnly(startsAt);
    const dayOfWeek = toBelgradeISODayOfWeek(startsAt);
    const { overrides, ranges } = await this.loadHourlyPriceRules(listingId, dateOnly);
    const prices: PricedUnit[] = [];
    for (let time = startsAt.getTime(); time < endsAt.getTime(); time += 3600_000) {
      prices.push(pickHourlyPrice(overrides, ranges, dayOfWeek, toBelgradeHHMM(new Date(time)), basePrice, weekendPrice));
    }
    return prices;
  }

  private async loadHourlyPriceRules(listingId: string, dateOnly: Date) {
    const [overrides, ranges] = await Promise.all([
      this.prisma.slotPriceOverride.findMany({ where: { listingId, date: dateOnly } }),
      this.prisma.hourlyPriceRange.findMany({ where: { listingId } }),
    ]);
    return { overrides, ranges };
  }

  /**
   * T127: whether a term lies inside one of the listing's working-hour
   * windows, in Belgrade time. A window that ends at or before it opens runs
   * past midnight (T104), so the day before the term's start counts too.
   */
  async fitsWorkingHours(listingId: string, startsAt: Date, endsAt: Date): Promise<boolean> {
    const rows = await this.prisma.workingHours.findMany({ where: { listingId } });
    const startDay = toBelgradeDateOnly(startsAt);
    for (const dayOffset of [0, -1]) {
      const day = new Date(startDay.getTime() + dayOffset * 86_400_000);
      const dayOfWeek = ((day.getUTCDay() + 6) % 7) + 1;
      for (const row of rows.filter((r) => r.dayOfWeek === dayOfWeek)) {
        const closingDay = row.endsAt <= row.startsAt ? new Date(day.getTime() + 86_400_000) : day;
        const opens = belgradeWallClock(day, row.startsAt);
        const closes = belgradeWallClock(closingDay, row.endsAt);
        if (opens <= startsAt && endsAt <= closes) return true;
      }
    }
    return false;
  }

  /** Per-night price for a PER_STAY booking spanning [startsAt, endsAt) — override where set, weekend/base price otherwise. */
  async getNightlyPrices(
    listingId: string,
    startsAt: Date,
    endsAt: Date,
    basePrice: bigint,
    weekendPrice: bigint | null,
  ): Promise<PricedUnit[]> {
    const overrides = await this.prisma.datePriceOverride.findMany({
      where: { listingId, date: { gte: startsAt, lt: endsAt } },
    });
    const overrideByDate = new Map(overrides.map((o) => [o.date.toISOString().slice(0, 10), o.price]));

    const prices: PricedUnit[] = [];
    for (let d = new Date(startsAt); d < endsAt; d.setUTCDate(d.getUTCDate() + 1)) {
      const isWeekend = d.getUTCDay() === 5 || d.getUTCDay() === 6; // Fri/Sat night
      prices.push(datePricedUnit(overrideByDate.get(d.toISOString().slice(0, 10)), isWeekend, basePrice, weekendPrice));
    }
    return prices;
  }

  /**
   * Dizajn 33: the address is fetched before it is kept, so a typo or a page
   * that isn't a calendar is refused on the spot, and a good feed is imported
   * right away instead of at the next hourly run.
   */
  async addIcalSource(userId: string, listingId: string, dto: AddIcalSourceDto) {
    const listing = await this.assertOwnership(userId, listingId);
    const subscription = listing.subscriptionId
      ? await this.prisma.subscription.findUnique({ where: { id: listing.subscriptionId }, include: { package: true } })
      : null;
    // R67 + Dodavanje Oglasa spec §3: iCal only applies to PER_STAY listings
    // billed by DAY/NIGHT; "Po mesecu" books in whole calendar months, which
    // an external calendar sync can't meaningfully express. Ch.11.2: iCal
    // sync isn't included on the Osnovni/BASIC package.
    switch (getIcalAvailability(listing, !!subscription?.package.hasIcal)) {
      case 'NOT_STAY':
        throw new BadRequestException(this.i18n.t('errors.LISTING_NOT_BOOKABLE'));
      case 'NOT_PUBLISHED':
        throw new BadRequestException(this.i18n.t('errors.ICAL_LISTING_NOT_ACTIVE'));
      case 'NO_ICAL_PACKAGE':
        throw new ForbiddenException(this.i18n.t('errors.PACKAGE_FEATURE_NOT_INCLUDED'));
    }

    const url = normalizeIcalUrl(dto.url);
    // Its own feed would come back as a conflict with every one of its bookings.
    if (listing.icalExportToken && url.includes(listing.icalExportToken)) {
      throw new BadRequestException(this.i18n.t('errors.ICAL_SOURCE_OWN_FEED'));
    }
    if (await this.prisma.icalSource.findFirst({ where: { listingId, url }, select: { id: true } })) {
      throw new ConflictException(this.i18n.t('errors.ICAL_SOURCE_DUPLICATE'));
    }

    let text: string;
    try {
      text = await fetchIcalFeed(url, this.allowPrivateFeedAddresses);
    } catch (err) {
      // An address inside the server's network reads as unreachable, so the answer can't be used to map it.
      if (err instanceof NonPublicAddressError) {
        this.logger.warn(`Refused an iCal address on a non-public host (${err.host}) for listing ${listingId}`);
      }
      const notCalendar = (err as Error).message === ICAL_NOT_CALENDAR;
      throw new BadRequestException(this.i18n.t(notCalendar ? 'errors.ICAL_URL_NOT_CALENDAR' : 'errors.ICAL_URL_UNREACHABLE'));
    }

    const source = await this.prisma.icalSource.create({
      data: { listingId, name: dto.name?.trim() || icalSourceName(url), url },
    });
    await this.syncIcalSource(source.id, text);
    return serializeIcalSource(await this.prisma.icalSource.findUniqueOrThrow({ where: { id: source.id } }));
  }

  async removeIcalSource(userId: string, listingId: string, sourceId: string) {
    await this.assertOwnership(userId, listingId);
    // Dizajn 33: the imported dates used to be deleted by source id alone, so
    // any owner could clear another listing's; the source has to be this listing's.
    const source = await this.prisma.icalSource.findFirst({ where: { id: sourceId, listingId }, select: { id: true } });
    if (!source) throw new NotFoundException(this.i18n.t('errors.ICAL_SOURCE_NOT_FOUND'));
    await this.prisma.$transaction([
      this.prisma.icalOccupancy.deleteMany({ where: { sourceId } }),
      this.prisma.blockedTerm.deleteMany({ where: { icalSourceId: sourceId } }),
      this.prisma.icalSource.delete({ where: { id: sourceId } }),
    ]);
    return { message: 'ok' };
  }

  async listIcalSources(userId: string, listingId: string) {
    await this.assertOwnership(userId, listingId);
    const sources = await this.prisma.icalSource.findMany({ where: { listingId }, orderBy: [{ name: 'asc' }, { url: 'asc' }] });
    return sources.map(serializeIcalSource);
  }

  /**
   * Dizajn 33 (frame 572:641): everything the listing's iCal page shows, the
   * breadcrumb, the export feed and the connected calendars, or why the
   * listing can't use them yet.
   */
  async getIcalOverview(userId: string, listingId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: {
        city: { select: { name: true } },
        cityArea: { select: { name: true } },
        subscription: { select: { package: { select: { hasIcal: true } } } },
      },
    });
    if (!listing || listing.status === 'DELETED') throw new NotFoundException(this.i18n.t('errors.LISTING_NOT_FOUND'));
    if (listing.userId !== userId) throw new ForbiddenException();

    const availability = getIcalAvailability(listing, !!listing.subscription?.package.hasIcal);
    let exportToken: string | null = null;
    let sources: IcalSource[] = [];
    if (availability === 'AVAILABLE') {
      // Stays get a token when they are created; one that somehow has none gets it here.
      exportToken =
        listing.icalExportToken ??
        (await this.prisma.listing.update({ where: { id: listingId }, data: { icalExportToken: crypto.randomUUID() } })).icalExportToken;
      sources = await this.prisma.icalSource.findMany({ where: { listingId }, orderBy: [{ name: 'asc' }, { url: 'asc' }] });
    }

    return {
      listing: {
        id: listing.id,
        title: listing.title,
        status: listing.status,
        cityName: listing.city?.name ?? null,
        cityAreaName: listing.cityArea?.name ?? null,
      },
      availability,
      exportToken,
      sources: sources.map(serializeIcalSource),
    };
  }

  /**
   * R64 — every bookable listing has a stable export feed for the owner to
   * paste into Airbnb/Booking.com. Exports every current BlockedTerm
   * regardless of source (a REQUESTED booking already locks its term per
   * R53, same as MANUAL blocks and inbound ICAL imports) — this is what
   * makes the feed a genuine two-way sync hub rather than only ever
   * reflecting Rentaj's own confirmed bookings.
   */
  async exportIcs(token: string): Promise<string> {
    const listing = await this.prisma.listing.findUnique({ where: { icalExportToken: token } });
    if (!listing) throw new NotFoundException();
    const blocked = await this.prisma.blockedTerm.findMany({
      where: { listingId: listing.id, endsAt: { gt: new Date() } },
      select: { id: true, startsAt: true, endsAt: true },
    });
    return buildIcsCalendar(
      blocked.map((b) => ({ uid: `rentaj-block-${b.id}`, startsAt: b.startsAt, endsAt: b.endsAt, summary: 'Rezervisano' })),
    );
  }

  // -- Sync job ------------------------------------------------------------

  /** R65/R68/R69 — pulls every active iCal source every hour; conflicts raise a dispute instead of auto-cancelling anything. */
  @Cron(CronExpression.EVERY_HOUR)
  async syncAllIcalSources() {
    const sources = await this.prisma.icalSource.findMany({ where: { active: true } });
    for (const source of sources) {
      await this.syncIcalSource(source.id).catch((err) => this.logger.warn(`iCal sync failed for ${source.id}: ${err.message}`));
    }
  }

  /** `feedText` is the feed addIcalSource has just fetched, so it isn't fetched twice. */
  async syncIcalSource(sourceId: string, feedText?: string) {
    const source = await this.prisma.icalSource.findUniqueOrThrow({ where: { id: sourceId } });
    let text: string;
    try {
      text = feedText ?? (await fetchIcalFeed(source.url, this.allowPrivateFeedAddresses));
    } catch (err) {
      if (err instanceof NonPublicAddressError) {
        this.logger.warn(`iCal source ${sourceId} points at a non-public host (${err.host}); not fetched`);
      }
      const failureCount = source.failureCount + 1;
      await this.prisma.icalSource.update({
        where: { id: sourceId },
        data: { failureCount, lastError: (err as Error).message },
      });
      if (failureCount >= ICAL_FAILURE_ALERT_THRESHOLD) {
        this.events.emit('availability.ical_sync_failed', { listingId: source.listingId, sourceId });
      }
      return;
    }

    const events = parseIcs(text);
    const existing = await this.prisma.icalOccupancy.findMany({ where: { sourceId, withdrawnAt: null } });
    const existingByUid = new Map(existing.map((e) => [e.externalUid, e]));
    const seenUids = new Set<string>();

    for (const event of events) {
      seenUids.add(event.uid);
      if (existingByUid.has(event.uid)) continue; // already imported

      const occupancy = await this.prisma.icalOccupancy.create({
        data: { sourceId, externalUid: event.uid, startsAt: event.startsAt, endsAt: event.endsAt },
      });
      try {
        await this.lockTerm(source.listingId, event.startsAt, event.endsAt, 'ICAL', { icalSourceId: sourceId });
      } catch {
        // R68: conflict with an existing request/booking — flag for the owner, don't touch the existing booking.
        await this.prisma.dispute.create({
          data: {
            type: 'TERM_CONFLICT',
            listingId: source.listingId,
            submittedByUserId: (await this.prisma.listing.findUniqueOrThrow({ where: { id: source.listingId } })).userId,
            description: `Imported calendar event ${event.uid} overlaps an existing booking`,
          },
        });
        this.events.emit('availability.ical_conflict', { listingId: source.listingId, sourceId });
        await this.prisma.icalOccupancy.update({ where: { id: occupancy.id }, data: { withdrawnAt: new Date() } });
      }
    }

    // R "uvezeno zauzece nestane sa spoljne platforme" — release anything no longer in the feed.
    for (const occ of existing) {
      if (!seenUids.has(occ.externalUid)) {
        await this.prisma.blockedTerm.deleteMany({ where: { icalSourceId: sourceId, source: 'ICAL', startsAt: occ.startsAt, endsAt: occ.endsAt } });
        await this.prisma.icalOccupancy.update({ where: { id: occ.id }, data: { withdrawnAt: new Date() } });
      }
    }

    await this.prisma.icalSource.update({
      where: { id: sourceId },
      data: { lastSyncedAt: new Date(), failureCount: 0, lastError: null },
    });
  }

  // -- Internal --------------------------------------------------------

  private async assertOwnership(userId: string, listingId: string) {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundException();
    if (listing.userId !== userId) throw new ForbiddenException();
    return listing;
  }

  /**
   * T140: a mode's terms and prices are written only while the listing is
   * saved with that mode, so nothing lands where the guest never looks (the
   * wizard asks for step 2 to be saved first). Blocked dates fit every mode.
   */
  private assertBookedBy(listing: Listing, mode: 'WORKING_HOURS' | 'DEFINED_SLOTS' | 'STAY') {
    const matches =
      mode === 'STAY'
        ? listing.bookingModel === 'PER_STAY'
        : listing.bookingModel === 'PER_SLOT' && listing.slotSubmode === mode;
    if (!matches) throw new BadRequestException(this.i18n.t('errors.AVAILABILITY_MODE_NOT_SAVED'));
  }
}

/**
 * Whether an HH:MM window covers a clock time. A window that ends at or
 * before its start runs past midnight, as working hours do (T104); before
 * T127 such a price range or special price never matched any hour.
 */
function coversTime(startTime: string, endTime: string, time: string): boolean {
  return startTime < endTime ? startTime <= time && time < endTime : time >= startTime || time < endTime;
}

/**
 * The price of one working-hours hour: the date's special price for that
 * time, then the price for that part of the working hours (a range of that
 * weekday before one of every day, T104), then the weekend price on a Friday
 * or Saturday (Dizajn 21, the hourly rate only), else the base price. HH:MM
 * strings compare lexically, which is safe since they're always zero-padded
 * 24h (the DTO pattern /^([01]\d|2[0-3]):[0-5]\d$/).
 */
function pickHourlyPrice(
  overrides: Array<{ startTime: string; endTime: string; price: bigint }>,
  ranges: Array<{ dayOfWeek: number | null; startTime: string; endTime: string; price: bigint }>,
  dayOfWeek: number,
  time: string,
  basePrice: bigint,
  weekendPrice: bigint | null,
): PricedUnit {
  const override = overrides.find((o) => coversTime(o.startTime, o.endTime, time));
  if (override) return { price: override.price, kind: 'SPECIAL' };
  const daySpecific = ranges.find((r) => r.dayOfWeek === dayOfWeek && coversTime(r.startTime, r.endTime, time));
  if (daySpecific) return { price: daySpecific.price, kind: 'RANGE' };
  const shared = ranges.find((r) => r.dayOfWeek === null && coversTime(r.startTime, r.endTime, time));
  if (shared) return { price: shared.price, kind: 'RANGE' };
  const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
  return isWeekend && weekendPrice ? { price: weekendPrice, kind: 'WEEKEND' } : { price: basePrice, kind: 'BASE' };
}

/** A date's own price first, then the weekend price on a Friday or Saturday, then the base price. */
function datePricedUnit(override: bigint | undefined, isWeekend: boolean, basePrice: bigint, weekendPrice: bigint | null): PricedUnit {
  if (override !== undefined) return { price: override, kind: 'SPECIAL' };
  return isWeekend && weekendPrice ? { price: weekendPrice, kind: 'WEEKEND' } : { price: basePrice, kind: 'BASE' };
}

function isExclusionViolation(err: unknown): boolean {
  const message = (err as { message?: string })?.message ?? '';
  const meta = (err as { meta?: { message?: string } })?.meta?.message ?? '';
  return (
    message.includes('blocked_term_no_overlap') ||
    meta.includes('blocked_term_no_overlap') ||
    message.includes('exclusion') ||
    meta.includes('exclusion')
  );
}
