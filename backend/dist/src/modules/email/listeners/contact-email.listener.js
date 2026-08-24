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
exports.ContactEmailListener = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const prisma_service_1 = require("../../../prisma/prisma.service");
const email_service_1 = require("../../../common/email/email.service");
const SUPPORT_INBOX = 'podrska@rentaj.rs';
function escapeHtml(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
let ContactEmailListener = class ContactEmailListener {
    constructor(prisma, email) {
        this.prisma = prisma;
        this.email = email;
    }
    async onMessageSubmitted({ contactMessageId }) {
        const message = await this.prisma.contactMessage.findUnique({ where: { id: contactMessageId } });
        if (!message)
            return;
        await this.email.send({
            key: 'contact_message_received',
            to: SUPPORT_INBOX,
            context: {
                ime: escapeHtml(message.name),
                email: escapeHtml(message.email),
                naslov: escapeHtml(message.subject),
                poruka: escapeHtml(message.message).replace(/\n/g, '<br/>'),
            },
        });
    }
};
exports.ContactEmailListener = ContactEmailListener;
__decorate([
    (0, event_emitter_1.OnEvent)('contact.message_submitted'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ContactEmailListener.prototype, "onMessageSubmitted", null);
exports.ContactEmailListener = ContactEmailListener = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        email_service_1.EmailService])
], ContactEmailListener);
//# sourceMappingURL=contact-email.listener.js.map