"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DERIVED_KEY_PREFIXES = void 0;
exports.deleteByPrefix = deleteByPrefix;
exports.DERIVED_KEY_PREFIXES = ['taxonomy:', 'subscriptions:', 'settings:'];
async function deleteByPrefix(client, prefix) {
    const stream = client.scanStream({ match: `${prefix}*`, count: 100 });
    const keys = [];
    for await (const batch of stream) {
        keys.push(...batch);
    }
    if (keys.length)
        await client.del(keys);
}
//# sourceMappingURL=derived-keys.js.map