import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { FiscalizationProvider, IssueDocumentInput, IssueDocumentResult } from './fiscalization-provider.interface';

@Injectable()
export class MockFiscalizationProvider extends FiscalizationProvider {
  private readonly logger = new Logger(MockFiscalizationProvider.name);
  private counter = 1;

  async issueDocument(input: IssueDocumentInput): Promise<IssueDocumentResult> {
    const documentNumber = `MOCK-${new Date().getFullYear()}-${String(this.counter++).padStart(6, '0')}`;
    this.logger.log(`[MOCK] Issuing ${input.documentType} ${documentNumber} for ${input.amountRsd} RSD`);
    return {
      documentNumber,
      externalId: `mock_doc_${randomUUID()}`,
      pdfUrl: undefined, // no real PDF generation in the mock provider
    };
  }
}
