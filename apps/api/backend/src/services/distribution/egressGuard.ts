/**
 * egressGuard.ts — SSRF egress policy for consequential outbound requests.
 *
 * A server-side `fetch()` whose target is even partly caller-influenced must
 * never be pointed at a private, loopback, link-local, ULA, or cloud-metadata
 * address, and must never follow a redirect to a new host. This module is the
 * single choke point that decides whether an outbound URL is allowed to leave
 * the box.
 *
 * Policy (fail closed — an address we cannot classify is treated as blocked):
 *   - https:// only
 *   - the default https port (443) only; any explicit non-default port is denied
 *   - no embedded credentials (user:pass@host)
 *   - every resolved A/AAAA address must be a public unicast address:
 *       IPv4 blocked: 0/8, 10/8, 100.64/10 (CGNAT), 127/8, 169.254/16
 *         (incl. 169.254.169.254 metadata), 172.16/12, 192.0.0/24, 192.168/16,
 *         198.18/15 (benchmark), 224/4 (multicast), 240/4 (reserved),
 *         255.255.255.255
 *       IPv6 blocked: :: (unspecified), ::1 (loopback), fc00::/7 (ULA),
 *         fe80::/10 (link-local), fec0::/10 (deprecated site-local),
 *         ff00::/8 (multicast), and IPv4-mapped ::ffff:a.b.c.d classified via
 *         the embedded IPv4.
 *
 * Redirect handling is the caller's responsibility: this guard validates only
 * the INITIAL target, so callers must dispatch with `redirect: 'manual'` (or
 * 'error') and never follow to a new host.
 *
 * DNS-rebinding note: Node's global fetch re-resolves the hostname when it
 * opens the socket, so a TOCTOU window exists between validate and connect.
 * `undici`'s `Agent` (which would let us pin the socket to the validated IP) is
 * not directly importable here, so the residual is accepted for the
 * server-verified, admin-registered target this guard protects and is further
 * bounded by denying redirects. If pinning is later required, inject a pinned
 * dispatcher at the call site.
 */

import { isIP } from 'node:net';
import { lookup as dnsLookup } from 'node:dns/promises';

export class EgressBlockedError extends Error {
  readonly statusCode = 502;
  readonly reason: string;
  constructor(reason: string, message: string) {
    super(message);
    this.name = 'EgressBlockedError';
    this.reason = reason;
  }
}

/** Resolve a hostname to its A/AAAA addresses. Injectable for tests. */
export type EgressResolver = (hostname: string) => Promise<string[]>;

const defaultResolver: EgressResolver = async (hostname) => {
  const records = await dnsLookup(hostname, { all: true, verbatim: true });
  return records.map((record) => record.address);
};

const ALLOWED_PROTOCOL = 'https:';
const ALLOWED_PORT = '443';

// ── IP classification ──────────────────────────────────────────────────────

function isBlockedIpv4Octets(a: number, b: number, _c: number, _d: number): boolean {
  if (a === 0) return true; // 0.0.0.0/8 "this host"
  if (a === 10) return true; // 10.0.0.0/8 private
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local (incl. 169.254.169.254)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 private
  if (a === 192 && b === 0 && _c === 0) return true; // 192.0.0.0/24 IETF protocol assignments
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 private
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 benchmarking
  if (a >= 224) return true; // 224/4 multicast + 240/4 reserved + 255.255.255.255
  return false;
}

function isBlockedIpv4(ip: string): boolean {
  const parts = ip.split('.').map((octet) => Number(octet));
  if (parts.length !== 4 || parts.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return true; // unparseable → fail closed
  }
  return isBlockedIpv4Octets(parts[0], parts[1], parts[2], parts[3]);
}

/** Expand any IPv6 textual form (incl. embedded IPv4) to eight 16-bit groups. */
function expandIpv6(ip: string): number[] | null {
  let text = ip;

  // Embedded IPv4 dotted-quad at the tail (e.g. ::ffff:169.254.169.254).
  const lastColon = text.lastIndexOf(':');
  const tail = text.slice(lastColon + 1);
  if (tail.includes('.')) {
    const octets = tail.split('.').map((octet) => Number(octet));
    if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
      return null;
    }
    const high = ((octets[0] << 8) | octets[1]).toString(16);
    const low = ((octets[2] << 8) | octets[3]).toString(16);
    text = `${text.slice(0, lastColon + 1)}${high}:${low}`;
  }

  const halves = text.split('::');
  if (halves.length > 2) return null;

  const head = halves[0] ? halves[0].split(':') : [];
  const hasCompression = halves.length === 2;
  const tailGroups = hasCompression ? (halves[1] ? halves[1].split(':') : []) : null;

  let groups: string[];
  if (tailGroups === null) {
    groups = head;
  } else {
    const missing = 8 - head.length - tailGroups.length;
    if (missing < 0) return null;
    groups = [...head, ...new Array(missing).fill('0'), ...tailGroups];
  }
  if (groups.length !== 8) return null;

  const nums = groups.map((group) => (/^[0-9a-fA-F]{1,4}$/.test(group) ? parseInt(group, 16) : NaN));
  if (nums.some((num) => Number.isNaN(num))) return null;
  return nums;
}

function isBlockedIpv6(ip: string): boolean {
  const hextets = expandIpv6(ip);
  if (!hextets) return true; // unparseable → fail closed

  // IPv4-mapped ::ffff:a.b.c.d — classify via the embedded IPv4.
  if (
    hextets[0] === 0 && hextets[1] === 0 && hextets[2] === 0 &&
    hextets[3] === 0 && hextets[4] === 0 && hextets[5] === 0xffff
  ) {
    return isBlockedIpv4Octets(hextets[6] >> 8, hextets[6] & 0xff, hextets[7] >> 8, hextets[7] & 0xff);
  }

  const allButLastZero = hextets.slice(0, 7).every((group) => group === 0);
  if (allButLastZero && hextets[7] === 0) return true; // :: unspecified
  if (allButLastZero && hextets[7] === 1) return true; // ::1 loopback

  const first = hextets[0];
  const highByte = first >> 8;
  if (highByte === 0xfc || highByte === 0xfd) return true; // fc00::/7 ULA
  if (first >= 0xfe80 && first <= 0xfebf) return true; // fe80::/10 link-local
  if (first >= 0xfec0 && first <= 0xfeff) return true; // fec0::/10 site-local (deprecated)
  if (highByte === 0xff) return true; // ff00::/8 multicast
  return false;
}

/** True when `host` is a literal IP in a blocked range. Non-IP hosts → false. */
export function isBlockedIpLiteral(host: string): boolean {
  const family = isIP(host);
  if (family === 4) return isBlockedIpv4(host);
  if (family === 6) return isBlockedIpv6(host);
  return false;
}

// ── URL policy ─────────────────────────────────────────────────────────────

/**
 * Synchronous scheme/port/credential/literal-IP checks. Throws
 * EgressBlockedError on any violation; returns the parsed URL otherwise.
 */
export function assertUrlPolicy(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new EgressBlockedError('invalid_url', 'Callback URL is not a valid URL.');
  }
  if (url.protocol !== ALLOWED_PROTOCOL) {
    throw new EgressBlockedError('scheme', 'Only https:// callback URLs are allowed.');
  }
  if (url.port && url.port !== ALLOWED_PORT) {
    throw new EgressBlockedError('port', 'Only the default https port (443) is allowed.');
  }
  if (url.username || url.password) {
    throw new EgressBlockedError('userinfo', 'Callback URL must not contain embedded credentials.');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isBlockedIpLiteral(host)) {
    throw new EgressBlockedError('private_ip', 'Callback URL points at a non-public address.');
  }
  return url;
}

/**
 * Full egress check: URL policy plus DNS resolution, rejecting when any
 * resolved address is non-public. Returns the validated URL and its addresses.
 * The resolver is injectable so tests never touch the network.
 */
export async function assertEgressAllowed(
  rawUrl: string,
  opts?: { resolver?: EgressResolver },
): Promise<{ url: URL; addresses: string[] }> {
  const url = assertUrlPolicy(rawUrl);
  const host = url.hostname.replace(/^\[|\]$/g, '');

  // A literal-IP host was already classified by assertUrlPolicy.
  if (isIP(host) !== 0) {
    return { url, addresses: [host] };
  }

  const resolver = opts?.resolver ?? defaultResolver;
  let addresses: string[];
  try {
    addresses = await resolver(host);
  } catch {
    throw new EgressBlockedError('dns', 'Callback host could not be resolved.');
  }
  if (!addresses.length) {
    throw new EgressBlockedError('dns', 'Callback host resolved to no addresses.');
  }
  for (const address of addresses) {
    if (isIP(address) === 0 || isBlockedIpLiteral(address)) {
      throw new EgressBlockedError('private_ip', 'Callback host resolves to a non-public address.');
    }
  }
  return { url, addresses };
}
