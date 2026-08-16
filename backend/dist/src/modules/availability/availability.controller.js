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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IcalExportController = exports.AvailabilityController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const availability_service_1 = require("./availability.service");
const availability_dto_1 = require("./dto/availability.dto");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const public_decorator_1 = require("../../common/decorators/public.decorator");
let AvailabilityController = class AvailabilityController {
    constructor(availabilityService) {
        this.availabilityService = availabilityService;
    }
    getAvailability(id, from, to) {
        const now = new Date();
        const fromDate = from ? new Date(from) : now;
        const toDate = to ? new Date(to) : new Date(now.getTime() + 1000 * 60 * 60 * 24 * 90);
        return this.availabilityService.getAvailability(id, fromDate, toDate);
    }
    setWorkingHours(userId, id, dto) {
        return this.availabilityService.setWorkingHours(userId, id, dto);
    }
    createSlot(userId, id, dto) {
        return this.availabilityService.createDefinedSlot(userId, id, dto);
    }
    deleteSlot(userId, id, slotId) {
        return this.availabilityService.deleteDefinedSlot(userId, id, slotId);
    }
    createBlock(userId, id, dto) {
        return this.availabilityService.createManualBlock(userId, id, dto);
    }
    deleteBlock(userId, id, blockId) {
        return this.availabilityService.deleteManualBlock(userId, id, blockId);
    }
    setDatePrice(userId, id, dto) {
        return this.availabilityService.setDatePrice(userId, id, dto);
    }
    deleteDatePrice(userId, id, date) {
        return this.availabilityService.deleteDatePrice(userId, id, date);
    }
    listIcalSources(userId, id) {
        return this.availabilityService.listIcalSources(userId, id);
    }
    addIcalSource(userId, id, dto) {
        return this.availabilityService.addIcalSource(userId, id, dto);
    }
    removeIcalSource(userId, id, sourceId) {
        return this.availabilityService.removeIcalSource(userId, id, sourceId);
    }
};
exports.AvailabilityController = AvailabilityController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)(),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('from')),
    __param(2, (0, common_1.Query)('to')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], AvailabilityController.prototype, "getAvailability", null);
__decorate([
    (0, common_1.Post)('working-hours'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, availability_dto_1.SetWorkingHoursDto]),
    __metadata("design:returntype", void 0)
], AvailabilityController.prototype, "setWorkingHours", null);
__decorate([
    (0, common_1.Post)('slots'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, availability_dto_1.CreateDefinedSlotDto]),
    __metadata("design:returntype", void 0)
], AvailabilityController.prototype, "createSlot", null);
__decorate([
    (0, common_1.Delete)('slots/:slotId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('slotId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], AvailabilityController.prototype, "deleteSlot", null);
__decorate([
    (0, common_1.Post)('blocks'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, availability_dto_1.CreateManualBlockDto]),
    __metadata("design:returntype", void 0)
], AvailabilityController.prototype, "createBlock", null);
__decorate([
    (0, common_1.Delete)('blocks/:blockId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('blockId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], AvailabilityController.prototype, "deleteBlock", null);
__decorate([
    (0, common_1.Post)('date-price'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, availability_dto_1.SetDatePriceDto]),
    __metadata("design:returntype", void 0)
], AvailabilityController.prototype, "setDatePrice", null);
__decorate([
    (0, common_1.Delete)('date-price/:date'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('date')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], AvailabilityController.prototype, "deleteDatePrice", null);
__decorate([
    (0, common_1.Get)('ical-sources'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AvailabilityController.prototype, "listIcalSources", null);
__decorate([
    (0, common_1.Post)('ical-sources'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, availability_dto_1.AddIcalSourceDto]),
    __metadata("design:returntype", void 0)
], AvailabilityController.prototype, "addIcalSource", null);
__decorate([
    (0, common_1.Delete)('ical-sources/:sourceId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('sourceId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], AvailabilityController.prototype, "removeIcalSource", null);
exports.AvailabilityController = AvailabilityController = __decorate([
    (0, swagger_1.ApiTags)('availability'),
    (0, common_1.Controller)('listings/:id/availability'),
    __metadata("design:paramtypes", [availability_service_1.AvailabilityService])
], AvailabilityController);
let IcalExportController = class IcalExportController {
    constructor(availabilityService) {
        this.availabilityService = availabilityService;
    }
    async export(token) {
        return this.availabilityService.exportIcs(token);
    }
};
exports.IcalExportController = IcalExportController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)(':token.ics'),
    (0, common_1.Header)('Content-Type', 'text/calendar; charset=utf-8'),
    __param(0, (0, common_1.Param)('token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], IcalExportController.prototype, "export", null);
exports.IcalExportController = IcalExportController = __decorate([
    (0, swagger_1.ApiTags)('availability'),
    (0, common_1.Controller)('ical'),
    __metadata("design:paramtypes", [availability_service_1.AvailabilityService])
], IcalExportController);
//# sourceMappingURL=availability.controller.js.map