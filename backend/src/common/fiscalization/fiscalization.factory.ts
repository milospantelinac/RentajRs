import { Logger } from '@nestjs/common';
import { FiscalizationProvider } from './fiscalization-provider.interface';
import { FiscommProvider } from './fiscomm.provider';
import { MockFiscalizationProvider } from './mock-fiscalization.provider';

/** The `fiscalization` block of config/configuration.ts. */
export interface FiscalizationSettings {
  provider: string;
  fiscomm: {
    apiKey?: string;
    baseUrl: string;
    invoiceType?: string;
    taxLabel: string;
    orderPrefix: string;
    timeoutMs: number;
  };
}

/**
 * The provider is configuration. A setting that cannot work stops the backend
 * from starting, with the reason: quietly falling back to the placeholder
 * would put made-up receipt numbers in front of real customers.
 */
export function createFiscalizationProvider(settings: FiscalizationSettings, fetchFn?: typeof fetch): FiscalizationProvider {
  const mock = new MockFiscalizationProvider();
  if (settings.provider === 'mock') return mock;
  if (settings.provider !== 'fiscomm') {
    throw new Error(`FISCALIZATION_PROVIDER must be "mock" or "fiscomm", not "${settings.provider}"`);
  }

  const { apiKey, invoiceType, baseUrl, taxLabel, timeoutMs } = settings.fiscomm;
  if (!apiKey) throw new Error('FISCALIZATION_PROVIDER=fiscomm needs FISCOMM_API_KEY');
  // No default on purpose: "training" receipts are not fiscal and "normal" ones are
  // legal documents, so which one a server issues is always a decision.
  if (invoiceType !== 'training' && invoiceType !== 'normal') {
    throw new Error('FISCALIZATION_PROVIDER=fiscomm needs FISCOMM_INVOICE_TYPE=training (not fiscal) or FISCOMM_INVOICE_TYPE=normal (legal receipts)');
  }

  new Logger('Fiscalization').log(`Fiscal receipts through Fiscomm (${baseUrl}), type "${invoiceType}"${invoiceType === 'training' ? ': NOT fiscal documents' : ''}`);
  return new FiscommProvider({ apiKey, baseUrl, invoiceType, taxLabel, timeoutMs }, mock, fetchFn);
}
