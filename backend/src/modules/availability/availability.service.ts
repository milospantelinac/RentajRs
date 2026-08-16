import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Logger } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { OccupancySource } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { parseIcs, buildIcsCalendar } from '../../common/utils/ics';
import { paraToRsd, rsdToPara } from '../../common/utils/money';
import {
  SetWorkingHoursDto,
  CreateDefinedSlotDto,
  CreateManualBlockDto,
  SetDatePriceDto,
  AddIcalSourceDto,
} from './dto/availability.dto';

@Injectable()
export class AvailabilityService {
  private readonly logger = new Logger(AvailabilityService.name);

  constructor(
    private prisma: PrismaService,
    private events: EventEmitter2,
    private i18n: I18nService,
  ) {}

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

  /** Applies R70 — an obligatory gap immediately after a booking's own term. */
  async applyGapAfter(listingId: string, bookingEnd: Date, gapMinutes: number) {
    if (gapMinutes <= 0) return;
    const gapEnd = new Date(bookingEnd.getTime() + gapMinutes * 60000);
    try {
      await this.prisma.blockedTerm.create({
        data: { listingId, startsAt: bookingEnd, endsAt: gapEnd, source: 'GAP' },
      });
    } catch (err) {
      // A gap colliding with something else is a soft problem, not fatal to the booking itself.
      if (!isExclusionViolation(err)) throw err;
    }
  }

  // -- Public / owner reads ---------------------------------------------

  async getAvailability(listingId: string, from: Date, to: Date) {
    const [blocked, workingHours, definedSlots, datePriceOverrides] = await Promise.all([
      this.prisma.blockedTerm.findMany({
        where: { listingId, startsAt: { lt: to }, endsAt: { gt: from } },
        select: { id: true, startsAt: true, endsAt: true, source: true },
      }),
      this.prisma.workingHours.findMany({ where: { listingId } }),
      this.prisma.definedSlot.findMany({
        where: { listingId, startsAt: { gte: from, lt: to } },
        orderBy: { startsAt: 'asc' },
      }),
      this.prisma.datePriceOverride.findMany({
        where: { listingId, date: { gte: from, lt: to } },
        orderBy: { date: 'asc' },
      }),
    ]);
    return {
      blocked,
      workingHours,
      definedSlots: definedSlots.map((s) => ({ ...s, price: paraToRsd(s.price) })),
      datePriceOverrides: datePriceOverrides.map((o) => ({ date: o.date, price: paraToRsd(o.price) })),
    };
  }

  // -- Owner management ----------------------------------------------------

  /**
   * R31/R32 — on an ACTIVE listing, working hours only take effect once an
   * admin approves the edit; the currently-published hours stay bookable in
   * the meantime (same guarantee as title/photos/location). Staged as JSON
   * on the pending ListingVersion rather than a new column, matching how
   * ListingsService already stages a photo reorder.
   */
  async setWorkingHours(userId: string, listingId: string, dto: SetWorkingHoursDto) {
    const listing = await this.assertOwnership(userId, listingId);
    if (listing.status === 'ACTIVE') {
      await this.queueAvailabilityEdit(listingId, { workingHoursPending: dto.hours });
      return { message: 'ok', pending: true };
    }
    await this.prisma.$transaction([
      this.prisma.workingHours.deleteMany({ where: { listingId } }),
      this.prisma.workingHours.createMany({
        data: dto.hours.map((h) => ({ listingId, dayOfWeek: h.dayOfWeek, startsAt: h.startsAt, endsAt: h.endsAt })),
      }),
    ]);
    return { message: 'ok' };
  }

  /** Same R31/R32 rule as setWorkingHours — a new slot on a live listing isn't bookable until approved. */
  async createDefinedSlot(userId: string, listingId: string, dto: CreateDefinedSlotDto) {
    const listing = await this.assertOwnership(userId, listingId);
    if (listing.status === 'ACTIVE') {
      const current = await this.getPendingChangedFields(listingId);
      const pendingSlotsAdd = [
        ...(Array.isArray(current.pendingSlotsAdd) ? current.pendingSlotsAdd : []),
        { startsAt: dto.startsAt, endsAt: dto.endsAt, price: dto.price ?? null, maxBookings: dto.maxBookings ?? 1 },
      ];
      await this.queueAvailabilityEdit(listingId, { pendingSlotsAdd });
      return { message: 'ok', pending: true };
    }
    const slot = await this.prisma.definedSlot.create({
      data: {
        listingId,
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(dto.endsAt),
        price: dto.price ? rsdToPara(dto.price) : undefined,
        maxBookings: dto.maxBookings ?? 1,
      },
    });
    return { ...slot, price: paraToRsd(slot.price) };
  }

  async deleteDefinedSlot(userId: string, listingId: string, slotId: string) {
    await this.assertOwnership(userId, listingId);
    await this.prisma.definedSlot.deleteMany({ where: { id: slotId, listingId } });
    return { message: 'ok' };
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
    await this.assertOwnership(userId, listingId);
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

  /** Per-night price for a PER_STAY booking spanning [startsAt, endsAt) — override where set, weekend/base price otherwise. */
  async getNightlyPrices(listingId: string, startsAt: Date, endsAt: Date, basePrice: bigint, weekendPrice: bigint | null) {
    const overrides = await this.prisma.datePriceOverride.findMany({
      where: { listingId, date: { gte: startsAt, lt: endsAt } },
    });
    const overrideByDate = new Map(overrides.map((o) => [o.date.toISOString().slice(0, 10), o.price]));

    const prices: bigint[] = [];
    for (let d = new Date(startsAt); d < endsAt; d.setUTCDate(d.getUTCDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      const isWeekend = d.getUTCDay() === 5 || d.getUTCDay() === 6; // Fri/Sat night
      prices.push(overrideByDate.get(key) ?? (isWeekend && weekendPrice ? weekendPrice : basePrice));
    }
    return prices;
  }

  async addIcalSource(userId: string, listingId: string, dto: AddIcalSourceDto) {
    const listing = await this.assertOwnership(userId, listingId);
    if (listing.bookingModel !== 'PER_STAY') {
      // R67 — iCal only applies to per-stay listings
      throw new BadRequestException(this.i18n.t('errors.LISTING_NOT_BOOKABLE'));
    }
    // Ch.11.2 — iCal sync isn't included on the Osnovni/BASIC package.
    const subscription = listing.subscriptionId
      ? await this.prisma.subscription.findUnique({ where: { id: listing.subscriptionId }, include: { package: true } })
      : null;
    if (!subscription?.package.hasIcal) {
      throw new ForbiddenException(this.i18n.t('errors.PACKAGE_FEATURE_NOT_INCLUDED'));
    }
    return this.prisma.icalSource.create({ data: { listingId, name: dto.name, url: dto.url } });
  }

  async removeIcalSource(userId: string, listingId: string, sourceId: string) {
    await this.assertOwnership(userId, listingId);
    await this.prisma.icalOccupancy.deleteMany({ where: { sourceId } });
    await this.prisma.blockedTerm.deleteMany({ where: { icalSourceId: sourceId } });
    await this.prisma.icalSource.deleteMany({ where: { id: sourceId, listingId } });
    return { message: 'ok' };
  }

  async listIcalSources(userId: string, listingId: string) {
    await this.assertOwnership(userId, listingId);
    return this.prisma.icalSource.findMany({ where: { listingId } });
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

  async syncIcalSource(sourceId: string) {
    const source = await this.prisma.icalSource.findUniqueOrThrow({ where: { id: sourceId } });
    let text: string;
    try {
      const response = await fetch(source.url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      text = await response.text();
    } catch (err) {
      const failureCount = source.failureCount + 1;
      await this.prisma.icalSource.update({
        where: { id: sourceId },
        data: { failureCount, lastError: (err as Error).message },
      });
      if (failureCount >= 3) {
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

  /** Same pending-version mechanism ListingsService uses for title/photos — see its queueModeratedChange(). */
  private async queueAvailabilityEdit(listingId: string, patch: Record<string, unknown>) {
    const existing = await this.prisma.listingVersion.findFirst({ where: { listingId, status: 'PENDING' } });
    if (existing) {
      const merged = { ...(existing.changedFields as Record<string, unknown>), ...patch };
      await this.prisma.listingVersion.update({ where: { id: existing.id }, data: { changedFields: merged as any } });
      this.events.emit('listing.edit_submitted', { listingId, versionId: existing.id });
      return existing.id;
    }
    const created = await this.prisma.listingVersion.create({ data: { listingId, changedFields: patch as any } });
    this.events.emit('listing.edit_submitted', { listingId, versionId: created.id });
    return created.id;
  }

  private async getPendingChangedFields(listingId: string): Promise<Record<string, unknown>> {
    const existing = await this.prisma.listingVersion.findFirst({ where: { listingId, status: 'PENDING' } });
    return (existing?.changedFields as Record<string, unknown>) ?? {};
  }

  private async assertOwnership(userId: string, listingId: string) {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundException();
    if (listing.userId !== userId) throw new ForbiddenException();
    return listing;
  }
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
