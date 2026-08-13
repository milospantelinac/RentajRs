"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildIpsQrPayload = buildIpsQrPayload;
function buildIpsQrPayload(input) {
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
function truncate(value, max) {
    return value.length > max ? value.slice(0, max) : value;
}
//# sourceMappingURL=ips-qr.js.map