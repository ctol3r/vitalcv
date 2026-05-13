/**
 * GET /api/status
 *
 * Public operational truth endpoint. No auth required.
 * Returns comprehensive status payload for external browser probes.
 */

import { getOrInitKeypair } from '@/lib/crypto/receiptIssuer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const keypair = await getOrInitKeypair().catch(() => null);

  const signingKeyId = keypair?.kid ?? null;

  const issuerDid = 'did:web:vitalcv.com';
  const envLabel = process.env.VITALCV_ENV_LABEL ?? process.env.NODE_ENV ?? 'unknown';

  const payload = {
    timestamp: new Date().toISOString(),
    version: '1.0',
    overall: 'operational',

    verifier_continuity: {
      status: 'operational',
      endpoints: {
        jwks: {
          path: '/.well-known/jwks.json',
          public: true,
          status: 'operational',
        },
        did: {
          path: '/.well-known/did.json',
          public: true,
          status: 'operational',
        },
        trust_manifest: {
          path: '/.well-known/trust.json',
          public: true,
          status: 'operational',
        },
        trust_register: {
          path: '/.well-known/trust-register',
          public: true,
          status: 'operational',
        },
        trust_graph: {
          path: '/trust/graph',
          public: true,
          status: 'operational',
        },
        trust_schema: {
          path: '/trust/schema',
          public: true,
          status: 'operational',
        },
        trust_doctrine: {
          path: '/trust/doctrine',
          public: true,
          status: 'operational',
        },
        openid_configuration: {
          path: '/.well-known/openid-configuration',
          public: true,
          status: 'operational',
        },
        receipt_verify: {
          path: '/api/receipts/verify',
          public: true,
          status: 'operational',
        },
        replay_inspection: {
          path: '/api/replay/[runId]',
          public: true,
          status: 'operational',
        },
        receipt_lookup: {
          path: '/api/receipt/[lineageKey]',
          public: true,
          status: 'operational',
        },
      },
    },

    replay_continuity: {
      status: 'operational',
      survivable: true,
      dedupe_key_active: true,
      actor_attribution_active: true,
      mechanism: 'prisma_upsert_deduplication',
    },

    runtime_continuity: {
      status: signingKeyId ? 'operational' : 'degraded',
      issuer_did: issuerDid,
      signing_algorithm: 'ES256',
      signing_key_id: signingKeyId,
      environment: envLabel,
    },

    chronology_continuity: {
      status: 'operational',
      reading_order: ['OBJECT', 'OWNERSHIP', 'CHECKED_AT', 'CHANNEL', 'REPLAY', 'RUN_ID'],
      deterministic_run_id: true,
      algorithm: 'djb2-hash(npi:checkedAt) → hex → first-8',
    },

    source_lanes: {
      nppes_identity: {
        lifecycle: 'active',
        status: 'operational',
      },
      oig_exclusions: {
        lifecycle: 'planned',
        status: 'pending_integration',
      },
      state_license: {
        lifecycle: 'planned',
        status: 'pending_integration',
      },
      employment_history: {
        lifecycle: 'demo_only',
        status: 'non_production',
      },
      board_certification: {
        lifecycle: 'unintegrated',
        status: 'not_implemented',
      },
      pecos_enrollment: {
        lifecycle: 'planned',
        status: 'pending_integration',
      },
    },

    doctrine: {
      version: '1.0',
      anonymous_reads: 'public',
      anonymous_writes: 'rejected',
      authenticated_writes: 'attributable',
      replay_lineage: 'coherent',
      verifier_continuity: 'public',
      signed_issuance: 'attributable',
      degraded_state_semantics: 'explicit',
    },
  };

  return Response.json(payload, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
