import { isValidPib, normalizePib } from '../utils/pib';
import {
  FiscalizationError,
  FiscalizationProvider,
  FiscalizationStatus,
  IssueDocumentInput,
  IssueDocumentResult,
} from './fiscalization-provider.interface';
import { FiscommClient } from './fiscomm.client';

export interface FiscommOptions {
  apiKey: string;
  baseUrl: string;
  /** `training` receipts are not fiscal; only `normal` ones are legal documents. */
  invoiceType: 'training' | 'normal';
  /** The tax label printed on the receipt. Rentaj is outside the VAT system: Cyrillic "А" (U+0410), 0%. */
  taxLabel: string;
  timeoutMs: number;
}

interface FiscommReceipt {
  invoiceNumber?: string;
  invoiceCounter?: string;
  sdcDateTime?: string;
  verificationUrl?: string;
  invoicePdfUrl?: string;
  metaFields?: Record<string, unknown>;
}

interface TaxRatesResponse {
  currentTaxRates?: { taxCategories?: { taxRates?: { label?: string }[] }[] };
}

/** Buyer ID type 10 is a PIB (api.fiscomm.rs: buyerId is "type:identifier"). */
const BUYER_ID_PIB = '10';

/**
 * Fiscal receipts through Fiscomm (api.fiscomm.rs): one sale, paid by card.
 *
 * - `orderNumber` and `returnIfOrderNumberExists` make every call safe to
 *   repeat: a lost answer is asked for again and returns the same receipt.
 * - The ids we send in `metaFields` come back on the receipt. If they are not
 *   ours, the order number was already used by something else (another
 *   environment on the same shop) and nothing is taken for ours.
 * - Only fiscal receipts are Fiscomm's. A pro forma or an e-invoice goes to the
 *   placeholder provider, as before.
 */
export class FiscommProvider extends FiscalizationProvider {
  private readonly client: FiscommClient;

  constructor(
    private readonly options: FiscommOptions,
    private readonly placeholder: FiscalizationProvider,
    fetchFn?: typeof fetch,
  ) {
    super();
    this.client = new FiscommClient(options, fetchFn);
  }

  async issueDocument(input: IssueDocumentInput): Promise<IssueDocumentResult> {
    if (input.documentType !== 'FISCAL_RECEIPT') return this.placeholder.issueDocument(input);
    if (!input.orderNumber) throw new FiscalizationError('A fiscal receipt needs an order number', false);

    // The check digit is verified before it goes out: a PIB the Tax Administration would
    // refuse must not hold the receipt back, so it is left off and the receipt still exists.
    const buyerId = input.buyerTaxId && isValidPib(input.buyerTaxId) ? `${BUYER_ID_PIB}:${normalizePib(input.buyerTaxId)}` : undefined;

    const { receipt } = await this.client.request<{ correlationId?: string; receipt?: FiscommReceipt }>(
      'POST',
      `/receipt/${this.options.invoiceType}/sale`,
      {
        orderNumber: input.orderNumber,
        ...(buyerId ? { buyerId } : {}),
        items: [
          {
            name: input.description,
            quantity: 1,
            unitPrice: input.amountRsd,
            totalAmount: input.amountRsd,
            labels: [this.options.taxLabel],
          },
        ],
        payments: [{ type: 'card', amount: input.amountRsd }],
        // Our ids only: no name, no email, nothing personal is stored at Fiscomm.
        metaFields: { source: 'rentaj', ...(input.reference ?? {}) },
        settings: { returnIfOrderNumberExists: true },
      },
    );

    if (!receipt?.invoiceNumber) {
      // The receipt may well exist; asking again with the same order number returns it.
      throw new FiscalizationError('Fiscomm answered without a receipt number', true);
    }
    for (const [key, expected] of Object.entries(input.reference ?? {})) {
      if (receipt.metaFields?.[key] !== expected) {
        throw new FiscalizationError(
          `Order number ${input.orderNumber} already belongs to another receipt at Fiscomm (${key} differs); change FISCOMM_ORDER_PREFIX for this environment`,
          false,
        );
      }
    }

    return {
      documentNumber: receipt.invoiceNumber,
      externalId: receipt.invoiceNumber,
      pdfUrl: receipt.invoicePdfUrl || undefined,
      verificationUrl: receipt.verificationUrl || undefined,
      invoiceCounter: receipt.invoiceCounter || undefined,
      issuedAt: receipt.sdcDateTime ? new Date(receipt.sdcDateTime) : undefined,
    };
  }

  async status(): Promise<FiscalizationStatus> {
    const base = { provider: 'fiscomm' as const, invoiceType: this.options.invoiceType, taxLabel: this.options.taxLabel };
    try {
      const me = await this.client.request<{ companyName?: string; shopName?: string }>('GET', '/auth/api-key/me');
      const rates = await this.client.request<TaxRatesResponse>('GET', '/receipt/tax-rates');
      const taxLabels = (rates.currentTaxRates?.taxCategories ?? []).flatMap((category) =>
        (category.taxRates ?? []).map((rate) => rate.label ?? '').filter(Boolean),
      );
      const known = taxLabels.includes(this.options.taxLabel);
      return {
        ...base,
        ok: known,
        company: me.companyName,
        shop: me.shopName,
        taxLabels,
        error: known ? undefined : `The tax label "${this.options.taxLabel}" is not one of the account's labels`,
      };
    } catch (err) {
      return { ...base, ok: false, error: (err as Error).message };
    }
  }
}
