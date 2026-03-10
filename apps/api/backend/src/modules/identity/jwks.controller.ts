import type { Request, Response } from 'express';
import type { CryptoKey as JoseCryptoKey } from 'jose';
import { exportJWK, importSPKI } from 'jose';
import { getJwks as getIssuerJwks } from '../../services/sd-jwt/keyManager';
import { HttpError } from '../../utils/httpError';
import { log } from '../../obs/logger';

const LEGACY_ALG = 'ES256';
const LEGACY_KID = 'vcv-key-2026-01';

async function buildLegacyIdentityJwks(): Promise<{ keys: Record<string, unknown>[] }> {
  const b64Key = process.env.VCV_PUBLIC_KEY;
  if (!b64Key) {
    log('error', 'jwks_missing_key', {
      detail: 'VCV_PUBLIC_KEY environment variable not set',
    });
    throw new HttpError(500, 'Public key not configured');
  }

  let publicKey: JoseCryptoKey;
  try {
    const pem = Buffer.from(b64Key, 'base64').toString('utf-8');
    publicKey = await importSPKI(pem, LEGACY_ALG);
  } catch (error) {
    log('error', 'jwks_key_import_failed', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    throw new HttpError(500, 'Failed to import public key');
  }

  const jwk = await exportJWK(publicKey);
  return {
    keys: [
      {
        ...jwk,
        kid: LEGACY_KID,
        alg: LEGACY_ALG,
        use: 'sig',
      },
    ],
  };
}

/**
 * Canonical root JWKS serves issuer signing lineage.
 * The identity-scoped alias keeps the legacy NPI artifact verification key.
 */
export async function handleJwks(
  req: Request,
  res: Response,
): Promise<void> {
  const isIdentityAlias = req.path === '/identity/.well-known/jwks.json';
  const jwks = isIdentityAlias
    ? await buildLegacyIdentityJwks()
    : await getIssuerJwks();

  res.json(jwks);
}
