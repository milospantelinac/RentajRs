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
exports.AdjustPriceDto = exports.InitCheckoutDto = exports.CancelSubscriptionDto = exports.PurchaseFeaturedDto = exports.PurchaseSubscriptionDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
class PurchaseSubscriptionDto {
}
exports.PurchaseSubscriptionDto = PurchaseSubscriptionDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], PurchaseSubscriptionDto.prototype, "listingId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Buy a new subscription' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], PurchaseSubscriptionDto.prototype, "packageId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: client_1.BillingCycle }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.BillingCycle),
    __metadata("design:type", String)
], PurchaseSubscriptionDto.prototype, "billingCycle", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Attach to an existing Pro subscription with room instead of buying new' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], PurchaseSubscriptionDto.prototype, "existingSubscriptionId", void 0);
class PurchaseFeaturedDto {
}
exports.PurchaseFeaturedDto = PurchaseFeaturedDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], PurchaseFeaturedDto.prototype, "listingId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: [7, 15, 30] }),
    (0, class_validator_1.IsIn)([7, 15, 30]),
    __metadata("design:type", Number)
], PurchaseFeaturedDto.prototype, "durationDays", void 0);
class CancelSubscriptionDto {
}
exports.CancelSubscriptionDto = CancelSubscriptionDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CancelSubscriptionDto.prototype, "reason", void 0);
class InitCheckoutDto {
}
exports.InitCheckoutDto = InitCheckoutDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], InitCheckoutDto.prototype, "listingId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], InitCheckoutDto.prototype, "packageId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: client_1.BillingCycle }),
    (0, class_validator_1.IsEnum)(client_1.BillingCycle),
    __metadata("design:type", String)
], InitCheckoutDto.prototype, "billingCycle", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], InitCheckoutDto.prototype, "firstName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], InitCheckoutDto.prototype, "lastName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], InitCheckoutDto.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], InitCheckoutDto.prototype, "phone", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '"Želim račun na firmu (Pravno lice)"' }),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], InitCheckoutDto.prototype, "isCompany", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], InitCheckoutDto.prototype, "taxId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], InitCheckoutDto.prototype, "registrationNumber", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], InitCheckoutDto.prototype, "companyName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], InitCheckoutDto.prototype, "companyAddress", void 0);
class AdjustPriceDto {
}
exports.AdjustPriceDto = AdjustPriceDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], AdjustPriceDto.prototype, "priceMonthlyRsd", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], AdjustPriceDto.prototype, "priceYearlyRsd", void 0);
//# sourceMappingURL=subscriptions.dto.js.map