import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async listMine(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async unreadCount(userId: string) {
    const count = await this.prisma.notification.count({ where: { userId, readAt: null } });
    return { count };
  }

  async markRead(userId: string, id: string) {
    await this.prisma.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } });
    return { message: 'ok' };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
    return { message: 'ok' };
  }

  async deleteOne(userId: string, id: string) {
    await this.prisma.notification.deleteMany({ where: { id, userId } });
    return { message: 'ok' };
  }

  async deleteAll(userId: string) {
    await this.prisma.notification.deleteMany({ where: { userId } });
    return { message: 'ok' };
  }

  /** Called by EmailService for every send — the single place notification rows get created (Ch.10). */
  async createFromEmail(opts: { userId: string; event: string; title: string; content: string; linkUrl?: string }) {
    const setting = await this.prisma.notificationSetting.findUnique({
      where: { userId_event: { userId: opts.userId, event: opts.event } },
    });
    if (setting && !setting.appEnabled) return;
    await this.prisma.notification.create({
      data: { userId: opts.userId, event: opts.event, title: opts.title, content: opts.content, linkUrl: opts.linkUrl },
    });
  }

  // -- Preferences (R87) -------------------------------------------------

  /** Every row that exists for this user, keyed by event — missing events default to both channels on. */
  async getMySettings(userId: string) {
    const rows = await this.prisma.notificationSetting.findMany({ where: { userId } });
    return rows.map((r) => ({ event: r.event, emailEnabled: r.emailEnabled, appEnabled: r.appEnabled }));
  }

  async updateSetting(userId: string, event: string, emailEnabled: boolean, appEnabled: boolean) {
    await this.prisma.notificationSetting.upsert({
      where: { userId_event: { userId, event } },
      update: { emailEnabled, appEnabled },
      create: { userId, event, emailEnabled, appEnabled },
    });
    return { message: 'ok' };
  }

  /** The UI groups events into categories (see frontend) and toggles every event in one together. */
  async updateSettingsBulk(userId: string, events: string[], emailEnabled: boolean, appEnabled: boolean) {
    await this.prisma.$transaction(
      events.map((event) =>
        this.prisma.notificationSetting.upsert({
          where: { userId_event: { userId, event } },
          update: { emailEnabled, appEnabled },
          create: { userId, event, emailEnabled, appEnabled },
        }),
      ),
    );
    return { message: 'ok' };
  }
}
