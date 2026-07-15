/**
 * Trust State Register — Server-side data aggregation
 *
 * Assembles a live TrustRegisterSnapshot from:
 *   - JWKS (signing key)
 *   - environment vars
 *   - canonical source/verifier definitions
 */

import { getPublicKeyJwk } from '@/lib/crypto/receiptIssuer';

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

    sources: [
      {
        sourceId: 'nppes_identity',
        displayName: 'NPPES Identity',
        lifecycle: 'active',
        lastCheckedAt: null,
      },
      {
        sourceId: 'oig_exclusions',
        displayName: 'OIG Exclusions',
        lifecycle: 'partial',
        lastCheckedAt: null,
      },
      {
        sourceId: 'state_license',
        displayName: 'State License',
        lifecycle: 'planned',
        lastCheckedAt: null,
      },
      {
        sourceId: 'employment_history',
        displayName: 'Employment History',
        lifecycle: 'unintegrated',
        lastCheckedAt: null,
      },
      {
        sourceId: 'board_cert',
        displayName: 'Board Certification',
        lifecycle: 'unintegrated',
        lastCheckedAt: null,
      },
    ],

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
