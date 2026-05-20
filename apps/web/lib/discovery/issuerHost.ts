/**
 * Resolves the issuer host for `.well-known` discovery endpoints.
 *
 * Resolution order (first match wins):
 *   1. `VCV_ISSUER_HOST` env — operator override
 *   2. `X-Forwarded-Host` first hop — proxy/tunnel injection
 *   3. `Host` header — direct
 *   4. `vitalcv.com` default — preserves production identity when no
 *      headers are present (build prerender, offline tests)
 *
 * Host canonicalization is delegated to
 * `apps/web/lib/protocol/protocolIntegrity.ts` so every protocol
 * surface (DID document, OID4VCI metadata, future signed artifacts)
 * shares one binding definition of "valid host". The canonicalizer
 * rejects every injection vector we can name (path, scheme, control
 * chars, Unicode, invalid ports, multiple colons).
 *
 * The resulting host is **lowercased** per RFC 3986 § 3.2.2 (hosts
 * are case-insensitive) so two identical requests under different
 * casing produce a byte-stable did:web identifier.
 */

import {
  canonicalizeHost,
  hostToDidWeb,
} from '@/lib/protocol/protocolIntegrity';

export const DEFAULT_ISSUER_HOST = 'vitalcv.com';

/**
 * Resolves the issuer host from a canonical precedence chain, then
 * canonicalizes the winning candidate. Returns the canonical default
 * host on any failure — never throws, never widens.
 */
export function resolveIssuerHost(headers: Headers): string {
  // 1. Operator override
  const envHost = canonicalizeHost(process.env.VCV_ISSUER_HOST);
  if (envHost) return envHost;

  // 2. First X-Forwarded-Host hop
  const fwd = headers.get('x-forwarded-host');
  if (fwd) {
    const first = fwd.split(',')[0];
    const canonical = canonicalizeHost(first);
    if (canonical) return canonical;
  }

  // 3. Host header
  const host = canonicalizeHost(headers.get('host'));
  if (host) return host;

  // 4. Default
  return DEFAULT_ISSUER_HOST;
}

export function resolveIssuerOrigin(headers: Headers): string {
  return `https://${resolveIssuerHost(headers)}`;
}

export function resolveIssuerDid(headers: Headers): string {
  return hostToDidWeb(resolveIssuerHost(headers));
}
