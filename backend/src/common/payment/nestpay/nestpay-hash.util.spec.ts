import { createHash } from 'crypto';
import {
  buildNestPayRequestHash,
  escapeNestPayValue,
  verifyNestPayResponseHash,
} from './nestpay-hash.util';

describe('escapeNestPayValue', () => {
  it('leaves plain text unchanged', () => {
    expect(escapeNestPayValue('plain')).toBe('plain');
  });

  it('escapes a pipe with a backslash', () => {
    expect(escapeNestPayValue('a|b')).toBe('a\\|b');
  });

  it('escapes a literal backslash by doubling it', () => {
    expect(escapeNestPayValue('a\\b')).toBe('a\\\\b');
  });

  it('escapes backslashes before pipes, without double-escaping a trailing pipe', () => {
    // Input: a \ | b  ->  backslash doubled first, pipe escaped second.
    expect(escapeNestPayValue('a\\|b')).toBe('a\\\\\\|b');
  });
});

describe('buildNestPayRequestHash', () => {
  const input = {
    clientId: 'client123',
    oid: 'RJ-000123',
    amount: '150000',
    okUrl: 'https://rentaj.rs/pay/ok',
    failUrl: 'https://rentaj.rs/pay/fail',
    trantype: 'Auth',
    installment: '',
    rnd: 'abc123',
    currency: '941',
    storeKey: 'secret-store-key',
  };

  it('is deterministic for the same input', () => {
    expect(buildNestPayRequestHash(input)).toBe(buildNestPayRequestHash({ ...input }));
  });

  it('produces a base64-looking SHA-512 digest', () => {
    const hash = buildNestPayRequestHash(input);
    expect(hash).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    expect(Buffer.from(hash, 'base64').length).toBe(64); // SHA-512 = 64 bytes
  });

  it('changes when any field changes', () => {
    const base = buildNestPayRequestHash(input);
    expect(buildNestPayRequestHash({ ...input, amount: '150001' })).not.toBe(base);
    expect(buildNestPayRequestHash({ ...input, storeKey: 'different-key' })).not.toBe(base);
  });

  it('matches a manually-built plaintext (field order + trailing empties)', () => {
    const plaintext = [
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
    ].join('|');
    const expected = createHash('sha512').update(plaintext, 'utf8').digest('base64');
    expect(buildNestPayRequestHash(input)).toBe(expected);
  });
});

describe('verifyNestPayResponseHash', () => {
  const storeKey = 'secret-store-key';

  function signBody(fields: Record<string, string>, order: string[]): string {
    const values = order.map((name) => escapeNestPayValue(fields[name] ?? ''));
    const plaintext = values.join('|') + '|' + escapeNestPayValue(storeKey);
    return createHash('sha512').update(plaintext, 'utf8').digest('base64');
  }

  it('accepts a genuinely-signed response', () => {
    const order = ['clientid', 'oid', 'AuthCode', 'ProcReturnCode', 'Response', 'rnd'];
    const fields = {
      clientid: 'client123',
      oid: 'RJ-000123',
      AuthCode: '000000',
      ProcReturnCode: '00',
      Response: 'Approved',
      rnd: 'abc123',
    };
    const body = { ...fields, HASHPARAMS: order.join('|'), HASH: signBody(fields, order) };
    expect(verifyNestPayResponseHash(body, storeKey)).toEqual({ valid: true });
  });

  it('rejects a response with a tampered field', () => {
    const order = ['clientid', 'oid', 'Response'];
    const fields = { clientid: 'client123', oid: 'RJ-000123', Response: 'Approved' };
    const hash = signBody(fields, order);
    const tampered = { ...fields, Response: 'Declined', HASHPARAMS: order.join('|'), HASH: hash };
    expect(verifyNestPayResponseHash(tampered, storeKey)).toEqual({
      valid: false,
      reason: 'Hash mismatch — response may not be genuine',
    });
  });

  it('rejects when HASHPARAMS or HASH is missing', () => {
    expect(verifyNestPayResponseHash({ clientid: 'x' }, storeKey).valid).toBe(false);
  });

  it('rejects when a required field is missing from HASHPARAMS', () => {
    const order = ['clientid', 'oid']; // missing Response
    const fields = { clientid: 'client123', oid: 'RJ-000123' };
    const body = { ...fields, HASHPARAMS: order.join('|'), HASH: signBody(fields, order) };
    const result = verifyNestPayResponseHash(body, storeKey);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/Response/);
  });

  it('accepts ReturnOid in place of oid', () => {
    const order = ['clientid', 'ReturnOid', 'Response'];
    const fields = { clientid: 'client123', ReturnOid: 'RJ-000123', Response: 'Approved' };
    const body = { ...fields, HASHPARAMS: order.join('|'), HASH: signBody(fields, order) };
    expect(verifyNestPayResponseHash(body, storeKey).valid).toBe(true);
  });
});
