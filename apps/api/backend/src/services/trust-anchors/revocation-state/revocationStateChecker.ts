/**
 * Wave 197 — Revocation State Checker
 *
 * CRL and OCSP stub implementations with 1-hour in-memory cache.
 * TODO (production): implement real HTTP CRL download + OCSP stapling.
 */

interface CrlResult {
  status: 'ok' | 'error';
  revokedSerials: string[];
  fetchedAt: string;
}

interface OcspResult {
  status: 'good' | 'revoked' | 'unknown';
  fetchedAt: string;
}

const CACHE_TTL_MS = 60 * 60 * 1_000; // 1 hour

const crlCache = new Map<string, { result: CrlResult; ts: number }>();
const ocspCache = new Map<string, { result: OcspResult; ts: number }>();

/**
 * Check a CRL distribution point URL.
 * Returns cached result if fresh; otherwise fetches.
 *
 * TODO(production): download CRL bytes, parse DER/PEM, extract revoked serials.
 */
export async function checkCrl(crlUrl: string): Promise<CrlResult> {
  const cached = crlCache.get(crlUrl);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.result;
  }

  // Stub: return ok with no revoked serials
  // TODO: fetch(crlUrl), parse CRL DER/PEM, extract serial numbers
  const result: CrlResult = {
    status: 'ok',
    revokedSerials: [],
    fetchedAt: new Date().toISOString(),
  };

  crlCache.set(crlUrl, { result, ts: Date.now() });
  return result;
}

/**
 * Check OCSP status for a specific certificate serial.
 *
 * TODO(production): build OCSP request (RFC 6960), POST to ocspUrl, parse response.
 */
export async function checkOcsp(ocspUrl: string, serial: string): Promise<OcspResult> {
  const key = `${ocspUrl}:${serial}`;
  const cached = ocspCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.result;
  }

  // Stub: return good
  const result: OcspResult = {
    status: 'good',
    fetchedAt: new Date().toISOString(),
  };

  ocspCache.set(key, { result, ts: Date.now() });
  return result;
}

export function clearRevocationCache(): void {
  crlCache.clear();
  ocspCache.clear();
}
