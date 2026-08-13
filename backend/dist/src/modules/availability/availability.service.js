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
var AvailabilityService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AvailabilityService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const event_emitter_1 = require("@nestjs/event-emitter");
const common_2 = require("@nestjs/common");
const nestjs_i18n_1 = require("nestjs-i18n");
const prisma_service_1 = require("../../prisma/prisma.service");
const ics_1 = require("../../common/utils/ics");
const money_1 = require("../../common/utils/money");
let AvailabilityService = AvailabilityService_1 = class AvailabilityService {
    constructor(prisma, events, i18n) {
        this.prisma = prisma;
        this.events = events;
        this.i18n = i18n;
        this.logger = new common_2.Logger(AvailabilityService_1.name);
    }
    async lockTerm(listingId, startsAt, endsAt, source, opts = {}) {
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
        }
        catch (err) {
            if (isExclusionViolation(err)) {
                throw new common_1.ConflictException(this.i18n.t('errors.TERM_NOT_AVAILABLE'));
            }
            throw err;
        }
    }
    async releaseTerm(blockedTermId) {
        await this.prisma.blockedTerm.delete({ where: { id: blockedTermId } }).catch(() => undefined);
    }
    async releaseTermsForBooking(bookingId) {
        await this.prisma.blockedTerm.deleteMany({ where: { bookingId } });
    }
    async applyGapAfter(listingId, bookingEnd, gapMinutes) {
        if (gapMinutes <= 0)
            return;
        const gapEnd = new Date(bookingEnd.getTime() + gapMinutes * 60000);
        try {
            await this.prisma.blockedTerm.create({
                data: { listingId, startsAt: bookingEnd, endsAt: gapEnd, source: 'GAP' },
            });
        }
        catch (err) {
            if (!isExclusionViolation(err))
                throw err;
        }
    }
    async getAvailability(listingId, from, to) {
        const [blocked, workingHours, definedSlots] = await Promise.all([
            this.prisma.blockedTerm.findMany({
                where: { listingId, startsAt: { lt: to }, endsAt: { gt: from } },
                select: { startsAt: true, endsAt: true, source: true },
            }),
            this.prisma.workingHours.findMany({ where: { listingId } }),
            this.prisma.definedSlot.findMany({
                where: { listingId, startsAt: { gte: from, lt: to } },
                orderBy: { startsAt: 'asc' },
            }),
        ]);
        return {
            blocked,
            workingHours,
            definedSlots: definedSlots.map((s) => ({ ...s, price: (0, money_1.paraToRsd)(s.price) })),
        };
    }
    async setWorkingHours(userId, listingId, dto) {
        await this.assertOwnership(userId, listingId);
        await this.prisma.$transaction([
            this.prisma.workingHours.deleteMany({ where: { listingId } }),
            this.prisma.workingHours.createMany({
                data: dto.hours.map((h) => ({ listingId, dayOfWeek: h.dayOfWeek, startsAt: h.startsAt, endsAt: h.endsAt })),
            }),
        ]);
        return { message: 'ok' };
    }
    async createDefinedSlot(userId, listingId, dto) {
        await this.assertOwnership(userId, listingId);
        const slot = await this.prisma.definedSlot.create({
            data: {
                listingId,
                startsAt: new Date(dto.startsAt),
                endsAt: new Date(dto.endsAt),
                price: dto.price ? BigInt(Math.round(dto.price * 100)) : undefined,
                maxBookings: dto.maxBookings ?? 1,
            },
        });
        return { ...slot, price: (0, money_1.paraToRsd)(slot.price) };
    }
    async deleteDefinedSlot(userId, listingId, slotId) {
        await this.assertOwnership(userId, listingId);
        await this.prisma.definedSlot.deleteMany({ where: { id: slotId, listingId } });
        return { message: 'ok' };
    }
    async createManualBlock(userId, listingId, dto) {
        await this.assertOwnership(userId, listingId);
        return this.lockTerm(listingId, new Date(dto.startsAt), new Date(dto.endsAt), 'MANUAL', { note: dto.note });
    }
    async deleteManualBlock(userId, listingId, blockedTermId) {
        await this.assertOwnership(userId, listingId);
        const term = await this.prisma.blockedTerm.findFirst({ where: { id: blockedTermId, listingId } });
        if (!term || term.source !== 'MANUAL')
            throw new common_1.NotFoundException();
        await this.releaseTerm(blockedTermId);
        return { message: 'ok' };
    }
    async addIcalSource(userId, listingId, dto) {
        const listing = await this.assertOwnership(userId, listingId);
        if (listing.bookingModel !== 'PER_STAY') {
            throw new common_1.BadRequestException(this.i18n.t('errors.LISTING_NOT_BOOKABLE'));
        }
        return this.prisma.icalSource.create({ data: { listingId, name: dto.name, url: dto.url } });
    }
    async removeIcalSource(userId, listingId, sourceId) {
        await this.assertOwnership(userId, listingId);
        await this.prisma.icalOccupancy.deleteMany({ where: { sourceId } });
        await this.prisma.blockedTerm.deleteMany({ where: { icalSourceId: sourceId } });
        await this.prisma.icalSource.deleteMany({ where: { id: sourceId, listingId } });
        return { message: 'ok' };
    }
    async listIcalSources(userId, listingId) {
        await this.assertOwnership(userId, listingId);
        return this.prisma.icalSource.findMany({ where: { listingId } });
    }
    async exportIcs(token) {
        const listing = await this.prisma.listing.findUnique({ where: { icalExportToken: token } });
        if (!listing)
            throw new common_1.NotFoundException();
        const bookings = await this.prisma.booking.findMany({
            where: { listingId: listing.id, status: { in: ['CONFIRMED', 'COMPLETED'] } },
            select: { id: true, startsAt: true, endsAt: true },
        });
        return (0, ics_1.buildIcsCalendar)(bookings.map((b) => ({ uid: `rentaj-booking-${b.id}`, startsAt: b.startsAt, endsAt: b.endsAt, summary: 'Rezervisano' })));
    }
    async syncAllIcalSources() {
        const sources = await this.prisma.icalSource.findMany({ where: { active: true } });
        for (const source of sources) {
            await this.syncIcalSource(source.id).catch((err) => this.logger.warn(`iCal sync failed for ${source.id}: ${err.message}`));
        }
    }
    async syncIcalSource(sourceId) {
        const source = await this.prisma.icalSource.findUniqueOrThrow({ where: { id: sourceId } });
        let text;
        try {
            const response = await fetch(source.url);
            if (!response.ok)
                throw new Error(`HTTP ${response.status}`);
            text = await response.text();
        }
        catch (err) {
            const failureCount = source.failureCount + 1;
            await this.prisma.icalSource.update({
                where: { id: sourceId },
                data: { failureCount, lastError: err.message },
            });
            if (failureCount >= 3) {
                this.events.emit('availability.ical_sync_failed', { listingId: source.listingId, sourceId });
            }
            return;
        }
        const events = (0, ics_1.parseIcs)(text);
        const existing = await this.prisma.icalOccupancy.findMany({ where: { sourceId, withdrawnAt: null } });
        const existingByUid = new Map(existing.map((e) => [e.externalUid, e]));
        const seenUids = new Set();
        for (const event of events) {
            seenUids.add(event.uid);
            if (existingByUid.has(event.uid))
                continue;
            const occupancy = await this.prisma.icalOccupancy.create({
                data: { sourceId, externalUid: event.uid, startsAt: event.startsAt, endsAt: event.endsAt },
            });
            try {
                await this.lockTerm(source.listingId, event.startsAt, event.endsAt, 'ICAL', { icalSourceId: sourceId });
            }
            catch {
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
    async assertOwnership(userId, listingId) {
        const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
        if (!listing)
            throw new common_1.NotFoundException();
        if (listing.userId !== userId)
            throw new common_1.ForbiddenException();
        return listing;
    }
};
exports.AvailabilityService = AvailabilityService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_HOUR),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AvailabilityService.prototype, "syncAllIcalSources", null);
exports.AvailabilityService = AvailabilityService = AvailabilityService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        event_emitter_1.EventEmitter2,
        nestjs_i18n_1.I18nService])
], AvailabilityService);
function isExclusionViolation(err) {
    const message = err?.message ?? '';
    const meta = err?.meta?.message ?? '';
    return (message.includes('blocked_term_no_overlap') ||
        meta.includes('blocked_term_no_overlap') ||
        message.includes('exclusion') ||
        meta.includes('exclusion'));
}
//# sourceMappingURL=availability.service.js.map