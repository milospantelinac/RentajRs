"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderEmailHtml = renderEmailHtml;
const mjml2html = require('mjml');
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
function renderEmailHtml(input) {
    const settingsUrl = `${input.frontendUrl}/kontrolna-tabla/podesavanja`;
    const footerContact = input.language === 'EN'
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
            ${input.buttonLabel && input.buttonUrl
        ? `<mj-button background-color="${COLORS.primary}" color="#ffffff" border-radius="8px" font-size="15px" font-weight="600" href="${input.buttonUrl}" padding-bottom="8px">${input.buttonLabel}</mj-button>`
        : ''}
            ${input.extraMjml
        ? `<mj-section background-color="${COLORS.background}" border-radius="8px" padding="16px" margin-top="16px"><mj-column>${input.extraMjml}</mj-column></mj-section>`
        : ''}
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
        console.warn('MJML validation warnings:', errors.map((e) => e.formattedMessage));
    }
    return html;
}
//# sourceMappingURL=mjml-layout.js.map