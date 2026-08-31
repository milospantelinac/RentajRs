import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { I18nService } from 'nestjs-i18n';
import { ListingStatus, ModerationDecision, Prisma } from '@prisma/client';
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
import { RejectListingDto } from './dto/reject-listing.dto';
import { CreateUncategorizedListingDto } from './dto/create-uncategorized-listing.dto';
import { FALLBACK_CATEGORY_SLUG } from '../taxonomy/taxonomy.service';

// Once a listing is ACTIVE, title/location/photos must go through the
// moderation queue instead of writing straight to the live row (R31) — each
// is handled by its own dedicated method below (updateListing's title branch,
// updateLocation, addPhoto/removePhoto/reorderPhotos).

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
    const owner = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (owner.restrictedUntil && owner.restrictedUntil.getTime() > Date.now()) {
      throw new ForbiddenException(this.i18n.t('errors.ACCOUNT_RESTRICTED'));
    }

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

  /**
   * "Otključaj svoju kategoriju" (Kategorije spec §8) — no categoryId from
   * the owner at all; parks the draft under the hidden Ostalo fallback with
   * pendingCategoryAssignment=true so an admin assigns the real category
   * from the moderation queue. Everything else (attributes, location,
   * photos, pricing detail) is filled in through the normal wizard
   * afterward — Ostalo just has no category-specific attributes yet.
   */
  async createUncategorizedListing(userId: string, dto: CreateUncategorizedListingDto) {
    const owner = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (owner.restrictedUntil && owner.restrictedUntil.getTime() > Date.now()) {
      throw new ForbiddenException(this.i18n.t('errors.ACCOUNT_RESTRICTED'));
    }

    const fallback = await this.prisma.category.findUniqueOrThrow({ where: { slug: FALLBACK_CATEGORY_SLUG } });
    const slug = await this.uniqueSlug(dto.title || 'novi-oglas');
    const listing = await this.prisma.listing.create({
      data: {
        userId,
        categoryId: fallback.id,
        status: ListingStatus.DRAFT,
        title: dto.title,
        description: dto.description ?? '',
        slug,
        bookingModel: dto.bookingModel,
        priceUnit: dto.priceUnit ?? fallback.defaultPriceUnit,
        price: 0n,
        pendingCategoryAssignment: true,
      },
    });
    return this.serialize(listing);
  }

  async getMine(userId: string) {
    const listings = await this.prisma.listing.findMany({
      where: { userId, status: { not: ListingStatus.DELETED } },
      orderBy: { createdAt: 'desc' },
      include: {
        photos: { where: { isCover: true }, take: 1 },
        category: true,
        // RNT-060 — "Moji oglasi" is where an owner sees what their
        // subscription paid for, per listing, not just the listing itself.
        subscription: { select: { package: { select: { key: true } }, status: true, expiresAt: true } },
      },
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

    // Dodavanje Oglasa spec §0/§2 — the owner only ever chooses "online
    // rezervacije" vs "bez rezervacije"; PER_STAY vs PER_SLOT always comes
    // from the category. Guard against a client sending a mismatched value.
    // Exempt "Otključaj svoju kategoriju" listings (Kategorije spec §8) —
    // they're parked under the Ostalo fallback with their OWN owner-chosen
    // bookingModel until an admin assigns the real category, so Ostalo's
    // own defaultBookingModel isn't the constraint yet.
    if (dto.bookingModel !== undefined && dto.bookingModel !== 'NO_BOOKING' && !listing.pendingCategoryAssignment) {
      const category = await this.prisma.category.findUniqueOrThrow({ where: { id: listing.categoryId } });
      if (dto.bookingModel !== category.defaultBookingModel) {
        throw new BadRequestException('bookingModel must match the category\'s booking model, or be NO_BOOKING');
      }
    }

    const priceFields: Record<string, bigint> = {};
    if (dto.price !== undefined) priceFields.price = rsdToPara(dto.price);
    if (dto.weekendPrice !== undefined) priceFields.weekendPrice = rsdToPara(dto.weekendPrice);
    if (dto.pricePerGuest !== undefined) priceFields.pricePerGuest = rsdToPara(dto.pricePerGuest);

    const { price, weekendPrice, pricePerGuest, title, mandatoryFees, ...rest } = dto;
    const data: Prisma.ListingUpdateInput = { ...rest, ...priceFields };
    if (mandatoryFees) data.mandatoryFees = mandatoryFees as unknown as Prisma.InputJsonValue;

    const descriptionFlaggedContact =
      dto.description !== undefined ? containsContactInfo(dto.description) : undefined;

    if (title !== undefined) {
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

  /** Korak 5 — direct write, at any listing status (T84: edit moderation removed). */
  async updateLocation(userId: string, listingId: string, dto: UpdateLocationDto) {
    const listing = await this.assertOwnership(userId, listingId);
    const city = await this.prisma.city.findUniqueOrThrow({ where: { id: dto.cityId } });
    // RNT-026 — a dragged pin from the wizard's map wins over auto-geocoding;
    // otherwise fall back to R40's original automatic behavior.
    const coords =
      dto.latitude !== undefined && dto.longitude !== undefined
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

    const updated = await this.prisma.listing.update({ where: { id: listing.id }, data: locationData });
    return this.serialize(updated);
  }

  /** Korak 4 — immediate write (Ch.4.6 table). */
  async upsertAttributes(userId: string, listingId: string, dto: UpsertAttributesDto) {
    const listing = await this.assertOwnership(userId, listingId);
    const allowedAttributes = await this.taxonomy.resolveAttributesForCategory(listing.categoryId);
    const attributesById = new Map(allowedAttributes.map((a) => [a.id, a]));

    const submitted = dto.values.filter((v) => attributesById.has(v.attributeId));
    // RNT-023 — the wizard sends one entry per attribute regardless of
    // whether the owner actually filled it in, so a naive upsert would
    // create a "value" row for an untouched required field and the review
    // checklist (which only checks "does a row exist") would call it done.
    // A BOOLEAN has no empty state (false is a real answer), so it always
    // counts as filled; every other type needs its value present.
    // AttributeType has 7 members (NUMBER/TEXT/TEXTAREA/YEAR/LIST/
    // MULTISELECT/CHECKBOX_GROUP) but this used to only recognize 5 of
    // them — YEAR and TEXTAREA fell through to the LIST/MULTISELECT branch,
    // which checks valueOptionIds (a field neither of them ever populates),
    // so they always evaluated as empty and got silently discarded below
    // (T33: a required YEAR field like "Godina proizvodnje" could never be
    // saved, so Step 9's "required fields" check never passed).
    const toWrite = submitted.filter((v) => {
      const type = attributesById.get(v.attributeId)!.type;
      if (type === 'NUMBER' || type === 'YEAR') return v.valueNumber !== null && v.valueNumber !== undefined;
      if (type === 'TEXT' || type === 'TEXTAREA') return !!v.valueText;
      if (type === 'BOOLEAN') return true;
      return (v.valueOptionIds ?? []).length > 0; // LIST / MULTISELECT / CHECKBOX_GROUP
    });
    const toClear = submitted.filter((v) => !toWrite.includes(v)).map((v) => v.attributeId);

    // Only the field matching the attribute's own type gets written — the
    // DTO carries all four value slots per entry regardless of type, and
    // writing them verbatim left every attribute's unused slots non-null
    // (e.g. a NUMBER attribute stored with valueBoolean: false), which made
    // any code reading "which field is set" to infer the type — like the
    // guest-facing display — misread a number as an unanswered boolean "No".
    const typedValue = (v: (typeof toWrite)[number]) => {
      const type = attributesById.get(v.attributeId)!.type;
      return {
        valueNumber: type === 'NUMBER' || type === 'YEAR' ? v.valueNumber : null,
        valueText: type === 'TEXT' || type === 'TEXTAREA' ? v.valueText : null,
        valueBoolean: type === 'BOOLEAN' ? v.valueBoolean : null,
        valueOptionIds: type === 'LIST' || type === 'MULTISELECT' || type === 'CHECKBOX_GROUP' ? (v.valueOptionIds ?? []) : [],
      };
    };

    await this.prisma.$transaction([
      ...toWrite.map((v) =>
        this.prisma.listingAttribute.upsert({
          where: { listingId_attributeId: { listingId: listing.id, attributeId: v.attributeId } },
          update: typedValue(v),
          create: {
            listingId: listing.id,
            attributeId: v.attributeId,
            ...typedValue(v),
          },
        }),
      ),
      // A field the owner cleared back out shouldn't leave a stale row
      // behind — that would let it keep counting as "filled" too.
      this.prisma.listingAttribute.deleteMany({
        where: { listingId: listing.id, attributeId: { in: toClear } },
      }),
    ]);
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
    const isFirstPhoto = currentCount === 0;
    const photo = await this.prisma.listingPhoto.create({
      data: { listingId: listing.id, url, displayOrder: currentCount, isCover: isFirstPhoto },
    });
    return photo;
  }

  async removePhoto(userId: string, listingId: string, photoId: string) {
    const listing = await this.assertOwnership(userId, listingId);
    const photo = await this.prisma.listingPhoto.findFirst({ where: { id: photoId, listingId: listing.id } });
    if (!photo) throw new NotFoundException();

    await this.prisma.listingPhoto.delete({ where: { id: photo.id } });
    return { message: this.i18n.t('common.SUCCESS') };
  }

  /** T84 — applies immediately regardless of listing status; edit moderation was removed. */
  async reorderPhotos(userId: string, listingId: string, photoIds: string[]) {
    const listing = await this.assertOwnership(userId, listingId);
    const livePhotos = await this.prisma.listingPhoto.findMany({
      where: { listingId: listing.id, versionId: null, pendingRemoval: false },
      select: { id: true },
    });
    const liveIds = new Set(livePhotos.map((p) => p.id));
    if (photoIds.length !== liveIds.size || photoIds.some((id) => !liveIds.has(id))) {
      throw new BadRequestException(this.i18n.t('errors.PHOTO_NOT_FOUND'));
    }

    await this.prisma.$transaction(
      photoIds.map((id, index) =>
        this.prisma.listingPhoto.update({
          where: { id },
          data: { displayOrder: index, isCover: index === 0 },
        }),
      ),
    );
    return { message: this.i18n.t('common.SUCCESS') };
  }

  // -- Readiness / submission -----------------------------------------

  /** Drives the wizard's "ready to choose a package" gate. */
  async getReadiness(userId: string, listingId: string) {
    const listing = await this.assertOwnership(userId, listingId);
    const allAttributes = await this.taxonomy.resolveAttributesForCategory(listing.categoryId);
    const requiredAttributes = allAttributes.filter((a) => a.required);
    const setValues = await this.prisma.listingAttribute.findMany({ where: { listingId: listing.id } });
    const setIds = new Set(setValues.map((v) => v.attributeId));
    const photoCount = await this.prisma.listingPhoto.count({ where: { listingId: listing.id, pendingRemoval: false } });
    const owner = await this.prisma.user.findUniqueOrThrow({ where: { id: listing.userId } });

    // T32 — "Definisani termini" (PER_SLOT + DEFINED_SLOTS) prices live per
    // DefinedSlot, entered in Korak 3; the wizard hides the flat "Cena"
    // field entirely for this submode (showFlatPriceFields), so
    // listing.price intentionally stays 0 and the generic check below
    // always read it as missing.
    const hasDefinedSlotPrice =
      listing.bookingModel === 'PER_SLOT' && listing.slotSubmode === 'DEFINED_SLOTS'
        ? (await this.prisma.definedSlot.count({ where: { listingId: listing.id, price: { not: null } } })) > 0
        : listing.price > 0n;

    // T33 — a conditional attribute (Kategorije spec §5 Mašine, e.g.
    // "Nosivost viljuškara" only applies when tip_masine=viljuškar) still
    // has required:true in the DB even when its condition isn't met for
    // THIS listing; treating it as always-required meant a listing could
    // never satisfy every machine-type's fields at once. Only count it when
    // the sibling attribute it depends on actually has that option selected.
    const attributesByKey = new Map(allAttributes.map((a) => [a.key, a]));
    const selectedOptionKeysByAttrKey = new Map<string, Set<string>>();
    for (const v of setValues) {
      const attr = allAttributes.find((a) => a.id === v.attributeId);
      if (!attr || !v.valueOptionIds.length) continue;
      const optionKeys = attr.options.filter((o) => v.valueOptionIds.includes(o.id)).map((o) => o.key);
      selectedOptionKeysByAttrKey.set(attr.key, new Set(optionKeys));
    }
    const isConditionMet = (a: (typeof requiredAttributes)[number]) => {
      if (!a.dependsOnAttrKey) return true;
      const parent = attributesByKey.get(a.dependsOnAttrKey);
      if (!parent) return true;
      return selectedOptionKeysByAttrKey.get(parent.key)?.has(a.dependsOnOptionKey!) ?? false;
    };

    // T33 AC — "Sva obavezna polja kategorije" alone doesn't say which one
    // is actually missing; name them so the owner isn't left guessing.
    const missingAttributes = requiredAttributes.filter(isConditionMet).filter((a) => !setIds.has(a.id));

    const checklist = {
      hasTitle: !!listing.title,
      hasDescription: !!listing.description,
      hasPhotos: photoCount > 0,
      hasLocation: !!listing.cityId,
      hasPrice: hasDefinedSlotPrice,
      hasPaymentMethod: !!listing.paymentMethod,
      hasBankAccountIfNeeded: listing.paymentMethod === 'CASH' || !!owner.bankAccount,
      hasPhone: !!owner.phone,
      requiredAttributesFilled: missingAttributes.length === 0,
    };
    const ready = Object.values(checklist).every(Boolean);
    return { ready, checklist, missingAttributeNames: missingAttributes.map((a) => a.name) };
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
    // R126 — a listing can't go public (leave DRAFT) until the owner has
    // confirmed their email. This is the single choke point every publish
    // path (checkout, admin activation) funnels through.
    const owner = await this.prisma.user.findUniqueOrThrow({ where: { id: listing.userId } });
    if (!owner.emailVerified) {
      throw new ForbiddenException(this.i18n.t('errors.EMAIL_NOT_VERIFIED'));
    }
    const updated = await this.prisma.listing.update({
      where: { id: listingId },
      data: { status: ListingStatus.PENDING_APPROVAL, subscriptionId },
    });
    const checkResults = await this.runAutomaticChecks(listingId);
    const hasWarnings = Object.values(checkResults).some((v) => v === 'WARNING');
    await this.prisma.listingModeration.create({
      data: {
        listingId,
        checkResults: checkResults as unknown as Prisma.InputJsonValue,
        hasWarnings,
      },
    });
    this.events.emit('listing.submitted_for_approval', { listingId });

    // R119 — the switch is off by default (auto_approve_listings=false in the
    // seed), but once an admin flips it on, a submission with zero automated
    // warnings skips the queue entirely instead of the toggle sitting inert.
    if (!hasWarnings && (await this.getAutoApproveEnabled())) {
      return this.adminApprove(null, listingId, true);
    }
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
    // T21 — a checkout started for this listing but never completed
    // (AWAITING_PAYMENT, linked via pendingListingId rather than the
    // listing's own subscriptionId) can never be finished now that the
    // listing is gone; drop it too instead of leaving it stranded in Moje
    // pretplate. A subscription that already has real money/an invoice
    // behind it (PENDING_ACTIVATION or later) is left untouched.
    await this.prisma.subscription.deleteMany({
      where: { pendingListingId: listing.id, status: 'AWAITING_PAYMENT' },
    });
    return { message: this.i18n.t('common.SUCCESS') };
  }

  // -- Public ------------------------------------------------------------

  async getPublicBySlug(slug: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { slug },
      include: this.publicDisplayInclude(),
    });
    if (!listing || listing.status !== ListingStatus.ACTIVE) {
      throw new NotFoundException(this.i18n.t('errors.LISTING_NOT_FOUND'));
    }

    await this.recordView(listing.id);
    return this.buildDisplayPayload(listing);
  }

  /**
   * RNT-031 — the review step's checklist told an owner everything was ready
   * without ever showing what a guest would actually see; this reuses the
   * exact same display shape as the public page (ownership-gated instead of
   * ACTIVE-gated, and no view-count side effect) so the preview can't drift
   * from what publishing will actually look like.
   */
  async getOwnerPreview(userId: string, listingId: string) {
    await this.assertOwnership(userId, listingId);
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: this.publicDisplayInclude(),
    });
    if (!listing) throw new NotFoundException(this.i18n.t('errors.LISTING_NOT_FOUND'));
    return this.buildDisplayPayload(listing);
  }

  private publicDisplayInclude() {
    return {
      photos: { where: { pendingRemoval: false, versionId: null }, orderBy: { displayOrder: 'asc' as const } },
      faqs: { orderBy: { displayOrder: 'asc' as const } },
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
          phone: true,
        },
      },
      subscription: { select: { package: { select: { hasBookings: true, hasMessaging: true } } } },
    };
  }

  private async buildDisplayPayload(listing: any) {
    const attributes = await this.taxonomy.resolveAttributesForCategory(listing.categoryId);
    const values = await this.prisma.listingAttribute.findMany({ where: { listingId: listing.id } });
    const valueMap = new Map(values.map((v) => [v.attributeId, v]));
    // Category.name isn't a column — it lives in the generic Translation
    // table (see TaxonomyService.getCategoryNames, already used to decorate
    // search results the same way) — the raw `category: true` include below
    // only carries slug/id, so the breadcrumb rendered blank without this.
    const categoryNames = await this.taxonomy.getCategoryNames([listing.categoryId]);

    // Ch.11.2/R108 — a listing's package can lack the booking system and/or
    // internal messaging (Osnovni/BASIC has neither). The guest-facing page
    // must know this up front so it never offers a CTA the backend will
    // reject; when neither is available, the owner's phone becomes the
    // contact point, so it's only exposed in that fallback case.
    const canBook = listing.subscription?.package?.hasBookings ?? false;
    const canMessage = listing.subscription?.package?.hasMessaging ?? false;
    const { phone, ...ownerRest } = listing.user;

    return {
      ...this.serialize(listing),
      photos: listing.photos,
      faqs: listing.faqs,
      extraServices: listing.extraServices.map((s: any) => ({ ...s, price: paraToRsd(s.price) })),
      category: { ...listing.category, name: categoryNames.get(listing.categoryId) ?? listing.category.slug },
      region: listing.region,
      city: listing.city,
      cityArea: listing.cityArea,
      owner: { ...ownerRest, phone: canMessage ? undefined : phone },
      attributes: attributes.map((a: any) => ({ ...a, value: valueMap.get(a.id) ?? null })),
      canBook,
      canMessage,
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
    const listings = await this.prisma.listing.findMany({
      where: { status: ListingStatus.PENDING_APPROVAL },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        category: true,
        photos: true,
        // Ch.12.4 — the admin should see only the WARNINGS an automated
        // check raised, not the whole listing. The undecided moderation
        // row created in markPendingApproval() carries exactly that.
        moderations: { where: { decision: null }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
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
      slaHours,
    };
  }

  async adminApprove(adminUserId: string | null, listingId: string, automatic = false) {
    const listing = await this.prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
    const isFirstApproval = !listing.publishedAt;

    const updated = await this.prisma.listing.update({
      where: { id: listingId },
      data: { status: ListingStatus.ACTIVE, publishedAt: listing.publishedAt ?? new Date() },
    });
    await this.prisma.listingModeration.updateMany({
      where: { listingId, decision: null },
      data: {
        decision: ModerationDecision.APPROVED,
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

  /**
   * "Otključaj svoju kategoriju" resolution — admin reviews an owner's
   * self-described listing (parked under Ostalo, pendingCategoryAssignment)
   * and assigns the real category. bookingModel/priceUnit are left as the
   * owner already set them; the category only changes which attributes the
   * wizard now resolves for this listing going forward.
   */
  async adminListPendingCategoryAssignment() {
    const listings = await this.prisma.listing.findMany({
      where: { pendingCategoryAssignment: true, status: { not: ListingStatus.DELETED } },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } }, category: true },
    });
    return listings.map((l) => this.serialize(l));
  }

  async adminAssignCategory(listingId: string, categoryId: string) {
    const category = await this.prisma.category.findUniqueOrThrow({ where: { id: categoryId } });
    const updated = await this.prisma.listing.update({
      where: { id: listingId },
      data: { categoryId: category.id, pendingCategoryAssignment: false },
    });
    return this.serialize(updated);
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

  /** R171 — admin-editable in /admin/podesavanja (Setting.moderation_sla_hours), falls back to the seeded default. */
  private async getModerationSlaHours(): Promise<number> {
    const setting = await this.prisma.setting.findUnique({ where: { key: 'moderation_sla_hours' } });
    return typeof setting?.value === 'number' ? setting.value : MODERATION_SLA_HOURS;
  }

  private async getAutoApproveEnabled(): Promise<boolean> {
    const setting = await this.prisma.setting.findUnique({ where: { key: 'auto_approve_listings' } });
    return typeof setting?.value === 'boolean' ? setting.value : false;
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
