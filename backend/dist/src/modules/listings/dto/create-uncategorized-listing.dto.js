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
exports.CreateUncategorizedListingDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
const BOOKING_CHOICES = ['PER_STAY', 'PER_SLOT', 'NO_BOOKING'];
const STAY_UNITS = ['DAY', 'NIGHT', 'MONTH'];
const SLOT_UNITS = ['HOUR', 'SLOT'];
class CreateUncategorizedListingDto {
}
exports.CreateUncategorizedListingDto = CreateUncategorizedListingDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], CreateUncategorizedListingDto.prototype, "title", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: BOOKING_CHOICES }),
    (0, class_validator_1.IsIn)(BOOKING_CHOICES),
    __metadata("design:type", String)
], CreateUncategorizedListingDto.prototype, "bookingModel", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: [...STAY_UNITS, ...SLOT_UNITS] }),
    (0, class_validator_1.ValidateIf)((o) => o.bookingModel !== 'NO_BOOKING'),
    (0, class_validator_1.IsIn)([...STAY_UNITS, ...SLOT_UNITS]),
    __metadata("design:type", String)
], CreateUncategorizedListingDto.prototype, "priceUnit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], CreateUncategorizedListingDto.prototype, "description", void 0);
//# sourceMappingURL=create-uncategorized-listing.dto.js.map