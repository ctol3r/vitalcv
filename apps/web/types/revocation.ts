/**
 * types/revocation.ts — Wave 59: Revocation Blast Radius Types
 *
 * Mirrors the backend BlastRadiusResult from
 * apps/api/backend/src/services/decision/revocationCascade.ts
 */

// ── Backend Response Shape ────────────────────────────────────────────

export interface BlastRadiusImpactedCapsule {
  id: string;
  subjectNpi: string;
  subjectDid: string;
  decisionType: string;
  status: string;
  decisionTimestamp: string;
}

export interface BlastRadiusResult {
  credentialId: string;
  impactedCapsules: BlastRadiusImpactedCapsule[];
  impactedNpis: string[];
  impactedDecisionTypes: string[];
  totalImpacted: number;
}

// ── Empty fallback for defensive rendering ────────────────────────────

export const EMPTY_BLAST_RADIUS: BlastRadiusResult = {
  credentialId: '',
  impactedCapsules: [],
  impactedNpis: [],
  impactedDecisionTypes: [],
  totalImpacted: 0,
};
