import type { CryptoKey as JoseCryptoKey } from 'jose';
import { importPKCS8, SignJWT } from 'jose';
import { HttpError } from '../../utils/httpError';
import { log } from '../../obs/logger';
import type { IdentityArtifact } from './types';

const ALG = 'ES256';
const KID = 'vcv-key-2026-01';

/**
 * Sign an identity artifact as a compact JWS (JWT) using ES256.
 *
 * The private key is loaded from the VCV_PRIVATE_KEY environment variable
 * which must contain a base64-encoded PKCS#8 PEM key.
 */
export async function signArtifact(
  artifact: IdentityArtifact,
  artifactHash: string,
): Promise<string> {
  const b64Key = process.env.VCV_PRIVATE_KEY;
  if (!b64Key) {
    log('error', 'signer_missing_key', {
      detail: 'VCV_PRIVATE_KEY environment variable not set',
    });
    throw new HttpError(500, 'Signing key not configured');
  }

  let privateKey: JoseCryptoKey;
  try {
    const pem = Buffer.from(b64Key, 'base64').toString('utf-8');
    privateKey = await importPKCS8(pem, ALG);
  } catch (err) {
    log('error', 'signer_key_import_failed', {
      error: err instanceof Error ? err.message : 'unknown',
    });
    throw new HttpError(500, 'Failed to import signing key');
  }

  const jws = await new SignJWT({
    artifact_hash: artifactHash,
    npi: artifact.provider.npi,
    schema_version: artifact.schema_version,
  })
    .setProtectedHeader({ alg: ALG, kid: KID, typ: 'JWT' })
    .setIssuedAt()
    .setIssuer('vitalcv')
    .sign(privateKey);

  return jws;
}
