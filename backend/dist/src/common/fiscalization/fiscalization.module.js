"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FiscalizationModule = void 0;
const common_1 = require("@nestjs/common");
const fiscalization_provider_interface_1 = require("./fiscalization-provider.interface");
const mock_fiscalization_provider_1 = require("./mock-fiscalization.provider");
let FiscalizationModule = class FiscalizationModule {
};
exports.FiscalizationModule = FiscalizationModule;
exports.FiscalizationModule = FiscalizationModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        providers: [{ provide: fiscalization_provider_interface_1.FiscalizationProvider, useClass: mock_fiscalization_provider_1.MockFiscalizationProvider }],
        exports: [fiscalization_provider_interface_1.FiscalizationProvider],
    })
], FiscalizationModule);
//# sourceMappingURL=fiscalization.module.js.map