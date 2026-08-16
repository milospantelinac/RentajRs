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
exports.AccountEmailListener = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const event_emitter_1 = require("@nestjs/event-emitter");
const prisma_service_1 = require("../../../prisma/prisma.service");
const email_service_1 = require("../../../common/email/email.service");
let AccountEmailListener = class AccountEmailListener {
    constructor(prisma, email, config) {
        this.prisma = prisma;
        this.email = email;
        this.frontendUrl = config.get('frontendUrl');
    }
    async onRegistered({ userId, verificationToken }) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            return;
        await this.email.send({
            key: 'welcome_registration',
            to: user.email,
            language: user.language,
            userId,
            context: { ime: user.firstName },
            buttonUrl: `${this.frontendUrl}/potvrda-adrese?token=${verificationToken}`,
        });
    }
    async onVerificationResent({ userId, verificationToken }) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            return;
        await this.email.send({
            key: 'verify_email_resend',
            to: user.email,
            language: user.language,
            userId,
            buttonUrl: `${this.frontendUrl}/potvrda-adrese?token=${verificationToken}`,
        });
    }
    async onPasswordResetRequested({ userId, resetToken }) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            return;
        await this.email.send({
            key: 'password_reset_request',
            to: user.email,
            language: user.language,
            userId,
            buttonUrl: `${this.frontendUrl}/resetovanje-lozinke?token=${resetToken}`,
        });
    }
    async onPasswordChanged({ userId }) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            return;
        await this.email.send({
            key: 'password_changed',
            to: user.email,
            language: user.language,
            userId,
            buttonUrl: `${this.frontendUrl}/kontrolna-tabla/podesavanja`,
        });
    }
    async onTwoFactorResetByPasswordReset({ userId }) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            return;
        await this.email.send({
            key: 'two_factor_reset_by_password_reset',
            to: user.email,
            language: user.language,
            userId,
            buttonUrl: `${this.frontendUrl}/kontrolna-tabla/podesavanja`,
        });
    }
    async onNewDeviceLogin({ userId, device }) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            return;
        await this.email.send({
            key: 'new_device_login',
            to: user.email,
            language: user.language,
            userId,
            context: { device: device || 'unknown device' },
            buttonUrl: `${this.frontendUrl}/kontrolna-tabla/podesavanja`,
        });
    }
    async onBlocked({ userId, reason }) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            return;
        await this.email.send({
            key: 'account_blocked',
            to: user.email,
            language: user.language,
            userId,
            context: { razlog: reason },
            buttonUrl: `${this.frontendUrl}/kontakt`,
        });
    }
};
exports.AccountEmailListener = AccountEmailListener;
__decorate([
    (0, event_emitter_1.OnEvent)('auth.registered'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AccountEmailListener.prototype, "onRegistered", null);
__decorate([
    (0, event_emitter_1.OnEvent)('auth.verification_resent'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AccountEmailListener.prototype, "onVerificationResent", null);
__decorate([
    (0, event_emitter_1.OnEvent)('auth.password_reset_requested'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AccountEmailListener.prototype, "onPasswordResetRequested", null);
__decorate([
    (0, event_emitter_1.OnEvent)('auth.password_changed'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AccountEmailListener.prototype, "onPasswordChanged", null);
__decorate([
    (0, event_emitter_1.OnEvent)('auth.two_factor_reset_by_password_reset'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AccountEmailListener.prototype, "onTwoFactorResetByPasswordReset", null);
__decorate([
    (0, event_emitter_1.OnEvent)('auth.new_device_login'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AccountEmailListener.prototype, "onNewDeviceLogin", null);
__decorate([
    (0, event_emitter_1.OnEvent)('user.blocked_by_admin'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AccountEmailListener.prototype, "onBlocked", null);
exports.AccountEmailListener = AccountEmailListener = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        email_service_1.EmailService,
        config_1.ConfigService])
], AccountEmailListener);
//# sourceMappingURL=account-email.listener.js.map