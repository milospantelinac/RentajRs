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
exports.TaxonomyController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const taxonomy_service_1 = require("./taxonomy.service");
const propose_category_dto_1 = require("./dto/propose-category.dto");
const admin_category_dto_1 = require("./dto/admin-category.dto");
const public_decorator_1 = require("../../common/decorators/public.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const require_permissions_decorator_1 = require("../../common/decorators/require-permissions.decorator");
let TaxonomyController = class TaxonomyController {
    constructor(taxonomyService) {
        this.taxonomyService = taxonomyService;
    }
    getTree() {
        return this.taxonomyService.getCategoryTree();
    }
    checkDuplicate(parentId, name) {
        return this.taxonomyService.checkDuplicateCategory(parentId, name);
    }
    getBySlug(slug) {
        return this.taxonomyService.getCategoryBySlug(slug);
    }
    getRegions() {
        return this.taxonomyService.getRegions();
    }
    getCities(regionId) {
        return this.taxonomyService.getCities(regionId);
    }
    getCityAreas(citySlug) {
        return this.taxonomyService.getCityAreas(citySlug);
    }
    proposeCategory(userId, dto) {
        return this.taxonomyService.proposeCategory(userId, dto);
    }
    adminGetTree() {
        return this.taxonomyService.adminGetCategoryTree();
    }
    adminListProposed() {
        return this.taxonomyService.adminListProposedCategories();
    }
    adminCreate(dto) {
        return this.taxonomyService.adminCreateCategory(dto);
    }
    adminUpdate(id, dto) {
        return this.taxonomyService.adminUpdateCategory(id, dto);
    }
    adminApprove(id) {
        return this.taxonomyService.adminApproveCategory(id);
    }
    adminReject(id, dto) {
        return this.taxonomyService.adminRejectCategory(id, dto);
    }
    adminMerge(id, dto) {
        return this.taxonomyService.adminMergeCategory(id, dto);
    }
    adminPromote(id) {
        return this.taxonomyService.adminPromoteCategory(id);
    }
    adminUpsertAttribute(id, dto) {
        return this.taxonomyService.adminUpsertAttribute(id, dto);
    }
    adminDeleteAttribute(attributeId) {
        return this.taxonomyService.adminDeleteAttribute(attributeId);
    }
};
exports.TaxonomyController = TaxonomyController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('categories'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], TaxonomyController.prototype, "getTree", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('categories/check-duplicate'),
    __param(0, (0, common_1.Query)('parentId')),
    __param(1, (0, common_1.Query)('name')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], TaxonomyController.prototype, "checkDuplicate", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('categories/:slug'),
    __param(0, (0, common_1.Param)('slug')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TaxonomyController.prototype, "getBySlug", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('locations/regions'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], TaxonomyController.prototype, "getRegions", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('locations/cities'),
    __param(0, (0, common_1.Query)('regionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TaxonomyController.prototype, "getCities", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('locations/cities/:citySlug/areas'),
    __param(0, (0, common_1.Param)('citySlug')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TaxonomyController.prototype, "getCityAreas", null);
__decorate([
    (0, common_1.Post)('categories/propose'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, propose_category_dto_1.ProposeCategoryDto]),
    __metadata("design:returntype", void 0)
], TaxonomyController.prototype, "proposeCategory", null);
__decorate([
    (0, require_permissions_decorator_1.RequirePermissions)('manage_categories'),
    (0, common_1.Get)('admin/categories'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], TaxonomyController.prototype, "adminGetTree", null);
__decorate([
    (0, require_permissions_decorator_1.RequirePermissions)('manage_categories'),
    (0, common_1.Get)('admin/categories/proposed'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], TaxonomyController.prototype, "adminListProposed", null);
__decorate([
    (0, require_permissions_decorator_1.RequirePermissions)('manage_categories'),
    (0, common_1.Post)('admin/categories'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [admin_category_dto_1.CreateCategoryDto]),
    __metadata("design:returntype", void 0)
], TaxonomyController.prototype, "adminCreate", null);
__decorate([
    (0, require_permissions_decorator_1.RequirePermissions)('manage_categories'),
    (0, common_1.Patch)('admin/categories/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, admin_category_dto_1.UpdateCategoryDto]),
    __metadata("design:returntype", void 0)
], TaxonomyController.prototype, "adminUpdate", null);
__decorate([
    (0, require_permissions_decorator_1.RequirePermissions)('manage_categories'),
    (0, common_1.Post)('admin/categories/:id/approve'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TaxonomyController.prototype, "adminApprove", null);
__decorate([
    (0, require_permissions_decorator_1.RequirePermissions)('manage_categories'),
    (0, common_1.Post)('admin/categories/:id/reject'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, admin_category_dto_1.RejectCategoryDto]),
    __metadata("design:returntype", void 0)
], TaxonomyController.prototype, "adminReject", null);
__decorate([
    (0, require_permissions_decorator_1.RequirePermissions)('manage_categories'),
    (0, common_1.Post)('admin/categories/:id/merge'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, admin_category_dto_1.MergeCategoryDto]),
    __metadata("design:returntype", void 0)
], TaxonomyController.prototype, "adminMerge", null);
__decorate([
    (0, require_permissions_decorator_1.RequirePermissions)('manage_categories'),
    (0, common_1.Post)('admin/categories/:id/promote'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TaxonomyController.prototype, "adminPromote", null);
__decorate([
    (0, require_permissions_decorator_1.RequirePermissions)('manage_categories'),
    (0, common_1.Post)('admin/categories/:id/attributes'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, admin_category_dto_1.UpsertAttributeDto]),
    __metadata("design:returntype", void 0)
], TaxonomyController.prototype, "adminUpsertAttribute", null);
__decorate([
    (0, require_permissions_decorator_1.RequirePermissions)('manage_categories'),
    (0, common_1.Delete)('admin/attributes/:attributeId'),
    __param(0, (0, common_1.Param)('attributeId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TaxonomyController.prototype, "adminDeleteAttribute", null);
exports.TaxonomyController = TaxonomyController = __decorate([
    (0, swagger_1.ApiTags)('taxonomy'),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [taxonomy_service_1.TaxonomyService])
], TaxonomyController);
//# sourceMappingURL=taxonomy.controller.js.map