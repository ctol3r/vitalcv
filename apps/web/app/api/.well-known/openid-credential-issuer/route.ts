/**
 * GET /.well-known/openid-credential-issuer
 *
 * OID4VCI (OpenID for Verifiable Credential Issuance) issuer metadata.
 * The issuer host is resolved per-request via
 * `lib/discovery/issuerHost.ts` so the same handler serves vitalcv.com
 * and tunnel hosts (e.g. trycloudflare) without a domain swap.
 *
 * Spec: https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html
 */

import { NextResponse } from 'next/server';
import { resolveIssuerOrigin } from '@/lib/discovery/issuerHost';

export const runtime = 'nodejs';

// force-dynamic so we can read request headers; revalidate cannot be
// used together with header-derived responses.
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const origin = resolveIssuerOrigin(request.headers);

  const metadata = {
    issuer: origin,
    credential_issuer: origin,
    credential_endpoint: `${origin}/api/credentials/issue`,
    jwks_uri: `${origin}/.well-known/jwks.json`,
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
