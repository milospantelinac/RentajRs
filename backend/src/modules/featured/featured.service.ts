import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { FeaturedRequestStatus, FeaturedSource, Prisma } from '@prisma/client';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../common/cache/cache.service';
import { TaxonomyService } from '../taxonomy/taxonomy.service';
import { LISTING_CARD_INCLUDE, loadListingCardNames, serializeListingCard } from '../../common/utils/listing-card';
import { DAY_MS } from '../../common/utils/subscription-renewal';
import { toBelgradeDateOnly } from '../../common/utils/timezone';
import {
  FEATURED_LEADERS_KEY,
  FEATURED_RULES_KEY,
  FeaturedRules,
  LeaderRule,
  belgradeDayKey,
  categoryLimit,
  isLeader,
  orderForHome,
  pickLeastShown,
  readFeaturedRules,
  readLeaderRule,
  reminderLeadDays,
} from '../../common/utils/featured-rules';
import {
  GrantFeaturedOutcome,
  categoryOccupancy,
  grantFeatured,
  liveFeaturedWhere,
  ownerHoldsInCategory,
  ownerMayBeFeatured,
} from './featured-grant';
import { RankingWeights, readRankingWeights, RANKING_WEIGHTS_CACHE_KEY, RANKING_WEIGHTS_KEY } from '../../common/utils/ranking-weights';

const RULES_CACHE_KEY = 'settings:featured_rules';
const RULES_TTL = 60;
// Each day's counts sit in one hash, kept a little longer than the day so the
// copy into FeaturedStat can still read yesterday's final numbers.
const COUNTS_PREFIX = 'featured:stats:';
const COUNTS_TTL = 3 * 24 * 60 * 60;
// An ended period is told to its owner only if it ended this recently, so a
// deploy never mails about periods that ended long before.
const ENDED_NOTICE_WINDOW_MS = 2 * DAY_MS;

type CountKind = 's' | 'h' | 'c';
export type FeaturedPlace = 'search' | 'home';
type HiddenReason = 'NOT_ACTIVE' | 'UNAVAILABLE' | 'OWNER_RESTRICTED' | 'OTHER_CITY';

const PERIOD_ADMIN_INCLUDE = {
  listing: {
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      available: true,
      categoryId: true,
      cityId: true,
      user: { select: { id: true, firstName: true, lastName: true, email: true, blocked: true, restrictedUntil: true } },
    },
  },
  assignedByUser: { select: { firstName: true, lastName: true, email: true } },
} satisfies Prisma.FeaturedListingInclude;

function personName(user: { firstName?: string | null; lastName?: string | null; email?: string | null } | null | undefined) {
  if (!user) return null;
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || null;
}

/**
 * Istaknuti oglasi (T129 point 6): which featured listings show where, the
 * counts behind "least shown first", the owners' requests, the queue of a
 * full category, the leaders' program and the admin page. The rules are in
 * common/utils/featured-rules.ts; a grant goes through featured-grant.ts.
 */
@Injectable()
export class FeaturedService {
  private readonly logger = new Logger(FeaturedService.name);

  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
    private taxonomy: TaxonomyService,
    private events: EventEmitter2,
    private i18n: I18nService,
  ) {}

  // -- Rules ---------------------------------------------------------------

  async getRules(): Promise<FeaturedRules> {
    return this.cache.getOrSet(RULES_CACHE_KEY, RULES_TTL, async () =>
      readFeaturedRules((await this.prisma.setting.findUnique({ where: { key: FEATURED_RULES_KEY } }))?.value),
    );
  }

  async getLeaderRule(): Promise<LeaderRule> {
    return readLeaderRule((await this.prisma.setting.findUnique({ where: { key: FEATURED_LEADERS_KEY } }))?.value);
  }

  /** Ch.11.3: the price per length, kept for the paid checkout (P7/R116, edited in Podešavanja). */
  async getPrices(): Promise<Record<7 | 15 | 30, number>> {
    const setting = await this.prisma.setting.findUnique({ where: { key: 'featured_listing_prices' } });
    const value = setting?.value as Record<string, number> | undefined;
    return { 7: value?.['7'] ?? 890, 15: value?.['15'] ?? 1590, 30: value?.['30'] ?? 2490 };
  }

  // -- Who shows -----------------------------------------------------------

  /** A listing a guest may see as featured: live, bookable now, its owner in good standing. */
  private shownListingWhere(now: Date): Prisma.ListingWhereInput {
    return {
      status: 'ACTIVE',
      available: true,
      user: { blocked: false, OR: [{ restrictedUntil: null }, { restrictedUntil: { lte: now } }] },
    };
  }

  /** Of these listings, the ones featured right now: their cards say "Istaknuto" (not while featuring is off). */
  async featuredAmong(listingIds: string[], now = new Date()): Promise<Set<string>> {
    if (!listingIds.length || !(await this.getRules()).enabled) return new Set();
    const rows = await this.prisma.featuredListing.findMany({
      where: { listingId: { in: listingIds }, ...liveFeaturedWhere(now), listing: this.shownListingWhere(now) },
      select: { listingId: true },
    });
    return new Set(rows.map((row) => row.listingId));
  }

  /**
   * R114, the top of a search: up to searchTopCount featured listings among
   * the search's own results (every filter applies), least shown today first,
   * one per owner. Counts the turn each one got.
   */
  async pickForSearch(where: Prisma.ListingWhereInput, limit?: number, now = new Date()): Promise<string[]> {
    const rules = await this.getRules();
    const count = Math.min(rules.searchTopCount, limit ?? rules.searchTopCount);
    if (!rules.enabled || count <= 0) return [];
    const candidates = await this.prisma.listing.findMany({
      where: { AND: [where, this.shownListingWhere(now), { featuredPeriods: { some: liveFeaturedWhere(now) } }] },
      select: { id: true, userId: true },
    });
    if (!candidates.length) return [];
    const shown = await this.readCounts(now, 's');
    const picked = pickLeastShown(
      candidates.map((row) => ({ listingId: row.id, ownerId: row.userId })),
      shown,
      count,
    ).map((candidate) => candidate.listingId);
    void this.countShown(now, picked, 's');
    return picked;
  }

  /** The home page: every featured listing in turn, least shown today first; the first screenful is counted. */
  async getHome(now = new Date()) {
    const rules = await this.getRules();
    const layout = {
      desktopCount: rules.homeDesktopCount,
      phoneCount: rules.homePhoneCount,
      intervalSeconds: rules.homeIntervalSeconds,
    };
    if (!rules.enabled) return { listings: [], ...layout };
    const rows = await this.prisma.listing.findMany({
      where: { AND: [this.shownListingWhere(now), { featuredPeriods: { some: liveFeaturedWhere(now) } }] },
      include: LISTING_CARD_INCLUDE,
    });
    if (!rows.length) return { listings: [], ...layout };
    const shown = await this.readCounts(now, 'h');
    const ordered = orderForHome(
      rows.map((row) => ({ listingId: row.id, ownerId: row.userId, row })),
      shown,
      rules.homeDesktopCount,
    );
    void this.countShown(now, ordered.slice(0, rules.homeDesktopCount).map((item) => item.listingId), 'h');
    const { categoryNames, optionNames } = await loadListingCardNames(this.taxonomy, rows);
    return {
      listings: ordered.map((item) => ({ ...serializeListingCard(item.row, categoryNames, optionNames), featured: true })),
      ...layout,
    };
  }

  /** A featured card was opened from the top of a search or from the home page. */
  async recordClick(listingId: string, now = new Date()) {
    const live = await this.prisma.featuredListing.findFirst({
      where: { listingId, ...liveFeaturedWhere(now) },
      select: { id: true },
    });
    if (live) await this.countShown(now, [listingId], 'c');
  }

  // -- Counters --------------------------------------------------------------

  private countsKey(now: Date) {
    return `${COUNTS_PREFIX}${belgradeDayKey(now)}`;
  }

  private async readCounts(now: Date, kind: CountKind): Promise<Map<string, number>> {
    const fields = await this.cache.hashGetAll(this.countsKey(now));
    const counts = new Map<string, number>();
    for (const [field, value] of Object.entries(fields)) {
      const [listingId, fieldKind] = field.split(':');
      if (fieldKind === kind) counts.set(listingId, value);
    }
    return counts;
  }

  private async countShown(now: Date, listingIds: string[], kind: CountKind) {
    try {
      await this.cache.hashIncrement(this.countsKey(now), listingIds.map((id) => `${id}:${kind}`), COUNTS_TTL);
    } catch (err) {
      this.logger.warn(`Featured counts not kept: ${(err as Error).message}`);
    }
  }

  /**
   * Today's and yesterday's counts into FeaturedStat. Redis holds each day's
   * running totals, so the copy sets them (never adds); GREATEST keeps a
   * number a Redis restart would otherwise take back down.
   */
  async copyCountsToDatabase(now = new Date()) {
    for (const day of [new Date(now.getTime() - DAY_MS), now]) {
      const fields = await this.cache.hashGetAll(this.countsKey(day));
      const byListing = new Map<string, { s: number; h: number; c: number }>();
      for (const [field, value] of Object.entries(fields)) {
        const [listingId, kind] = field.split(':') as [string, CountKind];
        if (!/^[0-9a-f-]{36}$/i.test(listingId) || !['s', 'h', 'c'].includes(kind)) continue;
        const entry = byListing.get(listingId) ?? { s: 0, h: 0, c: 0 };
        entry[kind] = value;
        byListing.set(listingId, entry);
      }
      if (!byListing.size) continue;
      const date = belgradeDayKey(day);
      const values = [...byListing].map(
        ([listingId, c]) => Prisma.sql`(${listingId}::uuid, ${date}::date, ${c.s}::int, ${c.h}::int, ${c.c}::int)`,
      );
      await this.prisma.$executeRaw`
        INSERT INTO "FeaturedStat" ("listingId", "date", "searchImpressions", "homeImpressions", "clicks")
        SELECT v.id, v.day, v.s, v.h, v.c
        FROM (VALUES ${Prisma.join(values)}) AS v(id, day, s, h, c)
        JOIN "Listing" l ON l."id" = v.id
        ON CONFLICT ("listingId", "date") DO UPDATE SET
          "searchImpressions" = GREATEST("FeaturedStat"."searchImpressions", EXCLUDED."searchImpressions"),
          "homeImpressions" = GREATEST("FeaturedStat"."homeImpressions", EXCLUDED."homeImpressions"),
          "clicks" = GREATEST("FeaturedStat"."clicks", EXCLUDED."clicks")`;
    }
  }

  /** Shown at the top of a search, on the home page, and opened, per listing, between two Belgrade days. */
  private async statsFor(listingIds: string[], from: Date, to: Date) {
    const totals = new Map<string, { searchImpressions: number; homeImpressions: number; clicks: number }>();
    if (!listingIds.length) return totals;
    const rows = await this.prisma.featuredStat.groupBy({
      by: ['listingId'],
      where: { listingId: { in: listingIds }, date: { gte: toBelgradeDateOnly(from), lte: toBelgradeDateOnly(to) } },
      _sum: { searchImpressions: true, homeImpressions: true, clicks: true },
    });
    for (const row of rows) {
      totals.set(row.listingId, {
        searchImpressions: row._sum.searchImpressions ?? 0,
        homeImpressions: row._sum.homeImpressions ?? 0,
        clicks: row._sum.clicks ?? 0,
      });
    }
    return totals;
  }

  /** The counts of one period, read per listing over the period's own days. */
  private async statsForPeriods(periods: Array<{ id: string; listingId: string; startsAt: Date; expiresAt: Date }>, now: Date) {
    const result = new Map<string, { searchImpressions: number; homeImpressions: number; clicks: number }>();
    if (!periods.length) return result;
    const from = new Date(Math.min(...periods.map((p) => p.startsAt.getTime())));
    const rows = await this.prisma.featuredStat.findMany({
      where: { listingId: { in: [...new Set(periods.map((p) => p.listingId))] }, date: { gte: toBelgradeDateOnly(from) } },
    });
    for (const period of periods) {
      const first = toBelgradeDateOnly(period.startsAt).getTime();
      const last = toBelgradeDateOnly(period.expiresAt < now ? period.expiresAt : now).getTime();
      const sum = { searchImpressions: 0, homeImpressions: 0, clicks: 0 };
      for (const row of rows) {
        const day = row.date.getTime();
        if (row.listingId !== period.listingId || day < first || day > last) continue;
        sum.searchImpressions += row.searchImpressions;
        sum.homeImpressions += row.homeImpressions;
        sum.clicks += row.clicks;
      }
      result.set(period.id, sum);
    }
    return result;
  }

  // -- The clock: copies, queue, reminders, ends -----------------------------

  @Cron('*/10 * * * *')
  async tick() {
    const now = new Date();
    const steps: Array<[string, () => Promise<unknown>]> = [
      ['copy counts', () => this.copyCountsToDatabase(now)],
      ['end periods', () => this.noticeEndedPeriods(now)],
      ['move the queue', () => this.promoteWaiting(undefined, now)],
      ['send reminders', () => this.sendReminders(now)],
    ];
    for (const [name, step] of steps) {
      try {
        await step();
      } catch (err) {
        this.logger.error(`Featured listings, ${name}: ${(err as Error).message}`);
      }
    }
  }

  /** The owner hears once that a period is ending, a week (or two days) before. */
  async sendReminders(now = new Date()) {
    const live = await this.prisma.featuredListing.findMany({
      where: { ...liveFeaturedWhere(now), reminderSentAt: null, listing: { status: 'ACTIVE' } },
      select: { id: true, durationDays: true, expiresAt: true },
    });
    for (const period of live) {
      const lead = reminderLeadDays(period.durationDays);
      if (period.durationDays <= lead || period.expiresAt.getTime() - now.getTime() > lead * DAY_MS) continue;
      const { count } = await this.prisma.featuredListing.updateMany({
        where: { id: period.id, reminderSentAt: null },
        data: { reminderSentAt: now },
      });
      if (count) this.events.emit('featured.ending_soon', { featuredId: period.id });
    }
  }

  /** Periods that ended since the last run: the owner is told, and their places go to the queue. */
  async noticeEndedPeriods(now = new Date()) {
    const ended = await this.prisma.featuredListing.findMany({
      where: { endedNotifiedAt: null, expiresAt: { lte: now, gt: new Date(now.getTime() - ENDED_NOTICE_WINDOW_MS) } },
      select: { id: true, listing: { select: { status: true } } },
    });
    for (const period of ended) {
      const { count } = await this.prisma.featuredListing.updateMany({
        where: { id: period.id, endedNotifiedAt: null },
        data: { endedNotifiedAt: now },
      });
      if (count && period.listing.status !== 'DELETED') this.events.emit('featured.ended', { featuredId: period.id });
    }
  }

  /**
   * Every category with free places takes from its queue, oldest first. A
   * request whose listing went offline or whose owner can no longer be
   * featured is cancelled (the owner can ask again).
   */
  async promoteWaiting(categoryId?: string, now = new Date()) {
    const waiting = await this.prisma.featuredRequest.findMany({
      where: { status: 'WAITING', ...(categoryId ? { listing: { categoryId } } : {}) },
      orderBy: { requestedAt: 'asc' },
      include: { listing: { select: { categoryId: true } } },
    });
    const full = new Set<string>();
    for (const request of waiting) {
      if (full.has(request.listing.categoryId)) continue;
      let outcome: GrantFeaturedOutcome;
      try {
        outcome = await grantFeatured(this.prisma, this.events, this.i18n, {
          listingId: request.listingId,
          source: request.source,
          days: request.durationDays,
          requestId: request.id,
        }, now);
      } catch (err) {
        await this.prisma.featuredRequest.update({
          where: { id: request.id },
          data: { status: 'CANCELLED', decisionNote: (err as Error).message },
        });
        continue;
      }
      if (outcome.status === 'WAITING') full.add(request.listing.categoryId);
    }
  }

  // -- Owners ----------------------------------------------------------------

  /** "Moji oglasi": per listing whether it is featured, asked for or waiting, with its counts, and whether it can be asked for. */
  async getMine(userId: string, now = new Date()) {
    const [rules, leaderRule, owner, listings] = await Promise.all([
      this.getRules(),
      this.getLeaderRule(),
      this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { blocked: true, restrictedUntil: true, leaderOverride: true } }),
      this.prisma.listing.findMany({
        where: { userId, status: { not: 'DELETED' } },
        select: {
          id: true,
          status: true,
          categoryId: true,
          publishedAt: true,
          featuredPeriods: { where: liveFeaturedWhere(now), take: 1 },
          featuredRequests: { orderBy: { requestedAt: 'desc' }, take: 1 },
        },
      }),
    ]);
    const firstPublishedAt = this.earliest(listings.map((listing) => listing.publishedAt));
    const leader = isLeader(owner.leaderOverride, firstPublishedAt, leaderRule);
    const benefitUsed = leader ? await this.leaderBenefitUsed(userId) : false;
    const periods = listings.flatMap((listing) => listing.featuredPeriods);
    const stats = await this.statsForPeriods(periods, now);
    const ownerOk = ownerMayBeFeatured(owner, now);

    const result: Array<Record<string, unknown>> = [];
    for (const listing of listings) {
      const period = listing.featuredPeriods[0];
      const request = listing.featuredRequests[0];
      const open = request && (request.status === 'PENDING' || request.status === 'WAITING') ? request : null;
      let cannot: string | null = null;
      if (!period && !open) {
        if (!rules.enabled) cannot = 'DISABLED';
        else if (listing.status !== 'ACTIVE') cannot = 'NOT_ACTIVE';
        else if (!ownerOk) cannot = 'OWNER_RESTRICTED';
        else if (
          (await ownerHoldsInCategory(this.prisma, userId, listing.categoryId, listing.id, now, true)) >= rules.maxPerOwnerPerCategory
        ) {
          cannot = 'OWNER_LIMIT';
        }
      }
      result.push({
        listingId: listing.id,
        state: period ? 'LIVE' : open ? open.status : null,
        source: period?.source ?? open?.source ?? null,
        startsAt: period?.startsAt ?? null,
        until: period?.expiresAt ?? null,
        requestedAt: open?.requestedAt ?? null,
        stats: period ? (stats.get(period.id) ?? { searchImpressions: 0, homeImpressions: 0, clicks: 0 }) : null,
        canRequest: !period && !open && !cannot,
        cannotReason: period || open ? null : cannot,
        lastRejection:
          !period && !open && request?.status === 'REJECTED' ? { note: request.decisionNote, decidedAt: request.decidedAt } : null,
      });
    }
    return {
      enabled: rules.enabled,
      defaultDays: rules.defaultDays,
      leader: { isLeader: leader, benefitUsed, days: leaderRule.days },
      listings: result,
    };
  }

  /** "Istakni oglas": the owner asks, an admin decides. */
  async requestByOwner(userId: string, listingId: string, now = new Date()) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: { user: { select: { blocked: true, restrictedUntil: true } } },
    });
    if (!listing || listing.status === 'DELETED') throw new NotFoundException();
    if (listing.userId !== userId) throw new ForbiddenException();
    const rules = await this.getRules();
    if (!rules.enabled) throw new BadRequestException(this.i18n.t('errors.FEATURED_DISABLED'));
    if (listing.status !== 'ACTIVE') throw new BadRequestException(this.i18n.t('errors.FEATURED_LISTING_NOT_ACTIVE'));
    if (!ownerMayBeFeatured(listing.user, now)) throw new BadRequestException(this.i18n.t('errors.FEATURED_OWNER_NOT_ELIGIBLE'));
    const [live, open] = await Promise.all([
      this.prisma.featuredListing.findFirst({ where: { listingId, ...liveFeaturedWhere(now) } }),
      this.prisma.featuredRequest.findFirst({ where: { listingId, status: { in: ['PENDING', 'WAITING'] } } }),
    ]);
    if (live) throw new BadRequestException(this.i18n.t('errors.FEATURED_ALREADY'));
    if (open) throw new BadRequestException(this.i18n.t('errors.FEATURED_REQUEST_EXISTS'));
    if ((await ownerHoldsInCategory(this.prisma, userId, listing.categoryId, listing.id, now, true)) >= rules.maxPerOwnerPerCategory) {
      throw new BadRequestException(this.i18n.t('errors.FEATURED_OWNER_LIMIT', { args: { limit: rules.maxPerOwnerPerCategory } }));
    }
    const request = await this.prisma.featuredRequest.create({
      data: { listingId, source: 'REQUEST', status: 'PENDING', durationDays: rules.defaultDays, requestedAt: now },
    });
    this.events.emit('featured.requested', { requestId: request.id });
    return { id: request.id, status: request.status };
  }

  /** The owner takes back a request that is still undecided or waiting for a place. */
  async cancelByOwner(userId: string, listingId: string) {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId }, select: { userId: true } });
    if (!listing) throw new NotFoundException();
    if (listing.userId !== userId) throw new ForbiddenException();
    const { count } = await this.prisma.featuredRequest.updateMany({
      where: { listingId, status: { in: ['PENDING', 'WAITING'] } },
      data: { status: 'CANCELLED' },
    });
    if (!count) throw new NotFoundException();
    return { message: this.i18n.t('common.SUCCESS') };
  }

  // -- Leaders ---------------------------------------------------------------

  private earliest(dates: Array<Date | null>): Date | null {
    const times = dates.filter((date): date is Date => !!date).map((date) => date.getTime());
    return times.length ? new Date(Math.min(...times)) : null;
  }

  /** A leader gets one free period: one that ran or runs, or one waiting for a place, uses it. */
  async leaderBenefitUsed(userId: string): Promise<boolean> {
    const [periods, waiting] = await Promise.all([
      this.prisma.featuredListing.count({ where: { source: 'LEADER', listing: { userId } } }),
      this.prisma.featuredRequest.count({ where: { source: 'LEADER', status: 'WAITING', listing: { userId } } }),
    ]);
    return periods + waiting > 0;
  }

  private async ownerIsLeader(userId: string, rule: LeaderRule) {
    const [user, first] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { leaderOverride: true } }),
      this.prisma.listing.aggregate({ where: { userId, publishedAt: { not: null } }, _min: { publishedAt: true } }),
    ]);
    return !!user && isLeader(user.leaderOverride, first._min.publishedAt, rule);
  }

  /** A leader's listing went live: their one free period starts with it, unless it was used already. */
  @OnEvent('listing.approved')
  async onListingApproved({ listingId, userId }: { listingId: string; userId: string }) {
    try {
      const rule = await this.getLeaderRule();
      if (!(await this.ownerIsLeader(userId, rule)) || (await this.leaderBenefitUsed(userId))) return;
      await grantFeatured(this.prisma, this.events, this.i18n, { listingId, source: 'LEADER', days: rule.days });
    } catch (err) {
      // The listing is live either way; the admin can still grant it from Lideri.
      this.logger.warn(`Leader's featured period not started for listing ${listingId}: ${(err as Error).message}`);
    }
  }

  async adminListLeaders(now = new Date()) {
    const rule = await this.getLeaderRule();
    const firsts = await this.prisma.listing.groupBy({
      by: ['userId'],
      where: { publishedAt: { not: null } },
      _min: { publishedAt: true },
    });
    const firstByUser = new Map(firsts.map((row) => [row.userId, row._min.publishedAt]));
    const overridden = await this.prisma.user.findMany({ where: { leaderOverride: { not: null } }, select: { id: true } });
    const candidateIds = new Set<string>(overridden.map((user) => user.id));
    if (rule.cutoffDate) {
      for (const [id, first] of firstByUser) if (isLeader(null, first, rule)) candidateIds.add(id);
    }
    if (!candidateIds.size) return { rule, leaders: [] };

    const users = await this.prisma.user.findMany({
      where: { id: { in: [...candidateIds] }, anonymizedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        leaderOverride: true,
        listings: {
          where: { status: 'ACTIVE' },
          orderBy: { publishedAt: 'asc' },
          select: { id: true, title: true, categoryId: true },
        },
      },
    });
    const [periods, waiting] = await Promise.all([
      this.prisma.featuredListing.findMany({
        where: { source: 'LEADER', listing: { userId: { in: users.map((u) => u.id) } } },
        orderBy: { startsAt: 'desc' },
        select: { startsAt: true, expiresAt: true, listing: { select: { userId: true, title: true } } },
      }),
      this.prisma.featuredRequest.findMany({
        where: { source: 'LEADER', status: 'WAITING', listing: { userId: { in: users.map((u) => u.id) } } },
        select: { requestedAt: true, listing: { select: { userId: true, title: true } } },
      }),
    ]);
    const categoryNames = await this.taxonomy.getCategoryNames([...new Set(users.flatMap((u) => u.listings.map((l) => l.categoryId)))]);

    const leaders = users.map((user) => {
      const first = firstByUser.get(user.id) ?? null;
      const byRule = isLeader(null, first, rule);
      const period = periods.find((p) => p.listing.userId === user.id);
      const queued = waiting.find((w) => w.listing.userId === user.id);
      let benefit: { state: 'UNUSED' | 'LIVE' | 'WAITING' | 'USED'; until?: Date; listingTitle?: string };
      if (period) {
        benefit = { state: period.expiresAt > now ? 'LIVE' : 'USED', until: period.expiresAt, listingTitle: period.listing.title };
      } else if (queued) {
        benefit = { state: 'WAITING', listingTitle: queued.listing.title };
      } else {
        benefit = { state: 'UNUSED' };
      }
      return {
        userId: user.id,
        name: personName(user),
        email: user.email,
        firstPublishedAt: first,
        override: user.leaderOverride,
        byRule,
        leader: isLeader(user.leaderOverride, first, rule),
        benefit,
        activeListings: user.listings.map((listing) => ({
          id: listing.id,
          title: listing.title,
          categoryName: categoryNames.get(listing.categoryId) ?? null,
        })),
      };
    });
    leaders.sort((a, b) => Number(b.leader) - Number(a.leader) || (a.name ?? '').localeCompare(b.name ?? '', 'sr'));
    return { rule, leaders };
  }

  async adminSetLeaderRule(adminId: string, input: { cutoffDate?: string | null; days?: number }) {
    const before = await this.getLeaderRule();
    const after = readLeaderRule({ ...before, ...input });
    await this.saveSetting(adminId, FEATURED_LEADERS_KEY, before, after);
    return after;
  }

  /** Added to the leaders by hand (true), kept out (false), or left to the rule (null). */
  async adminSetLeader(adminId: string, userId: string, override: boolean | null) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { leaderOverride: true, email: true } });
    if (!user) throw new NotFoundException();
    await this.prisma.user.update({ where: { id: userId }, data: { leaderOverride: override } });
    await this.log(adminId, 'featured.leader_set', 'User', userId, { leaderOverride: user.leaderOverride }, { leaderOverride: override, email: user.email });
    return { userId, override };
  }

  /** A leader's free period, on the listing the admin picks (by default the first one that went live). */
  async adminGrantLeader(adminId: string, userId: string, listingId?: string) {
    const rule = await this.getLeaderRule();
    if (!(await this.ownerIsLeader(userId, rule))) throw new BadRequestException(this.i18n.t('errors.LEADER_NOT_LEADER'));
    if (await this.leaderBenefitUsed(userId)) throw new BadRequestException(this.i18n.t('errors.LEADER_BENEFIT_USED'));
    const listing = listingId
      ? await this.prisma.listing.findFirst({ where: { id: listingId, userId } })
      : await this.prisma.listing.findFirst({ where: { userId, status: 'ACTIVE' }, orderBy: { publishedAt: 'asc' } });
    if (!listing) throw new BadRequestException(this.i18n.t('errors.LEADER_NO_ACTIVE_LISTING'));
    const outcome = await grantFeatured(this.prisma, this.events, this.i18n, {
      listingId: listing.id,
      source: 'LEADER',
      days: rule.days,
      adminId,
    });
    await this.log(adminId, 'featured.leader_grant', this.outcomeEntity(outcome), this.outcomeId(outcome), undefined, {
      listing: listing.title,
      days: rule.days,
      status: outcome.status,
    });
    return outcome;
  }

  /** "Dodeli svima": every leader with an unused benefit and a live listing gets it now (or waits for a place). */
  async adminGrantAllLeaders(adminId: string) {
    const { leaders } = await this.adminListLeaders();
    const summary = { started: 0, waiting: 0, skipped: [] as Array<{ name: string | null; reason: string }> };
    for (const leader of leaders) {
      if (!leader.leader || leader.benefit.state !== 'UNUSED') continue;
      if (!leader.activeListings.length) {
        summary.skipped.push({ name: leader.name, reason: this.i18n.t('errors.LEADER_NO_ACTIVE_LISTING') });
        continue;
      }
      try {
        const outcome = await this.adminGrantLeader(adminId, leader.userId, leader.activeListings[0].id);
        if (outcome.status === 'STARTED') summary.started += 1;
        else summary.waiting += 1;
      } catch (err) {
        summary.skipped.push({ name: leader.name, reason: (err as Error).message });
      }
    }
    return summary;
  }

  /** People an admin can add to the leaders by hand. */
  async adminSearchUsers(q: string) {
    const term = q.trim();
    if (term.length < 2) return [];
    const users = await this.prisma.user.findMany({
      where: {
        anonymizedAt: null,
        OR: [
          { email: { contains: term, mode: 'insensitive' } },
          { firstName: { contains: term, mode: 'insensitive' } },
          { lastName: { contains: term, mode: 'insensitive' } },
        ],
      },
      take: 10,
      orderBy: { createdAt: 'asc' },
      select: { id: true, firstName: true, lastName: true, email: true, leaderOverride: true, _count: { select: { listings: { where: { status: 'ACTIVE' } } } } },
    });
    return users.map((user) => ({
      id: user.id,
      name: personName(user),
      email: user.email,
      override: user.leaderOverride,
      activeListings: user._count.listings,
    }));
  }

  // -- Admin: periods ----------------------------------------------------------

  async adminListPeriods(state: 'live' | 'ended', now = new Date()) {
    const where: Prisma.FeaturedListingWhereInput =
      state === 'live'
        ? { expiresAt: { gt: now } }
        : { expiresAt: { lte: now, gt: new Date(now.getTime() - 90 * DAY_MS) } };
    const periods = await this.prisma.featuredListing.findMany({
      where,
      orderBy: { expiresAt: state === 'live' ? 'asc' : 'desc' },
      take: 300,
      include: PERIOD_ADMIN_INCLUDE,
    });
    const [stats, categoryNames] = await Promise.all([
      this.statsForPeriods(periods, now),
      this.taxonomy.getCategoryNames([...new Set(periods.map((p) => p.listing.categoryId))]),
    ]);
    return periods.map((period) => ({
      id: period.id,
      source: period.source,
      startsAt: period.startsAt,
      expiresAt: period.expiresAt,
      durationDays: period.durationDays,
      note: period.note,
      live: period.startsAt <= now && period.expiresAt > now,
      hiddenReason: this.hiddenReason(period.listing, now),
      listing: {
        id: period.listing.id,
        title: period.listing.title,
        slug: period.listing.slug,
        status: period.listing.status,
        categoryId: period.listing.categoryId,
        categoryName: categoryNames.get(period.listing.categoryId) ?? null,
      },
      owner: { id: period.listing.user.id, name: personName(period.listing.user), email: period.listing.user.email },
      assignedBy: personName(period.assignedByUser),
      stats: stats.get(period.id) ?? { searchImpressions: 0, homeImpressions: 0, clicks: 0 },
    }));
  }

  /** Why a featured listing is not shown right now, if it is not. */
  private hiddenReason(
    listing: { status: string; available: boolean; cityId?: string | null; user: { blocked: boolean; restrictedUntil: Date | null } },
    now: Date,
    cityId?: string,
  ): HiddenReason | null {
    if (listing.status !== 'ACTIVE') return 'NOT_ACTIVE';
    if (!listing.available) return 'UNAVAILABLE';
    if (!ownerMayBeFeatured(listing.user, now)) return 'OWNER_RESTRICTED';
    if (cityId && listing.cityId !== cityId) return 'OTHER_CITY';
    return null;
  }

  /** Each category with featured listings or a queue: places taken, its limit, how many wait. */
  async adminCapacity(now = new Date()) {
    const rules = await this.getRules();
    const [live, waiting] = await Promise.all([
      this.prisma.featuredListing.findMany({
        where: { ...liveFeaturedWhere(now), listing: { status: { not: 'DELETED' } } },
        select: { listing: { select: { categoryId: true } } },
      }),
      this.prisma.featuredRequest.findMany({
        where: { status: 'WAITING', listing: { status: { not: 'DELETED' } } },
        select: { listing: { select: { categoryId: true } } },
      }),
    ]);
    const byCategory = new Map<string, { taken: number; waiting: number }>();
    for (const row of live) {
      const entry = byCategory.get(row.listing.categoryId) ?? { taken: 0, waiting: 0 };
      entry.taken += 1;
      byCategory.set(row.listing.categoryId, entry);
    }
    for (const row of waiting) {
      const entry = byCategory.get(row.listing.categoryId) ?? { taken: 0, waiting: 0 };
      entry.waiting += 1;
      byCategory.set(row.listing.categoryId, entry);
    }
    const names = await this.taxonomy.getCategoryNames([...byCategory.keys()]);
    return [...byCategory]
      .map(([categoryId, counts]) => ({
        categoryId,
        name: names.get(categoryId) ?? null,
        ...counts,
        limit: categoryLimit(rules, categoryId),
      }))
      .sort((a, b) => b.taken / b.limit - a.taken / a.limit || (a.name ?? '').localeCompare(b.name ?? '', 'sr'));
  }

  async adminGrant(adminId: string, input: { listingId: string; days?: number; note?: string }) {
    const rules = await this.getRules();
    const days = input.days ?? rules.defaultDays;
    const listing = await this.prisma.listing.findUnique({ where: { id: input.listingId }, select: { title: true } });
    if (!listing) throw new NotFoundException();
    const outcome = await grantFeatured(this.prisma, this.events, this.i18n, {
      listingId: input.listingId,
      source: 'ADMIN',
      days,
      adminId,
      note: input.note?.trim() || null,
    });
    await this.log(adminId, 'featured.grant', this.outcomeEntity(outcome), this.outcomeId(outcome), undefined, {
      listing: listing.title,
      days,
      note: input.note ?? null,
      status: outcome.status,
    });
    return outcome;
  }

  /** "Promeni kraj": later lengthens the period, earlier shortens it; a moment already past ends it now. */
  async adminChangeEnd(adminId: string, featuredId: string, endsAt: Date, now = new Date()) {
    const period = await this.prisma.featuredListing.findUnique({
      where: { id: featuredId },
      include: { listing: { select: { title: true, categoryId: true } } },
    });
    if (!period) throw new NotFoundException();
    if (period.expiresAt <= now) throw new BadRequestException(this.i18n.t('errors.FEATURED_PERIOD_OVER'));
    if (Number.isNaN(endsAt.getTime()) || endsAt <= period.startsAt) {
      throw new BadRequestException(this.i18n.t('errors.FEATURED_END_INVALID'));
    }
    const expiresAt = endsAt < now ? now : endsAt;
    const durationDays = Math.max(1, Math.ceil((expiresAt.getTime() - period.startsAt.getTime()) / DAY_MS));
    const remindAgain = expiresAt.getTime() - now.getTime() > reminderLeadDays(durationDays) * DAY_MS;
    await this.prisma.featuredListing.update({
      where: { id: featuredId },
      data: { expiresAt, durationDays, ...(remindAgain ? { reminderSentAt: null } : {}) },
    });
    await this.log(adminId, 'featured.change_end', 'FeaturedListing', featuredId, { expiresAt: period.expiresAt }, {
      expiresAt,
      listing: period.listing.title,
    });
    if (expiresAt <= now || expiresAt < period.expiresAt) await this.promoteWaiting(period.listing.categoryId, now);
    return { id: featuredId, expiresAt };
  }

  /** "Završi odmah". */
  async adminEnd(adminId: string, featuredId: string, now = new Date()) {
    const period = await this.prisma.featuredListing.findUnique({
      where: { id: featuredId },
      include: { listing: { select: { title: true, categoryId: true } } },
    });
    if (!period) throw new NotFoundException();
    if (period.expiresAt <= now) throw new BadRequestException(this.i18n.t('errors.FEATURED_PERIOD_OVER'));
    await this.prisma.featuredListing.update({ where: { id: featuredId }, data: { expiresAt: now } });
    await this.log(adminId, 'featured.end', 'FeaturedListing', featuredId, { expiresAt: period.expiresAt }, {
      expiresAt: now,
      listing: period.listing.title,
    });
    await this.promoteWaiting(period.listing.categoryId, now);
    return { id: featuredId, expiresAt: now };
  }

  /** Live listings an admin can feature, found by title or by the owner's name or email. */
  async adminSearchListings(q: string, now = new Date()) {
    const term = q.trim();
    if (term.length < 2) return [];
    const listings = await this.prisma.listing.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { title: { contains: term, mode: 'insensitive' } },
          { slug: { contains: term, mode: 'insensitive' } },
          { user: { email: { contains: term, mode: 'insensitive' } } },
          { user: { lastName: { contains: term, mode: 'insensitive' } } },
        ],
      },
      take: 10,
      orderBy: { publishedAt: 'desc' },
      select: {
        id: true,
        title: true,
        categoryId: true,
        user: { select: { firstName: true, lastName: true, email: true } },
        featuredPeriods: { where: liveFeaturedWhere(now), select: { expiresAt: true }, take: 1 },
      },
    });
    const names = await this.taxonomy.getCategoryNames([...new Set(listings.map((l) => l.categoryId))]);
    return listings.map((listing) => ({
      id: listing.id,
      title: listing.title,
      categoryName: names.get(listing.categoryId) ?? null,
      owner: personName(listing.user),
      featuredUntil: listing.featuredPeriods[0]?.expiresAt ?? null,
    }));
  }

  // -- Admin: requests -------------------------------------------------------

  async adminListRequests(status?: FeaturedRequestStatus, now = new Date()) {
    const statuses: FeaturedRequestStatus[] = status ? [status] : ['PENDING', 'WAITING'];
    const requests = await this.prisma.featuredRequest.findMany({
      where: { status: { in: statuses } },
      orderBy: { requestedAt: statuses.includes('PENDING') || statuses.includes('WAITING') ? 'asc' : 'desc' },
      take: 300,
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            slug: true,
            status: true,
            categoryId: true,
            user: { select: { id: true, firstName: true, lastName: true, email: true, leaderOverride: true } },
          },
        },
        decidedBy: { select: { firstName: true, lastName: true, email: true } },
      },
    });
    const [rules, leaderRule] = await Promise.all([this.getRules(), this.getLeaderRule()]);
    const categoryIds = [...new Set(requests.map((r) => r.listing.categoryId))];
    const [names, occupancy] = await Promise.all([
      this.taxonomy.getCategoryNames(categoryIds),
      Promise.all(categoryIds.map(async (id) => [id, await categoryOccupancy(this.prisma, id, now)] as const)),
    ]);
    const occupancyByCategory = new Map(occupancy);
    const leaderInfo = new Map<string, { leader: boolean; benefitUsed: boolean }>();
    for (const ownerId of new Set(requests.map((r) => r.listing.user.id))) {
      const leader = await this.ownerIsLeader(ownerId, leaderRule);
      leaderInfo.set(ownerId, { leader, benefitUsed: leader ? await this.leaderBenefitUsed(ownerId) : false });
    }
    const queuePosition = new Map<string, number>();
    const waitingByCategory = new Map<string, number>();
    for (const request of requests) {
      if (request.status !== 'WAITING') continue;
      const position = (waitingByCategory.get(request.listing.categoryId) ?? 0) + 1;
      waitingByCategory.set(request.listing.categoryId, position);
      queuePosition.set(request.id, position);
    }
    return requests.map((request) => {
      const owner = request.listing.user;
      const counts = occupancyByCategory.get(request.listing.categoryId) ?? { taken: 0, waiting: 0 };
      return {
        id: request.id,
        status: request.status,
        source: request.source,
        durationDays: request.durationDays,
        requestedAt: request.requestedAt,
        decidedAt: request.decidedAt,
        decidedBy: personName(request.decidedBy),
        decisionNote: request.decisionNote,
        queuePosition: queuePosition.get(request.id) ?? null,
        listing: {
          id: request.listing.id,
          title: request.listing.title,
          slug: request.listing.slug,
          status: request.listing.status,
          categoryName: names.get(request.listing.categoryId) ?? null,
        },
        owner: { id: owner.id, name: personName(owner), email: owner.email, ...leaderInfo.get(owner.id) },
        category: { ...counts, limit: categoryLimit(rules, request.listing.categoryId) },
      };
    });
  }

  async adminApprove(adminId: string, requestId: string, input: { days?: number; asLeader?: boolean }) {
    const request = await this.prisma.featuredRequest.findUnique({
      where: { id: requestId },
      include: { listing: { select: { title: true, userId: true } } },
    });
    if (!request) throw new NotFoundException();
    if (request.status !== 'PENDING') throw new BadRequestException(this.i18n.t('errors.FEATURED_REQUEST_CLOSED'));
    let source: FeaturedSource = 'REQUEST';
    let days = input.days ?? (await this.getRules()).defaultDays;
    if (input.asLeader) {
      const rule = await this.getLeaderRule();
      if (!(await this.ownerIsLeader(request.listing.userId, rule))) throw new BadRequestException(this.i18n.t('errors.LEADER_NOT_LEADER'));
      if (await this.leaderBenefitUsed(request.listing.userId)) throw new BadRequestException(this.i18n.t('errors.LEADER_BENEFIT_USED'));
      source = 'LEADER';
      days = rule.days;
    }
    const outcome = await grantFeatured(this.prisma, this.events, this.i18n, {
      listingId: request.listingId,
      source,
      days,
      adminId,
      requestId,
    });
    await this.log(adminId, 'featured.request_approve', 'FeaturedRequest', requestId, undefined, {
      listing: request.listing.title,
      source,
      days,
      status: outcome.status,
    });
    return outcome;
  }

  async adminReject(adminId: string, requestId: string, reason: string) {
    const request = await this.prisma.featuredRequest.findUnique({
      where: { id: requestId },
      include: { listing: { select: { title: true } } },
    });
    if (!request) throw new NotFoundException();
    if (request.status !== 'PENDING' && request.status !== 'WAITING') {
      throw new BadRequestException(this.i18n.t('errors.FEATURED_REQUEST_CLOSED'));
    }
    const note = reason.trim();
    await this.prisma.featuredRequest.update({
      where: { id: requestId },
      data: { status: 'REJECTED', decisionNote: note || null, decidedAt: new Date(), decidedByUserId: adminId },
    });
    await this.log(adminId, 'featured.request_reject', 'FeaturedRequest', requestId, { status: request.status }, {
      listing: request.listing.title,
      reason: note,
    });
    this.events.emit('featured.request_rejected', { requestId });
    return { id: requestId, status: 'REJECTED' };
  }

  // -- Admin: rules, preview, history -----------------------------------------

  async adminGetSettings() {
    const [rules, leaders, weightsRow, categories] = await Promise.all([
      this.getRules(),
      this.getLeaderRule(),
      this.prisma.setting.findUnique({ where: { key: RANKING_WEIGHTS_KEY } }),
      this.prisma.category.findMany({
        where: { status: 'ACTIVE' },
        orderBy: [{ level: 'asc' }, { displayOrder: 'asc' }],
        select: { id: true, parentId: true },
      }),
    ]);
    const names = await this.taxonomy.getCategoryNames(categories.map((c) => c.id));
    return {
      rules,
      leaders,
      rankingWeights: readRankingWeights(weightsRow?.value),
      categories: categories.map((category) => ({
        id: category.id,
        name: names.get(category.id) ?? category.id,
        parentName: category.parentId ? (names.get(category.parentId) ?? null) : null,
      })),
    };
  }

  async adminUpdateRules(adminId: string, input: Partial<FeaturedRules>) {
    const before = await this.getRules();
    const after = readFeaturedRules({ ...before, ...input });
    await this.saveSetting(adminId, FEATURED_RULES_KEY, before, after);
    await this.cache.del(RULES_CACHE_KEY);
    // A higher limit makes places at once.
    await this.promoteWaiting();
    return after;
  }

  async adminUpdateRanking(adminId: string, input: Partial<RankingWeights>) {
    const row = await this.prisma.setting.findUnique({ where: { key: RANKING_WEIGHTS_KEY } });
    const before = readRankingWeights(row?.value);
    const after = readRankingWeights({ ...before, ...input });
    if (Object.values(after).every((weight) => weight === 0)) {
      throw new BadRequestException(this.i18n.t('errors.RANKING_WEIGHTS_EMPTY'));
    }
    await this.saveSetting(adminId, RANKING_WEIGHTS_KEY, before, after);
    await this.cache.del(RANKING_WEIGHTS_CACHE_KEY);
    return after;
  }

  /**
   * "Probni prikaz": for a category (with its subcategories) and a city, every
   * live featured listing, why one would not show, today's turns, and which
   * ones the top of that search would get now. Nothing is counted.
   */
  async adminPreview(categorySlug?: string, cityId?: string, now = new Date()) {
    let categoryIds: string[] | null = null;
    let categoryName: string | null = null;
    if (categorySlug) {
      const category = await this.prisma.category.findUnique({ where: { slug: categorySlug } });
      if (!category) throw new NotFoundException();
      categoryIds = await this.categorySubtreeIds(category.id);
      categoryName = (await this.taxonomy.getCategoryNames([category.id])).get(category.id) ?? category.slug;
    }
    const rules = await this.getRules();
    const periods = await this.prisma.featuredListing.findMany({
      where: { ...liveFeaturedWhere(now), ...(categoryIds ? { listing: { categoryId: { in: categoryIds } } } : {}) },
      include: PERIOD_ADMIN_INCLUDE,
    });
    const shown = await this.readCounts(now, 's');
    const rows = periods.map((period) => ({
      listingId: period.listing.id,
      ownerId: period.listing.user.id,
      title: period.listing.title,
      owner: personName(period.listing.user),
      expiresAt: period.expiresAt,
      shownToday: shown.get(period.listing.id) ?? 0,
      reason: this.hiddenReason(period.listing, now, cityId),
    }));
    const eligible = rows.filter((row) => !row.reason);
    const top = rules.enabled ? pickLeastShown(eligible, shown, rules.searchTopCount).map((row) => row.listingId) : [];
    const city = cityId ? await this.prisma.city.findUnique({ where: { id: cityId }, select: { name: true } }) : null;
    return {
      enabled: rules.enabled,
      searchTopCount: rules.searchTopCount,
      categoryName,
      cityName: city?.name ?? null,
      top,
      candidates: rows
        .map((row) => ({ ...row, inTop: top.includes(row.listingId) }))
        .sort((a, b) => Number(b.inTop) - Number(a.inTop) || a.shownToday - b.shownToday),
    };
  }

  async adminHistory() {
    const rows = await this.prisma.adminLog.findMany({
      where: {
        OR: [
          { action: { startsWith: 'featured.' } },
          { entityType: 'Setting', entityId: { in: [FEATURED_RULES_KEY, FEATURED_LEADERS_KEY, RANKING_WEIGHTS_KEY] } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
    });
    return rows.map((row) => ({
      id: row.id,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      oldValue: row.oldValue,
      newValue: row.newValue,
      createdAt: row.createdAt,
      who: personName(row.user),
    }));
  }

  // -- Helpers -----------------------------------------------------------------

  /** R24: a category and the two levels below it. */
  private async categorySubtreeIds(rootId: string): Promise<string[]> {
    const ids = [rootId];
    let frontier = [rootId];
    for (let depth = 0; depth < 2 && frontier.length; depth++) {
      const children = await this.prisma.category.findMany({ where: { parentId: { in: frontier } }, select: { id: true } });
      frontier = children.map((child) => child.id);
      ids.push(...frontier);
    }
    return ids;
  }

  private outcomeEntity(outcome: GrantFeaturedOutcome) {
    return outcome.status === 'STARTED' ? 'FeaturedListing' : 'FeaturedRequest';
  }

  private outcomeId(outcome: GrantFeaturedOutcome) {
    return outcome.status === 'STARTED' ? outcome.featuredId : outcome.requestId;
  }

  private async saveSetting(adminId: string, key: string, before: unknown, after: unknown) {
    const value = after as Prisma.InputJsonValue;
    await this.prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
    await this.log(adminId, 'update_setting', 'Setting', key, before, after);
  }

  private async log(adminId: string, action: string, entityType: string, entityId: string, oldValue?: unknown, newValue?: unknown) {
    await this.prisma.adminLog.create({
      data: {
        userId: adminId,
        action,
        entityType,
        entityId,
        oldValue: oldValue === undefined ? undefined : (JSON.parse(JSON.stringify(oldValue)) as Prisma.InputJsonValue),
        newValue: newValue === undefined ? undefined : (JSON.parse(JSON.stringify(newValue)) as Prisma.InputJsonValue),
      },
    });
  }
}
