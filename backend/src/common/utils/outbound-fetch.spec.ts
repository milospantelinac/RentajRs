import * as dns from 'dns';
import { NonPublicAddressError, assertPublicHost, fetchUserUrl, isPublicAddress } from './outbound-fetch';

function records(...addresses: string[]) {
  return addresses.map((address) => ({ address, family: address.includes(':') ? 6 : 4 })) as any;
}

function redirect(location: string | null, status = 302) {
  return {
    status,
    ok: false,
    headers: { get: (name: string) => (name.toLowerCase() === 'location' ? location : null) },
    body: { cancel: jest.fn().mockResolvedValue(undefined) },
  };
}

function final(status = 200) {
  return { status, ok: status >= 200 && status < 300, headers: { get: () => null }, body: null };
}

describe('isPublicAddress', () => {
  it.each([
    ['127.0.0.1'],
    ['127.255.255.254'],
    ['10.0.0.1'],
    ['10.255.255.255'],
    ['172.16.0.1'],
    ['172.31.255.255'],
    ['192.168.1.1'],
    ['169.254.169.254'],
    ['169.254.0.1'],
    ['0.0.0.0'],
    ['0.1.2.3'],
    ['100.64.0.1'],
    ['100.127.255.255'],
    ['224.0.0.1'],
    ['255.255.255.255'],
    ['::'],
    ['::1'],
    ['0:0:0:0:0:0:0:1'],
    ['::7f00:1'],
    ['::ffff:127.0.0.1'],
    ['::ffff:10.0.0.1'],
    ['::ffff:a9fe:a9fe'],
    ['fc00::1'],
    ['fd12:3456::1'],
    ['fe80::1'],
    ['febf::1'],
    ['fec0::1'],
    ['ff02::1'],
  ])('refuses %s', (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });

  it.each([
    ['8.8.8.8'],
    ['1.1.1.1'],
    ['172.15.255.255'],
    ['172.32.0.1'],
    ['192.169.0.1'],
    ['100.63.255.255'],
    ['100.128.0.1'],
    ['169.253.255.255'],
    ['223.255.255.255'],
    ['2606:4700:4700::1111'],
    ['2a00:1450:4001:80b::200e'],
    ['::ffff:8.8.8.8'],
  ])('allows %s', (address) => {
    expect(isPublicAddress(address)).toBe(true);
  });

  it('refuses anything that is not an address', () => {
    expect(isPublicAddress('')).toBe(false);
    expect(isPublicAddress('localhost')).toBe(false);
    expect(isPublicAddress('[::1]')).toBe(false);
  });
});

describe('assertPublicHost', () => {
  let lookup: jest.SpyInstance;
  beforeEach(() => {
    lookup = jest.spyOn(dns.promises, 'lookup');
  });
  afterEach(() => lookup.mockRestore());

  it('passes a host whose every address is public', async () => {
    lookup.mockResolvedValue(records('93.184.216.34', '2606:2800:220:1:248:1893:25c8:1946'));
    await expect(assertPublicHost(new URL('https://calendar.example.com/feed.ics'))).resolves.toBeUndefined();
    expect(lookup).toHaveBeenCalledWith('calendar.example.com', { all: true });
  });

  it('refuses a host with any non-public address among its records', async () => {
    lookup.mockResolvedValue(records('93.184.216.34', '10.0.0.7'));
    const error = await assertPublicHost(new URL('https://mixed.example.com/')).catch((e) => e);
    expect(error).toBeInstanceOf(NonPublicAddressError);
    expect(error.host).toBe('mixed.example.com');
    expect(error.message).toBe('NON_PUBLIC_ADDRESS');
  });

  it('refuses a name that resolves to localhost or to nothing', async () => {
    lookup.mockResolvedValueOnce(records('::1', '127.0.0.1')).mockResolvedValueOnce([]);
    await expect(assertPublicHost(new URL('http://localhost:3001/'))).rejects.toBeInstanceOf(NonPublicAddressError);
    await expect(assertPublicHost(new URL('http://empty.example.com/'))).rejects.toBeInstanceOf(NonPublicAddressError);
  });

  it('checks IP literals as they are, IPv6 in brackets and shorthand IPv4 included', async () => {
    for (const url of [
      'http://127.0.0.1:3399/a.ics',
      'http://[::1]/a.ics',
      'http://0x7f.1/a.ics',
      'http://2130706433/',
      'http://169.254.169.254/latest/meta-data/',
      'http://[::ffff:10.0.0.1]/',
      'http://[fd00::5]:8080/',
    ]) {
      await expect(assertPublicHost(new URL(url))).rejects.toBeInstanceOf(NonPublicAddressError);
    }
    await expect(assertPublicHost(new URL('http://[2606:4700:4700::1111]/'))).resolves.toBeUndefined();
    await expect(assertPublicHost(new URL('http://8.8.8.8/'))).resolves.toBeUndefined();
    expect(lookup).not.toHaveBeenCalled();
  });

  it('passes a failed lookup on as it is', async () => {
    lookup.mockRejectedValue(Object.assign(new Error('getaddrinfo ENOTFOUND nope.invalid'), { code: 'ENOTFOUND' }));
    await expect(assertPublicHost(new URL('https://nope.invalid/'))).rejects.toThrow('ENOTFOUND');
  });
});

describe('fetchUserUrl', () => {
  const fetchMock = jest.fn();
  const originalFetch = global.fetch;
  let lookup: jest.SpyInstance;

  beforeAll(() => {
    global.fetch = fetchMock as any;
  });
  afterAll(() => {
    global.fetch = originalFetch;
  });
  beforeEach(() => {
    fetchMock.mockReset();
    // Names under .internal stand for hosts inside the server's network.
    lookup = jest
      .spyOn(dns.promises, 'lookup')
      .mockImplementation(async (host: any) => records(String(host).endsWith('.internal') ? '10.0.0.5' : '93.184.216.34'));
  });
  afterEach(() => lookup.mockRestore());

  const strict = { allowPrivateAddresses: false };

  it('follows up to three redirects by hand and checks the host of every hop', async () => {
    fetchMock
      .mockResolvedValueOnce(redirect('https://b.example.com/feed'))
      .mockResolvedValueOnce(redirect('/relative.ics', 301))
      .mockResolvedValueOnce(redirect('https://c.example.com/x', 307))
      .mockResolvedValueOnce(final());

    const response = await fetchUserUrl('https://a.example.com/start', strict);

    expect(response.status).toBe(200);
    expect(fetchMock.mock.calls.map(([url, init]) => [url, init.redirect])).toEqual([
      ['https://a.example.com/start', 'manual'],
      ['https://b.example.com/feed', 'manual'],
      ['https://b.example.com/relative.ics', 'manual'],
      ['https://c.example.com/x', 'manual'],
    ]);
    expect(lookup.mock.calls.map(([host]) => host)).toEqual(['a.example.com', 'b.example.com', 'b.example.com', 'c.example.com']);
  });

  it('gives up on the fourth redirect', async () => {
    fetchMock.mockImplementation(async () => redirect('https://loop.example.com/again'));
    await expect(fetchUserUrl('https://loop.example.com/', strict)).rejects.toThrow('TOO_MANY_REDIRECTS');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('never fetches a host inside the network', async () => {
    await expect(fetchUserUrl('http://db.internal:5432/', strict)).rejects.toBeInstanceOf(NonPublicAddressError);
    await expect(fetchUserUrl('http://127.0.0.1:3399/good.ics', strict)).rejects.toBeInstanceOf(NonPublicAddressError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses a redirect into the network before following it', async () => {
    for (const location of ['http://metadata.internal/latest/', 'http://169.254.169.254/latest/meta-data/', 'http://[::1]:6379/']) {
      fetchMock.mockReset();
      const hop = redirect(location);
      fetchMock.mockResolvedValueOnce(hop);
      await expect(fetchUserUrl('https://feeds.example.com/cal.ics', strict)).rejects.toBeInstanceOf(NonPublicAddressError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(hop.body.cancel).toHaveBeenCalled();
    }
  });

  it('refuses addresses and redirects that are not http or https', async () => {
    await expect(fetchUserUrl('ftp://files.example.com/cal.ics', strict)).rejects.toThrow('UNSUPPORTED_PROTOCOL');
    fetchMock.mockResolvedValueOnce(redirect('file:///etc/passwd'));
    await expect(fetchUserUrl('https://a.example.com/', strict)).rejects.toThrow('UNSUPPORTED_PROTOCOL');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('hands back a redirect without a location as the response it is', async () => {
    const noLocation = redirect(null, 302);
    fetchMock.mockResolvedValueOnce(noLocation);
    await expect(fetchUserUrl('https://a.example.com/', strict)).resolves.toBe(noLocation);
    fetchMock.mockResolvedValueOnce(final(404));
    await expect(fetchUserUrl('https://a.example.com/missing', strict)).resolves.toMatchObject({ status: 404 });
  });

  it('passes the caller signal to every hop', async () => {
    const signal = new AbortController().signal;
    fetchMock.mockResolvedValueOnce(redirect('https://b.example.com/')).mockResolvedValueOnce(final());
    await fetchUserUrl('https://a.example.com/', { ...strict, signal });
    expect(fetchMock.mock.calls.every(([, init]) => init.signal === signal)).toBe(true);
  });

  it('skips the address check where private addresses are allowed, and still follows redirects by hand', async () => {
    fetchMock.mockResolvedValueOnce(redirect('http://127.0.0.1:3399/good.ics')).mockResolvedValueOnce(final());
    const response = await fetchUserUrl('http://127.0.0.1:3399/start', { allowPrivateAddresses: true });
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(lookup).not.toHaveBeenCalled();
  });
});
