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
exports.ListingsController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const swagger_1 = require("@nestjs/swagger");
const listings_service_1 = require("./listings.service");
const create_listing_dto_1 = require("./dto/create-listing.dto");
const update_listing_dto_1 = require("./dto/update-listing.dto");
const update_location_dto_1 = require("./dto/update-location.dto");
const upsert_attributes_dto_1 = require("./dto/upsert-attributes.dto");
const upsert_faqs_dto_1 = require("./dto/upsert-faqs.dto");
const upsert_extra_services_dto_1 = require("./dto/upsert-extra-services.dto");
const reject_listing_dto_1 = require("./dto/reject-listing.dto");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const public_decorator_1 = require("../../common/decorators/public.decorator");
const require_permissions_decorator_1 = require("../../common/decorators/require-permissions.decorator");
let ListingsController = class ListingsController {
    constructor(listingsService) {
        this.listingsService = listingsService;
    }
    create(userId, dto) {
        return this.listingsService.createDraft(userId, dto);
    }
    getMine(userId) {
        return this.listingsService.getMine(userId);
    }
    getOwned(userId, id) {
        return this.listingsService.getOwned(userId, id);
    }
    getOwnerPreview(userId, id) {
        return this.listingsService.getOwnerPreview(userId, id);
    }
    update(userId, id, dto) {
        return this.listingsService.updateListing(userId, id, dto);
    }
    updateLocation(userId, id, dto) {
        return this.listingsService.updateLocation(userId, id, dto);
    }
    upsertAttributes(userId, id, dto) {
        return this.listingsService.upsertAttributes(userId, id, dto);
    }
    upsertFaqs(userId, id, dto) {
        return this.listingsService.upsertFaqs(userId, id, dto);
    }
    upsertExtraServices(userId, id, dto) {
        return this.listingsService.upsertExtraServices(userId, id, dto);
    }
    addPhoto(userId, id, file) {
        return this.listingsService.addPhoto(userId, id, file);
    }
    removePhoto(userId, id, photoId) {
        return this.listingsService.removePhoto(userId, id, photoId);
    }
    reorderPhotos(userId, id, photoIds) {
        return this.listingsService.reorderPhotos(userId, id, photoIds);
    }
    getReadiness(userId, id) {
        return this.listingsService.getReadiness(userId, id);
    }
    deleteListing(userId, id) {
        return this.listingsService.deleteListing(userId, id);
    }
    getPublic(slug) {
        return this.listingsService.getPublicBySlug(slug);
    }
    adminQueue() {
        return this.listingsService.adminGetQueue();
    }
    adminApprove(adminId, id) {
        return this.listingsService.adminApprove(adminId, id);
    }
    adminReject(adminId, id, dto) {
        return this.listingsService.adminReject(adminId, id, dto);
    }
    adminApproveVersion(adminId, versionId) {
        return this.listingsService.adminApproveVersion(adminId, versionId);
    }
    adminRejectVersion(adminId, versionId, dto) {
        return this.listingsService.adminRejectVersion(adminId, versionId, dto);
    }
};
exports.ListingsController = ListingsController;
__decorate([
    (0, common_1.Post)('listings'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_listing_dto_1.CreateListingDto]),
    __metadata("design:returntype", void 0)
], ListingsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('listings/mine'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ListingsController.prototype, "getMine", null);
__decorate([
    (0, common_1.Get)('listings/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ListingsController.prototype, "getOwned", null);
__decorate([
    (0, common_1.Get)('listings/:id/preview'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ListingsController.prototype, "getOwnerPreview", null);
__decorate([
    (0, common_1.Patch)('listings/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, update_listing_dto_1.UpdateListingDto]),
    __metadata("design:returntype", void 0)
], ListingsController.prototype, "update", null);
__decorate([
    (0, common_1.Patch)('listings/:id/location'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, update_location_dto_1.UpdateLocationDto]),
    __metadata("design:returntype", void 0)
], ListingsController.prototype, "updateLocation", null);
__decorate([
    (0, common_1.Post)('listings/:id/attributes'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, upsert_attributes_dto_1.UpsertAttributesDto]),
    __metadata("design:returntype", void 0)
], ListingsController.prototype, "upsertAttributes", null);
__decorate([
    (0, common_1.Post)('listings/:id/faqs'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, upsert_faqs_dto_1.UpsertFaqsDto]),
    __metadata("design:returntype", void 0)
], ListingsController.prototype, "upsertFaqs", null);
__decorate([
    (0, common_1.Post)('listings/:id/extra-services'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, upsert_extra_services_dto_1.UpsertExtraServicesDto]),
    __metadata("design:returntype", void 0)
], ListingsController.prototype, "upsertExtraServices", null);
__decorate([
    (0, common_1.Post)('listings/:id/photos'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], ListingsController.prototype, "addPhoto", null);
__decorate([
    (0, common_1.Delete)('listings/:id/photos/:photoId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('photoId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], ListingsController.prototype, "removePhoto", null);
__decorate([
    (0, common_1.Patch)('listings/:id/photos/reorder'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)('photoIds')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Array]),
    __metadata("design:returntype", void 0)
], ListingsController.prototype, "reorderPhotos", null);
__decorate([
    (0, common_1.Get)('listings/:id/readiness'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ListingsController.prototype, "getReadiness", null);
__decorate([
    (0, common_1.Delete)('listings/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ListingsController.prototype, "deleteListing", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('listings/public/:slug'),
    __param(0, (0, common_1.Param)('slug')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ListingsController.prototype, "getPublic", null);
__decorate([
    (0, require_permissions_decorator_1.RequirePermissions)('approve_listing'),
    (0, common_1.Get)('admin/listings/queue'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ListingsController.prototype, "adminQueue", null);
__decorate([
    (0, require_permissions_decorator_1.RequirePermissions)('approve_listing'),
    (0, common_1.Post)('admin/listings/:id/approve'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ListingsController.prototype, "adminApprove", null);
__decorate([
    (0, require_permissions_decorator_1.RequirePermissions)('approve_listing'),
    (0, common_1.Post)('admin/listings/:id/reject'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, reject_listing_dto_1.RejectListingDto]),
    __metadata("design:returntype", void 0)
], ListingsController.prototype, "adminReject", null);
__decorate([
    (0, require_permissions_decorator_1.RequirePermissions)('approve_listing'),
    (0, common_1.Post)('admin/listings/versions/:versionId/approve'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('versionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ListingsController.prototype, "adminApproveVersion", null);
__decorate([
    (0, require_permissions_decorator_1.RequirePermissions)('approve_listing'),
    (0, common_1.Post)('admin/listings/versions/:versionId/reject'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('versionId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, reject_listing_dto_1.RejectVersionDto]),
    __metadata("design:returntype", void 0)
], ListingsController.prototype, "adminRejectVersion", null);
exports.ListingsController = ListingsController = __decorate([
    (0, swagger_1.ApiTags)('listings'),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [listings_service_1.ListingsService])
], ListingsController);
//# sourceMappingURL=listings.controller.js.map