import { belgradeDayStart, toBelgradeDateOnly } from './timezone';

/**
 * Featured listings (T129 point 6, R114): the rules an admin sets in
 * Administracija > Istaknuti oglasi, and the choices made from them. Pure
 * functions, kept apart from the database so each rule can be tested alone.
 *
 * The whole idea in three lines: only live, eligible featured listings take
 * part; whoever was shown least today goes first (ties in random order, one
 * listing per owner at a time); and a (sub)category holds a limited number of
 * them, so each one keeps a fair share of the places at the top.
 */

export const FEATURED_RULES_KEY = 'featured_rules';
export const FEATURED_LEADERS_KEY = 'featured_leaders';

export interface FeaturedRules {
  /** The main switch: off, no featured block anywhere (periods keep running). */
  enabled: boolean;
  /** Featured listings at the top of a search's first page ("Preporučeno" only). */
  searchTopCount: number;
  /** Home page cards shown at once on a wide screen, and on a phone. */
  homeDesktopCount: number;
  homePhoneCount: number;
  /** The home page moves on after this many seconds. */
  homeIntervalSeconds: number;
  /** Live featured periods per (sub)category, unless categoryLimits says otherwise. */
  maxPerCategory: number;
  categoryLimits: Record<string, number>;
  /** Live or waiting featured listings of one owner in one (sub)category. */
  maxPerOwnerPerCategory: number;
  /** The length an approval or a grant gets unless the admin picks another. */
  defaultDays: number;
}

export const DEFAULT_FEATURED_RULES: FeaturedRules = {
  enabled: true,
  searchTopCount: 5,
  homeDesktopCount: 4,
  homePhoneCount: 1,
  homeIntervalSeconds: 5,
  maxPerCategory: 10,
  categoryLimits: {},
  maxPerOwnerPerCategory: 1,
  defaultDays: 30,
};

/** The bounds each number is held to, whatever was saved. */
export const FEATURED_RULE_BOUNDS = {
  searchTopCount: [0, 10],
  homeDesktopCount: [1, 8],
  homePhoneCount: [1, 4],
  homeIntervalSeconds: [3, 30],
  maxPerCategory: [1, 100],
  maxPerOwnerPerCategory: [1, 10],
  defaultDays: [1, 365],
} as const satisfies Record<string, readonly [number, number]>;

function boundedInt(value: unknown, fallback: number, [min, max]: readonly [number, number]): number {
  const number = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.min(max, Math.max(min, number));
}

/** A complete set of rules within bounds, whatever the setting row holds. */
export function readFeaturedRules(value: unknown): FeaturedRules {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const limits: Record<string, number> = {};
  if (raw.categoryLimits && typeof raw.categoryLimits === 'object') {
    for (const [categoryId, limit] of Object.entries(raw.categoryLimits as Record<string, unknown>)) {
      if (typeof limit === 'number' && Number.isFinite(limit)) {
        limits[categoryId] = boundedInt(limit, DEFAULT_FEATURED_RULES.maxPerCategory, FEATURED_RULE_BOUNDS.maxPerCategory);
      }
    }
  }
  const rules = { ...DEFAULT_FEATURED_RULES, categoryLimits: limits, enabled: raw.enabled !== false };
  for (const key of Object.keys(FEATURED_RULE_BOUNDS) as Array<keyof typeof FEATURED_RULE_BOUNDS>) {
    rules[key] = boundedInt(raw[key], DEFAULT_FEATURED_RULES[key], FEATURED_RULE_BOUNDS[key]);
  }
  return rules;
}

/** A category's own limit if the admin set one, the general one otherwise. */
export function categoryLimit(rules: FeaturedRules, categoryId: string): number {
  return rules.categoryLimits[categoryId] ?? rules.maxPerCategory;
}

// -- Leaders --------------------------------------------------------------

export interface LeaderRule {
  /** YYYY-MM-DD: an owner whose first listing went live by the end of this Belgrade day is a leader. */
  cutoffDate: string | null;
  /** The length of the one free featured period a leader gets. */
  days: number;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function readLeaderRule(value: unknown): LeaderRule {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const cutoffDate = typeof raw.cutoffDate === 'string' && DATE_ONLY.test(raw.cutoffDate) ? raw.cutoffDate : null;
  return { cutoffDate, days: boundedInt(raw.days, 30, FEATURED_RULE_BOUNDS.defaultDays) };
}

/** The instant the cutoff day ends in Belgrade: a first listing before it makes a leader. */
export function leaderCutoffEnd(cutoffDate: string): Date {
  const [year, month, day] = cutoffDate.split('-').map(Number);
  return belgradeDayStart(year, month, day + 1);
}

/** The admin's own word first (added or kept out by hand), then the rule. */
export function isLeader(override: boolean | null | undefined, firstPublishedAt: Date | null, rule: LeaderRule): boolean {
  if (override === true) return true;
  if (override === false) return false;
  if (!rule.cutoffDate || !firstPublishedAt) return false;
  return firstPublishedAt.getTime() < leaderCutoffEnd(rule.cutoffDate).getTime();
}

// -- Choosing who shows ---------------------------------------------------

export interface FeaturedCandidate {
  listingId: string;
  ownerId: string;
}

/** Least shown first; ties broken by a random key drawn once per candidate. */
function byLeastShown<T extends FeaturedCandidate>(candidates: T[], shown: Map<string, number>, random: () => number): T[] {
  const keyed = candidates.map((candidate) => ({ candidate, count: shown.get(candidate.listingId) ?? 0, tie: random() }));
  keyed.sort((a, b) => a.count - b.count || a.tie - b.tie);
  return keyed.map((entry) => entry.candidate);
}

/**
 * The top of a search (R114): up to `limit` of the candidates, those shown
 * least today first, so every featured listing gets about the same number of
 * turns there; never two listings of one owner at once.
 */
export function pickLeastShown<T extends FeaturedCandidate>(
  candidates: T[],
  shown: Map<string, number>,
  limit: number,
  random: () => number = Math.random,
): T[] {
  const picked: T[] = [];
  const owners = new Set<string>();
  for (const candidate of byLeastShown(candidates, shown, random)) {
    if (picked.length >= limit) break;
    if (owners.has(candidate.ownerId)) continue;
    owners.add(candidate.ownerId);
    picked.push(candidate);
  }
  return picked;
}

/**
 * The home page shows every featured listing in turn, `groupSize` at a time.
 * The order starts with those shown least today, and no owner appears twice
 * among any `groupSize` neighbours when that can be avoided.
 */
export function orderForHome<T extends FeaturedCandidate>(
  candidates: T[],
  shown: Map<string, number>,
  groupSize: number,
  random: () => number = Math.random,
): T[] {
  const pending = byLeastShown(candidates, shown, random);
  const order: T[] = [];
  while (pending.length) {
    const recentOwners = new Set(order.slice(Math.max(0, order.length - (groupSize - 1))).map((item) => item.ownerId));
    const index = pending.findIndex((item) => !recentOwners.has(item.ownerId));
    order.push(pending.splice(index === -1 ? 0 : index, 1)[0]);
  }
  return order;
}

/**
 * A number in [0, 1) that stays the same for one seed and one listing: the
 * random part of "Preporučeno", so a visitor paging through one search (and
 * "Prikaži još") gets one order, without repeats or gaps. FNV-1a, then a
 * final mix so that seeds differing by one character still spread out.
 */
export function seededRandom(seed: string, id: string): number {
  let hash = 0x811c9dc5;
  const text = `${seed}:${id}`;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x45d9f3b);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 0x1_0000_0000;
}

// -- Days and emails ------------------------------------------------------

/** The Belgrade calendar day as YYYY-MM-DD: the counters of one day are kept under it. */
export function belgradeDayKey(date: Date): string {
  return toBelgradeDateOnly(date).toISOString().slice(0, 10);
}

/** How long before the end the owner hears about it: a week, two days for a period of two weeks or less. */
export function reminderLeadDays(durationDays: number): number {
  return durationDays > 14 ? 7 : 2;
}
