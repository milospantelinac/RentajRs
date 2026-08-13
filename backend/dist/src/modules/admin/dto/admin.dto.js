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
exports.UpdateEmailTemplateDto = exports.UpdateSettingDto = exports.ResolveDisputeDto = exports.BlockUserDto = exports.ReportListingDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const REPORT_REASONS = ['FRAUD', 'INACCURATE_INFO', 'INAPPROPRIATE_CONTENT', 'DUPLICATE', 'OTHER'];
const DISPUTE_OUTCOMES = ['WARNING', 'RESTRICTION', 'BLOCK', 'NO_ACTION'];
class ReportListingDto {
}
exports.ReportListingDto = ReportListingDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: REPORT_REASONS }),
    (0, class_validator_1.IsIn)(REPORT_REASONS),
    __metadata("design:type", Object)
], ReportListingDto.prototype, "reason", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ReportListingDto.prototype, "description", void 0);
class BlockUserDto {
}
exports.BlockUserDto = BlockUserDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], BlockUserDto.prototype, "reason", void 0);
class ResolveDisputeDto {
}
exports.ResolveDisputeDto = ResolveDisputeDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: DISPUTE_OUTCOMES }),
    (0, class_validator_1.IsIn)(DISPUTE_OUTCOMES),
    __metadata("design:type", Object)
], ResolveDisputeDto.prototype, "outcome", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Account the outcome applies to — WARNING/RESTRICTION/BLOCK are never automatic (Ch.6.7: admin decides about the account, never about money)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], ResolveDisputeDto.prototype, "targetUserId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ResolveDisputeDto.prototype, "adminNote", void 0);
class UpdateSettingDto {
}
exports.UpdateSettingDto = UpdateSettingDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsDefined)(),
    __metadata("design:type", Object)
], UpdateSettingDto.prototype, "value", void 0);
class UpdateEmailTemplateDto {
}
exports.UpdateEmailTemplateDto = UpdateEmailTemplateDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], UpdateEmailTemplateDto.prototype, "subject", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], UpdateEmailTemplateDto.prototype, "heading", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], UpdateEmailTemplateDto.prototype, "bodyText", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateEmailTemplateDto.prototype, "buttonLabel", void 0);
//# sourceMappingURL=admin.dto.js.map