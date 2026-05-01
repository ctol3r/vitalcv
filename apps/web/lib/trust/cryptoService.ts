/**
 * Trust Crypto Service — delegates to the canonical ES256 receipt issuer.
 *
 * This module bridges the verifier-side demo signing to the canonical
 * receiptIssuer keypair so that tokens signed here can be verified
 * against the same JWKS published at /.well-known/jwks.json.
 *
 * TODO(VERIFIER-200-arch): replace demo signing with proper
 * signIssuerReceipt calls; this bridge is a transitional shim.
 */

import { SignJWT } from 'jose';
import { getOrInitKeypair, getPublicKeyJwk } from '@/lib/crypto/receiptIssuer';

/**
 * Signs an arbitrary payload as an ES256 JWT using the canonical
 * receiptIssuer keypair. Used for demo/test token generation.
 */
export async function signPayloadES256(payload: object): Promise<string> {
  const { privateKey, kid } = await getOrInitKeypair();
  const header = { alg: 'ES256' as const, typ: 'JWT', kid };
  const jwt = await new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader(header)
    .sign(privateKey);
  return jwt;
}

/**
 * Returns the public JWKS from the canonical receiptIssuer.
 */
export async function getPublicJWKS(): Promise<{ keys: object[] }> {
  const jwk = await getPublicKeyJwk();
  return { keys: [jwk] };
}
