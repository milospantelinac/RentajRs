import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ChargeCardInput, ChargeResult, PaymentProvider } from './payment-provider.interface';

/** Dev/default provider — simulates a Banca Intesa e-commerce charge without any real gateway. */
@Injectable()
export class MockPaymentProvider extends PaymentProvider {
  private readonly logger = new Logger(MockPaymentProvider.name);

  async chargeCard(input: ChargeCardInput): Promise<ChargeResult> {
    this.logger.log(`[MOCK] Charging ${input.amountRsd} RSD — ${input.description}`);
    return {
      success: true,
      externalTransactionId: `mock_txn_${randomUUID()}`,
    };
  }
}
