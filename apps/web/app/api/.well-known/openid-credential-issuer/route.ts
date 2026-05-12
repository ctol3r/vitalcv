/**
 * GET /.well-known/openid-credential-issuer
 *
 * OID4VCI (OpenID for Verifiable Credential Issuance) issuer metadata.
 * Enables wallets and verifiers to discover credential capabilities.
 *
 * Spec: https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html
 */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export const revalidate = 3600;

export async function GET() {
  const metadata = {
    issuer: 'https://vitalcv.com',
    credential_issuer: 'https://vitalcv.com',
    credential_endpoint: 'https://vitalcv.com/api/credentials/issue',
    jwks_uri: 'https://vitalcv.com/.well-known/jwks.json',
    credentials_supported: [
      {
        format: 'jwt_vc_json',
        id: 'VitalCVCredential',
        types: ['VerifiableCredential', 'VitalCVCredential'],
      },
    ],
  };

  return NextResponse.json(metadata, {
    headers: {
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
