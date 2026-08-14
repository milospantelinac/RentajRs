import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { decryptSecret, encryptSecret } from '../../utils/secret-crypto';
import { UpdatePaymentSettingsDto } from './dto/payment-settings.dto';

const SINGLETON_ID = 'default';
// Returned by getMasked() in place of a real secret, and recognized by
// update() as "leave the stored value alone" — never a value NestPay would
// actually accept, so it can't be mistaken for a real (if weak) secret.
export const MASKED_SECRET_PLACEHOLDER = '••••••••';

export interface NestPayCredentials {
  clientId: string;
  storeKey: string;
  apiUsername: string;
  apiPassword: string;
  okUrl: string;
  failUrl: string;
  shopUrl: string;
  apiEndpoint: string;
  transactionType: string;
  currency: string;
  testMode: boolean;
  merchantName: string | null;
  merchantTaxId: string | null;
  merchantAddress: string | null;
}

@Injectable()
export class PaymentSettingsService {
  constructor(private prisma: PrismaService) {}

  /** Decrypted, ready to use for actual NestPay requests — never expose this shape to the frontend. */
  async getCredentials(): Promise<NestPayCredentials> {
    const row = await this.ensureRow();
    return {
      clientId: row.clientId,
      storeKey: row.storeKeyEncrypted ? decryptSecret(row.storeKeyEncrypted) : '',
      apiUsername: row.apiUsername,
      apiPassword: row.apiPasswordEncrypted ? decryptSecret(row.apiPasswordEncrypted) : '',
      okUrl: row.okUrl,
      failUrl: row.failUrl,
      shopUrl: row.shopUrl,
      apiEndpoint: row.apiEndpoint,
      transactionType: row.transactionType,
      currency: row.currency,
      testMode: row.testMode,
      merchantName: row.merchantName,
      merchantTaxId: row.merchantTaxId,
      merchantAddress: row.merchantAddress,
    };
  }

  /** For the admin UI — secrets are never sent as plaintext, only whether one is set. */
  async getMasked() {
    const row = await this.ensureRow();
    return {
      clientId: row.clientId,
      storeKey: row.storeKeyEncrypted ? MASKED_SECRET_PLACEHOLDER : '',
      apiUsername: row.apiUsername,
      apiPassword: row.apiPasswordEncrypted ? MASKED_SECRET_PLACEHOLDER : '',
      okUrl: row.okUrl,
      failUrl: row.failUrl,
      shopUrl: row.shopUrl,
      apiEndpoint: row.apiEndpoint,
      transactionType: row.transactionType,
      currency: row.currency,
      testMode: row.testMode,
      merchantName: row.merchantName,
      merchantTaxId: row.merchantTaxId,
      merchantAddress: row.merchantAddress,
      updatedAt: row.updatedAt,
    };
  }

  async update(dto: UpdatePaymentSettingsDto) {
    await this.ensureRow();

    const data: Record<string, unknown> = {};
    if (dto.clientId !== undefined) data.clientId = dto.clientId;
    if (dto.apiUsername !== undefined) data.apiUsername = dto.apiUsername;
    if (dto.okUrl !== undefined) data.okUrl = dto.okUrl;
    if (dto.failUrl !== undefined) data.failUrl = dto.failUrl;
    if (dto.shopUrl !== undefined) data.shopUrl = dto.shopUrl;
    if (dto.apiEndpoint !== undefined) data.apiEndpoint = dto.apiEndpoint;
    if (dto.transactionType !== undefined) data.transactionType = dto.transactionType;
    if (dto.currency !== undefined) data.currency = dto.currency;
    if (dto.testMode !== undefined) data.testMode = dto.testMode;
    if (dto.merchantName !== undefined) data.merchantName = dto.merchantName;
    if (dto.merchantTaxId !== undefined) data.merchantTaxId = dto.merchantTaxId;
    if (dto.merchantAddress !== undefined) data.merchantAddress = dto.merchantAddress;

    // Only overwrite a secret when a real, new value was actually sent —
    // omitted or echoed-back-masked both mean "leave it alone".
    if (dto.storeKey !== undefined && dto.storeKey !== MASKED_SECRET_PLACEHOLDER && dto.storeKey !== '') {
      data.storeKeyEncrypted = encryptSecret(dto.storeKey);
    }
    if (dto.apiPassword !== undefined && dto.apiPassword !== MASKED_SECRET_PLACEHOLDER && dto.apiPassword !== '') {
      data.apiPasswordEncrypted = encryptSecret(dto.apiPassword);
    }

    await this.prisma.paymentSettings.update({ where: { id: SINGLETON_ID }, data });
    return this.getMasked();
  }

  private async ensureRow() {
    return this.prisma.paymentSettings.upsert({
      where: { id: SINGLETON_ID },
      update: {},
      create: { id: SINGLETON_ID },
    });
  }
}
