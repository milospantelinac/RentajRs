"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptSecret = encryptSecret;
exports.decryptSecret = decryptSecret;
const crypto_1 = require("crypto");
const ALGORITHM = 'aes-256-gcm';
function resolveKey() {
    const raw = process.env.PAYMENT_ENCRYPTION_KEY;
    if (!raw) {
        throw new Error('PAYMENT_ENCRYPTION_KEY is not set — required to store NestPay secrets');
    }
    const key = raw.includes('/') || raw.includes('+') || raw.endsWith('=') ? Buffer.from(raw, 'base64') : Buffer.from(raw, 'hex');
    if (key.length !== 32) {
        throw new Error('PAYMENT_ENCRYPTION_KEY must decode to exactly 32 bytes (AES-256)');
    }
    return key;
}
function encryptSecret(plaintext) {
    const key = resolveKey();
    const iv = (0, crypto_1.randomBytes)(12);
    const cipher = (0, crypto_1.createCipheriv)(ALGORITHM, key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext.toString('base64')}`;
}
function decryptSecret(encoded) {
    const [ivB64, tagB64, dataB64] = encoded.split(':');
    if (!ivB64 || !tagB64 || !dataB64) {
        throw new Error('Malformed encrypted secret payload');
    }
    const key = resolveKey();
    const decipher = (0, crypto_1.createDecipheriv)(ALGORITHM, key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const plaintext = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]);
    return plaintext.toString('utf8');
}
//# sourceMappingURL=secret-crypto.js.map