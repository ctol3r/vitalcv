/**
 * @vitalcv/domain-evidence — typed facade over evidence that already exists
 * across domain-common, source-adapters, trust-state, audit, and the Prisma
 * store (see docs/wave215/C3-domain-evidence-package.md).
 *
 * These are TYPES ONLY. The package introduces no persistence. All runtime
 * helpers (collection.ts) are pure transforms — no fetches, no writes — mirroring
 * the discipline of apps/web/lib/issuer-verification/*.
 */

import type { CanonicalSourceCoverageState } from '@vitalcv/trust-state';

/**
 * EvidenceStatus is LITERALLY the canonical source-coverage vocabulary, so the
 * two can never drift. Only 'checked' is decision-grade (see isDecisionGradeStatus).
 */
export type EvidenceStatus = CanonicalSourceCoverageState;

/** The unifying discriminator across the six existing evidence representations. */
export type EvidenceClass =
  | 'identity'
  | 'licensure'
  | 'board_cert'
  | 'registration'
  | 'exclusion'
  | 'enrollment'
  | 'privilege'
  | 'peer_review'
  | 'recognition'
  | 'acceptance'
  | 'start'
  | 'employment'
  | 'research'
  | 'publication'
  | 'training';

/** Lifecycle of a single evidence object (independent of freshness/status). */
export type EvidenceLifecycle = 'active' | 'superseded' | 'revoked' | 'expired';

/** Normalized atomic value carried by an evidence object. */
export type EvidenceValue = string | number | boolean | null | Record<string, unknown>;

export interface EvidenceSource {
  sourceId: string;
  sourceLabel: string;
  /** Reuse source-adapters LaneType when known (identity | exclusion | …). */
  laneType: string | null;
  /** Reuse sourceGovernance (open | gated | human_lookup_only | …) when known. */
  governance: string | null;
}

export interface EvidenceProvenance {
  artifactIds: string[];
  receiptIds: string[];
  sourceUrl: string | null;
  checksum: string | null;
  parserVersion: string | null;
}

export interface EvidenceObject {
  evidenceId: string;
  /** VcvEntity.canonicalId or NPI — the subject this evidence is about. */
  subjectKey: string;
  evidenceClass: EvidenceClass;
  label: string;
  value: EvidenceValue;
  status: EvidenceStatus;
  source: EvidenceSource;
  trustTier: string | null;
  /** MUST equal isDecisionGradeStatus(status). Never widened. */
  decisionGrade: boolean;
  observedAt: string | null;
  checkedAt: string | null;
  expiresAt: string | null;
  freshnessWindowHours: number | null;
  integrityHash: string | null;
  provenance: EvidenceProvenance;
  lifecycle: EvidenceLifecycle;
  supersedes: string | null;
  supersededBy: string | null;
}

export type EvidenceRelationshipType =
  | 'issued_by'
  | 'verified_by'
  | 'derived_from'
  | 'proven_by'
  | 'supersedes'
  | 'affiliated_with'
  | 'trained_at'
  | 'works_at'
  | 'accepted_by'
  | 'attested_by';

export interface EvidenceRelationship {
  /** evidenceId or subjectKey. */
  from: string;
  /** evidenceId, sourceId, or entity key. */
  to: string;
  type: EvidenceRelationshipType;
  confidence: number | null;
  observedAt: string | null;
}

export interface EvidenceCollection {
  subjectKey: string;
  generatedFor: { displayName: string; npi: string | null };
  objects: EvidenceObject[];
  relationships: EvidenceRelationship[];
  /** Convenience rollup — every class key present, empty arrays when none. */
  byClass: Record<EvidenceClass, EvidenceObject[]>;
  /** sourceIds grouped by EvidenceStatus (parallels CanonicalSourceCoverageSummary). */
  coverageSummary: Record<EvidenceStatus, string[]>;
}
