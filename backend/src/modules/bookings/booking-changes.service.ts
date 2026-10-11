import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { I18nService } from 'nestjs-i18n';
import { Booking, Listing, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AvailabilityService, isExclusionViolation } from '../availability/availability.service';
import { paraToRsd } from '../../common/utils/money';
import { readRequestResponseHours } from '../../common/utils/request-expiry';
import {
  CHANGEABLE_STATUSES,
  getChangeDeadline,
  getChangeExpiresAt,
  readChangeDeadlineHours,
  toChangeView,
} from '../../common/utils/booking-change';
import { BookingsService, isDayStay, isDefinedSlots, isWorkingHours, resolvePricingUnitCount } from './bookings.service';
import { ChangeTermDto, RejectBookingChangeDto, RequestBookingChangeDto } from './dto/booking-change.dto';

type ListingWithPackage = Listing & { subscription: { package: { hasBookings: boolean } } | null };

/**
 * T136: a guest asks to move a booking (sent, waiting for the payment, or
 * confirmed) to another term, until booking_change_deadline_hours before it
 * starts, and the owner approves or rejects. The new term follows the same
 * rules as a new request for the listing (BookingsService checks and prices
 * it) and must be free apart from the booking's own term. Until the owner
 * answers the booking keeps its term; the new one is not held, so approving
 * checks it again and moves the booking's BlockedTerm rows in one
 * transaction. The new price becomes the booking's; the advance stays as it
 * was asked for or paid, since nothing is paid in again or back (a request
 * still waiting for the owner takes the new advance with the new price).
 */
@Injectable()
export class BookingChangesService {
  constructor(
    private prisma: PrismaService,
    private bookings: BookingsService,
    private availability: AvailabilityService,
    private i18n: I18nService,
    private events: EventEmitter2,
  ) {}

  /** The listing's terms for the guest's change screen, with their own booking's term left free. */
  async getAvailability(guestId: string, bookingId: string, from: Date, to: Date) {
    const booking = await this.getGuestBooking(guestId, bookingId);
    const [data, own] = await Promise.all([
      this.availability.getAvailability(booking.listingId, from, to),
      this.prisma.blockedTerm.findMany({ where: { bookingId: booking.id }, select: { id: true } }),
    ]);
    const ownIds = new Set(own.map((term) => term.id));
    return { ...data, blocked: data.blocked.filter((term) => !ownIds.has(term.id)) };
  }

  /** The new term checked and priced, nothing saved: the change screen's summary, and its refusal at once when the term is taken. */
  async quote(guestId: string, bookingId: string, dto: ChangeTermDto) {
    const booking = await this.getGuestBooking(guestId, bookingId);
    const listing = await this.getListing(booking.listingId);
    const term = await this.checkNewTerm(booking, listing, dto);
    // The advance asked for or paid stays; a request still waiting takes the new one.
    const advanceKept = booking.status !== 'REQUESTED';
    return {
      newStartsAt: term.startsAt,
      newEndsAt: term.endsAt,
      oldTotalAmount: paraToRsd(booking.totalAmount),
      newTotalAmount: paraToRsd(term.totalAmount),
      // What the booking asks for once the change is approved.
      amountDue: paraToRsd(advanceKept ? booking.amountDue : term.amountDue),
      advanceKept,
      newPriceLines: term.priceLines.map((line) => ({ count: line.count, price: paraToRsd(line.price), kind: line.kind })),
    };
  }

  async request(guestId: string, bookingId: string, dto: RequestBookingChangeDto) {
    const booking = await this.getGuestBooking(guestId, bookingId);
    const listing = await this.getListing(booking.listingId);
    const term = await this.checkNewTerm(booking, listing, dto);
    let created;
    try {
      created = await this.prisma.bookingChangeRequest.create({
        data: {
          bookingId: booking.id,
          oldStartsAt: booking.startsAt,
          oldEndsAt: booking.endsAt,
          newStartsAt: term.startsAt,
          newEndsAt: term.endsAt,
          oldTotalAmount: booking.totalAmount,
          newPricePerUnit: term.pricePerUnit,
          newUnitCount: term.unitCount,
          newTotalAmount: term.totalAmount,
          newAmountDue: term.amountDue,
          // Booking.fees' own shape, so approval can put it in place of the booking's.
          newFees: {
            mandatory: term.mandatoryFeesTotal.toString(),
            extraServicesTotal: term.extraServicesTotal.toString(),
            guestFee: term.guestFee.toString(),
            priceLines: term.priceLines.map((line) => ({ count: line.count, price: line.price.toString(), kind: line.kind })),
          },
          guestMessage: dto.guestMessage?.trim() || null,
        },
      });
    } catch (err) {
      // booking_change_one_pending: another request was sent at the same moment.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException(this.i18n.t('bookings.CHANGE_ALREADY_PENDING'));
      }
      throw err;
    }
    this.events.emit('booking.change_requested', { bookingId: booking.id, changeRequestId: created.id });
    return toChangeView(created);
  }

  async withdraw(guestId: string, bookingId: string) {
    const booking = await this.getGuestBooking(guestId, bookingId);
    const pending = await this.getPending(booking.id);
    const decided = await this.prisma.bookingChangeRequest.updateMany({
      where: { id: pending.id, status: 'PENDING' },
      data: { status: 'WITHDRAWN', decidedAt: new Date(), decidedByUserId: guestId },
    });
    if (!decided.count) throw new BadRequestException(this.i18n.t('bookings.CHANGE_NOT_PENDING'));
    this.events.emit('booking.change_withdrawn', { bookingId: booking.id, changeRequestId: pending.id });
    return { message: this.i18n.t('common.SUCCESS') };
  }

  /**
   * The new term takes the old one's place: the booking's BlockedTerm rows
   * move in the same transaction as its dates and price, so the old term is
   * free and the new one held at once, or nothing changes. A term taken since
   * the request was sent is refused and the request keeps waiting for the
   * owner to reject it or agree another with the guest.
   */
  async approve(ownerId: string, bookingId: string) {
    const booking = await this.getOwnerBooking(ownerId, bookingId);
    const pending = await this.getPending(booking.id);
    const now = Date.now();
    if (pending.newStartsAt.getTime() <= now || booking.startsAt.getTime() <= now) {
      await this.expire(pending.id, true);
      throw new BadRequestException(this.i18n.t('bookings.CHANGE_EXPIRED'));
    }
    const listing = await this.prisma.listing.findUniqueOrThrow({ where: { id: booking.listingId } });
    // T141: a day blocked since the request was sent closes its hours after midnight too.
    if (isWorkingHours(listing) && (await this.availability.isInBlockedWorkingDay(listing.id, pending.newStartsAt, pending.newEndsAt))) {
      throw new ConflictException(this.i18n.t('bookings.CHANGE_TERM_NO_LONGER_FREE'));
    }
    const fees = (booking.fees ?? {}) as Record<string, unknown>;
    try {
      await this.prisma.$transaction(async (tx) => {
        const moved = await tx.booking.updateMany({
          where: { id: booking.id, status: booking.status, startsAt: booking.startsAt, endsAt: booking.endsAt },
          data: {
            startsAt: pending.newStartsAt,
            endsAt: pending.newEndsAt,
            pricePerUnit: pending.newPricePerUnit,
            unitCount: pending.newUnitCount,
            totalAmount: pending.newTotalAmount,
            // Nothing asked for yet while the owner has not answered the booking itself.
            ...(booking.status === 'REQUESTED' ? { amountDue: pending.newAmountDue } : {}),
            fees: { ...fees, ...(pending.newFees as Record<string, unknown>) } as Prisma.InputJsonValue,
            // The day-before reminder goes out again, for the new day.
            remindersSent: booking.remindersSent.filter((flag) => flag !== 'day_before'),
          },
        });
        if (!moved.count) throw new BadRequestException(this.i18n.t('bookings.STATE_CHANGED'));
        await tx.blockedTerm.deleteMany({ where: { bookingId: booking.id } });
        await tx.blockedTerm.create({
          data: {
            listingId: booking.listingId,
            bookingId: booking.id,
            startsAt: pending.newStartsAt,
            endsAt: pending.newEndsAt,
            source: 'BOOKING',
          },
        });
        const decided = await tx.bookingChangeRequest.updateMany({
          where: { id: pending.id, status: 'PENDING' },
          data: { status: 'APPROVED', decidedAt: new Date(), decidedByUserId: ownerId },
        });
        if (!decided.count) throw new BadRequestException(this.i18n.t('bookings.CHANGE_NOT_PENDING'));
      });
    } catch (err) {
      if (isExclusionViolation(err)) throw new ConflictException(this.i18n.t('bookings.CHANGE_TERM_NO_LONGER_FREE'));
      throw err;
    }
    // The gap after the new term, as a new booking gets it (Dizajn 23, T117).
    if (listing.gapAfterMinutes && !isDefinedSlots(listing) && !isDayStay(listing)) {
      await this.availability.applyGapAfter(listing.id, booking.id, pending.newEndsAt, listing.gapAfterMinutes);
    }
    this.events.emit('booking.change_approved', { bookingId: booking.id, changeRequestId: pending.id });
    return { message: this.i18n.t('common.SUCCESS') };
  }

  async reject(ownerId: string, bookingId: string, dto: RejectBookingChangeDto) {
    const booking = await this.getOwnerBooking(ownerId, bookingId);
    const pending = await this.getPending(booking.id);
    const decided = await this.prisma.bookingChangeRequest.updateMany({
      where: { id: pending.id, status: 'PENDING' },
      data: { status: 'REJECTED', ownerReason: dto.reason?.trim() || null, decidedAt: new Date(), decidedByUserId: ownerId },
    });
    if (!decided.count) throw new BadRequestException(this.i18n.t('bookings.CHANGE_NOT_PENDING'));
    this.events.emit('booking.change_rejected', { bookingId: booking.id, changeRequestId: pending.id });
    return { message: this.i18n.t('common.SUCCESS') };
  }

  /**
   * An unanswered request expires as a booking request does
   * (booking_request_response_hours after it was sent), or once either term
   * begins; the guest is told. A request whose booking was cancelled,
   * rejected or expired meanwhile closes without a word: that booking's own
   * email already said what happened.
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async expireUnanswered() {
    const [responseHours, pending] = await Promise.all([
      readRequestResponseHours(this.prisma),
      this.prisma.bookingChangeRequest.findMany({
        where: { status: 'PENDING' },
        include: { booking: { select: { status: true } } },
      }),
    ]);
    const now = Date.now();
    for (const request of pending) {
      const closed = !CHANGEABLE_STATUSES.includes(request.booking.status);
      if (!closed && getChangeExpiresAt(request, responseHours).getTime() > now) continue;
      await this.expire(request.id, !closed);
    }
  }

  // -- Internal ------------------------------------------------------------

  private async expire(changeRequestId: string, notify: boolean) {
    const expired = await this.prisma.bookingChangeRequest.updateMany({
      where: { id: changeRequestId, status: 'PENDING' },
      data: { status: 'EXPIRED', decidedAt: new Date() },
    });
    if (expired.count && notify) {
      const request = await this.prisma.bookingChangeRequest.findUnique({ where: { id: changeRequestId }, select: { bookingId: true } });
      if (request) this.events.emit('booking.change_expired', { bookingId: request.bookingId, changeRequestId });
    }
  }

  /**
   * The same checks a new request for the listing goes through (term rules,
   * working hours, free term), the booking's own term aside, then the price
   * of the new term with the booking's guests and extra services.
   */
  private async checkNewTerm(booking: Booking, listing: ListingWithPackage, dto: ChangeTermDto) {
    if (!CHANGEABLE_STATUSES.includes(booking.status)) {
      throw new BadRequestException(this.i18n.t('bookings.INVALID_STATE', { args: { status: booking.status } }));
    }
    if (listing.status !== 'ACTIVE' || listing.bookingModel === 'NO_BOOKING' || !listing.subscription?.package.hasBookings) {
      throw new BadRequestException(this.i18n.t('bookings.CHANGE_NOT_AVAILABLE'));
    }
    const deadlineHours = await readChangeDeadlineHours(this.prisma);
    if (Date.now() >= getChangeDeadline(booking.startsAt, deadlineHours).getTime()) {
      throw new BadRequestException(this.i18n.t('bookings.CHANGE_DEADLINE_PASSED', { args: { hours: deadlineHours } }));
    }
    if (await this.prisma.bookingChangeRequest.count({ where: { bookingId: booking.id, status: 'PENDING' } })) {
      throw new BadRequestException(this.i18n.t('bookings.CHANGE_ALREADY_PENDING'));
    }

    const { startsAt, endsAt, slotPrice } = await this.bookings.resolveRequestedTerm(listing, dto);
    if (startsAt.getTime() === booking.startsAt.getTime() && endsAt.getTime() === booking.endsAt.getTime()) {
      throw new BadRequestException(this.i18n.t('bookings.CHANGE_SAME_TERM'));
    }
    const guestCount = booking.guestCount ?? undefined;
    const maxGuests = await this.bookings.getGuestCapacity(listing.id, listing.maxGuests);
    this.bookings.assertTermRules({ ...listing, maxGuests }, startsAt, endsAt, guestCount);
    if (isWorkingHours(listing) && !(await this.availability.fitsWorkingHours(listing.id, startsAt, endsAt))) {
      throw new BadRequestException(this.i18n.t('bookings.OUTSIDE_WORKING_HOURS'));
    }
    // T141: nor after midnight in the hours of a day the owner blocked.
    if (isWorkingHours(listing) && (await this.availability.isInBlockedWorkingDay(listing.id, startsAt, endsAt))) {
      throw new ConflictException(this.i18n.t('bookings.CHANGE_TERM_TAKEN'));
    }
    // Taken by anything but this booking itself (a new booking, a block, another's gap, iCal).
    const clash = await this.prisma.blockedTerm.findFirst({
      where: {
        listingId: listing.id,
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
        OR: [{ bookingId: null }, { bookingId: { not: booking.id } }],
      },
      select: { id: true },
    });
    if (clash) throw new ConflictException(this.i18n.t('bookings.CHANGE_TERM_TAKEN'));

    const extraServices = ((booking.fees ?? {}) as { extraServices?: Array<{ serviceId: string; quantity: number }> }).extraServices;
    const pricePerUnit = slotPrice ?? listing.price;
    const unitCount = resolvePricingUnitCount(listing.priceUnit, startsAt, endsAt, { monthCount: dto.monthCount, guestCount });
    const totals = await this.bookings.computeTotals(listing, startsAt, endsAt, pricePerUnit, unitCount, slotPrice, {
      guestCount,
      extraServices,
      monthCount: dto.monthCount,
    });
    return { startsAt, endsAt, pricePerUnit, unitCount, ...totals };
  }

  private async getListing(listingId: string): Promise<ListingWithPackage> {
    return this.prisma.listing.findUniqueOrThrow({
      where: { id: listingId },
      include: { subscription: { select: { package: { select: { hasBookings: true } } } } },
    }) as Promise<ListingWithPackage>;
  }

  private async getPending(bookingId: string) {
    const pending = await this.prisma.bookingChangeRequest.findFirst({ where: { bookingId, status: 'PENDING' } });
    if (!pending) throw new BadRequestException(this.i18n.t('bookings.CHANGE_NOT_PENDING'));
    return pending;
  }

  private async getGuestBooking(guestId: string, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException();
    if (booking.guestId !== guestId) throw new ForbiddenException();
    return booking;
  }

  private async getOwnerBooking(ownerId: string, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException();
    if (booking.ownerId !== ownerId) throw new ForbiddenException();
    if (!CHANGEABLE_STATUSES.includes(booking.status)) {
      throw new BadRequestException(this.i18n.t('bookings.INVALID_STATE', { args: { status: booking.status } }));
    }
    return booking;
  }
}
