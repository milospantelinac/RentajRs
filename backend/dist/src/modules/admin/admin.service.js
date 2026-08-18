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
exports.AdminService = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const nestjs_i18n_1 = require("nestjs-i18n");
const prisma_service_1 = require("../../prisma/prisma.service");
const users_service_1 = require("../users/users.service");
const payment_settings_service_1 = require("../../common/payment/nestpay/payment-settings.service");
const PRIORITY_REPORT_THRESHOLD = 3;
const RESTRICTION_DAYS = 30;
let AdminService = class AdminService {
    constructor(prisma, users, i18n, events, paymentSettings) {
        this.prisma = prisma;
        this.users = users;
        this.i18n = i18n;
        this.events = events;
        this.paymentSettings = paymentSettings;
    }
    async listUsers(search, blocked) {
        return this.prisma.user.findMany({
            where: {
                ...(search ? { OR: [{ email: { contains: search, mode: 'insensitive' } }, { firstName: { contains: search, mode: 'insensitive' } }, { lastName: { contains: search, mode: 'insensitive' } }] } : {}),
                ...(blocked !== undefined ? { blocked } : {}),
            },
            select: {
                id: true, firstName: true, lastName: true, email: true, blocked: true, verified: true,
                completedBookingsCount: true, createdAt: true, lastLoginAt: true,
                warningsCount: true, restrictedUntil: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 200,
        });
    }
    async blockUser(adminId, userId, dto) {
        await this.prisma.user.update({ where: { id: userId }, data: { blocked: true, blockedReason: dto.reason } });
        await this.prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
        await this.logAction(adminId, 'block_user', 'User', userId, undefined, { reason: dto.reason });
        this.events.emit('user.blocked_by_admin', { userId, reason: dto.reason });
        return { message: this.i18n.t('common.SUCCESS') };
    }
    async unblockUser(adminId, userId) {
        await this.prisma.user.update({ where: { id: userId }, data: { blocked: false, blockedReason: null } });
        await this.logAction(adminId, 'unblock_user', 'User', userId);
        return { message: this.i18n.t('common.SUCCESS') };
    }
    async deleteUserAsAdmin(adminId, userId) {
        await this.logAction(adminId, 'delete_user', 'User', userId);
        return this.users.executeDeletion(userId);
    }
    async reportListing(reporterId, listingId, dto) {
        const report = await this.prisma.report.create({
            data: { listingId, reportedByUserId: reporterId, reason: dto.reason, description: dto.description },
        });
        const count = await this.prisma.report.count({ where: { listingId, status: { not: 'DISMISSED' } } });
        if (count >= PRIORITY_REPORT_THRESHOLD) {
            this.events.emit('admin.listing_report_priority', { listingId, count });
        }
        this.events.emit('admin.listing_reported', { listingId });
        return report;
    }
    async listReports(status) {
        return this.prisma.report.findMany({
            where: status ? { status } : undefined,
            orderBy: { createdAt: 'desc' },
            include: { listing: { select: { id: true, title: true, slug: true } }, reportedByUser: { select: { id: true, firstName: true, lastName: true } } },
        });
    }
    async resolveReport(adminId, reportId, status) {
        await this.prisma.report.update({ where: { id: reportId }, data: { status, handledByUserId: adminId } });
        await this.logAction(adminId, 'resolve_report', 'Report', reportId, undefined, { status });
        return { message: this.i18n.t('common.SUCCESS') };
    }
    async listDisputes(status) {
        return this.prisma.dispute.findMany({
            where: status ? { status } : undefined,
            orderBy: { createdAt: 'desc' },
            include: {
                listing: { select: { id: true, title: true, slug: true } },
                booking: { select: { id: true, status: true } },
                submittedByUser: { select: { id: true, firstName: true, lastName: true } },
            },
        });
    }
    async resolveDispute(adminId, disputeId, dto) {
        const dispute = await this.prisma.dispute.findUniqueOrThrow({ where: { id: disputeId } });
        await this.prisma.dispute.update({
            where: { id: disputeId },
            data: { status: 'RESOLVED', outcome: dto.outcome, adminNote: dto.adminNote, handledByUserId: adminId },
        });
        if (dto.targetUserId && dto.outcome !== 'NO_ACTION') {
            if (dto.outcome === 'BLOCK') {
                await this.prisma.user.update({ where: { id: dto.targetUserId }, data: { blocked: true, blockedReason: `Dispute ${disputeId}: ${dto.adminNote ?? ''}` } });
                await this.prisma.session.updateMany({ where: { userId: dto.targetUserId, revokedAt: null }, data: { revokedAt: new Date() } });
            }
            else if (dto.outcome === 'WARNING') {
                await this.prisma.user.update({ where: { id: dto.targetUserId }, data: { warningsCount: { increment: 1 } } });
            }
            else if (dto.outcome === 'RESTRICTION') {
                await this.prisma.user.update({
                    where: { id: dto.targetUserId },
                    data: { restrictedUntil: new Date(Date.now() + RESTRICTION_DAYS * 86_400_000) },
                });
            }
            this.events.emit('admin.dispute_outcome_applied', { userId: dto.targetUserId, outcome: dto.outcome, disputeId });
        }
        if (dispute.type === 'DISPUTED_NO_SHOW' && dispute.bookingId) {
            this.events.emit('booking.no_show_dispute_resolved', { bookingId: dispute.bookingId, outcome: dto.outcome });
        }
        await this.logAction(adminId, 'resolve_dispute', 'Dispute', disputeId, undefined, dto);
        return { message: this.i18n.t('common.SUCCESS') };
    }
    async listSettings() {
        return this.prisma.setting.findMany({ orderBy: { key: 'asc' } });
    }
    async updateSetting(adminId, key, dto) {
        const existing = await this.prisma.setting.findUnique({ where: { key } });
        if (!existing)
            throw new common_1.NotFoundException();
        await this.prisma.setting.update({ where: { key }, data: { value: dto.value } });
        await this.logAction(adminId, 'update_setting', 'Setting', key, existing.value, dto.value);
        return { message: this.i18n.t('common.SUCCESS') };
    }
    async getPaymentSettings() {
        return this.paymentSettings.getMasked();
    }
    async updatePaymentSettings(adminId, dto) {
        const before = await this.paymentSettings.getMasked();
        const updated = await this.paymentSettings.update(dto);
        await this.logAction(adminId, 'update_payment_settings', 'PaymentSettings', 'default', before, updated);
        return updated;
    }
    async listEmailTemplates() {
        return this.prisma.emailTemplate.findMany({ orderBy: [{ key: 'asc' }, { language: 'asc' }] });
    }
    async updateEmailTemplate(adminId, key, language, dto) {
        const existing = await this.prisma.emailTemplate.findUnique({ where: { key_language: { key, language } } });
        if (!existing)
            throw new common_1.NotFoundException();
        await this.prisma.emailTemplate.update({
            where: { key_language: { key, language } },
            data: { subject: dto.subject, heading: dto.heading, bodyText: dto.bodyText, buttonLabel: dto.buttonLabel },
        });
        await this.logAction(adminId, 'update_email_template', 'EmailTemplate', `${key}:${language}`, existing, dto);
        return { message: this.i18n.t('common.SUCCESS') };
    }
    async listStaticPages() {
        return this.prisma.staticPage.findMany({ orderBy: [{ slug: 'asc' }, { language: 'asc' }] });
    }
    async updateStaticPage(adminId, slug, language, dto) {
        const existing = await this.prisma.staticPage.findUnique({ where: { slug_language: { slug, language } } });
        const data = { title: dto.title, bodyHtml: dto.bodyHtml, published: dto.published ?? true };
        await this.prisma.staticPage.upsert({
            where: { slug_language: { slug, language } },
            update: data,
            create: { slug, language, ...data },
        });
        await this.logAction(adminId, 'update_static_page', 'StaticPage', `${slug}:${language}`, existing, dto);
        return { message: this.i18n.t('common.SUCCESS') };
    }
    async listFaqsAdmin() {
        return this.prisma.faq.findMany({ orderBy: [{ language: 'asc' }, { displayOrder: 'asc' }] });
    }
    async createFaq(adminId, dto) {
        const maxOrder = await this.prisma.faq.aggregate({
            where: { language: dto.language },
            _max: { displayOrder: true },
        });
        const faq = await this.prisma.faq.create({
            data: {
                language: dto.language,
                question: dto.question,
                answer: dto.answer,
                displayOrder: (maxOrder._max.displayOrder ?? -1) + 1,
            },
        });
        await this.logAction(adminId, 'create_faq', 'Faq', faq.id, null, dto);
        return faq;
    }
    async updateFaq(adminId, id, dto) {
        const existing = await this.prisma.faq.findUnique({ where: { id } });
        if (!existing)
            throw new common_1.NotFoundException();
        const faq = await this.prisma.faq.update({ where: { id }, data: dto });
        await this.logAction(adminId, 'update_faq', 'Faq', id, existing, dto);
        return faq;
    }
    async deleteFaq(adminId, id) {
        const existing = await this.prisma.faq.findUnique({ where: { id } });
        if (!existing)
            throw new common_1.NotFoundException();
        await this.prisma.faq.delete({ where: { id } });
        await this.logAction(adminId, 'delete_faq', 'Faq', id, existing, null);
        return { message: this.i18n.t('common.SUCCESS') };
    }
    async getEmptySearchReport(days = 30) {
        const since = new Date(Date.now() - days * 86_400_000);
        const searches = await this.prisma.emptySearch.findMany({
            where: { createdAt: { gte: since } },
            include: { category: { select: { slug: true } }, city: { select: { name: true } } },
            orderBy: { createdAt: 'desc' },
            take: 500,
        });
        const byQuery = new Map();
        for (const s of searches) {
            const key = s.query?.trim().toLowerCase() || `[${s.category?.slug ?? 'any'}/${s.city?.name ?? 'any'}]`;
            byQuery.set(key, (byQuery.get(key) ?? 0) + 1);
        }
        return Array.from(byQuery.entries())
            .map(([query, count]) => ({ query, count }))
            .sort((a, b) => b.count - a.count);
    }
    async getContactSharingReport(days = 30) {
        const since = new Date(Date.now() - days * 86_400_000);
        const flagged = await this.prisma.message.findMany({
            where: { containsContact: true, sentAt: { gte: since } },
            select: { senderId: true },
        });
        const byUser = new Map();
        for (const m of flagged)
            byUser.set(m.senderId, (byUser.get(m.senderId) ?? 0) + 1);
        const users = await this.prisma.user.findMany({
            where: { id: { in: Array.from(byUser.keys()) } },
            select: { id: true, firstName: true, lastName: true, email: true },
        });
        return users
            .map((u) => ({ ...u, flaggedMessageCount: byUser.get(u.id) ?? 0 }))
            .sort((a, b) => b.flaggedMessageCount - a.flaggedMessageCount);
    }
    async getAuditLog(entityType, page = 1) {
        return this.prisma.adminLog.findMany({
            where: entityType ? { entityType } : undefined,
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * 50,
            take: 50,
            include: { user: { select: { firstName: true, lastName: true } } },
        });
    }
    async logAction(userId, action, entityType, entityId, oldValue, newValue) {
        await this.prisma.adminLog.create({
            data: {
                userId,
                action,
                entityType,
                entityId,
                oldValue: oldValue === undefined ? undefined : oldValue,
                newValue: newValue === undefined ? undefined : newValue,
            },
        });
    }
};
exports.AdminService = AdminService;
exports.AdminService = AdminService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        users_service_1.UsersService,
        nestjs_i18n_1.I18nService,
        event_emitter_1.EventEmitter2,
        payment_settings_service_1.PaymentSettingsService])
], AdminService);
//# sourceMappingURL=admin.service.js.map