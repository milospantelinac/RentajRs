import { StorageHealthService } from './storage-health.service';
import * as probe from './storage-probe';

function result(ok: boolean) {
  return {
    ok,
    checkedAt: new Date().toISOString(),
    latencyMs: 12,
    checks: [{ name: 'write_public' as const, ok, ...(ok ? {} : { detail: 'HTTP 403' }) }],
    versioning: null,
  };
}

function makeService(recentAlert = false) {
  const prisma = { emailLog: { findFirst: jest.fn(async () => (recentAlert ? { id: 'e' } : null)) } };
  const events = { emit: jest.fn() };
  return { service: new StorageHealthService({} as any, prisma as any, events as any), events, prisma };
}

describe('StorageHealthService (T143)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('tells the admins when the storage stops working and when it works again', async () => {
    const spy = jest.spyOn(probe, 'probeStorage');
    const { service, events } = makeService();

    spy.mockResolvedValueOnce(result(false));
    await service.check();
    expect(events.emit).toHaveBeenCalledWith('storage.health_failed', expect.objectContaining({ detail: 'write_public: HTTP 403' }));
    expect(service.status().lastFailure?.detail).toBe('write_public: HTTP 403');

    spy.mockResolvedValueOnce(result(true));
    await service.check();
    expect(events.emit).toHaveBeenLastCalledWith('storage.health_recovered', expect.any(Object));
    expect(service.status().lastOkAt).not.toBeNull();
  });

  it('does not email again within six hours of the last alert', async () => {
    jest.spyOn(probe, 'probeStorage').mockResolvedValue(result(false));
    const { service, events } = makeService(true);

    await service.check();

    expect(events.emit).not.toHaveBeenCalled();
  });

  it('runs one check at a time; a second caller joins it', async () => {
    let finish: (value: any) => void = () => undefined;
    const spy = jest.spyOn(probe, 'probeStorage').mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const { service } = makeService();

    const first = service.check();
    const second = service.check();
    finish(result(true));

    expect(await first).toBe(await second);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
