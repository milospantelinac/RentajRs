import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Language } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../modules/notifications/notifications.service';
import { emailTemplates } from '../../../prisma/email-templates.seed-data';
import { escapeHtml } from '../utils/escape-html';
import { interpolate } from '../utils/interpolate';
import { renderEmailHtml } from './mjml-layout';
import { CRITICAL_EMAIL_EVENTS } from './critical-events';

export interface SendEmailOptions {
  /** EmailTemplate.key — also doubles as the EmailLog.event/template value. */
  key: string;
  to: string;
  language?: Language;
  userId?: string;
  context?: Record<string, string | number>;
  buttonUrl?: string;
  /**
   * Structured, non-editable data block (payment details, IPS QR, invoice numbers) as raw MJML.
   * It is placed in the email as it is, so the caller escapes any value it puts into it.
   */
  extraMjml?: string;
}

/** The context values as they go into the email's HTML; in the body a line break stays a line break. */
function htmlValues(context: SendEmailOptions['context'], lineBreaks = false) {
  if (!context) return context;
  return Object.fromEntries(
    Object.entries(context).map(([token, value]) => {
      const escaped = escapeHtml(String(value));
      return [token, lineBreaks ? escaped.replace(/\r\n|\r|\n/g, '<br/>') : escaped];
    }),
  );
}

@Injectable()
export class EmailService implements OnApplicationBootstrap {
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
      // The login (Postmark's SMTP token in production) never goes out in the
      // clear: with one set, port 587 has to upgrade with STARTTLS instead of
      // only when the server offers it. MailDev in dev has no login.
      requireTLS: Boolean(mail.user),
    });
    this.frontendUrl = this.config.get<string>('frontendUrl')!;
    this.fromName = mail.fromName;
    this.fromAddress = mail.fromAddress;
  }

  /**
   * The seed writes the template copy, but nothing runs it when the production
   * image starts, and send() skips an email whose template has no row. So a
   * template this build sends and the database lacks gets its default copy
   * here; the rows that exist keep whatever an admin made of them (R166).
   */
  async onApplicationBootstrap() {
    const rows = emailTemplates.flatMap((template) => [
      { key: template.key, language: Language.SR, ...template.sr },
      { key: template.key, language: Language.EN, ...template.en },
    ]);
    try {
      const { count } = await this.prisma.emailTemplate.createMany({ data: rows, skipDuplicates: true });
      if (count) this.logger.log(`Added ${count} email template row(s) the database was missing`);
    } catch (err) {
      // Mail whose template is missing stays unsent, as before; the backend still starts.
      this.logger.error(`Could not add the missing email templates: ${(err as Error).message}`);
    }
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
    // R87/R90 — an event outside the always-on critical set respects the
    // recipient's own opt-out (NotificationSetting.emailEnabled); the in-app
    // bell has its own, separate appEnabled check inside createFromEmail().
    if (opts.userId && !CRITICAL_EMAIL_EVENTS.has(opts.key)) {
      const setting = await this.prisma.notificationSetting.findUnique({
        where: { userId_event: { userId: opts.userId, event: opts.key } },
      });
      if (setting && !setting.emailEnabled) return;
    }

    const language = opts.language ?? Language.SR;
    const template = await this.prisma.emailTemplate.findUnique({
      where: { key_language: { key: opts.key, language } },
    });
    if (!template) {
      this.logger.warn(`No email template for key=${opts.key} language=${language}`);
      return;
    }

    // The copy is the admin's and may carry tags of its own (the contact
    // template has <br/>). The values are written by users: listing titles,
    // reasons, names, the browser's User-Agent. So only the values are escaped
    // on their way into the HTML, or a title could put a link of its own into
    // an email to someone else. The subject and the bell are plain text and
    // take the values as they are.
    const heading = interpolate(template.heading, opts.context);
    const bodyText = interpolate(template.bodyText, opts.context);
    const html = renderEmailHtml({
      heading: interpolate(template.heading, htmlValues(opts.context)),
      bodyText: interpolate(template.bodyText, htmlValues(opts.context, true)),
      buttonLabel: template.buttonLabel ? interpolate(template.buttonLabel, htmlValues(opts.context)) : null,
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
        // Postmark files the message under its template key (Activity filter,
        // stats per email type); MailDev just shows it as a header.
        headers: { 'X-PM-Tag': opts.key },
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
