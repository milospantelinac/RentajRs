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
exports.UpdateListingDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const undefined_if_blank_transform_1 = require("../../../common/validators/undefined-if-blank.transform");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
class MandatoryFeeDto {
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], MandatoryFeeDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], MandatoryFeeDto.prototype, "amount", void 0);
class UpdateListingDto {
}
exports.UpdateListingDto = UpdateListingDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: client_1.BookingModel }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.BookingModel),
    __metadata("design:type", String)
], UpdateListingDto.prototype, "bookingModel", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: client_1.SlotSubmode }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.SlotSubmode),
    __metadata("design:type", String)
], UpdateListingDto.prototype, "slotSubmode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], UpdateListingDto.prototype, "title", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(5000),
    __metadata("design:type", String)
], UpdateListingDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], UpdateListingDto.prototype, "keywords", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUrl)(),
    __metadata("design:type", String)
], UpdateListingDto.prototype, "videoUrl", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: client_1.PriceUnit }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.PriceUnit),
    __metadata("design:type", String)
], UpdateListingDto.prototype, "priceUnit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Price in RSD (whole dinars; converted to para internally)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateListingDto.prototype, "price", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateListingDto.prototype, "weekendPrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateListingDto.prototype, "pricePerGuest", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [MandatoryFeeDto] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => MandatoryFeeDto),
    __metadata("design:type", Array)
], UpdateListingDto.prototype, "mandatoryFees", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: client_1.PaymentMethod }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.PaymentMethod),
    __metadata("design:type", String)
], UpdateListingDto.prototype, "paymentMethod", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'null/omitted = full amount due' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], UpdateListingDto.prototype, "advancePercent", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 12, maximum: 168 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(12),
    (0, class_validator_1.Max)(168),
    __metadata("design:type", Number)
], UpdateListingDto.prototype, "paymentDeadlineHours", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'R52 — false sends the IPS QR immediately, true requires the owner to approve first' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateListingDto.prototype, "requiresApproval", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], UpdateListingDto.prototype, "minDuration", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], UpdateListingDto.prototype, "maxDuration", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], UpdateListingDto.prototype, "minGuests", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], UpdateListingDto.prototype, "maxGuests", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateListingDto.prototype, "gapAfterMinutes", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '14:00' }),
    (0, class_validator_1.IsOptional)(),
    undefined_if_blank_transform_1.undefinedIfBlank,
    (0, class_validator_1.Matches)(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'validation.TIME_INVALID' }),
    __metadata("design:type", String)
], UpdateListingDto.prototype, "pickupTime", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '11:00' }),
    (0, class_validator_1.IsOptional)(),
    undefined_if_blank_transform_1.undefinedIfBlank,
    (0, class_validator_1.Matches)(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'validation.TIME_INVALID' }),
    __metadata("design:type", String)
], UpdateListingDto.prototype, "returnTime", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateListingDto.prototype, "earliestBookingHours", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '"Koliko kasno može da se rezerviše" — max days into the future a booking may start' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], UpdateListingDto.prototype, "maxAdvanceBookingDays", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: client_1.CancellationPolicyType }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.CancellationPolicyType),
    __metadata("design:type", String)
], UpdateListingDto.prototype, "cancellationPolicyType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Days if FREE_UNTIL_DAYS, hours if FREE_UNTIL_HOURS — required together with cancellationPolicyType for those two values' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], UpdateListingDto.prototype, "cancellationThreshold", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateListingDto.prototype, "available", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateListingDto.prototype, "wizardStep", void 0);
//# sourceMappingURL=update-listing.dto.js.map