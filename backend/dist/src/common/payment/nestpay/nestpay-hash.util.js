"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.escapeNestPayValue = escapeNestPayValue;
exports.buildNestPayRequestHash = buildNestPayRequestHash;
exports.verifyNestPayResponseHash = verifyNestPayResponseHash;
const crypto_1 = require("crypto");
function escapeNestPayValue(value) {
    return value.replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
}
function sha512Base64(plaintext) {
    return (0, crypto_1.createHash)('sha512').update(plaintext, 'utf8').digest('base64');
}
function buildNestPayRequestHash(input) {
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
const REQUIRED_HASH_FIELDS = ['clientid', 'oid', 'Response'];
function verifyNestPayResponseHash(body, storeKey) {
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
//# sourceMappingURL=nestpay-hash.util.js.map