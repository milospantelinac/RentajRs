import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ContactService } from './contact.service';
import { CreateContactMessageDto } from './dto/create-contact-message.dto';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('contact')
@Controller()
export class ContactController {
  constructor(private contactService: ContactService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('contact')
  create(@Body() dto: CreateContactMessageDto) {
    return this.contactService.create(dto);
  }
}
