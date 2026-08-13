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
exports.UpsertAttributeDto = exports.MergeCategoryDto = exports.RejectCategoryDto = exports.UpdateCategoryDto = exports.CreateCategoryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
class CreateCategoryDto {
}
exports.CreateCategoryDto = CreateCategoryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Omit for a top-level (main) category' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], CreateCategoryDto.prototype, "parentId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], CreateCategoryDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateCategoryDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateCategoryDto.prototype, "icon", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: client_1.BookingModel }),
    (0, class_validator_1.IsEnum)(client_1.BookingModel),
    __metadata("design:type", String)
], CreateCategoryDto.prototype, "defaultBookingModel", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: client_1.PriceUnit, isArray: true }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsEnum)(client_1.PriceUnit, { each: true }),
    __metadata("design:type", Array)
], CreateCategoryDto.prototype, "allowedPriceUnits", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: client_1.PriceUnit }),
    (0, class_validator_1.IsEnum)(client_1.PriceUnit),
    __metadata("design:type", String)
], CreateCategoryDto.prototype, "defaultPriceUnit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], CreateCategoryDto.prototype, "displayOrder", void 0);
class UpdateCategoryDto {
}
exports.UpdateCategoryDto = UpdateCategoryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], UpdateCategoryDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateCategoryDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateCategoryDto.prototype, "icon", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: client_1.BookingModel }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.BookingModel),
    __metadata("design:type", String)
], UpdateCategoryDto.prototype, "defaultBookingModel", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: client_1.PriceUnit, isArray: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsEnum)(client_1.PriceUnit, { each: true }),
    __metadata("design:type", Array)
], UpdateCategoryDto.prototype, "allowedPriceUnits", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: client_1.PriceUnit }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.PriceUnit),
    __metadata("design:type", String)
], UpdateCategoryDto.prototype, "defaultPriceUnit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], UpdateCategoryDto.prototype, "displayOrder", void 0);
class RejectCategoryDto {
}
exports.RejectCategoryDto = RejectCategoryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RejectCategoryDto.prototype, "reason", void 0);
class MergeCategoryDto {
}
exports.MergeCategoryDto = MergeCategoryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Target category id that listings/URL get merged into' }),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], MergeCategoryDto.prototype, "targetCategoryId", void 0);
class AttributeOptionInput {
}
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], AttributeOptionInput.prototype, "key", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], AttributeOptionInput.prototype, "name", void 0);
class UpsertAttributeDto {
}
exports.UpsertAttributeDto = UpsertAttributeDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Machine key, e.g. "kvadratura" — immutable once set' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], UpsertAttributeDto.prototype, "key", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], UpsertAttributeDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['NUMBER', 'TEXT', 'LIST', 'MULTISELECT', 'BOOLEAN'] }),
    (0, class_validator_1.IsEnum)(['NUMBER', 'TEXT', 'LIST', 'MULTISELECT', 'BOOLEAN']),
    __metadata("design:type", String)
], UpsertAttributeDto.prototype, "type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpsertAttributeDto.prototype, "required", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertAttributeDto.prototype, "unit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpsertAttributeDto.prototype, "isFilter", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['RANGE', 'SELECT', 'TOGGLE'] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(['RANGE', 'SELECT', 'TOGGLE']),
    __metadata("design:type", String)
], UpsertAttributeDto.prototype, "filterType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], UpsertAttributeDto.prototype, "displayOrder", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [AttributeOptionInput], description: 'Required when type is LIST/MULTISELECT' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(100),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => AttributeOptionInput),
    __metadata("design:type", Array)
], UpsertAttributeDto.prototype, "options", void 0);
//# sourceMappingURL=admin-category.dto.js.map