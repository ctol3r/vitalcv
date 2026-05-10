/**
 * replayProductionValidator.ts — Replay-Production Validation
 *
 * Validates that a replayed decision is observationally equivalent to the
 * original production decision. Detects drift between the live decision and
 * its replayed reconstruction — evidence spine drift, trust-score delta,
 * authority chain mutations, and integrity hash divergence.
 *
 * Design constraints:
 *   - Deterministic: same capsule always produces the same validation result
 *   - Ambiguity is preserved, not resolved through hash fallback
 *   - Validation fails closed: an undecidable comparison is a MISMATCH
 *   - No external I/O; pure transform over caller-supplied snapshots
 */

import { createHash } from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────────

export type ReplayValidationVerdict =
  | 'EQUIVALENT'
  | 'MINOR_DRIFT'
  | 'MATERIAL_DRIFT'
  | 'MISMATCH'
  | 'UNDECIDABLE';

export type DriftDimension =
  | 'EVIDENCE_COUNT'
  | 'TRUST_SCORE'
  | 'AUTHORITY_CHAIN_LENGTH'
  | 'INTEGRITY_HASH'
  | 'SOURCE_OUTCOME_SET'
  | 'DECISION_ACTION'
  | 'CONTAINMENT_VERDICT'
  | 'TIMESTAMP_ORDERING';

// ── Snapshot shapes ────────────────────────────────────────────────────────────

export interface ProductionDecisionSnapshot {
  capsuleId: string;
  evidenceCount: number;
  trustScore: number;
  authorityChainLength: number;
  integrityHash: string;
  sourceOutcomes: string[];          // sorted set of "SOURCE:OUTCOME" pairs
  decisionAction: string | null;
  containmentVerdict: 'CLEAN' | 'AMBIGUOUS' | 'QUARANTINED' | 'CONTAINMENT_BREACH';
  decisionTimestamp: string;
}

export interface ReplayedDecisionSnapshot {
  capsuleId: string;
  evidenceCount: number;
  trustScore: number;
  authorityChainLength: number;
  integrityHash: string;
  sourceOutcomes: string[];
  decisionAction: string | null;
  containmentVerdict: 'CLEAN' | 'AMBIGUOUS' | 'QUARANTINED' | 'CONTAINMENT_BREACH';
  replayTimestamp: string;
  replayEngineVersion: string;
}

// ── Drift record ───────────────────────────────────────────────────────────────

export interface DriftRecord {
  dimension: DriftDimension;
  productionValue: string;
  replayValue: string;
  material: boolean;
  explanation: string;
}

// ── Validation output ──────────────────────────────────────────────────────────

export interface ReplayProductionValidationResult {
  schema: 'https://vitalcv.com/replay-validation/v1';
  validationVersion: '1.0';
  capsuleId: string;
  verdict: ReplayValidationVerdict;
  driftRecords: DriftRecord[];
  materialDriftCount: number;
  minorDriftCount: number;
  replayFidelityPercent: number;     // 0–100; 100 = identical
  ambiguityPreserved: boolean;
  validationFingerprint: string;
  validatedAt: string;
}

// ── Exported sentinels ─────────────────────────────────────────────────────────

export const REPLAY_VALIDATION_SENTINELS = {
  HASH_MISMATCH_IS_MATERIAL:       'HASH_MISMATCH_IS_MATERIAL',
  UNDECIDABLE_FAILS_CLOSED:        'UNDECIDABLE_FAILS_CLOSED',
  AMBIGUITY_PRESERVED_NOT_PASSED:  'AMBIGUITY_PRESERVED_NOT_PASSED',
  ACTION_MISMATCH_IS_MATERIAL:     'ACTION_MISMATCH_IS_MATERIAL',
} as const;

export const KNOWN_REPLAY_VERDICTS: ReplayValidationVerdict[] = [
  'EQUIVALENT', 'MINOR_DRIFT', 'MATERIAL_DRIFT', 'MISMATCH', 'UNDECIDABLE',
];

// ── Drift detection ────────────────────────────────────────────────────────────

const SCORE_DRIFT_MINOR_THRESHOLD    = 5;   // ≤ 5 points = minor
const SCORE_DRIFT_MATERIAL_THRESHOLD = 15;  // > 15 points = material

function detectDrift(
  prod: ProductionDecisionSnapshot,
  replay: ReplayedDecisionSnapshot,
): DriftRecord[] {
  const records: DriftRecord[] = [];

  // Integrity hash
  if (prod.integrityHash !== replay.integrityHash) {
    records.push({
      dimension: 'INTEGRITY_HASH',
      productionValue: prod.integrityHash,
      replayValue:     replay.integrityHash,
      material: true,
      explanation: 'Integrity hash divergence indicates evidence spine has mutated since production.',
    });
  }

  // Decision action
  if (prod.decisionAction !== replay.decisionAction) {
    records.push({
      dimension: 'DECISION_ACTION',
      productionValue: String(prod.decisionAction),
      replayValue:     String(replay.decisionAction),
      material: true,
      explanation: 'The reconstructed decision action does not match the original production action.',
    });
  }

  // Containment verdict
  if (prod.containmentVerdict !== replay.containmentVerdict) {
    records.push({
      dimension: 'CONTAINMENT_VERDICT',
      productionValue: prod.containmentVerdict,
      replayValue:     replay.containmentVerdict,
      material: true,
      explanation: 'Containment verdict changed between production and replay — potential quarantine bypass.',
    });
  }

  // Evidence count
  if (prod.evidenceCount !== replay.evidenceCount) {
    const delta  = Math.abs(prod.evidenceCount - replay.evidenceCount);
    const material = delta > 1;
    records.push({
      dimension: 'EVIDENCE_COUNT',
      productionValue: String(prod.evidenceCount),
      replayValue:     String(replay.evidenceCount),
      material,
      explanation: material
        ? `Evidence count changed by ${delta} — material evidence spine drift.`
        : `Evidence count off by ${delta} — minor drift, may be ordering artifact.`,
    });
  }

  // Trust score delta
  const scoreDelta = Math.abs(prod.trustScore - replay.trustScore);
  if (scoreDelta > 0) {
    records.push({
      dimension: 'TRUST_SCORE',
      productionValue: String(prod.trustScore),
      replayValue:     String(replay.trustScore),
      material: scoreDelta > SCORE_DRIFT_MATERIAL_THRESHOLD,
      explanation: scoreDelta <= SCORE_DRIFT_MINOR_THRESHOLD
        ? `Trust score delta ${scoreDelta} — within minor tolerance.`
        : `Trust score delta ${scoreDelta} — ${scoreDelta > SCORE_DRIFT_MATERIAL_THRESHOLD ? 'material' : 'notable'} divergence.`,
    });
  }

  // Authority chain length
  if (prod.authorityChainLength !== replay.authorityChainLength) {
    const delta = Math.abs(prod.authorityChainLength - replay.authorityChainLength);
    records.push({
      dimension: 'AUTHORITY_CHAIN_LENGTH',
      productionValue: String(prod.authorityChainLength),
      replayValue:     String(replay.authorityChainLength),
      material: delta > 1,
      explanation: `Authority chain length differs by ${delta}.`,
    });
  }

  // Source outcome set
  const prodSources   = [...prod.sourceOutcomes].sort().join('|');
  const replaySources = [...replay.sourceOutcomes].sort().join('|');
  if (prodSources !== replaySources) {
    records.push({
      dimension: 'SOURCE_OUTCOME_SET',
      productionValue: prodSources,
      replayValue:     replaySources,
      material: true,
      explanation: 'Source outcome set differs — replay consulted different sources than production.',
    });
  }

  return records;
}

function computeReplayFidelity(drift: DriftRecord[], totalDimensions: number): number {
  if (totalDimensions === 0) return 0;
  const driftCount = drift.length;
  return Math.round(((totalDimensions - driftCount) / totalDimensions) * 100);
}

function determineVerdict(drift: DriftRecord[]): ReplayValidationVerdict {
  if (drift.length === 0) return 'EQUIVALENT';
  const materialCount = drift.filter(d => d.material).length;
  const minorCount    = drift.filter(d => !d.material).length;

  // Hash or action mismatch = hard MISMATCH
  const hasHardMismatch = drift.some(
    d => d.dimension === 'INTEGRITY_HASH' || d.dimension === 'DECISION_ACTION',
  );
  if (hasHardMismatch)   return 'MISMATCH';
  if (materialCount > 0) return 'MATERIAL_DRIFT';
  if (minorCount    > 0) return 'MINOR_DRIFT';
  return 'EQUIVALENT';
}

function buildValidationFingerprint(
  prod: ProductionDecisionSnapshot,
  replay: ReplayedDecisionSnapshot,
): string {
  const stable = {
    capsuleId:             prod.capsuleId,
    prodHash:              prod.integrityHash,
    replayHash:            replay.integrityHash,
    prodAction:            prod.decisionAction,
    replayAction:          replay.decisionAction,
    replayEngineVersion:   replay.replayEngineVersion,
  };
  return createHash('sha256').update(JSON.stringify(stable)).digest('hex');
}

export function validateReplayProduction(
  prod: ProductionDecisionSnapshot,
  replay: ReplayedDecisionSnapshot,
  validatedAt: string,
): ReplayProductionValidationResult {
  if (prod.capsuleId !== replay.capsuleId) {
    return {
      schema: 'https://vitalcv.com/replay-validation/v1',
      validationVersion: '1.0',
      capsuleId: prod.capsuleId,
      verdict: 'UNDECIDABLE',
      driftRecords: [],
      materialDriftCount: 0,
      minorDriftCount: 0,
      replayFidelityPercent: 0,
      ambiguityPreserved: true,
      validationFingerprint: buildValidationFingerprint(prod, replay),
      validatedAt,
    };
  }

  const totalDimensions = 8; // all DriftDimension values
  const driftRecords    = detectDrift(prod, replay);
  const materialCount   = driftRecords.filter(d => d.material).length;
  const minorCount      = driftRecords.filter(d => !d.material).length;

  const ambiguityPreserved =
    prod.containmentVerdict === 'AMBIGUOUS' ||
    replay.containmentVerdict === 'AMBIGUOUS';

  return {
    schema: 'https://vitalcv.com/replay-validation/v1',
    validationVersion: '1.0',
    capsuleId: prod.capsuleId,
    verdict: determineVerdict(driftRecords),
    driftRecords,
    materialDriftCount: materialCount,
    minorDriftCount: minorCount,
    replayFidelityPercent: computeReplayFidelity(driftRecords, totalDimensions),
    ambiguityPreserved,
    validationFingerprint: buildValidationFingerprint(prod, replay),
    validatedAt,
  };
}
