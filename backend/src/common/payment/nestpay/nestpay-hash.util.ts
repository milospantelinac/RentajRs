import { createHash } from 'crypto';

/**
 * NestPay "3D Pay Hosting" Hash Version 2 (SHA-512), per
 * ISPC_Nestpay_Merchant_Integration_3D_PayHosting.pdf §2.1.1/§3.3.1 — the
 * only hash version that ships with a complete, unambiguous spec in the
 * merchant docs we have (ver3 is referenced but not documented). NestPay
 * explicitly keeps ver2 supported for backward compatibility.
 *
 * Escaping rule (documented): backslash first, then pipe — reversing the
 * order would double-escape a pipe that a naive first-pass already turned
 * into "\|" (the trailing "|" would get a second backslash it shouldn't).
 */
export function escapeNestPayValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
}

function sha512Base64(plaintext: string): string {
  return createHash('sha512').update(plaintext, 'utf8').digest('base64');
}

export interface BuildRequestHashInput {
  clientId: string;
  oid: string;
  amount: string;
  okUrl: string;
  failUrl: string;
  trantype: string;
  installment: string; // empty string when not using installments
  rnd: string;
  currency: string;
  storeKey: string;
}

/**
 * plaintext = clientid|oid|amount|okurl|failurl|trantype|installment|rnd||||currency|storeKey
 * The four pipes after `rnd` are not a typo — three reserved/legacy fields
 * are always sent empty in this position, exactly as NestPay's own manual
 * and code samples show it.
 */
export function buildNestPayRequestHash(input: BuildRequestHashInput): string {
  const fields = [
    input.clientId,
    input.oid,
    input.amount,
    input.okUrl,
    input.failUrl,
    input.trantype,
    input.installment,
    input.rnd,
    '',
    '',
    '',
    input.currency,
    input.storeKey,
  ];
  const plaintext = fields.map(escapeNestPayValue).join('|');
  return sha512Base64(plaintext);
}

/**
 * Fields NestPay's own security notes (§3.3.2) require to be present in
 * HASHPARAMS before a response can be trusted at all.
 */
const REQUIRED_HASH_FIELDS = ['clientid', 'oid', 'Response'];

export interface VerifyResponseResult {
  valid: boolean;
  reason?: string;
}

/**
 * Verifies a NestPay okUrl/failUrl POST body against its own HASH field.
 * HASHPARAMS tells us the exact field order NestPay used — we look each one
 * up in the response body ourselves rather than trusting HASHPARAMSVAL,
 * recompute the hash with our storeKey, and compare. This is the only way
 * the merchant can know the message really came from NestPay (anyone can
 * POST arbitrary fields to our callback URL).
 *
 * Separator is "|", not ":" — the manual's prose (§3.2.1.4) says colon, but
 * that describes the older SHA-1 ver1 format; every ver2 (SHA-512) code
 * sample in the same manual (C#, VB.Net, JSP) does `hashparams.split("|")`,
 * and the one fully worked ver2 example literally shows
 * "HASHPARAMS: clientid|oid|AuthCode|ProcReturnCode|Response|rnd". We only
 * implement ver2, so pipe is correct here.
 */
export function verifyNestPayResponseHash(body: Record<string, string>, storeKey: string): VerifyResponseResult {
  const hashParams = body.HASHPARAMS;
  const receivedHash = body.HASH;
  if (!hashParams || !receivedHash) {
    return { valid: false, reason: 'Missing HASHPARAMS or HASH in response' };
  }

  const fieldNames = hashParams.split('|').filter(Boolean);
  for (const required of REQUIRED_HASH_FIELDS) {
    if (!fieldNames.includes(required) && !(required === 'oid' && fieldNames.includes('ReturnOid'))) {
      return { valid: false, reason: `Required field "${required}" missing from HASHPARAMS` };
    }
  }

  const values = fieldNames.map((name) => escapeNestPayValue(body[name] ?? ''));
  const plaintext = values.join('|') + '|' + escapeNestPayValue(storeKey);
  const computedHash = sha512Base64(plaintext);

  if (computedHash !== receivedHash) {
    return { valid: false, reason: 'Hash mismatch — response may not be genuine' };
  }
  return { valid: true };
}
