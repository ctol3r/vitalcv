/**
 * GET /.well-known/did.json
 *
 * W3C DID document for the resolved issuer host. The controller is
 * derived per-request from `lib/discovery/issuerHost.ts` so the same
 * codebase serves the production identity at vitalcv.com and a tunnel
 * identity at <name>.trycloudflare.com without a domain swap.
 *
 * Spec: https://w3c.github.io/did-core/
 * did:web method: https://w3c-ccg.github.io/did-method-web/
 */

import { NextResponse } from 'next/server';
import { getPublicKeyJwk } from '@/lib/crypto/receiptIssuer';
import {
  resolveIssuerDid,
  resolveIssuerOrigin,
} from '@/lib/discovery/issuerHost';

export const runtime = 'nodejs';

// Force runtime evaluation — same rationale as the sibling JWKS route.
// Prerendering would invoke the production-only signing guard at build
// time and fail with no env vars present. Force-dynamic also lets us
// read request headers to derive the issuer host.
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const publicKeyJwk = await getPublicKeyJwk();
  const issuerDid = resolveIssuerDid(request.headers);
  const issuerOrigin = resolveIssuerOrigin(request.headers);

  const didDocument = {
    '@context': 'https://www.w3.org/ns/did/v1',
    id: issuerDid,
    verificationMethod: [
      {
        id: `${issuerDid}#vcv-signing-key-1`,
        type: 'JsonWebKey2020',
        controller: issuerDid,
        publicKeyJwk,
      },
    ],
    authentication: [`${issuerDid}#vcv-signing-key-1`],
    service: [
      {
        id: `${issuerDid}#credential-issuer`,
        type: 'CredentialIssuer',
        serviceEndpoint: `${issuerOrigin}/api/credentials/issue`,
      },
      {
        id: `${issuerDid}#receipt-verifier`,
        type: 'ReceiptVerifier',
        serviceEndpoint: `${issuerOrigin}/api/receipts/verify`,
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
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
