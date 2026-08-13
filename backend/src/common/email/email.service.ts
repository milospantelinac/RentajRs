import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Language } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../modules/notifications/notifications.service';
import { interpolate } from '../utils/interpolate';
import { renderEmailHtml } from './mjml-layout';

export interface SendEmailOptions {
  /** EmailTemplate.key — also doubles as the EmailLog.event/template value. */
  key: string;
  to: string;
  language?: Language;
  userId?: string;
  context?: Record<string, string | number>;
  buttonUrl?: string;
  /** Structured, non-editable data block (payment details, IPS QR, invoice numbers) as raw MJML. */
  extraMjml?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly frontendUrl: string;
  private readonly fromName: string;
  private readonly fromAddress: string;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {
    const mail = this.config.get('mail')!;
    this.transporter = nodemailer.createTransport({
      host: mail.host,
      port: mail.port,
      secure: mail.secure,
      auth: mail.user ? { user: mail.user, pass: mail.pass } : undefined,
    });
    this.frontendUrl = this.config.get<string>('frontendUrl')!;
    this.fromName = mail.fromName;
    this.fromAddress = mail.fromAddress;
  }

  /**
   * Every email in the system goes through here — never a raw
   * transporter.sendMail() from a feature service — so template lookup
   * (R166), delivery logging (R170) and the shared layout (Ch.22.3) all stay
   * in one place. A missing template or a delivery failure never throws:
   * booking/listing flows must not fail because a notification couldn't go
   * out (the failure itself is what EmailLog is for).
   */
  async send(opts: SendEmailOptions): Promise<void> {
    const language = opts.language ?? Language.SR;
    const template = await this.prisma.emailTemplate.findUnique({
      where: { key_language: { key: opts.key, language } },
    });
    if (!template) {
      this.logger.warn(`No email template for key=${opts.key} language=${language}`);
      return;
    }

    const heading = interpolate(template.heading, opts.context);
    const bodyText = interpolate(template.bodyText, opts.context);
    const html = renderEmailHtml({
      heading,
      bodyText,
      buttonLabel: template.buttonLabel ? interpolate(template.buttonLabel, opts.context) : null,
      buttonUrl: opts.buttonUrl,
      extraMjml: opts.extraMjml,
      language,
      frontendUrl: this.frontendUrl,
    });

    let status: 'SENT' | 'FAILED' = 'SENT';
    let error: string | undefined;
    try {
      await this.transporter.sendMail({
        from: `"${this.fromName}" <${this.fromAddress}>`,
        to: opts.to,
        subject: interpolate(template.subject, opts.context),
        html,
      });
    } catch (err) {
      status = 'FAILED';
      error = (err as Error).message;
      this.logger.error(`Email send failed key=${opts.key} to=${opts.to}: ${error}`);
    }

    await this.prisma.emailLog.create({
      data: { userId: opts.userId, event: opts.key, recipient: opts.to, template: opts.key, status, error },
    });

    // Ch.10 in-app notification bell — every email doubles as a bell entry
    // for its recipient (when we know who that is internally, i.e. not for
    // guests who only have an email address on file).
    if (opts.userId) {
      await this.notifications.createFromEmail({
        userId: opts.userId,
        event: opts.key,
        title: heading,
        content: bodyText,
        linkUrl: opts.buttonUrl,
      });
    }
  }
}
