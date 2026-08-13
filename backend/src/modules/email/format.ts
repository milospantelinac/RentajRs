import { paraToRsd } from '../../common/utils/money';

export function formatRsd(para: bigint | number | null | undefined): string {
  const rsd = typeof para === 'bigint' ? paraToRsd(para) : para;
  if (rsd === null || rsd === undefined) return '';
  return `${new Intl.NumberFormat('sr-RS').format(rsd)} RSD`;
}

export function formatDate(date: Date | string | null | undefined, locale: 'sr-Latn-RS' | 'en-US'): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatDateTime(date: Date | string | null | undefined, locale: 'sr-Latn-RS' | 'en-US'): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString(locale, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// 'sr-Latn-RS' — matches the frontend's <html lang> (nuxt.config.ts); plain
// 'sr-RS' resolves to Cyrillic month names in Node's ICU data, which would
// read as a jarring script-switch against the rest of the (Latin-script) UI.
export function localeFor(language: 'SR' | 'EN'): 'sr-Latn-RS' | 'en-US' {
  return language === 'EN' ? 'en-US' : 'sr-Latn-RS';
}
