import { paraToRsd } from './money';

/**
 * NBS IPS QR payload (R51/Ch.6.4, rebuilt for T142). The National Bank of
 * Serbia's standard for domestic instant-payment QR codes: pipe-delimited
 * tag:value pairs, defined in the annex "Standardised two-dimensional code"
 * of its instant credit transfer decision. Every rule below was checked
 * against the NBS validator (ips.nbs.rs, or POST the text to
 * https://nbs.rs/QRcode/api/qr/v1/validate):
 *   K  - "PR", a payee's own code
 *   V  - "01"
 *   C  - "1", UTF-8
 *   R  - payee account as exactly 18 digits: bank 3, account 13 with leading
 *        zeros, control 2; the whole number mod 97 must be 1
 *   N  - payee, at most 70 characters; an optional second line (seat or
 *        place) after CRLF counts towards the 70
 *   I  - "RSD" and the amount with a decimal comma (RSD20000,00)
 *   SF - payment code 221, goods and services for final consumption (289 is
 *        for transactions between citizens only)
 *   S  - purpose, at most 35 characters
 *   RO - "00" (no model) and the reference, letters and digits only, at most
 *        25 characters; left out when there is no reference
 * N and S take only Latin letters of Serbian and English, digits and the
 * annex's special characters, so Cyrillic is transliterated, dashes and
 * other accents are folded and anything else is dropped. "|" separates the
 * tags and can never be part of a value.
 */
export interface IpsQrInput {
  recipientAccount: string; // e.g. "160-1234-60" or "160000000000123460"
  recipientName: string;
  recipientPlace?: string | null;
  amountPara: bigint;
  purpose: string;
  referenceNumber?: string | null;
}

/** Bank code, account and control digits as the 18-digit string R wants, or null when that is not a valid Serbian account. */
export function normalizeBankAccount(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim();
  let parts: string[];
  if (/^\d{3}-\d{1,13}-\d{2}$/.test(value)) parts = value.split('-');
  else if (/^\d{6,18}$/.test(value)) parts = [value.slice(0, 3), value.slice(3, -2), value.slice(-2)];
  else return null;
  const digits = parts[0] + parts[1].padStart(13, '0') + parts[2];
  return BigInt(digits) % 97n === 1n ? digits : null;
}

/** The account as people write it, "160-0000000001234-60", or the stored text when it is not valid. */
export function formatBankAccount(raw: string | null | undefined): string {
  const digits = normalizeBankAccount(raw);
  return digits ? `${digits.slice(0, 3)}-${digits.slice(3, 16)}-${digits.slice(16)}` : (raw ?? '');
}

export interface PayeeOwner {
  firstName: string;
  lastName: string;
  buyerType?: string | null;
  companyName?: string | null;
  billingAddress?: string | null;
}

/** Who the transfer goes to: a company under its name and seat, a person under first and last name. */
export function bankTransferPayee(owner: PayeeOwner): { name: string; place: string | null } {
  const company = owner.buyerType === 'COMPANY' ? owner.companyName?.trim() : '';
  if (company) return { name: company, place: owner.billingAddress?.trim() || null };
  return { name: `${owner.firstName} ${owner.lastName}`.trim(), place: null };
}

/**
 * How the code is drawn: whole pixels per module. A fixed width (320px) gave
 * modules of fractional size, and then some valid codes (one for "Đorđe
 * Ljubić" paying for "Igraonica Balončići") did not read in the NBS
 * validator at all. The page and the email size the picture themselves.
 */
export const IPS_QR_IMAGE_OPTIONS = { scale: 8, margin: 1 } as const;

/** The "poziv na broj" a booking is paid with: its id, shortened, the same on every screen and email. */
export function bookingPaymentReference(bookingId: string): string {
  return bookingId.replace(/-/g, '').slice(0, 20);
}

/**
 * What a booking's bank transfer pays, as the text a guest can copy and as
 * the IPS QR payload (null when no valid code can be made), built in one
 * place so the two never disagree.
 */
export function bookingBankTransfer(
  booking: { id: string; amountDue: bigint },
  owner: PayeeOwner & { bankAccount: string },
  purpose: string,
) {
  const payee = bankTransferPayee(owner);
  const referenceNumber = bookingPaymentReference(booking.id);
  return {
    details: {
      recipientName: payee.name,
      recipientAccount: formatBankAccount(owner.bankAccount),
      amountRsd: paraToRsd(booking.amountDue),
      purpose,
      referenceNumber,
    },
    qrPayload: buildIpsQrPayload({
      recipientAccount: owner.bankAccount,
      recipientName: payee.name,
      recipientPlace: payee.place,
      amountPara: booking.amountDue,
      purpose,
      referenceNumber,
    }),
  };
}

export function buildIpsQrPayload(input: IpsQrInput): string | null {
  const account = normalizeBankAccount(input.recipientAccount);
  const name = ipsText(input.recipientName, 70);
  const amount = ipsAmount(input.amountPara);
  if (!account || !name || !amount) return null;

  // The seat goes in only whole: half an address is worse than none.
  const place = input.recipientPlace ? ipsText(input.recipientPlace, Infinity) : '';
  const payee = place && name.length + 2 + place.length <= 70 ? `${name}\r\n${place}` : name;
  const purpose = ipsText(input.purpose, 35);
  const reference = (input.referenceNumber ?? '').replace(/[^0-9A-Za-z]/g, '');

  const fields = ['K:PR', 'V:01', 'C:1', `R:${account}`, `N:${payee}`, `I:${amount}`, 'SF:221'];
  if (purpose) fields.push(`S:${purpose}`);
  if (reference) fields.push(`RO:${`00${reference}`.slice(0, 25)}`);
  return fields.join('|');
}

function ipsAmount(para: bigint): string | null {
  if (para < 0n || para > 99_999_999_999_999n) return null;
  return `RSD${para / 100n},${(para % 100n).toString().padStart(2, '0')}`;
}

const CYRILLIC_TO_LATIN: Record<string, string> = {
  А: 'A', Б: 'B', В: 'V', Г: 'G', Д: 'D', Ђ: 'Đ', Е: 'E', Ж: 'Ž', З: 'Z', И: 'I', Ј: 'J', К: 'K', Л: 'L', Љ: 'Lj', М: 'M',
  Н: 'N', Њ: 'Nj', О: 'O', П: 'P', Р: 'R', С: 'S', Т: 'T', Ћ: 'Ć', У: 'U', Ф: 'F', Х: 'H', Ц: 'C', Ч: 'Č', Џ: 'Dž', Ш: 'Š',
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', ђ: 'đ', е: 'e', ж: 'ž', з: 'z', и: 'i', ј: 'j', к: 'k', л: 'l', љ: 'lj', м: 'm',
  н: 'n', њ: 'nj', о: 'o', п: 'p', р: 'r', с: 's', т: 't', ћ: 'ć', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'č', џ: 'dž', ш: 'š',
};
const SERBIAN_LATIN = 'čćžšđČĆŽŠĐ';
// Letters, digits, space and the annex's table of special characters.
const ALLOWED = /[A-Za-z0-9čćžšđČĆŽŠĐ !"#$%&'()*+,\-./:;<=>?@^_`{}~“”„‘’]/;

/** A value N or S accepts, cut to `max` characters on a word boundary where one is near. */
function ipsText(value: string, max: number): string {
  let out = '';
  for (const ch of value ?? '') {
    let mapped = CYRILLIC_TO_LATIN[ch] ?? ch;
    if (!SERBIAN_LATIN.includes(mapped)) {
      mapped = mapped
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[‐-―−]/g, '-')
        .replace(/\[/g, '(')
        .replace(/\]/g, ')')
        .replace(/\s/g, ' ');
    }
    for (const c of mapped) if (ALLOWED.test(c)) out += c;
  }
  out = out.replace(/ {2,}/g, ' ').trim();
  if (out.length <= max) return out;
  const cut = out.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace >= max - 10 ? cut.slice(0, lastSpace) : cut).trim();
}
