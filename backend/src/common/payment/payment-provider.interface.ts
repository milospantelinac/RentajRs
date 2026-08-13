export interface ChargeCardInput {
  amountRsd: number;
  description: string;
  cardToken?: string; // present when charging a previously-tokenized card (renewal)
}

export interface ChargeResult {
  success: boolean;
  externalTransactionId: string;
  cardToken?: string; // returned on first charge, stored for future renewals
  errorMessage?: string;
}

/**
 * O22 in the Product Bible: card tokenization + recurring charges with Banca
 * Intesa is an *external* risk the doc explicitly says must be confirmed
 * before launch, not something code can resolve. This interface is the seam
 * — swap MockPaymentProvider for a real BancaIntesaProvider once that
 * integration is contracted, without touching SubscriptionsService.
 */
export abstract class PaymentProvider {
  abstract chargeCard(input: ChargeCardInput): Promise<ChargeResult>;
}
