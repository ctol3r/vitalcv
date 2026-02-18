/**
 * Phase 1E — ES256 Signing Service for PSV Artifacts.
 *
 * Signs artifact hashes as compact JWS (JWT) using the ECDSA P-256 key pair.
 * Keys are loaded from environment variables:
 *   - PSV_SIGNING_KEY:  base64-encoded PKCS#8 private key PEM
 *   - PSV_PUBLIC_KEY:   base64-encoded SPKI public key PEM
 *
 * Falls back to VCV_PRIVATE_KEY / VCV_PUBLIC_KEY for backward compatibility
 * with the identity module.
 */

import { importPKCS8, importSPKI, exportJWK, SignJWT, jwtVerify } from 'jose';
import type { JWTPayload } from 'jose';
import { HttpError } from '../../utils/httpError';
import { log } from '../../obs/logger';

type SigningKey = Awaited<ReturnType<typeof importPKCS8>>;

const ALG = 'ES256' as const;
const KID = 'psv-key-2026-01';
const ISSUER = 'vitalcv';

// ── Key helpers ──────────────────────────────────────────────

function getPrivateKeyPem(): string {
  const b64 = process.env.PSV_SIGNING_KEY ?? process.env.VCV_PRIVATE_KEY;
  if (!b64) {
    throw new HttpError(500, 'PSV signing key not configured');
  }
  return Buffer.from(b64, 'base64').toString('utf-8');
}

function getPublicKeyPem(): string {
  const b64 = process.env.PSV_PUBLIC_KEY ?? process.env.VCV_PUBLIC_KEY;
  if (!b64) {
    throw new HttpError(500, 'PSV public key not configured');
  }
  return Buffer.from(b64, 'base64').toString('utf-8');
}

let _cachedPrivateKey: SigningKey | null = null;
let _cachedPublicKey: SigningKey | null = null;

async function getPrivateKey(): Promise<SigningKey> {
  if (_cachedPrivateKey) return _cachedPrivateKey;
  try {
    _cachedPrivateKey = await importPKCS8(getPrivateKeyPem(), ALG);
    return _cachedPrivateKey;
  } catch (err) {
    log('error', 'psv_signing_key_import_failed', {
      error: err instanceof Error ? err.message : 'unknown',
    });
    throw new HttpError(500, 'Failed to import PSV signing key');
  }
}

async function getPublicKey(): Promise<SigningKey> {
  if (_cachedPublicKey) return _cachedPublicKey;
  try {
    _cachedPublicKey = await importSPKI(getPublicKeyPem(), ALG);
    return _cachedPublicKey;
  } catch (err) {
    log('error', 'psv_public_key_import_failed', {
      error: err instanceof Error ? err.message : 'unknown',
    });
    throw new HttpError(500, 'Failed to import PSV public key');
  }
}

// ── Sign ─────────────────────────────────────────────────────

export async function signArtifactHash(
  artifactHash: string,
  artifactId: string,
): Promise<string> {
  const privateKey = await getPrivateKey();

  return new SignJWT({
    artifact_hash: artifactHash,
    artifact_id: artifactId,
  })
    .setProtectedHeader({ alg: ALG, kid: KID, typ: 'JWT' })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .sign(privateKey);
}

// ── Verify ───────────────────────────────────────────────────

export async function verifyArtifactJws(jwt: string): Promise<JWTPayload> {
  const publicKey = await getPublicKey();
  const { payload } = await jwtVerify(jwt, publicKey, {
    algorithms: [ALG],
    issuer: ISSUER,
  });
  return payload;
}

// ── JWKS export ──────────────────────────────────────────────

export async function getJwksDocument(): Promise<{
  keys: Record<string, unknown>[];
}> {
  const publicKey = await getPublicKey();
  const jwk = await exportJWK(publicKey);
  return {
    keys: [
      {
        ...jwk,
        kid: KID,
        alg: ALG,
        use: 'sig',
      },
    ],
  };
}

/** Reset cached keys — only for tests. */
export function _resetKeyCache(): void {
  _cachedPrivateKey = null;
  _cachedPublicKey = null;
}
