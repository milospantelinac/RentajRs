import { ContactEmailListener } from './contact-email.listener';
import { EmailService } from '../../../common/email/email.service';
import { emailTemplates } from '../../../../prisma/email-templates.seed-data';

// The listener together with the real EmailService and the seeded copy, so the
// test sees the email the support inbox gets.
describe('ContactEmailListener#onMessageSubmitted', () => {
  const template = emailTemplates.find((row) => row.key === 'contact_message_received')!.sr;
  const config = {
    get: (key: string) => (key === 'mail' ? { host: 'localhost', port: 1025, secure: false, fromName: 'Rentaj', fromAddress: 'no-reply@rentaj.rs' } : 'http://front'),
  };

  function setup(message: Record<string, string>) {
    const prisma = {
      contactMessage: { findUnique: jest.fn(async () => message) },
      emailTemplate: { findUnique: jest.fn(async () => template) },
      emailLog: { create: jest.fn(async () => ({})) },
    };
    const email = new EmailService(config as any, prisma as any, { createFromEmail: jest.fn() } as any);
    const sendMail = jest.fn(async () => undefined);
    (email as any).transporter = { sendMail };
    return { listener: new ContactEmailListener(prisma as any, email), sendMail };
  }

  it('shows the message as it was typed: markup as text, line breaks kept, a readable subject', async () => {
    const { listener, sendMail } = setup({
      name: 'Marko <script>alert(1)</script>',
      email: 'marko@example.com',
      subject: 'Pitanje o "Pro" paketu & ceni',
      message: 'Dobar dan,\nkoliko košta <b>Pro</b>?\n\nHvala',
    });
    await listener.onMessageSubmitted({ contactMessageId: 'm1' });

    const { to, subject, html } = (sendMail.mock.calls as any)[0][0];
    expect(to).toBe('office@rentaj.rs');
    expect(subject).toBe('Nova poruka sa kontakt forme: Pitanje o "Pro" paketu & ceni');
    expect(html).toContain('Od: Marko &lt;script&gt;alert(1)&lt;/script&gt; (marko@example.com)<br/><br/>');
    expect(html).toContain('Naslov: Pitanje o &quot;Pro&quot; paketu &amp; ceni<br/><br/>');
    expect(html).toContain('Dobar dan,<br/>koliko košta &lt;b&gt;Pro&lt;/b&gt;?<br/><br/>Hvala');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('&amp;lt;');
  });

  it('sends nothing for a message that is gone', async () => {
    const { listener, sendMail } = setup(null as any);
    await listener.onMessageSubmitted({ contactMessageId: 'm1' });
    expect(sendMail).not.toHaveBeenCalled();
  });
});
