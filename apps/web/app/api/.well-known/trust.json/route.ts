/**
 * GET /.well-known/trust.json
 *
 * VitalCV trust manifest. Machine-readable declaration of issuer identity,
 * key locations, supported credential types, and proof tier capabilities.
 *
 * Cache-Control: short TTL (5 min) so changes propagate within one rotation window.
 */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const manifest = {
    version: '1.0',
    issuer: 'did:web:vitalcv.com',
    jwks_uri: '/.well-known/jwks.json',
    did_document_uri: '/.well-known/did.json',
    trust_graph_uri: '/trust/graph',
    trust_schema_uri: '/trust/schema',
    trust_doctrine_uri: '/trust/doctrine',
    status_uri: '/status',
    verify_uri: '/verify',
    credential_types: ['VitalCVCredential'],
    proof_tiers: ['snapshot', 'partial_proof_pack', 'decision_grade'],
    environment: process.env.VITALCV_ENV_LABEL ?? 'pilot',
  };

  return NextResponse.json(manifest, {
    headers: {
      'Cache-Control': 'public, max-age=300',
    },
  });
}
