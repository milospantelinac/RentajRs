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
exports.RejectVersionDto = exports.RejectListingDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const REJECTION_REASONS = [
    'MISSING_PHOTOS',
    'INAPPROPRIATE_CONTENT',
    'CONTACT_INFO_IN_DESCRIPTION',
    'PRICE_OUT_OF_RANGE',
    'INCOMPLETE_INFORMATION',
    'SUSPECTED_FRAUD',
    'DUPLICATE_LISTING',
    'OTHER',
];
class RejectListingDto {
}
exports.RejectListingDto = RejectListingDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: REJECTION_REASONS }),
    (0, class_validator_1.IsIn)(REJECTION_REASONS),
    __metadata("design:type", Object)
], RejectListingDto.prototype, "reason", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RejectListingDto.prototype, "note", void 0);
class RejectVersionDto {
}
exports.RejectVersionDto = RejectVersionDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], RejectVersionDto.prototype, "reason", void 0);
//# sourceMappingURL=reject-listing.dto.js.map