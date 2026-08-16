"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminEmailListener = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const event_emitter_1 = require("@nestjs/event-emitter");
const prisma_service_1 = require("../../../prisma/prisma.service");
const email_service_1 = require("../../../common/email/email.service");
let AdminEmailListener = class AdminEmailListener {
    constructor(prisma, email, config) {
        this.prisma = prisma;
        this.email = email;
        this.frontendUrl = config.get('frontendUrl');
    }
    async getAdmins(permissionKey) {
        const grants = await this.prisma.userPermission.findMany({
            where: { permission: { key: permissionKey } },
            include: { user: true },
        });
        return grants.map((g) => g.user);
    }
    async sendToAdmins(permissionKey, key, context, buttonUrl) {
        const admins = await this.getAdmins(permissionKey);
        await Promise.all(admins.map((admin) => this.email.send({ key, to: admin.email, language: admin.language, userId: admin.id, context, buttonUrl })));
    }
    async onNewListing({ listingId }) {
        const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
        if (!listing)
            return;
        await this.sendToAdmins('approve_listing', 'admin_new_listing_to_review', { oglas: listing.title }, `${this.frontendUrl}/admin`);
    }
    async onCategoryProposed({ categoryId }) {
        const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
        if (!category)
            return;
        const name = await this.prisma.translation.findFirst({
            where: { entityType: 'CATEGORY', entityId: categoryId, field: 'name' },
        });
        await this.sendToAdmins('manage_categories', 'admin_proposed_category', { kategorija: name?.value ?? category.slug }, `${this.frontendUrl}/admin/kategorije`);
    }
    async onListingReported({ listingId }) {
        const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
        if (!listing)
            return;
        await this.sendToAdmins('resolve_disputes', 'admin_listing_reported', { oglas: listing.title }, `${this.frontendUrl}/admin/sporovi`);
    }
    async onListingReportPriority({ listingId, count }) {
        const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
        if (!listing)
            return;
        await this.sendToAdmins('resolve_disputes', 'admin_listing_report_priority', { oglas: listing.title, broj: String(count) }, `${this.frontendUrl}/admin/sporovi`);
    }
    async onPaymentDisputed({ bookingId }) {
        const booking = await this.prisma.booking.findUnique({
            where: { id: bookingId },
            include: { listing: { select: { title: true } } },
        });
        if (!booking)
            return;
        await this.sendToAdmins('resolve_disputes', 'admin_payment_disputed', { oglas: booking.listing.title }, `${this.frontendUrl}/admin/sporovi`);
    }
    async onNoShowDisputed({ bookingId }) {
        const booking = await this.prisma.booking.findUnique({
            where: { id: bookingId },
            include: { listing: { select: { title: true } } },
        });
        if (!booking)
            return;
        await this.sendToAdmins('resolve_disputes', 'admin_no_show_disputed', { oglas: booking.listing.title }, `${this.frontendUrl}/admin/sporovi`);
    }
    async onNewBooking({ bookingId }) {
        const setting = await this.prisma.setting.findUnique({ where: { key: 'admin_new_booking_notifications' } });
        if (setting?.value !== true)
            return;
        const booking = await this.prisma.booking.findUnique({
            where: { id: bookingId },
            include: { listing: { select: { title: true } } },
        });
        if (!booking)
            return;
        await this.sendToAdmins('resolve_disputes', 'admin_new_booking', { oglas: booking.listing.title }, `${this.frontendUrl}/admin`);
    }
};
exports.AdminEmailListener = AdminEmailListener;
__decorate([
    (0, event_emitter_1.OnEvent)('listing.submitted_for_approval'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminEmailListener.prototype, "onNewListing", null);
__decorate([
    (0, event_emitter_1.OnEvent)('taxonomy.category_proposed'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminEmailListener.prototype, "onCategoryProposed", null);
__decorate([
    (0, event_emitter_1.OnEvent)('admin.listing_reported'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminEmailListener.prototype, "onListingReported", null);
__decorate([
    (0, event_emitter_1.OnEvent)('admin.listing_report_priority'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminEmailListener.prototype, "onListingReportPriority", null);
__decorate([
    (0, event_emitter_1.OnEvent)('booking.payment_disputed'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminEmailListener.prototype, "onPaymentDisputed", null);
__decorate([
    (0, event_emitter_1.OnEvent)('booking.no_show_disputed'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminEmailListener.prototype, "onNoShowDisputed", null);
__decorate([
    (0, event_emitter_1.OnEvent)('booking.requested'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminEmailListener.prototype, "onNewBooking", null);
exports.AdminEmailListener = AdminEmailListener = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        email_service_1.EmailService,
        config_1.ConfigService])
], AdminEmailListener);
//# sourceMappingURL=admin-email.listener.js.map