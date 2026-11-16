import { FiscalizationError } from './fiscalization-provider.interface';
import { FiscommProvider } from './fiscomm.provider';

const CYRILLIC_A = 'А';
const OPTIONS = { apiKey: 'secret-key', baseUrl: 'https://api.fiscomm.rs', invoiceType: 'training' as const, taxLabel: CYRILLIC_A, timeoutMs: 1000 };

const reply = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) }) as Response;

const RECEIPT = {
  invoiceNumber: '492JJPMX-C38FDVO0-7',
  invoiceCounter: '7/7ОП',
  sdcDateTime: '2026-11-15T12:58:27.025Z',
  verificationUrl: 'https://suf.purs.gov.rs/v/?vl=abc',
  invoicePdfUrl: 'https://api.fiscomm.rs/receipt/abc',
};

const INPUT = {
  documentType: 'FISCAL_RECEIPT' as const,
  amountRsd: 3340,
  description: 'Oglašavanje na Rentaj.rs, paket STANDARD (30 dana)',
  orderNumber: 'RNT-000007',
  reference: { invoiceId: 'inv-1', transactionId: 'tx-1' },
};

function setup(answer: () => Promise<Response> | Response, options = OPTIONS) {
  const fetchFn = jest.fn(async () => answer());
  const placeholder = { issueDocument: jest.fn(async () => ({ documentNumber: 'MOCK-1', externalId: 'mock-1' })), status: jest.fn() };
  const provider = new FiscommProvider(options, placeholder as any, fetchFn as any);
  return { provider, fetchFn, placeholder };
}

/** The echo Fiscomm sends back: our ids on the receipt. */
const echo = (extra: Record<string, unknown> = {}) => ({ ...RECEIPT, metaFields: { source: 'rentaj', invoiceId: 'inv-1', transactionId: 'tx-1' }, ...extra });

async function failure(promise: Promise<unknown>): Promise<FiscalizationError> {
  try {
    await promise;
  } catch (err) {
    expect(err).toBeInstanceOf(FiscalizationError);
    return err as FiscalizationError;
  }
  throw new Error('expected a FiscalizationError');
}

describe('FiscommProvider receipts', () => {
  it('sends one card sale for the package, with a retry-safe order number', async () => {
    const { provider, fetchFn } = setup(() => reply(201, { correlationId: 'c1', receipt: echo() }));
    await provider.issueDocument(INPUT);

    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.fiscomm.rs/receipt/training/sale');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer secret-key');
    expect(JSON.parse(init.body as string)).toEqual({
      orderNumber: 'RNT-000007',
      items: [{ name: INPUT.description, quantity: 1, unitPrice: 3340, totalAmount: 3340, labels: [CYRILLIC_A] }],
      payments: [{ type: 'card', amount: 3340 }],
      metaFields: { source: 'rentaj', invoiceId: 'inv-1', transactionId: 'tx-1' },
      settings: { returnIfOrderNumberExists: true },
    });
  });

  it('uses the Cyrillic A, the label for a taxpayer outside the VAT system', () => {
    expect(CYRILLIC_A.codePointAt(0)).toBe(0x410);
    expect(OPTIONS.taxLabel).not.toBe('A'); // the Latin letter is another label (10% on a demo account)
  });

  it('asks for a legal receipt only when told to', async () => {
    const { provider, fetchFn } = setup(() => reply(201, { receipt: echo() }), { ...OPTIONS, invoiceType: 'normal' as any });
    await provider.issueDocument(INPUT);
    expect((fetchFn.mock.calls[0] as unknown as [string])[0]).toBe('https://api.fiscomm.rs/receipt/normal/sale');
  });

  it('answers with the receipt: PFR number, counter, links and the Tax Administration time', async () => {
    const { provider } = setup(() => reply(201, { correlationId: 'c1', receipt: echo() }));
    await expect(provider.issueDocument(INPUT)).resolves.toEqual({
      documentNumber: '492JJPMX-C38FDVO0-7',
      externalId: '492JJPMX-C38FDVO0-7',
      pdfUrl: 'https://api.fiscomm.rs/receipt/abc',
      verificationUrl: 'https://suf.purs.gov.rs/v/?vl=abc',
      invoiceCounter: '7/7ОП',
      issuedAt: new Date('2026-11-15T12:58:27.025Z'),
    });
  });

  it('prints no buyer on a person\'s receipt, and the PIB on a company\'s', async () => {
    const person = setup(() => reply(201, { receipt: echo() }));
    await person.provider.issueDocument(INPUT);
    expect(JSON.parse((person.fetchFn.mock.calls[0] as any)[1].body)).not.toHaveProperty('buyerId');

    const company = setup(() => reply(201, { receipt: echo() }));
    await company.provider.issueDocument({ ...INPUT, buyerTaxId: '115213635' });
    expect(JSON.parse((company.fetchFn.mock.calls[0] as any)[1].body).buyerId).toBe('10:115213635');
  });

  it('leaves a PIB that does not add up off the receipt instead of holding the receipt back', async () => {
    const { provider, fetchFn } = setup(() => reply(201, { receipt: echo() }));
    await provider.issueDocument({ ...INPUT, buyerTaxId: '123456789' });
    expect(JSON.parse((fetchFn.mock.calls[0] as any)[1].body)).not.toHaveProperty('buyerId');
  });

  it('sends nothing personal to Fiscomm', async () => {
    const { provider, fetchFn } = setup(() => reply(201, { receipt: echo() }));
    await provider.issueDocument({ ...INPUT, buyerName: 'Ivana Marković' });
    expect((fetchFn.mock.calls[0] as any)[1].body).not.toContain('Ivana');
  });

  it('refuses to issue without an order number: a retry could not be made safe', async () => {
    const { provider, fetchFn } = setup(() => reply(201, { receipt: echo() }));
    const error = await failure(provider.issueDocument({ ...INPUT, orderNumber: undefined }));
    expect(error.retryable).toBe(false);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('leaves pro forma and e-invoice to the placeholder: they are not Fiscomm receipts', async () => {
    const { provider, fetchFn, placeholder } = setup(() => reply(201, { receipt: echo() }));
    await expect(provider.issueDocument({ ...INPUT, documentType: 'PRO_FORMA' })).resolves.toMatchObject({ documentNumber: 'MOCK-1' });
    expect(placeholder.issueDocument).toHaveBeenCalledTimes(1);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe('FiscommProvider when something goes wrong', () => {
  it('asks again later after a server error', async () => {
    const { provider } = setup(() => reply(500, { status: 500, code: 'ERR_00002', message: 'Internal error', correlationId: 'c9' }));
    const error = await failure(provider.issueDocument(INPUT));
    expect(error).toMatchObject({ retryable: true, code: 'ERR_00002', correlationId: 'c9' });
    expect(error.message).toContain('c9');
  });

  it('asks again later when Fiscomm cannot be reached', async () => {
    const { provider } = setup(() => Promise.reject(new TypeError('fetch failed')));
    expect(await failure(provider.issueDocument(INPUT))).toMatchObject({ retryable: true });
  });

  it('asks again later when the call times out', async () => {
    const { provider } = setup(() => Promise.reject(Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' })));
    expect(await failure(provider.issueDocument(INPUT))).toMatchObject({ retryable: true });
  });

  it('asks again later after a 429, and after an answer that is not JSON', async () => {
    expect(await failure(setup(() => reply(429, '')).provider.issueDocument(INPUT))).toMatchObject({ retryable: true });
    expect(await failure(setup(() => reply(200, '<html>maintenance</html>')).provider.issueDocument(INPUT))).toMatchObject({ retryable: true });
  });

  it('keeps asking when the key is refused: fixing the key moves the queue by itself', async () => {
    const { provider } = setup(() => reply(401, { status: 401, code: 'ERR_00101', message: 'Invalid key' }));
    expect(await failure(provider.issueDocument(INPUT))).toMatchObject({ retryable: true, code: 'ERR_00101' });
  });

  it('gives up on a request Fiscomm refuses on its merits, and says why', async () => {
    const { provider } = setup(() =>
      reply(400, {
        status: 400,
        code: 'ERR_00202',
        message: 'Validation failed',
        details: { validationErrors: [{ field: 'items.0.labels', message: 'must not be empty' }] },
        correlationId: 'c2',
      }),
    );
    const error = await failure(provider.issueDocument(INPUT));
    expect(error.retryable).toBe(false);
    expect(error.message).toContain('ERR_00202');
    expect(error.message).toContain('items.0.labels must not be empty');
  });

  it('gives up on a receipt the Tax Administration rejected, with its reason', async () => {
    const { provider } = setup(() =>
      reply(400, { status: 400, code: 'ERR_01010', message: 'Rejected', details: { pursRawResponse: { code: '2310', message: 'Tax label not allowed' } } }),
    );
    const error = await failure(provider.issueDocument(INPUT));
    expect(error.retryable).toBe(false);
    expect(error.message).toContain('Tax label not allowed');
  });

  it('asks again when the receipt came back without a number: it may exist, and the same order number returns it', async () => {
    const { provider } = setup(() => reply(201, { receipt: {} }));
    expect(await failure(provider.issueDocument(INPUT))).toMatchObject({ retryable: true });
  });

  it('never takes another receipt for ours: the order number already belongs to someone else', async () => {
    const { provider } = setup(() => reply(201, { receipt: echo({ metaFields: { source: 'rentaj', invoiceId: 'someone-elses', transactionId: 'tx-1' } }) }));
    const error = await failure(provider.issueDocument(INPUT));
    expect(error.retryable).toBe(false);
    expect(error.message).toContain('FISCOMM_ORDER_PREFIX');
  });
});

describe('FiscommProvider status', () => {
  const rates = { currentTaxRates: { taxCategories: [{ taxRates: [{ rate: 0, label: 'Г' }] }, { taxRates: [{ rate: 0, label: CYRILLIC_A }] }, { taxRates: [{ rate: 20, label: 'Ђ' }] }] } };

  it('names the company and shop behind the key and confirms the tax label exists', async () => {
    const { provider, fetchFn } = setup(() => reply(200, {}));
    fetchFn.mockResolvedValueOnce(reply(200, { companyName: 'Firma', shopName: 'Glavna' })).mockResolvedValueOnce(reply(200, rates));
    await expect(provider.status()).resolves.toMatchObject({ provider: 'fiscomm', invoiceType: 'training', ok: true, company: 'Firma', shop: 'Glavna' });
  });

  it('is not ok when the tax label is not one of the account\'s', async () => {
    const { provider, fetchFn } = setup(() => reply(200, {}), { ...OPTIONS, taxLabel: 'A' });
    fetchFn.mockResolvedValueOnce(reply(200, { companyName: 'Firma', shopName: 'Glavna' })).mockResolvedValueOnce(reply(200, rates));
    const status = await provider.status();
    expect(status.ok).toBe(false);
    expect(status.taxLabels).toEqual(['Г', CYRILLIC_A, 'Ђ']);
    expect(status.error).toContain('"A"');
  });

  it('reports a refused key instead of throwing', async () => {
    const { provider } = setup(() => reply(401, { code: 'ERR_00101', message: 'Invalid key' }));
    await expect(provider.status()).resolves.toMatchObject({ ok: false, error: expect.stringContaining('ERR_00101') });
  });
});
