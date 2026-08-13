import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { MessagingService } from './messaging.service';
import { StartConversationDto, SendMessageDto } from './dto/messaging.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('messaging')
@Controller('conversations')
export class MessagingController {
  constructor(private messagingService: MessagingService) {}

  @Get()
  list(@CurrentUser('id') userId: string) {
    return this.messagingService.listConversations(userId);
  }

  @Post()
  start(@CurrentUser('id') userId: string, @Body() dto: StartConversationDto) {
    return this.messagingService.startConversation(userId, dto);
  }

  @Get(':id')
  get(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.messagingService.getConversation(userId, id);
  }

  @Post(':id/messages')
  reply(@CurrentUser('id') userId: string, @Param('id') id: string, @Body() dto: SendMessageDto) {
    return this.messagingService.sendMessage(userId, id, dto.content);
  }

  @Post('messages/:messageId/attachments')
  @UseInterceptors(FileInterceptor('file'))
  addAttachment(
    @CurrentUser('id') userId: string,
    @Param('messageId') messageId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.messagingService.addAttachment(userId, messageId, file);
  }

  @Post(':id/read')
  markRead(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.messagingService.markRead(userId, id);
  }
}
