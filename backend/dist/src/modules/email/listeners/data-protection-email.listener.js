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
exports.DataProtectionEmailListener = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const event_emitter_1 = require("@nestjs/event-emitter");
const prisma_service_1 = require("../../../prisma/prisma.service");
const email_service_1 = require("../../../common/email/email.service");
let DataProtectionEmailListener = class DataProtectionEmailListener {
    constructor(prisma, email, config) {
        this.prisma = prisma;
        this.email = email;
        this.frontendUrl = config.get('frontendUrl');
    }
    async onDeletionRequested({ userId, rawToken }) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            return;
        await this.email.send({
            key: 'account_deletion_confirm',
            to: user.email,
            language: user.language,
            userId,
            buttonUrl: `${this.frontendUrl}/potvrda-brisanja?token=${rawToken}`,
        });
    }
    async onDataExportReady({ userId }) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            return;
        await this.email.send({
            key: 'data_export_ready',
            to: user.email,
            language: user.language,
            userId,
            buttonUrl: `${this.frontendUrl}/kontrolna-tabla/podesavanja`,
        });
    }
};
exports.DataProtectionEmailListener = DataProtectionEmailListener;
__decorate([
    (0, event_emitter_1.OnEvent)('user.deletion_requested'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DataProtectionEmailListener.prototype, "onDeletionRequested", null);
__decorate([
    (0, event_emitter_1.OnEvent)('user.data_export_ready'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DataProtectionEmailListener.prototype, "onDataExportReady", null);
exports.DataProtectionEmailListener = DataProtectionEmailListener = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        email_service_1.EmailService,
        config_1.ConfigService])
], DataProtectionEmailListener);
//# sourceMappingURL=data-protection-email.listener.js.map