export interface IssueDocumentInput {
  documentType: 'FISCAL_RECEIPT' | 'E_INVOICE' | 'PRO_FORMA';
  amountRsd: number;
  /** A fiscal receipt has no field for it; kept for documents that do carry the buyer's name. */
  buyerName?: string;
  /** PIB of a company buyer: it becomes the buyer's ID on the fiscal receipt. */
  buyerTaxId?: string;
  description: string;
  /**
   * Our own number for the document. For a fiscal receipt it is the key that
   * makes a retry return the receipt that already exists instead of a second one.
   */
  orderNumber?: string;
  /**
   * Our own ids. They are kept on the document at the provider and echoed back,
   * which is how a returned receipt is checked to be the one that was asked for.
   */
  reference?: Record<string, string>;
}

export interface IssueDocumentResult {
  documentNumber: string;
  externalId: string;
  pdfUrl?: string;
  /** Where the customer can check the receipt with the Tax Administration. */
  verificationUrl?: string;
  invoiceCounter?: string;
  /** The Tax Administration's own time of the receipt. */
  issuedAt?: Date;
}

/** What the admin page shows about the connection to the provider. */
export interface FiscalizationStatus {
  provider: 'mock' | 'fiscomm';
  /** Fiscomm only: `training` receipts are not fiscal, `normal` ones are. */
  invoiceType?: 'training' | 'normal';
  ok: boolean;
  company?: string;
  shop?: string;
  taxLabel?: string;
  /** The labels the account offers, so a wrong FISCOMM_TAX_LABEL is seen before a customer pays. */
  taxLabels?: string[];
  error?: string;
}

/** What went wrong at the provider, and whether asking again can help. */
export class FiscalizationError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly code?: string,
    readonly correlationId?: string,
  ) {
    super(message);
    this.name = 'FiscalizationError';
  }
}

/**
 * Fiscal receipts come from Fiscomm (FiscommProvider). O23 in the Product Bible
 * left e-Invoice/SEF open; nothing here issues one, so a pro forma or an
 * e-invoice still gets a placeholder number from the mock. Same seam pattern
 * as PaymentProvider, and the mock stays the default for development.
 */
export abstract class FiscalizationProvider {
  abstract issueDocument(input: IssueDocumentInput): Promise<IssueDocumentResult>;
  abstract status(): Promise<FiscalizationStatus>;
}
