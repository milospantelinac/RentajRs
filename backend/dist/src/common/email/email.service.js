"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var EmailService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const nodemailer = __importStar(require("nodemailer"));
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../prisma/prisma.service");
const notifications_service_1 = require("../../modules/notifications/notifications.service");
const interpolate_1 = require("../utils/interpolate");
const mjml_layout_1 = require("./mjml-layout");
const critical_events_1 = require("./critical-events");
let EmailService = EmailService_1 = class EmailService {
    constructor(config, prisma, notifications) {
        this.config = config;
        this.prisma = prisma;
        this.notifications = notifications;
        this.logger = new common_1.Logger(EmailService_1.name);
        const mail = this.config.get('mail');
        this.transporter = nodemailer.createTransport({
            host: mail.host,
            port: mail.port,
            secure: mail.secure,
            auth: mail.user ? { user: mail.user, pass: mail.pass } : undefined,
        });
        this.frontendUrl = this.config.get('frontendUrl');
        this.fromName = mail.fromName;
        this.fromAddress = mail.fromAddress;
    }
    async send(opts) {
        if (opts.userId && !critical_events_1.CRITICAL_EMAIL_EVENTS.has(opts.key)) {
            const setting = await this.prisma.notificationSetting.findUnique({
                where: { userId_event: { userId: opts.userId, event: opts.key } },
            });
            if (setting && !setting.emailEnabled)
                return;
        }
        const language = opts.language ?? client_1.Language.SR;
        const template = await this.prisma.emailTemplate.findUnique({
            where: { key_language: { key: opts.key, language } },
        });
        if (!template) {
            this.logger.warn(`No email template for key=${opts.key} language=${language}`);
            return;
        }
        const heading = (0, interpolate_1.interpolate)(template.heading, opts.context);
        const bodyText = (0, interpolate_1.interpolate)(template.bodyText, opts.context);
        const html = (0, mjml_layout_1.renderEmailHtml)({
            heading,
            bodyText,
            buttonLabel: template.buttonLabel ? (0, interpolate_1.interpolate)(template.buttonLabel, opts.context) : null,
            buttonUrl: opts.buttonUrl,
            extraMjml: opts.extraMjml,
            language,
            frontendUrl: this.frontendUrl,
        });
        let status = 'SENT';
        let error;
        try {
            await this.transporter.sendMail({
                from: `"${this.fromName}" <${this.fromAddress}>`,
                to: opts.to,
                subject: (0, interpolate_1.interpolate)(template.subject, opts.context),
                html,
            });
        }
        catch (err) {
            status = 'FAILED';
            error = err.message;
            this.logger.error(`Email send failed key=${opts.key} to=${opts.to}: ${error}`);
        }
        await this.prisma.emailLog.create({
            data: { userId: opts.userId, event: opts.key, recipient: opts.to, template: opts.key, status, error },
        });
        if (opts.userId) {
            await this.notifications.createFromEmail({
                userId: opts.userId,
                event: opts.key,
                title: heading,
                content: bodyText,
                linkUrl: opts.buttonUrl,
            });
        }
    }
};
exports.EmailService = EmailService;
exports.EmailService = EmailService = EmailService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        prisma_service_1.PrismaService,
        notifications_service_1.NotificationsService])
], EmailService);
//# sourceMappingURL=email.service.js.map