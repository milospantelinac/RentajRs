import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmailService } from '../../../common/email/email.service';

const SUPPORT_INBOX = 'office@rentaj.rs';

// interpolate()/renderEmailHtml() insert context values into the MJML
// template with no escaping of their own — every other listener only ever
// feeds it trusted, system-controlled strings (names, package labels), but
// this is a public, unauthenticated form, so its values need escaping here
// before they reach that pipeline.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

@Injectable()
export class ContactEmailListener {
  constructor(
    private prisma: PrismaService,
    private email: EmailService,
  ) {}

  /** T15 — every /kontakt submission notifies support with the full message. */
  @OnEvent('contact.message_submitted')
  async onMessageSubmitted({ contactMessageId }: { contactMessageId: string }) {
    const message = await this.prisma.contactMessage.findUnique({ where: { id: contactMessageId } });
    if (!message) return;
    await this.email.send({
      key: 'contact_message_received',
      to: SUPPORT_INBOX,
      context: {
        ime: escapeHtml(message.name),
        email: escapeHtml(message.email),
        naslov: escapeHtml(message.subject),
        poruka: escapeHtml(message.message).replace(/\n/g, '<br/>'),
      },
    });
  }
}
