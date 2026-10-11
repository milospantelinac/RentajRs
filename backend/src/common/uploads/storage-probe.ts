import { randomUUID } from 'crypto';
import type { StorageService } from './storage.service';

/**
 * T143: one round trip through the storage this backend is set up with, the
 * same whether Administracija > Skladište asks, the 15-minute health check
 * runs (StorageHealthService) or someone runs src/scripts/check-storage.ts.
 * A test file is written to each side, the public one read by its URL, the
 * private one opened with a signed link and refused without one, and both
 * deleted again. Nothing outside system/health-check/ is touched.
 */

export const PROBE_PREFIX = 'system/health-check/';
const PROBE_KEY = /^system\/health-check\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.txt$/;

export function isProbeKey(key: string): boolean {
  return PROBE_KEY.test(key);
}

export type ProbeCheckName =
  | 'write_public'
  | 'read_public'
  | 'public_not_listed'
  | 'write_private'
  | 'private_signed'
  | 'private_locked'
  | 'cleanup';

export interface ProbeResult {
  ok: boolean;
  checkedAt: string;
  latencyMs: number;
  checks: Array<{ name: ProbeCheckName; ok: boolean; detail?: string }>;
  /** Whether each bucket keeps deleted files as older versions; null when the storage cannot say. */
  versioning: { public: string | null; private: string | null } | null;
}

const REQUEST_TIMEOUT_MS = 15_000;

export async function probeStorage(storage: StorageService): Promise<ProbeResult> {
  const started = Date.now();
  const content = Buffer.from(`rentaj storage check ${new Date().toISOString()}`);
  const publicKey = `${PROBE_PREFIX}${randomUUID()}.txt`;
  const privateKey = `${PROBE_PREFIX}${randomUUID()}.txt`;
  const checks: ProbeResult['checks'] = [];
  const check = async (name: ProbeCheckName, test: () => Promise<true | string>) => {
    try {
      const outcome = await test();
      checks.push(outcome === true ? { name, ok: true } : { name, ok: false, detail: outcome });
    } catch (error) {
      checks.push({ name, ok: false, detail: (error as Error).message });
    }
  };
  const get = (url: string) => fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });

  await check('write_public', async () => {
    await storage.put('public', publicKey, content, { contentType: 'text/plain', cacheControl: 'no-store' });
    return true;
  });
  await check('read_public', async () => {
    const response = await get(`${storage.publicBaseUrl}/${publicKey}`);
    if (!response.ok) return `HTTP ${response.status}`;
    return Buffer.from(await response.arrayBuffer()).equals(content) ? true : 'different content';
  });
  await check('public_not_listed', async () => {
    const body = await (await get(`${storage.publicBaseUrl}/`)).text();
    return body.includes('<ListBucketResult') ? 'anyone can list the public bucket' : true;
  });
  await check('write_private', async () => {
    await storage.put('private', privateKey, content, { contentType: 'text/plain', cacheControl: 'no-store' });
    return true;
  });
  await check('private_signed', async () => {
    const response = await get(await storage.signedUrl(privateKey));
    if (!response.ok) return `HTTP ${response.status}`;
    return Buffer.from(await response.arrayBuffer()).equals(content) ? true : 'different content';
  });
  await check('private_locked', async () => {
    const response = await get((await storage.signedUrl(privateKey)).split('?')[0]);
    return response.ok ? `HTTP ${response.status}: anyone can read the private bucket` : true;
  });
  await check('cleanup', async () => {
    await storage.deleteObject('public', publicKey);
    await storage.deleteObject('private', privateKey);
    for await (const object of storage.list('public', PROBE_PREFIX)) {
      if (object.key === publicKey) return 'the test file is still there';
    }
    return true;
  });

  let versioning: ProbeResult['versioning'] = null;
  try {
    versioning = { public: await storage.versioning('public'), private: await storage.versioning('private') };
  } catch {
    // Not every S3-compatible store answers this; the check itself does not depend on it.
  }

  return {
    ok: checks.every((item) => item.ok),
    checkedAt: new Date().toISOString(),
    latencyMs: Date.now() - started,
    checks,
    versioning,
  };
}
