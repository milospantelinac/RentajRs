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
exports.MessagingEmailListener = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const event_emitter_1 = require("@nestjs/event-emitter");
const prisma_service_1 = require("../../../prisma/prisma.service");
const email_service_1 = require("../../../common/email/email.service");
let MessagingEmailListener = class MessagingEmailListener {
    constructor(prisma, email, config) {
        this.prisma = prisma;
        this.email = email;
        this.frontendUrl = config.get('frontendUrl');
    }
    async onNewMessage({ conversationId, senderId }) {
        const conversation = await this.prisma.conversation.findUnique({
            where: { id: conversationId },
            include: {
                listing: { select: { title: true } },
                guest: { select: { id: true, email: true, language: true } },
                owner: { select: { id: true, email: true, language: true } },
            },
        });
        if (!conversation)
            return;
        const recipient = conversation.guestId === senderId ? conversation.owner : conversation.guest;
        await this.email.send({
            key: 'new_message',
            to: recipient.email,
            language: recipient.language,
            userId: recipient.id,
            context: { oglas: conversation.listing.title },
            buttonUrl: `${this.frontendUrl}/kontrolna-tabla/poruke/${conversationId}`,
        });
    }
};
exports.MessagingEmailListener = MessagingEmailListener;
__decorate([
    (0, event_emitter_1.OnEvent)('messaging.new_message'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MessagingEmailListener.prototype, "onNewMessage", null);
exports.MessagingEmailListener = MessagingEmailListener = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        email_service_1.EmailService,
        config_1.ConfigService])
], MessagingEmailListener);
//# sourceMappingURL=messaging-email.listener.js.map