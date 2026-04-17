/**
 * Trust Contract — Contradiction Detector
 * wave-120: Truth Engine Enforcement
 *
 * Hard rules that FAIL FAST when system state is inconsistent.
 * These are build-time / runtime checks — not UI logic.
 *
 * If a contradiction is detected, the output is SUPPRESSED and
 * an error is logged. The UI must never render incorrect state.
 */

import { SourceStatus, ReadinessPosture, ProofAvailability } from './enums';
import { LaneSnapshot } from './gating';

// ─── Contradiction Types ─────────────────────────────────────────

export interface Contradiction {
  code: string;
  severity: 'error' | 'warning';
  message: string;
  affectedLanes?: string[];
}

// ─── Detection Rules ──────────────────────────────────────────────

/**
 * Run all contradiction checks against the current system state.
 * Returns an array of detected contradictions (empty = clean).
 *
 * CALL THIS before rendering any readiness UI or exporting any proof.
 */
export function detectContradictions(input: {
  lanes: LaneSnapshot[];
  displayedScore: number | null;
  displayedDaysToStart: number | null;
  proofAvailability: ProofAvailability;
  readinessPosture: ReadinessPosture;
  receiptCount: number;
}): Contradiction[] {
  const issues: Contradiction[] = [];
  const { lanes, displayedScore, displayedDaysToStart, proofAvailability, readinessPosture, receiptCount } = input;

  const verifiedLanes = lanes.filter(l => l.status === SourceStatus.VERIFIED);
  const adverseLanes = lanes.filter(l => l.status === SourceStatus.ADVERSE);
  const pendingLanes = lanes.filter(l => [
    SourceStatus.NOT_CHECKED,
    SourceStatus.IN_PROGRESS,
    SourceStatus.UNAVAILABLE,
    SourceStatus.ACCESS_REQUIRED,
  ].includes(l.status));

  // RULE 1: Score shown with zero verified lanes
  if (displayedScore !== null && verifiedLanes.length === 0) {
    issues.push({
      code: 'SCORE_WITHOUT_EVIDENCE',
      severity: 'error',
      message: `Score ${displayedScore} displayed but no lanes are verified. Score must be null when verified_lanes === 0.`,
    });
  }

  // RULE 2: Proof available with zero receipts
  if (proofAvailability !== ProofAvailability.NONE && receiptCount === 0) {
    issues.push({
      code: 'PROOF_WITHOUT_RECEIPT',
      severity: 'error',
      message: `Proof availability is "${proofAvailability}" but receipt count is 0. At least one receipt is required.`,
    });
  }

  // RULE 3: BLOCKED posture with no adverse evidence
  if (readinessPosture === ReadinessPosture.BLOCKED && adverseLanes.length === 0) {
    issues.push({
      code: 'BLOCKED_WITHOUT_ADVERSE',
      severity: 'error',
      message: 'Readiness posture is BLOCKED but no lanes have ADVERSE status. BLOCKED requires explicit adverse evidence.',
    });
  }

  // RULE 4: BLOCKED + PENDING simultaneously on the same lane
  for (const lane of adverseLanes) {
    const pendingLane = pendingLanes.find(l => l.laneId === lane.laneId);
    if (pendingLane) {
      issues.push({
        code: 'BLOCKED_AND_PENDING_SAME_LANE',
        severity: 'error',
        message: `Lane "${lane.laneId}" is both ADVERSE and PENDING. A lane cannot be blocked and pending simultaneously.`,
        affectedLanes: [lane.laneId],
      });
    }
  }

  // RULE 5: UNAVAILABLE treated as blocker
  for (const lane of lanes) {
    if (lane.status === SourceStatus.UNAVAILABLE && adverseLanes.some(a => a.laneId === lane.laneId)) {
      issues.push({
        code: 'UNAVAILABLE_AS_BLOCKER',
        severity: 'error',
        message: `Lane "${lane.laneId}" is UNAVAILABLE but also flagged as ADVERSE. Unavailable is a system state — it cannot be a blocker.`,
        affectedLanes: [lane.laneId],
      });
    }
  }

  // RULE 6: Days-to-start shown with non-decision-grade posture
  if (displayedDaysToStart !== null && readinessPosture !== ReadinessPosture.DECISION_GRADE) {
    issues.push({
      code: 'DAYS_TO_START_WITHOUT_DECISION_GRADE',
      severity: 'error',
      message: `Days-to-start (${displayedDaysToStart}) displayed but posture is "${readinessPosture}". Only DECISION_GRADE posture may show a days-to-start estimate.`,
    });
  }

  // RULE 7: Lane claims VERIFIED without a receipt
  for (const lane of verifiedLanes) {
    if (!lane.hasReceipt) {
      issues.push({
        code: 'VERIFIED_WITHOUT_RECEIPT',
        severity: 'warning',
        message: `Lane "${lane.laneId}" claims VERIFIED status but has no receipt. Receipt is required for VERIFIED state.`,
        affectedLanes: [lane.laneId],
      });
    }
  }

  // RULE 8: Lane claims VERIFIED without a checkedAt timestamp
  for (const lane of verifiedLanes) {
    if (!lane.checkedAt || lane.checkedAt <= 0) {
      issues.push({
        code: 'VERIFIED_WITHOUT_TIMESTAMP',
        severity: 'error',
        message: `Lane "${lane.laneId}" claims VERIFIED but has no checkedAt timestamp. This is synthetic data.`,
        affectedLanes: [lane.laneId],
      });
    }
  }

  // RULE 9: DECISION_GRADE posture with pending required lanes
  if (readinessPosture === ReadinessPosture.DECISION_GRADE) {
    const requiredLanes = ['nppes_identity', 'oig_exclusions', 'state_license'];
    for (const req of requiredLanes) {
      const lane = lanes.find(l => l.laneId === req);
      if (!lane || lane.status !== SourceStatus.VERIFIED) {
        issues.push({
          code: 'DECISION_GRADE_WITH_MISSING_REQUIRED_LANE',
          severity: 'error',
          message: `Posture is DECISION_GRADE but required lane "${req}" is not VERIFIED (status: ${lane?.status ?? 'missing'}).`,
          affectedLanes: [req],
        });
      }
    }
  }

  return issues;
}

/**
 * Throws if any ERROR-severity contradictions are found.
 * Use in server-side rendering and API routes to fail fast.
 */
export function assertNoContradictions(
  input: Parameters<typeof detectContradictions>[0],
  context: string
): void {
  const issues = detectContradictions(input);
  const errors = issues.filter(i => i.severity === 'error');
  if (errors.length > 0) {
    const msg = errors.map(e => `[${e.code}] ${e.message}`).join('\n');
    throw new Error(`Trust contract violation in "${context}":\n${msg}`);
  }
  // Log warnings
  for (const w of issues.filter(i => i.severity === 'warning')) {
    console.warn(`[trust-contract:warning] [${w.code}] ${w.message}`);
  }
}

/**
 * Safe version for UI rendering — returns clean state or suppressed state.
 * Never throws; logs errors instead.
 */
export function safeRender<T>(
  input: Parameters<typeof detectContradictions>[0],
  safeOutput: T,
  suppressedOutput: T,
  context: string
): T {
  const issues = detectContradictions(input);
  const errors = issues.filter(i => i.severity === 'error');

  if (errors.length > 0) {
    for (const e of errors) {
      console.error(`[trust-contract:render-suppressed] [${context}] [${e.code}] ${e.message}`);
    }
    return suppressedOutput;
  }

  return safeOutput;
}
