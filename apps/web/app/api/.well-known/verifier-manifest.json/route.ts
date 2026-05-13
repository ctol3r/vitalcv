/**
 * GET /.well-known/verifier-manifest.json
 *
 * Public verifier discovery manifest.
 * Tells downstream verifiers where to find keys, DID, receipt endpoint, and trust register.
 * Cache-Control: public, max-age=300
 */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const revalidate = 300;

export async function GET() {
  const base = 'https://vitalcv.com';

  const manifest = {
    issuer: base,
    jwks_uri: `${base}/.well-known/jwks.json`,
    did: `${base}/.well-known/did.json`,
    receipt_verify_endpoint: `${base}/api/receipt`,
    trust_register: `${base}/.well-known/trust-register`,
  };

  return NextResponse.json(manifest, {
    headers: {
      'Cache-Control': 'public, max-age=300',
    },
  });
}
