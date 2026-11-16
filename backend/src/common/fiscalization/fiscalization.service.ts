import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Invoice, InvoiceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paraToRsd } from '../utils/money';
import { FiscalizationError, FiscalizationProvider, FiscalizationStatus } from './fiscalization-provider.interface';

/** A try that started and never finished (the process died) is picked up again after this long. */
export const LEASE_MS = 5 * 60_000;
/** Minutes to wait after the first, second, ... failed try; the last value repeats. */
export const RETRY_AFTER_MINUTES = [1, 5, 15, 60, 180, 360];
/** About a day and a half of tries, then a person decides. */
export const MAX_ATTEMPTS = 12;
/** The admins hear about a receipt that is still not out after this many tries (about 20 minutes). */
export const ALERT_AFTER_ATTEMPT = 3;
const BATCH = 20;

export function retryDelayMs(attempts: number): number {
  const minutes = RETRY_AFTER_MINUTES[Math.min(Math.max(attempts, 1), RETRY_AFTER_MINUTES.length) - 1];
  return minutes * 60_000;
}

/**
 * Fiscal receipts for card payments. The Invoice row is its own queue entry:
 * it is written PENDING in the same database transaction as the payment
 * (enqueueReceipt), tried once right after the payment without making the
 * customer wait (issueInBackground), and tried again every minute until it is
 * issued (processPending). A slow or unreachable fiscal service therefore
 * delays a receipt but never loses it, and never fails a payment.
 *
 * Every try asks the provider with the same order number, so a try whose
 * answer got lost returns the receipt that already exists instead of making a
 * second one.
 *
 * Events: `invoice.issued` (the receipt exists: the email goes out),
 * `invoice.delayed` (still not out after a few tries) and `invoice.failed`
 * (needs a person), the last two to the admins.
 */
@Injectable()
export class FiscalizationService {
  private readonly logger = new Logger(FiscalizationService.name);
  private readonly orderPrefix: string;
  private sweeping = false;

  constructor(
    private prisma: PrismaService,
    private provider: FiscalizationProvider,
    private events: EventEmitter2,
    config: ConfigService,
  ) {
    this.orderPrefix = config.get<string>('fiscalization.fiscomm.orderPrefix') ?? 'RNT-';
  }

  /** Inside the payment's own transaction, so a recorded payment always has its receipt waiting. */
  enqueueReceipt(
    tx: Prisma.TransactionClient,
    input: { transactionId: string; userId: string; amount: bigint; description: string; buyerTaxId?: string | null },
  ): Promise<Invoice> {
    return tx.invoice.create({
      data: {
        transactionId: input.transactionId,
        userId: input.userId,
        documentType: 'FISCAL_RECEIPT',
        amount: input.amount,
        description: input.description,
        buyerTaxId: input.buyerTaxId ?? null,
        status: 'PENDING',
        nextAttemptAt: new Date(),
      },
    });
  }

  /** The first try, right after the payment. Nothing it does can fail the payment. */
  issueInBackground(invoiceId: string): void {
    void this.issue(invoiceId).catch((err) => this.logger.error(`Receipt ${invoiceId} could not be tried: ${(err as Error).message}`));
  }

  /** Every minute: whatever is due, oldest first. */
  @Cron(CronExpression.EVERY_MINUTE)
  async processPending(): Promise<void> {
    if (this.sweeping) return;
    this.sweeping = true;
    try {
      const due = await this.prisma.invoice.findMany({
        where: {
          documentType: 'FISCAL_RECEIPT',
          status: 'PENDING',
          OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }],
        },
        orderBy: { createdAt: 'asc' },
        take: BATCH,
        select: { id: true },
      });
      for (const { id } of due) await this.issue(id);
    } catch (err) {
      this.logger.error(`Sweep of pending receipts failed: ${(err as Error).message}`);
    } finally {
      this.sweeping = false;
    }
  }

  /**
   * One try. The claim is a single conditional update, so the first try after
   * the payment and the minute sweep can never run the same receipt twice, and
   * a try that dies halfway comes back after the lease.
   */
  async issue(invoiceId: string): Promise<Invoice | null> {
    const now = new Date();
    const claimed = await this.prisma.invoice.updateMany({
      where: {
        id: invoiceId,
        documentType: 'FISCAL_RECEIPT',
        status: 'PENDING',
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      },
      data: { nextAttemptAt: new Date(now.getTime() + LEASE_MS), attempts: { increment: 1 } },
    });
    if (!claimed.count) return null;

    let invoice = await this.prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    if (!invoice.orderNumber) {
      // Fixed at the first try, so a later change of the prefix never turns a retry into a second receipt.
      invoice = await this.prisma.invoice.update({
        where: { id: invoiceId },
        data: { orderNumber: `${this.orderPrefix}${String(invoice.number).padStart(6, '0')}` },
      });
    }

    try {
      const result = await this.provider.issueDocument({
        documentType: invoice.documentType,
        amountRsd: paraToRsd(invoice.amount) ?? 0,
        buyerTaxId: invoice.buyerTaxId ?? undefined,
        description: invoice.description ?? 'Rentaj',
        orderNumber: invoice.orderNumber!,
        reference: { invoiceId: invoice.id, transactionId: invoice.transactionId },
      });
      const issued = await this.prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          status: 'ISSUED',
          documentNumber: result.documentNumber,
          externalId: result.externalId,
          pdfUrl: result.pdfUrl ?? null,
          verificationUrl: result.verificationUrl ?? null,
          invoiceCounter: result.invoiceCounter ?? null,
          issuedAt: result.issuedAt ?? new Date(),
          nextAttemptAt: null,
          lastError: null,
        },
      });
      this.logger.log(`Receipt ${invoice.orderNumber} issued as ${result.documentNumber}`);
      this.events.emit('invoice.issued', { invoiceId });
      return issued;
    } catch (err) {
      return this.recordFailure(invoice, err);
    }
  }

  private async recordFailure(invoice: Invoice, err: unknown): Promise<Invoice> {
    const error = err instanceof FiscalizationError ? err : new FiscalizationError((err as Error)?.message ?? String(err), true);
    const message = error.message.slice(0, 1000);
    const attempts = invoice.attempts; // read after the claim, so it counts this try

    if (!error.retryable || attempts >= MAX_ATTEMPTS) {
      this.logger.error(`Receipt ${invoice.orderNumber} gave up after ${attempts} try(ies): ${message}`);
      const failed = await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: 'FAILED', nextAttemptAt: null, lastError: message },
      });
      this.events.emit('invoice.failed', { invoiceId: invoice.id });
      return failed;
    }

    this.logger.warn(`Receipt ${invoice.orderNumber} not issued (try ${attempts}), asking again later: ${message}`);
    const waiting = await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: { nextAttemptAt: new Date(Date.now() + retryDelayMs(attempts)), lastError: message },
    });
    if (attempts === ALERT_AFTER_ATTEMPT) this.events.emit('invoice.delayed', { invoiceId: invoice.id });
    return waiting;
  }

  // -- Admin (Administracija > Racuni) ---------------------------------------

  async listForAdmin(status?: InvoiceStatus) {
    const rows = await this.prisma.invoice.findMany({
      where: { documentType: 'FISCAL_RECEIPT', ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        status: true,
        number: true,
        orderNumber: true,
        description: true,
        amount: true,
        documentNumber: true,
        verificationUrl: true,
        pdfUrl: true,
        issuedAt: true,
        sentAt: true,
        attempts: true,
        nextAttemptAt: true,
        lastError: true,
        createdAt: true,
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
    return rows.map((row) => ({ ...row, amount: paraToRsd(row.amount) }));
  }

  /** "Pokusaj ponovo": a receipt that failed (or is waiting for its next try) is tried again now. */
  async retry(invoiceId: string): Promise<Invoice | null> {
    const reset = await this.prisma.invoice.updateMany({
      where: { id: invoiceId, documentType: 'FISCAL_RECEIPT', status: { in: ['PENDING', 'FAILED'] } },
      data: { status: 'PENDING', attempts: 0, nextAttemptAt: new Date(), lastError: null },
    });
    if (!reset.count) return null;
    return this.issue(invoiceId);
  }

  status(): Promise<FiscalizationStatus> {
    return this.provider.status();
  }
}
