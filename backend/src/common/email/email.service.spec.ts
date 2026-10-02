import { EmailService } from './email.service';
import { emailTemplates } from '../../../prisma/email-templates.seed-data';

const config = {
  get: (key: string) =>
    key === 'mail'
      ? { host: 'localhost', port: 1025, secure: false, user: '', pass: '', fromName: 'Rentaj', fromAddress: 'no-reply@rentaj.rs' }
      : 'http://front',
};

function setup(prisma: any) {
  const notifications = { createFromEmail: jest.fn(async () => undefined) };
  const service = new EmailService(config as any, prisma, notifications as any);
  const sendMail = jest.fn(async () => undefined);
  (service as any).transporter = { sendMail };
  return { service, sendMail, notifications };
}

describe('EmailService#onApplicationBootstrap', () => {
  it('adds the templates the database lacks and leaves the existing rows alone', async () => {
    const prisma = { emailTemplate: { createMany: jest.fn(async () => ({ count: 2 })) } };
    await setup(prisma).service.onApplicationBootstrap();

    const [{ data, skipDuplicates }] = prisma.emailTemplate.createMany.mock.calls[0] as any;
    expect(skipDuplicates).toBe(true);
    expect(data).toHaveLength(emailTemplates.length * 2);
    expect(data).toContainEqual({
      key: 'subscription_checkout_failed',
      language: 'SR',
      subject: 'Plaćanje nije uspelo',
      heading: 'Plaćanje za paket {paket} nije uspelo',
      bodyText: 'Uplata od {iznos} nije prošla ili je otkazana. Oglas "{oglas}" je sačuvan i na njemu ništa nije promenjeno, pa možete pokušati ponovo.',
      buttonLabel: 'Pokušaj ponovo',
    });
    expect(data.filter((row: { key: string }) => row.key === 'subscription_checkout_failed').map((row: { language: string }) => row.language)).toEqual(['SR', 'EN']);
  });

  it('lets the backend start when the templates cannot be written', async () => {
    const prisma = { emailTemplate: { createMany: jest.fn(async () => Promise.reject(new Error('relation "EmailTemplate" does not exist'))) } };
    await expect(setup(prisma).service.onApplicationBootstrap()).resolves.toBeUndefined();
  });
});

describe('EmailService#send', () => {
  const template = { subject: 'Plaćanje nije uspelo', heading: 'Plaćanje za paket {paket} nije uspelo', bodyText: 'Uplata od {iznos} nije prošla.', buttonLabel: 'Pokušaj ponovo' };
  const optedOut = () => ({
    notificationSetting: { findUnique: jest.fn(async () => ({ emailEnabled: false, appEnabled: true })) },
    emailTemplate: { findUnique: jest.fn(async () => template) },
    emailLog: { create: jest.fn(async () => ({})) },
  });
  const mail = { to: 'ivana@example.com', userId: 'u1', context: { paket: 'STANDARD', iznos: '3.340 RSD' }, buttonUrl: 'http://front/oglasi/l1/paket' };

  it('sends a failed payment even to someone who turned that email off', async () => {
    const prisma = optedOut();
    const { service, sendMail, notifications } = setup(prisma);
    await service.send({ key: 'subscription_checkout_failed', ...mail });

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'ivana@example.com', subject: 'Plaćanje nije uspelo', headers: { 'X-PM-Tag': 'subscription_checkout_failed' } }),
    );
    expect(prisma.emailLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ event: 'subscription_checkout_failed', recipient: 'ivana@example.com', status: 'SENT' }),
    });
    expect(notifications.createFromEmail).toHaveBeenCalledWith({
      userId: 'u1',
      event: 'subscription_checkout_failed',
      title: 'Plaćanje za paket STANDARD nije uspelo',
      content: 'Uplata od 3.340 RSD nije prošla.',
      linkUrl: 'http://front/oglasi/l1/paket',
    });
  });

  it('still respects the opt-out of an email that is not about money or security', async () => {
    const prisma = optedOut();
    const { service, sendMail } = setup(prisma);
    await service.send({ key: 'subscription_activated', ...mail });

    expect(sendMail).not.toHaveBeenCalled();
    expect(prisma.emailLog.create).not.toHaveBeenCalled();
  });
});

describe('EmailService#send with text a user wrote', () => {
  const prismaWith = (template: Record<string, string | null>) => ({
    notificationSetting: { findUnique: jest.fn(async () => null) },
    emailTemplate: { findUnique: jest.fn(async () => template) },
    emailLog: { create: jest.fn(async () => ({})) },
  });
  const cancelled = {
    subject: 'Rezervacija je otkazana: {oglas}',
    heading: 'Rezervacija za "{oglas}" je otkazana',
    bodyText: 'Razlog: {razlog}',
    buttonLabel: 'Otvori {oglas}',
  };
  const link = '<a href="http://evil.example">Klikni</a>';
  const sent = (sendMail: jest.Mock) => sendMail.mock.calls[0][0] as { subject: string; html: string };

  it('keeps markup in a value out of the email and leaves the subject and the bell as typed', async () => {
    const { service, sendMail, notifications } = setup(prismaWith(cancelled));
    await service.send({
      key: 'booking_cancelled',
      to: 'vlasnik@example.com',
      userId: 'u1',
      context: { oglas: `Stan & ${link}`, razlog: link },
      buttonUrl: 'http://front/rezervacije/b1',
    });

    const { subject, html } = sent(sendMail);
    const escaped = '&lt;a href=&quot;http://evil.example&quot;&gt;Klikni&lt;/a&gt;';
    expect(html).toContain(`Rezervacija za "Stan &amp; ${escaped}" je otkazana`);
    expect(html).toContain(`Razlog: ${escaped}`);
    expect(html).toContain(`Otvori Stan &amp; ${escaped}`);
    expect(html).not.toContain('href="http://evil.example"');
    expect(html).toContain('href="http://front/rezervacije/b1"');
    expect(subject).toBe(`Rezervacija je otkazana: Stan & ${link}`);
    expect(notifications.createFromEmail).toHaveBeenCalledWith(
      expect.objectContaining({ title: `Rezervacija za "Stan & ${link}" je otkazana`, content: `Razlog: ${link}` }),
    );
  });

  it('cannot close the text block to add a button of its own', async () => {
    const { service, sendMail } = setup(prismaWith(cancelled));
    const breakout = '</mj-text><mj-button href="http://evil.example">Plati</mj-button><mj-text>';
    await service.send({ key: 'booking_cancelled', to: 'vlasnik@example.com', context: { oglas: 'Stan', razlog: breakout } });

    const { html } = sent(sendMail);
    expect(html).not.toContain('href="http://evil.example"');
    expect(html).toContain('Razlog: &lt;/mj-text&gt;&lt;mj-button href=&quot;http://evil.example&quot;&gt;Plati&lt;/mj-button&gt;&lt;mj-text&gt;');
  });

  it('keeps the tags of the copy itself and the line breaks of a message', async () => {
    const copy = { subject: 'Nova poruka: {naslov}', heading: 'Nova poruka', bodyText: 'Od: {ime}<br/><br/>{poruka}', buttonLabel: null };
    const { service, sendMail, notifications } = setup(prismaWith(copy));
    await service.send({
      key: 'contact_message_received',
      to: 'office@rentaj.rs',
      context: { ime: "Ana O'Neil", naslov: 'Pitanje o "Pro" & cenama', poruka: 'Prvi red\r\ndrugi <b>red</b>\ntreći' },
    });

    const { subject, html } = sent(sendMail);
    expect(html).toContain('Od: Ana O&#39;Neil<br/><br/>Prvi red<br/>drugi &lt;b&gt;red&lt;/b&gt;<br/>treći');
    expect(subject).toBe('Nova poruka: Pitanje o "Pro" & cenama');
    expect(notifications.createFromEmail).not.toHaveBeenCalled();
  });
});
