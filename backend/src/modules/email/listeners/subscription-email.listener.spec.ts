import { Logger } from '@nestjs/common';
import { SubscriptionEmailListener, receiptLinksMjml } from './subscription-email.listener';

describe('SubscriptionEmailListener#onCheckoutFailed', () => {
  const user = { id: 'u1', email: 'ivana@example.com', language: 'SR' };
  const pkg = { id: 'pkg-standard', key: 'STANDARD' };
  const listing = { id: 'l1', title: 'Sala za proslave' };
  const event = { userId: 'u1', packageId: 'pkg-standard', amount: 334_000n, listingId: 'l1', renewsSubscriptionId: null };

  function setup(rows: { user?: unknown; pkg?: unknown; listing?: unknown } = {}) {
    const found = { user, pkg, listing, ...rows };
    const prisma = {
      user: { findUnique: jest.fn(async () => found.user) },
      package: { findUnique: jest.fn(async () => found.pkg) },
      listing: { findUnique: jest.fn(async () => found.listing) },
    };
    const email = { send: jest.fn(async () => undefined) };
    const listener = new SubscriptionEmailListener(prisma as any, email as any, { get: () => 'http://front' } as any);
    return { listener, email, prisma };
  }

  it('names the package, the amount and the listing, and links back to the package choice', async () => {
    const { listener, email, prisma } = setup();
    await listener.onCheckoutFailed(event);

    expect(prisma.listing.findUnique).toHaveBeenCalledWith({ where: { id: 'l1' }, select: { id: true, title: true } });
    expect(email.send.mock.calls).toEqual([
      [
        {
          key: 'subscription_checkout_failed',
          to: 'ivana@example.com',
          language: 'SR',
          userId: 'u1',
          context: { paket: 'STANDARD', iznos: '3.340 RSD', oglas: 'Sala za proslave' },
          buttonUrl: 'http://front/oglasi/l1/paket',
        },
      ],
    ]);
  });

  it('keeps the renewed package in the link, as the failure page does', async () => {
    const { listener, email } = setup();
    await listener.onCheckoutFailed({ ...event, renewsSubscriptionId: 's1' });
    expect(email.send).toHaveBeenCalledWith(expect.objectContaining({ buttonUrl: 'http://front/oglasi/l1/paket?obnova=s1' }));
  });

  it.each(['user', 'pkg', 'listing'])('sends nothing when the %s is gone', async (missing) => {
    const { listener, email } = setup({ [missing]: null });
    await listener.onCheckoutFailed(event);
    expect(email.send).not.toHaveBeenCalled();
  });
});

describe('SubscriptionEmailListener payment confirmation', () => {
  const sub = {
    id: 's1',
    userId: 'u1',
    priceAtPurchase: 334_000n,
    createdAt: new Date('2026-11-15T12:58:20Z'),
    startsAt: new Date('2026-11-15T13:00:00Z'),
    expiresAt: new Date('2026-12-15T13:00:00Z'),
    package: { key: 'STANDARD' },
    user: { id: 'u1', email: 'ivana@example.com', language: 'SR' },
  };

  function setup() {
    const prisma = {
      subscription: { findUnique: jest.fn(async () => sub) },
      transaction: { findFirst: jest.fn(async () => ({ occurredAt: new Date('2026-11-15T12:58:25Z') })) },
    };
    const email = { send: jest.fn(async () => true) };
    const listener = new SubscriptionEmailListener(prisma as any, email as any, { get: () => 'http://front' } as any);
    return { listener, email };
  }

  it('confirms a purchase at once and leaves the receipt to its own email, which waits for the receipt to exist', async () => {
    const { listener, email } = setup();
    await listener.onPurchased({ userId: 'u1', subscriptionId: 's1' });
    expect((email.send.mock.calls as any[][]).map(([sent]) => sent.key)).toEqual(['subscription_activated']);
  });

  it('does the same for a renewal', async () => {
    const { listener, email } = setup();
    await listener.onRenewed({ userId: 'u1', subscriptionId: 's1' });
    expect((email.send.mock.calls as any[][]).map(([sent]) => sent.key)).toEqual(['subscription_renewed']);
  });
});

describe('SubscriptionEmailListener receipt email', () => {
  const PDF_URL = 'https://api.fiscomm.rs/receipt/abc123';
  const VERIFY_URL = 'https://suf.purs.gov.rs/v/?vl=abc%2B123';
  const PDF_BYTES = Buffer.from('%PDF-1.4\n...a receipt...');

  const issuedInvoice = (extra: Record<string, unknown> = {}) => ({
    id: 'inv-1',
    documentType: 'FISCAL_RECEIPT',
    status: 'ISSUED',
    sentAt: null,
    amount: 334_000n,
    documentNumber: '492JJPMX-C38FDVO0-12',
    issuedAt: new Date('2026-11-15T12:58:27Z'),
    createdAt: new Date('2026-11-15T12:58:20Z'),
    pdfUrl: PDF_URL,
    verificationUrl: VERIFY_URL,
    user: { id: 'u1', email: 'ivana@example.com', language: 'SR' },
    transaction: { subscription: { package: { key: 'STANDARD' } } },
    ...extra,
  });

  function setup(invoice: Record<string, unknown> | null) {
    const prisma = {
      invoice: { findUnique: jest.fn(async () => invoice), update: jest.fn(async () => ({})) },
    };
    const email = { send: jest.fn(async () => true) };
    const config = { get: (key: string) => ({ frontendUrl: 'http://front', 'fiscalization.fiscomm.baseUrl': 'https://api.fiscomm.rs' })[key] };
    const listener = new SubscriptionEmailListener(prisma as any, email as any, config as any);
    return { listener, prisma, email };
  }

  function pdfResponse(init: { ok?: boolean; type?: string; body?: Buffer } = {}) {
    const body = init.body ?? PDF_BYTES;
    return {
      ok: init.ok ?? true,
      headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? (init.type ?? 'application/pdf') : null) },
      arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
    } as unknown as Response;
  }

  let fetchSpy: jest.SpyInstance;
  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(pdfResponse());
    for (const level of ['log', 'warn', 'error'] as const) jest.spyOn(Logger.prototype, level).mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('sends the receipt with its PDF attached, its number and the check at the Tax Administration', async () => {
    const { listener, email, prisma } = setup(issuedInvoice());
    await listener.onInvoiceIssued({ invoiceId: 'inv-1' });

    expect(email.send).toHaveBeenCalledTimes(1);
    const sent = (email.send.mock.calls as any[][])[0][0];
    expect(sent).toMatchObject({
      key: 'subscription_invoice',
      to: 'ivana@example.com',
      language: 'SR',
      userId: 'u1',
      buttonUrl: 'http://front/kontrolna-tabla/pretplate',
    });
    expect(sent.context).toMatchObject({ paket: 'STANDARD', iznos: '3.340 RSD', broj: '492JJPMX-C38FDVO0-12' });
    expect(sent.attachments).toEqual([{ filename: 'racun-492JJPMX-C38FDVO0-12.pdf', content: PDF_BYTES, contentType: 'application/pdf' }]);
    expect(sent.extraMjml).toContain('Račun je u prilogu');
    expect(sent.extraMjml).toContain(`href="${VERIFY_URL}"`);
    expect(sent.extraMjml).not.toContain('Preuzmite');
    expect(prisma.invoice.update).toHaveBeenCalledWith({ where: { id: 'inv-1' }, data: { sentAt: expect.any(Date) } });
  });

  it("asks for the PDF without any key: the link is the receipt's own", async () => {
    const { listener } = setup(issuedInvoice());
    await listener.onInvoiceIssued({ invoiceId: 'inv-1' });
    const [url, init] = fetchSpy.mock.calls[0] as [URL, RequestInit];
    expect(String(url)).toBe(PDF_URL);
    expect(init.headers).toBeUndefined();
  });

  it('sends a link instead when the PDF cannot be fetched, and still sends the receipt', async () => {
    fetchSpy.mockRejectedValue(new Error('timeout'));
    const { listener, email, prisma } = setup(issuedInvoice());
    await listener.onInvoiceIssued({ invoiceId: 'inv-1' });
    const sent = (email.send.mock.calls as any[][])[0][0];
    expect(sent.attachments).toBeUndefined();
    expect(sent.extraMjml).toContain(`href="${PDF_URL}"`);
    expect(sent.extraMjml).toContain('Preuzmite račun (PDF)');
    expect(prisma.invoice.update).toHaveBeenCalled();
  });

  it('attaches only something that is really a small PDF', async () => {
    for (const bad of [
      pdfResponse({ type: 'text/html' }),
      pdfResponse({ ok: false }),
      pdfResponse({ body: Buffer.from('<html>not a pdf</html>') }),
      pdfResponse({ body: Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(3 * 1024 * 1024)]) }),
      pdfResponse({ body: Buffer.alloc(0) }),
    ]) {
      fetchSpy.mockResolvedValueOnce(bad);
      const { listener, email } = setup(issuedInvoice());
      await listener.onInvoiceIssued({ invoiceId: 'inv-1' });
      expect(((email.send.mock.calls as any[][])[0][0] as any).attachments).toBeUndefined();
    }
  });

  it("fetches only from the fiscal service's own host, over https", async () => {
    for (const foreign of ['https://evil.example/receipt/abc', 'http://api.fiscomm.rs/receipt/abc', 'file:///etc/passwd', 'not a url']) {
      const { listener, email } = setup(issuedInvoice({ pdfUrl: foreign }));
      await listener.onInvoiceIssued({ invoiceId: 'inv-1' });
      expect(((email.send.mock.calls as any[][])[0][0] as any).attachments).toBeUndefined();
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('writes in English to an English-speaking customer', async () => {
    const { listener, email } = setup(issuedInvoice({ user: { id: 'u1', email: 'ivana@example.com', language: 'EN' } }));
    await listener.onInvoiceIssued({ invoiceId: 'inv-1' });
    const sent = (email.send.mock.calls as any[][])[0][0];
    expect(sent.language).toBe('EN');
    expect(sent.extraMjml).toContain('attached to this email as a PDF');
    expect(sent.extraMjml).toContain('Check the receipt with the Tax Administration');
  });

  it('does not send it twice', async () => {
    const { listener, email } = setup(issuedInvoice({ sentAt: new Date() }));
    await listener.onInvoiceIssued({ invoiceId: 'inv-1' });
    expect(email.send).not.toHaveBeenCalled();
  });

  it('sends nothing for a receipt that is not issued, a document that is not a fiscal receipt, or one that is gone', async () => {
    for (const invoice of [issuedInvoice({ status: 'PENDING' }), issuedInvoice({ status: 'FAILED' }), issuedInvoice({ documentType: 'PRO_FORMA' }), null]) {
      const { listener, email } = setup(invoice);
      await listener.onInvoiceIssued({ invoiceId: 'inv-1' });
      expect(email.send).not.toHaveBeenCalled();
    }
  });

  it('does not mark the receipt as sent when the mail system did not take it', async () => {
    const { listener, email, prisma } = setup(issuedInvoice());
    email.send.mockResolvedValueOnce(false);
    await listener.onInvoiceIssued({ invoiceId: 'inv-1' });
    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });

  it("copes with a receipt that has no links and no PDF, like the placeholder's", async () => {
    const { listener, email } = setup(issuedInvoice({ pdfUrl: null, verificationUrl: null, documentNumber: 'MOCK-2026-000001' }));
    await listener.onInvoiceIssued({ invoiceId: 'inv-1' });
    const sent = (email.send.mock.calls as any[][])[0][0];
    expect(sent.extraMjml).toBeUndefined();
    expect(sent.attachments).toBeUndefined();
    expect(sent.context.broj).toBe('MOCK-2026-000001');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('receiptLinksMjml', () => {
  it('leaves out a link that is not https, whatever the provider sent', () => {
    expect(receiptLinksMjml({ verificationUrl: 'javascript:alert(1)', pdfUrl: 'http://x.example/a', attached: false }, false)).toBeUndefined();
  });

  it('escapes what it puts into an attribute', () => {
    const html = receiptLinksMjml({ verificationUrl: 'https://suf.purs.gov.rs/v/?a=1&b="2"', pdfUrl: null, attached: false }, false)!;
    expect(html).toContain('a=1&amp;b=&quot;2&quot;');
    expect(html).not.toContain('"2"');
  });
});
