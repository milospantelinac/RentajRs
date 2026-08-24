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
exports.SubscriptionsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const subscriptions_service_1 = require("./subscriptions.service");
const subscriptions_dto_1 = require("./dto/subscriptions.dto");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const public_decorator_1 = require("../../common/decorators/public.decorator");
const require_permissions_decorator_1 = require("../../common/decorators/require-permissions.decorator");
const client_1 = require("@prisma/client");
let SubscriptionsController = class SubscriptionsController {
    constructor(subscriptionsService) {
        this.subscriptionsService = subscriptionsService;
    }
    listPackages() {
        return this.subscriptionsService.listPackages();
    }
    mine(userId) {
        return this.subscriptionsService.getMySubscriptions(userId);
    }
    getReceipt(userId, id) {
        return this.subscriptionsService.getSubscriptionReceipt(userId, id);
    }
    purchase(userId, dto) {
        return this.subscriptionsService.purchaseForListing(userId, dto);
    }
    initCheckout(userId, dto) {
        return this.subscriptionsService.initCheckout(userId, dto);
    }
    async nestpaySuccess(body) {
        return { url: await this.subscriptionsService.handleNestPaySuccess(body), statusCode: 303 };
    }
    async nestpayFail(body) {
        return { url: await this.subscriptionsService.handleNestPayFail(body), statusCode: 303 };
    }
    cancel(userId, id, dto) {
        return this.subscriptionsService.cancelSubscription(userId, id, dto);
    }
    purchaseFeatured(userId, dto) {
        return this.subscriptionsService.purchaseFeatured(userId, dto);
    }
    getRotatedFeatured(categoryId, limit) {
        return this.subscriptionsService.getRotatedFeatured(categoryId, limit ? parseInt(limit, 10) : undefined);
    }
    getFeaturedPrices() {
        return this.subscriptionsService.getFeaturedPrices();
    }
    adminList(status) {
        return this.subscriptionsService.adminListSubscriptions(status);
    }
    adminActivate(adminId, id) {
        return this.subscriptionsService.adminActivateSubscription(adminId, id);
    }
    adminUpdatePrice(id, dto) {
        return this.subscriptionsService.adminUpdatePackagePrice(id, dto);
    }
    adminAssignFreeFeatured(adminId, listingId, dto) {
        return this.subscriptionsService.adminAssignFreeFeatured(adminId, listingId, dto.durationDays);
    }
    adminGetFeaturedWaitlist() {
        return this.subscriptionsService.adminGetFeaturedWaitlist();
    }
};
exports.SubscriptionsController = SubscriptionsController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('packages'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SubscriptionsController.prototype, "listPackages", null);
__decorate([
    (0, common_1.Get)('subscriptions/mine'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SubscriptionsController.prototype, "mine", null);
__decorate([
    (0, common_1.Get)('subscriptions/:id/receipt'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], SubscriptionsController.prototype, "getReceipt", null);
__decorate([
    (0, common_1.Post)('subscriptions/purchase'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, subscriptions_dto_1.PurchaseSubscriptionDto]),
    __metadata("design:returntype", void 0)
], SubscriptionsController.prototype, "purchase", null);
__decorate([
    (0, common_1.Post)('subscriptions/checkout/init'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, subscriptions_dto_1.InitCheckoutDto]),
    __metadata("design:returntype", void 0)
], SubscriptionsController.prototype, "initCheckout", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Redirect)(),
    (0, common_1.Post)('subscriptions/nestpay/callback/success'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SubscriptionsController.prototype, "nestpaySuccess", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Redirect)(),
    (0, common_1.Post)('subscriptions/nestpay/callback/fail'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SubscriptionsController.prototype, "nestpayFail", null);
__decorate([
    (0, common_1.Post)('subscriptions/:id/cancel'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, subscriptions_dto_1.CancelSubscriptionDto]),
    __metadata("design:returntype", void 0)
], SubscriptionsController.prototype, "cancel", null);
__decorate([
    (0, common_1.Post)('featured/purchase'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, subscriptions_dto_1.PurchaseFeaturedDto]),
    __metadata("design:returntype", void 0)
], SubscriptionsController.prototype, "purchaseFeatured", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('featured'),
    __param(0, (0, common_1.Query)('categoryId')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], SubscriptionsController.prototype, "getRotatedFeatured", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('featured/prices'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SubscriptionsController.prototype, "getFeaturedPrices", null);
__decorate([
    (0, require_permissions_decorator_1.RequirePermissions)('manage_subscriptions'),
    (0, common_1.Get)('admin/subscriptions'),
    __param(0, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SubscriptionsController.prototype, "adminList", null);
__decorate([
    (0, require_permissions_decorator_1.RequirePermissions)('manual_activate_subscription'),
    (0, common_1.Post)('admin/subscriptions/:id/activate'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], SubscriptionsController.prototype, "adminActivate", null);
__decorate([
    (0, require_permissions_decorator_1.RequirePermissions)('manage_subscriptions'),
    (0, common_1.Post)('admin/packages/:id/price'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, subscriptions_dto_1.AdjustPriceDto]),
    __metadata("design:returntype", void 0)
], SubscriptionsController.prototype, "adminUpdatePrice", null);
__decorate([
    (0, require_permissions_decorator_1.RequirePermissions)('manage_featured'),
    (0, common_1.Post)('admin/featured/:listingId/assign-free'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('listingId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, subscriptions_dto_1.AssignFreeFeaturedDto]),
    __metadata("design:returntype", void 0)
], SubscriptionsController.prototype, "adminAssignFreeFeatured", null);
__decorate([
    (0, require_permissions_decorator_1.RequirePermissions)('manage_featured'),
    (0, common_1.Get)('admin/featured/waitlist'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SubscriptionsController.prototype, "adminGetFeaturedWaitlist", null);
exports.SubscriptionsController = SubscriptionsController = __decorate([
    (0, swagger_1.ApiTags)('subscriptions'),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [subscriptions_service_1.SubscriptionsService])
], SubscriptionsController);
//# sourceMappingURL=subscriptions.controller.js.map