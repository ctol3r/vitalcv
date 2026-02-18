import type { Request, Response } from 'express';
import type { CryptoKey as JoseCryptoKey } from 'jose';
import { importSPKI, exportJWK } from 'jose';
import { HttpError } from '../../utils/httpError';
import { log } from '../../obs/logger';

const ALG = 'ES256';
const KID = 'vcv-key-2026-01';

/**
 * Handler for GET /.well-known/jwks.json
 *
 * Loads the public key from VCV_PUBLIC_KEY (base64 SPKI),
 * exports it as a JWK, and returns a JWKS document.
 */
export async function handleJwks(
  _req: Request,
  res: Response,
): Promise<void> {
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
    publicKey = await importSPKI(pem, ALG);
  } catch (err) {
    log('error', 'jwks_key_import_failed', {
      error: err instanceof Error ? err.message : 'unknown',
    });
    throw new HttpError(500, 'Failed to import public key');
  }

  const jwk = await exportJWK(publicKey);

  res.json({
    keys: [
      {
        ...jwk,
        kid: KID,
        alg: ALG,
        use: 'sig',
      },
    ],
  });
}
