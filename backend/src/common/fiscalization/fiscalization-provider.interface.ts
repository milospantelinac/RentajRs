export interface IssueDocumentInput {
  documentType: 'FISCAL_RECEIPT' | 'E_INVOICE' | 'PRO_FORMA';
  amountRsd: number;
  buyerName: string;
  buyerTaxId?: string; // PIB, required for E_INVOICE
  description: string;
}

export interface IssueDocumentResult {
  documentNumber: string;
  externalId: string;
  pdfUrl?: string;
}

/**
 * O23 in the Product Bible: whether Sparkom VP covers e-Invoice/SEF is
 * another external risk flagged as needing confirmation before launch. Same
 * seam pattern as PaymentProvider — swap in a real SparkomVpProvider later.
 */
export abstract class FiscalizationProvider {
  abstract issueDocument(input: IssueDocumentInput): Promise<IssueDocumentResult>;
}
