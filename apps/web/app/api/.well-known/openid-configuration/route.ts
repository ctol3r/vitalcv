/**
 * GET /.well-known/openid-configuration
 *
 * Alias for /.well-known/openid-credential-issuer.
 * Standard OpenID Connect discovery endpoint that wallets and verifiers
 * may probe before the OID4VCI-specific path.
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
