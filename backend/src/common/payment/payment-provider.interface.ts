export interface ChargeCardInput {
  amountRsd: number;
  description: string;
}

export interface ChargeResult {
  success: boolean;
  externalTransactionId: string;
  errorMessage?: string;
}

/**
 * Subscriptions never auto-renew (O22 in the Product Bible ruled out card
 * tokenization/recurring charges with Banca Intesa — the real NestPay
 * integration is a one-time 3D Pay Hosting checkout, see
 * NestPayCheckoutService). This interface covers only one-off charges
 * (initial individual purchase, featured listings) — the seam lets
 * MockPaymentProvider be swapped for a real provider later without touching
 * the callers.
 */
export abstract class PaymentProvider {
  abstract chargeCard(input: ChargeCardInput): Promise<ChargeResult>;
}
