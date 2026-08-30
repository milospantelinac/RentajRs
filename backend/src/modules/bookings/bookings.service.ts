import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { Booking, BookingStatus, Prisma, PriceUnit } from '@prisma/client';
import * as QRCode from 'qrcode';
import { PrismaService } from '../../prisma/prisma.service';
import { AvailabilityService } from '../availability/availability.service';
import { buildIpsQrPayload } from '../../common/utils/ips-qr';
import { paraToRsd, rsdToPara } from '../../common/utils/money';
import { CreateBookingRequestDto } from './dto/create-booking-request.dto';
import { CancelBookingDto, DisputeNoShowDto, RejectBookingDto } from './dto/booking-actions.dto';

@Injectable()
export class BookingsService {
  constructor(
    private prisma: PrismaService,
    private availability: AvailabilityService,
    private i18n: I18nService,
    private events: EventEmitter2,
  ) {}

  // -- Guest: create request -----------------------------------------

  async createRequest(guestId: string, listingId: string, dto: CreateBookingRequestDto) {
    const listing = await this.prisma.listing.findUniqueOrThrow({
      where: { id: listingId },
      include: { subscription: { include: { package: true } } },
    });

    // T46 — R126's "email must be confirmed" gate used to apply here too;
    // the owner asked for it to be dropped specifically for booking requests
    // (it still applies to publishing a listing, see ListingsService).
    const guest = await this.prisma.user.findUniqueOrThrow({ where: { id: guestId } });
    // Ch.6.7/ADR-019 — a RESTRICTION dispute outcome temporarily blocks new bookings too.
    if (guest.restrictedUntil && guest.restrictedUntil.getTime() > Date.now()) {
      throw new ForbiddenException(this.i18n.t('errors.ACCOUNT_RESTRICTED'));
    }

    if (listing.status !== 'ACTIVE') throw new BadRequestException(this.i18n.t('errors.LISTING_NOT_BOOKABLE'));
    if (listing.bookingModel === 'NO_BOOKING') throw new BadRequestException(this.i18n.t('errors.LISTING_NOT_BOOKABLE'));
    if (listing.userId === guestId) throw new BadRequestException(this.i18n.t('errors.CANNOT_BOOK_OWN_LISTING'));
    // Ch.11.2 — the Osnovni/BASIC package doesn't include the booking system
    // at all; a listing sitting on it must never accept a request even if
    // its bookingModel field says otherwise (e.g. after a downgrade).
    if (!listing.subscription?.package.hasBookings) {
      throw new ForbiddenException(this.i18n.t('errors.PACKAGE_FEATURE_NOT_INCLUDED'));
    }

    const { startsAt, endsAt, slotPrice } = await this.resolveRequestedTerm(listing, dto);
    // "Kapacitet ljudi" (Nekretnine/Sale za proslave/Igraonice wizard step 6)
    // is a separate CategoryAttribute from the generic minGuests/maxGuests
    // pair set in step 4 — an owner can fill in one without the other, so
    // guest-count validation has to honor whichever cap is actually set.
    const capacityAttr = await this.prisma.listingAttribute.findFirst({
      where: { listingId, attribute: { key: 'kapacitet_ljudi' } },
      select: { valueNumber: true },
    });
    const effectiveMaxGuests = capacityAttr?.valueNumber != null ? Number(capacityAttr.valueNumber) : listing.maxGuests;
    this.assertTermRules({ ...listing, maxGuests: effectiveMaxGuests }, startsAt, endsAt, dto.guestCount);

    const pricePerUnit = slotPrice ?? listing.price;
    // "Po mesecu" (Dodavanje Oglasa spec §3/§4) books in whole calendar
    // months the guest picked directly (monthCount), not an approximation
    // derived from the date span — Sep 1 to Dec 1 must be exactly 3, not
    // round(91/30).
    const unitCount = dto.monthCount ?? computeUnitCount(listing.priceUnit, startsAt, endsAt);
    const { unitPriceTotal, guestFee, mandatoryFeesTotal, extraServicesTotal, totalAmount, amountDue } =
      await this.computeTotals(listing, startsAt, endsAt, pricePerUnit, unitCount, slotPrice, dto);

    const booking = await this.prisma.booking.create({
      data: {
        listingId,
        guestId,
        ownerId: listing.userId,
        status: 'REQUESTED',
        startsAt,
        endsAt,
        guestCount: dto.guestCount,
        guestMessage: dto.guestMessage,
        priceUnit: listing.priceUnit,
        pricePerUnit,
        unitCount,
        fees: {
          mandatory: mandatoryFeesTotal.toString(),
          extraServices: dto.extraServices ?? [],
          guestFee: guestFee.toString(),
        } as unknown as Prisma.InputJsonValue,
        totalAmount,
        amountDue,
        paymentMethod: listing.paymentMethod ?? 'CASH',
        cancellationTermsSnapshot: formatCancellationPolicy(
          listing.cancellationPolicyType,
          listing.cancellationThreshold,
          guest.language,
        ),
      },
    });

    try {
      await this.availability.lockTerm(listingId, startsAt, endsAt, 'BOOKING', { bookingId: booking.id });
    } catch (err) {
      await this.prisma.booking.delete({ where: { id: booking.id } });
      throw err;
    }
    if (listing.gapAfterMinutes) {
      await this.availability.applyGapAfter(listingId, endsAt, listing.gapAfterMinutes);
    }

    await this.recordHistory(booking.id, null, 'REQUESTED', guestId, false);
    this.events.emit('booking.requested', { bookingId: booking.id });

    // R52: bank-transfer listings that don't require approval skip straight to AWAITING_PAYMENT.
    if (listing.paymentMethod !== 'CASH' && !listing.requiresApproval) {
      return this.moveToAwaitingPayment(booking, listing);
    }

    return this.serialize(booking);
  }

  private async resolveRequestedTerm(
    listing: { id: string; bookingModel: string; slotSubmode: string | null },
    dto: CreateBookingRequestDto,
  ): Promise<{ startsAt: Date; endsAt: Date; slotPrice?: bigint }> {
    if (dto.definedSlotId) {
      const slot = await this.prisma.definedSlot.findFirst({
        where: { id: dto.definedSlotId, listingId: listing.id },
      });
      if (!slot) throw new NotFoundException(this.i18n.t('errors.TERM_NOT_AVAILABLE'));
      return { startsAt: slot.startsAt, endsAt: slot.endsAt, slotPrice: slot.price ?? undefined };
    }
    // "Po mesecu" (Dodavanje Oglasa spec §3) — the guest picks a starting
    // month + a count of whole calendar months, never a free date range.
    if (dto.monthStart && dto.monthCount) {
      const [year, month] = dto.monthStart.split('-').map(Number);
      const startsAt = new Date(Date.UTC(year, month - 1, 1));
      const endsAt = new Date(Date.UTC(year, month - 1 + dto.monthCount, 1));
      return { startsAt, endsAt };
    }
    if (!dto.startsAt || !dto.endsAt) {
      throw new BadRequestException('startsAt/endsAt are required unless booking a defined slot or a month range');
    }
    return { startsAt: new Date(dto.startsAt), endsAt: new Date(dto.endsAt) };
  }

  private assertTermRules(
    listing: {
      minDuration: number | null;
      maxDuration: number | null;
      minGuests: number | null;
      maxGuests: number | null;
      earliestBookingHours: number | null;
      maxAdvanceBookingDays: number | null;
      priceUnit: PriceUnit;
    },
    startsAt: Date,
    endsAt: Date,
    guestCount?: number,
  ) {
    if (endsAt <= startsAt) throw new BadRequestException(this.i18n.t('bookings.END_BEFORE_START'));

    if (listing.earliestBookingHours) {
      const earliest = Date.now() + listing.earliestBookingHours * 3600_000;
      if (startsAt.getTime() < earliest) {
        throw new BadRequestException(this.i18n.t('bookings.TOO_SOON'));
      }
    }

    // "Koliko kasno može da se rezerviše" (Dodavanje Oglasa spec §4).
    if (listing.maxAdvanceBookingDays) {
      const latest = Date.now() + listing.maxAdvanceBookingDays * 86_400_000;
      if (startsAt.getTime() > latest) {
        throw new BadRequestException(
          this.i18n.t('bookings.TOO_FAR_AHEAD', { args: { max: listing.maxAdvanceBookingDays } }),
        );
      }
    }

    const unitCount = computeUnitCount(listing.priceUnit, startsAt, endsAt);
    if (listing.minDuration && unitCount < listing.minDuration) {
      throw new BadRequestException(
        this.i18n.t('bookings.MIN_DURATION', {
          args: { min: listing.minDuration, unit: durationUnitWord(listing.priceUnit, listing.minDuration) },
        }),
      );
    }
    if (listing.maxDuration && unitCount > listing.maxDuration) {
      throw new BadRequestException(
        this.i18n.t('bookings.MAX_DURATION', {
          args: { max: listing.maxDuration, unit: durationUnitWord(listing.priceUnit, listing.maxDuration) },
        }),
      );
    }

    if ((listing.minGuests || listing.maxGuests) && guestCount !== undefined) {
      const min = listing.minGuests ?? 1;
      const max = listing.maxGuests ?? Number.MAX_SAFE_INTEGER;
      if (guestCount < min || guestCount > max) {
        throw new BadRequestException(
          this.i18n.t('errors.GUEST_COUNT_OUT_OF_RANGE', { args: { min, max: listing.maxGuests ?? min } }),
        );
      }
    }
  }

  /**
   * T83 — the exact pricing logic createRequest uses to charge a booking,
   * extracted so quotePrice() (a live preview, nothing persisted) can never
   * drift from what a submitted request is actually charged.
   *
   * RNT-029 — per-stay (night/day) bookings price each date individually
   * (weekend price, or an owner's per-date override) rather than a flat
   * rate x nights; "Po mesecu" prices each calendar month individually the
   * same way; PER_SLOT + WORKING_HOURS resolves the owner's hourly rate
   * windows/exceptions for the booking's start time (a booking that spans
   * more than one rate window is billed at its start time's rate for the
   * whole duration — splitting one booking across rates isn't supported).
   * Every other combination keeps the flat unitPrice x unitCount calculation.
   */
  private async computeTotals(
    listing: {
      id: string;
      priceUnit: PriceUnit;
      price: bigint;
      weekendPrice: bigint | null;
      pricePerGuest: bigint | null;
      mandatoryFees: unknown;
      bookingModel: string;
      slotSubmode: string | null;
      advancePercent: number | null;
    },
    startsAt: Date,
    endsAt: Date,
    pricePerUnit: bigint,
    unitCount: number,
    slotPrice: bigint | undefined,
    dto: Pick<CreateBookingRequestDto, 'guestCount' | 'extraServices' | 'monthCount'>,
  ) {
    const extraServicesTotal = await this.resolveExtraServicesTotal(listing.id, dto.extraServices);
    const mandatoryFeesTotal = sumMandatoryFees(listing.mandatoryFees);
    const guestFee = listing.pricePerGuest && dto.guestCount ? listing.pricePerGuest * BigInt(dto.guestCount) : 0n;

    const unitPriceTotal =
      !slotPrice && (listing.priceUnit === 'NIGHT' || listing.priceUnit === 'DAY')
        ? (await this.availability.getNightlyPrices(listing.id, startsAt, endsAt, listing.price, listing.weekendPrice)).reduce(
            (sum, p) => sum + p,
            0n,
          )
        : !slotPrice && listing.priceUnit === 'MONTH' && dto.monthCount
          ? (await this.availability.getMonthlyPrices(listing.id, startsAt, dto.monthCount, listing.price)).reduce(
              (sum, p) => sum + p,
              0n,
            )
          : !slotPrice && listing.bookingModel === 'PER_SLOT' && listing.slotSubmode === 'WORKING_HOURS' && listing.priceUnit === 'HOUR'
            ? (await this.availability.resolveHourlyPrice(listing.id, startsAt, toHHMM(startsAt), listing.price)) *
              BigInt(unitCount)
            : pricePerUnit * BigInt(unitCount);

    const totalAmount = unitPriceTotal + guestFee + mandatoryFeesTotal + extraServicesTotal;
    const amountDue = listing.advancePercent ? (totalAmount * BigInt(listing.advancePercent)) / 100n : totalAmount;

    return { unitPriceTotal, guestFee, mandatoryFeesTotal, extraServicesTotal, totalAmount, amountDue };
  }

  /** T83 — live total for whatever the guest currently has selected, before they submit. Reads only, nothing persisted. */
  async quotePrice(listingId: string, dto: CreateBookingRequestDto) {
    const listing = await this.prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
    if (listing.bookingModel === 'NO_BOOKING') {
      throw new BadRequestException(this.i18n.t('errors.LISTING_NOT_BOOKABLE'));
    }
    const { startsAt, endsAt, slotPrice } = await this.resolveRequestedTerm(listing, dto);
    const pricePerUnit = slotPrice ?? listing.price;
    const unitCount = dto.monthCount ?? computeUnitCount(listing.priceUnit, startsAt, endsAt);
    const totals = await this.computeTotals(listing, startsAt, endsAt, pricePerUnit, unitCount, slotPrice, dto);
    return {
      priceUnit: listing.priceUnit,
      pricePerUnit: paraToRsd(pricePerUnit),
      unitCount,
      unitPriceTotal: paraToRsd(totals.unitPriceTotal),
      guestFee: paraToRsd(totals.guestFee),
      mandatoryFeesTotal: paraToRsd(totals.mandatoryFeesTotal),
      extraServicesTotal: paraToRsd(totals.extraServicesTotal),
      totalAmount: paraToRsd(totals.totalAmount),
      amountDue: paraToRsd(totals.amountDue),
    };
  }

  private async resolveExtraServicesTotal(
    listingId: string,
    selections?: Array<{ serviceId: string; quantity: number }>,
  ): Promise<bigint> {
    if (!selections?.length) return 0n;
    const services = await this.prisma.listingExtraService.findMany({
      where: { listingId, id: { in: selections.map((s) => s.serviceId) } },
    });
    let total = 0n;
    for (const selection of selections) {
      const service = services.find((s) => s.id === selection.serviceId);
      if (!service) continue;
      const max = service.maxQuantity ?? Infinity;
      const qty = Math.min(selection.quantity, max);
      total += service.price * BigInt(qty);
    }
    return total;
  }

  // -- Owner actions -----------------------------------------------------

  async approveRequest(ownerId: string, bookingId: string) {
    const booking = await this.assertOwnerAccess(ownerId, bookingId, ['REQUESTED']);
    const listing = await this.prisma.listing.findUniqueOrThrow({ where: { id: booking.listingId } });

    if (listing.paymentMethod === 'CASH') {
      // R181 — cash bookings confirm immediately, no payment-instructions email.
      const updated = await this.applyStatus(booking, 'CONFIRMED', ownerId, {
        paymentConfirmedAt: new Date(),
        phoneUnlocked: true,
      });
      this.events.emit('booking.confirmed', { bookingId: booking.id, viaCash: true });
      return updated;
    }
    return this.moveToAwaitingPayment(booking, listing);
  }

  private async moveToAwaitingPayment(booking: Booking, listing: { id: string; bankAccount?: string | null; userId: string; title: string; paymentDeadlineHours: number | null }) {
    const owner = await this.prisma.user.findUniqueOrThrow({ where: { id: listing.userId } });
    if (!owner.bankAccount) {
      throw new BadRequestException(this.i18n.t('bookings.OWNER_NO_BANK_ACCOUNT'));
    }
    const deadlineHours = listing.paymentDeadlineHours ?? 48;
    const paymentDeadline = new Date(Date.now() + deadlineHours * 3600_000);

    const qrPayload = buildIpsQrPayload({
      recipientAccount: owner.bankAccount,
      recipientName: `${owner.firstName} ${owner.lastName}`,
      amountRsd: paraToRsd(booking.amountDue) ?? 0,
      purpose: listing.title,
      referenceNumber: booking.id.replace(/-/g, '').slice(0, 20),
    });

    const updated = await this.prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'AWAITING_PAYMENT', paymentDeadline, ipsQrData: qrPayload },
    });
    await this.recordHistory(booking.id, booking.status, 'AWAITING_PAYMENT', null, true);
    this.events.emit('booking.awaiting_payment', { bookingId: booking.id });
    return this.serialize(updated);
  }

  async getIpsQrImage(userId: string, bookingId: string): Promise<string> {
    const booking = await this.prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    if (booking.guestId !== userId && booking.ownerId !== userId) throw new ForbiddenException();
    if (!booking.ipsQrData) throw new NotFoundException();
    return QRCode.toDataURL(booking.ipsQrData, { width: 320, margin: 1 });
  }

  async rejectRequest(ownerId: string, bookingId: string, dto: RejectBookingDto) {
    const booking = await this.assertOwnerAccess(ownerId, bookingId, ['REQUESTED']);
    await this.availability.releaseTermsForBooking(booking.id);
    // T79 — a rejected request gets its own status, distinct from CANCELLED:
    // the email system already sends a different template for the two
    // (booking_rejected vs booking_cancelled), so the status shown on the
    // booking itself must not contradict what the guest was told by email.
    const updated = await this.applyStatus(booking, 'REJECTED', ownerId, { cancellationReason: dto.reason });
    this.events.emit('booking.rejected', { bookingId: booking.id });
    return updated;
  }

  async confirmPayment(ownerId: string, bookingId: string) {
    const booking = await this.assertOwnerAccess(ownerId, bookingId, ['AWAITING_PAYMENT']);
    const updated = await this.applyStatus(booking, 'CONFIRMED', ownerId, { paymentConfirmedAt: new Date(), phoneUnlocked: true });
    this.events.emit('booking.confirmed', { bookingId: booking.id, viaCash: false });
    return updated;
  }

  async markNoShow(ownerId: string, bookingId: string) {
    const booking = await this.assertOwnerAccess(ownerId, bookingId, ['CONFIRMED']);
    if (booking.startsAt.getTime() > Date.now()) {
      throw new BadRequestException(this.i18n.t('bookings.TOO_EARLY_FOR_NO_SHOW'));
    }
    // T88 — a no-show still frees whatever nights/months remain on the term;
    // the guest not arriving shouldn't cost the owner the rest of the stay too.
    await this.availability.releaseTermsForBooking(booking.id);
    const updated = await this.applyStatus(booking, 'NO_SHOW', ownerId);
    this.events.emit('booking.no_show', { bookingId: booking.id });
    return updated;
  }

  async cancelByOwner(ownerId: string, bookingId: string, dto: CancelBookingDto) {
    // T78/T79 — a pending REQUESTED booking is never "cancelled" by the
    // owner, it's rejected (its own status, see rejectRequest); allowing
    // both here would let an owner sidestep the REJECTED status entirely.
    const booking = await this.assertOwnerAccess(ownerId, bookingId, ['AWAITING_PAYMENT', 'CONFIRMED']);
    await this.availability.releaseTermsForBooking(booking.id);
    const updated = await this.applyStatus(booking, 'CANCELLED', ownerId, { cancellationReason: dto.reason });
    this.events.emit('booking.cancelled_by_owner', { bookingId: booking.id });
    return updated;
  }

  // -- Guest actions -----------------------------------------------------

  /** R "gost otkaze posle uplate -> blokirano": self-service cancellation stops once CONFIRMED. */
  async cancelByGuest(guestId: string, bookingId: string, dto: CancelBookingDto) {
    const booking = await this.assertGuestAccess(guestId, bookingId, ['REQUESTED', 'AWAITING_PAYMENT']);
    await this.availability.releaseTermsForBooking(booking.id);
    const updated = await this.applyStatus(booking, 'CANCELLED', guestId, { cancellationReason: dto.reason });
    this.events.emit('booking.cancelled_by_guest', { bookingId: booking.id });
    return updated;
  }

  async disputeNoShow(guestId: string, bookingId: string, dto: DisputeNoShowDto) {
    const booking = await this.assertGuestAccess(guestId, bookingId, ['NO_SHOW']);
    const [, dispute] = await this.prisma.$transaction([
      this.prisma.booking.update({ where: { id: booking.id }, data: { noShowDisputed: true } }),
      this.prisma.dispute.create({
        data: {
          type: 'DISPUTED_NO_SHOW',
          bookingId: booking.id,
          listingId: booking.listingId,
          submittedByUserId: guestId,
          description: dto.explanation ?? '',
        },
      }),
    ]);
    this.events.emit('booking.no_show_disputed', { bookingId: booking.id, disputeId: dispute.id });
    return { message: this.i18n.t('common.SUCCESS') };
  }

  async disputeUnconfirmedPayment(guestId: string, bookingId: string) {
    const booking = await this.assertGuestAccess(guestId, bookingId, ['AWAITING_PAYMENT']);
    await this.prisma.dispute.create({
      data: {
        type: 'UNCONFIRMED_PAYMENT',
        bookingId: booking.id,
        listingId: booking.listingId,
        submittedByUserId: guestId,
        description: 'Guest reports payment was sent but not confirmed by the owner',
      },
    });
    this.events.emit('booking.payment_disputed', { bookingId: booking.id });
    return { message: this.i18n.t('common.SUCCESS') };
  }

  // -- Reads ---------------------------------------------------------

  async getOne(userId: string, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        listing: { select: { title: true, slug: true, address: true } },
        guest: { select: { firstName: true, lastName: true, phone: true } },
        owner: { select: { firstName: true, lastName: true, phone: true } },
      },
    });
    if (!booking) throw new NotFoundException();
    if (booking.guestId !== userId && booking.ownerId !== userId) throw new ForbiddenException();

    // T79 — "ko je otkazao i kada", for both CANCELLED and REJECTED: the
    // BookingHistory row for the transition into the current status already
    // has changedByUserId/changedAt, it just was never surfaced to the client.
    let cancellation: { by: 'GUEST' | 'OWNER' | null; at: Date } | null = null;
    if (booking.status === 'CANCELLED' || booking.status === 'REJECTED') {
      const entry = await this.prisma.bookingHistory.findFirst({
        where: { bookingId: booking.id, newStatus: booking.status },
        orderBy: { changedAt: 'desc' },
      });
      if (entry) {
        cancellation = {
          by: entry.changedByUserId === booking.guestId ? 'GUEST' : entry.changedByUserId === booking.ownerId ? 'OWNER' : null,
          at: entry.changedAt,
        };
      }
    }
    return { ...this.serialize(booking, userId), ...(cancellation ? { cancellation } : {}) };
  }

  async listMine(userId: string, role: 'guest' | 'owner', status?: BookingStatus) {
    const bookings = await this.prisma.booking.findMany({
      where: {
        ...(role === 'guest' ? { guestId: userId } : { ownerId: userId }),
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { listing: { select: { title: true, slug: true } } },
    });
    return bookings.map((b) => this.serialize(b));
  }

  // -- Scheduled jobs --------------------------------------------------

  /** R59/status table — payment window closed, term released, guest+owner notified. */
  @Cron(CronExpression.EVERY_MINUTE)
  async expireUnpaidBookings() {
    const expired = await this.prisma.booking.findMany({
      where: { status: 'AWAITING_PAYMENT', paymentDeadline: { lt: new Date() } },
    });
    for (const booking of expired) {
      await this.availability.releaseTermsForBooking(booking.id);
      await this.applyStatus(booking, 'EXPIRED', null, {}, true);
      this.events.emit('booking.expired', { bookingId: booking.id });
    }
  }

  /** R91 — CONFIRMED becomes REALIZOVANA (COMPLETED) 24h after the stay ends. */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async autoCompleteBookings() {
    const cutoff = new Date(Date.now() - 24 * 3600_000);
    const due = await this.prisma.booking.findMany({
      where: { status: 'CONFIRMED', endsAt: { lt: cutoff } },
    });
    for (const booking of due) {
      await this.applyStatus(booking, 'COMPLETED', null, {}, true);
      this.events.emit('booking.completed', { bookingId: booking.id });
    }
  }

  /** Ch.22.4 "Neotvoren zahtev posle 6h" — nudges the owner once, 6h after a request comes in untouched. */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async sendUnopenedRequestReminders() {
    const sixHoursAgo = new Date(Date.now() - 6 * 3600_000);
    const candidates = await this.prisma.booking.findMany({
      where: { status: 'REQUESTED', createdAt: { lte: sixHoursAgo }, NOT: { remindersSent: { has: 'unopened_6h' } } },
    });
    for (const booking of candidates) {
      await this.prisma.booking.update({ where: { id: booking.id }, data: { remindersSent: { push: 'unopened_6h' } } });
      this.events.emit('booking.request_unopened_reminder', { bookingId: booking.id });
    }
  }

  /** Ch.22.4 "Podsetnik na pola roka" / "Podsetnik pred istek" — one nudge at the halfway point, one on the last day. */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async sendPaymentDeadlineReminders() {
    const candidates = await this.prisma.booking.findMany({
      where: { status: 'AWAITING_PAYMENT', paymentDeadline: { not: null } },
      include: { listing: { select: { paymentDeadlineHours: true } } },
    });
    const now = Date.now();
    for (const booking of candidates) {
      if (!booking.paymentDeadline) continue;
      const totalHours = booking.listing.paymentDeadlineHours ?? 48;
      const deadlineMs = booking.paymentDeadline.getTime();
      const halfPointMs = deadlineMs - (totalHours / 2) * 3600_000;
      const finalDayStartMs = deadlineMs - 24 * 3600_000;

      if (!booking.remindersSent.includes('payment_half') && now >= halfPointMs && now < deadlineMs) {
        await this.prisma.booking.update({ where: { id: booking.id }, data: { remindersSent: { push: 'payment_half' } } });
        this.events.emit('booking.payment_reminder_half', { bookingId: booking.id });
      } else if (
        totalHours > 24 &&
        !booking.remindersSent.includes('payment_final') &&
        now >= finalDayStartMs &&
        now < deadlineMs
      ) {
        await this.prisma.booking.update({ where: { id: booking.id }, data: { remindersSent: { push: 'payment_final' } } });
        this.events.emit('booking.payment_reminder_final', { bookingId: booking.id });
      }
    }
  }

  /** Ch.22.4 "Podsetnik dan pre" — both sides, ~24h before the stay/slot starts. */
  @Cron(CronExpression.EVERY_HOUR)
  async sendDayBeforeReminders() {
    const target = new Date(Date.now() + 24 * 3600_000);
    const windowStart = new Date(target.getTime() - 30 * 60_000);
    const windowEnd = new Date(target.getTime() + 30 * 60_000);
    const candidates = await this.prisma.booking.findMany({
      where: {
        status: 'CONFIRMED',
        startsAt: { gte: windowStart, lte: windowEnd },
        NOT: { remindersSent: { has: 'day_before' } },
      },
    });
    for (const booking of candidates) {
      await this.prisma.booking.update({ where: { id: booking.id }, data: { remindersSent: { push: 'day_before' } } });
      this.events.emit('booking.reminder_day_before', { bookingId: booking.id });
    }
  }

  // -- Internal ------------------------------------------------------

  private async assertOwnerAccess(ownerId: string, bookingId: string, allowed: BookingStatus[]) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException();
    if (booking.ownerId !== ownerId) throw new ForbiddenException();
    if (!allowed.includes(booking.status)) {
      throw new BadRequestException(this.i18n.t('bookings.INVALID_STATE', { args: { status: booking.status } }));
    }
    return booking;
  }

  private async assertGuestAccess(guestId: string, bookingId: string, allowed: BookingStatus[]) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException();
    if (booking.guestId !== guestId) throw new ForbiddenException();
    if (!allowed.includes(booking.status)) {
      throw new BadRequestException(this.i18n.t('bookings.INVALID_STATE', { args: { status: booking.status } }));
    }
    return booking;
  }

  private async applyStatus(
    booking: Booking,
    newStatus: BookingStatus,
    changedByUserId: string | null,
    extra: Record<string, unknown> = {},
    automatic = false,
  ) {
    const updated = await this.prisma.booking.update({
      where: { id: booking.id },
      data: { status: newStatus, ...extra },
    });
    await this.recordHistory(booking.id, booking.status, newStatus, changedByUserId, automatic);
    return this.serialize(updated);
  }

  private async recordHistory(
    bookingId: string,
    oldStatus: BookingStatus | null,
    newStatus: BookingStatus,
    changedByUserId: string | null,
    automatic: boolean,
  ) {
    await this.prisma.bookingHistory.create({
      data: { bookingId, oldStatus: oldStatus ?? undefined, newStatus, changedByUserId, automatic },
    });
  }

  /**
   * `requestingUserId` + a `guest`/`owner`/`listing` relation on `booking`
   * (only getOne() fetches these) together gate what each side sees of the
   * other: the owner always sees the guest's NAME (T78 — "dogovoreno"), but
   * only their phone once phoneUnlocked (R98 — "guest phone visible to
   * owner after acceptance"). Symmetrically (T80), the guest sees nothing
   * about the owner or the listing's exact address until phoneUnlocked
   * flips too (i.e. the booking has actually been confirmed) — before that
   * they only know what the public listing page already told them.
   */
  private serialize(
    booking: Booking & {
      guest?: { firstName: string; lastName: string; phone: string | null };
      owner?: { firstName: string; lastName: string; phone: string | null };
      listing?: { title: string; slug: string; address?: string | null };
    },
    requestingUserId?: string,
  ) {
    const { guest, owner, listing, ...rest } = booking;
    const isOwnerViewing = !!guest && requestingUserId === booking.ownerId;
    const showGuestPhone = isOwnerViewing && booking.phoneUnlocked;
    const showOwnerContact = !!owner && requestingUserId === booking.guestId && booking.phoneUnlocked;
    return {
      ...rest,
      ...(listing
        ? { listing: { title: listing.title, slug: listing.slug, ...(showOwnerContact && listing.address ? { address: listing.address } : {}) } }
        : {}),
      pricePerUnit: paraToRsd(booking.pricePerUnit),
      totalAmount: paraToRsd(booking.totalAmount),
      amountDue: paraToRsd(booking.amountDue),
      ...(isOwnerViewing ? { guestName: `${guest!.firstName} ${guest!.lastName}` } : {}),
      ...(showGuestPhone ? { guestPhone: guest!.phone } : {}),
      ...(showOwnerContact ? { ownerName: `${owner!.firstName} ${owner!.lastName}`, ownerPhone: owner!.phone } : {}),
    };
  }
}

/** Nights/days/hours/months/years between two timestamps, matching the listing's price unit. */
function computeUnitCount(priceUnit: PriceUnit, startsAt: Date, endsAt: Date): number {
  const ms = endsAt.getTime() - startsAt.getTime();
  const days = ms / (24 * 3600_000);
  switch (priceUnit) {
    case 'HOUR':
      return Math.max(1, Math.ceil(ms / 3600_000));
    case 'NIGHT':
    case 'DAY':
      return Math.max(1, Math.round(days));
    case 'MONTH':
      return Math.max(1, Math.round(days / 30));
    case 'YEAR':
      return Math.max(1, Math.round(days / 365));
    case 'SLOT':
    default:
      return 1;
  }
}

const DURATION_UNIT_WORDS_SR: Partial<Record<PriceUnit, [string, string, string]>> = {
  NIGHT: ['noćenje', 'noćenja', 'noćenja'],
  DAY: ['dan', 'dana', 'dana'],
  HOUR: ['sat', 'sata', 'sati'],
  MONTH: ['mesec', 'meseca', 'meseci'],
  YEAR: ['godina', 'godine', 'godina'],
  SLOT: ['termin', 'termina', 'termina'],
};
const DURATION_UNIT_WORDS_EN: Partial<Record<PriceUnit, [string, string]>> = {
  NIGHT: ['night', 'nights'],
  DAY: ['day', 'days'],
  HOUR: ['hour', 'hours'],
  MONTH: ['month', 'months'],
  YEAR: ['year', 'years'],
  SLOT: ['slot', 'slots'],
};

/** Serbian plural bucket for a count — ...1→0 (one), ...2-4→1 (few), else→2 (many), with the 11-14 exception. */
function srPluralIndex(n: number): 0 | 1 | 2 {
  const abs = Math.abs(n);
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return 0;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 1;
  return 2;
}

/** The noun for MIN_DURATION/MAX_DURATION messages ("10 {unit}") — declined for the current request's language. */
function durationUnitWord(priceUnit: PriceUnit, count: number): string {
  const isEn = I18nContext.current()?.lang === 'en';
  if (isEn) {
    const words = DURATION_UNIT_WORDS_EN[priceUnit] ?? DURATION_UNIT_WORDS_EN.NIGHT!;
    return words[count === 1 ? 0 : 1];
  }
  const words = DURATION_UNIT_WORDS_SR[priceUnit] ?? DURATION_UNIT_WORDS_SR.NIGHT!;
  return words[srPluralIndex(count)];
}

/** HH:MM for the booking's start time — matches how WorkingHours/HourlyPriceRange store clock time (no timezone conversion, same convention as pickupTime/returnTime). */
function toHHMM(date: Date): string {
  return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
}

/** Human-readable snapshot for Booking.cancellationTermsSnapshot (RNT-030 email display) — frozen at booking time so a later policy edit never rewrites past bookings' terms. */
function formatCancellationPolicy(
  type: 'NO_CANCELLATION' | 'FREE_UNTIL_DAYS' | 'FREE_UNTIL_HOURS' | null,
  threshold: number | null,
  language: 'SR' | 'EN',
): string | null {
  const isEn = language === 'EN';
  if (type === 'NO_CANCELLATION') return isEn ? 'No cancellation' : 'Bez otkazivanja';
  if (type === 'FREE_UNTIL_DAYS' && threshold) {
    return isEn ? `Free cancellation up to ${threshold} day(s) before` : `Besplatno otkazivanje do ${threshold} dana pre početka`;
  }
  if (type === 'FREE_UNTIL_HOURS' && threshold) {
    return isEn ? `Free cancellation up to ${threshold} hour(s) before` : `Besplatno otkazivanje do ${threshold} časova pre početka`;
  }
  return null;
}

function sumMandatoryFees(fees: unknown): bigint {
  if (!Array.isArray(fees)) return 0n;
  return fees.reduce((sum: bigint, fee: any) => sum + rsdToPara(Number(fee.amount ?? 0)), 0n);
}
