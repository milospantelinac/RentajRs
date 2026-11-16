import { Logger } from '@nestjs/common';
import { FiscalizationError } from './fiscalization-provider.interface';
import {
  ALERT_AFTER_ATTEMPT,
  FiscalizationService,
  LEASE_MS,
  MAX_ATTEMPTS,
  RETRY_AFTER_MINUTES,
  retryDelayMs,
} from './fiscalization.service';

type Row = Record<string, any>;

const NOW = new Date('2026-11-15T12:00:00Z');
const MINUTE = 60_000;

/** The few Prisma calls the receipt queue makes, over one table. */
function makePrisma(rows: Row[]) {
  const matches = (row: Row, where: Row = {}): boolean =>
    Object.entries(where).every(([key, cond]) => {
      if (key === 'OR') return (cond as Row[]).some((alternative) => matches(row, alternative));
      const value = row[key];
      if (cond !== null && typeof cond === 'object' && !(cond instanceof Date)) {
        if ('lte' in cond) return value != null && value <= cond.lte;
        if ('in' in cond) return cond.in.includes(value);
        throw new Error(`the fake has no filter for ${key}: ${JSON.stringify(cond)}`);
      }
      return value === cond;
    });
  const apply = (row: Row, data: Row) => {
    for (const [key, value] of Object.entries(data)) {
      row[key] = value !== null && typeof value === 'object' && 'increment' in value ? row[key] + value.increment : value;
    }
  };
  return {
    invoice: {
      updateMany: jest.fn(async ({ where, data }: Row) => {
        const hit = rows.filter((row) => matches(row, where));
        hit.forEach((row) => apply(row, data));
        return { count: hit.length };
      }),
      findUniqueOrThrow: jest.fn(async ({ where }: Row) => {
        const row = rows.find((candidate) => matches(candidate, where));
        if (!row) throw new Error('invoice not found');
        return { ...row };
      }),
      findMany: jest.fn(async ({ where, orderBy, take }: Row) =>
        rows
          .filter((row) => matches(row, where))
          .sort((a, b) => (orderBy?.createdAt === 'asc' ? a.createdAt - b.createdAt : 0))
          .slice(0, take)
          .map((row) => ({ ...row })),
      ),
      update: jest.fn(async ({ where, data }: Row) => {
        const row = rows.find((candidate) => matches(candidate, where));
        if (!row) throw new Error('invoice to update not found');
        apply(row, data);
        return { ...row };
      }),
      create: jest.fn(async ({ data }: Row) => {
        const row = { id: `inv-${rows.length + 1}`, number: rows.length + 1, attempts: 0, createdAt: NOW, ...data };
        rows.push(row);
        return { ...row };
      }),
    },
  };
}

const invoice = (extra: Row = {}): Row => ({
  id: 'inv-1',
  number: 12,
  transactionId: 'tx-1',
  userId: 'u1',
  documentType: 'FISCAL_RECEIPT',
  status: 'PENDING',
  amount: 334_000n,
  description: 'Oglašavanje na Rentaj.rs, paket STANDARD (30 dana)',
  buyerTaxId: null,
  orderNumber: null,
  attempts: 0,
  nextAttemptAt: NOW,
  lastError: null,
  documentNumber: null,
  createdAt: NOW,
  ...extra,
});

const ISSUED = {
  documentNumber: '492JJPMX-C38FDVO0-12',
  externalId: '492JJPMX-C38FDVO0-12',
  pdfUrl: 'https://api.fiscomm.rs/receipt/abc',
  verificationUrl: 'https://suf.purs.gov.rs/v/?vl=abc',
  invoiceCounter: '12/12OP',
  issuedAt: new Date('2026-11-15T11:59:58Z'),
};

function setup(rows: Row[]) {
  const prisma = makePrisma(rows);
  const provider = { issueDocument: jest.fn(async () => ISSUED), status: jest.fn(async () => ({ provider: 'fiscomm', ok: true })) };
  const events = { emit: jest.fn() };
  const config = { get: (key: string) => (key === 'fiscalization.fiscomm.orderPrefix' ? 'RNT-' : undefined) };
  const service = new FiscalizationService(prisma as any, provider as any, events as any, config as any);
  return { service, prisma, provider, events, rows };
}

const emitted = (events: { emit: jest.Mock }) => events.emit.mock.calls.map(([name]) => name);

beforeEach(() => {
  // Only the clock is faked: the tests wait on real promises and immediates.
  jest.useFakeTimers({
    doNotFake: ['hrtime', 'nextTick', 'performance', 'queueMicrotask', 'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'],
  });
  jest.setSystemTime(NOW);
  // The queue logs every try; the tests read the rows and the events instead.
  for (const level of ['log', 'warn', 'error'] as const) jest.spyOn(Logger.prototype, level).mockImplementation(() => undefined);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('FiscalizationService queue', () => {
  it('writes a receipt as pending inside the payment\'s own transaction, due at once', async () => {
    const { service, prisma, rows } = setup([]);
    const created = await service.enqueueReceipt(prisma as any, {
      transactionId: 'tx-9',
      userId: 'u1',
      amount: 334_000n,
      description: 'Paket',
      buyerTaxId: '115213635',
    });
    expect(created).toMatchObject({ documentType: 'FISCAL_RECEIPT', status: 'PENDING', transactionId: 'tx-9', buyerTaxId: '115213635' });
    expect(rows[0].nextAttemptAt).toEqual(NOW);
  });

  it('keeps a person\'s receipt without a buyer ID', async () => {
    const { service, prisma, rows } = setup([]);
    await service.enqueueReceipt(prisma as any, { transactionId: 'tx-9', userId: 'u1', amount: 1n, description: 'Paket' });
    expect(rows[0].buyerTaxId).toBeNull();
  });
});

describe('FiscalizationService first try', () => {
  it('issues the receipt, keeps its number and links, and tells the email listener', async () => {
    const { service, provider, events, rows } = setup([invoice()]);
    const issued = await service.issue('inv-1');

    expect(provider.issueDocument).toHaveBeenCalledWith({
      documentType: 'FISCAL_RECEIPT',
      amountRsd: 3340,
      buyerTaxId: undefined,
      description: 'Oglašavanje na Rentaj.rs, paket STANDARD (30 dana)',
      orderNumber: 'RNT-000012',
      reference: { invoiceId: 'inv-1', transactionId: 'tx-1' },
    });
    expect(issued).toMatchObject({ status: 'ISSUED', documentNumber: ISSUED.documentNumber });
    expect(rows[0]).toMatchObject({
      status: 'ISSUED',
      orderNumber: 'RNT-000012',
      documentNumber: '492JJPMX-C38FDVO0-12',
      pdfUrl: ISSUED.pdfUrl,
      verificationUrl: ISSUED.verificationUrl,
      invoiceCounter: '12/12OP',
      issuedAt: ISSUED.issuedAt,
      nextAttemptAt: null,
      lastError: null,
      attempts: 1,
    });
    expect(emitted(events)).toEqual(['invoice.issued']);
    expect(events.emit).toHaveBeenCalledWith('invoice.issued', { invoiceId: 'inv-1' });
  });

  it('passes a company\'s PIB along', async () => {
    const { service, provider } = setup([invoice({ buyerTaxId: '115213635' })]);
    await service.issue('inv-1');
    expect(provider.issueDocument).toHaveBeenCalledWith(expect.objectContaining({ buyerTaxId: '115213635' }));
  });

  it('keeps the order number it first used, whatever the prefix is later', async () => {
    const { service, provider } = setup([invoice({ orderNumber: 'OLD-000012', attempts: 2, nextAttemptAt: new Date(NOW.getTime() - MINUTE) })]);
    await service.issue('inv-1');
    expect(provider.issueDocument).toHaveBeenCalledWith(expect.objectContaining({ orderNumber: 'OLD-000012' }));
  });

  it('does not touch a receipt that is not due, or is already done', async () => {
    const { service, provider } = setup([
      invoice({ id: 'later', nextAttemptAt: new Date(NOW.getTime() + 5 * MINUTE) }),
      invoice({ id: 'done', status: 'ISSUED' }),
      invoice({ id: 'failed', status: 'FAILED' }),
      invoice({ id: 'proforma', documentType: 'PRO_FORMA' }),
    ]);
    for (const id of ['later', 'done', 'failed', 'proforma']) expect(await service.issue(id)).toBeNull();
    expect(provider.issueDocument).not.toHaveBeenCalled();
  });

  it('lets only one try run a receipt: the claim is a single conditional update', async () => {
    const { service, provider } = setup([invoice()]);
    const [first, second] = await Promise.all([service.issue('inv-1'), service.issue('inv-1')]);
    expect([first, second].filter(Boolean)).toHaveLength(1);
    expect(provider.issueDocument).toHaveBeenCalledTimes(1);
  });

  it('holds the receipt for a while while a try runs, so the sweep leaves it alone', async () => {
    const { service, rows, provider } = setup([invoice()]);
    let during: Date | null = null;
    provider.issueDocument.mockImplementationOnce(async () => {
      during = rows[0].nextAttemptAt;
      return ISSUED;
    });
    await service.issue('inv-1');
    expect(during).toEqual(new Date(NOW.getTime() + LEASE_MS));
  });
});

describe('FiscalizationService when the fiscal service fails', () => {
  const fail = (provider: { issueDocument: jest.Mock }, error: unknown) => provider.issueDocument.mockRejectedValueOnce(error);

  it('asks again after a minute, then after longer and longer, and keeps the reason', async () => {
    const { service, provider, rows, events } = setup([invoice()]);
    fail(provider, new FiscalizationError('Fiscomm 500 ERR_00002: Internal error', true, 'ERR_00002', 'c1'));
    await service.issue('inv-1');

    expect(rows[0]).toMatchObject({ status: 'PENDING', attempts: 1, lastError: 'Fiscomm 500 ERR_00002: Internal error' });
    expect(rows[0].nextAttemptAt).toEqual(new Date(NOW.getTime() + 1 * MINUTE));
    expect(emitted(events)).toEqual([]);

    jest.setSystemTime(new Date(NOW.getTime() + 2 * MINUTE));
    fail(provider, new FiscalizationError('Fiscomm 500', true));
    await service.issue('inv-1');
    expect(rows[0].attempts).toBe(2);
    expect(rows[0].nextAttemptAt).toEqual(new Date(NOW.getTime() + 2 * MINUTE + 5 * MINUTE));
  });

  it('retries with the same order number every time', async () => {
    const { service, provider } = setup([invoice()]);
    fail(provider, new FiscalizationError('down', true));
    await service.issue('inv-1');
    jest.setSystemTime(new Date(NOW.getTime() + 2 * MINUTE));
    await service.issue('inv-1');
    const orders = provider.issueDocument.mock.calls.map(([input]: any[]) => input.orderNumber);
    expect(orders).toEqual(['RNT-000012', 'RNT-000012']);
  });

  it('tells the admins once, when it is still not out after a few tries', async () => {
    const { service, provider, events, rows } = setup([invoice()]);
    for (let attempt = 1; attempt <= ALERT_AFTER_ATTEMPT + 2; attempt++) {
      fail(provider, new FiscalizationError('down', true));
      jest.setSystemTime(new Date(NOW.getTime() + attempt * 1000 * 60 * 60 * 12));
      await service.issue('inv-1');
      expect(rows[0].attempts).toBe(attempt);
    }
    expect(emitted(events).filter((name) => name === 'invoice.delayed')).toHaveLength(1);
    expect(emitted(events)).not.toContain('invoice.failed');
    expect(rows[0].status).toBe('PENDING');
  });

  it('gives up at once on a receipt the Tax Administration refused, and tells the admins', async () => {
    const { service, provider, events, rows } = setup([invoice()]);
    fail(provider, new FiscalizationError('Fiscomm 400 ERR_01010: Rejected [Tax Administration: label not allowed]', false, 'ERR_01010'));
    await service.issue('inv-1');
    expect(rows[0]).toMatchObject({ status: 'FAILED', nextAttemptAt: null, attempts: 1 });
    expect(rows[0].lastError).toContain('label not allowed');
    expect(events.emit).toHaveBeenCalledWith('invoice.failed', { invoiceId: 'inv-1' });
  });

  it('gives up when the tries run out', async () => {
    const { service, provider, events, rows } = setup([invoice({ attempts: MAX_ATTEMPTS - 1 })]);
    fail(provider, new FiscalizationError('still down', true));
    await service.issue('inv-1');
    expect(rows[0]).toMatchObject({ status: 'FAILED', attempts: MAX_ATTEMPTS });
    expect(emitted(events)).toEqual(['invoice.failed']);
  });

  it('treats an error that is not the provider\'s as worth another try', async () => {
    const { service, provider, rows } = setup([invoice()]);
    fail(provider, new TypeError('boom'));
    await service.issue('inv-1');
    expect(rows[0]).toMatchObject({ status: 'PENDING', lastError: 'boom' });
  });

  it('keeps an overlong reason from filling the row', async () => {
    const { service, provider, rows } = setup([invoice()]);
    fail(provider, new FiscalizationError('x'.repeat(5000), true));
    await service.issue('inv-1');
    expect(rows[0].lastError).toHaveLength(1000);
  });
});

describe('FiscalizationService sweep', () => {
  it('issues what is due, oldest first, and leaves the rest', async () => {
    const { service, provider, rows } = setup([
      invoice({ id: 'newer', number: 2, createdAt: new Date(NOW.getTime() - 1 * MINUTE) }),
      invoice({ id: 'older', number: 1, createdAt: new Date(NOW.getTime() - 9 * MINUTE) }),
      invoice({ id: 'later', number: 3, nextAttemptAt: new Date(NOW.getTime() + 30 * MINUTE) }),
      invoice({ id: 'failed', number: 4, status: 'FAILED' }),
    ]);
    await service.processPending();
    expect(provider.issueDocument.mock.calls.map(([input]: any[]) => input.orderNumber)).toEqual(['RNT-000001', 'RNT-000002']);
    expect(rows.map((row) => `${row.id}:${row.status}`)).toEqual(['newer:ISSUED', 'older:ISSUED', 'later:PENDING', 'failed:FAILED']);
  });

  it('picks a receipt up again once a try that never finished has outlived its lease', async () => {
    const { service, provider } = setup([invoice({ attempts: 1, orderNumber: 'RNT-000012', nextAttemptAt: new Date(NOW.getTime() + LEASE_MS) })]);
    await service.processPending();
    expect(provider.issueDocument).not.toHaveBeenCalled();
    jest.setSystemTime(new Date(NOW.getTime() + LEASE_MS + 1000));
    await service.processPending();
    expect(provider.issueDocument).toHaveBeenCalledTimes(1);
  });

  it('does not start a second sweep while one is running', async () => {
    const { service, provider } = setup([invoice(), invoice({ id: 'inv-2', number: 13 })]);
    let release: () => void = () => undefined;
    provider.issueDocument.mockImplementationOnce(() => new Promise((resolve) => (release = () => resolve(ISSUED as any))));
    const first = service.processPending();
    for (let turn = 0; turn < 50 && provider.issueDocument.mock.calls.length === 0; turn++) await new Promise((resolve) => setImmediate(resolve));
    expect(provider.issueDocument).toHaveBeenCalledTimes(1); // the first sweep is inside its first receipt

    await service.processPending(); // returns at once: a sweep is already running
    expect(provider.issueDocument).toHaveBeenCalledTimes(1);

    release();
    await first;
    expect(provider.issueDocument).toHaveBeenCalledTimes(2); // the first sweep went on to the second receipt
  });

  it('survives a database error and sweeps again next time', async () => {
    const { service, prisma } = setup([invoice()]);
    prisma.invoice.findMany.mockRejectedValueOnce(new Error('db down'));
    await expect(service.processPending()).resolves.toBeUndefined();
    await expect(service.processPending()).resolves.toBeUndefined();
  });

  it('starts a first try without making the caller wait, and never throws', async () => {
    const { service, prisma } = setup([invoice()]);
    prisma.invoice.updateMany.mockRejectedValueOnce(new Error('db down'));
    expect(() => service.issueInBackground('inv-1')).not.toThrow();
    await new Promise((resolve) => setImmediate(resolve));
  });
});

describe('FiscalizationService admin', () => {
  it('tries a failed receipt again from the start', async () => {
    const { service, rows, provider } = setup([invoice({ status: 'FAILED', attempts: 4, lastError: 'old', nextAttemptAt: null, orderNumber: 'RNT-000012' })]);
    const issued = await service.retry('inv-1');
    expect(provider.issueDocument).toHaveBeenCalledTimes(1);
    expect(issued).toMatchObject({ status: 'ISSUED' });
    expect(rows[0]).toMatchObject({ attempts: 1, lastError: null });
  });

  it('tries a waiting receipt now instead of at its next turn', async () => {
    const { service, provider } = setup([invoice({ attempts: 2, nextAttemptAt: new Date(NOW.getTime() + 60 * MINUTE) })]);
    await service.retry('inv-1');
    expect(provider.issueDocument).toHaveBeenCalledTimes(1);
  });

  it('leaves an issued receipt, and what is not a fiscal receipt, alone', async () => {
    const { service, provider } = setup([invoice({ id: 'done', status: 'ISSUED' }), invoice({ id: 'proforma', documentType: 'PRO_FORMA', status: 'FAILED' })]);
    expect(await service.retry('done')).toBeNull();
    expect(await service.retry('proforma')).toBeNull();
    expect(provider.issueDocument).not.toHaveBeenCalled();
  });

  it('shows the provider\'s own account of the connection', async () => {
    const { service, provider } = setup([]);
    await expect(service.status()).resolves.toEqual({ provider: 'fiscomm', ok: true });
    expect(provider.status).toHaveBeenCalled();
  });
});

describe('retry timing', () => {
  it('waits longer after each failure, then every six hours', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 20].map((attempts) => retryDelayMs(attempts) / MINUTE)).toEqual([1, 5, 15, 60, 180, 360, 360, 360]);
    expect(RETRY_AFTER_MINUTES.at(-1)).toBe(360);
  });

  it('covers about a day and a half before a person has to decide', () => {
    let total = 0;
    for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt++) total += retryDelayMs(attempt);
    const hours = total / (60 * MINUTE);
    expect(hours).toBeGreaterThan(30);
    expect(hours).toBeLessThan(48);
  });
});
