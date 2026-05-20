/**
 * Ed25519 issuer identity key for the W3C DID document.
 *
 * The production receipt-signing path uses ES256 (see
 * `apps/web/lib/crypto/receiptIssuer.ts`); this module manages a
 * separate Ed25519 keypair used solely as the DID document's
 * verification method. A DID may legitimately publish multiple
 * verification methods of different types — Ed25519 here, ES256 in
 * the JWKS at `/.well-known/jwks.json`.
 *
 * Production: set `VCV_ED25519_PRIVATE_JWK` (JSON-encoded JWK of the
 * private key). The matching public JWK is published in the DID doc.
 *
 * Dev / preview: an ephemeral keypair is generated at module load
 * time. Not persisted; rotates on every process restart. The DID's
 * `id` is still stable (derived from the host), so the document's
 * shape is reproducible across restarts even if the key fingerprint
 * changes.
 */

import { exportJWK, generateKeyPair, importJWK } from 'jose';

let _keypairPromise: Promise<Ed25519Keypair> | null = null;

export interface Ed25519Keypair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
  /** Stable key-id derived from the kid claim of the JWK. */
  kid: string;
}

async function initKeypair(): Promise<Ed25519Keypair> {
  const envJwkRaw = process.env.VCV_ED25519_PRIVATE_JWK;
  if (envJwkRaw && envJwkRaw.trim().length > 0) {
    try {
      const privateJwk = JSON.parse(envJwkRaw) as Record<string, unknown>;
      if (privateJwk.kty !== 'OKP' || privateJwk.crv !== 'Ed25519') {
        throw new Error('VCV_ED25519_PRIVATE_JWK is not an Ed25519 OKP key');
      }
      const privateKey = (await importJWK(privateJwk, 'EdDSA')) as CryptoKey;
      // Derive the public JWK by stripping the private 'd' component.
      const publicJwk = { ...privateJwk };
      delete publicJwk.d;
      const publicKey = (await importJWK(publicJwk, 'EdDSA')) as CryptoKey;
      const kid =
        typeof privateJwk.kid === 'string' && privateJwk.kid.length > 0
          ? privateJwk.kid
          : 'vcv-ed25519-key-1';
      return { publicKey, privateKey, kid };
    } catch (err) {
      throw new Error(
        `VCV_ED25519_PRIVATE_JWK could not be parsed: ${
          err instanceof Error ? err.message : 'unknown'
        }`,
      );
    }
  }
  const { publicKey, privateKey } = await generateKeyPair('EdDSA', {
    crv: 'Ed25519',
    extractable: true,
  });
  return {
    publicKey,
    privateKey,
    kid: 'vcv-ed25519-dev-ephemeral',
  };
}

function getOrInitKeypair(): Promise<Ed25519Keypair> {
  if (!_keypairPromise) {
    _keypairPromise = initKeypair();
  }
  return _keypairPromise;
}

/**
 * Returns the public Ed25519 JWK — safe to publish in the DID document.
 * Includes `alg: 'EdDSA'`, `use: 'sig'`, and a stable `kid`.
 */
export async function getEd25519PublicJwk(): Promise<Record<string, unknown>> {
  const { publicKey, kid } = await getOrInitKeypair();
  const jwk = await exportJWK(publicKey);
  return { ...jwk, alg: 'EdDSA', use: 'sig', kid };
}

/**
 * For tests only — clears the cached keypair so the next call
 * regenerates. Never call from production code paths.
 */
export function __resetEd25519IssuerKey(): void {
  _keypairPromise = null;
}
