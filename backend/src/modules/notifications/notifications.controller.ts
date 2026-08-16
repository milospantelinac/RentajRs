import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UpdateNotificationSettingDto, UpdateNotificationSettingsBulkDto } from './dto/notification-settings.dto';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  listMine(@CurrentUser('id') userId: string) {
    return this.notificationsService.listMine(userId);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser('id') userId: string) {
    return this.notificationsService.unreadCount(userId);
  }

  @Post(':id/read')
  markRead(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.notificationsService.markRead(userId, id);
  }

  @Post('read-all')
  markAllRead(@CurrentUser('id') userId: string) {
    return this.notificationsService.markAllRead(userId);
  }

  // -- Preferences (R87) -------------------------------------------------

  @Get('settings')
  getSettings(@CurrentUser('id') userId: string) {
    return this.notificationsService.getMySettings(userId);
  }

  @Patch('settings/:event')
  updateSetting(@CurrentUser('id') userId: string, @Param('event') event: string, @Body() dto: UpdateNotificationSettingDto) {
    return this.notificationsService.updateSetting(userId, event, dto.emailEnabled, dto.appEnabled);
  }

  @Patch('settings')
  updateSettingsBulk(@CurrentUser('id') userId: string, @Body() dto: UpdateNotificationSettingsBulkDto) {
    return this.notificationsService.updateSettingsBulk(userId, dto.events, dto.emailEnabled, dto.appEnabled);
  }
}
