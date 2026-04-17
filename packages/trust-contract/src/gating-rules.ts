/**
 * Trust-Contract Gating Rules — wave-119
 *
 * Canonical rules for when a proof-pack tier can be issued,
 * when an employer action is permitted, and when readiness
 * may be displayed.
 *
 * All gates are deterministic. No ML. No probability.
 */

import { SourceStatus, ReadinessPosture } from './index';

// ─── Source Lane Requirements ─────────────────────────────────────

export interface LaneGate {
  laneId: string;
  requiredFor: 'draft' | 'partial' | 'decision_grade';
  minStatus: SourceStatus;
  freshnessWindowMs: number;
}

export const LANE_GATES: LaneGate[] = [
  { laneId: 'nppes_identity',  requiredFor: 'draft',           minStatus: SourceStatus.CHECKED, freshnessWindowMs: 24 * 60 * 60 * 1000 },
  { laneId: 'oig_exclusions',  requiredFor: 'decision_grade',  minStatus: SourceStatus.CHECKED, freshnessWindowMs: 7 * 24 * 60 * 60 * 1000 },
  { laneId: 'state_license',   requiredFor: 'decision_grade',  minStatus: SourceStatus.CHECKED, freshnessWindowMs: 30 * 24 * 60 * 60 * 1000 },
];

// ─── Proof-Pack Tier Gating ──────────────────────────────────────

export type ProofPackTier = 'draft' | 'partial' | 'decision_grade';

export interface LaneResult {
  laneId: string;
  status: SourceStatus;
  checkedAt: number; // unix ms
}

export function resolveProofPackTier(lanes: LaneResult[]): ProofPackTier {
  const laneMap = new Map(lanes.map(l => [l.laneId, l]));
  const now = Date.now();

  // Decision-grade: all required lanes checked + fresh
  const decisionGradeLanes = LANE_GATES.filter(g => g.requiredFor === 'decision_grade');
  const allDecisionMet = decisionGradeLanes.every(gate => {
    const lane = laneMap.get(gate.laneId);
    if (!lane) return false;
    if (lane.status !== SourceStatus.CHECKED) return false;
    if (now - lane.checkedAt > gate.freshnessWindowMs) return false;
    return true;
  });
  if (allDecisionMet) return 'decision_grade';

  // Partial: at least one lane checked
  const anyChecked = lanes.some(l => l.status === SourceStatus.CHECKED);
  if (anyChecked) return 'partial';

  // Draft: identity attempted but nothing verified
  return 'draft';
}

// ─── Employer Action Gating ──────────────────────────────────────

export type EmployerAction = 'accept_head_start' | 'request_refresh' | 'route_to_review';

export interface EmployerActionGate {
  action: EmployerAction;
  minTier: ProofPackTier;
  blockedStatuses: SourceStatus[];
}

export const EMPLOYER_ACTION_GATES: EmployerActionGate[] = [
  {
    action: 'accept_head_start',
    minTier: 'partial',
    blockedStatuses: [SourceStatus.BLOCKED_SIGNAL],
  },
  {
    action: 'request_refresh',
    minTier: 'draft',
    blockedStatuses: [],
  },
  {
    action: 'route_to_review',
    minTier: 'draft',
    blockedStatuses: [],
  },
];

export function canEmployerAct(
  action: EmployerAction,
  tier: ProofPackTier,
  lanes: LaneResult[]
): { allowed: boolean; reason?: string } {
  const gate = EMPLOYER_ACTION_GATES.find(g => g.action === action);
  if (!gate) return { allowed: false, reason: 'Unknown action' };

  // Tier check
  const tierOrder: ProofPackTier[] = ['draft', 'partial', 'decision_grade'];
  if (tierOrder.indexOf(tier) < tierOrder.indexOf(gate.minTier)) {
    return { allowed: false, reason: `Action "${action}" requires at least "${gate.minTier}" tier` };
  }

  // Blocked signal check
  if (gate.blockedStatuses.length > 0) {
    const blocked = lanes.find(l => gate.blockedStatuses.includes(l.status));
    if (blocked) {
      return { allowed: false, reason: `Lane "${blocked.laneId}" has blocked status "${blocked.status}"` };
    }
  }

  return { allowed: true };
}

// ─── Readiness Display Gating ────────────────────────────────────

export interface ReadinessDisplayRule {
  posture: ReadinessPosture;
  canShowScore: boolean;
  canShowDaysToStart: boolean;
  canShowBlockers: boolean;
  displayLabel: string;
}

export const READINESS_DISPLAY_RULES: ReadinessDisplayRule[] = [
  { posture: ReadinessPosture.CHECKING,       canShowScore: false, canShowDaysToStart: false, canShowBlockers: false, displayLabel: 'Verifying…' },
  { posture: ReadinessPosture.PARTIAL,        canShowScore: true,  canShowDaysToStart: false, canShowBlockers: true,  displayLabel: 'Partial Coverage' },
  { posture: ReadinessPosture.DECISION_GRADE, canShowScore: true,  canShowDaysToStart: true,  canShowBlockers: true,  displayLabel: 'Decision-Ready' },
  { posture: ReadinessPosture.BLOCKED,        canShowScore: false, canShowDaysToStart: false, canShowBlockers: true,  displayLabel: 'Action Required' },
  { posture: ReadinessPosture.DEGRADED,       canShowScore: true,  canShowDaysToStart: false, canShowBlockers: true,  displayLabel: 'Refresh Required' },
];

export function getReadinessDisplay(posture: ReadinessPosture): ReadinessDisplayRule {
  return READINESS_DISPLAY_RULES.find(r => r.posture === posture)
    ?? { posture, canShowScore: false, canShowDaysToStart: false, canShowBlockers: false, displayLabel: 'Unknown' };
}

// ─── Fake Proof Detection ────────────────────────────────────────

/**
 * Returns true if any lane claims CHECKED status without a real checkedAt timestamp
 * or if a score is shown when it shouldn't be according to display rules.
 */
export function detectFakeProof(
  lanes: LaneResult[],
  posture: ReadinessPosture,
  displayedScore: number | null,
  displayedDaysToStart: number | null
): string[] {
  const violations: string[] = [];
  const rules = getReadinessDisplay(posture);

  for (const lane of lanes) {
    if (lane.status === SourceStatus.CHECKED && (!lane.checkedAt || lane.checkedAt <= 0)) {
      violations.push(`Lane "${lane.laneId}" claims CHECKED but has no valid checkedAt timestamp`);
    }
  }

  if (displayedScore !== null && !rules.canShowScore) {
    violations.push(`Score displayed (${displayedScore}) but posture "${posture}" does not permit score display`);
  }

  if (displayedDaysToStart !== null && !rules.canShowDaysToStart) {
    violations.push(`Days-to-start displayed (${displayedDaysToStart}) but posture "${posture}" does not permit it`);
  }

  return violations;
}
