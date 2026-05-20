/**
 * GET /.well-known/did.json
 *
 * W3C DID Document — the canonical issuer-identity discovery surface.
 *
 * This route is a **discovery surface only**. It declares the issuer's
 * verification method and points at the JWKS and OID4VCI metadata
 * endpoints. It does NOT mint credentials, run OAuth flows, or assert
 * production federation guarantees -- those are intentionally outside
 * the discovery layer's scope.
 *
 * Integrity contract (binding):
 *   - response body is canonically serialized (sorted keys) for
 *     byte-stable replay across processes
 *   - strong `ETag` derived from canonical bytes
 *   - 304 returned on matching `If-None-Match`
 *   - `Vary: Host, X-Forwarded-Host, Accept` so caches don't poison
 *     across hosts
 *   - host is normalized via `canonicalizeHost(...)`; every injection
 *     vector we can name is rejected
 *   - `application/did+json` content type per the DID-core spec
 *
 * Spec refs:
 *   - https://www.w3.org/TR/did-core/
 *   - https://w3c-ccg.github.io/did-method-web/
 *   - https://w3c-ccg.github.io/lds-jws2020/
 *   - https://www.rfc-editor.org/rfc/rfc9110 (cache + ETag)
 */

import { NextResponse } from 'next/server';
import { getEd25519PublicJwk } from '@/lib/crypto/ed25519IssuerKey';
import {
  resolveIssuerDid,
  resolveIssuerOrigin,
} from '@/lib/discovery/issuerHost';
import { buildCanonicalJsonResponse } from '@/lib/protocol/protocolIntegrity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const issuerDid = resolveIssuerDid(request.headers);
  const issuerOrigin = resolveIssuerOrigin(request.headers);
  const publicJwk = await getEd25519PublicJwk();
  const kid =
    typeof publicJwk.kid === 'string' && publicJwk.kid.length > 0
      ? publicJwk.kid
      : 'vcv-ed25519-key-1';
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

  const envelope = buildCanonicalJsonResponse({
    value: didDocument,
    contentType: 'application/did+json; charset=utf-8',
    ifNoneMatch: request.headers.get('if-none-match'),
  });

  if (envelope.status === 304) {
    return new NextResponse(null, { status: 304, headers: envelope.headers });
  }
  return new NextResponse(envelope.body, {
    status: envelope.status,
    headers: envelope.headers,
  });
}
