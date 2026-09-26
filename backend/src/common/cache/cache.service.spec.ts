import { CacheService } from './cache.service';

// An in-memory stand-in for the ioredis client. `down` makes every command
// fail the way ioredis does without a connection.
jest.mock('ioredis', () => {
  const { EventEmitter } = require('events');
  const { Readable } = require('stream');

  class MockRedis extends EventEmitter {
    store = new Map<string, string>();
    down = false;

    constructor(public options: Record<string, unknown>) {
      super();
    }

    private answer<T>(value: () => T): Promise<T> {
      return this.down ? Promise.reject(new Error('Connection is closed.')) : Promise.resolve(value());
    }

    get = jest.fn((key: string) => this.answer(() => this.store.get(key) ?? null));
    set = jest.fn((key: string, value: string) =>
      this.answer(() => {
        this.store.set(key, value);
        return 'OK';
      }),
    );
    del = jest.fn((keys: string[]) => this.answer(() => keys.filter((key) => this.store.delete(key)).length));
    scanStream = jest.fn(({ match }: { match: string }) => {
      if (this.down) {
        const stream = new Readable({ objectMode: true, read() {} });
        process.nextTick(() => stream.destroy(new Error('Connection is closed.')));
        return stream;
      }
      const prefix = match.slice(0, -1);
      return Readable.from([[...this.store.keys()].filter((key) => key.startsWith(prefix))]);
    });
    quit = jest.fn(() => this.answer(() => 'OK'));
    disconnect = jest.fn();
  }

  return { __esModule: true, default: MockRedis };
});

function makeService() {
  const config = { get: (key: string) => (key === 'redis.host' ? 'localhost' : 6379) };
  const service = new CacheService(config as any);
  const redis = (service as any).client;
  const logger = (service as any).logger;
  jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
  jest.spyOn(logger, 'log').mockImplementation(() => undefined);
  return { service, redis, logger };
}

describe('CacheService', () => {
  it('refuses commands at once while disconnected and gives up on a stalled one', () => {
    const { redis } = makeService();
    expect(redis.options).toMatchObject({ enableOfflineQueue: false, commandTimeout: 500 });
  });

  it('reads through Redis while it answers', async () => {
    const { service, redis } = makeService();
    const compute = jest.fn(async () => ({ name: 'Nekretnine' }));

    await expect(service.getOrSet('taxonomy:x', 60, compute)).resolves.toEqual({ name: 'Nekretnine' });
    await expect(service.getOrSet('taxonomy:x', 60, compute)).resolves.toEqual({ name: 'Nekretnine' });
    expect(compute).toHaveBeenCalledTimes(1);
    expect(redis.set).toHaveBeenCalledWith('taxonomy:x', '{"name":"Nekretnine"}', 'EX', 60);
  });

  it('answers from the database while Redis is down, and warns once', async () => {
    const { service, redis, logger } = makeService();
    redis.down = true;
    const compute = jest.fn(async () => ['Stanovi']);

    await expect(service.getOrSet('taxonomy:x', 60, compute)).resolves.toEqual(['Stanovi']);
    await expect(service.getOrSet('taxonomy:x', 60, compute)).resolves.toEqual(['Stanovi']);
    await expect(service.del('taxonomy:x')).resolves.toBeUndefined();
    await expect(service.delByPrefix('taxonomy:')).resolves.toBeUndefined();
    expect(compute).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn.mock.calls[0][0]).toContain('Connection is closed.');
  });

  it('leaves Redis alone for a few seconds after a failure, then tries it again', async () => {
    const { service, redis } = makeService();
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const compute = jest.fn(async () => 'Sale');
    redis.down = true;

    await service.getOrSet('taxonomy:x', 60, compute);
    await service.getOrSet('taxonomy:x', 60, compute);
    // Only the first read waited on Redis, and nothing was written back.
    expect(redis.get).toHaveBeenCalledTimes(1);
    expect(redis.set).not.toHaveBeenCalled();

    redis.down = false;
    now.mockReturnValue(1_000_000 + 5000);
    await service.getOrSet('taxonomy:x', 60, compute);
    expect(redis.get).toHaveBeenCalledTimes(2);
    expect(redis.set).toHaveBeenCalledWith('taxonomy:x', '"Sale"', 'EX', 60);
    now.mockRestore();
  });

  it('drops the derived keys once Redis answers again, since an invalidation may have failed', async () => {
    const { service, redis, logger } = makeService();
    redis.store.set('taxonomy:tree:v3', 'the tree before the admin edit');
    redis.store.set('auth:google-exchange:abc', 'code');
    redis.down = true;
    await service.del('taxonomy:tree:v3');

    redis.down = false;
    const drop = jest.spyOn(service as any, 'dropDerivedData');
    await service.del('taxonomy:attributes:v2:c1');
    await drop.mock.results[0].value;
    expect(logger.log).toHaveBeenCalledWith('Redis answers again, cache back in use');
    expect([...redis.store.keys()]).toEqual(['auth:google-exchange:abc']);
  });

  it('still throws from get and set, which hold what only Redis has', async () => {
    const { service, redis } = makeService();
    redis.down = true;
    await expect(service.set('auth:google-exchange:abc', { accessToken: 'a' }, 30)).rejects.toThrow('Connection is closed.');
    await expect(service.get('auth:google-exchange:abc')).rejects.toThrow('Connection is closed.');
  });

  it('drops the copies of database rows whenever it connects and keeps the sign-in codes', async () => {
    const { service, redis } = makeService();
    const drop = jest.spyOn(service as any, 'dropDerivedData');
    const keys = ['taxonomy:tree:v3', 'taxonomy:listing-counts', 'subscriptions:packages', 'settings:ranking_weights'];

    for (const round of [0, 1]) {
      [...keys, 'auth:google-exchange:abc'].forEach((key) => redis.store.set(key, '1'));
      redis.emit('ready');
      await drop.mock.results[round].value;
      expect([...redis.store.keys()]).toEqual(['auth:google-exchange:abc']);
    }
  });

  it('shuts down without a connection too', async () => {
    const { service, redis } = makeService();
    redis.down = true;
    await expect(service.onModuleDestroy()).resolves.toBeUndefined();
    expect(redis.disconnect).toHaveBeenCalled();
  });
});
