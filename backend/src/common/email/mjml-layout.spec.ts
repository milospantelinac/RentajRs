import { renderEmailHtml } from './mjml-layout';

describe('renderEmailHtml footer', () => {
  const base = { heading: 'Naslov', bodyText: 'Tekst', frontendUrl: 'http://front' };

  it('points the Serbian footer at office@rentaj.rs and at the notification settings', () => {
    const html = renderEmailHtml({ ...base, language: 'SR' });

    expect(html).toContain('href="mailto:office@rentaj.rs"');
    expect(html).toContain('>office@rentaj.rs</a>');
    expect(html).toContain('href="http://front/kontrolna-tabla/podesavanja"');
    expect(html).toContain('Podešavanja obaveštenja');
    expect(html).not.toContain('podrska@');
  });

  it('points the English footer at office@rentaj.rs and at the notification settings', () => {
    const html = renderEmailHtml({ ...base, language: 'EN' });

    expect(html).toContain('href="mailto:office@rentaj.rs"');
    expect(html).toContain('>office@rentaj.rs</a>');
    expect(html).toContain('Notification settings');
    expect(html).not.toContain('podrska@');
  });
});
