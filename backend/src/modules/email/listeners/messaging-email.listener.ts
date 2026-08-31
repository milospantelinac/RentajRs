import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmailService } from '../../../common/email/email.service';

@Injectable()
export class MessagingEmailListener {
  private readonly frontendUrl: string;

  constructor(
    private prisma: PrismaService,
    private email: EmailService,
    config: ConfigService,
  ) {
    this.frontendUrl = config.get<string>('frontendUrl')!;
  }

  /** T102 — nothing listened for this event, so a new message never notified its recipient, in-app or by email. */
  @OnEvent('messaging.new_message')
  async onNewMessage({ conversationId, senderId }: { conversationId: string; messageId: string; senderId: string }) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        listing: { select: { title: true } },
        guest: { select: { id: true, email: true, language: true } },
        owner: { select: { id: true, email: true, language: true } },
      },
    });
    if (!conversation) return;
    const recipient = conversation.guestId === senderId ? conversation.owner : conversation.guest;

    await this.email.send({
      key: 'new_message',
      to: recipient.email,
      language: recipient.language,
      userId: recipient.id,
      context: { oglas: conversation.listing.title },
      buttonUrl: `${this.frontendUrl}/kontrolna-tabla/poruke/${conversationId}`,
    });
  }
}
