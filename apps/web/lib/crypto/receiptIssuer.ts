/**
 * ES256 Receipt Issuer — asymmetric signing for issuer receipts.
 *
 * Production: set RECEIPT_PRIVATE_KEY_JWK (JSON-encoded JWK of the private
 * EC key) via env. The matching public key must be published at /.well-known/jwks.json.
 *
 * Development/test: if RECEIPT_PRIVATE_KEY_JWK is absent, a fresh ephemeral
 * keypair is generated at module load time. The keypair is NOT persisted across
 * restarts — dev only.
 *
 * This module is pure signing. It never touches the network or DB.
 */

import { generateKeyPair, importJWK, exportJWK, SignJWT } from 'jose';
import type { JWTPayload } from 'jose';
import type { IssuerResponse } from '@/lib/issuer-verification/types';

export interface ReceiptKeypair {
  /** ES256 private key — kept in process memory only. */
  privateKey: CryptoKey;
  /** ES256 public key — safe to publish in JWKS. */
  publicKey: CryptoKey;
  /** Stable identifier so clients can find the right key in JWKS. */
  kid: string;
}

export interface SignedIssuerReceipt {
  jwt: string;
  kid: string;
  jti: string;
}

// Module-level keypair. Lazy-initialized on first call.
let _keypairPromise: Promise<ReceiptKeypair> | null = null;

export async function generateReceiptKeypair(): Promise<ReceiptKeypair> {
  const { privateKey, publicKey } = await generateKeyPair('ES256', {
    extractable: true,
  });
  const kid = `vcv-es256-${Date.now()}`;
  return { privateKey, publicKey, kid };
}

/**
 * Returns the singleton keypair for this process.
 *
 * Production (NODE_ENV === 'production') — fail-closed:
 *   Both RECEIPT_PRIVATE_KEY_JWK and RECEIPT_KID MUST be set. If either
 *   is missing, this function throws. Refusing to silently fall back to
 *   a dev-prefixed kid (`vcv-es256-dev`, `vcv-es256-dev-<ts>`) or to an
 *   ephemeral generated keypair is the load-bearing invariant that
 *   prevents dev signing identity from leaking onto the production
 *   runtime trust anchor.
 *
 * Dev / test (NODE_ENV !== 'production'):
 *   If RECEIPT_PRIVATE_KEY_JWK is present, it is imported; the kid
 *   resolves to RECEIPT_KID, or `vcv-es256-dev-<timestamp>` if absent
 *   (preserves the prior dev-preview behavior without affecting
 *   production).
 *   If RECEIPT_PRIVATE_KEY_JWK is absent, a fresh ephemeral keypair is
 *   minted and given the stable kid RECEIPT_KID_DEV or `vcv-es256-dev`.
 */
export async function getOrInitKeypair(): Promise<ReceiptKeypair> {
  if (_keypairPromise) return _keypairPromise;

  _keypairPromise = (async () => {
    const privateJwkEnv = process.env.RECEIPT_PRIVATE_KEY_JWK;
    const kidEnv = process.env.RECEIPT_KID;
    const isProduction = process.env.NODE_ENV === 'production';

    // Production fail-closed: refuse to leak any dev-prefixed signing identity.
    if (isProduction) {
      if (!privateJwkEnv) {
        throw new Error(
          'receiptIssuer: RECEIPT_PRIVATE_KEY_JWK is required in production. ' +
            'Refusing to mint an ephemeral dev keypair on a production runtime.',
        );
      }
      if (!kidEnv) {
        throw new Error(
          'receiptIssuer: RECEIPT_KID is required in production when ' +
            'RECEIPT_PRIVATE_KEY_JWK is set. Refusing to fall back to a ' +
            'dev-prefixed kid on a production runtime.',
        );
      }
    }

    if (privateJwkEnv) {
      // Both envs set (production) OR only RECEIPT_PRIVATE_KEY_JWK set in
      // dev (kid falls back to a dev-prefixed timestamp string — only
      // reachable here when isProduction is false because the guard
      // above already threw).
      const kid = kidEnv ?? `vcv-es256-dev-${Date.now()}`;
      const jwk = JSON.parse(privateJwkEnv) as object;
      const privateKey = await importJWK(jwk, 'ES256');

      // Derive public key from the JWK by removing private components.
      const { d: _d, ...publicJwk } = jwk as Record<string, unknown>;
      const publicKey = await importJWK(publicJwk, 'ES256');

      return { privateKey: privateKey as CryptoKey, publicKey: publicKey as CryptoKey, kid };
    }

    // Dev: ephemeral keypair with stable kid (RECEIPT_KID_DEV || 'vcv-es256-dev').
    // Unreachable in production because the guard above already threw.
    const kp = await generateReceiptKeypair();
    return { ...kp, kid: process.env.RECEIPT_KID_DEV ?? 'vcv-es256-dev' };
  })();

  return _keypairPromise;
}

/**
 * Returns the public key JWK — safe to publish. Used by the JWKS route.
 */
export async function getPublicKeyJwk(): Promise<Record<string, unknown>> {
  const { publicKey, kid } = await getOrInitKeypair();
  const jwk = await exportJWK(publicKey);
  return { ...jwk, alg: 'ES256', use: 'sig', kid };
}

/**
 * Signs an issuer receipt as an ES256 JWT.
 *
 * Payload contract:
 *   iss  — VitalCV canonical issuer URL
 *   sub  — providerId or NPI from the response's request context
 *   jti  — unique receipt identifier
 *   iat  — issued-at (seconds)
 *   exp  — expires in 90 days
 *   vcv  — VitalCV claim block (claimId, source, status, observed_at, raw_hash)
 */
export async function signIssuerReceipt(
  response: IssuerResponse,
  context: {
    providerId: string;
    claimId: string;
    source: string;
    rawHash: string;
    /**
     * Clerk userId of the authenticated actor who triggered issuance.
     * Embedded in the JWT vcv.actor_id claim and as azp for RFC 9068 compliance.
     * When absent (system-initiated or pre-auth path), no actor claim is added.
     */
    actorId?: string | null;
  },
): Promise<SignedIssuerReceipt> {
  const { privateKey, kid } = await getOrInitKeypair();

  const issuerUrl =
    process.env.VITACV_ISSUER_URL ??
    (process.env.NEXT_PUBLIC_APP_URL
      ? process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
      : 'https://vitalcv.com');

  // Deterministic jti: keyed on responseId only so replay detection is
  // idempotent across retries. Date.now() suffix was non-deterministic.
  const jti = `rcpt_${response.responseId}`;

  // Actor attribution: embed Clerk userId when present.
  // azp (authorized party) — RFC 9068 §2.2 — identifies the actor who triggered issuance.
  // vcv.actor_id — VitalCV claim block — actor attribution for replay lineage.
  const vcvClaims: Record<string, unknown> = {
    claimId: context.claimId,
    source: context.source,
    status: 'confirmed',
    observed_at: response.respondedAt,
    raw_hash: context.rawHash,
    // NPI binding — identifies the subject provider, distinct from the actor
    provider_id: context.providerId,
  };
  if (context.actorId) {
    vcvClaims.actor_id = context.actorId;
  }

  const payload: JWTPayload & { vcv: object } = {
    iss: issuerUrl,
    // sub = NPI (subject — the credential is about this provider)
    sub: context.providerId,
    // azp = Clerk userId (actor — who triggered this issuance)
    ...(context.actorId ? { azp: context.actorId } : {}),
    jti,
    vcv: vcvClaims,
  };

  const jwt = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'ES256', kid })
    .setIssuedAt()
    .setExpirationTime('90d')
    .sign(privateKey);

  return { jwt, kid, jti };
}
