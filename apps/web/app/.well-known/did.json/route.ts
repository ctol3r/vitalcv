/**
 * GET /.well-known/did.json
 *
 * W3C DID Core document for `did:web:<origin>`. Verifiers resolve the
 * VitalCV issuer DID by fetching this URL; the public key material
 * here MUST match what is published at `/.well-known/jwks.json`. Both
 * surfaces share `getPublicKeyJwk()` so kid + key never diverge.
 *
 * Spec: https://w3c-ccg.github.io/did-method-web/
 *
 * The verification-method id `<did>#<kid>` lets a verifier inspecting
 * a receipt's `kid` header navigate directly to the matching key entry.
 */
import { NextResponse } from 'next/server';
import { getPublicKeyJwk } from '@/lib/crypto/receiptIssuer';
import {
  getIssuerDid,
  getIssuerOrigin,
  getVerificationMethodId,
} from '@/lib/trust/wellKnownIdentity';

export const runtime = 'nodejs';
export const revalidate = 3600;

export async function GET() {
  const did = getIssuerDid();
  const origin = getIssuerOrigin();
  const publicKeyJwk = await getPublicKeyJwk();
  const kid = typeof publicKeyJwk.kid === 'string' ? publicKeyJwk.kid : 'vcv-es256';
  const vmId = getVerificationMethodId(did, kid);

  const document = {
    '@context': [
      'https://www.w3.org/ns/did/v1',
      'https://w3id.org/security/suites/jws-2020/v1',
    ],
    id: did,
    verificationMethod: [
      {
        id: vmId,
        type: 'JsonWebKey2020',
        controller: did,
        publicKeyJwk,
      },
    ],
    assertionMethod: [vmId],
    authentication: [vmId],
    service: [
      {
        id: `${did}#jwks`,
        type: 'JsonWebKeySet',
        serviceEndpoint: `${origin}/.well-known/jwks.json`,
      },
      {
        id: `${did}#trust-register`,
        type: 'VitalCVTrustRegister',
        serviceEndpoint: `${origin}/.well-known/trust-register`,
      },
      {
        id: `${did}#oid4vci`,
        type: 'OID4VCIIssuer',
        serviceEndpoint: `${origin}/.well-known/openid-credential-issuer`,
      },
    ],
  };

  return NextResponse.json(document, {
    headers: {
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      'Content-Type': 'application/did+json',
    },
  });
}
