/**
 * egressGuard.test.ts — SSRF egress policy.
 *
 * Negative tests: private / loopback / link-local / ULA / metadata / mapped
 * targets, non-https schemes, non-default ports, embedded credentials, and
 * hostnames that RESOLVE to a blocked address are all rejected. A public
 * https host resolving to a public address is allowed.
 *
 * These fail without egressGuard.ts (the module did not exist) — they are the
 * SSRF defense proof for the apply-share webhook path.
 */

import {
  assertUrlPolicy,
  assertEgressAllowed,
  isBlockedIpLiteral,
  EgressBlockedError,
} from '../egressGuard';

const PUBLIC_IP = '93.184.216.34'; // example.com — public unicast

describe('isBlockedIpLiteral', () => {
  it.each([
    ['127.0.0.1', 'loopback v4'],
    ['0.0.0.0', 'this-host v4'],
    ['10.0.0.5', 'RFC1918 10/8'],
    ['10.255.255.255', 'RFC1918 10/8 top'],
    ['172.16.0.1', 'RFC1918 172.16/12 low'],
    ['172.31.255.254', 'RFC1918 172.16/12 high'],
    ['192.168.1.1', 'RFC1918 192.168/16'],
    ['169.254.169.254', 'cloud metadata / link-local'],
    ['169.254.0.1', 'link-local'],
    ['100.64.0.1', 'CGNAT 100.64/10'],
    ['198.18.0.1', 'benchmark 198.18/15'],
    ['224.0.0.1', 'multicast'],
    ['255.255.255.255', 'broadcast'],
    ['::1', 'loopback v6'],
    ['::', 'unspecified v6'],
    ['fc00::1', 'ULA fc00::/7'],
    ['fd12:3456::1', 'ULA fd'],
    ['fe80::1', 'link-local v6'],
    ['fec0::1', 'site-local v6 (deprecated)'],
    ['ff02::1', 'multicast v6'],
    ['::ffff:127.0.0.1', 'IPv4-mapped loopback'],
    ['::ffff:169.254.169.254', 'IPv4-mapped metadata'],
    ['::ffff:10.0.0.1', 'IPv4-mapped RFC1918'],
  ])('blocks %s (%s)', (ip) => {
    expect(isBlockedIpLiteral(ip)).toBe(true);
  });

  it.each([
    [PUBLIC_IP, 'public v4'],
    ['8.8.8.8', 'public v4'],
    ['2606:4700:4700::1111', 'public v6 (Cloudflare)'],
    ['::ffff:8.8.8.8', 'IPv4-mapped public'],
  ])('allows %s (%s)', (ip) => {
    expect(isBlockedIpLiteral(ip)).toBe(false);
  });

  it('returns false for non-IP strings (classification is IP-only)', () => {
    expect(isBlockedIpLiteral('example.com')).toBe(false);
  });
});

describe('assertUrlPolicy (synchronous scheme/port/literal-IP)', () => {
  it('rejects http://', () => {
    expect(() => assertUrlPolicy('http://example.com/hook')).toThrow(EgressBlockedError);
  });

  it('rejects non-http(s) schemes', () => {
    expect(() => assertUrlPolicy('ftp://example.com/hook')).toThrow(EgressBlockedError);
    expect(() => assertUrlPolicy('file:///etc/passwd')).toThrow(EgressBlockedError);
    expect(() => assertUrlPolicy('gopher://example.com')).toThrow(EgressBlockedError);
  });

  it('rejects a non-default port', () => {
    expect(() => assertUrlPolicy('https://example.com:8080/hook')).toThrow(EgressBlockedError);
    expect(() => assertUrlPolicy('https://example.com:22/hook')).toThrow(EgressBlockedError);
  });

  it('accepts an explicit :443', () => {
    expect(() => assertUrlPolicy('https://example.com:443/hook')).not.toThrow();
  });

  it('rejects embedded credentials', () => {
    expect(() => assertUrlPolicy('https://user:pass@example.com/hook')).toThrow(EgressBlockedError);
  });

  it('rejects a literal loopback / metadata / private host', () => {
    expect(() => assertUrlPolicy('https://127.0.0.1/hook')).toThrow(EgressBlockedError);
    expect(() => assertUrlPolicy('https://169.254.169.254/latest/meta-data/')).toThrow(EgressBlockedError);
    expect(() => assertUrlPolicy('https://10.0.0.5/hook')).toThrow(EgressBlockedError);
    expect(() => assertUrlPolicy('https://[::1]/hook')).toThrow(EgressBlockedError);
    expect(() => assertUrlPolicy('https://[fc00::1]/hook')).toThrow(EgressBlockedError);
  });

  it('accepts a public https host', () => {
    const url = assertUrlPolicy('https://ehr.example.com/vcv/hook');
    expect(url.hostname).toBe('ehr.example.com');
  });

  it('sets a 502 statusCode and a machine reason on the error', () => {
    try {
      assertUrlPolicy('http://example.com');
      fail('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(EgressBlockedError);
      expect((err as EgressBlockedError).statusCode).toBe(502);
      expect((err as EgressBlockedError).reason).toBe('scheme');
    }
  });
});

describe('assertEgressAllowed (with DNS resolution)', () => {
  it('rejects a public-looking host that RESOLVES to a private address (DNS rebinding source)', async () => {
    await expect(
      assertEgressAllowed('https://sneaky.example.com/hook', {
        resolver: async () => ['10.0.0.5'],
      }),
    ).rejects.toMatchObject({ reason: 'private_ip' });
  });

  it('rejects a host that resolves to cloud metadata', async () => {
    await expect(
      assertEgressAllowed('https://sneaky.example.com/hook', {
        resolver: async () => ['169.254.169.254'],
      }),
    ).rejects.toMatchObject({ reason: 'private_ip' });
  });

  it('rejects if ANY resolved address is private (mixed A records)', async () => {
    await expect(
      assertEgressAllowed('https://sneaky.example.com/hook', {
        resolver: async () => [PUBLIC_IP, '127.0.0.1'],
      }),
    ).rejects.toMatchObject({ reason: 'private_ip' });
  });

  it('rejects when resolution fails', async () => {
    await expect(
      assertEgressAllowed('https://nxdomain.example.com/hook', {
        resolver: async () => {
          throw new Error('ENOTFOUND');
        },
      }),
    ).rejects.toMatchObject({ reason: 'dns' });
  });

  it('rejects when resolution yields no addresses', async () => {
    await expect(
      assertEgressAllowed('https://empty.example.com/hook', {
        resolver: async () => [],
      }),
    ).rejects.toMatchObject({ reason: 'dns' });
  });

  it('allows a public host resolving to a public address', async () => {
    const result = await assertEgressAllowed('https://ehr.example.com/vcv/hook', {
      resolver: async () => [PUBLIC_IP],
    });
    expect(result.url.hostname).toBe('ehr.example.com');
    expect(result.addresses).toContain(PUBLIC_IP);
  });

  it('does not resolve a literal-IP host through the resolver (already classified)', async () => {
    const resolver = jest.fn(async () => [PUBLIC_IP]);
    const result = await assertEgressAllowed('https://93.184.216.34/hook', { resolver });
    expect(resolver).not.toHaveBeenCalled();
    expect(result.addresses).toEqual(['93.184.216.34']);
  });
});
