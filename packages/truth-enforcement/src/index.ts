// ── VitalCV Truth Enforcement Layer ──────────────────────────────
// Converts the failure matrix into enforced system guarantees.
// Every seam has a guard. Every violation fails CLOSED.

import { SourceStatus, ReadinessPosture } from '../../trust-contract/dist/index';

// ── Enforcement Error ────────────────────────────────────────────

export class EnforcementViolation extends Error {
  constructor(
    public readonly seam: string,
    public readonly rule: string,
    public readonly detail: string,
    public readonly severity: 'CRITICAL' | 'HIGH' | 'MEDIUM'
  ) {
    super(`[${seam}] ${rule}: ${detail}`);
    this.name = 'EnforcementViolation';
  }
}

// ── Seam A: Adapter Validation Guards ───────────────────────────
// Ensures source adapters return structurally valid data before
// any downstream processing occurs.

export interface AdapterResult {
  sourceId: string;
  status: SourceStatus;
  raw: unknown;
}

export function guardAdapterResult(result: AdapterResult): void {
  if (!result.sourceId || typeof result.sourceId !== 'string') {
    throw new EnforcementViolation('A', 'A1_SOURCE_ID_REQUIRED', 'Adapter result must include a valid sourceId.', 'CRITICAL');
  }
  if (!Object.values(SourceStatus).includes(result.status)) {
    throw new EnforcementViolation('A', 'A2_INVALID_STATUS', `Adapter returned invalid SourceStatus: ${result.status}`, 'CRITICAL');
  }
  if (result.status === SourceStatus.CHECKED && !result.raw) {
    throw new EnforcementViolation('A', 'A3_CHECKED_WITHOUT_DATA', 'Adapter returned CHECKED status but no raw data payload.', 'HIGH');
  }
}

// ── Seam B: Readiness Transition Guards ─────────────────────────
// Prevents unsafe state promotions in the readiness posture.

export function guardReadinessTransition(
  current: ReadinessPosture,
  next: ReadinessPosture,
  context: { hasReviewRequired: boolean; criticalLanesChecked: boolean; hasAdverseSignal: boolean }
): void {
  // B1: Cannot promote if reviewRequired exists
  if (context.hasReviewRequired && (next === ReadinessPosture.DECISION_GRADE)) {
    throw new EnforcementViolation('B', 'B1_PROMOTION_WITH_REVIEW_REQUIRED', 
      `Cannot promote to ${next} while reviewRequired flags exist on critical lanes.`, 'CRITICAL');
  }

  // B2: Cannot reach DECISION_GRADE without all critical lanes checked
  if (next === ReadinessPosture.DECISION_GRADE && !context.criticalLanesChecked) {
    throw new EnforcementViolation('B', 'B2_DECISION_WITHOUT_CRITICAL_LANES',
      'Cannot promote to DECISION_GRADE unless all critical lanes are CHECKED.', 'CRITICAL');
  }

  // B3: BLOCKED requires an adverse signal
  if (next === ReadinessPosture.BLOCKED && !context.hasAdverseSignal) {
    throw new EnforcementViolation('B', 'B3_BLOCKED_WITHOUT_SIGNAL',
      'Cannot set BLOCKED posture without a documented adverse signal (exclusion, revocation).', 'CRITICAL');
  }

  // B4: Cannot skip from CHECKING directly to BLOCKED without evidence
  if (current === ReadinessPosture.CHECKING && next === ReadinessPosture.BLOCKED && !context.hasAdverseSignal) {
    throw new EnforcementViolation('B', 'B4_CHECKING_TO_BLOCKED_WITHOUT_EVIDENCE',
      'Cannot transition from CHECKING to BLOCKED without an adverse signal.', 'CRITICAL');
  }
}

// ── Seam C: Canonical Path Guards ────────────────────────────────
// Ensures the system only uses the canonical execution path.

export function guardCanonicalPath(pathUsed: string): void {
  const CANONICAL_PATHS = ['omega', 'source-adapters', 'manifest-engine'];
  if (!CANONICAL_PATHS.includes(pathUsed)) {
    throw new EnforcementViolation('C', 'C1_NON_CANONICAL_PATH',
      `Execution used non-canonical path: ${pathUsed}. Only ${CANONICAL_PATHS.join(', ')} are permitted.`, 'HIGH');
  }
}

// ── Seam D: Audit Transaction Guards ─────────────────────────────
// Ensures every state-changing action produces an AuditEvent.

export interface AuditWriteResult {
  success: boolean;
  eventId: string | null;
}

export function guardAuditTransaction(action: string, auditResult: AuditWriteResult): void {
  // D1: No 2xx response without AuditEvent write
  if (action !== 'view_readonly' && !auditResult.success) {
    throw new EnforcementViolation('D', 'D1_NO_AUDIT_FOR_STATE_CHANGE',
      `Action "${action}" completed but no AuditEvent was written. Transaction must be rolled back.`, 'CRITICAL');
  }
  if (action !== 'view_readonly' && !auditResult.eventId) {
    throw new EnforcementViolation('D', 'D2_AUDIT_EVENT_ID_MISSING',
      `AuditEvent was written but returned no eventId. Traceability broken.`, 'HIGH');
  }
}

// ── Seam E: UI Truth Mapping Guards ──────────────────────────────
// Ensures the frontend only renders backend-verified state.

export function guardUiTruthMapping(uiState: { posture: string; backendPosture: string; scoreVisible: boolean; minimumEvidenceMet: boolean }): void {
  // E1: UI posture must match backend posture exactly
  if (uiState.posture !== uiState.backendPosture) {
    throw new EnforcementViolation('E', 'E1_UI_BACKEND_POSTURE_MISMATCH',
      `UI renders "${uiState.posture}" but backend returned "${uiState.backendPosture}". Frontend must not derive state.`, 'CRITICAL');
  }

  // E2: Score must not be visible before minimum evidence
  if (uiState.scoreVisible && !uiState.minimumEvidenceMet) {
    throw new EnforcementViolation('E', 'E2_SCORE_BEFORE_EVIDENCE',
      'Score/decision is visible in UI but minimum evidence threshold is not met.', 'CRITICAL');
  }
}

// ── Seam F: Copy Validation Rules ────────────────────────────────
// Ensures exported/copied data preserves integrity.

export function guardCopyValidation(copy: { manifestId: string; claimCount: number; receiptCount: number; hasBlockedLanes: boolean; blockedSignalsCount: number }): void {
  // F1: No "checked" without verified receipt
  if (copy.claimCount > 0 && copy.receiptCount === 0) {
    throw new EnforcementViolation('F', 'F1_CHECKED_WITHOUT_RECEIPT',
      `Manifest has ${copy.claimCount} claims but 0 receipts. Copy cannot be trusted.`, 'HIGH');
  }

  // F2: BLOCKED lanes must have signals
  if (copy.hasBlockedLanes && copy.blockedSignalsCount === 0) {
    throw new EnforcementViolation('F', 'F2_BLOCKED_WITHOUT_SIGNALS',
      'Manifest has BLOCKED lanes but 0 adverse signal documents.', 'CRITICAL');
  }
}

// ── Seam G: Temporal Validation Guards ───────────────────────────
// Ensures freshness and prevents stale data from being treated as current.

export interface TemporalCheck {
  laneId: string;
  checkedAt: string;
  ttlMs: number;
  status: SourceStatus;
}

export function guardTemporalValidation(lanes: TemporalCheck[]): void {
  const now = Date.now();

  for (const lane of lanes) {
    const ageMs = now - new Date(lane.checkedAt).getTime();

    // G1: Stale critical data must not be treated as fresh
    if (lane.status === SourceStatus.CHECKED && ageMs > lane.ttlMs) {
      throw new EnforcementViolation('G', 'G1_STALE_TREATED_AS_FRESH',
        `Lane "${lane.laneId}" is CHECKED but expired ${(ageMs / (1000 * 60 * 60)).toFixed(1)}h ago (TTL: ${(lane.ttlMs / (1000 * 60 * 60)).toFixed(1)}h). Must be STALE.`, 'HIGH');
    }

    // G2: UNAVAILABLE lanes must not be silently retried without logging
    if (lane.status === SourceStatus.UNAVAILABLE && ageMs < 5 * 60 * 1000) {
      // Less than 5 minutes since unavailable — too fast for a real retry
      throw new EnforcementViolation('G', 'G2_PREMATURE_RETRY',
        `Lane "${lane.laneId}" is UNAVAILABLE but was rechecked only ${((ageMs) / 1000).toFixed(0)}s ago. Retry too fast.`, 'MEDIUM');
    }
  }
}

// ── Universal Enforcement Gate ───────────────────────────────────

export type SeamGuardFn = () => void;

export interface EnforcementResult {
  passed: boolean;
  violations: EnforcementViolation[];
}

/**
 * Runs a set of guards. If any fail, throws the first CRITICAL violation.
 * All violations are collected regardless for audit logging.
 */
export function enforce(guards: SeamGuardFn[]): EnforcementResult {
  const violations: EnforcementViolation[] = [];

  for (const guard of guards) {
    try {
      guard();
    } catch (err) {
      if (err instanceof EnforcementViolation) {
        violations.push(err);
      } else {
        violations.push(new EnforcementViolation('UNKNOWN', 'UNEXPECTED', String(err), 'HIGH'));
      }
    }
  }

  // Fail-closed: throw first critical violation
  const critical = violations.find(v => v.severity === 'CRITICAL');
  if (critical) {
    throw critical;
  }

  return { passed: violations.length === 0, violations };
}
