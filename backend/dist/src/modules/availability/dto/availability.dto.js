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
exports.AddIcalSourceDto = exports.SetDatePriceDto = exports.CreateManualBlockDto = exports.CreateDefinedSlotDto = exports.SetWorkingHoursDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
class WorkingHoursRow {
}
__decorate([
    (0, swagger_1.ApiProperty)({ minimum: 1, maximum: 7, description: 'ISO day of week, Monday=1' }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(7),
    __metadata("design:type", Number)
], WorkingHoursRow.prototype, "dayOfWeek", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '09:00' }),
    (0, class_validator_1.Matches)(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'validation.TIME_INVALID' }),
    __metadata("design:type", String)
], WorkingHoursRow.prototype, "startsAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '17:00' }),
    (0, class_validator_1.Matches)(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'validation.TIME_INVALID' }),
    __metadata("design:type", String)
], WorkingHoursRow.prototype, "endsAt", void 0);
class SetWorkingHoursDto {
}
exports.SetWorkingHoursDto = SetWorkingHoursDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: [WorkingHoursRow] }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(21),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => WorkingHoursRow),
    __metadata("design:type", Array)
], SetWorkingHoursDto.prototype, "hours", void 0);
class CreateDefinedSlotDto {
}
exports.CreateDefinedSlotDto = CreateDefinedSlotDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateDefinedSlotDto.prototype, "startsAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateDefinedSlotDto.prototype, "endsAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, description: 'RSD, overrides the listing base price for this slot' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], CreateDefinedSlotDto.prototype, "price", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, default: 1 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CreateDefinedSlotDto.prototype, "maxBookings", void 0);
class CreateManualBlockDto {
}
exports.CreateManualBlockDto = CreateManualBlockDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateManualBlockDto.prototype, "startsAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateManualBlockDto.prototype, "endsAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateManualBlockDto.prototype, "note", void 0);
class SetDatePriceDto {
}
exports.SetDatePriceDto = SetDatePriceDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-12-31', description: 'Calendar date (YYYY-MM-DD), not a timestamp' }),
    (0, class_validator_1.Matches)(/^\d{4}-\d{2}-\d{2}$/, { message: 'validation.DATE_INVALID' }),
    __metadata("design:type", String)
], SetDatePriceDto.prototype, "date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'RSD, overrides the listing base/weekend price for this one date' }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], SetDatePriceDto.prototype, "price", void 0);
class AddIcalSourceDto {
}
exports.AddIcalSourceDto = AddIcalSourceDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], AddIcalSourceDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUrl)(),
    __metadata("design:type", String)
], AddIcalSourceDto.prototype, "url", void 0);
//# sourceMappingURL=availability.dto.js.map