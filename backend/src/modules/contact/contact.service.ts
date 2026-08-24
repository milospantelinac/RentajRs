import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateContactMessageDto } from './dto/create-contact-message.dto';

@Injectable()
export class ContactService {
  constructor(
    private prisma: PrismaService,
    private events: EventEmitter2,
    private i18n: I18nService,
  ) {}

  async create(dto: CreateContactMessageDto) {
    // Honeypot — a bot fills every field including this one (invisible to a
    // real visitor via CSS); pretend success so it doesn't learn to skip it.
    if (dto.website) {
      return { message: this.i18n.t('common.SUCCESS') };
    }

    const contactMessage = await this.prisma.contactMessage.create({
      data: {
        name: dto.name,
        email: dto.email,
        subject: dto.subject,
        message: dto.message,
        consentAt: new Date(),
      },
    });
    this.events.emit('contact.message_submitted', { contactMessageId: contactMessage.id });

    return { message: this.i18n.t('common.SUCCESS') };
  }
}
