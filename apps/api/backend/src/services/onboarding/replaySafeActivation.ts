/**
 * replaySafeActivation.ts — W2-PR167A
 *
 * Replay-Safe Ecosystem Activation Layer.
 *
 * Every onboarding stage transition produces a ReplayActivationRecord — a
 * tamper-evident, self-describing record that cites the audit lineage it
 * derives from. The record is the atomic unit of onboarding accountability.
 *
 * Hard invariants:
 *
 *   1. no lineage → LINEAGE_MISSING verdict. The record is generated but
 *      flagged; the convergence engine treats it as CONVERGENCE_BREACH.
 *   2. lineage digest mismatch → LINEAGE_TAMPERED. The original lineageId
 *      is preserved so a regulator can locate the tampered record.
 *   3. replay deterministic — given the same inputs, buildReplayActivationRecord
 *      always produces the same recordDigest. Tests can verify this.
 *   4. fail-closed — LINEAGE_MISSING and LINEAGE_TAMPERED records may not
 *      be used to mark a stage COMPLETED. Callers must gate on
 *      record.lineageVerdict === 'LINEAGE_VERIFIED'.
 *
 * Pure transform — no fetches, no DB writes.
 */

import { sha256ForPayload } from '../../utils/deterministic';
import type { ActivationSignal, MilestoneStatus } from './onboardingConvergence';

// ── Types ─────────────────────────────────────────────────────────────────────

export type LineageVerdict =
  | 'LINEAGE_VERIFIED'
  | 'LINEAGE_MISSING'
  | 'LINEAGE_TAMPERED';

export interface ActivationLineageRef {
  lineageId: string;
  /** SHA-256 of the lineage payload at issue time. Used for tamper detection. */
  lineageDigestAtIssue: string;
}

export interface ReplayActivationRecord {
  schema: 'vitalcv.replay-activation.v1';
  recordId: string;
  entityId: string;
  role: ActivationSignal['role'];
  milestoneId: string;
  milestoneStatus: MilestoneStatus;
  orgId: string;
  observedAt: string;
  lineageRef: ActivationLineageRef | null;
  lineageVerdict: LineageVerdict;
  /**
   * Deterministic SHA-256 of all identifying fields except recordDigest itself.
   * Reproducible: sha256(entityId + role + milestoneId + milestoneStatus + orgId + observedAt + lineageId?).
   */
  recordDigest: string;
}

export interface ReplayActivationInputs {
  entityId: string;
  role: ActivationSignal['role'];
  milestoneId: string;
  milestoneStatus: MilestoneStatus;
  orgId: string;
  observedAt: string;
  lineageRef: ActivationLineageRef | null;
  /**
   * Optional: the current lineage digest to compare against lineageRef.lineageDigestAtIssue.
   * If provided and mismatches, verdict becomes LINEAGE_TAMPERED.
   */
  currentLineageDigest?: string;
}

export interface ActivationReplayBatch {
  schema: 'vitalcv.activation-replay-batch.v1';
  records: ReplayActivationRecord[];
  batchDigest: string;
  missingLineageCount: number;
  tamperedLineageCount: number;
  verifiedLineageCount: number;
  computedAt: string;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function computeRecordDigest(inputs: Omit<ReplayActivationRecord, 'recordDigest' | 'lineageVerdict'>): string {
  return sha256ForPayload({
    recordId: inputs.recordId,
    entityId: inputs.entityId,
    role: inputs.role,
    milestoneId: inputs.milestoneId,
    milestoneStatus: inputs.milestoneStatus,
    orgId: inputs.orgId,
    observedAt: inputs.observedAt,
    lineageId: inputs.lineageRef?.lineageId ?? null,
  });
}

function deriveRecordId(inputs: ReplayActivationInputs): string {
  return sha256ForPayload({
    entityId: inputs.entityId,
    role: inputs.role,
    milestoneId: inputs.milestoneId,
    observedAt: inputs.observedAt,
    orgId: inputs.orgId,
  }).slice(0, 32);
}

function verifyLineage(
  ref: ActivationLineageRef | null,
  currentDigest: string | undefined,
): LineageVerdict {
  if (ref === null) return 'LINEAGE_MISSING';
  if (currentDigest !== undefined && currentDigest !== ref.lineageDigestAtIssue) {
    return 'LINEAGE_TAMPERED';
  }
  return 'LINEAGE_VERIFIED';
}

// ── Public API ────────────────────────────────────────────────────────────────

export function buildReplayActivationRecord(
  inputs: ReplayActivationInputs,
): ReplayActivationRecord {
  const recordId = deriveRecordId(inputs);
  const lineageVerdict = verifyLineage(inputs.lineageRef, inputs.currentLineageDigest);

  const partial = {
    schema: 'vitalcv.replay-activation.v1' as const,
    recordId,
    entityId: inputs.entityId,
    role: inputs.role,
    milestoneId: inputs.milestoneId,
    milestoneStatus: inputs.milestoneStatus,
    orgId: inputs.orgId,
    observedAt: inputs.observedAt,
    lineageRef: inputs.lineageRef,
  };

  return {
    ...partial,
    lineageVerdict,
    recordDigest: computeRecordDigest(partial),
  };
}

export function buildActivationReplayBatch(
  inputs: ReplayActivationInputs[],
): ActivationReplayBatch {
  const records = inputs.map(buildReplayActivationRecord);

  const missing = records.filter((r) => r.lineageVerdict === 'LINEAGE_MISSING').length;
  const tampered = records.filter((r) => r.lineageVerdict === 'LINEAGE_TAMPERED').length;
  const verified = records.filter((r) => r.lineageVerdict === 'LINEAGE_VERIFIED').length;

  const batchDigest = sha256ForPayload({
    records: records.map((r) => ({ id: r.recordId, digest: r.recordDigest }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  });

  return {
    schema: 'vitalcv.activation-replay-batch.v1',
    records,
    batchDigest,
    missingLineageCount: missing,
    tamperedLineageCount: tampered,
    verifiedLineageCount: verified,
    computedAt: new Date().toISOString(),
  };
}

/**
 * Convert a ReplayActivationRecord back to an ActivationSignal for feeding
 * the convergence engine. Preserves lineage verdict as null when missing/tampered.
 */
export function replayRecordToSignal(record: ReplayActivationRecord): ActivationSignal {
  return {
    schema: 'vitalcv.activation-signal.v1',
    signalId: record.recordId,
    observedAt: record.observedAt,
    entityId: record.entityId,
    role: record.role,
    milestoneId: record.milestoneId,
    milestoneStatus: record.milestoneStatus,
    sourceAuditLineageId:
      record.lineageVerdict === 'LINEAGE_VERIFIED'
        ? (record.lineageRef?.lineageId ?? null)
        : null,
    orgId: record.orgId,
  };
}
