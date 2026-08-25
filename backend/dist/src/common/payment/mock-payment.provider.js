"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var MockPaymentProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockPaymentProvider = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const payment_provider_interface_1 = require("./payment-provider.interface");
let MockPaymentProvider = MockPaymentProvider_1 = class MockPaymentProvider extends payment_provider_interface_1.PaymentProvider {
    constructor() {
        super(...arguments);
        this.logger = new common_1.Logger(MockPaymentProvider_1.name);
    }
    async chargeCard(input) {
        this.logger.log(`[MOCK] Charging ${input.amountRsd} RSD — ${input.description}`);
        return {
            success: true,
            externalTransactionId: `mock_txn_${(0, crypto_1.randomUUID)()}`,
        };
    }
};
exports.MockPaymentProvider = MockPaymentProvider;
exports.MockPaymentProvider = MockPaymentProvider = MockPaymentProvider_1 = __decorate([
    (0, common_1.Injectable)()
], MockPaymentProvider);
//# sourceMappingURL=mock-payment.provider.js.map