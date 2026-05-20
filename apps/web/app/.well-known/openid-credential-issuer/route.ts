/**
 * GET /.well-known/openid-credential-issuer
 *
 * OpenID for Verifiable Credential Issuance (OID4VCI) issuer metadata.
 * (WAVE C78)
 *
 * Strict-compliance shape per
 * https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html:
 *   - `credential_issuer` — resolved per-request from the issuer host
 *   - `credential_endpoint` — POST endpoint for the credential request
 *   - `jwks_uri` — public JWKS for receipt signature verification
 *   - `credential_configurations_supported` — typed credentials VitalCV
 *     issues, keyed by configuration id, each carrying `format`,
 *     `credential_definition`, and `proof_types_supported`.
 *
 * `credential_configurations_supported` describes the issuer's
 * **declared** capability — it does not assert that a particular
 * subject possesses any of the listed credentials.
 */

import { NextResponse } from 'next/server';
import { resolveIssuerDid, resolveIssuerOrigin } from '@/lib/discovery/issuerHost';

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
    // OID4VCI 1.0 — proof formats VitalCV will accept on credential request.
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
            // Subject NPI is the primary identifier (NPPES-public).
            npi: { display: [{ name: 'NPI', locale: 'en-US' }] },
            // Source-confirmed primary taxonomy (CMS NUCC code).
            taxonomyCode: {
              display: [{ name: 'Primary taxonomy', locale: 'en-US' }],
            },
            // Active practice state (CMS NPPES location address).
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
              'Verifiable credential issued by VitalCV after source-confirmed federal-registry resolution. Re-verifiable offline against the issuer DID.',
          },
        ],
      },
    },
    // Convenience cross-reference back to the DID identity.
    issuer_did: issuerDid,
    display: [
      {
        name: 'VitalCV',
        locale: 'en-US',
      },
    ],
  };

  return NextResponse.json(metadata, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
