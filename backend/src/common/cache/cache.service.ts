import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { DERIVED_KEY_PREFIXES, deleteByPrefix } from './derived-keys';

// Redis answers in a millisecond or two; a command still unanswered after this
// counts as failed, so a request never hangs on a stalled connection.
const COMMAND_TIMEOUT_MS = 500;
// After a failure getOrSet leaves Redis alone for this long, so a stalled
// connection costs one request the timeout rather than every request.
const BYPASS_AFTER_FAILURE_MS = 5000;

/**
 * Thin Redis wrapper used for the handful of things worth caching (Ch.17
 * §16 performance notes): the category tree + resolved attribute sets
 * (change rarely, read on every listing-wizard and search-filter render),
 * the live listing counts per category, locations, packages and the search
 * ranking weights. Deliberately NOT used for anything that changes per-request
 * (bookings, messages); see DOCUMENTATION.md "Caching" for the full
 * what's-cached/for-how-long/invalidated-when table.
 *
 * The cache is optional: getOrSet, del and delByPrefix never fail a request
 * because Redis is down or slow. A read then goes to the database, and an
 * invalidation that could not reach Redis is made good when Redis is back
 * (backInUse drops every derived key). get and set still throw, for
 * AuthService's Google sign-in codes, which nothing but Redis holds.
 */
@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly client: Redis;
  private unavailable = false;
  private bypassUntil = 0;

  constructor(config: ConfigService) {
    this.client = new Redis({
      host: config.get<string>('redis.host'),
      port: config.get<number>('redis.port'),
      lazyConnect: false,
      maxRetriesPerRequest: 2,
      // Refuse a command at once while disconnected instead of queueing it
      // until Redis is back, which held the request up and then failed it.
      enableOfflineQueue: false,
      commandTimeout: COMMAND_TIMEOUT_MS,
    });
    this.client.on('error', (err) => this.logger.warn(`Redis error: ${err.message}`));
    this.client.on('ready', () => this.backInUse());
  }

  /** Throws when Redis fails. A cache read goes through getOrSet, which doesn't. */
  async get<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  /** Throws when Redis fails, for a value Redis alone holds. */
  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async del(...keys: string[]): Promise<void> {
    if (keys.length) await this.optional(() => this.client.del(keys));
  }

  async delByPrefix(prefix: string): Promise<void> {
    await this.optional(() => deleteByPrefix(this.client, prefix));
  }

  /** Read-through cache: return the cached value, or compute + store it. Without Redis it just computes. */
  async getOrSet<T>(key: string, ttlSeconds: number, compute: () => Promise<T>): Promise<T> {
    if (this.bypassing()) return compute();
    const cached = await this.optional(() => this.client.get(key));
    if (cached) return JSON.parse(cached) as T;
    const value = await compute();
    const serialized = JSON.stringify(value);
    if (!this.bypassing()) await this.optional(() => this.client.set(key, serialized, 'EX', ttlSeconds));
    return value;
  }

  async onModuleDestroy() {
    // quit() needs a live connection; without one there is nothing to close gracefully.
    await this.client.quit().catch(() => this.client.disconnect());
  }

  /**
   * On every (re)connection, and on the first answer after a failure: drops
   * the derived keys (see DERIVED_KEY_PREFIXES), which also makes good any
   * invalidation that failed while Redis was away.
   */
  private backInUse() {
    if (this.unavailable) this.logger.log('Redis answers again, cache back in use');
    this.unavailable = false;
    this.bypassUntil = 0;
    void this.dropDerivedData();
  }

  private async dropDerivedData() {
    for (const prefix of DERIVED_KEY_PREFIXES) await this.delByPrefix(prefix);
  }

  private bypassing() {
    return Date.now() < this.bypassUntil;
  }

  /** A Redis command whose failure costs only the cache: warned about once per outage, then undefined. */
  private async optional<T>(command: () => Promise<T>): Promise<T | undefined> {
    try {
      const result = await command();
      if (this.unavailable) this.backInUse();
      return result;
    } catch (err) {
      this.bypassUntil = Date.now() + BYPASS_AFTER_FAILURE_MS;
      if (!this.unavailable) {
        this.unavailable = true;
        this.logger.warn(`Redis unavailable, reading from the database: ${(err as Error).message}`);
      }
      return undefined;
    }
  }
}
