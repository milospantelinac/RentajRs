import {
  DEFAULT_FEATURED_RULES,
  belgradeDayKey,
  categoryLimit,
  isLeader,
  orderForHome,
  pickLeastShown,
  readFeaturedRules,
  readLeaderRule,
  reminderLeadDays,
  seededRandom,
} from './featured-rules';

/** A random source that walks a fixed list, so ties break the same way every run. */
function sequence(...values: number[]) {
  let index = 0;
  return () => values[index++ % values.length];
}

const candidate = (listingId: string, ownerId = listingId) => ({ listingId, ownerId });

describe('featured rules', () => {
  it('fills in and bounds whatever the setting row holds', () => {
    expect(readFeaturedRules(null)).toEqual(DEFAULT_FEATURED_RULES);
    const rules = readFeaturedRules({
      enabled: false,
      searchTopCount: 99,
      homeIntervalSeconds: 1,
      maxPerCategory: '12',
      categoryLimits: { c1: 3, c2: 'many', c3: 1000 },
      defaultDays: 14.4,
    });
    expect(rules.enabled).toBe(false);
    expect(rules.searchTopCount).toBe(10);
    expect(rules.homeIntervalSeconds).toBe(3);
    expect(rules.maxPerCategory).toBe(10);
    expect(rules.categoryLimits).toEqual({ c1: 3, c3: 100 });
    expect(rules.defaultDays).toBe(14);
  });

  it("uses a category's own limit, the general one otherwise", () => {
    const rules = readFeaturedRules({ maxPerCategory: 8, categoryLimits: { stanovi: 15 } });
    expect(categoryLimit(rules, 'stanovi')).toBe(15);
    expect(categoryLimit(rules, 'kuce')).toBe(8);
  });

  describe('leaders', () => {
    const rule = readLeaderRule({ cutoffDate: '2026-11-30', days: 30 });

    it('counts a first listing that went live by the end of the cutoff day in Belgrade', () => {
      // 23:30 in Belgrade on 30 November is 22:30 UTC.
      expect(isLeader(null, new Date('2026-11-30T22:30:00Z'), rule)).toBe(true);
      // 00:30 on 1 December in Belgrade.
      expect(isLeader(null, new Date('2026-11-30T23:30:00Z'), rule)).toBe(false);
      expect(isLeader(null, null, rule)).toBe(false);
    });

    it("puts the admin's word above the rule", () => {
      expect(isLeader(true, null, rule)).toBe(true);
      expect(isLeader(false, new Date('2026-10-01T10:00:00Z'), rule)).toBe(false);
      expect(isLeader(null, new Date('2026-10-01T10:00:00Z'), readLeaderRule({ cutoffDate: null }))).toBe(false);
    });

    it('reads a missing or broken rule as no rule', () => {
      expect(readLeaderRule({ cutoffDate: '30.11.2026', days: 0 })).toEqual({ cutoffDate: null, days: 1 });
      expect(readLeaderRule(undefined)).toEqual({ cutoffDate: null, days: 30 });
    });
  });

  describe('the top of a search', () => {
    it('takes those shown least today first', () => {
      const shown = new Map([['a', 5], ['b', 1], ['c', 3]]);
      const picked = pickLeastShown([candidate('a'), candidate('b'), candidate('c'), candidate('d')], shown, 3, sequence(0.5));
      expect(picked.map((c) => c.listingId)).toEqual(['d', 'b', 'c']);
    });

    it('never shows two listings of one owner at once', () => {
      const picked = pickLeastShown(
        [candidate('a', 'marko'), candidate('b', 'marko'), candidate('c', 'ana')],
        new Map(),
        3,
        sequence(0.1, 0.2, 0.3),
      );
      expect(picked.map((c) => c.listingId)).toEqual(['a', 'c']);
    });

    it('gives everyone the same number of turns over many searches', () => {
      const shown = new Map<string, number>();
      const pool = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((id) => candidate(id));
      for (let search = 0; search < 400; search++) {
        for (const { listingId } of pickLeastShown(pool, shown, 5)) shown.set(listingId, (shown.get(listingId) ?? 0) + 1);
      }
      const turns = [...shown.values()];
      // 400 searches x 5 places over 8 listings: 250 each, never more than one apart.
      expect(Math.max(...turns) - Math.min(...turns)).toBeLessThanOrEqual(1);
      expect(turns.reduce((sum, n) => sum + n, 0)).toBe(2000);
    });
  });

  describe('the home page', () => {
    it('starts with the least shown and keeps an owner out of neighbouring places', () => {
      const order = orderForHome(
        [candidate('a1', 'ana'), candidate('a2', 'ana'), candidate('b1', 'boris'), candidate('c1', 'ceca')],
        new Map([['b1', 4], ['c1', 2]]),
        2,
        sequence(0.1, 0.2, 0.3, 0.4),
      );
      expect(order.map((c) => c.listingId)).toEqual(['a1', 'c1', 'a2', 'b1']);
    });

    it('lists everyone even when one owner has most of them', () => {
      const order = orderForHome([candidate('a1', 'ana'), candidate('a2', 'ana'), candidate('a3', 'ana')], new Map(), 4);
      expect(order).toHaveLength(3);
    });
  });

  it('gives one search one order and another search another', () => {
    const ids = Array.from({ length: 50 }, (_, i) => `listing-${i}`);
    const first = ids.map((id) => seededRandom('seed-1', id));
    expect(ids.map((id) => seededRandom('seed-1', id))).toEqual(first);
    expect(first.every((value) => value >= 0 && value < 1)).toBe(true);
    const other = ids.map((id) => seededRandom('seed-2', id));
    expect(other).not.toEqual(first);
  });

  it('keeps the counts under the Belgrade day', () => {
    // 23:30 UTC on 22 October is already 23 October in Belgrade (UTC+2).
    expect(belgradeDayKey(new Date('2026-10-22T23:30:00Z'))).toBe('2026-10-23');
    expect(belgradeDayKey(new Date('2026-10-22T21:30:00Z'))).toBe('2026-10-22');
  });

  it('reminds a week before a month ends and two days before a week ends', () => {
    expect(reminderLeadDays(30)).toBe(7);
    expect(reminderLeadDays(7)).toBe(2);
  });
});
