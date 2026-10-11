import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { Booking, BookingStatus, ListingStatus, Prisma, PriceUnit } from '@prisma/client';
import * as QRCode from 'qrcode';
import { PrismaService } from '../../prisma/prisma.service';
import { AvailabilityService, PriceKind, PricedUnit } from '../availability/availability.service';
import { TaxonomyService } from '../taxonomy/taxonomy.service';
import { IPS_QR_IMAGE_OPTIONS, bookingBankTransfer } from '../../common/utils/ips-qr';
import { paraToRsd, rsdToPara } from '../../common/utils/money';
import { GUEST_CAPACITY_ATTRIBUTE_KEYS, GuestUnit, getGuestUnits } from '../../common/utils/guest-capacity';
import { canGuestCancel, getFreeCancellationUntil } from '../../common/utils/guest-cancellation';
import { OPEN_PAYMENT_REPORT, isHeldByPaymentReport } from '../../common/utils/payment-report';
import { readRequestResponseHours } from '../../common/utils/request-expiry';
import { describeBookingChange, readChangeDeadlineHours } from '../../common/utils/booking-change';
import { shortName } from '../../common/utils/short-name';
import { CreateBookingRequestDto } from './dto/create-booking-request.dto';
import { CancelBookingDto, DisputeNoShowDto, RejectBookingDto } from './dto/booking-actions.dto';

/** Dizajn 34: "2 sata × 4.200 RSD (vikend cena)", one line per price and rule. */
interface PriceLine extends PricedUnit {
  count: number;
}

/** The listing fields a term is priced with. */
interface PricingListing {
  id: string;
  priceUnit: PriceUnit;
  price: bigint;
  weekendPrice: bigint | null;
  pricePerGuest: bigint | null;
  mandatoryFees: unknown;
  bookingModel: string;
  slotSubmode: string | null;
  advancePercent: number | null;
}

/** What createRequest keeps in Booking.fees; the last two keys since Dizajn 34. */
interface StoredFees {
  mandatory?: string;
  guestFee?: string;
  extraServices?: unknown[];
  extraServicesTotal?: string;
  priceLines?: Array<{ count: number; price: string; kind: PriceKind }>;
}

// Dizajn 34: requests the owner still has to answer come first, then the ones
// waiting for payment, then confirmed stays, each soonest first; everything
// else follows, the latest term first.
const OPEN_STATUS_ORDER: BookingStatus[] = ['REQUESTED', 'AWAITING_PAYMENT', 'CONFIRMED'];

/** T142: the owner fields a bank transfer is made out from (see bookingBankTransfer). */
const PAYEE_SELECT = {
  firstName: true,
  lastName: true,
  buyerType: true,
  companyName: true,
  billingAddress: true,
  bankAccount: true,
} as const;

/** R59: the hours a guest has to pay when the listing sets none. */
const DEFAULT_PAYMENT_DEADLINE_HOURS = 48;

function openPaymentReportWhere(bookingId: string): Prisma.DisputeWhereInput {
  return { bookingId, ...OPEN_PAYMENT_REPORT };
}

@Injectable()
export class BookingsService {
  constructor(
    private prisma: PrismaService,
    private availability: AvailabilityService,
    private i18n: I18nService,
    private events: EventEmitter2,
    private taxonomy: TaxonomyService,
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
    const effectiveMaxGuests = await this.getGuestCapacity(listingId, listing.maxGuests);
    this.assertTermRules({ ...listing, maxGuests: effectiveMaxGuests }, startsAt, endsAt, dto.guestCount);
    // T127: no term outside the working hours (Tamara, 2026-10-09); the
    // booking card and the request page only offer lengths up to closing.
    if (isWorkingHours(listing) && !(await this.availability.fitsWorkingHours(listingId, startsAt, endsAt))) {
      throw new BadRequestException(this.i18n.t('bookings.OUTSIDE_WORKING_HOURS'));
    }
    // T141: nor after midnight in the hours of a day the owner blocked.
    if (isWorkingHours(listing) && (await this.availability.isInBlockedWorkingDay(listingId, startsAt, endsAt))) {
      throw new ConflictException(this.i18n.t('errors.TERM_NOT_AVAILABLE'));
    }
    // T127: a playroom also asks how many adults come with the children. It is
    // there for the owner only: no limit, no effect on the price.
    const guestUnit = (await getGuestUnits(this.taxonomy, [listing.categoryId])).get(listing.categoryId);
    const adultCount = guestUnit === 'children' ? (dto.adultCount ?? null) : null;

    const pricePerUnit = slotPrice ?? listing.price;
    const unitCount = resolvePricingUnitCount(listing.priceUnit, startsAt, endsAt, dto);
    const { priceLines, guestFee, mandatoryFeesTotal, extraServicesTotal, totalAmount, amountDue } =
      await this.computeTotals(listing, startsAt, endsAt, pricePerUnit, unitCount, slotPrice, dto);

    // T76 — a listing set to "Oba" never actually asked the guest which
    // method they wanted; the booking's own paymentMethod must be a real
    // choice (CASH or BANK_TRANSFER), never the listing's literal BOTH.
    let resolvedPaymentMethod: 'CASH' | 'BANK_TRANSFER';
    if (listing.paymentMethod === 'BOTH') {
      if (dto.paymentMethod !== 'CASH' && dto.paymentMethod !== 'BANK_TRANSFER') {
        throw new BadRequestException(this.i18n.t('bookings.PAYMENT_METHOD_REQUIRED'));
      }
      resolvedPaymentMethod = dto.paymentMethod;
    } else {
      resolvedPaymentMethod = listing.paymentMethod ?? 'CASH';
    }

    const booking = await this.prisma.booking.create({
      data: {
        listingId,
        guestId,
        ownerId: listing.userId,
        status: 'REQUESTED',
        startsAt,
        endsAt,
        guestCount: dto.guestCount,
        adultCount,
        guestMessage: dto.guestMessage,
        priceUnit: listing.priceUnit,
        pricePerUnit,
        unitCount,
        // Dizajn 34: the priced lines and the extras total let the owner's
        // request card explain the total later, whatever the prices are by then.
        fees: {
          mandatory: mandatoryFeesTotal.toString(),
          extraServices: dto.extraServices ?? [],
          extraServicesTotal: extraServicesTotal.toString(),
          guestFee: guestFee.toString(),
          priceLines: priceLines.map((line) => ({ count: line.count, price: line.price.toString(), kind: line.kind })),
        } as unknown as Prisma.InputJsonValue,
        totalAmount,
        amountDue,
        paymentMethod: resolvedPaymentMethod,
        cancellationTermsSnapshot: formatCancellationPolicy(
          listing.cancellationPolicyType,
          listing.cancellationThreshold,
          guest.language,
        ),
        cancellationPolicyType: listing.cancellationPolicyType,
        cancellationThreshold: listing.cancellationThreshold,
      },
    });

    try {
      await this.availability.lockTerm(listingId, startsAt, endsAt, 'BOOKING', { bookingId: booking.id });
    } catch (err) {
      await this.prisma.booking.delete({ where: { id: booking.id } });
      throw err;
    }
    // Dizajn 23: a defined slot has its own length, so the gap doesn't follow it;
    // T117: nor does it follow a day booking.
    if (listing.gapAfterMinutes && !isDefinedSlots(listing) && !isDayStay(listing)) {
      await this.availability.applyGapAfter(listingId, booking.id, endsAt, listing.gapAfterMinutes);
    }

    await this.recordHistory(booking.id, null, 'REQUESTED', guestId, false);
    this.events.emit('booking.requested', { bookingId: booking.id });

    // R52: bank-transfer bookings that don't require approval skip straight to AWAITING_PAYMENT.
    if (resolvedPaymentMethod !== 'CASH' && !listing.requiresApproval) {
      return this.moveToAwaitingPayment(booking, listing);
    }

    return this.serialize(booking);
  }

  // T136: the term rules and pricing below are shared with BookingChangesService,
  // so a moved booking is checked and priced exactly as a new one.
  async resolveRequestedTerm(
    listing: { id: string; bookingModel: string; slotSubmode: string | null },
    dto: CreateBookingRequestDto,
  ): Promise<{ startsAt: Date; endsAt: Date; slotPrice?: bigint }> {
    // T140: a listing on defined slots is booked by one of its slots, and a
    // slot books nothing on a listing that is booked another way.
    if (isDefinedSlots(listing) !== !!dto.definedSlotId) {
      throw new BadRequestException(this.i18n.t(dto.definedSlotId ? 'errors.TERM_NOT_AVAILABLE' : 'bookings.SLOT_REQUIRED'));
    }
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

  assertTermRules(
    listing: {
      minDuration: number | null;
      maxDuration: number | null;
      minGuests: number | null;
      maxGuests: number | null;
      earliestBookingHours: number | null;
      maxAdvanceBookingDays: number | null;
      priceUnit: PriceUnit;
      bookingModel: string;
      slotSubmode: string | null;
    },
    startsAt: Date,
    endsAt: Date,
    guestCount?: number,
  ) {
    if (endsAt <= startsAt) throw new BadRequestException(this.i18n.t('bookings.END_BEFORE_START'));

    // A month whose 1st has passed (T118: the current month, Tamara 2026-10-10)
    // and an hour or a slot that has begun can't be asked for any more. A stay
    // keeps its first day bookable on that day.
    if ((listing.priceUnit === 'MONTH' || listing.bookingModel === 'PER_SLOT') && startsAt.getTime() < Date.now()) {
      throw new BadRequestException(this.i18n.t('bookings.ALREADY_STARTED'));
    }

    if (listing.earliestBookingHours) {
      const earliest = Date.now() + listing.earliestBookingHours * 3600_000;
      if (startsAt.getTime() < earliest) {
        throw new BadRequestException(this.i18n.t('bookings.TOO_SOON'));
      }
    }

    // "Koliko kasno može da se rezerviše" (Dodavanje Oglasa spec §4). T118: a
    // month always starts on the 1st, so the horizon doesn't apply to it; the
    // guest may pick any month ahead (Tamara, 2026-10-10).
    if (listing.maxAdvanceBookingDays && listing.priceUnit !== 'MONTH') {
      const latest = Date.now() + listing.maxAdvanceBookingDays * 86_400_000;
      if (startsAt.getTime() > latest) {
        throw new BadRequestException(
          this.i18n.t('bookings.TOO_FAR_AHEAD', { args: { max: listing.maxAdvanceBookingDays } }),
        );
      }
    }

    // Dizajn 23: a defined slot has its own length, and working hours are booked by
    // the hour even when the price is per guest.
    if (!isDefinedSlots(listing)) {
      const durationUnit: PriceUnit = listing.bookingModel === 'PER_SLOT' ? 'HOUR' : listing.priceUnit;
      const unitCount = computeUnitCount(durationUnit, startsAt, endsAt);
      if (listing.minDuration && unitCount < listing.minDuration) {
        throw new BadRequestException(
          this.i18n.t('bookings.MIN_DURATION', {
            args: { min: listing.minDuration, unit: durationUnitWord(durationUnit, listing.minDuration) },
          }),
        );
      }
      if (listing.maxDuration && unitCount > listing.maxDuration) {
        throw new BadRequestException(
          this.i18n.t('bookings.MAX_DURATION', {
            args: { max: listing.maxDuration, unit: durationUnitWord(durationUnit, listing.maxDuration) },
          }),
        );
      }
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
   * same way; PER_SLOT + WORKING_HOURS prices each hour by the owner's
   * hourly rate windows/exceptions (T127), or per guest at the rate the term
   * starts at. Every other combination keeps the flat unitPrice x unitCount
   * calculation.
   */
  async computeTotals(
    listing: PricingListing,
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

    const priceLines = await this.resolvePriceLines(listing, startsAt, endsAt, pricePerUnit, unitCount, slotPrice, dto.monthCount);
    const unitPriceTotal = priceLines.reduce((sum, line) => sum + line.price * BigInt(line.count), 0n);

    const totalAmount = unitPriceTotal + guestFee + mandatoryFeesTotal + extraServicesTotal;
    const amountDue = listing.advancePercent ? (totalAmount * BigInt(listing.advancePercent)) / 100n : totalAmount;

    return { unitPriceTotal, priceLines, guestFee, mandatoryFeesTotal, extraServicesTotal, totalAmount, amountDue };
  }

  /**
   * The price of each unit the booking covers and the rule that set it,
   * grouped into "count × price" lines (Dizajn 34). Summed, they are what
   * computeTotals charges for the term itself.
   */
  private async resolvePriceLines(
    listing: PricingListing,
    startsAt: Date,
    endsAt: Date,
    pricePerUnit: bigint,
    unitCount: number,
    slotPrice: bigint | undefined,
    monthCount: number | undefined,
  ): Promise<PriceLine[]> {
    if (slotPrice) return [{ count: unitCount, price: pricePerUnit, kind: 'BASE' }];
    if (listing.priceUnit === 'NIGHT' || listing.priceUnit === 'DAY') {
      return groupPriceLines(await this.availability.getNightlyPrices(listing.id, startsAt, endsAt, listing.price, listing.weekendPrice));
    }
    if (listing.priceUnit === 'MONTH' && monthCount) {
      return groupPriceLines(await this.availability.getMonthlyPrices(listing.id, startsAt, monthCount, listing.price));
    }
    // T127: each hour of the term at its own rate (Tamara, 2026-10-09). T138
    // took away working hours priced per guest, and T126 the stay billed by
    // the hour, so every other term is a count of units at one price.
    if (isWorkingHours(listing) && listing.priceUnit === 'HOUR') {
      return groupPriceLines(
        await this.availability.getWorkingHoursPrices(listing.id, startsAt, endsAt, listing.price, listing.weekendPrice),
      );
    }
    return [{ count: unitCount, price: pricePerUnit, kind: 'BASE' }];
  }

  /**
   * "Kapacitet ljudi" (Nekretnine, Prostori za proslave) and "Kapacitet dece"
   * (Igraonice) from wizard step 6 are CategoryAttributes separate from the
   * maxGuests set in step 4. Dizajn 23: both cap the guests, so the lower applies.
   */
  async getGuestCapacity(listingId: string, maxGuests: number | null): Promise<number | null> {
    const capacityAttrs = await this.prisma.listingAttribute.findMany({
      where: { listingId, attribute: { key: { in: GUEST_CAPACITY_ATTRIBUTE_KEYS } }, valueNumber: { not: null } },
      select: { valueNumber: true },
    });
    const guestCaps = [maxGuests, ...capacityAttrs.map((attr) => Number(attr.valueNumber))].filter(
      (cap): cap is number => cap != null && cap > 0,
    );
    return guestCaps.length ? Math.min(...guestCaps) : null;
  }

  /** T127: "children", "people" or "guests" for a listing's category (the admin's booking page). */
  async getGuestUnit(categoryId: string): Promise<GuestUnit> {
    return (await getGuestUnits(this.taxonomy, [categoryId])).get(categoryId) ?? 'guests';
  }

  /** T83 — live total for whatever the guest currently has selected, before they submit. Reads only, nothing persisted. */
  async quotePrice(listingId: string, dto: CreateBookingRequestDto) {
    const listing = await this.prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
    if (listing.bookingModel === 'NO_BOOKING') {
      throw new BadRequestException(this.i18n.t('errors.LISTING_NOT_BOOKABLE'));
    }
    const { startsAt, endsAt, slotPrice } = await this.resolveRequestedTerm(listing, dto);
    const pricePerUnit = slotPrice ?? listing.price;
    const unitCount = resolvePricingUnitCount(listing.priceUnit, startsAt, endsAt, dto);
    const totals = await this.computeTotals(listing, startsAt, endsAt, pricePerUnit, unitCount, slotPrice, dto);
    return {
      priceUnit: listing.priceUnit,
      pricePerUnit: paraToRsd(pricePerUnit),
      unitCount,
      // Dizajn 40: the request page's "Cena" rows, the same lines the booking keeps (Dizajn 34).
      priceLines: totals.priceLines.map((line) => ({ count: line.count, price: paraToRsd(line.price), kind: line.kind })),
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

    // T76 — branch on the booking's own resolved method, not the listing's
    // setting: a "Oba" listing's paymentMethod is never CASH, so this used
    // to always fall through to the QR/online path regardless of what the
    // guest actually chose.
    if (booking.paymentMethod === 'CASH') {
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
    const deadlineHours = listing.paymentDeadlineHours ?? DEFAULT_PAYMENT_DEADLINE_HOURS;
    const paymentDeadline = new Date(Date.now() + deadlineHours * 3600_000);

    // T142: an account that cannot make a valid code leaves the QR out
    // rather than fail a booking that is already saved; the guest still gets
    // the details as text. Accounts are checked when they are saved.
    const { qrPayload } = bookingBankTransfer(booking, { ...owner, bankAccount: owner.bankAccount }, listing.title);

    const updated = await this.changeStatus(booking, 'AWAITING_PAYMENT', null, { paymentDeadline, ipsQrData: qrPayload }, true);
    if (!updated) throw new BadRequestException(this.i18n.t('bookings.STATE_CHANGED'));
    this.events.emit('booking.awaiting_payment', { bookingId: booking.id });
    return this.serialize(updated);
  }

  /**
   * T142: drawn from the booking as it stands, like bankTransferDetails, so a
   * code stored before the fix (or before the owner corrected the account)
   * is never the one a guest scans.
   */
  async getIpsQrImage(userId: string, bookingId: string): Promise<string> {
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: { listing: { select: { title: true } }, owner: { select: PAYEE_SELECT } },
    });
    if (booking.guestId !== userId && booking.ownerId !== userId) throw new ForbiddenException();
    const { bankAccount } = booking.owner;
    if (booking.status !== 'AWAITING_PAYMENT' || booking.paymentMethod === 'CASH' || !bankAccount) throw new NotFoundException();
    const { qrPayload } = bookingBankTransfer(booking, { ...booking.owner, bankAccount }, booking.listing.title);
    if (!qrPayload) throw new NotFoundException();
    return QRCode.toDataURL(qrPayload, IPS_QR_IMAGE_OPTIONS);
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
    // A mark the admin overturned (T90) may be set again; the guest can object
    // to the new one, which disputeNoShow reads from this flag.
    const updated = await this.applyStatus(booking, 'NO_SHOW', ownerId, { noShowDisputed: false });
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

  /**
   * R "gost otkaze posle uplate -> blokirano": a paid booking is never the
   * guest's to cancel. Dizajn 39 lets them cancel a confirmed cash booking
   * while its free cancellation lasts (canGuestCancel).
   */
  async cancelByGuest(guestId: string, bookingId: string, dto: CancelBookingDto) {
    const booking = await this.assertGuestAccess(guestId, bookingId, ['REQUESTED', 'AWAITING_PAYMENT', 'CONFIRMED']);
    if (!canGuestCancel(booking)) {
      throw new BadRequestException(this.i18n.t('bookings.GUEST_CANCELLATION_CLOSED'));
    }
    await this.availability.releaseTermsForBooking(booking.id);
    const updated = await this.applyStatus(booking, 'CANCELLED', guestId, { cancellationReason: dto.reason });
    this.events.emit('booking.cancelled_by_guest', { bookingId: booking.id });
    return updated;
  }

  /**
   * One objection per no-show mark. The page hides the button once the mark
   * is disputed, but the API used to file another dispute (and mail every
   * admin again) on each call. The flag is set only while it is still clear,
   * so of two calls at once one files the dispute and the other is refused.
   */
  async disputeNoShow(guestId: string, bookingId: string, dto: DisputeNoShowDto) {
    const booking = await this.assertGuestAccess(guestId, bookingId, ['NO_SHOW']);
    const dispute = await this.prisma.$transaction(async (tx) => {
      const flagged = await tx.booking.updateMany({
        where: { id: booking.id, noShowDisputed: false },
        data: { noShowDisputed: true },
      });
      if (flagged.count === 0) throw new BadRequestException(this.i18n.t('bookings.NO_SHOW_ALREADY_DISPUTED'));
      return tx.dispute.create({
        data: {
          type: 'DISPUTED_NO_SHOW',
          bookingId: booking.id,
          listingId: booking.listingId,
          submittedByUserId: guestId,
          description: dto.explanation,
        },
      });
    });
    this.events.emit('booking.no_show_disputed', { bookingId: booking.id, disputeId: dispute.id });
    return { message: this.i18n.t('common.SUCCESS') };
  }

  /**
   * T90 — the one DisputeOutcome that decides about the BOOKING instead of
   * the account (Ch.6.7/ADR-019 is about the other outcomes, which still
   * never touch a booking). Called from AdminService.resolveDispute() when
   * the admin picks OVERTURN_NO_SHOW. Re-locking the term can fail if
   * someone else booked those exact dates in the time since the no-show
   * freed them (T88) — that's surfaced to the admin rather than silently
   * leaving the booking NO_SHOW with no explanation.
   */
  async overturnNoShow(bookingId: string, adminId: string) {
    const booking = await this.prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    if (booking.status !== 'NO_SHOW') {
      throw new BadRequestException(this.i18n.t('bookings.INVALID_STATE', { args: { status: booking.status } }));
    }
    try {
      await this.availability.lockTerm(booking.listingId, booking.startsAt, booking.endsAt, 'BOOKING', { bookingId: booking.id });
    } catch {
      throw new BadRequestException(this.i18n.t('bookings.TERM_NO_LONGER_AVAILABLE'));
    }
    const updated = await this.applyStatus(booking, 'CONFIRMED', adminId);
    this.events.emit('booking.no_show_overturned', { bookingId: booking.id });
    return updated;
  }

  /**
   * T94: one open report per booking. The button used to stay after a
   * report, so every press filed another dispute and mailed every admin
   * again. Once the admin closes it, a booking still waiting for the payment
   * can be reported again. The booking row is locked first, so two reports
   * sent at once take turns and the second one finds the first.
   *
   * An open report holds the booking past its deadline (expireUnpaidBookings),
   * so a new report has to come in before the deadline. That also keeps a
   * guest from holding an overdue booking again by reporting anew once the
   * admin has closed the last report.
   */
  async disputeUnconfirmedPayment(guestId: string, bookingId: string) {
    const booking = await this.assertGuestAccess(guestId, bookingId, ['AWAITING_PAYMENT']);
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Booking" WHERE "id" = ${booking.id}::uuid FOR UPDATE`;
      if ((await tx.dispute.count({ where: openPaymentReportWhere(booking.id) })) > 0) {
        throw new BadRequestException(this.i18n.t('bookings.PAYMENT_ALREADY_REPORTED'));
      }
      if (booking.paymentDeadline && booking.paymentDeadline.getTime() <= Date.now()) {
        throw new BadRequestException(this.i18n.t('bookings.PAYMENT_DEADLINE_PASSED'));
      }
      await tx.dispute.create({
        data: {
          type: 'UNCONFIRMED_PAYMENT',
          bookingId: booking.id,
          listingId: booking.listingId,
          submittedByUserId: guestId,
          description: 'Guest reports payment was sent but not confirmed by the owner',
        },
      });
    });
    this.events.emit('booking.payment_disputed', { bookingId: booking.id });
    return { message: this.i18n.t('common.SUCCESS') };
  }

  // -- Reads ---------------------------------------------------------

  async getOne(userId: string, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        listing: {
          select: {
            title: true,
            slug: true,
            address: true,
            paymentMethod: true,
            maxGuests: true,
            categoryId: true,
            status: true,
            pickupTime: true,
            returnTime: true,
            paymentDeadlineHours: true,
            bookingModel: true,
            city: { select: { name: true } },
            cityArea: { select: { name: true } },
            subscription: { select: { package: { select: { hasMessaging: true, hasBookings: true } } } },
            photos: {
              where: { pendingRemoval: false, versionId: null },
              orderBy: [{ isCover: 'desc' }, { displayOrder: 'asc' }],
              take: 1,
              select: { url: true },
            },
          },
        },
        guest: { select: { firstName: true, lastName: true, phone: true } },
        owner: { select: { ...PAYEE_SELECT, phone: true, anonymizedAt: true } },
      },
    });
    if (!booking) throw new NotFoundException();
    if (booking.guestId !== userId && booking.ownerId !== userId) throw new ForbiddenException();

    // T79 — "ko je otkazao i kada", for both CANCELLED and REJECTED: the
    // BookingHistory row for the transition into the current status already
    // has changedByUserId/changedAt, it just was never surfaced to the client.
    // Dizajn 34: the same row dates every state on the owner's card
    // ("Potvrđena 9. 9. 2026.").
    const statusEntry = await this.prisma.bookingHistory.findFirst({
      where: { bookingId: booking.id, newStatus: booking.status },
      orderBy: { changedAt: 'desc' },
    });
    let cancellation: { by: 'GUEST' | 'OWNER' | null; at: Date } | null = null;
    if ((booking.status === 'CANCELLED' || booking.status === 'REJECTED') && statusEntry) {
      cancellation = {
        by:
          statusEntry.changedByUserId === booking.guestId
            ? 'GUEST'
            : statusEntry.changedByUserId === booking.ownerId
              ? 'OWNER'
              : null,
        at: statusEntry.changedAt,
      };
    }

    // T91 — the QR already encodes these exact fields (see moveToAwaitingPayment);
    // recomputing them here as plain text isn't a new leak, just the same data
    // in a form a guest can actually copy/read at a bank counter.
    // T94 — "since" the payment window opened, so the frontend can gate the
    // unconfirmed-payment dispute button on being meaningfully into that
    // window instead of showing it the instant it appears.
    let bankTransferDetails: { recipientName: string; recipientAccount: string; amountRsd: number | null; purpose: string; referenceNumber: string } | null = null;
    let awaitingPaymentSince: Date | null = null;
    if (booking.status === 'AWAITING_PAYMENT') {
      const { bankAccount } = booking.owner;
      if (booking.paymentMethod !== 'CASH' && bankAccount) {
        bankTransferDetails = bookingBankTransfer(booking, { ...booking.owner, bankAccount }, booking.listing?.title ?? '').details;
      }
      awaitingPaymentSince = statusEntry?.changedAt ?? null;
    }

    const { listing } = booking;
    const isOwnerViewing = booking.ownerId === userId;
    const [guestUnits, guestCapacity, categoryNames, messaging, openPaymentReports, decidedNoShowDisputes, changeRequests, changeDeadlineHours] = await Promise.all([
      getGuestUnits(this.taxonomy, [listing.categoryId]),
      this.getGuestCapacity(booking.listingId, listing.maxGuests),
      this.taxonomy.getCategoryNames([listing.categoryId]),
      isOwnerViewing ? null : this.getGuestMessaging(booking),
      // While a report is open the guest's page drops "Prijavi da uplata nije
      // potvrđena", and both sides are told the booking waits past its deadline.
      booking.status === 'AWAITING_PAYMENT' ? this.prisma.dispute.count({ where: openPaymentReportWhere(booking.id) }) : 0,
      // T90: once the admin has decided and the mark stood, neither page
      // still says the decision is pending.
      booking.status === 'NO_SHOW' && booking.noShowDisputed
        ? this.prisma.dispute.count({ where: { bookingId: booking.id, type: 'DISPUTED_NO_SHOW', status: 'RESOLVED' } })
        : 0,
      // T136: the latest requests to move the booking.
      this.prisma.bookingChangeRequest.findMany({ where: { bookingId: booking.id }, orderBy: { createdAt: 'desc' }, take: 5 }),
      readChangeDeadlineHours(this.prisma),
    ]);
    const serialized = this.serialize(booking, userId);

    return {
      ...serialized,
      // Dizajn 34: the card's title reads "Igraonica Balončići - Vračar", and
      // "gost je izabrao keš" only when the listing offered both methods.
      // Dizajn 39 (528:514): "Sobe · Kopaonik, Suvo Rudište" under the guest's
      // title, a link to the listing only while it is live, and a vehicle's
      // fixed pickup and return times under the two dates.
      listing: {
        ...serialized.listing,
        place: listing.cityArea?.name ?? listing.city?.name ?? null,
        acceptsBothPaymentMethods: listing.paymentMethod === 'BOTH',
        status: listing.status,
        categoryName: categoryNames.get(listing.categoryId) ?? null,
        city: listing.city?.name ?? null,
        area: listing.cityArea?.name ?? null,
        pickupTime: listing.pickupTime,
        returnTime: listing.returnTime,
        // Dizajn 41 (391:543, 391:670): the photo on the sent request and the
        // hours to pay once a transfer is approved.
        coverPhotoUrl: listing.photos?.[0]?.url ?? null,
        paymentDeadlineHours: listing.paymentDeadlineHours ?? DEFAULT_PAYMENT_DEADLINE_HOURS,
      },
      guestUnit: guestUnits.get(listing.categoryId),
      guestCapacity,
      statusChangedAt: statusEntry?.changedAt ?? booking.createdAt,
      cancellationPolicy: {
        type: booking.cancellationPolicyType,
        threshold: booking.cancellationThreshold,
        freeUntil: getFreeCancellationUntil(booking),
      },
      paymentDisputed: openPaymentReports > 0,
      noShowDisputeDecided: decidedNoShowDisputes > 0,
      // T136: a change of term waiting for the owner, the last one decided, and
      // whether the guest may ask for one (a live listing, before the deadline).
      change: describeBookingChange(booking, changeRequests, {
        deadlineHours: changeDeadlineHours,
        listingBookable:
          listing.status === ListingStatus.ACTIVE && listing.bookingModel !== 'NO_BOOKING' && !!listing.subscription?.package.hasBookings,
        asGuest: booking.guestId === userId,
      }),
      ...(isOwnerViewing
        ? { guestShortName: shortName(booking.guest) }
        : // The guest already sees "Dragan S." on the listing's page; the full
          // name, phone and address still wait for phoneUnlocked (serialize).
          { ownerShortName: shortName(booking.owner), canCancel: canGuestCancel(booking), messaging }),
      ...(cancellation ? { cancellation } : {}),
      // Dizajn 41: a request nobody answered expires too, not only an unpaid booking.
      ...(booking.status === 'EXPIRED' && statusEntry?.oldStatus ? { expiredFrom: statusEntry.oldStatus } : {}),
      ...(bankTransferDetails ? { bankTransferDetails } : {}),
      ...(awaitingPaymentSince ? { awaitingPaymentSince } : {}),
    };
  }

  async listMine(userId: string, role: 'guest' | 'owner', status?: BookingStatus) {
    const bookings = await this.prisma.booking.findMany({
      where: {
        ...(role === 'guest' ? { guestId: userId } : { ownerId: userId }),
        ...(status ? { status } : {}),
      },
      include: {
        listing: {
          select: {
            title: true,
            slug: true,
            categoryId: true,
            city: { select: { name: true } },
            cityArea: { select: { name: true } },
          },
        },
        guest: { select: { firstName: true, lastName: true } },
        owner: { select: { firstName: true, lastName: true } },
        _count: { select: { changeRequests: { where: { status: 'PENDING' } } } },
      },
    });
    const guestUnits = await getGuestUnits(this.taxonomy, bookings.map((b) => b.listing.categoryId));

    // Dizajn 34: a row names the listing with its area and, for the owner,
    // the guest ("Milica J. · 18 dece"); Dizajn 39 (380:671) names the owner
    // on the guest's rows ("Vlasnik: Dragan S."), as the listing's page does.
    return bookings.sort(compareForList).map(({ guest, owner, listing, _count, ...booking }) => ({
      ...this.serialize(booking),
      listing: { title: listing.title, slug: listing.slug, place: listing.cityArea?.name ?? listing.city?.name ?? null },
      guestUnit: guestUnits.get(listing.categoryId),
      // T136: the rows say when the guest waits for an answer about another term.
      hasPendingChange: _count.changeRequests > 0,
      ...(role === 'owner' ? { guestShortName: shortName(guest) } : { ownerShortName: shortName(owner) }),
    }));
  }

  /**
   * Dizajn 39: "Pošalji poruku vlasniku" opens the guest's thread about this
   * listing, the one about this booking first, or starts one where
   * MessagingService.startConversation would accept it (a live listing whose
   * package has messaging, an owner whose account still exists).
   */
  private async getGuestMessaging(booking: {
    id: string;
    listingId: string;
    guestId: string;
    listing: { status: ListingStatus; subscription: { package: { hasMessaging: boolean } } | null };
    owner: { anonymizedAt: Date | null };
  }) {
    const threads = await this.prisma.conversation.findMany({
      where: { listingId: booking.listingId, guestId: booking.guestId },
      select: { id: true, bookingId: true },
      orderBy: { lastMessageAt: { sort: 'desc', nulls: 'last' } },
    });
    const thread = threads.find((t) => t.bookingId === booking.id) ?? threads[0] ?? null;
    return {
      conversationId: thread?.id ?? null,
      canStart:
        !thread &&
        booking.listing.status === ListingStatus.ACTIVE &&
        !!booking.listing.subscription?.package.hasMessaging &&
        !booking.owner.anonymizedAt,
    };
  }

  // -- Scheduled jobs --------------------------------------------------

  /**
   * R59/status table: payment window closed, term released, guest and owner notified.
   * A guest's open report that the owner has not confirmed the payment holds
   * the booking until the admin closes the report, at most seven days past
   * the deadline (isHeldByPaymentReport); the next run after that expires it.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async expireUnpaidBookings() {
    const now = Date.now();
    const overdue = await this.prisma.booking.findMany({
      where: { status: 'AWAITING_PAYMENT', paymentDeadline: { lt: new Date(now) } },
      include: { disputes: { where: OPEN_PAYMENT_REPORT, select: { id: true } } },
    });
    for (const booking of overdue) {
      if (isHeldByPaymentReport(booking, now)) continue;
      // An owner who confirmed the payment meanwhile keeps the booking and its term.
      if (!(await this.changeStatus(booking, 'EXPIRED', null, {}, true))) continue;
      await this.availability.releaseTermsForBooking(booking.id);
      this.events.emit('booking.expired', { bookingId: booking.id });
    }
  }

  /**
   * Dizajn 41: a request the owner has not answered expires once its hours
   * are up (Setting booking_request_response_hours), or when its term begins
   * if that comes first (getRequestExpiresAt). The term is free again and
   * both sides are told.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async expireUnansweredRequests() {
    const now = Date.now();
    const hours = await readRequestResponseHours(this.prisma);
    const due = await this.prisma.booking.findMany({
      where: {
        status: 'REQUESTED',
        OR: [{ createdAt: { lte: new Date(now - hours * 3600_000) } }, { startsAt: { lte: new Date(now) } }],
      },
    });
    for (const booking of due) {
      // An owner who answered, or a guest who withdrew, meanwhile keeps that answer.
      if (!(await this.changeStatus(booking, 'EXPIRED', null, {}, true))) continue;
      await this.availability.releaseTermsForBooking(booking.id);
      this.events.emit('booking.request_expired', { bookingId: booking.id });
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
      if (!(await this.changeStatus(booking, 'COMPLETED', null, {}, true))) continue;
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

  /**
   * Ch.22.4 "Podsetnik na pola roka" / "Podsetnik pred istek": one nudge at the halfway point, one on the last day.
   * None while the guest's report of an unconfirmed payment is open: they say
   * they paid, and the booking does not expire at the deadline meanwhile.
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async sendPaymentDeadlineReminders() {
    const candidates = await this.prisma.booking.findMany({
      where: { status: 'AWAITING_PAYMENT', paymentDeadline: { not: null }, disputes: { none: OPEN_PAYMENT_REPORT } },
      include: { listing: { select: { paymentDeadlineHours: true } } },
    });
    const now = Date.now();
    for (const booking of candidates) {
      if (!booking.paymentDeadline) continue;
      const totalHours = booking.listing.paymentDeadlineHours ?? DEFAULT_PAYMENT_DEADLINE_HOURS;
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
    const updated = await this.changeStatus(booking, newStatus, changedByUserId, extra, automatic);
    if (!updated) throw new BadRequestException(this.i18n.t('bookings.STATE_CHANGED'));
    return this.serialize(updated);
  }

  /**
   * Moves a booking on only from the status it was read in, so two changes
   * racing each other never overwrite one another (Dizajn 41: a request can
   * now expire while its owner answers it). The later one finds nothing to
   * change and gets null.
   */
  private async changeStatus(
    booking: Booking,
    newStatus: BookingStatus,
    changedByUserId: string | null,
    extra: Record<string, unknown> = {},
    automatic = false,
  ): Promise<Booking | null> {
    let updated: Booking;
    try {
      updated = await this.prisma.booking.update({
        where: { id: booking.id, status: booking.status },
        data: { status: newStatus, ...extra },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') return null;
      throw err;
    }
    await this.recordHistory(booking.id, booking.status, newStatus, changedByUserId, automatic);
    return updated;
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
      priceBreakdown: readPriceBreakdown(booking),
      ...(isOwnerViewing ? { guestName: `${guest!.firstName} ${guest!.lastName}` } : {}),
      ...(showGuestPhone ? { guestPhone: guest!.phone } : {}),
      ...(showOwnerContact ? { ownerName: `${owner!.firstName} ${owner!.lastName}`, ownerPhone: owner!.phone } : {}),
    };
  }
}

/**
 * T111 — how many priced units this booking covers, for whichever unit the
 * listing charges by. "Po mesecu" (Dodavanje Oglasa spec §3/§4) books in
 * whole calendar months the guest picked directly (monthCount), not an
 * approximation derived from the date span — Sep 1 to Dec 1 must be exactly
 * 3, not round(91/30). "Po gostu" counts guests instead of time at all; the
 * booking's own time-slot rules (assertTermRules) are untouched by this —
 * only how the total is priced changes, never how the term itself works.
 */
export function resolvePricingUnitCount(
  priceUnit: PriceUnit,
  startsAt: Date,
  endsAt: Date,
  dto: Pick<CreateBookingRequestDto, 'monthCount' | 'guestCount'>,
): number {
  if (dto.monthCount) return dto.monthCount;
  if (priceUnit === 'GUEST') return Math.max(1, dto.guestCount || 1);
  return computeUnitCount(priceUnit, startsAt, endsAt);
}

/** Dizajn 34: units with the same price and rule become one line, in the order they first appear. */
function groupPriceLines(units: PricedUnit[]): PriceLine[] {
  const lines: PriceLine[] = [];
  for (const unit of units) {
    const line = lines.find((l) => l.price === unit.price && l.kind === unit.kind);
    if (line) line.count += 1;
    else lines.push({ ...unit, count: 1 });
  }
  return lines;
}

/**
 * Dizajn 34: the lines under a booking's total and what fees and extra
 * services added to them, in RSD. A booking made before the lines were kept
 * gets one line only when its unit price times the count is exactly what its
 * units cost; otherwise `lines` is null and the card names the units alone.
 * `extras` is null when extra services were chosen and their total wasn't kept.
 */
function readPriceBreakdown(booking: Pick<Booking, 'fees' | 'totalAmount' | 'pricePerUnit' | 'unitCount'>) {
  const fees = (booking.fees ?? {}) as StoredFees;
  const extras = toPara(fees.mandatory) + toPara(fees.guestFee) + toPara(fees.extraServicesTotal);
  if (fees.priceLines) {
    return {
      lines: fees.priceLines.map((line) => ({ count: line.count, price: paraToRsd(BigInt(line.price)), kind: line.kind })),
      extras: paraToRsd(extras),
    };
  }
  if (fees.extraServicesTotal === undefined && fees.extraServices?.length) return { lines: null, extras: null };
  const exact = booking.pricePerUnit * BigInt(booking.unitCount) + extras === booking.totalAmount;
  return {
    lines: exact ? [{ count: booking.unitCount, price: paraToRsd(booking.pricePerUnit), kind: 'BASE' as PriceKind }] : null,
    extras: paraToRsd(extras),
  };
}

function toPara(value: string | undefined): bigint {
  return value ? BigInt(value) : 0n;
}

/** OPEN_STATUS_ORDER first, soonest term first; the rest after them, latest term first. */
function compareForList(
  a: Pick<Booking, 'status' | 'startsAt' | 'createdAt'>,
  b: Pick<Booking, 'status' | 'startsAt' | 'createdAt'>,
): number {
  const rank = (status: BookingStatus) => {
    const index = OPEN_STATUS_ORDER.indexOf(status);
    return index === -1 ? OPEN_STATUS_ORDER.length : index;
  };
  const byStatus = rank(a.status) - rank(b.status);
  if (byStatus) return byStatus;
  const soonestFirst = a.startsAt.getTime() - b.startsAt.getTime();
  const byTerm = rank(a.status) < OPEN_STATUS_ORDER.length ? soonestFirst : -soonestFirst;
  return byTerm || b.createdAt.getTime() - a.createdAt.getTime();
}

/** Dizajn 23: a defined slot carries its own length, so the duration and gap rules skip it. */
export function isDefinedSlots(listing: { bookingModel: string; slotSubmode: string | null }): boolean {
  return listing.bookingModel === 'PER_SLOT' && listing.slotSubmode === 'DEFINED_SLOTS';
}

export function isWorkingHours(listing: { bookingModel: string; slotSubmode: string | null }): boolean {
  return listing.bookingModel === 'PER_SLOT' && listing.slotSubmode === 'WORKING_HOURS';
}

/**
 * T117: "Po danu" (vehicles, machines) has no gap after a booking; the
 * pickup and return times do that job, and the return day stays free for
 * the next pickup (Tamara, 2026-10-09).
 */
export function isDayStay(listing: { bookingModel: string; priceUnit: PriceUnit }): boolean {
  return listing.bookingModel === 'PER_STAY' && listing.priceUnit === 'DAY';
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
