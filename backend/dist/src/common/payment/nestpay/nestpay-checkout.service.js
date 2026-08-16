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
var NestPayCheckoutService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NestPayCheckoutService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const payment_settings_service_1 = require("./payment-settings.service");
const nestpay_hash_util_1 = require("./nestpay-hash.util");
const ascii_transliterate_1 = require("../../utils/ascii-transliterate");
const CURRENCY_NUMERIC_CODE = { RSD: '941', EUR: '978' };
let NestPayCheckoutService = NestPayCheckoutService_1 = class NestPayCheckoutService {
    constructor(settings) {
        this.settings = settings;
        this.logger = new common_1.Logger(NestPayCheckoutService_1.name);
    }
    async buildCheckoutForm(input) {
        const creds = await this.settings.getCredentials();
        const rnd = (0, crypto_1.randomBytes)(15).toString('base64').slice(0, 20);
        const amount = input.amountRsd.toFixed(2);
        const currencyCode = CURRENCY_NUMERIC_CODE[creds.currency] ?? CURRENCY_NUMERIC_CODE.RSD;
        const hash = (0, nestpay_hash_util_1.buildNestPayRequestHash)({
            clientId: creds.clientId,
            oid: input.oid,
            amount,
            okUrl: creds.okUrl,
            failUrl: creds.failUrl,
            trantype: creds.transactionType,
            installment: '',
            rnd,
            currency: currencyCode,
            storeKey: creds.storeKey,
        });
        const fields = {
            clientid: creds.clientId,
            storetype: '3d_pay_hosting',
            hash,
            hashAlgorithm: 'ver2',
            trantype: creds.transactionType,
            amount,
            currency: currencyCode,
            oid: input.oid,
            okUrl: creds.okUrl,
            failUrl: creds.failUrl,
            lang: 'en',
            rnd,
            encoding: 'utf-8',
            email: input.billing.email,
            BillToName: (0, ascii_transliterate_1.toNestPaySafeAscii)(`${input.billing.firstName} ${input.billing.lastName}`.trim()),
            description: (0, ascii_transliterate_1.toNestPaySafeAscii)(input.description),
        };
        if (input.billing.phone)
            fields.tel = input.billing.phone;
        if (creds.shopUrl)
            fields.shopurl = creds.shopUrl;
        if (input.billing.isCompany && input.billing.companyName) {
            fields.printBillTo = 'true';
            fields.BillToCompany = (0, ascii_transliterate_1.toNestPaySafeAscii)(input.billing.companyName);
            if (input.billing.companyAddress)
                fields.BillToStreet1 = (0, ascii_transliterate_1.toNestPaySafeAscii)(input.billing.companyAddress);
        }
        return { actionUrl: `${creds.apiEndpoint}/fim/est3dgate`, fields };
    }
    async verifyCallback(body) {
        const creds = await this.settings.getCredentials();
        const oid = body.oid || body.ReturnOid || '';
        const verification = (0, nestpay_hash_util_1.verifyNestPayResponseHash)(body, creds.storeKey);
        if (!verification.valid) {
            this.logger.warn(`NestPay callback hash verification failed: ${verification.reason} (oid=${oid})`);
            return { valid: false, reason: verification.reason, approved: false, oid };
        }
        if (body.clientid !== creds.clientId) {
            this.logger.warn(`NestPay callback clientid mismatch: got "${body.clientid}" (oid=${oid})`);
            return { valid: false, reason: 'clientid mismatch', approved: false, oid };
        }
        const approved = body.Response === 'Approved' && body.ProcReturnCode === '00';
        return {
            valid: true,
            approved,
            oid,
            procReturnCode: body.ProcReturnCode,
            errMsg: body.ErrMsg,
            authCode: body.AuthCode,
            hostRefNum: body.HostRefNum,
            transId: body.TransId,
            maskedPan: body.MaskedPan,
            cardBrand: body['EXTRA.CARDBRAND'],
        };
    }
};
exports.NestPayCheckoutService = NestPayCheckoutService;
exports.NestPayCheckoutService = NestPayCheckoutService = NestPayCheckoutService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [payment_settings_service_1.PaymentSettingsService])
], NestPayCheckoutService);
//# sourceMappingURL=nestpay-checkout.service.js.map