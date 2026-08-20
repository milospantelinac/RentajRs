import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PaymentSettingsService } from './payment-settings.service';
import { buildNestPayRequestHash, verifyNestPayResponseHash } from './nestpay-hash.util';
import { toNestPaySafeAscii } from '../../utils/ascii-transliterate';

// ISO 4217 numeric currency codes — NestPay's `currency` field wants the
// number, not the ISO alpha code the rest of the app (and the admin UI) uses.
const CURRENCY_NUMERIC_CODE: Record<string, string> = { RSD: '941', EUR: '978' };

export interface BuildCheckoutFormInput {
  oid: string; // our Subscription.id — see subscriptions.service.ts checkout flow
  amountRsd: number;
  billing: {
    email: string;
    phone?: string;
    firstName: string;
    lastName: string;
    isCompany: boolean;
    companyName?: string;
    companyAddress?: string;
  };
  description: string;
}

export interface NestPayCallbackResult {
  valid: boolean;
  reason?: string;
  approved: boolean;
  oid: string;
  procReturnCode?: string;
  errMsg?: string;
  authCode?: string;
  hostRefNum?: string;
  transId?: string;
  maskedPan?: string;
  cardBrand?: string;
}

@Injectable()
export class NestPayCheckoutService {
  private readonly logger = new Logger(NestPayCheckoutService.name);

  constructor(private settings: PaymentSettingsService) {}

  async buildCheckoutForm(input: BuildCheckoutFormInput) {
    const creds = await this.settings.getCredentials();
    const rnd = randomBytes(15).toString('base64').slice(0, 20);
    const amount = input.amountRsd.toFixed(2);
    const currencyCode = CURRENCY_NUMERIC_CODE[creds.currency] ?? CURRENCY_NUMERIC_CODE.RSD;

    const hash = buildNestPayRequestHash({
      clientId: creds.clientId,
      oid: input.oid,
      amount,
      okUrl: creds.okUrl,
      failUrl: creds.failUrl,
      trantype: creds.transactionType,
      installment: '',
      rnd,
      currency: currencyCode,
      storeKey: creds.storeKey,
    });

    const fields: Record<string, string> = {
      clientid: creds.clientId,
      storetype: '3d_pay_hosting',
      hash,
      hashAlgorithm: 'ver2',
      trantype: creds.transactionType,
      amount,
      currency: currencyCode,
      oid: input.oid,
      okUrl: creds.okUrl,
      failUrl: creds.failUrl,
      lang: 'en',
      rnd,
      encoding: 'utf-8',
      email: input.billing.email,
      BillToName: toNestPaySafeAscii(`${input.billing.firstName} ${input.billing.lastName}`.trim()),
      description: toNestPaySafeAscii(input.description),
    };
    if (input.billing.phone) fields.tel = input.billing.phone;
    if (creds.shopUrl) fields.shopurl = creds.shopUrl;
    if (input.billing.isCompany && input.billing.companyName) {
      fields.printBillTo = 'true';
      fields.BillToCompany = toNestPaySafeAscii(input.billing.companyName);
      if (input.billing.companyAddress) fields.BillToStreet1 = toNestPaySafeAscii(input.billing.companyAddress);
    }

    // Casing matters — NestPay's gateway host treats the path as
    // case-sensitive; the old WooCommerce plugin (wc-nestpay-bib) that
    // works in production hits "/fim/est3Dgate" (capital D), confirmed
    // against a real browser redirect. Lowercase silently fails to reach
    // the card-entry screen.
    return { actionUrl: `${creds.apiEndpoint}/fim/est3Dgate`, fields };
  }

  /**
   * Validates a NestPay okUrl/failUrl POST. Trust nothing about `body` until
   * the hash checks out — anyone can POST arbitrary fields to these public
   * callback URLs, so the hash (computed with our own storeKey, never sent
   * to the browser) is the only thing that actually proves NestPay sent it.
   */
  async verifyCallback(body: Record<string, string>): Promise<NestPayCallbackResult> {
    const creds = await this.settings.getCredentials();
    const oid = body.oid || body.ReturnOid || '';

    const verification = verifyNestPayResponseHash(body, creds.storeKey);
    if (!verification.valid) {
      this.logger.warn(`NestPay callback hash verification failed: ${verification.reason} (oid=${oid})`);
      return { valid: false, reason: verification.reason, approved: false, oid };
    }
    if (body.clientid !== creds.clientId) {
      this.logger.warn(`NestPay callback clientid mismatch: got "${body.clientid}" (oid=${oid})`);
      return { valid: false, reason: 'clientid mismatch', approved: false, oid };
    }

    const approved = body.Response === 'Approved' && body.ProcReturnCode === '00';
    return {
      valid: true,
      approved,
      oid,
      procReturnCode: body.ProcReturnCode,
      errMsg: body.ErrMsg,
      authCode: body.AuthCode,
      hostRefNum: body.HostRefNum,
      transId: body.TransId,
      maskedPan: body.MaskedPan,
      cardBrand: body['EXTRA.CARDBRAND'],
    };
  }
}
