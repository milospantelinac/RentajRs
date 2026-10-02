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
