"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NonPublicAddressError = void 0;
exports.isPublicAddress = isPublicAddress;
exports.assertPublicHost = assertPublicHost;
exports.fetchUserUrl = fetchUserUrl;
const dns_1 = require("dns");
const net_1 = require("net");
const NON_PUBLIC_ADDRESSES = new net_1.BlockList();
NON_PUBLIC_ADDRESSES.addSubnet('0.0.0.0', 8, 'ipv4');
NON_PUBLIC_ADDRESSES.addSubnet('10.0.0.0', 8, 'ipv4');
NON_PUBLIC_ADDRESSES.addSubnet('100.64.0.0', 10, 'ipv4');
NON_PUBLIC_ADDRESSES.addSubnet('127.0.0.0', 8, 'ipv4');
NON_PUBLIC_ADDRESSES.addSubnet('169.254.0.0', 16, 'ipv4');
NON_PUBLIC_ADDRESSES.addSubnet('172.16.0.0', 12, 'ipv4');
NON_PUBLIC_ADDRESSES.addSubnet('192.168.0.0', 16, 'ipv4');
NON_PUBLIC_ADDRESSES.addSubnet('224.0.0.0', 3, 'ipv4');
NON_PUBLIC_ADDRESSES.addSubnet('::', 96, 'ipv6');
NON_PUBLIC_ADDRESSES.addSubnet('fc00::', 7, 'ipv6');
NON_PUBLIC_ADDRESSES.addSubnet('fe80::', 10, 'ipv6');
NON_PUBLIC_ADDRESSES.addSubnet('fec0::', 10, 'ipv6');
NON_PUBLIC_ADDRESSES.addSubnet('ff00::', 8, 'ipv6');
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const DEFAULT_MAX_REDIRECTS = 3;
class NonPublicAddressError extends Error {
    constructor(host) {
        super('NON_PUBLIC_ADDRESS');
        this.host = host;
    }
}
exports.NonPublicAddressError = NonPublicAddressError;
function isPublicAddress(address) {
    const family = (0, net_1.isIP)(address);
    if (!family)
        return false;
    return !NON_PUBLIC_ADDRESSES.check(address, family === 4 ? 'ipv4' : 'ipv6');
}
async function assertPublicHost(url) {
    const host = url.hostname.replace(/^\[(.*)\]$/, '$1');
    const addresses = (0, net_1.isIP)(host) ? [host] : (await dns_1.promises.lookup(host, { all: true })).map((entry) => entry.address);
    if (!addresses.length || !addresses.every(isPublicAddress)) {
        throw new NonPublicAddressError(host);
    }
}
async function fetchUserUrl(url, options) {
    const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
    let current = new URL(url);
    for (let redirects = 0;; redirects++) {
        if (current.protocol !== 'http:' && current.protocol !== 'https:') {
            throw new Error('UNSUPPORTED_PROTOCOL');
        }
        if (!options.allowPrivateAddresses)
            await assertPublicHost(current);
        const response = await fetch(current.href, { redirect: 'manual', signal: options.signal });
        const location = REDIRECT_STATUSES.has(response.status) ? response.headers.get('location') : null;
        if (!location)
            return response;
        await response.body?.cancel().catch(() => undefined);
        if (redirects >= maxRedirects)
            throw new Error('TOO_MANY_REDIRECTS');
        current = new URL(location, current);
    }
}
//# sourceMappingURL=outbound-fetch.js.map