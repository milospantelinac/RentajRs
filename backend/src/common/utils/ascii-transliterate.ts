/**
 * NestPay's "3D Pay Hosting" endpoint sits behind a WAF that rejects the
 * entire request (generic "Request Rejected" page, no field-level detail)
 * the moment ANY posted field contains a non-ASCII byte — confirmed by
 * testing directly against their real test endpoint: an em dash alone was
 * enough to trigger it, and so was a name containing plain Serbian Latin
 * diacritics (č/ć/š/ž/đ). The `encoding=utf-8` form field doesn't help —
 * this is a perimeter WAF rule, not the actual NestPay application.
 *
 * Since Serbian names, company names, and addresses routinely contain those
 * diacritics, every free-text field sent to NestPay (BillToName,
 * BillToCompany, BillToStreet1, description, ...) must be transliterated to
 * plain ASCII first. This is a real constraint of their gateway, not a
 * cosmetic choice.
 */
const SERBIAN_LATIN_MAP: Record<string, string> = {
  č: 'c', ć: 'c', š: 's', ž: 'z', đ: 'dj',
  Č: 'C', Ć: 'C', Š: 'S', Ž: 'Z', Đ: 'Dj',
};

export function toNestPaySafeAscii(text: string): string {
  if (!text) return text;
  const transliterated = text.replace(/[čćšžđČĆŠŽĐ]/g, (ch) => SERBIAN_LATIN_MAP[ch] ?? ch);
  // Defensive fallback for anything else non-ASCII (em/en dashes, curly
  // quotes, other Latin diacritics from a company name, etc.) — normalize
  // accented Latin letters to their base form, then drop whatever's left
  // rather than let a single stray character silently kill the whole
  // checkout again.
  return transliterated
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‐-―]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x00-\x7F]/g, '');
}
