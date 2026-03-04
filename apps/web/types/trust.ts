// ── Trust Network Type Contracts ────────────────────────────────────────
// Canonical types for trust data flowing between backend and frontend.
// Re-exports core types from trust-state/types.ts and adds domain shapes.
// ────────────────────────────────────────────────────────────────────────

export type {
  TrustBand,
  TrustStateResponse,
  TrustStateCrs,
  TrustStateTimelineEvent,
  ClaimLevel,
  CredentialStatus,
  CredentialType,
} from '@/components/trust-state/types';

import type {
  TrustBand,
  ClaimLevel,
  CredentialStatus,
  CredentialType,
} from '@/components/trust-state/types';

// ── CredentialArtifact ──────────────────────────────────────────────────
// Represents a single verified credential artifact in the trust network.

export interface CredentialArtifact {
  id: string;
  type: CredentialType;
  name: string;
  issuer: string;
  status: CredentialStatus;
  claimLevel: ClaimLevel;
  issueDate: string;
  expirationDate?: string;
  licenseId?: string;
  psvSnapshotHash?: string;
  verifierDid?: string;
  methodologyVersion?: string;
}

// ── ReadinessScore ──────────────────────────────────────────────────────
// Aggregated readiness assessment derived from trust-state CRS data.

export interface ReadinessScore {
  score: number;
  band: TrustBand;
  factors: Record<string, unknown>;
  credentialCount: number;
  psvVerifiedCount: number;
  activeCount: number;
}

// ── Fallback defaults ───────────────────────────────────────────────────
// Used when the backend is unreachable or returns invalid data.

export const FALLBACK_READINESS: ReadinessScore = {
  score: 0,
  band: 'RED',
  factors: {},
  credentialCount: 0,
  psvVerifiedCount: 0,
  activeCount: 0,
};
