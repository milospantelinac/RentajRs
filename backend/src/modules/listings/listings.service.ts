import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { I18nService } from 'nestjs-i18n';
import { ListingStatus, ModerationDecision, Prisma, VersionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../common/cache/cache.service';
import { UploadsService } from '../../common/uploads/uploads.service';
import { GeocodingService } from '../../common/geocoding/geocoding.service';
import { TaxonomyService } from '../taxonomy/taxonomy.service';
import { UsersService } from '../users/users.service';
import { containsContactInfo } from '../../common/utils/contact-detector';
import { rsdToPara, paraToRsd } from '../../common/utils/money';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { UpsertAttributesDto } from './dto/upsert-attributes.dto';
import { UpsertFaqsDto } from './dto/upsert-faqs.dto';
import { UpsertExtraServicesDto } from './dto/upsert-extra-services.dto';
import { RejectListingDto, RejectVersionDto } from './dto/reject-listing.dto';

// Fields that, once a listing is ACTIVE, must go through the moderation
// queue instead of writing straight to the live row (R31). Location and
// photos are handled by their own dedicated methods below.
const MODERATED_FIELDS = new Set(['title']);

const MAX_PHOTOS = 20;
const MODERATION_SLA_HOURS = 24;

@Injectable()
export class ListingsService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
    private uploads: UploadsService,
    private geocoding: GeocodingService,
    private taxonomy: TaxonomyService,
    private users: UsersService,
    private i18n: I18nService,
    private events: EventEmitter2,
  ) {}

  // -- Owner-facing --------------------------------------------------------

  async createDraft(userId: string, dto: CreateListingDto) {
    const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
    if (!category) throw new NotFoundException(this.i18n.t('errors.LISTING_NOT_FOUND'));

    const slug = await this.uniqueSlug('novi-oglas');
    const listing = await this.prisma.listing.create({
      data: {
        userId,
        categoryId: category.id,
        status: ListingStatus.DRAFT,
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

  async getMine(userId: string) {
    const listings = await this.prisma.listing.findMany({
      where: { userId, status: { not: ListingStatus.DELETED } },
      orderBy: { createdAt: 'desc' },
      include: { photos: { where: { isCover: true }, take: 1 }, category: true },
    });
    return listings.map((l) => this.serialize(l));
  }

  async getOwned(userId: string, listingId: string) {
    const listing = await this.getFullListing(listingId);
    if (!listing) throw new NotFoundException(this.i18n.t('errors.LISTING_NOT_FOUND'));
    if (listing.userId !== userId) throw new ForbiddenException();
    return this.serialize(listing);
  }

  async updateListing(userId: string, listingId: string, dto: UpdateListingDto) {
    const listing = await this.assertOwnership(userId, listingId);

    const priceFields: Record<string, bigint> = {};
    if (dto.price !== undefined) priceFields.price = rsdToPara(dto.price);
    if (dto.weekendPrice !== undefined) priceFields.weekendPrice = rsdToPara(dto.weekendPrice);
    if (dto.pricePerGuest !== undefined) priceFields.pricePerGuest = rsdToPara(dto.pricePerGuest);

    const { price, weekendPrice, pricePerGuest, title, mandatoryFees, ...rest } = dto;
    const data: Prisma.ListingUpdateInput = { ...rest, ...priceFields };
    if (mandatoryFees) data.mandatoryFees = mandatoryFees as unknown as Prisma.InputJsonValue;

    const descriptionFlaggedContact =
      dto.description !== undefined ? containsContactInfo(dto.description) : undefined;

    if (listing.status === ListingStatus.ACTIVE && title !== undefined && title !== listing.title) {
      await this.queueModeratedChange(listing.id, { title });
      // Everything else in the payload (all immediate fields) still applies now.
    } else if (title !== undefined) {
      data.title = title;
      // Slug tracks the title only pre-publish — once ACTIVE, R133's
      // "rename changes the URL with a permanent redirect" is a documented
      // future improvement rather than being implemented for individual
      // listings (unlike categories, which already get one on merge/promote).
      if (listing.status === ListingStatus.DRAFT) {
        data.slug = await this.uniqueSlug(title || 'novi-oglas');
      }
    }

    const updated = await this.prisma.listing.update({ where: { id: listing.id }, data });

    if (descriptionFlaggedContact) {
      this.events.emit('listing.description_flagged_contact_info', { listingId: listing.id });
    }

    return this.serialize(updated);
  }

  /** Korak 5. Moderated on an ACTIVE listing (R31); direct write pre-publish. */
  async updateLocation(userId: string, listingId: string, dto: UpdateLocationDto) {
    const listing = await this.assertOwnership(userId, listingId);
    const city = await this.prisma.city.findUniqueOrThrow({ where: { id: dto.cityId } });
    const coords = await this.geocoding.geocode(dto.address, city.name);

    const locationData = {
      regionId: dto.regionId,
      cityId: dto.cityId,
      cityAreaId: dto.cityAreaId ?? null,
      address: dto.address,
      latitude: coords?.latitude,
      longitude: coords?.longitude,
    };

    if (listing.status === ListingStatus.ACTIVE) {
      await this.queueModeratedChange(listing.id, locationData);
      return this.serialize(await this.prisma.listing.findUniqueOrThrow({ where: { id: listing.id } }));
    }

    const updated = await this.prisma.listing.update({ where: { id: listing.id }, data: locationData });
    return this.serialize(updated);
  }

  /** Korak 4 — immediate write (Ch.4.6 table). */
  async upsertAttributes(userId: string, listingId: string, dto: UpsertAttributesDto) {
    const listing = await this.assertOwnership(userId, listingId);
    const allowedAttributes = await this.taxonomy.resolveAttributesForCategory(listing.categoryId);
    const allowedIds = new Set(allowedAttributes.map((a) => a.id));

    await this.prisma.$transaction(
      dto.values
        .filter((v) => allowedIds.has(v.attributeId))
        .map((v) =>
          this.prisma.listingAttribute.upsert({
            where: { listingId_attributeId: { listingId: listing.id, attributeId: v.attributeId } },
            update: {
              valueNumber: v.valueNumber,
              valueText: v.valueText,
              valueBoolean: v.valueBoolean,
              valueOptionIds: v.valueOptionIds ?? [],
            },
            create: {
              listingId: listing.id,
              attributeId: v.attributeId,
              valueNumber: v.valueNumber,
              valueText: v.valueText,
              valueBoolean: v.valueBoolean,
              valueOptionIds: v.valueOptionIds ?? [],
            },
          }),
        ),
    );
    return { message: this.i18n.t('common.SUCCESS') };
  }

  async upsertFaqs(userId: string, listingId: string, dto: UpsertFaqsDto) {
    const listing = await this.assertOwnership(userId, listingId);
    await this.prisma.$transaction([
      this.prisma.listingFaq.deleteMany({ where: { listingId: listing.id } }),
      this.prisma.listingFaq.createMany({
        data: dto.faqs.map((f, i) => ({ listingId: listing.id, question: f.question, answer: f.answer, displayOrder: i })),
      }),
    ]);
    return { message: this.i18n.t('common.SUCCESS') };
  }

  async upsertExtraServices(userId: string, listingId: string, dto: UpsertExtraServicesDto) {
    const listing = await this.assertOwnership(userId, listingId);
    await this.prisma.$transaction([
      this.prisma.listingExtraService.deleteMany({ where: { listingId: listing.id } }),
      this.prisma.listingExtraService.createMany({
        data: dto.services.map((s) => ({
          listingId: listing.id,
          name: s.name,
          description: s.description,
          price: rsdToPara(s.price),
          chargeType: s.chargeType,
          maxQuantity: s.maxQuantity,
        })),
      }),
    ]);
    return { message: this.i18n.t('common.SUCCESS') };
  }

  // -- Photos ----------------------------------------------------------

  async addPhoto(userId: string, listingId: string, file: Express.Multer.File) {
    const listing = await this.assertOwnership(userId, listingId);
    const currentCount = await this.prisma.listingPhoto.count({
      where: { listingId: listing.id, pendingRemoval: false },
    });
    if (currentCount >= MAX_PHOTOS) {
      throw new BadRequestException(this.i18n.t('errors.PHOTO_LIMIT_EXCEEDED', { args: { max: MAX_PHOTOS } }));
    }

    const { url } = await this.uploads.saveImage(file, `listings/${listing.id}`, { maxWidth: 1920 });
    let versionId: string | undefined;
    if (listing.status === ListingStatus.ACTIVE) {
      versionId = await this.getOrCreatePendingVersionId(listing.id, { photosChanged: true });
    }

    const isFirstPhoto = currentCount === 0 && !versionId;
    const photo = await this.prisma.listingPhoto.create({
      data: { listingId: listing.id, url, displayOrder: currentCount, isCover: isFirstPhoto, versionId },
    });
    return photo;
  }

  async removePhoto(userId: string, listingId: string, photoId: string) {
    const listing = await this.assertOwnership(userId, listingId);
    const photo = await this.prisma.listingPhoto.findFirst({ where: { id: photoId, listingId: listing.id } });
    if (!photo) throw new NotFoundException();

    if (listing.status === ListingStatus.ACTIVE) {
      const versionId = await this.getOrCreatePendingVersionId(listing.id, { photosChanged: true });
      if (photo.versionId === versionId) {
        // Photo was added in this same pending version — just drop it outright.
        await this.prisma.listingPhoto.delete({ where: { id: photo.id } });
      } else {
        await this.prisma.listingPhoto.update({ where: { id: photo.id }, data: { pendingRemoval: true, versionId } });
      }
    } else {
      await this.prisma.listingPhoto.delete({ where: { id: photo.id } });
    }
    return { message: this.i18n.t('common.SUCCESS') };
  }

  async reorderPhotos(userId: string, listingId: string, photoIds: string[]) {
    const listing = await this.assertOwnership(userId, listingId);
    await this.prisma.$transaction(
      photoIds.map((id, index) =>
        this.prisma.listingPhoto.update({
          where: { id },
          data: { displayOrder: index, isCover: index === 0 },
        }),
      ),
    );
    void listing;
    return { message: this.i18n.t('common.SUCCESS') };
  }

  // -- Readiness / submission -----------------------------------------

  /** Drives the wizard's "ready to choose a package" gate. */
  async getReadiness(userId: string, listingId: string) {
    const listing = await this.assertOwnership(userId, listingId);
    const requiredAttributes = (await this.taxonomy.resolveAttributesForCategory(listing.categoryId)).filter(
      (a) => a.required,
    );
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

  /**
   * Called by SubscriptionsService once the owner picks & pays for a package
   * (Korak 11) — outside this module's own scope on purpose, see
   * SubscriptionsService.purchaseForListing() in the billing module.
   */
  async markPendingApproval(listingId: string, subscriptionId: string) {
    const listing = await this.prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
    if (listing.status !== ListingStatus.DRAFT && listing.status !== ListingStatus.REJECTED) {
      throw new BadRequestException('Listing is not awaiting submission');
    }
    const updated = await this.prisma.listing.update({
      where: { id: listingId },
      data: { status: ListingStatus.PENDING_APPROVAL, subscriptionId },
    });
    const checkResults = await this.runAutomaticChecks(listingId);
    await this.prisma.listingModeration.create({
      data: {
        listingId,
        checkResults: checkResults as unknown as Prisma.InputJsonValue,
        hasWarnings: Object.values(checkResults).some((v) => v === 'WARNING'),
      },
    });
    this.events.emit('listing.submitted_for_approval', { listingId });
    return this.serialize(updated);
  }

  async deleteListing(userId: string, listingId: string) {
    const listing = await this.assertOwnership(userId, listingId);
    const activeBookings = await this.prisma.booking.count({
      where: { listingId: listing.id, status: { in: ['REQUESTED', 'AWAITING_PAYMENT', 'CONFIRMED'] } },
    });
    if (activeBookings > 0 && listing.paymentMethod) {
      throw new BadRequestException(
        'This listing has active bookings — change its payment method to stop accepting new ones first, or wait until they complete',
      );
    }
    await this.prisma.listing.update({
      where: { id: listing.id },
      data: { status: ListingStatus.DELETED, deletedAt: new Date() },
    });
    return { message: this.i18n.t('common.SUCCESS') };
  }

  // -- Public ------------------------------------------------------------

  async getPublicBySlug(slug: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { slug },
      include: {
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
      },
    });
    if (!listing || listing.status !== ListingStatus.ACTIVE) {
      throw new NotFoundException(this.i18n.t('errors.LISTING_NOT_FOUND'));
    }

    const attributes = await this.taxonomy.resolveAttributesForCategory(listing.categoryId);
    const values = await this.prisma.listingAttribute.findMany({ where: { listingId: listing.id } });
    const valueMap = new Map(values.map((v) => [v.attributeId, v]));

    await this.recordView(listing.id);

    return {
      ...this.serialize(listing),
      photos: listing.photos,
      faqs: listing.faqs,
      extraServices: listing.extraServices.map((s) => ({ ...s, price: paraToRsd(s.price) })),
      category: listing.category,
      region: listing.region,
      city: listing.city,
      cityArea: listing.cityArea,
      owner: listing.user,
      attributes: attributes.map((a) => ({ ...a, value: valueMap.get(a.id) ?? null })),
    };
  }

  private async recordView(listingId: string) {
    await this.prisma.listing.update({ where: { id: listingId }, data: { viewCount: { increment: 1 } } });
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    await this.prisma.listingViewStat.upsert({
      where: { listingId_date: { listingId, date: today } },
      update: { viewCount: { increment: 1 } },
      create: { listingId, date: today, viewCount: 1, uniqueVisitors: 0 },
    });
  }

  // -- Admin: moderation -------------------------------------------------

  async adminGetQueue() {
    const [listings, versions] = await Promise.all([
      this.prisma.listing.findMany({
        where: { status: ListingStatus.PENDING_APPROVAL },
        orderBy: { createdAt: 'asc' },
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true } }, category: true, photos: true },
      }),
      this.prisma.listingVersion.findMany({
        where: { status: VersionStatus.PENDING },
        orderBy: { submittedAt: 'asc' },
        include: { listing: { include: { user: { select: { id: true, firstName: true, lastName: true } } } } },
      }),
    ]);
    return {
      newListings: listings.map((l) => ({ ...this.serialize(l), waitingHours: this.hoursSince(l.createdAt) })),
      pendingEdits: versions.map((v) => ({ ...v, waitingHours: this.hoursSince(v.submittedAt) })),
      slaHours: MODERATION_SLA_HOURS,
    };
  }

  async adminApprove(adminUserId: string, listingId: string) {
    const listing = await this.prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
    const isFirstApproval = !listing.publishedAt;

    const updated = await this.prisma.listing.update({
      where: { id: listingId },
      data: { status: ListingStatus.ACTIVE, publishedAt: listing.publishedAt ?? new Date() },
    });
    await this.prisma.listingModeration.updateMany({
      where: { listingId, decision: null },
      data: { decision: ModerationDecision.APPROVED, decidedByUserId: adminUserId, decidedAt: new Date() },
    });

    if (isFirstApproval) {
      await this.users.ensureProfileSlug(listing.userId);
    }
    await this.cache.delByPrefix('taxonomy:category:');
    this.events.emit('listing.approved', { listingId, userId: listing.userId });
    return this.serialize(updated);
  }

  async adminReject(adminUserId: string, listingId: string, dto: RejectListingDto) {
    const listing = await this.prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
    const updated = await this.prisma.listing.update({
      where: { id: listingId },
      data: { status: ListingStatus.REJECTED },
    });
    await this.prisma.listingModeration.updateMany({
      where: { listingId, decision: null },
      data: {
        decision: ModerationDecision.REJECTED,
        rejectionReason: dto.reason,
        note: dto.note,
        decidedByUserId: adminUserId,
        decidedAt: new Date(),
      },
    });
    this.events.emit('listing.rejected', { listingId, userId: listing.userId, reason: dto.reason });
    return this.serialize(updated);
  }

  async adminApproveVersion(adminUserId: string, versionId: string) {
    const version = await this.prisma.listingVersion.findUniqueOrThrow({ where: { id: versionId } });
    const fields = version.changedFields as Record<string, unknown>;

    await this.prisma.$transaction(async (tx) => {
      const { photosChanged, ...listingFields } = fields as any;
      if (Object.keys(listingFields).length) {
        await tx.listing.update({ where: { id: version.listingId }, data: listingFields });
      }
      if (photosChanged) {
        await tx.listingPhoto.deleteMany({ where: { versionId: version.id, pendingRemoval: true } });
        await tx.listingPhoto.updateMany({ where: { versionId: version.id }, data: { versionId: null } });
      }
      await tx.listingVersion.update({
        where: { id: version.id },
        data: { status: VersionStatus.APPROVED, reviewedByUserId: adminUserId, reviewedAt: new Date() },
      });
    });

    this.events.emit('listing.edit_approved', { listingId: version.listingId });
    return { message: this.i18n.t('common.SUCCESS') };
  }

  async adminRejectVersion(adminUserId: string, versionId: string, dto: RejectVersionDto) {
    const version = await this.prisma.listingVersion.findUniqueOrThrow({ where: { id: versionId } });
    await this.prisma.$transaction([
      this.prisma.listingPhoto.deleteMany({ where: { versionId: version.id } }),
      this.prisma.listingVersion.update({
        where: { id: version.id },
        data: {
          status: VersionStatus.REJECTED,
          rejectionReason: dto.reason,
          reviewedByUserId: adminUserId,
          reviewedAt: new Date(),
        },
      }),
    ]);
    this.events.emit('listing.edit_rejected', { listingId: version.listingId, reason: dto.reason });
    return { message: this.i18n.t('common.SUCCESS') };
  }

  /** Ch.22.4 "Pad cene sačuvanog oglasa" — notifies once per drop episode, never spams on every re-check. */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async sendPriceDropNotifications() {
    const favorites = await this.prisma.favorite.findMany({
      where: { priceDropNotifiedAt: null },
      include: { listing: { select: { id: true, price: true, status: true, title: true, slug: true } } },
    });
    for (const favorite of favorites) {
      if (favorite.listing.status !== ListingStatus.ACTIVE) continue;
      if (favorite.listing.price >= favorite.priceAtAdd) continue;
      await this.prisma.favorite.update({
        where: { userId_listingId: { userId: favorite.userId, listingId: favorite.listingId } },
        data: { priceDropNotifiedAt: new Date() },
      });
      this.events.emit('listing.favorite_price_dropped', { userId: favorite.userId, listingId: favorite.listingId });
    }
  }

  // -- Internal helpers --------------------------------------------------

  private async assertOwnership(userId: string, listingId: string) {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundException(this.i18n.t('errors.LISTING_NOT_FOUND'));
    if (listing.userId !== userId) throw new ForbiddenException();
    return listing;
  }

  private async getFullListing(listingId: string) {
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

  /** R32: an ACTIVE listing must not change what's already public until an edit is approved. */
  private async queueModeratedChange(listingId: string, fields: Record<string, unknown>) {
    const versionId = await this.getOrCreatePendingVersionId(listingId, {});
    const existing = await this.prisma.listingVersion.findUniqueOrThrow({ where: { id: versionId } });
    const merged = { ...(existing.changedFields as Record<string, unknown>), ...fields };
    await this.prisma.listingVersion.update({
      where: { id: versionId },
      data: { changedFields: merged as unknown as Prisma.InputJsonValue },
    });
    this.events.emit('listing.edit_submitted', { listingId, versionId });
  }

  private async getOrCreatePendingVersionId(
    listingId: string,
    initialFields: Record<string, unknown>,
  ): Promise<string> {
    const existing = await this.prisma.listingVersion.findFirst({
      where: { listingId, status: VersionStatus.PENDING },
    });
    if (existing) return existing.id;

    const { photosChanged, ...rest } = initialFields as any;
    const created = await this.prisma.listingVersion.create({
      data: {
        listingId,
        changedFields: (photosChanged ? { photosChanged: true, ...rest } : rest) as unknown as Prisma.InputJsonValue,
      },
    });
    return created.id;
  }

  /** Ch.4.5 — automated pre-checks shown to the admin; v1 warns rather than blocks (R119 groundwork). */
  private async runAutomaticChecks(listingId: string): Promise<Record<string, 'OK' | 'WARNING'>> {
    const listing = await this.prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
    const photoCount = await this.prisma.listingPhoto.count({ where: { listingId, pendingRemoval: false } });
    const requiredAttrs = (await this.taxonomy.resolveAttributesForCategory(listing.categoryId)).filter((a) => a.required);
    const setValues = await this.prisma.listingAttribute.findMany({ where: { listingId } });
    const setIds = new Set(setValues.map((v) => v.attributeId));
    const priorRejections = await this.prisma.listingModeration.count({
      where: { listing: { userId: listing.userId }, decision: ModerationDecision.REJECTED },
    });

    return {
      hasPhotos: photoCount > 0 ? 'OK' : 'WARNING',
      requiredFields: requiredAttrs.every((a) => setIds.has(a.id)) ? 'OK' : 'WARNING',
      descriptionContactInfo: containsContactInfo(listing.description) ? 'WARNING' : 'OK',
      priceInRange: 'OK', // category price-range heuristics are a documented future improvement
      priorRejections: priorRejections > 0 ? 'WARNING' : 'OK',
    };
  }

  private hoursSince(date: Date): number {
    return Math.round((Date.now() - date.getTime()) / (60 * 60 * 1000));
  }

  private async uniqueSlug(base: string): Promise<string> {
    const short = () => Math.random().toString(36).slice(2, 8);
    let candidate = `${slugify(base)}-${short()}`;
    while (await this.prisma.listing.findUnique({ where: { slug: candidate } })) {
      candidate = `${slugify(base)}-${short()}`;
    }
    return candidate;
  }

  private serialize(listing: any) {
    return {
      ...listing,
      price: paraToRsd(listing.price),
      weekendPrice: paraToRsd(listing.weekendPrice),
      pricePerGuest: paraToRsd(listing.pricePerGuest),
      ...(listing.extraServices
        ? { extraServices: listing.extraServices.map((s: any) => ({ ...s, price: paraToRsd(s.price) })) }
        : {}),
    };
  }
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
