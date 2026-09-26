import type Redis from 'ioredis';

/**
 * Key prefixes that only hold copies of database rows: categories, attributes,
 * locations and listing counts (taxonomy:), packages (subscriptions:) and
 * settings (settings:). Redis outlives a deploy and a reseed, and after a
 * restart it can load a snapshot older than the last invalidation, so these are
 * dropped whenever the backend connects to Redis (CacheService) and at the end
 * of the seed. The Google sign-in codes (auth:) are not copies and never go.
 */
export const DERIVED_KEY_PREFIXES = ['taxonomy:', 'subscriptions:', 'settings:'];

/** Deletes every key under a prefix. SCAN rather than KEYS, which blocks Redis while it walks the keyspace. */
export async function deleteByPrefix(client: Redis, prefix: string): Promise<void> {
  const stream = client.scanStream({ match: `${prefix}*`, count: 100 });
  const keys: string[] = [];
  for await (const batch of stream) {
    keys.push(...(batch as string[]));
  }
  if (keys.length) await client.del(keys);
}
