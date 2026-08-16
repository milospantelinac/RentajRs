import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { I18nService } from 'nestjs-i18n';
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

    // R126 — email must be confirmed before the first booking.
    const guest = await this.prisma.user.findUniqueOrThrow({ where: { id: guestId } });
    if (!guest.emailVerified) throw new ForbiddenException(this.i18n.t('errors.EMAIL_NOT_VERIFIED'));
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
    this.assertTermRules(listing, startsAt, endsAt, dto.guestCount);

    const pricePerUnit = slotPrice ?? listing.price;
    const unitCount = computeUnitCount(listing.priceUnit, startsAt, endsAt);
    const extraServicesTotal = await this.resolveExtraServicesTotal(listingId, dto.extraServices);
    const mandatoryFeesTotal = sumMandatoryFees(listing.mandatoryFees);
    const guestFee = listing.pricePerGuest && dto.guestCount ? listing.pricePerGuest * BigInt(dto.guestCount) : 0n;

    // RNT-029 — per-stay (night/day) bookings price each date individually
    // (weekend price, or an owner's per-date override) rather than a flat
    // rate x nights; slot bookings and other units keep the flat calculation.
    const unitPriceTotal =
      !slotPrice && (listing.priceUnit === 'NIGHT' || listing.priceUnit === 'DAY')
        ? (await this.availability.getNightlyPrices(listingId, startsAt, endsAt, listing.price, listing.weekendPrice)).reduce(
            (sum, p) => sum + p,
            0n,
          )
        : pricePerUnit * BigInt(unitCount);

    const totalAmount = unitPriceTotal + guestFee + mandatoryFeesTotal + extraServicesTotal;
    const amountDue = listing.advancePercent
      ? (totalAmount * BigInt(listing.advancePercent)) / 100n
      : totalAmount;

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
        cancellationTermsSnapshot: listing.cancellationTerms,
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
    if (!dto.startsAt || !dto.endsAt) {
      throw new BadRequestException('startsAt/endsAt are required unless booking a defined slot');
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

    const unitCount = computeUnitCount(listing.priceUnit, startsAt, endsAt);
    if (listing.minDuration && unitCount < listing.minDuration) {
      throw new BadRequestException(this.i18n.t('bookings.MIN_DURATION', { args: { min: listing.minDuration } }));
    }
    if (listing.maxDuration && unitCount > listing.maxDuration) {
      throw new BadRequestException(this.i18n.t('bookings.MAX_DURATION', { args: { max: listing.maxDuration } }));
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
    const updated = await this.applyStatus(booking, 'CANCELLED', ownerId, { cancellationReason: dto.reason ?? 'Rejected by owner' });
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
    const updated = await this.applyStatus(booking, 'NO_SHOW', ownerId);
    this.events.emit('booking.no_show', { bookingId: booking.id });
    return updated;
  }

  async cancelByOwner(ownerId: string, bookingId: string, dto: CancelBookingDto) {
    const booking = await this.assertOwnerAccess(ownerId, bookingId, ['REQUESTED', 'AWAITING_PAYMENT', 'CONFIRMED']);
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
      include: { listing: { select: { title: true, slug: true } }, guest: { select: { phone: true } } },
    });
    if (!booking) throw new NotFoundException();
    if (booking.guestId !== userId && booking.ownerId !== userId) throw new ForbiddenException();
    return this.serialize(booking, userId);
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
   * `requestingUserId` + a `guest` relation on `booking` (only getOne()
   * fetches it) together gate the guest's phone number: visible to the
   * owner, and only once phoneUnlocked is set (R98/schema comment —
   * "guest phone visible to owner after acceptance").
   */
  private serialize(booking: Booking & { guest?: { phone: string | null } }, requestingUserId?: string) {
    const { guest, ...rest } = booking;
    const showGuestPhone = !!guest && requestingUserId === booking.ownerId && booking.phoneUnlocked;
    return {
      ...rest,
      pricePerUnit: paraToRsd(booking.pricePerUnit),
      totalAmount: paraToRsd(booking.totalAmount),
      amountDue: paraToRsd(booking.amountDue),
      ...(showGuestPhone ? { guestPhone: guest!.phone } : {}),
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

function sumMandatoryFees(fees: unknown): bigint {
  if (!Array.isArray(fees)) return 0n;
  return fees.reduce((sum: bigint, fee: any) => sum + rsdToPara(Number(fee.amount ?? 0)), 0n);
}
