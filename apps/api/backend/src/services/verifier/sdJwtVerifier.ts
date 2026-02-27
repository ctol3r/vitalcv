import crypto from 'node:crypto';
import { decodeJwt } from 'jose';
import { v4 as uuidv4 } from 'uuid';

// ── Types ────────────────────────────────────────────────────────────

export interface DisclosedClaim {
  salt: string;
  key: string;
  value: unknown;
}

export interface VerificationResult {
  isValid: boolean;
  credentialId: string;
  issuer: string;
  vct: string;
  subject: string | null;
  claims: Record<string, unknown>;
  disclosures: DisclosedClaim[];
  auditHash: string;
  signatureVerified: boolean;
  verifiedAt: string;
}

// ── Disclosure parsing ───────────────────────────────────────────────

/** Standard SD-JWT claims excluded from the extracted claims map */
const EXCLUDED_CLAIMS = new Set([
  'iss', 'sub', 'vct', 'iat', 'exp', '_sd', '_sd_alg', 'jti',
]);

/**
 * Decode base64url-encoded SD-JWT disclosures.
 * Each disclosure decodes to a JSON array: [salt, key, value].
 * Malformed entries are silently skipped.
 */
export function parseDisclosures(rawDisclosures: string[]): DisclosedClaim[] {
  const result: DisclosedClaim[] = [];

  for (const d of rawDisclosures) {
    try {
      const decoded = Buffer.from(d, 'base64url').toString('utf-8');
      const parsed: unknown = JSON.parse(decoded);

      if (!Array.isArray(parsed) || parsed.length < 3) continue;

      const [salt, key, value] = parsed as [string, string, unknown];
      if (typeof salt !== 'string' || typeof key !== 'string') continue;

      result.push({ salt, key, value });
    } catch {
      // Skip malformed disclosure
    }
  }

  return result;
}

// ── Presentation verification ────────────────────────────────────────

/**
 * Verify an SD-JWT Verifiable Presentation token.
 *
 * Current limitations:
 * - Signature is NOT cryptographically verified (no DID key resolution yet).
 *   `signatureVerified` is always false — this is a stub for future DID-based
 *   key resolution where we'll resolve the issuer DID document, extract the
 *   public key, and call `jwtVerify` from jose.
 * - Validity is based solely on issuer DID matching.
 */
export function verifyPresentation(
  vpToken: string,
  expectedIssuerDid: string,
): VerificationResult {
  const parts = vpToken.split('~');
  const jwtPart = parts[0];
  const rawDisclosures = parts.slice(1).filter(Boolean);

  // Decode JWT payload (does NOT verify signature)
  const payload = decodeJwt(jwtPart);
  const payloadRecord = payload as Record<string, unknown>;

  // Stub: no real key resolution yet
  const signatureVerified = false;

  const issuer = (payload.iss as string) || 'unknown';

  // Wildcard "*" accepts any issuer (demo mode)
  const isValid =
    expectedIssuerDid === '*' ? true : issuer === expectedIssuerDid;

  const vct = (payloadRecord.vct as string) || 'unknown';
  const subject = (payload.sub as string) || null;

  // Extract remaining claims (exclude standard SD-JWT fields)
  const claims: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payloadRecord)) {
    if (!EXCLUDED_CLAIMS.has(key)) {
      claims[key] = value;
    }
  }

  const disclosures = parseDisclosures(rawDisclosures);

  const auditHash = crypto
    .createHash('sha256')
    .update(vpToken, 'utf8')
    .digest('hex');

  return {
    isValid,
    credentialId: uuidv4(),
    issuer,
    vct,
    subject,
    claims,
    disclosures,
    auditHash,
    signatureVerified,
    verifiedAt: new Date().toISOString(),
  };
}
