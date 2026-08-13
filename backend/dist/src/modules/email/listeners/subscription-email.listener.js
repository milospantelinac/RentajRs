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
exports.SubscriptionEmailListener = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const event_emitter_1 = require("@nestjs/event-emitter");
const prisma_service_1 = require("../../../prisma/prisma.service");
const email_service_1 = require("../../../common/email/email.service");
const format_1 = require("../format");
let SubscriptionEmailListener = class SubscriptionEmailListener {
    constructor(prisma, email, config) {
        this.prisma = prisma;
        this.email = email;
        this.frontendUrl = config.get('frontendUrl');
    }
    async loadSub(subscriptionId) {
        const sub = await this.prisma.subscription.findUnique({
            where: { id: subscriptionId },
            include: { user: true, package: true },
        });
        return sub;
    }
    async onPurchased({ userId, subscriptionId }) {
        const sub = await this.loadSub(subscriptionId);
        if (!sub)
            return;
        await this.email.send({
            key: 'subscription_activated',
            to: sub.user.email,
            language: sub.user.language,
            userId,
            context: { paket: sub.package.key },
            buttonUrl: `${this.frontendUrl}/kontrolna-tabla/pretplate`,
        });
        const invoice = await this.prisma.invoice.findFirst({
            where: { userId, transaction: { subscriptionId } },
            orderBy: { createdAt: 'desc' },
        });
        if (invoice) {
            await this.email.send({
                key: 'subscription_invoice',
                to: sub.user.email,
                language: sub.user.language,
                userId,
                context: { paket: sub.package.key },
                buttonUrl: `${this.frontendUrl}/kontrolna-tabla/pretplate`,
            });
        }
    }
    async onProFormaIssued({ userId, subscriptionId }) {
        const sub = await this.loadSub(subscriptionId);
        if (!sub)
            return;
        await this.email.send({
            key: 'subscription_pro_forma',
            to: sub.user.email,
            language: sub.user.language,
            userId,
            context: { paket: sub.package.key },
            buttonUrl: `${this.frontendUrl}/kontrolna-tabla/pretplate`,
        });
    }
    async onRenewalReminder({ subscriptionId }) {
        const sub = await this.loadSub(subscriptionId);
        if (!sub)
            return;
        await this.email.send({
            key: 'subscription_renewal_reminder',
            to: sub.user.email,
            language: sub.user.language,
            userId: sub.userId,
            context: { paket: sub.package.key, datum: (0, format_1.formatDate)(sub.expiresAt, (0, format_1.localeFor)(sub.user.language)) },
            buttonUrl: `${this.frontendUrl}/kontrolna-tabla/pretplate`,
        });
    }
    async onPaymentFailed({ subscriptionId }) {
        const sub = await this.loadSub(subscriptionId);
        if (!sub)
            return;
        await this.email.send({
            key: 'subscription_payment_failed',
            to: sub.user.email,
            language: sub.user.language,
            userId: sub.userId,
            context: { paket: sub.package.key },
            buttonUrl: `${this.frontendUrl}/kontrolna-tabla/pretplate`,
        });
    }
    async onExpiringSoon({ subscriptionId, daysLeft }) {
        const sub = await this.loadSub(subscriptionId);
        if (!sub)
            return;
        await this.email.send({
            key: 'subscription_expiring_soon',
            to: sub.user.email,
            language: sub.user.language,
            userId: sub.userId,
            context: { paket: sub.package.key, broj: daysLeft, datum: (0, format_1.formatDate)(sub.expiresAt, (0, format_1.localeFor)(sub.user.language)) },
            buttonUrl: `${this.frontendUrl}/kontrolna-tabla/pretplate`,
        });
    }
    async onExpired({ subscriptionId }) {
        const sub = await this.loadSub(subscriptionId);
        if (!sub)
            return;
        await this.email.send({
            key: 'subscription_expired',
            to: sub.user.email,
            language: sub.user.language,
            userId: sub.userId,
            context: { paket: sub.package.key },
            buttonUrl: `${this.frontendUrl}/kontrolna-tabla/pretplate`,
        });
    }
};
exports.SubscriptionEmailListener = SubscriptionEmailListener;
__decorate([
    (0, event_emitter_1.OnEvent)('subscription.purchased'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SubscriptionEmailListener.prototype, "onPurchased", null);
__decorate([
    (0, event_emitter_1.OnEvent)('subscription.pro_forma_issued'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SubscriptionEmailListener.prototype, "onProFormaIssued", null);
__decorate([
    (0, event_emitter_1.OnEvent)('subscription.renewal_reminder'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SubscriptionEmailListener.prototype, "onRenewalReminder", null);
__decorate([
    (0, event_emitter_1.OnEvent)('subscription.payment_failed'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SubscriptionEmailListener.prototype, "onPaymentFailed", null);
__decorate([
    (0, event_emitter_1.OnEvent)('subscription.expiring_soon'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SubscriptionEmailListener.prototype, "onExpiringSoon", null);
__decorate([
    (0, event_emitter_1.OnEvent)('subscription.expired'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SubscriptionEmailListener.prototype, "onExpired", null);
exports.SubscriptionEmailListener = SubscriptionEmailListener = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        email_service_1.EmailService,
        config_1.ConfigService])
], SubscriptionEmailListener);
//# sourceMappingURL=subscription-email.listener.js.map