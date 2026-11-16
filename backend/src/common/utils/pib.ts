/**
 * A Serbian PIB: nine digits, the last one a check digit (ISO 7064, MOD 11,10).
 * A company's PIB goes onto its fiscal receipt as the buyer's ID, so one that
 * does not add up is caught at the checkout instead of at the Tax Administration.
 */

/** What people type: spaces, dots, dashes and the "RS" prefix are dropped. */
export function normalizePib(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/^RS/i, '').replace(/[\s.-]/g, '');
}

export function isValidPib(value: string | null | undefined): boolean {
  const pib = normalizePib(value);
  if (!/^\d{9}$/.test(pib)) return false;
  let remainder = 10;
  for (let i = 0; i < 8; i++) {
    remainder = (remainder + Number(pib[i])) % 10;
    if (remainder === 0) remainder = 10;
    remainder = (remainder * 2) % 11;
  }
  return (11 - remainder) % 10 === Number(pib[8]);
}
