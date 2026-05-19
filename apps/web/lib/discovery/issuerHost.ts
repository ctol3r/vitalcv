/**
 * Resolves the issuer host for `.well-known` discovery endpoints.
 *
 * Production deployments default to `vitalcv.com`. Demo / preview /
 * trycloudflare-tunnel deployments need the discovery documents to
 * report the live tunnel host so that:
 *
 *   curl https://<tunnel>/.well-known/did.json
 *
 * returns a `did:web:<tunnel>` document whose service endpoints resolve
 * back to the same tunnel — the requirement for the OpenMythos verifier
 * probe to pass without a domain swap.
 *
 * Resolution order (first match wins):
 *   1. `VCV_ISSUER_HOST` env var — operator override (set this on the
 *      tunnel process)
 *   2. `X-Forwarded-Host` header — set by the trycloudflare proxy
 *   3. `Host` header — direct requests
 *   4. fallback to `vitalcv.com`
 *
 * The returned host is the bare authority (no scheme, no path).
 */

const DEFAULT_ISSUER_HOST = 'vitalcv.com';

/**
 * Validates that a candidate host is a bare authority (no scheme, no
 * path, no whitespace). Rejects empty strings and obviously malformed
 * values so injected request headers cannot widen the discovery
 * document's controller field.
 */
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
    // x-forwarded-host may carry multiple values comma-separated; take the first.
    const first = fwdHost.split(',')[0]?.trim();
    if (isValidHost(first)) return first;
  }

  const host = headers.get('host');
  if (isValidHost(host)) return host.trim();

  return DEFAULT_ISSUER_HOST;
}

/**
 * Returns `https://<host>` — the canonical scheme for did:web and
 * OID4VCI metadata. The discovery spec mandates HTTPS; even on
 * localhost we render `https://` because the document is a contract,
 * not a fetchable URL.
 */
export function resolveIssuerOrigin(headers: Headers): string {
  return `https://${resolveIssuerHost(headers)}`;
}

/**
 * Renders the `did:web` identifier for the resolved host.
 * Per did-method-web, percent-encoded colons in ports and slashes in
 * paths are required, but VitalCV's discovery never uses ports/paths.
 */
export function resolveIssuerDid(headers: Headers): string {
  return `did:web:${resolveIssuerHost(headers)}`;
}
