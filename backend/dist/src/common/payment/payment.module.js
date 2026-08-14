"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentModule = void 0;
const common_1 = require("@nestjs/common");
const payment_provider_interface_1 = require("./payment-provider.interface");
const mock_payment_provider_1 = require("./mock-payment.provider");
const payment_settings_service_1 = require("./nestpay/payment-settings.service");
const nestpay_checkout_service_1 = require("./nestpay/nestpay-checkout.service");
let PaymentModule = class PaymentModule {
};
exports.PaymentModule = PaymentModule;
exports.PaymentModule = PaymentModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        providers: [{ provide: payment_provider_interface_1.PaymentProvider, useClass: mock_payment_provider_1.MockPaymentProvider }, payment_settings_service_1.PaymentSettingsService, nestpay_checkout_service_1.NestPayCheckoutService],
        exports: [payment_provider_interface_1.PaymentProvider, payment_settings_service_1.PaymentSettingsService, nestpay_checkout_service_1.NestPayCheckoutService],
    })
], PaymentModule);
//# sourceMappingURL=payment.module.js.map