// ── VitalCV System Coherence & Failure Hardening ──────────────────
// Guarantees NO contradictions, NO drift, NO unsafe states across the entire pipeline.

import { SourceStatus, ReadinessPosture } from './index';

// ── System Graph ─────────────────────────────────────────────────

export enum SystemNode {
  REGISTRY = 'registry',
  INGESTION = 'ingestion',
  CLAIMS = 'claims',
  RECEIPTS = 'receipts',
  ARBITRATION = 'arbitration',
  EXPLAINABILITY = 'explainability',
  MANIFEST = 'manifest',
  DECISION = 'decision',
  ATTESTATION = 'attestation',
  DRIFT = 'drift',
  MONITORING = 'monitoring',
  AUDIT = 'audit',
}

/** Defines the linear dependency chain. No node may execute without upstream integrity. */
export const SYSTEM_DEPENDENCIES: Record<SystemNode, SystemNode[]> = {
  [SystemNode.REGISTRY]: [],
  [SystemNode.INGESTION]: [SystemNode.REGISTRY],
  [SystemNode.CLAIMS]: [SystemNode.INGESTION, SystemNode.REGISTRY],
  [SystemNode.RECEIPTS]: [SystemNode.INGESTION],
  [SystemNode.ARBITRATION]: [SystemNode.CLAIMS, SystemNode.REGISTRY],
  [SystemNode.EXPLAINABILITY]: [SystemNode.ARBITRATION, SystemNode.CLAIMS, SystemNode.REGISTRY],
  [SystemNode.MANIFEST]: [SystemNode.CLAIMS, SystemNode.RECEIPTS, SystemNode.ARBITRATION, SystemNode.EXPLAINABILITY],
  [SystemNode.DECISION]: [SystemNode.MANIFEST],
  [SystemNode.ATTESTATION]: [SystemNode.DECISION, SystemNode.MANIFEST],
  [SystemNode.DRIFT]: [SystemNode.MANIFEST, SystemNode.INGESTION],
  [SystemNode.MONITORING]: [SystemNode.DRIFT],
  [SystemNode.AUDIT]: [], // Audit observes all nodes; no upstream dependency
};

// ── Coherence Check Model ────────────────────────────────────────

export interface CoherenceViolation {
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  rule: string;
  detail: string;
  affectedNodes: SystemNode[];
}

export interface SystemCoherenceReport {
  coherent: boolean;
  contradictions: CoherenceViolation[];
  failureGaps: CoherenceViolation[];
  weakestNode: SystemNode | null;
  nextCriticalPath: string;
}

// ── Contradiction Rules ──────────────────────────────────────────

export interface CoherenceContext {
  /** Did arbitration produce a result? */
  hasArbitrationResult: boolean;
  /** Did explainability produce a winning claim? */
  hasExplainabilityWinner: boolean;
  /** Do the two agree on the same final value? */
  arbitrationMatchesExplainability: boolean;
  /** Current readiness posture */
  readinessPosture: string;
  /** Are all critical coverage lanes checked? */
  allCriticalLanesChecked: boolean;
  /** Does every CHECKED claim have a receipt? */
  allCheckedClaimsHaveReceipts: boolean;
  /** Is there a BLOCKED status without a documented adverse signal? */
  blockedWithoutSignal: boolean;
  /** Is a score/decision being surfaced before minimum evidence? */
  decisionBeforeMinimumEvidence: boolean;
  /** Are there any stale critical lanes? */
  staleCriticalLanes: boolean;
  /** Were any sources unavailable during ingestion? */
  missingSourceChecks: boolean;
  /** Were any claims from revoked issuers included? */
  revokedIssuerClaimsIncluded: boolean;
  /** Were any claims with invalid signatures included? */
  invalidSignatureClaimsIncluded: boolean;
}

export function validateSystemCoherence(ctx: CoherenceContext): SystemCoherenceReport {
  const contradictions: CoherenceViolation[] = [];
  const failureGaps: CoherenceViolation[] = [];
  let weakestNode: SystemNode | null = null;
  let maxSeverity = 0;

  const addViolation = (list: CoherenceViolation[], severity: CoherenceViolation['severity'], rule: string, detail: string, nodes: SystemNode[]) => {
    list.push({ severity, rule, detail, affectedNodes: nodes });
    const sevMap = { CRITICAL: 3, HIGH: 2, MEDIUM: 1 };
    if (sevMap[severity] > maxSeverity) {
      maxSeverity = sevMap[severity];
      // Track weakest node based on highest severity violation
      weakestNode = nodes[0];
    }
  };

  // ── CONTRADICTION RULES ──────────────────────────────────────

  // C1: Arbitration result must match explainability winningClaim
  if (ctx.hasArbitrationResult && ctx.hasExplainabilityWinner && !ctx.arbitrationMatchesExplainability) {
    addViolation(contradictions, 'CRITICAL',
      'C1_ARBITRATION_EXPLAINABILITY_MISMATCH',
      'Arbitration engine produced a different final value than the Explainability engine winning claim.',
      [SystemNode.ARBITRATION, SystemNode.EXPLAINABILITY]
    );
  }

  // C2: ReadinessPosture must reflect coverage reality
  if (!ctx.allCriticalLanesChecked && ctx.readinessPosture === ReadinessPosture.DECISION_GRADE) {
    addViolation(contradictions, 'CRITICAL',
      'C2_READINESS_COVERAGE_MISMATCH',
      `ReadinessPosture is CLEAR but not all critical lanes are checked. Posture must be PARTIAL or INSUFFICIENT_DATA.`,
      [SystemNode.MANIFEST, SystemNode.DECISION]
    );
  }

  // C3: Every CHECKED claim must have a receipt
  if (!ctx.allCheckedClaimsHaveReceipts) {
    addViolation(contradictions, 'HIGH',
      'C3_MISSING_RECEIPT_FOR_CHECKED_LANE',
      'One or more CHECKED claims lack a cryptographic receipt. Manifest integrity cannot be guaranteed.',
      [SystemNode.CLAIMS, SystemNode.RECEIPTS, SystemNode.MANIFEST]
    );
  }

  // C4: BLOCKED status requires documented adverse signal
  if (ctx.blockedWithoutSignal) {
    addViolation(contradictions, 'CRITICAL',
      'C4_BLOCKED_WITHOUT_SIGNAL',
      'BLOCKED readiness posture was set without an exclusion, revocation, or adverse signal in the evidence.',
      [SystemNode.CLAIMS, SystemNode.DECISION]
    );
  }

  // C5: Decision/score must not surface before minimum evidence
  if (ctx.decisionBeforeMinimumEvidence) {
    addViolation(contradictions, 'HIGH',
      'C5_DECISION_BEFORE_MINIMUM_EVIDENCE',
      'A decision-grade posture was surfaced before the minimum evidence threshold was met.',
      [SystemNode.DECISION, SystemNode.MANIFEST]
    );
  }

  // ── FAILURE HARDENING RULES ──────────────────────────────────

  // F1: Missing sourceCheck → must degrade
  if (ctx.missingSourceChecks && !ctx.staleCriticalLanes) {
    // If sources are missing but system didn't flag as stale/degraded, that's a gap
    addViolation(failureGaps, 'HIGH',
      'F1_MISSING_SOURCE_NOT_DEGRADED',
      'Source checks are missing but the system did not downgrade to STALE or INSUFFICIENT_DATA.',
      [SystemNode.INGESTION, SystemNode.MANIFEST]
    );
  }

  // F2: Revoked issuer claims must be excluded
  if (ctx.revokedIssuerClaimsIncluded) {
    addViolation(failureGaps, 'CRITICAL',
      'F2_REVOKED_ISSUER_CLAIM_INCLUDED',
      'Claims from a revoked issuer were included in the Manifest without being filtered by the Arbitration engine.',
      [SystemNode.REGISTRY, SystemNode.ARBITRATION, SystemNode.MANIFEST]
    );
  }

  // F3: Invalid signature claims must be excluded
  if (ctx.invalidSignatureClaimsIncluded) {
    addViolation(failureGaps, 'CRITICAL',
      'F3_INVALID_SIGNATURE_CLAIM_INCLUDED',
      'Claims with invalid cryptographic signatures were included in the Manifest.',
      [SystemNode.ARBITRATION, SystemNode.MANIFEST]
    );
  }

  // F4: Stale critical lanes must trigger degraded or review_required
  if (ctx.staleCriticalLanes && ctx.readinessPosture === ReadinessPosture.DECISION_GRADE) {
    addViolation(failureGaps, 'HIGH',
      'F4_STALE_CRITICAL_LANE_NOT_DEGRADED',
      'Critical lanes are stale but ReadinessPosture remains CLEAR.',
      [SystemNode.DRIFT, SystemNode.MANIFEST, SystemNode.DECISION]
    );
  }

  const coherent = contradictions.filter(c => c.severity === 'CRITICAL').length === 0
    && failureGaps.filter(f => f.severity === 'CRITICAL').length === 0;

  // Determine weakest node and critical path
  const allViolations = [...contradictions, ...failureGaps];
  if (allViolations.length === 0) {
    weakestNode = null;
  } else {
    // Find node with most violations
    const nodeCounts: Record<string, number> = {};
    for (const v of allViolations) {
      for (const n of v.affectedNodes) {
        nodeCounts[n] = (nodeCounts[n] || 0) + 1;
      }
    }
    let maxCount = 0;
    for (const [node, count] of Object.entries(nodeCounts)) {
      if (count > maxCount) { maxCount = count; weakestNode = node as SystemNode; }
    }
  }

  let nextCriticalPath = 'system_coherent';
  if (!coherent) {
    if (failureGaps.some(f => f.rule.startsWith('F2') || f.rule.startsWith('F3'))) {
      nextCriticalPath = 'harden_arbitration_filters';
    } else if (contradictions.some(c => c.rule.startsWith('C4'))) {
      nextCriticalPath = 'fix_blocked_signal_logic';
    } else if (contradictions.some(c => c.rule.startsWith('C2'))) {
      nextCriticalPath = 'align_readiness_to_coverage';
    } else if (failureGaps.some(f => f.rule.startsWith('F1') || f.rule.startsWith('F4'))) {
      nextCriticalPath = 'harden_drift_detection';
    } else {
      nextCriticalPath = 'resolve_contradictions';
    }
  }

  return {
    coherent,
    contradictions,
    failureGaps,
    weakestNode,
    nextCriticalPath,
  };
}
