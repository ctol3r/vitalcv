/**
 * Zero-trust receipt verifier.
 *
 * Only ES256 JWTs whose issuer matches VITACV_ISSUER_URL are accepted.
 * Keys are fetched from the canonical JWKS endpoint and cached for the
 * lifetime of the process (jose handles cache TTL internally).
 */

import { createRemoteJWKSet, jwtVerify } from 'jose';

const ISSUER_URL =
  process.env.VITACV_ISSUER_URL ??
  (process.env.NEXT_PUBLIC_APP_URL
    ? process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
    : 'https://vitalcv.com');

const JWKS_URL = `${ISSUER_URL}/.well-known/jwks.json`;

// jose caches the JWKS internally and re-fetches on key rotation.
const jwks = createRemoteJWKSet(new URL(JWKS_URL));

export interface VerifiedReceiptPayload {
  iss: string;
  sub?: string;
  exp?: number;
  iat?: number;
  jti?: string;
  [key: string]: unknown;
}

export interface ReceiptVerificationResult {
  verified: boolean;
  payload: VerifiedReceiptPayload | null;
  error?: string;
}

export async function verifyReceiptSignature(
  jwtString: string,
): Promise<ReceiptVerificationResult> {
  try {
    const { payload } = await jwtVerify(jwtString, jwks, {
      issuer: ISSUER_URL,
      algorithms: ['ES256'],
    });

    return {
      verified: true,
      payload: payload as VerifiedReceiptPayload,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      verified: false,
      payload: null,
      error: message,
    };
  }
}
