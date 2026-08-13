// eslint-disable-next-line @typescript-eslint/no-var-requires
const mjml2html = require('mjml');

/**
 * Ch.22.3 — every email is: logo header, title, one paragraph, one main
 * button, an optional boxed block of structured data (payment details, IPS
 * QR, invoice numbers — never admin-editable, always built by the caller),
 * footer with contact + a link to notification settings. Colors/type match
 * the frontend's design tokens (Ch.18) since this is the one surface that
 * can't `@use` them directly — emails render with no external stylesheet.
 */
const COLORS = {
  primary: '#1b4fd8',
  dark: '#0f1b33',
  background: '#f5f7fb',
  surface: '#ffffff',
  text: '#1a1a1a',
  textMuted: '#6b7280',
  border: '#e5e7eb',
};

const FONT_FAMILY = "'Funnel Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";

export interface EmailLayoutInput {
  heading: string;
  bodyText: string;
  buttonLabel?: string | null;
  buttonUrl?: string;
  /** Raw MJML markup for the boxed "extra data" section — omitted entirely when not needed. */
  extraMjml?: string;
  language: 'SR' | 'EN';
  frontendUrl: string;
}

export function renderEmailHtml(input: EmailLayoutInput): string {
  const settingsUrl = `${input.frontendUrl}/kontrolna-tabla/podesavanja`;
  const footerContact =
    input.language === 'EN'
      ? `Rentaj &middot; <a href="mailto:podrska@rentaj.rs" style="color:${COLORS.textMuted};">podrska@rentaj.rs</a> &middot; <a href="${settingsUrl}" style="color:${COLORS.textMuted};">Notification settings</a>`
      : `Rentaj &middot; <a href="mailto:podrska@rentaj.rs" style="color:${COLORS.textMuted};">podrska@rentaj.rs</a> &middot; <a href="${settingsUrl}" style="color:${COLORS.textMuted};">Podešavanja obaveštenja</a>`;

  const mjml = `
    <mjml>
      <mj-head>
        <mj-attribute name="font-family">${FONT_FAMILY}</mj-attribute>
        <mj-attribute name="color">${COLORS.text}</mj-attribute>
        <mj-breakpoint width="480px" />
      </mj-head>
      <mj-body background-color="${COLORS.background}">
        <mj-section padding="32px 16px 8px">
          <mj-column>
            <mj-text align="center" font-size="20px" font-weight="700" color="${COLORS.dark}">Rentaj</mj-text>
          </mj-column>
        </mj-section>
        <mj-section background-color="${COLORS.surface}" border-radius="14px" padding="32px 32px" css-class="card">
          <mj-column>
            <mj-text font-size="22px" font-weight="600" color="${COLORS.text}" padding-bottom="12px">${input.heading}</mj-text>
            <mj-text font-size="15px" color="${COLORS.text}" line-height="1.6" padding-bottom="24px">${input.bodyText}</mj-text>
            ${
              input.buttonLabel && input.buttonUrl
                ? `<mj-button background-color="${COLORS.primary}" color="#ffffff" border-radius="8px" font-size="15px" font-weight="600" href="${input.buttonUrl}" padding-bottom="8px">${input.buttonLabel}</mj-button>`
                : ''
            }
            ${
              input.extraMjml
                ? `<mj-section background-color="${COLORS.background}" border-radius="8px" padding="16px" margin-top="16px"><mj-column>${input.extraMjml}</mj-column></mj-section>`
                : ''
            }
          </mj-column>
        </mj-section>
        <mj-section padding="16px">
          <mj-column>
            <mj-text align="center" font-size="12px" color="${COLORS.textMuted}">${footerContact}</mj-text>
          </mj-column>
        </mj-section>
      </mj-body>
    </mjml>
  `;

  const { html, errors } = mjml2html(mjml, { validationLevel: 'soft' });
  if (errors?.length) {
    // Non-fatal — MJML degrades gracefully; surfaced only for local debugging.
    // eslint-disable-next-line no-console
    console.warn('MJML validation warnings:', errors.map((e: { formattedMessage: string }) => e.formattedMessage));
  }
  return html;
}
