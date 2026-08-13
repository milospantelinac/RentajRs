import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Thin Redis wrapper used for the handful of things worth caching (Ch.17
 * §16 performance notes): the category tree + resolved attribute sets
 * (change rarely, read on every listing-wizard and search-filter render),
 * and search facet counts. Deliberately NOT used for anything that changes
 * per-request (bookings, messages) — see DOCUMENTATION.md "Caching" for the
 * full what's-cached/for-how-long/invalidated-when table.
 */
@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly client: Redis;

  constructor(config: ConfigService) {
    this.client = new Redis({
      host: config.get<string>('redis.host'),
      port: config.get<number>('redis.port'),
      lazyConnect: false,
      maxRetriesPerRequest: 2,
    });
    this.client.on('error', (err) => this.logger.warn(`Redis error: ${err.message}`));
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async del(...keys: string[]): Promise<void> {
    if (keys.length) await this.client.del(keys);
  }

  async delByPrefix(prefix: string): Promise<void> {
    const stream = this.client.scanStream({ match: `${prefix}*`, count: 100 });
    const toDelete: string[] = [];
    for await (const keys of stream) {
      toDelete.push(...(keys as string[]));
    }
    if (toDelete.length) await this.client.del(toDelete);
  }

  /** Read-through cache: return the cached value, or compute + store it. */
  async getOrSet<T>(key: string, ttlSeconds: number, compute: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const value = await compute();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
