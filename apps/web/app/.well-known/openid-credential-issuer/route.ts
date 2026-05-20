/**
 * GET /.well-known/openid-credential-issuer
 *
 * OpenID for Verifiable Credential Issuance (OID4VCI) issuer metadata.
 *
 * Discovery surface only. Declares supported credential configurations
 * and proof capability; this does NOT implement the OID4VCI issuance
 * flow itself. The pilot-stage interoperability posture is intentional:
 * issuance is institution-owned during pilot engagements and is not
 * exercised through this metadata-only surface.
 *
 * Integrity contract (binding):
 *   - response body is canonically serialized (sorted keys)
 *   - strong `ETag` derived from canonical bytes
 *   - 304 returned on matching `If-None-Match`
 *   - `Vary: Host, X-Forwarded-Host, Accept`
 *   - host is canonicalized via `canonicalizeHost(...)`
 *
 * Spec ref:
 *   https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html
 */

import { NextResponse } from 'next/server';
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

  const metadata = {
    credential_issuer: issuerOrigin,
    authorization_servers: [issuerOrigin],
    credential_endpoint: `${issuerOrigin}/api/credentials/issue`,
    jwks_uri: `${issuerOrigin}/.well-known/jwks.json`,
    proof_types_supported: {
      jwt: {
        proof_signing_alg_values_supported: ['EdDSA', 'ES256'],
      },
    },
    credential_configurations_supported: {
      VitalCVCredential: {
        format: 'jwt_vc_json',
        scope: 'VitalCVCredential',
        cryptographic_binding_methods_supported: ['did:web'],
        credential_signing_alg_values_supported: ['EdDSA', 'ES256'],
        credential_definition: {
          type: ['VerifiableCredential', 'VitalCVCredential'],
          credentialSubject: {
            npi: { display: [{ name: 'NPI', locale: 'en-US' }] },
            taxonomyCode: {
              display: [{ name: 'Primary taxonomy', locale: 'en-US' }],
            },
            activeState: {
              display: [{ name: 'Active state', locale: 'en-US' }],
            },
          },
        },
        proof_types_supported: {
          jwt: {
            proof_signing_alg_values_supported: ['EdDSA', 'ES256'],
          },
        },
        display: [
          {
            name: 'VitalCV Provider Credential',
            locale: 'en-US',
            description:
              'Discovery declaration. Verifiable credential issued by VitalCV after source-confirmed federal-registry resolution; re-verifiable offline against the issuer DID.',
          },
        ],
      },
    },
    issuer_did: issuerDid,
    display: [
      {
        name: 'VitalCV',
        locale: 'en-US',
      },
    ],
  };

  const envelope = buildCanonicalJsonResponse({
    value: metadata,
    contentType: 'application/json; charset=utf-8',
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
