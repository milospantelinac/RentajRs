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
exports.UsersController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const swagger_1 = require("@nestjs/swagger");
const users_service_1 = require("./users.service");
const update_profile_dto_1 = require("./dto/update-profile.dto");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const public_decorator_1 = require("../../common/decorators/public.decorator");
let UsersController = class UsersController {
    constructor(usersService) {
        this.usersService = usersService;
    }
    getMe(userId) {
        return this.usersService.getMe(userId);
    }
    updateMe(userId, dto) {
        return this.usersService.updateMe(userId, dto);
    }
    setAvatar(userId, file) {
        return this.usersService.setAvatar(userId, file);
    }
    removeAvatar(userId) {
        return this.usersService.removeAvatar(userId);
    }
    listFavorites(userId) {
        return this.usersService.listFavorites(userId);
    }
    addFavorite(userId, id) {
        return this.usersService.addFavorite(userId, id);
    }
    removeFavorite(userId, id) {
        return this.usersService.removeFavorite(userId, id);
    }
    exportData(userId) {
        return this.usersService.exportUserData(userId);
    }
    requestAccountDeletion(userId) {
        return this.usersService.requestAccountDeletion(userId);
    }
    confirmAccountDeletion(token) {
        return this.usersService.confirmAccountDeletion(token);
    }
    getPublicProfile(slug) {
        return this.usersService.getPublicProfile(slug);
    }
};
exports.UsersController = UsersController;
__decorate([
    (0, common_1.Get)('users/me'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "getMe", null);
__decorate([
    (0, common_1.Patch)('users/me'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_profile_dto_1.UpdateProfileDto]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "updateMe", null);
__decorate([
    (0, common_1.Post)('users/me/avatar'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "setAvatar", null);
__decorate([
    (0, common_1.Delete)('users/me/avatar'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "removeAvatar", null);
__decorate([
    (0, common_1.Get)('users/me/favorites'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "listFavorites", null);
__decorate([
    (0, common_1.Post)('listings/:id/favorite'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "addFavorite", null);
__decorate([
    (0, common_1.Delete)('listings/:id/favorite'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "removeFavorite", null);
__decorate([
    (0, common_1.Get)('users/me/export'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "exportData", null);
__decorate([
    (0, common_1.Post)('users/me/deletion/request'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "requestAccountDeletion", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('users/deletion/confirm'),
    __param(0, (0, common_1.Body)('token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "confirmAccountDeletion", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('users/profile/:slug'),
    __param(0, (0, common_1.Param)('slug')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "getPublicProfile", null);
exports.UsersController = UsersController = __decorate([
    (0, swagger_1.ApiTags)('users'),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [users_service_1.UsersService])
], UsersController);
//# sourceMappingURL=users.controller.js.map