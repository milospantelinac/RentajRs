import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmailService } from '../../../common/email/email.service';

@Injectable()
export class DataProtectionEmailListener {
  private readonly frontendUrl: string;

  constructor(
    private prisma: PrismaService,
    private email: EmailService,
    config: ConfigService,
  ) {
    this.frontendUrl = config.get<string>('frontendUrl')!;
  }

  /** R175 — deletion is only confirmed from the registered inbox. */
  @OnEvent('user.deletion_requested')
  async onDeletionRequested({ userId, rawToken }: { userId: string; rawToken: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;
    await this.email.send({
      key: 'account_deletion_confirm',
      to: user.email,
      language: user.language,
      userId,
      buttonUrl: `${this.frontendUrl}/potvrda-brisanja?token=${rawToken}`,
    });
  }

  /** R142 — right to data portability. */
  @OnEvent('user.data_export_ready')
  async onDataExportReady({ userId }: { userId: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;
    await this.email.send({
      key: 'data_export_ready',
      to: user.email,
      language: user.language,
      userId,
      buttonUrl: `${this.frontendUrl}/kontrolna-tabla/podesavanja`,
    });
  }
}
