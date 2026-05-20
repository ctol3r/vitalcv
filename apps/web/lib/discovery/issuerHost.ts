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
 * Strict host validation rejects path / scheme / whitespace injection
 * so a malicious upstream proxy cannot widen the discovery doc's
 * controller field.
 */

const DEFAULT_ISSUER_HOST = 'vitalcv.com';

function isValidHost(candidate: string | null | undefined): candidate is string {
  if (!candidate) return false;
  const trimmed = candidate.trim();
  if (trimmed.length === 0) return false;
  if (trimmed.length > 253) return false;
  if (/\s/.test(trimmed)) return false;
  if (trimmed.includes('/')) return false;
  if (trimmed.includes('://')) return false;
  return /^[A-Za-z0-9.\-:_]+$/.test(trimmed);
}

export function resolveIssuerHost(headers: Headers): string {
  const envHost = process.env.VCV_ISSUER_HOST;
  if (isValidHost(envHost)) return envHost.trim();

  const fwdHost = headers.get('x-forwarded-host');
  if (fwdHost) {
    const first = fwdHost.split(',')[0]?.trim();
    if (isValidHost(first)) return first;
  }

  const host = headers.get('host');
  if (isValidHost(host)) return host.trim();

  return DEFAULT_ISSUER_HOST;
}

export function resolveIssuerOrigin(headers: Headers): string {
  return `https://${resolveIssuerHost(headers)}`;
}

export function resolveIssuerDid(headers: Headers): string {
  return `did:web:${resolveIssuerHost(headers)}`;
}
