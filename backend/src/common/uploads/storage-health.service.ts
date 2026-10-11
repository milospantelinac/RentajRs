import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from './storage.service';
import { ProbeResult, probeStorage } from './storage-probe';

// While the storage stays down, the admins hear of it once every six hours,
// across restarts too (EmailLog says when the last email went).
const ALERT_EVERY_MS = 6 * 60 * 60_000;
const PROBE_TIMEOUT_MS = 90_000;

/**
 * T143: is the storage reachable? Checked every 15 minutes and on demand from
 * Administracija > Skladište. The admins holding manage_storage get an email
 * when it stops working (storage.health_failed) and when it works again
 * (storage.health_recovered); AdminEmailListener sends both.
 */
@Injectable()
export class StorageHealthService {
  private readonly logger = new Logger(StorageHealthService.name);
  private last: ProbeResult | null = null;
  private lastOkAt: string | null = null;
  private lastFailure: { at: string; detail: string } | null = null;
  private running: Promise<ProbeResult> | null = null;

  constructor(
    private storage: StorageService,
    private prisma: PrismaService,
    private events: EventEmitter2,
  ) {}

  /** The last result since the backend started (none until the first check). */
  status() {
    return { last: this.last, lastOkAt: this.lastOkAt, lastFailure: this.lastFailure };
  }

  /** Runs a check, or joins the one under way. */
  check(): Promise<ProbeResult> {
    this.running ??= this.runCheck().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  @Cron('0 */15 * * * *')
  async scheduled() {
    await this.check().catch((error) => this.logger.error(`Storage check failed to run: ${(error as Error).message}`));
  }

  private async runCheck(): Promise<ProbeResult> {
    const wasFailing = this.last !== null && !this.last.ok;
    const result = await withTimeout(probeStorage(this.storage), PROBE_TIMEOUT_MS);
    this.last = result;
    if (result.ok) {
      this.lastOkAt = result.checkedAt;
      if (wasFailing) this.events.emit('storage.health_recovered', { checkedAt: result.checkedAt });
      return result;
    }
    const failed = result.checks.find((item) => !item.ok);
    const detail = failed ? `${failed.name}: ${failed.detail ?? ''}`.trim() : 'unknown';
    this.lastFailure = { at: result.checkedAt, detail };
    this.logger.warn(`Storage check failed (${detail})`);
    if (await this.alertDue()) this.events.emit('storage.health_failed', { checkedAt: result.checkedAt, detail });
    return result;
  }

  private async alertDue(): Promise<boolean> {
    const recent = await this.prisma.emailLog.findFirst({
      where: { event: 'admin_storage_unavailable', sentAt: { gte: new Date(Date.now() - ALERT_EVERY_MS) } },
      select: { id: true },
    });
    return !recent;
  }
}

/** A check that hangs past the limit counts as failed. */
async function withTimeout(probe: Promise<ProbeResult>, ms: number): Promise<ProbeResult> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<ProbeResult>((resolve) => {
    timer = setTimeout(
      () =>
        resolve({
          ok: false,
          checkedAt: new Date().toISOString(),
          latencyMs: ms,
          checks: [{ name: 'write_public', ok: false, detail: `no answer within ${ms / 1000} s` }],
          versioning: null,
        }),
      ms,
    );
  });
  try {
    return await Promise.race([probe, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
