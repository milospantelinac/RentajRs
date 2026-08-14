import { Global, Module } from '@nestjs/common';
import { PaymentProvider } from './payment-provider.interface';
import { MockPaymentProvider } from './mock-payment.provider';
import { PaymentSettingsService } from './nestpay/payment-settings.service';
import { NestPayCheckoutService } from './nestpay/nestpay-checkout.service';

@Global()
@Module({
  providers: [{ provide: PaymentProvider, useClass: MockPaymentProvider }, PaymentSettingsService, NestPayCheckoutService],
  exports: [PaymentProvider, PaymentSettingsService, NestPayCheckoutService],
})
export class PaymentModule {}
