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
exports.ContentController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const client_1 = require("@prisma/client");
const content_service_1 = require("./content.service");
const public_decorator_1 = require("../../common/decorators/public.decorator");
function resolveLanguage(xLang) {
    return (xLang || 'sr').toUpperCase() === 'EN' ? client_1.Language.EN : client_1.Language.SR;
}
let ContentController = class ContentController {
    constructor(contentService) {
        this.contentService = contentService;
    }
    getStaticPage(slug, xLang) {
        return this.contentService.getStaticPage(slug, resolveLanguage(xLang));
    }
    listFaqs(xLang) {
        return this.contentService.listFaqs(resolveLanguage(xLang));
    }
    getHomepageVideoUrl() {
        return this.contentService.getHomepageVideoUrl();
    }
};
exports.ContentController = ContentController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('static-pages/:slug'),
    __param(0, (0, common_1.Param)('slug')),
    __param(1, (0, common_1.Headers)('x-lang')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ContentController.prototype, "getStaticPage", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('faqs'),
    __param(0, (0, common_1.Headers)('x-lang')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ContentController.prototype, "listFaqs", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('homepage-video-url'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ContentController.prototype, "getHomepageVideoUrl", null);
exports.ContentController = ContentController = __decorate([
    (0, swagger_1.ApiTags)('content'),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [content_service_1.ContentService])
], ContentController);
//# sourceMappingURL=content.controller.js.map