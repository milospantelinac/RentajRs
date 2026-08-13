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
exports.BookingEmailListener = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const event_emitter_1 = require("@nestjs/event-emitter");
const QRCode = __importStar(require("qrcode"));
const prisma_service_1 = require("../../../prisma/prisma.service");
const email_service_1 = require("../../../common/email/email.service");
const format_1 = require("../format");
let BookingEmailListener = class BookingEmailListener {
    constructor(prisma, email, config) {
        this.prisma = prisma;
        this.email = email;
        this.frontendUrl = config.get('frontendUrl');
    }
    async load(bookingId) {
        return this.prisma.booking.findUnique({
            where: { id: bookingId },
            include: { listing: true, guest: true, owner: true },
        });
    }
    bookingUrl(bookingId) {
        return `${this.frontendUrl}/rezervacije/${bookingId}`;
    }
    async onRequested({ bookingId }) {
        const b = await this.load(bookingId);
        if (!b)
            return;
        await Promise.all([
            this.email.send({
                key: 'booking_requested_guest',
                to: b.guest.email,
                language: b.guest.language,
                userId: b.guest.id,
                context: { oglas: b.listing.title },
                buttonUrl: this.bookingUrl(b.id),
            }),
            this.email.send({
                key: 'booking_requested_owner',
                to: b.owner.email,
                language: b.owner.language,
                userId: b.owner.id,
                context: { oglas: b.listing.title },
                buttonUrl: this.bookingUrl(b.id),
            }),
        ]);
    }
    async onUnopenedReminder({ bookingId }) {
        const b = await this.load(bookingId);
        if (!b)
            return;
        await this.email.send({
            key: 'booking_request_unopened_reminder',
            to: b.owner.email,
            language: b.owner.language,
            userId: b.owner.id,
            context: { oglas: b.listing.title },
            buttonUrl: this.bookingUrl(b.id),
        });
    }
    async onRejected({ bookingId }) {
        const b = await this.load(bookingId);
        if (!b)
            return;
        await this.email.send({
            key: 'booking_rejected',
            to: b.guest.email,
            language: b.guest.language,
            userId: b.guest.id,
            context: { oglas: b.listing.title },
            buttonUrl: `${this.frontendUrl}/pretraga`,
        });
    }
    async onAwaitingPayment({ bookingId }) {
        const b = await this.load(bookingId);
        if (!b)
            return;
        const locale = (0, format_1.localeFor)(b.guest.language);
        const isEn = b.guest.language === 'EN';
        const qrDataUrl = b.ipsQrData ? await QRCode.toDataURL(b.ipsQrData, { width: 240, margin: 1 }) : null;
        const extraMjml = `
      <mj-text font-weight="600" padding-bottom="8px">${isEn ? 'Payment details' : 'Detalji uplate'}</mj-text>
      <mj-text padding-bottom="2px">${isEn ? 'Amount' : 'Iznos'}: ${(0, format_1.formatRsd)(b.amountDue)}</mj-text>
      <mj-text padding-bottom="2px">${isEn ? 'Account' : 'Račun'}: ${b.owner.bankAccount ?? ''}</mj-text>
      <mj-text padding-bottom="2px">${isEn ? 'Reference number' : 'Poziv na broj'}: ${b.id.replace(/-/g, '').slice(0, 20)}</mj-text>
      <mj-text padding-bottom="12px">${isEn ? 'Deadline' : 'Rok'}: ${(0, format_1.formatDateTime)(b.paymentDeadline, locale)}</mj-text>
      ${qrDataUrl ? `<mj-image src="${qrDataUrl}" width="200px" padding-bottom="12px" />` : ''}
      ${b.cancellationTermsSnapshot
            ? `<mj-text font-size="13px" color="#6b7280" padding-bottom="8px">${isEn ? 'Cancellation terms' : 'Uslovi otkazivanja'}: ${b.cancellationTermsSnapshot}</mj-text>`
            : ''}
      <mj-text font-size="12px" color="#6b7280">${isEn
            ? 'Payment goes directly to the owner. Rentaj never mediates payment.'
            : 'Uplata ide direktno vlasniku. Rentaj ne posreduje u plaćanju.'}</mj-text>
    `;
        await this.email.send({
            key: 'booking_payment_instructions',
            to: b.guest.email,
            language: b.guest.language,
            userId: b.guest.id,
            context: { oglas: b.listing.title, iznos: (0, format_1.formatRsd)(b.amountDue), rok: (0, format_1.formatDateTime)(b.paymentDeadline, locale) },
            buttonUrl: this.bookingUrl(b.id),
            extraMjml,
        });
    }
    async onPaymentReminderHalf({ bookingId }) {
        const b = await this.load(bookingId);
        if (!b)
            return;
        await this.email.send({
            key: 'booking_payment_reminder_half',
            to: b.guest.email,
            language: b.guest.language,
            userId: b.guest.id,
            context: { oglas: b.listing.title, iznos: (0, format_1.formatRsd)(b.amountDue), rok: (0, format_1.formatDateTime)(b.paymentDeadline, (0, format_1.localeFor)(b.guest.language)) },
            buttonUrl: this.bookingUrl(b.id),
        });
    }
    async onPaymentReminderFinal({ bookingId }) {
        const b = await this.load(bookingId);
        if (!b)
            return;
        await this.email.send({
            key: 'booking_payment_reminder_final',
            to: b.guest.email,
            language: b.guest.language,
            userId: b.guest.id,
            context: { oglas: b.listing.title, iznos: (0, format_1.formatRsd)(b.amountDue), rok: (0, format_1.formatDateTime)(b.paymentDeadline, (0, format_1.localeFor)(b.guest.language)) },
            buttonUrl: this.bookingUrl(b.id),
        });
    }
    async onExpired({ bookingId }) {
        const b = await this.load(bookingId);
        if (!b)
            return;
        await Promise.all([b.guest, b.owner].map((recipient) => this.email.send({
            key: 'booking_expired',
            to: recipient.email,
            language: recipient.language,
            userId: recipient.id,
            context: { oglas: b.listing.title },
            buttonUrl: `${this.frontendUrl}/oglasi/${b.listing.slug}`,
        })));
    }
    async onConfirmed({ bookingId, viaCash }) {
        const b = await this.load(bookingId);
        if (!b)
            return;
        await this.email.send({
            key: viaCash ? 'booking_confirmed_cash' : 'booking_payment_confirmed',
            to: b.guest.email,
            language: b.guest.language,
            userId: b.guest.id,
            context: { oglas: b.listing.title },
            buttonUrl: this.bookingUrl(b.id),
        });
    }
    async sendCancelled(bookingId, reason) {
        const b = await this.load(bookingId);
        if (!b)
            return;
        await Promise.all([b.guest, b.owner].map((recipient) => this.email.send({
            key: 'booking_cancelled',
            to: recipient.email,
            language: recipient.language,
            userId: recipient.id,
            context: { oglas: b.listing.title, razlog: reason || b.cancellationReason || '' },
            buttonUrl: this.bookingUrl(b.id),
        })));
    }
    async onCancelledByOwner({ bookingId }) {
        await this.sendCancelled(bookingId);
    }
    async onCancelledByGuest({ bookingId }) {
        await this.sendCancelled(bookingId);
    }
    async onCancelledAccountDeleted({ bookingId }) {
        await this.sendCancelled(bookingId, 'Nalog druge strane je obrisan');
    }
    async onReminderDayBefore({ bookingId }) {
        const b = await this.load(bookingId);
        if (!b)
            return;
        await Promise.all([b.guest, b.owner].map((recipient) => this.email.send({
            key: 'booking_reminder_day_before',
            to: recipient.email,
            language: recipient.language,
            userId: recipient.id,
            context: { oglas: b.listing.title },
            buttonUrl: this.bookingUrl(b.id),
        })));
    }
    async onNoShow({ bookingId }) {
        const b = await this.load(bookingId);
        if (!b)
            return;
        await this.email.send({
            key: 'booking_no_show_marked',
            to: b.guest.email,
            language: b.guest.language,
            userId: b.guest.id,
            context: { oglas: b.listing.title },
            buttonUrl: this.bookingUrl(b.id),
        });
    }
};
exports.BookingEmailListener = BookingEmailListener;
__decorate([
    (0, event_emitter_1.OnEvent)('booking.requested'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BookingEmailListener.prototype, "onRequested", null);
__decorate([
    (0, event_emitter_1.OnEvent)('booking.request_unopened_reminder'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BookingEmailListener.prototype, "onUnopenedReminder", null);
__decorate([
    (0, event_emitter_1.OnEvent)('booking.rejected'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BookingEmailListener.prototype, "onRejected", null);
__decorate([
    (0, event_emitter_1.OnEvent)('booking.awaiting_payment'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BookingEmailListener.prototype, "onAwaitingPayment", null);
__decorate([
    (0, event_emitter_1.OnEvent)('booking.payment_reminder_half'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BookingEmailListener.prototype, "onPaymentReminderHalf", null);
__decorate([
    (0, event_emitter_1.OnEvent)('booking.payment_reminder_final'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BookingEmailListener.prototype, "onPaymentReminderFinal", null);
__decorate([
    (0, event_emitter_1.OnEvent)('booking.expired'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BookingEmailListener.prototype, "onExpired", null);
__decorate([
    (0, event_emitter_1.OnEvent)('booking.confirmed'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BookingEmailListener.prototype, "onConfirmed", null);
__decorate([
    (0, event_emitter_1.OnEvent)('booking.cancelled_by_owner'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BookingEmailListener.prototype, "onCancelledByOwner", null);
__decorate([
    (0, event_emitter_1.OnEvent)('booking.cancelled_by_guest'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BookingEmailListener.prototype, "onCancelledByGuest", null);
__decorate([
    (0, event_emitter_1.OnEvent)('booking.cancelled_account_deleted'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BookingEmailListener.prototype, "onCancelledAccountDeleted", null);
__decorate([
    (0, event_emitter_1.OnEvent)('booking.reminder_day_before'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BookingEmailListener.prototype, "onReminderDayBefore", null);
__decorate([
    (0, event_emitter_1.OnEvent)('booking.no_show'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BookingEmailListener.prototype, "onNoShow", null);
exports.BookingEmailListener = BookingEmailListener = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        email_service_1.EmailService,
        config_1.ConfigService])
], BookingEmailListener);
//# sourceMappingURL=booking-email.listener.js.map