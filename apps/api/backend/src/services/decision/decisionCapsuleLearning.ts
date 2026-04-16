// ── VitalCV Decision Capsule Learning MVP ────────────────────────
// Captures a structured, hashable, and replayable snapshot of a decision
// at the exact moment of an outcome (start, rejection, etc.) to feed
// empirical learning algorithms.

import { createAuditEvent, AuditEventType } from '../../../../packages/source-adapters/src/audit-events';
import { VITALCV_SYSTEM_ISSUER } from '../../../../packages/trust-contract/src/multi-issuer';
import crypto from 'crypto';

export interface DecisionCapsulePayload {
  clinicianId: string; // NPI
  orgId: string;
  role: string;
  recognitionState: string; // e.g. "DECISION_GRADE"
  acceptanceState: string; // e.g. "PROCEED"
  startabilityState: string; // e.g. "READY_TO_START"
  blockers: string[]; // List of blocking requirements
  outcome: 'ACCEPTED' | 'REJECTED' | 'STARTED' | 'BLOCKER_RESOLVED';
  timestamp: string;
}

export interface StoredDecisionCapsule {
  capsuleId: string;
  hash: string;
  payload: DecisionCapsulePayload;
}

/**
 * Creates a deterministic, hashable decision capsule for learning/replay.
 */
export function generateCapsuleHash(payload: DecisionCapsulePayload): string {
  // Canonical serialization: sorting keys guarantees deterministic hashing
  const canonicalString = JSON.stringify(payload, Object.keys(payload).sort());
  return crypto.createHash('sha256').update(canonicalString).digest('hex');
}

/**
 * Stores the decision capsule and emits an immutable Audit Event.
 */
export async function storeDecisionCapsule(payload: DecisionCapsulePayload): Promise<StoredDecisionCapsule> {
  const hash = generateCapsuleHash(payload);
  const capsuleId = `cap_${Date.now()}_${payload.clinicianId}`;

  const capsule: StoredDecisionCapsule = {
    capsuleId,
    hash,
    payload
  };

  console.log(`[LEARNING CAPSULE] Storing outcome ${payload.outcome} for NPI ${payload.clinicianId}`);
  console.log(` -> Capsule Hash: ${hash}`);

  // Emit the required Audit Event
  const auditEvent = createAuditEvent(
    AuditEventType.VERIFICATION_COMPLETED, // General type covering an outcome
    payload.clinicianId,
    VITALCV_SYSTEM_ISSUER.issuerId,
    {
      capsuleId,
      capsuleHash: hash,
      outcome: payload.outcome,
      orgId: payload.orgId,
    }
  );

  // In production, we'd insert this into Prisma.
  // await prisma.decisionCapsuleLearning.create({ data: { ... } });
  // await prisma.auditEvent.create({ data: auditEvent });

  return capsule;
}
