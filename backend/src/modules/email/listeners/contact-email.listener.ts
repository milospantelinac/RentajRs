import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmailService } from '../../../common/email/email.service';

const SUPPORT_INBOX = 'office@rentaj.rs';

@Injectable()
export class ContactEmailListener {
  constructor(
    private prisma: PrismaService,
    private email: EmailService,
  ) {}

  /**
   * T15: every /kontakt submission notifies support with the full message.
   * The form is public and unauthenticated. EmailService.send() escapes what
   * was typed into it for the email's HTML and keeps the message's line
   * breaks, and the subject line gets the text as it was typed.
   */
  @OnEvent('contact.message_submitted')
  async onMessageSubmitted({ contactMessageId }: { contactMessageId: string }) {
    const message = await this.prisma.contactMessage.findUnique({ where: { id: contactMessageId } });
    if (!message) return;
    await this.email.send({
      key: 'contact_message_received',
      to: SUPPORT_INBOX,
      context: {
        ime: message.name,
        email: message.email,
        naslov: message.subject,
        poruka: message.message,
      },
    });
  }
}
