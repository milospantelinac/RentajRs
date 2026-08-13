import { Global, Module } from '@nestjs/common';
import { PaymentProvider } from './payment-provider.interface';
import { MockPaymentProvider } from './mock-payment.provider';

@Global()
@Module({
  providers: [{ provide: PaymentProvider, useClass: MockPaymentProvider }],
  exports: [PaymentProvider],
})
export class PaymentModule {}
