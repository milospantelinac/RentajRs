import { paraToRsd } from '../../common/utils/money';

export function formatRsd(para: bigint | number | null | undefined): string {
  const rsd = typeof para === 'bigint' ? paraToRsd(para) : para;
  if (rsd === null || rsd === undefined) return '';
  return `${new Intl.NumberFormat('sr-RS').format(rsd)} RSD`;
}

// T82 — without an explicit timeZone, toLocaleString/toLocaleDateString use
// the Node PROCESS's timezone, not the reader's. The backend container runs
// UTC while readers are in Belgrade, so a deadline like 22:06 local rendered
// here as 20:06 — a 2-hour gap between what the app screen (browser, always
// correctly local) and this email/notification text showed for the exact
// same instant. Pinning the zone makes this deployment-environment-proof.
const TIME_ZONE = 'Europe/Belgrade';

export function formatDate(date: Date | string | null | undefined, locale: 'sr-Latn-RS' | 'en-US'): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: TIME_ZONE });
}

export function formatDateTime(date: Date | string | null | undefined, locale: 'sr-Latn-RS' | 'en-US'): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString(locale, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: TIME_ZONE });
}

// 'sr-Latn-RS' — matches the frontend's <html lang> (nuxt.config.ts); plain
// 'sr-RS' resolves to Cyrillic month names in Node's ICU data, which would
// read as a jarring script-switch against the rest of the (Latin-script) UI.
export function localeFor(language: 'SR' | 'EN'): 'sr-Latn-RS' | 'en-US' {
  return language === 'EN' ? 'en-US' : 'sr-Latn-RS';
}
