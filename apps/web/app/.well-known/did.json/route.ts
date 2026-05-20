/**
 * GET /.well-known/did.json
 *
 * W3C DID Document for the VitalCV issuer identity (WAVE C78).
 *
 * Strict-compliance shape:
 *   - `@context` includes the canonical W3C DID v1 context plus the
 *     Ed25519VerificationKey2020 context.
 *   - `id` and `controller` are derived per-request from the resolved
 *     issuer host (env override > X-Forwarded-Host > Host > default).
 *   - `verificationMethod` carries an Ed25519 entry (`JsonWebKey2020`
 *     with `publicKeyJwk.crv = 'Ed25519'`) sourced from the runtime
 *     keypair in `apps/web/lib/crypto/ed25519IssuerKey.ts`.
 *   - `authentication` and `assertionMethod` both reference the
 *     verification method id.
 *   - `service` advertises the JWKS endpoint (which carries the
 *     separate ES256 receipt-signing key) and the OID4VCI metadata
 *     endpoint.
 *
 * Spec refs:
 *   - https://www.w3.org/TR/did-core/
 *   - https://w3c-ccg.github.io/did-method-web/
 *   - https://w3c-ccg.github.io/lds-jws2020/
 */

import { NextResponse } from 'next/server';
import { getEd25519PublicJwk } from '@/lib/crypto/ed25519IssuerKey';
import {
  resolveIssuerDid,
  resolveIssuerOrigin,
} from '@/lib/discovery/issuerHost';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const issuerDid = resolveIssuerDid(request.headers);
  const issuerOrigin = resolveIssuerOrigin(request.headers);
  const publicJwk = await getEd25519PublicJwk();
  const kid =
    typeof publicJwk.kid === 'string' ? publicJwk.kid : 'vcv-ed25519-key-1';
  const verificationMethodId = `${issuerDid}#${kid}`;

  const didDocument = {
    '@context': [
      'https://www.w3.org/ns/did/v1',
      'https://w3id.org/security/suites/jws-2020/v1',
    ],
    id: issuerDid,
    controller: issuerDid,
    verificationMethod: [
      {
        id: verificationMethodId,
        type: 'JsonWebKey2020',
        controller: issuerDid,
        publicKeyJwk: publicJwk,
      },
    ],
    authentication: [verificationMethodId],
    assertionMethod: [verificationMethodId],
    service: [
      {
        id: `${issuerDid}#jwks`,
        type: 'KeyStore',
        serviceEndpoint: `${issuerOrigin}/.well-known/jwks.json`,
      },
      {
        id: `${issuerDid}#openid-credential-issuer`,
        type: 'OID4VCIIssuer',
        serviceEndpoint: `${issuerOrigin}/.well-known/openid-credential-issuer`,
      },
    ],
  };

  return NextResponse.json(didDocument, {
    headers: {
      'Content-Type': 'application/did+json; charset=utf-8',
      'Cache-Control':
        'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
