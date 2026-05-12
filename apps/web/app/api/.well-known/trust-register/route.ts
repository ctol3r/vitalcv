/**
 * GET /.well-known/trust-register
 *
 * Machine-readable Trust State Register. Public, no auth.
 * Declares VitalCV doctrine, issuer state, trust states, proof tiers,
 * verifier endpoints, and replay survivability.
 */

import { NextResponse } from 'next/server';
import { getTrustRegisterSnapshot } from '@/lib/trust/register';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const snapshot = await getTrustRegisterSnapshot();

  const body = {
    version: '1.0',
    generated_at: new Date(snapshot.lastVerifiedAt).toISOString(),
    doctrine: {
      version: '1.0',
      anonymous_reads: 'public',
      anonymous_writes: 'rejected',
      authenticated_writes: 'attributable',
      replay_lineage: 'coherent',
      verifier_continuity: 'public',
      degraded_state_semantics: 'explicit',
    },
    issuer: {
      did: snapshot.issuerDid,
      jwks_uri: snapshot.jwksUri,
      did_document_uri: snapshot.didDocUri,
      signing_algorithm: snapshot.keyAlgorithm,
      signing_key_id: snapshot.signingKeyId,
    },
    replay_survivability: {
      status: 'confirmed',
      mechanism: 'prisma_upsert_dedupe',
      actor_attribution: 'persisted',
    },
    trust_states: ['anonymous_preview', 'owned_snapshot', 'signed_institutional_artifact'],
    proof_tiers: snapshot.proofTiers,
    verifier_endpoints: [
      { path: '/.well-known/jwks.json', auth: 'none' },
      { path: '/.well-known/did.json', auth: 'none' },
      { path: '/.well-known/trust.json', auth: 'none' },
      { path: '/api/receipts/verify', auth: 'none', method: 'POST' },
    ],
    receipt_continuity: 'active',
  };

  return NextResponse.json(body, {
    headers: {
      'Cache-Control': 'public, max-age=60',
    },
  });
}
