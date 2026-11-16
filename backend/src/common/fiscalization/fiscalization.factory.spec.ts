import { Logger } from '@nestjs/common';
import { createFiscalizationProvider } from './fiscalization.factory';
import { FiscommProvider } from './fiscomm.provider';
import { MockFiscalizationProvider } from './mock-fiscalization.provider';

const fiscomm = {
  apiKey: 'a-key',
  baseUrl: 'https://api.fiscomm.rs',
  invoiceType: 'training' as string | undefined,
  taxLabel: 'А',
  orderPrefix: 'RNT-',
  timeoutMs: 15000,
};

beforeEach(() => jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined));
afterEach(() => jest.restoreAllMocks());

describe('createFiscalizationProvider', () => {
  it('is the placeholder by default: development needs no account', () => {
    expect(createFiscalizationProvider({ provider: 'mock', fiscomm: { ...fiscomm, apiKey: undefined, invoiceType: undefined } })).toBeInstanceOf(
      MockFiscalizationProvider,
    );
  });

  it('is Fiscomm when asked, with a key and a receipt type', () => {
    expect(createFiscalizationProvider({ provider: 'fiscomm', fiscomm })).toBeInstanceOf(FiscommProvider);
    expect(createFiscalizationProvider({ provider: 'fiscomm', fiscomm: { ...fiscomm, invoiceType: 'normal' } })).toBeInstanceOf(FiscommProvider);
  });

  it('refuses to start without a key', () => {
    expect(() => createFiscalizationProvider({ provider: 'fiscomm', fiscomm: { ...fiscomm, apiKey: undefined } })).toThrow('FISCOMM_API_KEY');
  });

  it('refuses to start without a receipt type: there is no default, training and legal receipts are a decision', () => {
    expect(() => createFiscalizationProvider({ provider: 'fiscomm', fiscomm: { ...fiscomm, invoiceType: undefined } })).toThrow('FISCOMM_INVOICE_TYPE');
    expect(() => createFiscalizationProvider({ provider: 'fiscomm', fiscomm: { ...fiscomm, invoiceType: 'proforma' } })).toThrow('FISCOMM_INVOICE_TYPE');
  });

  it('refuses a provider it does not know, instead of quietly using the placeholder', () => {
    expect(() => createFiscalizationProvider({ provider: 'sparkom', fiscomm })).toThrow('"mock" or "fiscomm"');
  });
});
