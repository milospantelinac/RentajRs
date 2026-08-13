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
exports.AdminController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const client_1 = require("@prisma/client");
const admin_service_1 = require("./admin.service");
const admin_dto_1 = require("./dto/admin.dto");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const require_permissions_decorator_1 = require("../../common/decorators/require-permissions.decorator");
let AdminController = class AdminController {
    constructor(adminService) {
        this.adminService = adminService;
    }
    reportListing(userId, id, dto) {
        return this.adminService.reportListing(userId, id, dto);
    }
    listUsers(search, blocked) {
        return this.adminService.listUsers(search, blocked === undefined ? undefined : blocked === 'true');
    }
    blockUser(adminId, id, dto) {
        return this.adminService.blockUser(adminId, id, dto);
    }
    unblockUser(adminId, id) {
        return this.adminService.unblockUser(adminId, id);
    }
    listReports(status) {
        return this.adminService.listReports(status);
    }
    resolveReport(adminId, id, status) {
        return this.adminService.resolveReport(adminId, id, status);
    }
    listDisputes(status) {
        return this.adminService.listDisputes(status);
    }
    resolveDispute(adminId, id, dto) {
        return this.adminService.resolveDispute(adminId, id, dto);
    }
    listSettings() {
        return this.adminService.listSettings();
    }
    updateSetting(adminId, key, dto) {
        return this.adminService.updateSetting(adminId, key, dto);
    }
    listEmailTemplates() {
        return this.adminService.listEmailTemplates();
    }
    updateEmailTemplate(adminId, key, language, dto) {
        return this.adminService.updateEmailTemplate(adminId, key, language, dto);
    }
    emptySearchReport(days) {
        return this.adminService.getEmptySearchReport(days ? parseInt(days, 10) : undefined);
    }
    contactSharingReport(days) {
        return this.adminService.getContactSharingReport(days ? parseInt(days, 10) : undefined);
    }
    auditLog(entityType, page) {
        return this.adminService.getAuditLog(entityType, page ? parseInt(page, 10) : undefined);
    }
};
exports.AdminController = AdminController;
__decorate([
    (0, common_1.Post)('listings/:id/report'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, admin_dto_1.ReportListingDto]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "reportListing", null);
__decorate([
    (0, require_permissions_decorator_1.RequirePermissions)('manage_users'),
    (0, common_1.Get)('admin/users'),
    __param(0, (0, common_1.Query)('search')),
    __param(1, (0, common_1.Query)('blocked')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "listUsers", null);
__decorate([
    (0, require_permissions_decorator_1.RequirePermissions)('manage_users'),
    (0, common_1.Post)('admin/users/:id/block'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, admin_dto_1.BlockUserDto]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "blockUser", null);
__decorate([
    (0, require_permissions_decorator_1.RequirePermissions)('manage_users'),
    (0, common_1.Post)('admin/users/:id/unblock'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "unblockUser", null);
__decorate([
    (0, require_permissions_decorator_1.RequirePermissions)('resolve_disputes'),
    (0, common_1.Get)('admin/reports'),
    __param(0, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "listReports", null);
__decorate([
    (0, require_permissions_decorator_1.RequirePermissions)('resolve_disputes'),
    (0, common_1.Patch)('admin/reports/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "resolveReport", null);
__decorate([
    (0, require_permissions_decorator_1.RequirePermissions)('resolve_disputes'),
    (0, common_1.Get)('admin/disputes'),
    __param(0, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "listDisputes", null);
__decorate([
    (0, require_permissions_decorator_1.RequirePermissions)('resolve_disputes'),
    (0, common_1.Post)('admin/disputes/:id/resolve'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, admin_dto_1.ResolveDisputeDto]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "resolveDispute", null);
__decorate([
    (0, require_permissions_decorator_1.RequirePermissions)('manage_settings'),
    (0, common_1.Get)('admin/settings'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "listSettings", null);
__decorate([
    (0, require_permissions_decorator_1.RequirePermissions)('manage_settings'),
    (0, common_1.Patch)('admin/settings/:key'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('key')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, admin_dto_1.UpdateSettingDto]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "updateSetting", null);
__decorate([
    (0, require_permissions_decorator_1.RequirePermissions)('manage_settings'),
    (0, common_1.Get)('admin/email-templates'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "listEmailTemplates", null);
__decorate([
    (0, require_permissions_decorator_1.RequirePermissions)('manage_settings'),
    (0, common_1.Patch)('admin/email-templates/:key/:language'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('key')),
    __param(2, (0, common_1.Param)('language')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, admin_dto_1.UpdateEmailTemplateDto]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "updateEmailTemplate", null);
__decorate([
    (0, require_permissions_decorator_1.RequirePermissions)('view_admin_logs'),
    (0, common_1.Get)('admin/reports/empty-searches'),
    __param(0, (0, common_1.Query)('days')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "emptySearchReport", null);
__decorate([
    (0, require_permissions_decorator_1.RequirePermissions)('view_admin_logs'),
    (0, common_1.Get)('admin/reports/contact-sharing'),
    __param(0, (0, common_1.Query)('days')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "contactSharingReport", null);
__decorate([
    (0, require_permissions_decorator_1.RequirePermissions)('view_admin_logs'),
    (0, common_1.Get)('admin/logs'),
    __param(0, (0, common_1.Query)('entityType')),
    __param(1, (0, common_1.Query)('page')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "auditLog", null);
exports.AdminController = AdminController = __decorate([
    (0, swagger_1.ApiTags)('admin'),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [admin_service_1.AdminService])
], AdminController);
//# sourceMappingURL=admin.controller.js.map