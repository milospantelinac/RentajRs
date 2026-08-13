"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var MockFiscalizationProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockFiscalizationProvider = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const fiscalization_provider_interface_1 = require("./fiscalization-provider.interface");
let MockFiscalizationProvider = MockFiscalizationProvider_1 = class MockFiscalizationProvider extends fiscalization_provider_interface_1.FiscalizationProvider {
    constructor() {
        super(...arguments);
        this.logger = new common_1.Logger(MockFiscalizationProvider_1.name);
        this.counter = 1;
    }
    async issueDocument(input) {
        const documentNumber = `MOCK-${new Date().getFullYear()}-${String(this.counter++).padStart(6, '0')}`;
        this.logger.log(`[MOCK] Issuing ${input.documentType} ${documentNumber} for ${input.amountRsd} RSD`);
        return {
            documentNumber,
            externalId: `mock_doc_${(0, crypto_1.randomUUID)()}`,
            pdfUrl: undefined,
        };
    }
};
exports.MockFiscalizationProvider = MockFiscalizationProvider;
exports.MockFiscalizationProvider = MockFiscalizationProvider = MockFiscalizationProvider_1 = __decorate([
    (0, common_1.Injectable)()
], MockFiscalizationProvider);
//# sourceMappingURL=mock-fiscalization.provider.js.map