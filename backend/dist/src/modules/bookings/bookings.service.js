"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookingsService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const event_emitter_1 = require("@nestjs/event-emitter");
const nestjs_i18n_1 = require("nestjs-i18n");
const QRCode = __importStar(require("qrcode"));
const prisma_service_1 = require("../../prisma/prisma.service");
const availability_service_1 = require("../availability/availability.service");
const ips_qr_1 = require("../../common/utils/ips-qr");
const money_1 = require("../../common/utils/money");
let BookingsService = class BookingsService {
    constructor(prisma, availability, i18n, events) {
        this.prisma = prisma;
        this.availability = availability;
        this.i18n = i18n;
        this.events = events;
    }
    async createRequest(guestId, listingId, dto) {
        const listing = await this.prisma.listing.findUniqueOrThrow({
            where: { id: listingId },
            include: { subscription: { include: { package: true } } },
        });
        const guest = await this.prisma.user.findUniqueOrThrow({ where: { id: guestId } });
        if (!guest.emailVerified)
            throw new common_1.ForbiddenException(this.i18n.t('errors.EMAIL_NOT_VERIFIED'));
        if (guest.restrictedUntil && guest.restrictedUntil.getTime() > Date.now()) {
            throw new common_1.ForbiddenException(this.i18n.t('errors.ACCOUNT_RESTRICTED'));
        }
        if (listing.status !== 'ACTIVE')
            throw new common_1.BadRequestException(this.i18n.t('errors.LISTING_NOT_BOOKABLE'));
        if (listing.bookingModel === 'NO_BOOKING')
            throw new common_1.BadRequestException(this.i18n.t('errors.LISTING_NOT_BOOKABLE'));
        if (listing.userId === guestId)
            throw new common_1.BadRequestException(this.i18n.t('errors.CANNOT_BOOK_OWN_LISTING'));
        if (!listing.subscription?.package.hasBookings) {
            throw new common_1.ForbiddenException(this.i18n.t('errors.PACKAGE_FEATURE_NOT_INCLUDED'));
        }
        const { startsAt, endsAt, slotPrice } = await this.resolveRequestedTerm(listing, dto);
        this.assertTermRules(listing, startsAt, endsAt, dto.guestCount);
        const pricePerUnit = slotPrice ?? listing.price;
        const unitCount = computeUnitCount(listing.priceUnit, startsAt, endsAt);
        const extraServicesTotal = await this.resolveExtraServicesTotal(listingId, dto.extraServices);
        const mandatoryFeesTotal = sumMandatoryFees(listing.mandatoryFees);
        const guestFee = listing.pricePerGuest && dto.guestCount ? listing.pricePerGuest * BigInt(dto.guestCount) : 0n;
        const unitPriceTotal = !slotPrice && (listing.priceUnit === 'NIGHT' || listing.priceUnit === 'DAY')
            ? (await this.availability.getNightlyPrices(listingId, startsAt, endsAt, listing.price, listing.weekendPrice)).reduce((sum, p) => sum + p, 0n)
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
                },
                totalAmount,
                amountDue,
                paymentMethod: listing.paymentMethod ?? 'CASH',
                cancellationTermsSnapshot: listing.cancellationTerms,
            },
        });
        try {
            await this.availability.lockTerm(listingId, startsAt, endsAt, 'BOOKING', { bookingId: booking.id });
        }
        catch (err) {
            await this.prisma.booking.delete({ where: { id: booking.id } });
            throw err;
        }
        if (listing.gapAfterMinutes) {
            await this.availability.applyGapAfter(listingId, endsAt, listing.gapAfterMinutes);
        }
        await this.recordHistory(booking.id, null, 'REQUESTED', guestId, false);
        this.events.emit('booking.requested', { bookingId: booking.id });
        if (listing.paymentMethod !== 'CASH' && !listing.requiresApproval) {
            return this.moveToAwaitingPayment(booking, listing);
        }
        return this.serialize(booking);
    }
    async resolveRequestedTerm(listing, dto) {
        if (dto.definedSlotId) {
            const slot = await this.prisma.definedSlot.findFirst({
                where: { id: dto.definedSlotId, listingId: listing.id },
            });
            if (!slot)
                throw new common_1.NotFoundException(this.i18n.t('errors.TERM_NOT_AVAILABLE'));
            return { startsAt: slot.startsAt, endsAt: slot.endsAt, slotPrice: slot.price ?? undefined };
        }
        if (!dto.startsAt || !dto.endsAt) {
            throw new common_1.BadRequestException('startsAt/endsAt are required unless booking a defined slot');
        }
        return { startsAt: new Date(dto.startsAt), endsAt: new Date(dto.endsAt) };
    }
    assertTermRules(listing, startsAt, endsAt, guestCount) {
        if (endsAt <= startsAt)
            throw new common_1.BadRequestException(this.i18n.t('bookings.END_BEFORE_START'));
        if (listing.earliestBookingHours) {
            const earliest = Date.now() + listing.earliestBookingHours * 3600_000;
            if (startsAt.getTime() < earliest) {
                throw new common_1.BadRequestException(this.i18n.t('bookings.TOO_SOON'));
            }
        }
        const unitCount = computeUnitCount(listing.priceUnit, startsAt, endsAt);
        if (listing.minDuration && unitCount < listing.minDuration) {
            throw new common_1.BadRequestException(this.i18n.t('bookings.MIN_DURATION', { args: { min: listing.minDuration } }));
        }
        if (listing.maxDuration && unitCount > listing.maxDuration) {
            throw new common_1.BadRequestException(this.i18n.t('bookings.MAX_DURATION', { args: { max: listing.maxDuration } }));
        }
        if ((listing.minGuests || listing.maxGuests) && guestCount !== undefined) {
            const min = listing.minGuests ?? 1;
            const max = listing.maxGuests ?? Number.MAX_SAFE_INTEGER;
            if (guestCount < min || guestCount > max) {
                throw new common_1.BadRequestException(this.i18n.t('errors.GUEST_COUNT_OUT_OF_RANGE', { args: { min, max: listing.maxGuests ?? min } }));
            }
        }
    }
    async resolveExtraServicesTotal(listingId, selections) {
        if (!selections?.length)
            return 0n;
        const services = await this.prisma.listingExtraService.findMany({
            where: { listingId, id: { in: selections.map((s) => s.serviceId) } },
        });
        let total = 0n;
        for (const selection of selections) {
            const service = services.find((s) => s.id === selection.serviceId);
            if (!service)
                continue;
            const max = service.maxQuantity ?? Infinity;
            const qty = Math.min(selection.quantity, max);
            total += service.price * BigInt(qty);
        }
        return total;
    }
    async approveRequest(ownerId, bookingId) {
        const booking = await this.assertOwnerAccess(ownerId, bookingId, ['REQUESTED']);
        const listing = await this.prisma.listing.findUniqueOrThrow({ where: { id: booking.listingId } });
        if (listing.paymentMethod === 'CASH') {
            const updated = await this.applyStatus(booking, 'CONFIRMED', ownerId, {
                paymentConfirmedAt: new Date(),
                phoneUnlocked: true,
            });
            this.events.emit('booking.confirmed', { bookingId: booking.id, viaCash: true });
            return updated;
        }
        return this.moveToAwaitingPayment(booking, listing);
    }
    async moveToAwaitingPayment(booking, listing) {
        const owner = await this.prisma.user.findUniqueOrThrow({ where: { id: listing.userId } });
        if (!owner.bankAccount) {
            throw new common_1.BadRequestException(this.i18n.t('bookings.OWNER_NO_BANK_ACCOUNT'));
        }
        const deadlineHours = listing.paymentDeadlineHours ?? 48;
        const paymentDeadline = new Date(Date.now() + deadlineHours * 3600_000);
        const qrPayload = (0, ips_qr_1.buildIpsQrPayload)({
            recipientAccount: owner.bankAccount,
            recipientName: `${owner.firstName} ${owner.lastName}`,
            amountRsd: (0, money_1.paraToRsd)(booking.amountDue) ?? 0,
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
    async getIpsQrImage(userId, bookingId) {
        const booking = await this.prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
        if (booking.guestId !== userId && booking.ownerId !== userId)
            throw new common_1.ForbiddenException();
        if (!booking.ipsQrData)
            throw new common_1.NotFoundException();
        return QRCode.toDataURL(booking.ipsQrData, { width: 320, margin: 1 });
    }
    async rejectRequest(ownerId, bookingId, dto) {
        const booking = await this.assertOwnerAccess(ownerId, bookingId, ['REQUESTED']);
        await this.availability.releaseTermsForBooking(booking.id);
        const updated = await this.applyStatus(booking, 'CANCELLED', ownerId, { cancellationReason: dto.reason ?? 'Rejected by owner' });
        this.events.emit('booking.rejected', { bookingId: booking.id });
        return updated;
    }
    async confirmPayment(ownerId, bookingId) {
        const booking = await this.assertOwnerAccess(ownerId, bookingId, ['AWAITING_PAYMENT']);
        const updated = await this.applyStatus(booking, 'CONFIRMED', ownerId, { paymentConfirmedAt: new Date(), phoneUnlocked: true });
        this.events.emit('booking.confirmed', { bookingId: booking.id, viaCash: false });
        return updated;
    }
    async markNoShow(ownerId, bookingId) {
        const booking = await this.assertOwnerAccess(ownerId, bookingId, ['CONFIRMED']);
        if (booking.startsAt.getTime() > Date.now()) {
            throw new common_1.BadRequestException(this.i18n.t('bookings.TOO_EARLY_FOR_NO_SHOW'));
        }
        const updated = await this.applyStatus(booking, 'NO_SHOW', ownerId);
        this.events.emit('booking.no_show', { bookingId: booking.id });
        return updated;
    }
    async cancelByOwner(ownerId, bookingId, dto) {
        const booking = await this.assertOwnerAccess(ownerId, bookingId, ['REQUESTED', 'AWAITING_PAYMENT', 'CONFIRMED']);
        await this.availability.releaseTermsForBooking(booking.id);
        const updated = await this.applyStatus(booking, 'CANCELLED', ownerId, { cancellationReason: dto.reason });
        this.events.emit('booking.cancelled_by_owner', { bookingId: booking.id });
        return updated;
    }
    async cancelByGuest(guestId, bookingId, dto) {
        const booking = await this.assertGuestAccess(guestId, bookingId, ['REQUESTED', 'AWAITING_PAYMENT']);
        await this.availability.releaseTermsForBooking(booking.id);
        const updated = await this.applyStatus(booking, 'CANCELLED', guestId, { cancellationReason: dto.reason });
        this.events.emit('booking.cancelled_by_guest', { bookingId: booking.id });
        return updated;
    }
    async disputeNoShow(guestId, bookingId, dto) {
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
    async disputeUnconfirmedPayment(guestId, bookingId) {
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
    async getOne(userId, bookingId) {
        const booking = await this.prisma.booking.findUnique({
            where: { id: bookingId },
            include: { listing: { select: { title: true, slug: true } }, guest: { select: { phone: true } } },
        });
        if (!booking)
            throw new common_1.NotFoundException();
        if (booking.guestId !== userId && booking.ownerId !== userId)
            throw new common_1.ForbiddenException();
        return this.serialize(booking, userId);
    }
    async listMine(userId, role, status) {
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
    async sendPaymentDeadlineReminders() {
        const candidates = await this.prisma.booking.findMany({
            where: { status: 'AWAITING_PAYMENT', paymentDeadline: { not: null } },
            include: { listing: { select: { paymentDeadlineHours: true } } },
        });
        const now = Date.now();
        for (const booking of candidates) {
            if (!booking.paymentDeadline)
                continue;
            const totalHours = booking.listing.paymentDeadlineHours ?? 48;
            const deadlineMs = booking.paymentDeadline.getTime();
            const halfPointMs = deadlineMs - (totalHours / 2) * 3600_000;
            const finalDayStartMs = deadlineMs - 24 * 3600_000;
            if (!booking.remindersSent.includes('payment_half') && now >= halfPointMs && now < deadlineMs) {
                await this.prisma.booking.update({ where: { id: booking.id }, data: { remindersSent: { push: 'payment_half' } } });
                this.events.emit('booking.payment_reminder_half', { bookingId: booking.id });
            }
            else if (totalHours > 24 &&
                !booking.remindersSent.includes('payment_final') &&
                now >= finalDayStartMs &&
                now < deadlineMs) {
                await this.prisma.booking.update({ where: { id: booking.id }, data: { remindersSent: { push: 'payment_final' } } });
                this.events.emit('booking.payment_reminder_final', { bookingId: booking.id });
            }
        }
    }
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
    async assertOwnerAccess(ownerId, bookingId, allowed) {
        const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
        if (!booking)
            throw new common_1.NotFoundException();
        if (booking.ownerId !== ownerId)
            throw new common_1.ForbiddenException();
        if (!allowed.includes(booking.status)) {
            throw new common_1.BadRequestException(this.i18n.t('bookings.INVALID_STATE', { args: { status: booking.status } }));
        }
        return booking;
    }
    async assertGuestAccess(guestId, bookingId, allowed) {
        const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
        if (!booking)
            throw new common_1.NotFoundException();
        if (booking.guestId !== guestId)
            throw new common_1.ForbiddenException();
        if (!allowed.includes(booking.status)) {
            throw new common_1.BadRequestException(this.i18n.t('bookings.INVALID_STATE', { args: { status: booking.status } }));
        }
        return booking;
    }
    async applyStatus(booking, newStatus, changedByUserId, extra = {}, automatic = false) {
        const updated = await this.prisma.booking.update({
            where: { id: booking.id },
            data: { status: newStatus, ...extra },
        });
        await this.recordHistory(booking.id, booking.status, newStatus, changedByUserId, automatic);
        return this.serialize(updated);
    }
    async recordHistory(bookingId, oldStatus, newStatus, changedByUserId, automatic) {
        await this.prisma.bookingHistory.create({
            data: { bookingId, oldStatus: oldStatus ?? undefined, newStatus, changedByUserId, automatic },
        });
    }
    serialize(booking, requestingUserId) {
        const { guest, ...rest } = booking;
        const showGuestPhone = !!guest && requestingUserId === booking.ownerId && booking.phoneUnlocked;
        return {
            ...rest,
            pricePerUnit: (0, money_1.paraToRsd)(booking.pricePerUnit),
            totalAmount: (0, money_1.paraToRsd)(booking.totalAmount),
            amountDue: (0, money_1.paraToRsd)(booking.amountDue),
            ...(showGuestPhone ? { guestPhone: guest.phone } : {}),
        };
    }
};
exports.BookingsService = BookingsService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_MINUTE),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], BookingsService.prototype, "expireUnpaidBookings", null);
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_10_MINUTES),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], BookingsService.prototype, "autoCompleteBookings", null);
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_30_MINUTES),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], BookingsService.prototype, "sendUnopenedRequestReminders", null);
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_10_MINUTES),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], BookingsService.prototype, "sendPaymentDeadlineReminders", null);
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_HOUR),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], BookingsService.prototype, "sendDayBeforeReminders", null);
exports.BookingsService = BookingsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        availability_service_1.AvailabilityService,
        nestjs_i18n_1.I18nService,
        event_emitter_1.EventEmitter2])
], BookingsService);
function computeUnitCount(priceUnit, startsAt, endsAt) {
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
function sumMandatoryFees(fees) {
    if (!Array.isArray(fees))
        return 0n;
    return fees.reduce((sum, fee) => sum + (0, money_1.rsdToPara)(Number(fee.amount ?? 0)), 0n);
}
//# sourceMappingURL=bookings.service.js.map