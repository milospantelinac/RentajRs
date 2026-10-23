import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { I18nService } from 'nestjs-i18n';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ListingsService } from '../listings/listings.service';
import { PeriodChange, SubscriptionsService } from '../subscriptions/subscriptions.service';
import { TaxonomyService } from '../taxonomy/taxonomy.service';
import { MAX_PERIOD, PeriodUnit, grantBillingCycle, periodEnd } from '../../common/utils/free-listing-period';
import { normalizeBankAccount } from '../../common/utils/ips-qr';
import {
  AdminListingsQueryDto,
  ChangePeriodDto,
  CreateAdminListingDto,
  OwnerSearchQueryDto,
  PublishFreeListingDto,
} from './dto/admin-listings.dto';

const PAGE_SIZE = 25;
const OWNER_RESULTS = 20;

/**
 * Administracija > Oglasi (the user, 2026-10-22): every listing on the site,
 * and listings an admin adds for an existing user and publishes without any
 * payment, for a number of months or days or with no end. Such a listing goes
 * live at once on the package the admin picks; the owner gets an email, sees
 * it in Moji oglasi as "Besplatno od Rentaja" and may pay to continue once it
 * ends. "Trajanje" moves the end of a free package either way, or gives a paid
 * one extra time.
 */
@Injectable()
export class AdminListingsService {
  constructor(
    private prisma: PrismaService,
    private listings: ListingsService,
    private subscriptions: SubscriptionsService,
    private taxonomy: TaxonomyService,
    private i18n: I18nService,
    private events: EventEmitter2,
  ) {}

  // -- The list ------------------------------------------------------------

  async list(query: AdminListingsQueryDto) {
    const page = query.page ?? 1;
    const search = query.search?.trim();
    const where: Prisma.ListingWhereInput = {
      status: query.status ?? { not: 'DELETED' },
      ...(search ? { AND: searchTerms(search).map((term) => ({ OR: listingMatches(term) })) } : {}),
      ...(query.filter === 'free' ? { subscription: { grantedByAdminId: { not: null } } } : {}),
      ...(query.filter === 'admin' ? { createdByAdminId: { not: null } } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.listing.count({ where }),
      this.prisma.listing.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
          createdByAdmin: { select: { firstName: true, lastName: true } },
          city: { select: { name: true } },
          cityArea: { select: { name: true } },
          photos: {
            where: { pendingRemoval: false, versionId: null },
            orderBy: [{ isCover: 'desc' }, { displayOrder: 'asc' }],
            take: 1,
            select: { url: true },
          },
          subscription: {
            select: { id: true, status: true, expiresAt: true, grantedByAdminId: true, package: { select: { key: true } } },
          },
          featuredPeriods: {
            where: { expiresAt: { gt: new Date() } },
            orderBy: { expiresAt: 'desc' },
            take: 1,
            select: { expiresAt: true },
          },
        },
      }),
    ]);
    const categoryNames = await this.taxonomy.getCategoryNames([...new Set(rows.map((row) => row.categoryId))]);
    const continuedUntil = await this.renewalEnds(rows.flatMap((row) => (row.subscriptionId ? [row.subscriptionId] : [])));

    return {
      total,
      page,
      pageSize: PAGE_SIZE,
      items: rows.map((row) => {
        const subscription = row.subscription;
        return {
          id: row.id,
          title: row.title,
          slug: row.slug,
          status: row.status,
          createdAt: row.createdAt,
          publishedAt: row.publishedAt,
          categoryName: categoryNames.get(row.categoryId) ?? null,
          place: row.cityArea?.name ?? row.city?.name ?? null,
          coverPhotoUrl: row.photos[0]?.url ?? null,
          owner: { id: row.user.id, name: fullName(row.user), email: row.user.email },
          addedBy: row.createdByAdmin ? fullName(row.createdByAdmin) : null,
          // Added by an admin and not published yet: the admin finishes it in the wizard.
          adminDraft: !!row.createdByAdminId && !row.subscriptionId,
          editable: !!row.createdByAdminId,
          package: subscription
            ? {
                key: subscription.package.key,
                status: subscription.status,
                free: !!subscription.grantedByAdminId,
                expiresAt: subscription.expiresAt,
                // A paid continuation already queued carries the listing further.
                continuedUntil: continuedUntil.get(subscription.id) ?? null,
              }
            : null,
          featuredUntil: row.featuredPeriods[0]?.expiresAt ?? null,
        };
      }),
    };
  }

  /** Where each package's queued renewals end, the last of them. */
  private async renewalEnds(subscriptionIds: string[]): Promise<Map<string, Date | null>> {
    const ends = new Map<string, Date | null>();
    let frontier = new Map(subscriptionIds.map((id) => [id, id]));
    for (let depth = 0; frontier.size && depth < 20; depth++) {
      const next = await this.prisma.subscription.findMany({
        where: { renewsSubscriptionId: { in: [...frontier.keys()] }, status: 'SCHEDULED' },
        select: { id: true, renewsSubscriptionId: true, expiresAt: true },
      });
      const following = new Map<string, string>();
      for (const renewal of next) {
        const origin = frontier.get(renewal.renewsSubscriptionId!)!;
        ends.set(origin, renewal.expiresAt);
        following.set(renewal.id, origin);
      }
      frontier = following;
    }
    return ends;
  }

  // -- Adding a listing for a user ------------------------------------------

  /** Existing accounts by name or email, with what their listing will need from their profile. */
  async searchOwners(query: OwnerSearchQueryDto) {
    const search = query.search?.trim() ?? '';
    if (search.length < 2) return [];
    const users = await this.prisma.user.findMany({
      where: {
        anonymizedAt: null,
        AND: searchTerms(search).map((term) => ({
          OR: [
            { email: { contains: term, mode: 'insensitive' } },
            { firstName: { contains: term, mode: 'insensitive' } },
            { lastName: { contains: term, mode: 'insensitive' } },
          ],
        })),
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: OWNER_RESULTS,
      select: OWNER_SELECT,
    });
    return users.map(describeOwner);
  }

  /** One account, for the category step's "Dodajete oglas za ..." line. */
  async getOwner(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { ...OWNER_SELECT, anonymizedAt: true } });
    if (!user || user.anonymizedAt) throw new NotFoundException(this.i18n.t('errors.OWNER_NOT_FOUND'));
    return describeOwner(user);
  }

  /**
   * A draft in the owner's name; the admin fills it in the same wizard owners
   * use. The owner sees it only once it is published (the user, 2026-10-22).
   */
  async createForOwner(adminId: string, dto: CreateAdminListingDto) {
    const owner = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!owner || owner.anonymizedAt) throw new NotFoundException(this.i18n.t('errors.OWNER_NOT_FOUND'));
    if (owner.blocked) throw new BadRequestException(this.i18n.t('errors.OWNER_BLOCKED'));
    const listing = await this.listings.createDraft(owner.id, { categoryId: dto.categoryId }, adminId);
    await this.log(adminId, 'listing.admin_created', listing.id, null, { ownerId: owner.id, categoryId: dto.categoryId });
    return listing;
  }

  /**
   * Live at once, without the review queue or any payment, on the package the
   * admin picks (the user, 2026-10-22). The owner's email address need not be
   * confirmed, but the phone and the bank account the listing needs are the
   * owner's to add, so the listing must be ready as an owner's would.
   */
  async publish(adminId: string, listingId: string, dto: PublishFreeListingDto) {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId }, include: { user: true } });
    if (!listing || listing.status === 'DELETED') throw new NotFoundException(this.i18n.t('errors.LISTING_NOT_FOUND'));
    if (!listing.createdByAdminId) throw new BadRequestException(this.i18n.t('errors.LISTING_NOT_ADMIN_ADDED'));
    if (listing.subscriptionId || listing.status !== 'DRAFT') {
      throw new BadRequestException(this.i18n.t('errors.LISTING_ALREADY_PUBLISHED'));
    }
    if (listing.user.blocked || listing.user.anonymizedAt) throw new BadRequestException(this.i18n.t('errors.OWNER_BLOCKED'));
    const pkg = await this.prisma.package.findUnique({ where: { id: dto.packageId } });
    if (!pkg?.active) throw new BadRequestException(this.i18n.t('errors.PACKAGE_NOT_AVAILABLE'));
    const { ready } = await this.listings.getReadiness(adminId, listingId);
    if (!ready) throw new BadRequestException(this.i18n.t('errors.LISTING_NOT_READY'));

    const unit = dto.duration === 'UNLIMITED' ? null : dto.duration;
    const amount = unit ? dto.amount! : null;
    const expiresAt = unit ? this.endAfter(new Date(), amount!, unit) : null;
    const subscription = await this.subscriptions.createAdminGrant(adminId, {
      userId: listing.userId,
      listingId,
      packageId: pkg.id,
      expiresAt,
      billingCycle: grantBillingCycle(amount, unit),
      note: dto.note,
    });
    let published: { slug: string; status: string };
    try {
      published = await this.listings.publishByAdmin(adminId, listingId, subscription.id);
    } catch (error) {
      // Nothing is left behind half done: the package goes with the failed publish.
      await this.prisma.subscription.delete({ where: { id: subscription.id } }).catch(() => undefined);
      throw error;
    }
    // The listing is live either way. Featuring follows the rules of Istaknuti
    // oglasi: a full category puts it in the queue, and a refusal (the owner
    // already has a featured listing there, say) goes back to the admin.
    let featuredNote: string | null = null;
    if (dto.featuredDays) {
      try {
        const outcome = await this.subscriptions.adminAssignFreeFeatured(adminId, listingId, dto.featuredDays);
        if (outcome.status === 'WAITING') featuredNote = this.i18n.t('errors.FEATURED_PUBLISHED_WAITING');
      } catch (error) {
        featuredNote = (error as Error).message;
      }
    }

    await this.log(adminId, 'listing.published_free', listingId, null, {
      ownerId: listing.userId,
      subscriptionId: subscription.id,
      package: pkg.key,
      duration: unit ? { amount, unit } : 'UNLIMITED',
      expiresAt,
      featuredDays: dto.featuredDays ?? null,
      note: dto.note?.trim() || null,
    });
    this.events.emit('listing.published_by_admin', { listingId, subscriptionId: subscription.id });
    return { id: listingId, slug: published.slug, status: published.status, expiresAt, package: pkg.key, featuredNote };
  }

  // -- "Trajanje" -----------------------------------------------------------

  /** What the dialog shows: the package the listing is on, how long it runs, who else it carries. */
  async getPeriod(listingId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        subscription: {
          include: {
            package: { select: { key: true } },
            grantedByAdmin: { select: { firstName: true, lastName: true } },
            listings: { where: { status: { not: 'DELETED' } }, select: { id: true, title: true, status: true } },
          },
        },
      },
    });
    if (!listing || listing.status === 'DELETED') throw new NotFoundException(this.i18n.t('errors.LISTING_NOT_FOUND'));
    const subscription = listing.subscription;
    const continuedUntil = subscription ? (await this.renewalEnds([subscription.id])).get(subscription.id) ?? null : null;
    return {
      listing: {
        id: listing.id,
        title: listing.title,
        slug: listing.slug,
        status: listing.status,
        owner: { name: fullName(listing.user), email: listing.user.email },
      },
      package: subscription
        ? {
            key: subscription.package.key,
            status: subscription.status,
            startsAt: subscription.startsAt,
            expiresAt: subscription.expiresAt,
            free: !!subscription.grantedByAdminId,
            grantedBy: subscription.grantedByAdmin ? fullName(subscription.grantedByAdmin) : null,
            note: subscription.grantNote,
            continuedUntil,
            changeable: subscription.status === 'ACTIVE' || subscription.status === 'EXPIRED',
            // A gift on a paid package reaches every listing on it.
            otherListings: subscription.listings
              .filter((other) => other.id !== listing.id)
              .map((other) => ({ id: other.id, title: other.title, status: other.status })),
          }
        : null,
    };
  }

  async changePeriod(adminId: string, listingId: string, dto: ChangePeriodDto) {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId }, select: { id: true, status: true, subscriptionId: true } });
    if (!listing || listing.status === 'DELETED') throw new NotFoundException(this.i18n.t('errors.LISTING_NOT_FOUND'));
    if (!listing.subscriptionId) throw new BadRequestException(this.i18n.t('errors.LISTING_NO_PACKAGE'));

    let change: PeriodChange;
    if (dto.mode === 'EXTEND' || dto.mode === 'SET') {
      this.assertPeriodLength(dto.amount!, dto.unit!);
      change = { mode: dto.mode, amount: dto.amount!, unit: dto.unit! };
    } else {
      change = { mode: dto.mode };
    }
    const { before, after } = await this.subscriptions.adminChangePeriod(listing.subscriptionId, change);
    await this.log(adminId, 'listing.period_changed', listingId, before, {
      ...after,
      subscriptionId: listing.subscriptionId,
      change,
    });
    // "Završi odmah" is told by the email every ended package sends.
    if (dto.mode !== 'END_NOW') {
      this.events.emit('listing.period_changed_by_admin', { listingId, subscriptionId: listing.subscriptionId });
    }
    return this.getPeriod(listingId);
  }

  // -- Helpers ---------------------------------------------------------------

  private endAfter(from: Date, amount: number, unit: PeriodUnit): Date {
    this.assertPeriodLength(amount, unit);
    return periodEnd(from, amount, unit);
  }

  private assertPeriodLength(amount: number, unit: PeriodUnit) {
    if (amount > MAX_PERIOD[unit]) {
      throw new BadRequestException(
        this.i18n.t(unit === 'MONTHS' ? 'errors.PERIOD_TOO_LONG_MONTHS' : 'errors.PERIOD_TOO_LONG_DAYS', {
          args: { max: MAX_PERIOD[unit] },
        }),
      );
    }
  }

  private async log(adminId: string, action: string, listingId: string, oldValue: unknown, newValue: unknown) {
    await this.prisma.adminLog.create({
      data: {
        userId: adminId,
        action,
        entityType: 'Listing',
        entityId: listingId,
        ...(oldValue === null ? {} : { oldValue: toJson(oldValue) as Prisma.InputJsonValue }),
        newValue: toJson(newValue) as Prisma.InputJsonValue,
      },
    });
  }
}

function fullName(user: { firstName: string; lastName: string }): string {
  return `${user.firstName} ${user.lastName}`.trim();
}

const OWNER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  emailVerified: true,
  phone: true,
  bankAccount: true,
  blocked: true,
  restrictedUntil: true,
  _count: { select: { listings: { where: { status: { not: 'DELETED' as const } } } } },
} satisfies Prisma.UserSelect;

/** An account as the owner picker shows it: what its listing will need from the profile. */
function describeOwner(user: Prisma.UserGetPayload<{ select: typeof OWNER_SELECT }>) {
  return {
    id: user.id,
    name: fullName(user),
    email: user.email,
    emailVerified: user.emailVerified,
    hasPhone: !!user.phone,
    hasBankAccount: !!normalizeBankAccount(user.bankAccount),
    blocked: user.blocked,
    restricted: !!user.restrictedUntil && user.restrictedUntil.getTime() > Date.now(),
    listingCount: user._count.listings,
  };
}

/** "marko petrović" finds Marko Petrović: every word has to match somewhere. */
function searchTerms(search: string): string[] {
  return search.split(/\s+/).filter(Boolean).slice(0, 5);
}

function listingMatches(term: string): Prisma.ListingWhereInput[] {
  return [
    { title: { contains: term, mode: 'insensitive' } },
    { user: { email: { contains: term, mode: 'insensitive' } } },
    { user: { firstName: { contains: term, mode: 'insensitive' } } },
    { user: { lastName: { contains: term, mode: 'insensitive' } } },
  ];
}

/** Dates as ISO strings, the way JSON keeps them in AdminLog. */
function toJson(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value ?? null));
}
