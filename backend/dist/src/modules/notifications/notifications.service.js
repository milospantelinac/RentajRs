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
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
let NotificationsService = class NotificationsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async listMine(userId) {
        return this.prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
    }
    async unreadCount(userId) {
        const count = await this.prisma.notification.count({ where: { userId, readAt: null } });
        return { count };
    }
    async markRead(userId, id) {
        await this.prisma.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } });
        return { message: 'ok' };
    }
    async markAllRead(userId) {
        await this.prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
        return { message: 'ok' };
    }
    async deleteOne(userId, id) {
        await this.prisma.notification.deleteMany({ where: { id, userId } });
        return { message: 'ok' };
    }
    async deleteAll(userId) {
        await this.prisma.notification.deleteMany({ where: { userId } });
        return { message: 'ok' };
    }
    async createFromEmail(opts) {
        const setting = await this.prisma.notificationSetting.findUnique({
            where: { userId_event: { userId: opts.userId, event: opts.event } },
        });
        if (setting && !setting.appEnabled)
            return;
        await this.prisma.notification.create({
            data: { userId: opts.userId, event: opts.event, title: opts.title, content: opts.content, linkUrl: opts.linkUrl },
        });
    }
    async getMySettings(userId) {
        const rows = await this.prisma.notificationSetting.findMany({ where: { userId } });
        return rows.map((r) => ({ event: r.event, emailEnabled: r.emailEnabled, appEnabled: r.appEnabled }));
    }
    async updateSetting(userId, event, emailEnabled, appEnabled) {
        await this.prisma.notificationSetting.upsert({
            where: { userId_event: { userId, event } },
            update: { emailEnabled, appEnabled },
            create: { userId, event, emailEnabled, appEnabled },
        });
        return { message: 'ok' };
    }
    async updateSettingsBulk(userId, events, emailEnabled, appEnabled) {
        await this.prisma.$transaction(events.map((event) => this.prisma.notificationSetting.upsert({
            where: { userId_event: { userId, event } },
            update: { emailEnabled, appEnabled },
            create: { userId, event, emailEnabled, appEnabled },
        })));
        return { message: 'ok' };
    }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map