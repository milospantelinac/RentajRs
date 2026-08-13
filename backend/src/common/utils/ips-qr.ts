/**
 * NBS IPS QR payload builder (R51/Ch.6.4). This is the National Bank of
 * Serbia's standard for domestic instant-payment QR codes — a pipe-delimited
 * key:value payload, not a paid API. Field reference:
 *   K  — code, always "PR" (payment order)
 *   V  — version, "01"
 *   C  — charset, "1" = UTF-8
 *   R  — recipient account, 18 digits, no dashes/spaces
 *   N  — recipient name
 *   I  — amount, format RSD<amount with 2 decimals>
 *   SF — payment code (šifra plaćanja) — "289" (other/misc) is the safe
 *        general-purpose default for a peer-to-peer style payment
 *   S  — payment purpose (free text)
 *   RO — reference number (poziv na broj)
 *
 * IMPORTANT: this MVP implementation is built from the publicly documented
 * field structure, not validated against NBS's own conformance test suite —
 * see DOCUMENTATION.md "Assumptions" for the pre-launch verification this
 * needs (Product Bible §Rizici also flags Banca Intesa/fiscalization
 * integrations as needing real-world confirmation before going live, same
 * category of risk).
 */
export interface IpsQrInput {
  recipientAccount: string; // e.g. "160-0000000012345-67"
  recipientName: string;
  amountRsd: number;
  purpose: string;
  referenceNumber: string;
}

export function buildIpsQrPayload(input: IpsQrInput): string {
  const account = input.recipientAccount.replace(/[^0-9]/g, '');
  const amount = input.amountRsd.toFixed(2);
  const fields = [
    'K:PR',
    'V:01',
    'C:1',
    `R:${account}`,
    `N:${truncate(input.recipientName, 70)}`,
    `I:RSD${amount}`,
    'SF:289',
    `S:${truncate(input.purpose, 35)}`,
    `RO:${input.referenceNumber}`,
  ];
  return fields.join('|');
}

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}
