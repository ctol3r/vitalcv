/**
 * Receipt JWT verification — zero-trust layer for employer review.
 *
 * Receipts are HS256 JWTs minted by the VitalCV backend. This module
 * provides the pure verification logic used by both the API route and
 * the test suite. It never touches the network or DB.
 *
 * Secret: RECEIPT_JWT_SECRET env var (min 32-byte UTF-8 string).
 * Falls back to a dev-only constant so the test suite runs without
 * a real secret; production deployments must set the env var.
 */

import { jwtVerify, SignJWT, errors as joseErrors } from 'jose';

export const DEV_FALLBACK_SECRET = 'vitalcv-dev-receipt-secret-min32bytes!!';

function getSecretBytes(secret?: string): Uint8Array {
  const raw = secret ?? process.env.RECEIPT_JWT_SECRET ?? DEV_FALLBACK_SECRET;
  return new TextEncoder().encode(raw);
}

export type ReceiptVerificationOk = {
  ok: true;
  claims: Record<string, unknown>;
};

export type ReceiptVerificationFail = {
  ok: false;
  error: 'signature_invalid' | 'expired' | 'malformed';
  detail: string;
};

export type ReceiptVerificationResult = ReceiptVerificationOk | ReceiptVerificationFail;

/**
 * Verify a single receipt JWT.
 *
 * Returns a discriminated union — never throws.
 */
export async function verifyReceiptJwt(
  token: string,
  secret?: string,
): Promise<ReceiptVerificationResult> {
  try {
    const { payload } = await jwtVerify(token, getSecretBytes(secret), {
      algorithms: ['HS256'],
    });
    return { ok: true, claims: payload as Record<string, unknown> };
  } catch (err) {
    if (err instanceof joseErrors.JWTExpired) {
      return { ok: false, error: 'expired', detail: err.message };
    }
    if (
      err instanceof joseErrors.JWSSignatureVerificationFailed ||
      err instanceof joseErrors.JWSInvalid
    ) {
      return { ok: false, error: 'signature_invalid', detail: err.message };
    }
    const detail = err instanceof Error ? err.message : String(err);
    return { ok: false, error: 'malformed', detail };
  }
}

/**
 * Verify an array of receipt JWTs.
 *
 * Runs in parallel; returns results in the same order as the input tokens.
 */
export async function verifyReceiptJwts(
  tokens: string[],
  secret?: string,
): Promise<ReceiptVerificationResult[]> {
  return Promise.all(tokens.map((t) => verifyReceiptJwt(t, secret)));
}

/**
 * Summarise a batch of results into a single posture.
 *
 * 'secured'   — every token passed
 * 'compromised' — at least one token failed signature or was malformed
 * 'expired'   — at least one token expired (but none were forged)
 * 'pending'   — no tokens were supplied
 */
export type ReceiptPosture = 'secured' | 'compromised' | 'expired' | 'pending';

export function resolveReceiptPosture(results: ReceiptVerificationResult[]): ReceiptPosture {
  if (results.length === 0) return 'pending';

  const hasCompromised = results.some(
    (r) => !r.ok && (r.error === 'signature_invalid' || r.error === 'malformed'),
  );
  if (hasCompromised) return 'compromised';

  const hasExpired = results.some((r) => !r.ok && r.error === 'expired');
  if (hasExpired) return 'expired';

  return 'secured';
}

// ── Test helper (only used in tests / storybooks, not production paths) ──────

/**
 * Mint a signed receipt JWT for testing.
 * Uses HS256 with the same secret resolution as verifyReceiptJwt.
 */
export async function mintTestReceiptJwt(
  claims: Record<string, unknown>,
  options: { expiresIn?: string; secret?: string } = {},
): Promise<string> {
  const { expiresIn = '1h', secret } = options;
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecretBytes(secret));
}
