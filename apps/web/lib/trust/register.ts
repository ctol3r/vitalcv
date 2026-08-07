/**
 * Trust State Register — Server-side data aggregation
 *
 * Assembles a live TrustRegisterSnapshot from:
 *   - JWKS (signing key)
 *   - environment vars
 *   - canonical source/verifier definitions
 */

import { getPublicKeyJwk } from '@/lib/crypto/receiptIssuer';
import {
  SOURCE_LANE_OPS,
  getLaneDisplayName,
  toRegisterLifecycle,
} from '@/lib/trust/sourceLanes';

export interface TrustRegisterSnapshot {
  // Issuer continuity
  issuerDid: string;
  jwksUri: string;
  didDocUri: string;
  signingKeyId: string | null;
  keyAlgorithm: string;

  // Doctrine state
  doctrineVersion: string;
  environment: string;
  proofTiers: string[];

  // Replay survivability
  replaySurvivable: true;
  /**
   * When this snapshot JSON was assembled (the machine-readable
   * /.well-known/trust-register uses it as `generated_at`). It is a generation
   * time, NOT a per-clinician verification event — the register page must not
   * render it as a live "checked" moment (see TrustStateRegister).
   */
  lastVerifiedAt: number;

  // Source operational state
  sources: Array<{
    sourceId: string;
    displayName: string;
    lifecycle: 'active' | 'partial' | 'planned' | 'unintegrated';
    /**
     * The key this lane publishes under in /api/status. Carried here so an
     * external prober can JOIN the rendered /status page to the /api/status
     * payload — they key differently (`board_cert` vs `board_certification`),
     * which is why W0.5's parity check needs it rather than sourceId.
     */
    statusApiKey: string;
    lastCheckedAt: number | null;
  }>;

  // Verifier continuity
  verifierEndpoints: Array<{
    path: string;
    description: string;
    requiresAuth: false;
  }>;
}

export async function getTrustRegisterSnapshot(): Promise<TrustRegisterSnapshot> {
  const publicKeyJwk = await getPublicKeyJwk();
  const signingKeyId =
    typeof publicKeyJwk.kid === 'string' ? publicKeyJwk.kid : null;

  return {
    issuerDid: 'did:web:vitalcv.com',
    jwksUri: '/.well-known/jwks.json',
    didDocUri: '/.well-known/did.json',
    signingKeyId,
    keyAlgorithm: 'ES256',

    doctrineVersion: '1.0',
    environment: process.env.VITALCV_ENV_LABEL ?? 'pilot',
    proofTiers: ['T1_self_asserted', 'T2_inferred', 'T3_source_checked', 'T4_issuer_signed'],

    replaySurvivable: true,
    lastVerifiedAt: Date.now(),

    // Derived from the canonical registry (NUM-1.5). This list used to be
    // written out by hand and had gone stale against the platform: it marked
    // OIG `partial` and omitted PECOS, so the public /status page under-reported
    // two lanes that /api/status already published as live.
    sources: SOURCE_LANE_OPS.map((lane) => ({
      sourceId: lane.laneId,
      displayName: getLaneDisplayName(lane.laneId),
      lifecycle: toRegisterLifecycle(lane.lifecycle),
      statusApiKey: lane.statusApiKey,
      lastCheckedAt: null,
    })),

    verifierEndpoints: [
      {
        path: '/.well-known/jwks.json',
        description: 'ES256 public key set',
        requiresAuth: false,
      },
      {
        path: '/.well-known/did.json',
        description: 'W3C DID document',
        requiresAuth: false,
      },
      {
        path: '/.well-known/trust.json',
        description: 'Trust manifest',
        requiresAuth: false,
      },
      {
        path: '/api/receipts/verify',
        description: 'Receipt JWT verifier',
        requiresAuth: false,
      },
    ],
  };
}
