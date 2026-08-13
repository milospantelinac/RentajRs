import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../../modules/notifications/notifications.module';
import { EmailService } from './email.service';

@Module({
  imports: [PrismaModule, NotificationsModule],
  providers: [EmailService],
  exports: [EmailService],
})
export class CommonEmailModule {}
