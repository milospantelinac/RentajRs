/**
 * T134: what a Basic listing shows of its owner's phone before a visitor asks
 * for it, "062 *** ***". Only the operator or area prefix leaves the server
 * with the page, written the national way; a number stored as +381 62 ... or
 * 00381 62 ... reads 062 too. A foreign number keeps its first three digits
 * after the "+" instead.
 * The masked part never follows the stored length, so it gives nothing away.
 */
export function maskPhone(phone: string): string {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (trimmed.startsWith('+') || trimmed.startsWith('00')) {
    const international = trimmed.startsWith('+') ? digits : digits.slice(2);
    const lead = international.startsWith('381')
      ? `0${international.slice(3, 5)}`
      : `+${international.slice(0, 3)}`;
    return `${lead} *** ***`;
  }
  return `${digits.slice(0, 3)} *** ***`;
}
