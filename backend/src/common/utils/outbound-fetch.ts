import { promises as dns } from 'dns';
import { BlockList, isIP } from 'net';

/**
 * Where a server-side fetch of an address a user typed in must never land:
 * loopback, private, link-local, unique-local and unspecified ranges, plus the
 * shared (carrier-grade NAT), multicast and reserved ones no public feed lives
 * on. BlockList matches IPv4-mapped IPv6 (::ffff:10.0.0.1) against the IPv4
 * ranges on its own.
 */
const NON_PUBLIC_ADDRESSES = new BlockList();
NON_PUBLIC_ADDRESSES.addSubnet('0.0.0.0', 8, 'ipv4'); // unspecified, "this network"
NON_PUBLIC_ADDRESSES.addSubnet('10.0.0.0', 8, 'ipv4'); // private
NON_PUBLIC_ADDRESSES.addSubnet('100.64.0.0', 10, 'ipv4'); // shared address space (carrier-grade NAT)
NON_PUBLIC_ADDRESSES.addSubnet('127.0.0.0', 8, 'ipv4'); // loopback
NON_PUBLIC_ADDRESSES.addSubnet('169.254.0.0', 16, 'ipv4'); // link-local, cloud metadata (169.254.169.254)
NON_PUBLIC_ADDRESSES.addSubnet('172.16.0.0', 12, 'ipv4'); // private
NON_PUBLIC_ADDRESSES.addSubnet('192.168.0.0', 16, 'ipv4'); // private
NON_PUBLIC_ADDRESSES.addSubnet('224.0.0.0', 3, 'ipv4'); // multicast, reserved and broadcast
NON_PUBLIC_ADDRESSES.addSubnet('::', 96, 'ipv6'); // unspecified, loopback and the old IPv4-compatible form
NON_PUBLIC_ADDRESSES.addSubnet('fc00::', 7, 'ipv6'); // unique-local
NON_PUBLIC_ADDRESSES.addSubnet('fe80::', 10, 'ipv6'); // link-local
NON_PUBLIC_ADDRESSES.addSubnet('fec0::', 10, 'ipv6'); // site-local (deprecated)
NON_PUBLIC_ADDRESSES.addSubnet('ff00::', 8, 'ipv6'); // multicast

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const DEFAULT_MAX_REDIRECTS = 3;

/** Thrown when a host resolves to an address in NON_PUBLIC_ADDRESSES; the message is what gets stored. */
export class NonPublicAddressError extends Error {
  constructor(readonly host: string) {
    super('NON_PUBLIC_ADDRESS');
  }
}

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (!family) return false;
  return !NON_PUBLIC_ADDRESSES.check(address, family === 4 ? 'ipv4' : 'ipv6');
}

/**
 * Resolves the URL's host (every address, as the connection could use any of
 * them) and throws NonPublicAddressError unless all of them are public. An IP
 * literal is checked as it is; URL has already turned forms like 0x7f.1 into
 * 127.0.0.1.
 */
export async function assertPublicHost(url: URL): Promise<void> {
  const host = url.hostname.replace(/^\[(.*)\]$/, '$1');
  const addresses = isIP(host) ? [host] : (await dns.lookup(host, { all: true })).map((entry) => entry.address);
  if (!addresses.length || !addresses.every(isPublicAddress)) {
    throw new NonPublicAddressError(host);
  }
}

export interface UserUrlFetchOptions {
  /** Local development reads test feeds from 127.0.0.1 (config `ical.allowPrivateAddresses`). */
  allowPrivateAddresses: boolean;
  signal?: AbortSignal;
  maxRedirects?: number;
}

/**
 * fetch() for an address a user typed in, so it can't be pointed inside the
 * server's own network (server-side request forgery): only http and https,
 * every hop's host has to resolve to public addresses, and redirects are
 * followed here (at most three) so each new location is checked the same way.
 * Resolves with the first response that isn't a redirect.
 */
export async function fetchUserUrl(url: string, options: UserUrlFetchOptions): Promise<Response> {
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  let current = new URL(url);
  for (let redirects = 0; ; redirects++) {
    if (current.protocol !== 'http:' && current.protocol !== 'https:') {
      throw new Error('UNSUPPORTED_PROTOCOL');
    }
    if (!options.allowPrivateAddresses) await assertPublicHost(current);

    const response = await fetch(current.href, { redirect: 'manual', signal: options.signal });
    const location = REDIRECT_STATUSES.has(response.status) ? response.headers.get('location') : null;
    if (!location) return response;

    // The redirect's own body is never read; release its connection.
    await response.body?.cancel().catch(() => undefined);
    if (redirects >= maxRedirects) throw new Error('TOO_MANY_REDIRECTS');
    current = new URL(location, current);
  }
}
