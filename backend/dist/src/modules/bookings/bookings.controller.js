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
exports.BookingsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const client_1 = require("@prisma/client");
const bookings_service_1 = require("./bookings.service");
const create_booking_request_dto_1 = require("./dto/create-booking-request.dto");
const booking_actions_dto_1 = require("./dto/booking-actions.dto");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
let BookingsController = class BookingsController {
    constructor(bookingsService) {
        this.bookingsService = bookingsService;
    }
    create(guestId, listingId, dto) {
        return this.bookingsService.createRequest(guestId, listingId, dto);
    }
    listMine(userId, role = 'guest', status) {
        return this.bookingsService.listMine(userId, role, status);
    }
    getOne(userId, id) {
        return this.bookingsService.getOne(userId, id);
    }
    getQr(userId, id) {
        return this.bookingsService.getIpsQrImage(userId, id).then((dataUrl) => ({ dataUrl }));
    }
    approve(ownerId, id) {
        return this.bookingsService.approveRequest(ownerId, id);
    }
    reject(ownerId, id, dto) {
        return this.bookingsService.rejectRequest(ownerId, id, dto);
    }
    confirmPayment(ownerId, id) {
        return this.bookingsService.confirmPayment(ownerId, id);
    }
    markNoShow(ownerId, id) {
        return this.bookingsService.markNoShow(ownerId, id);
    }
    cancelByOwner(ownerId, id, dto) {
        return this.bookingsService.cancelByOwner(ownerId, id, dto);
    }
    cancelByGuest(guestId, id, dto) {
        return this.bookingsService.cancelByGuest(guestId, id, dto);
    }
    disputeNoShow(guestId, id, dto) {
        return this.bookingsService.disputeNoShow(guestId, id, dto);
    }
    disputePayment(guestId, id) {
        return this.bookingsService.disputeUnconfirmedPayment(guestId, id);
    }
};
exports.BookingsController = BookingsController;
__decorate([
    (0, common_1.Post)('listings/:id/bookings'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, create_booking_request_dto_1.CreateBookingRequestDto]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('bookings/mine'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Query)('role')),
    __param(2, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "listMine", null);
__decorate([
    (0, common_1.Get)('bookings/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "getOne", null);
__decorate([
    (0, common_1.Get)('bookings/:id/qr'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "getQr", null);
__decorate([
    (0, common_1.Post)('bookings/:id/approve'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "approve", null);
__decorate([
    (0, common_1.Post)('bookings/:id/reject'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, booking_actions_dto_1.RejectBookingDto]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "reject", null);
__decorate([
    (0, common_1.Post)('bookings/:id/confirm-payment'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "confirmPayment", null);
__decorate([
    (0, common_1.Post)('bookings/:id/no-show'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "markNoShow", null);
__decorate([
    (0, common_1.Post)('bookings/:id/cancel-by-owner'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, booking_actions_dto_1.CancelBookingDto]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "cancelByOwner", null);
__decorate([
    (0, common_1.Post)('bookings/:id/cancel'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, booking_actions_dto_1.CancelBookingDto]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "cancelByGuest", null);
__decorate([
    (0, common_1.Post)('bookings/:id/dispute-no-show'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, booking_actions_dto_1.DisputeNoShowDto]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "disputeNoShow", null);
__decorate([
    (0, common_1.Post)('bookings/:id/dispute-payment'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "disputePayment", null);
exports.BookingsController = BookingsController = __decorate([
    (0, swagger_1.ApiTags)('bookings'),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [bookings_service_1.BookingsService])
], BookingsController);
//# sourceMappingURL=bookings.controller.js.map