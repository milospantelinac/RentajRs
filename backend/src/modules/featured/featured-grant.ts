import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FeaturedSource, Prisma, PrismaClient } from '@prisma/client';
import { I18nService } from 'nestjs-i18n';
import { FEATURED_RULES_KEY, categoryLimit, readFeaturedRules } from '../../common/utils/featured-rules';
import { DAY_MS } from '../../common/utils/subscription-renewal';

type Db = PrismaClient | Prisma.TransactionClient;

/** A featured period that is on right now. */
export function liveFeaturedWhere(now: Date): Prisma.FeaturedListingWhereInput {
  return { startsAt: { lte: now }, expiresAt: { gt: now } };
}

/** A listing keeps its place in the category while it exists, offline or not. */
const HOLDS_A_PLACE: Prisma.ListingWhereInput = { status: { not: 'DELETED' } };

/** A listing whose owner may be featured: not blocked, not under a restriction (Ch.6.7). */
export function ownerMayBeFeatured(owner: { blocked: boolean; restrictedUntil: Date | null }, now: Date): boolean {
  return !owner.blocked && (!owner.restrictedUntil || owner.restrictedUntil <= now);
}

/** The live periods in a category, and those waiting for one of its places. */
export async function categoryOccupancy(db: Db, categoryId: string, now: Date) {
  const [taken, waiting] = await Promise.all([
    db.featuredListing.count({ where: { ...liveFeaturedWhere(now), listing: { categoryId, ...HOLDS_A_PLACE } } }),
    db.featuredRequest.count({ where: { status: 'WAITING', listing: { categoryId, ...HOLDS_A_PLACE } } }),
  ]);
  return { taken, waiting };
}

/**
 * The owner's other listings in the category that are featured or waiting
 * for a place; with `pending`, their open requests too (asked, undecided).
 */
export async function ownerHoldsInCategory(
  db: Db,
  ownerId: string,
  categoryId: string,
  exceptListingId: string,
  now: Date,
  pending = false,
): Promise<number> {
  const listing: Prisma.ListingWhereInput = { userId: ownerId, categoryId, id: { not: exceptListingId }, ...HOLDS_A_PLACE };
  const [live, queued] = await Promise.all([
    db.featuredListing.count({ where: { ...liveFeaturedWhere(now), listing } }),
    db.featuredRequest.count({ where: { status: { in: pending ? ['WAITING', 'PENDING'] : ['WAITING'] }, listing } }),
  ]);
  return live + queued;
}

export interface GrantFeaturedInput {
  listingId: string;
  source: FeaturedSource;
  days: number;
  /** The admin who decided; null when the system does (a leader's listing going live, the queue moving). */
  adminId?: string | null;
  note?: string | null;
  /** The request this answers: an owner's, or one that waited for a place. */
  requestId?: string | null;
}

export type GrantFeaturedOutcome =
  | { status: 'STARTED'; featuredId: string; expiresAt: Date }
  | { status: 'WAITING'; requestId: string; alreadyWaiting: boolean };

/**
 * Features a listing from now on, or, when its category is full, puts it in
 * the category's queue (it starts on the first free place, oldest first).
 * One grant at a time per category, so two admins can never both take its
 * last place. Shared by FeaturedService and SubscriptionsService (an admin
 * publishing a listing with a featured period).
 */
export async function grantFeatured(
  prisma: PrismaClient,
  events: EventEmitter2,
  i18n: I18nService,
  input: GrantFeaturedInput,
  now = new Date(),
): Promise<GrantFeaturedOutcome> {
  const outcome = await prisma.$transaction(async (tx): Promise<GrantFeaturedOutcome> => {
    const listing = await tx.listing.findUnique({
      where: { id: input.listingId },
      include: { user: { select: { blocked: true, restrictedUntil: true } } },
    });
    if (!listing) throw new NotFoundException();
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`featured:${listing.categoryId}`}))`;

    if (listing.status !== 'ACTIVE') throw new BadRequestException(i18n.t('errors.FEATURED_LISTING_NOT_ACTIVE'));
    if (!ownerMayBeFeatured(listing.user, now)) throw new BadRequestException(i18n.t('errors.FEATURED_OWNER_NOT_ELIGIBLE'));
    const live = await tx.featuredListing.findFirst({ where: { listingId: listing.id, ...liveFeaturedWhere(now) } });
    if (live) throw new BadRequestException(i18n.t('errors.FEATURED_ALREADY'));

    const request = input.requestId ? await tx.featuredRequest.findUnique({ where: { id: input.requestId } }) : null;
    if (input.requestId && (!request || request.listingId !== listing.id)) throw new NotFoundException();
    const otherWaiting = await tx.featuredRequest.findFirst({
      where: { listingId: listing.id, status: 'WAITING', ...(request ? { id: { not: request.id } } : {}) },
    });
    if (otherWaiting) throw new BadRequestException(i18n.t('errors.FEATURED_ALREADY_WAITING'));

    const rules = readFeaturedRules((await tx.setting.findUnique({ where: { key: FEATURED_RULES_KEY } }))?.value);
    const ownerHolds = await ownerHoldsInCategory(tx, listing.userId, listing.categoryId, listing.id, now);
    if (ownerHolds >= rules.maxPerOwnerPerCategory) {
      throw new BadRequestException(
        i18n.t('errors.FEATURED_OWNER_LIMIT', { args: { limit: rules.maxPerOwnerPerCategory } }),
      );
    }

    const { taken } = await categoryOccupancy(tx, listing.categoryId, now);
    if (taken >= categoryLimit(rules, listing.categoryId)) {
      if (request?.status === 'WAITING') return { status: 'WAITING', requestId: request.id, alreadyWaiting: true };
      const decided = { status: 'WAITING' as const, source: input.source, durationDays: input.days, decidedAt: now, decidedByUserId: input.adminId ?? null };
      const queued = request
        ? await tx.featuredRequest.update({ where: { id: request.id }, data: { ...decided, note: input.note ?? request.note } })
        : await tx.featuredRequest.create({ data: { ...decided, listingId: listing.id, requestedAt: now, note: input.note ?? null } });
      return { status: 'WAITING', requestId: queued.id, alreadyWaiting: false };
    }

    const featured = await tx.featuredListing.create({
      data: {
        listingId: listing.id,
        durationDays: input.days,
        price: 0n,
        startsAt: now,
        expiresAt: new Date(now.getTime() + input.days * DAY_MS),
        free: input.source !== 'PAID',
        assignedByUserId: input.adminId ?? request?.decidedByUserId ?? null,
        source: input.source,
        note: input.note ?? request?.note ?? null,
      },
    });
    if (request) {
      await tx.featuredRequest.update({
        where: { id: request.id },
        data: {
          status: 'APPROVED',
          source: input.source,
          durationDays: input.days,
          featuredId: featured.id,
          // A request that waited keeps the moment it was approved.
          decidedAt: request.decidedAt ?? now,
          decidedByUserId: request.decidedByUserId ?? input.adminId ?? null,
        },
      });
    }
    return { status: 'STARTED', featuredId: featured.id, expiresAt: featured.expiresAt };
  });

  if (outcome.status === 'STARTED') events.emit('featured.started', { featuredId: outcome.featuredId });
  else if (!outcome.alreadyWaiting) events.emit('featured.waiting', { requestId: outcome.requestId });
  return outcome;
}
