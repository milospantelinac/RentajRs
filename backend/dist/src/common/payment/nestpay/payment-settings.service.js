"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentSettingsService = exports.MASKED_SECRET_PLACEHOLDER = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../prisma/prisma.service");
const secret_crypto_1 = require("../../utils/secret-crypto");
const SINGLETON_ID = 'default';
exports.MASKED_SECRET_PLACEHOLDER = '••••••••';
let PaymentSettingsService = class PaymentSettingsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getCredentials() {
        const row = await this.ensureRow();
        return {
            clientId: row.clientId,
            storeKey: row.storeKeyEncrypted ? (0, secret_crypto_1.decryptSecret)(row.storeKeyEncrypted) : '',
            apiUsername: row.apiUsername,
            apiPassword: row.apiPasswordEncrypted ? (0, secret_crypto_1.decryptSecret)(row.apiPasswordEncrypted) : '',
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
    async getMasked() {
        const row = await this.ensureRow();
        return {
            clientId: row.clientId,
            storeKey: row.storeKeyEncrypted ? exports.MASKED_SECRET_PLACEHOLDER : '',
            apiUsername: row.apiUsername,
            apiPassword: row.apiPasswordEncrypted ? exports.MASKED_SECRET_PLACEHOLDER : '',
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
    async update(dto) {
        await this.ensureRow();
        const data = {};
        if (dto.clientId !== undefined)
            data.clientId = dto.clientId;
        if (dto.apiUsername !== undefined)
            data.apiUsername = dto.apiUsername;
        if (dto.okUrl !== undefined)
            data.okUrl = dto.okUrl;
        if (dto.failUrl !== undefined)
            data.failUrl = dto.failUrl;
        if (dto.shopUrl !== undefined)
            data.shopUrl = dto.shopUrl;
        if (dto.apiEndpoint !== undefined)
            data.apiEndpoint = dto.apiEndpoint;
        if (dto.transactionType !== undefined)
            data.transactionType = dto.transactionType;
        if (dto.currency !== undefined)
            data.currency = dto.currency;
        if (dto.testMode !== undefined)
            data.testMode = dto.testMode;
        if (dto.merchantName !== undefined)
            data.merchantName = dto.merchantName;
        if (dto.merchantTaxId !== undefined)
            data.merchantTaxId = dto.merchantTaxId;
        if (dto.merchantAddress !== undefined)
            data.merchantAddress = dto.merchantAddress;
        if (dto.storeKey !== undefined && dto.storeKey !== exports.MASKED_SECRET_PLACEHOLDER && dto.storeKey !== '') {
            data.storeKeyEncrypted = (0, secret_crypto_1.encryptSecret)(dto.storeKey);
        }
        if (dto.apiPassword !== undefined && dto.apiPassword !== exports.MASKED_SECRET_PLACEHOLDER && dto.apiPassword !== '') {
            data.apiPasswordEncrypted = (0, secret_crypto_1.encryptSecret)(dto.apiPassword);
        }
        await this.prisma.paymentSettings.update({ where: { id: SINGLETON_ID }, data });
        return this.getMasked();
    }
    async ensureRow() {
        return this.prisma.paymentSettings.upsert({
            where: { id: SINGLETON_ID },
            update: {},
            create: { id: SINGLETON_ID },
        });
    }
};
exports.PaymentSettingsService = PaymentSettingsService;
exports.PaymentSettingsService = PaymentSettingsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PaymentSettingsService);
//# sourceMappingURL=payment-settings.service.js.map