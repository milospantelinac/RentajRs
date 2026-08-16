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
exports.ListingsService = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const schedule_1 = require("@nestjs/schedule");
const nestjs_i18n_1 = require("nestjs-i18n");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../prisma/prisma.service");
const cache_service_1 = require("../../common/cache/cache.service");
const uploads_service_1 = require("../../common/uploads/uploads.service");
const geocoding_service_1 = require("../../common/geocoding/geocoding.service");
const taxonomy_service_1 = require("../taxonomy/taxonomy.service");
const users_service_1 = require("../users/users.service");
const contact_detector_1 = require("../../common/utils/contact-detector");
const money_1 = require("../../common/utils/money");
const MAX_PHOTOS = 20;
const MODERATION_SLA_HOURS = 24;
let ListingsService = class ListingsService {
    constructor(prisma, cache, uploads, geocoding, taxonomy, users, i18n, events) {
        this.prisma = prisma;
        this.cache = cache;
        this.uploads = uploads;
        this.geocoding = geocoding;
        this.taxonomy = taxonomy;
        this.users = users;
        this.i18n = i18n;
        this.events = events;
    }
    async createDraft(userId, dto) {
        const owner = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
        if (owner.restrictedUntil && owner.restrictedUntil.getTime() > Date.now()) {
            throw new common_1.ForbiddenException(this.i18n.t('errors.ACCOUNT_RESTRICTED'));
        }
        const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
        if (!category)
            throw new common_1.NotFoundException(this.i18n.t('errors.LISTING_NOT_FOUND'));
        const slug = await this.uniqueSlug('novi-oglas');
        const listing = await this.prisma.listing.create({
            data: {
                userId,
                categoryId: category.id,
                status: client_1.ListingStatus.DRAFT,
                title: '',
                description: '',
                slug,
                bookingModel: category.defaultBookingModel,
                priceUnit: category.defaultPriceUnit,
                price: 0n,
                icalExportToken: category.defaultBookingModel === 'PER_STAY' ? crypto.randomUUID() : undefined,
            },
        });
        return this.serialize(listing);
    }
    async getMine(userId) {
        const listings = await this.prisma.listing.findMany({
            where: { userId, status: { not: client_1.ListingStatus.DELETED } },
            orderBy: { createdAt: 'desc' },
            include: {
                photos: { where: { isCover: true }, take: 1 },
                category: true,
                subscription: { select: { package: { select: { key: true } }, status: true, expiresAt: true } },
            },
        });
        return listings.map((l) => this.serialize(l));
    }
    async getOwned(userId, listingId) {
        const listing = await this.getFullListing(listingId);
        if (!listing)
            throw new common_1.NotFoundException(this.i18n.t('errors.LISTING_NOT_FOUND'));
        if (listing.userId !== userId)
            throw new common_1.ForbiddenException();
        return this.serialize(listing);
    }
    async updateListing(userId, listingId, dto) {
        const listing = await this.assertOwnership(userId, listingId);
        const priceFields = {};
        if (dto.price !== undefined)
            priceFields.price = (0, money_1.rsdToPara)(dto.price);
        if (dto.weekendPrice !== undefined)
            priceFields.weekendPrice = (0, money_1.rsdToPara)(dto.weekendPrice);
        if (dto.pricePerGuest !== undefined)
            priceFields.pricePerGuest = (0, money_1.rsdToPara)(dto.pricePerGuest);
        const { price, weekendPrice, pricePerGuest, title, mandatoryFees, ...rest } = dto;
        const data = { ...rest, ...priceFields };
        if (mandatoryFees)
            data.mandatoryFees = mandatoryFees;
        const descriptionFlaggedContact = dto.description !== undefined ? (0, contact_detector_1.containsContactInfo)(dto.description) : undefined;
        if (listing.status === client_1.ListingStatus.ACTIVE && title !== undefined && title !== listing.title) {
            await this.queueModeratedChange(listing.id, { title });
        }
        else if (title !== undefined) {
            data.title = title;
            if (listing.status === client_1.ListingStatus.DRAFT) {
                data.slug = await this.uniqueSlug(title || 'novi-oglas');
            }
        }
        const updated = await this.prisma.listing.update({ where: { id: listing.id }, data });
        if (descriptionFlaggedContact) {
            this.events.emit('listing.description_flagged_contact_info', { listingId: listing.id });
        }
        return this.serialize(updated);
    }
    async updateLocation(userId, listingId, dto) {
        const listing = await this.assertOwnership(userId, listingId);
        const city = await this.prisma.city.findUniqueOrThrow({ where: { id: dto.cityId } });
        const coords = dto.latitude !== undefined && dto.longitude !== undefined
            ? { latitude: dto.latitude, longitude: dto.longitude }
            : await this.geocoding.geocode(dto.address, city.name);
        const locationData = {
            regionId: dto.regionId,
            cityId: dto.cityId,
            cityAreaId: dto.cityAreaId ?? null,
            address: dto.address,
            latitude: coords?.latitude,
            longitude: coords?.longitude,
            ...(dto.googlePlaceId !== undefined ? { googlePlaceId: dto.googlePlaceId } : {}),
        };
        if (listing.status === client_1.ListingStatus.ACTIVE) {
            await this.queueModeratedChange(listing.id, locationData);
            return this.serialize(await this.prisma.listing.findUniqueOrThrow({ where: { id: listing.id } }));
        }
        const updated = await this.prisma.listing.update({ where: { id: listing.id }, data: locationData });
        return this.serialize(updated);
    }
    async upsertAttributes(userId, listingId, dto) {
        const listing = await this.assertOwnership(userId, listingId);
        const allowedAttributes = await this.taxonomy.resolveAttributesForCategory(listing.categoryId);
        const attributesById = new Map(allowedAttributes.map((a) => [a.id, a]));
        const submitted = dto.values.filter((v) => attributesById.has(v.attributeId));
        const toWrite = submitted.filter((v) => {
            const type = attributesById.get(v.attributeId).type;
            if (type === 'NUMBER')
                return v.valueNumber !== null && v.valueNumber !== undefined;
            if (type === 'TEXT')
                return !!v.valueText;
            if (type === 'BOOLEAN')
                return true;
            return (v.valueOptionIds ?? []).length > 0;
        });
        const toClear = submitted.filter((v) => !toWrite.includes(v)).map((v) => v.attributeId);
        const typedValue = (v) => {
            const type = attributesById.get(v.attributeId).type;
            return {
                valueNumber: type === 'NUMBER' ? v.valueNumber : null,
                valueText: type === 'TEXT' ? v.valueText : null,
                valueBoolean: type === 'BOOLEAN' ? v.valueBoolean : null,
                valueOptionIds: type === 'LIST' || type === 'MULTISELECT' ? (v.valueOptionIds ?? []) : [],
            };
        };
        await this.prisma.$transaction([
            ...toWrite.map((v) => this.prisma.listingAttribute.upsert({
                where: { listingId_attributeId: { listingId: listing.id, attributeId: v.attributeId } },
                update: typedValue(v),
                create: {
                    listingId: listing.id,
                    attributeId: v.attributeId,
                    ...typedValue(v),
                },
            })),
            this.prisma.listingAttribute.deleteMany({
                where: { listingId: listing.id, attributeId: { in: toClear } },
            }),
        ]);
        return { message: this.i18n.t('common.SUCCESS') };
    }
    async upsertFaqs(userId, listingId, dto) {
        const listing = await this.assertOwnership(userId, listingId);
        await this.prisma.$transaction([
            this.prisma.listingFaq.deleteMany({ where: { listingId: listing.id } }),
            this.prisma.listingFaq.createMany({
                data: dto.faqs.map((f, i) => ({ listingId: listing.id, question: f.question, answer: f.answer, displayOrder: i })),
            }),
        ]);
        return { message: this.i18n.t('common.SUCCESS') };
    }
    async upsertExtraServices(userId, listingId, dto) {
        const listing = await this.assertOwnership(userId, listingId);
        await this.prisma.$transaction([
            this.prisma.listingExtraService.deleteMany({ where: { listingId: listing.id } }),
            this.prisma.listingExtraService.createMany({
                data: dto.services.map((s) => ({
                    listingId: listing.id,
                    name: s.name,
                    description: s.description,
                    price: (0, money_1.rsdToPara)(s.price),
                    chargeType: s.chargeType,
                    maxQuantity: s.maxQuantity,
                })),
            }),
        ]);
        return { message: this.i18n.t('common.SUCCESS') };
    }
    async addPhoto(userId, listingId, file) {
        const listing = await this.assertOwnership(userId, listingId);
        const currentCount = await this.prisma.listingPhoto.count({
            where: { listingId: listing.id, pendingRemoval: false },
        });
        if (currentCount >= MAX_PHOTOS) {
            throw new common_1.BadRequestException(this.i18n.t('errors.PHOTO_LIMIT_EXCEEDED', { args: { max: MAX_PHOTOS } }));
        }
        const { url } = await this.uploads.saveImage(file, `listings/${listing.id}`, { maxWidth: 1920 });
        let versionId;
        if (listing.status === client_1.ListingStatus.ACTIVE) {
            versionId = await this.getOrCreatePendingVersionId(listing.id, { photosChanged: true });
        }
        const isFirstPhoto = currentCount === 0 && !versionId;
        const photo = await this.prisma.listingPhoto.create({
            data: { listingId: listing.id, url, displayOrder: currentCount, isCover: isFirstPhoto, versionId },
        });
        return photo;
    }
    async removePhoto(userId, listingId, photoId) {
        const listing = await this.assertOwnership(userId, listingId);
        const photo = await this.prisma.listingPhoto.findFirst({ where: { id: photoId, listingId: listing.id } });
        if (!photo)
            throw new common_1.NotFoundException();
        if (listing.status === client_1.ListingStatus.ACTIVE) {
            const versionId = await this.getOrCreatePendingVersionId(listing.id, { photosChanged: true });
            if (photo.versionId === versionId) {
                await this.prisma.listingPhoto.delete({ where: { id: photo.id } });
            }
            else {
                await this.prisma.listingPhoto.update({ where: { id: photo.id }, data: { pendingRemoval: true, versionId } });
            }
        }
        else {
            await this.prisma.listingPhoto.delete({ where: { id: photo.id } });
        }
        return { message: this.i18n.t('common.SUCCESS') };
    }
    async reorderPhotos(userId, listingId, photoIds) {
        const listing = await this.assertOwnership(userId, listingId);
        const livePhotos = await this.prisma.listingPhoto.findMany({
            where: { listingId: listing.id, versionId: null, pendingRemoval: false },
            select: { id: true },
        });
        const liveIds = new Set(livePhotos.map((p) => p.id));
        if (photoIds.length !== liveIds.size || photoIds.some((id) => !liveIds.has(id))) {
            throw new common_1.BadRequestException(this.i18n.t('errors.PHOTO_NOT_FOUND'));
        }
        if (listing.status === client_1.ListingStatus.ACTIVE) {
            await this.queueModeratedChange(listing.id, { photoOrder: photoIds });
            return { message: this.i18n.t('common.SUCCESS') };
        }
        await this.prisma.$transaction(photoIds.map((id, index) => this.prisma.listingPhoto.update({
            where: { id },
            data: { displayOrder: index, isCover: index === 0 },
        })));
        return { message: this.i18n.t('common.SUCCESS') };
    }
    async getReadiness(userId, listingId) {
        const listing = await this.assertOwnership(userId, listingId);
        const requiredAttributes = (await this.taxonomy.resolveAttributesForCategory(listing.categoryId)).filter((a) => a.required);
        const setValues = await this.prisma.listingAttribute.findMany({ where: { listingId: listing.id } });
        const setIds = new Set(setValues.map((v) => v.attributeId));
        const photoCount = await this.prisma.listingPhoto.count({ where: { listingId: listing.id, pendingRemoval: false } });
        const owner = await this.prisma.user.findUniqueOrThrow({ where: { id: listing.userId } });
        const checklist = {
            hasTitle: !!listing.title,
            hasDescription: !!listing.description,
            hasPhotos: photoCount > 0,
            hasLocation: !!listing.cityId,
            hasPrice: listing.price > 0n,
            hasPaymentMethod: !!listing.paymentMethod,
            hasBankAccountIfNeeded: listing.paymentMethod === 'CASH' || !!owner.bankAccount,
            hasPhone: !!owner.phone,
            requiredAttributesFilled: requiredAttributes.every((a) => setIds.has(a.id)),
        };
        const ready = Object.values(checklist).every(Boolean);
        return { ready, checklist };
    }
    async markPendingApproval(listingId, subscriptionId) {
        const listing = await this.prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
        if (listing.status !== client_1.ListingStatus.DRAFT && listing.status !== client_1.ListingStatus.REJECTED) {
            throw new common_1.BadRequestException('Listing is not awaiting submission');
        }
        const owner = await this.prisma.user.findUniqueOrThrow({ where: { id: listing.userId } });
        if (!owner.emailVerified) {
            throw new common_1.ForbiddenException(this.i18n.t('errors.EMAIL_NOT_VERIFIED'));
        }
        const updated = await this.prisma.listing.update({
            where: { id: listingId },
            data: { status: client_1.ListingStatus.PENDING_APPROVAL, subscriptionId },
        });
        const checkResults = await this.runAutomaticChecks(listingId);
        const hasWarnings = Object.values(checkResults).some((v) => v === 'WARNING');
        await this.prisma.listingModeration.create({
            data: {
                listingId,
                checkResults: checkResults,
                hasWarnings,
            },
        });
        this.events.emit('listing.submitted_for_approval', { listingId });
        if (!hasWarnings && (await this.getAutoApproveEnabled())) {
            return this.adminApprove(null, listingId, true);
        }
        return this.serialize(updated);
    }
    async deleteListing(userId, listingId) {
        const listing = await this.assertOwnership(userId, listingId);
        const activeBookings = await this.prisma.booking.count({
            where: { listingId: listing.id, status: { in: ['REQUESTED', 'AWAITING_PAYMENT', 'CONFIRMED'] } },
        });
        if (activeBookings > 0 && listing.paymentMethod) {
            throw new common_1.BadRequestException('This listing has active bookings — change its payment method to stop accepting new ones first, or wait until they complete');
        }
        await this.prisma.listing.update({
            where: { id: listing.id },
            data: { status: client_1.ListingStatus.DELETED, deletedAt: new Date() },
        });
        return { message: this.i18n.t('common.SUCCESS') };
    }
    async getPublicBySlug(slug) {
        const listing = await this.prisma.listing.findUnique({
            where: { slug },
            include: this.publicDisplayInclude(),
        });
        if (!listing || listing.status !== client_1.ListingStatus.ACTIVE) {
            throw new common_1.NotFoundException(this.i18n.t('errors.LISTING_NOT_FOUND'));
        }
        await this.recordView(listing.id);
        return this.buildDisplayPayload(listing);
    }
    async getOwnerPreview(userId, listingId) {
        await this.assertOwnership(userId, listingId);
        const listing = await this.prisma.listing.findUnique({
            where: { id: listingId },
            include: this.publicDisplayInclude(),
        });
        if (!listing)
            throw new common_1.NotFoundException(this.i18n.t('errors.LISTING_NOT_FOUND'));
        return this.buildDisplayPayload(listing);
    }
    publicDisplayInclude() {
        return {
            photos: { where: { pendingRemoval: false, versionId: null }, orderBy: { displayOrder: 'asc' } },
            faqs: { orderBy: { displayOrder: 'asc' } },
            extraServices: true,
            category: true,
            region: true,
            city: true,
            cityArea: true,
            user: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    avatarUrl: true,
                    profileSlug: true,
                    avgResponseTimeMinutes: true,
                    verified: true,
                    createdAt: true,
                },
            },
        };
    }
    async buildDisplayPayload(listing) {
        const attributes = await this.taxonomy.resolveAttributesForCategory(listing.categoryId);
        const values = await this.prisma.listingAttribute.findMany({ where: { listingId: listing.id } });
        const valueMap = new Map(values.map((v) => [v.attributeId, v]));
        return {
            ...this.serialize(listing),
            photos: listing.photos,
            faqs: listing.faqs,
            extraServices: listing.extraServices.map((s) => ({ ...s, price: (0, money_1.paraToRsd)(s.price) })),
            category: listing.category,
            region: listing.region,
            city: listing.city,
            cityArea: listing.cityArea,
            owner: listing.user,
            attributes: attributes.map((a) => ({ ...a, value: valueMap.get(a.id) ?? null })),
        };
    }
    async recordView(listingId) {
        await this.prisma.listing.update({ where: { id: listingId }, data: { viewCount: { increment: 1 } } });
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        await this.prisma.listingViewStat.upsert({
            where: { listingId_date: { listingId, date: today } },
            update: { viewCount: { increment: 1 } },
            create: { listingId, date: today, viewCount: 1, uniqueVisitors: 0 },
        });
    }
    async adminGetQueue() {
        const [listings, versions] = await Promise.all([
            this.prisma.listing.findMany({
                where: { status: client_1.ListingStatus.PENDING_APPROVAL },
                orderBy: { createdAt: 'asc' },
                include: {
                    user: { select: { id: true, firstName: true, lastName: true, email: true } },
                    category: true,
                    photos: true,
                    moderations: { where: { decision: null }, orderBy: { createdAt: 'desc' }, take: 1 },
                },
            }),
            this.prisma.listingVersion.findMany({
                where: { status: client_1.VersionStatus.PENDING },
                orderBy: { submittedAt: 'asc' },
                include: { listing: { include: { user: { select: { id: true, firstName: true, lastName: true } } } } },
            }),
        ]);
        const slaHours = await this.getModerationSlaHours();
        return {
            newListings: listings.map((l) => {
                const { moderations, ...listingFields } = l;
                const latestModeration = moderations[0];
                return {
                    ...this.serialize(listingFields),
                    waitingHours: this.hoursSince(l.createdAt),
                    checkResults: latestModeration?.checkResults ?? null,
                    hasWarnings: latestModeration?.hasWarnings ?? false,
                };
            }),
            pendingEdits: versions.map((v) => ({
                ...v,
                listing: this.serialize(v.listing),
                waitingHours: this.hoursSince(v.submittedAt),
            })),
            slaHours,
        };
    }
    async adminApprove(adminUserId, listingId, automatic = false) {
        const listing = await this.prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
        const isFirstApproval = !listing.publishedAt;
        const updated = await this.prisma.listing.update({
            where: { id: listingId },
            data: { status: client_1.ListingStatus.ACTIVE, publishedAt: listing.publishedAt ?? new Date() },
        });
        await this.prisma.listingModeration.updateMany({
            where: { listingId, decision: null },
            data: {
                decision: client_1.ModerationDecision.APPROVED,
                decidedByUserId: adminUserId,
                decidedAt: new Date(),
                automatic,
            },
        });
        if (isFirstApproval) {
            await this.users.ensureProfileSlug(listing.userId);
        }
        await this.cache.delByPrefix('taxonomy:category:');
        this.events.emit('listing.approved', { listingId, userId: listing.userId });
        return this.serialize(updated);
    }
    async adminReject(adminUserId, listingId, dto) {
        const listing = await this.prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
        const updated = await this.prisma.listing.update({
            where: { id: listingId },
            data: { status: client_1.ListingStatus.REJECTED },
        });
        await this.prisma.listingModeration.updateMany({
            where: { listingId, decision: null },
            data: {
                decision: client_1.ModerationDecision.REJECTED,
                rejectionReason: dto.reason,
                note: dto.note,
                decidedByUserId: adminUserId,
                decidedAt: new Date(),
            },
        });
        this.events.emit('listing.rejected', { listingId, userId: listing.userId, reason: dto.reason });
        return this.serialize(updated);
    }
    async adminApproveVersion(adminUserId, versionId) {
        const version = await this.prisma.listingVersion.findUniqueOrThrow({ where: { id: versionId } });
        const fields = version.changedFields;
        await this.prisma.$transaction(async (tx) => {
            const { photosChanged, photoOrder, workingHoursPending, pendingSlotsAdd, ...listingFields } = fields;
            if (Object.keys(listingFields).length) {
                await tx.listing.update({ where: { id: version.listingId }, data: listingFields });
            }
            if (photosChanged) {
                await tx.listingPhoto.deleteMany({ where: { versionId: version.id, pendingRemoval: true } });
                await tx.listingPhoto.updateMany({ where: { versionId: version.id }, data: { versionId: null } });
            }
            if (Array.isArray(photoOrder)) {
                for (let index = 0; index < photoOrder.length; index++) {
                    await tx.listingPhoto.update({
                        where: { id: photoOrder[index] },
                        data: { displayOrder: index, isCover: index === 0 },
                    });
                }
            }
            if (Array.isArray(workingHoursPending)) {
                await tx.workingHours.deleteMany({ where: { listingId: version.listingId } });
                await tx.workingHours.createMany({
                    data: workingHoursPending.map((h) => ({
                        listingId: version.listingId,
                        dayOfWeek: h.dayOfWeek,
                        startsAt: h.startsAt,
                        endsAt: h.endsAt,
                    })),
                });
            }
            if (Array.isArray(pendingSlotsAdd) && pendingSlotsAdd.length) {
                await tx.definedSlot.createMany({
                    data: pendingSlotsAdd.map((s) => ({
                        listingId: version.listingId,
                        startsAt: new Date(s.startsAt),
                        endsAt: new Date(s.endsAt),
                        price: s.price ? (0, money_1.rsdToPara)(s.price) : null,
                        maxBookings: s.maxBookings ?? 1,
                    })),
                });
            }
            await tx.listingVersion.update({
                where: { id: version.id },
                data: { status: client_1.VersionStatus.APPROVED, reviewedByUserId: adminUserId, reviewedAt: new Date() },
            });
        });
        this.events.emit('listing.edit_approved', { listingId: version.listingId });
        return { message: this.i18n.t('common.SUCCESS') };
    }
    async adminRejectVersion(adminUserId, versionId, dto) {
        const version = await this.prisma.listingVersion.findUniqueOrThrow({ where: { id: versionId } });
        await this.prisma.$transaction([
            this.prisma.listingPhoto.deleteMany({ where: { versionId: version.id } }),
            this.prisma.listingVersion.update({
                where: { id: version.id },
                data: {
                    status: client_1.VersionStatus.REJECTED,
                    rejectionReason: dto.reason,
                    reviewedByUserId: adminUserId,
                    reviewedAt: new Date(),
                },
            }),
        ]);
        this.events.emit('listing.edit_rejected', { listingId: version.listingId, reason: dto.reason });
        return { message: this.i18n.t('common.SUCCESS') };
    }
    async sendPriceDropNotifications() {
        const favorites = await this.prisma.favorite.findMany({
            where: { priceDropNotifiedAt: null },
            include: { listing: { select: { id: true, price: true, status: true, title: true, slug: true } } },
        });
        for (const favorite of favorites) {
            if (favorite.listing.status !== client_1.ListingStatus.ACTIVE)
                continue;
            if (favorite.listing.price >= favorite.priceAtAdd)
                continue;
            await this.prisma.favorite.update({
                where: { userId_listingId: { userId: favorite.userId, listingId: favorite.listingId } },
                data: { priceDropNotifiedAt: new Date() },
            });
            this.events.emit('listing.favorite_price_dropped', { userId: favorite.userId, listingId: favorite.listingId });
        }
    }
    async assertOwnership(userId, listingId) {
        const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
        if (!listing)
            throw new common_1.NotFoundException(this.i18n.t('errors.LISTING_NOT_FOUND'));
        if (listing.userId !== userId)
            throw new common_1.ForbiddenException();
        return listing;
    }
    async getFullListing(listingId) {
        return this.prisma.listing.findUnique({
            where: { id: listingId },
            include: {
                photos: { orderBy: { displayOrder: 'asc' } },
                faqs: { orderBy: { displayOrder: 'asc' } },
                extraServices: true,
                attributes: true,
                category: true,
                region: true,
                city: true,
                cityArea: true,
            },
        });
    }
    async queueModeratedChange(listingId, fields) {
        const versionId = await this.getOrCreatePendingVersionId(listingId, {});
        const existing = await this.prisma.listingVersion.findUniqueOrThrow({ where: { id: versionId } });
        const merged = { ...existing.changedFields, ...fields };
        await this.prisma.listingVersion.update({
            where: { id: versionId },
            data: { changedFields: merged },
        });
        this.events.emit('listing.edit_submitted', { listingId, versionId });
    }
    async getOrCreatePendingVersionId(listingId, initialFields) {
        const existing = await this.prisma.listingVersion.findFirst({
            where: { listingId, status: client_1.VersionStatus.PENDING },
        });
        if (existing)
            return existing.id;
        const { photosChanged, ...rest } = initialFields;
        const created = await this.prisma.listingVersion.create({
            data: {
                listingId,
                changedFields: (photosChanged ? { photosChanged: true, ...rest } : rest),
            },
        });
        return created.id;
    }
    async runAutomaticChecks(listingId) {
        const listing = await this.prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
        const photoCount = await this.prisma.listingPhoto.count({ where: { listingId, pendingRemoval: false } });
        const requiredAttrs = (await this.taxonomy.resolveAttributesForCategory(listing.categoryId)).filter((a) => a.required);
        const setValues = await this.prisma.listingAttribute.findMany({ where: { listingId } });
        const setIds = new Set(setValues.map((v) => v.attributeId));
        const priorRejections = await this.prisma.listingModeration.count({
            where: { listing: { userId: listing.userId }, decision: client_1.ModerationDecision.REJECTED },
        });
        return {
            hasPhotos: photoCount > 0 ? 'OK' : 'WARNING',
            requiredFields: requiredAttrs.every((a) => setIds.has(a.id)) ? 'OK' : 'WARNING',
            descriptionContactInfo: (0, contact_detector_1.containsContactInfo)(listing.description) ? 'WARNING' : 'OK',
            priceInRange: 'OK',
            priorRejections: priorRejections > 0 ? 'WARNING' : 'OK',
        };
    }
    async getModerationSlaHours() {
        const setting = await this.prisma.setting.findUnique({ where: { key: 'moderation_sla_hours' } });
        return typeof setting?.value === 'number' ? setting.value : MODERATION_SLA_HOURS;
    }
    async getAutoApproveEnabled() {
        const setting = await this.prisma.setting.findUnique({ where: { key: 'auto_approve_listings' } });
        return typeof setting?.value === 'boolean' ? setting.value : false;
    }
    hoursSince(date) {
        return Math.round((Date.now() - date.getTime()) / (60 * 60 * 1000));
    }
    async uniqueSlug(base) {
        const short = () => Math.random().toString(36).slice(2, 8);
        let candidate = `${slugify(base)}-${short()}`;
        while (await this.prisma.listing.findUnique({ where: { slug: candidate } })) {
            candidate = `${slugify(base)}-${short()}`;
        }
        return candidate;
    }
    serialize(listing) {
        return {
            ...listing,
            price: (0, money_1.paraToRsd)(listing.price),
            weekendPrice: (0, money_1.paraToRsd)(listing.weekendPrice),
            pricePerGuest: (0, money_1.paraToRsd)(listing.pricePerGuest),
            ...(listing.extraServices
                ? { extraServices: listing.extraServices.map((s) => ({ ...s, price: (0, money_1.paraToRsd)(s.price) })) }
                : {}),
        };
    }
};
exports.ListingsService = ListingsService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_DAY_AT_9AM),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ListingsService.prototype, "sendPriceDropNotifications", null);
exports.ListingsService = ListingsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        cache_service_1.CacheService,
        uploads_service_1.UploadsService,
        geocoding_service_1.GeocodingService,
        taxonomy_service_1.TaxonomyService,
        users_service_1.UsersService,
        nestjs_i18n_1.I18nService,
        event_emitter_1.EventEmitter2])
], ListingsService);
function slugify(input) {
    return input
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}
//# sourceMappingURL=listings.service.js.map