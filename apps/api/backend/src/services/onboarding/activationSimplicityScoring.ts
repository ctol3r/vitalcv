/**
 * activationSimplicityScoring.ts — W2-PR167A
 *
 * Activation Simplicity Scoring Engine.
 *
 * Computes a deterministic Activation Simplicity Score (0–100) per entity
 * and per role. The score measures how friction-free an entity's onboarding
 * journey has been. A score of 100 means all milestones completed without
 * blocks or delays; a score of 0 means entirely blocked or breached.
 *
 * Scoring factors (all deterministic, no randomness):
 *   - COMPLETED milestones: +base points per milestone
 *   - BLOCKED milestones: heavy penalty
 *   - PENDING milestones: mild penalty (still in flight)
 *   - IN_PROGRESS milestones: neutral (expected during active onboarding)
 *   - Missing audit lineage: additional penalty (fail-closed semantic)
 *   - Time-to-completion: graduated penalty for long journeys (>14d, >30d)
 *
 * Role-level simplicity = average of entity scores for that role.
 * Ecosystem simplicity = average of role-level scores for roles with entities.
 *
 * Pure transform — no fetches, no DB writes.
 */

import { sha256ForPayload } from '../../utils/deterministic';
import type { ActivationSignal, ConvergenceRole, MilestoneStatus } from './onboardingConvergence';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EntitySimplicityScore {
  entityId: string;
  role: ConvergenceRole;
  orgId: string;
  simplicityScore: number;            // 0-100
  completedMilestones: number;
  blockedMilestones: number;
  pendingMilestones: number;
  inProgressMilestones: number;
  missingLineagePenalty: number;      // points deducted for lineage gaps
  timePenalty: number;                // points deducted for slow completion
  daysToCompletion: number | null;    // null if not yet complete
  frictionFactors: string[];          // plain-English description of friction
}

export interface RoleSimplicityState {
  role: ConvergenceRole;
  entityCount: number;
  avgSimplicityScore: number;
  minScore: number;
  maxScore: number;
  fullySimpleCount: number;           // entities with score ≥ 90
  highFrictionCount: number;          // entities with score < 40
}

export interface ActivationSimplicityReport {
  schema: 'vitalcv.activation-simplicity-report.v1';
  entityScores: EntitySimplicityScore[];
  roleSimplicity: Partial<Record<ConvergenceRole, RoleSimplicityState>>;
  ecosystemSimplicityScore: number;   // 0-100
  institutionalSimplicityScore: number; // alias for board metric
  scoringDigest: string;
  computedAt: string;
}

export interface ActivationSimplicityInputs {
  signals: ActivationSignal[];
}

// ── Scoring constants ─────────────────────────────────────────────────────────

const POINTS_PER_COMPLETED = 20;
const PENALTY_BLOCKED = 25;
const PENALTY_PENDING = 5;
const PENALTY_MISSING_LINEAGE = 15;
const PENALTY_SLOW_14D = 8;
const PENALTY_SLOW_30D = 15;
const MS_PER_DAY = 86_400_000;
const MAX_SCORE = 100;

// ── Internal helpers ──────────────────────────────────────────────────────────

function countByStatus(signals: ActivationSignal[], status: MilestoneStatus): number {
  return signals.filter((s) => s.milestoneStatus === status).length;
}

function computeDaysToCompletion(signals: ActivationSignal[]): number | null {
  const completedSignals = signals.filter((s) => s.milestoneStatus === 'COMPLETED');
  if (completedSignals.length === 0) return null;
  const firstTs = Math.min(...signals.map((s) => Date.parse(s.observedAt)));
  const lastCompletedTs = Math.max(...completedSignals.map((s) => Date.parse(s.observedAt)));
  return Math.floor((lastCompletedTs - firstTs) / MS_PER_DAY);
}

function scoreEntity(
  entityId: string,
  role: ConvergenceRole,
  orgId: string,
  signals: ActivationSignal[],
): EntitySimplicityScore {
  const completed = countByStatus(signals, 'COMPLETED');
  const blocked = countByStatus(signals, 'BLOCKED');
  const pending = countByStatus(signals, 'PENDING');
  const inProgress = countByStatus(signals, 'IN_PROGRESS');
  const missingLineage = signals.filter((s) => s.sourceAuditLineageId === null).length;
  const daysToCompletion = computeDaysToCompletion(signals);

  const frictionFactors: string[] = [];

  let score = Math.min(MAX_SCORE, completed * POINTS_PER_COMPLETED);
  let missingLineagePenalty = 0;
  let timePenalty = 0;

  if (blocked > 0) {
    const deduction = blocked * PENALTY_BLOCKED;
    score -= deduction;
    frictionFactors.push(`${blocked} blocked milestone(s) (−${deduction}pts)`);
  }

  if (pending > 0) {
    const deduction = pending * PENALTY_PENDING;
    score -= deduction;
    frictionFactors.push(`${pending} pending milestone(s) (−${deduction}pts)`);
  }

  if (missingLineage > 0) {
    missingLineagePenalty = missingLineage * PENALTY_MISSING_LINEAGE;
    score -= missingLineagePenalty;
    frictionFactors.push(`${missingLineage} signal(s) missing audit lineage (−${missingLineagePenalty}pts)`);
  }

  if (daysToCompletion !== null) {
    if (daysToCompletion > 30) {
      timePenalty = PENALTY_SLOW_30D;
      frictionFactors.push(`Completed in ${daysToCompletion}d (>30d threshold, −${timePenalty}pts)`);
    } else if (daysToCompletion > 14) {
      timePenalty = PENALTY_SLOW_14D;
      frictionFactors.push(`Completed in ${daysToCompletion}d (>14d threshold, −${timePenalty}pts)`);
    }
    score -= timePenalty;
  }

  score = Math.max(0, Math.min(MAX_SCORE, score));

  return {
    entityId,
    role,
    orgId,
    simplicityScore: score,
    completedMilestones: completed,
    blockedMilestones: blocked,
    pendingMilestones: pending,
    inProgressMilestones: inProgress,
    missingLineagePenalty,
    timePenalty,
    daysToCompletion,
    frictionFactors,
  };
}

function buildRoleState(
  role: ConvergenceRole,
  entityScores: EntitySimplicityScore[],
): RoleSimplicityState {
  const scores = entityScores.map((e) => e.simplicityScore);
  const avg =
    scores.length === 0
      ? 0
      : Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
  const min = scores.length === 0 ? 0 : Math.min(...scores);
  const max = scores.length === 0 ? 0 : Math.max(...scores);

  return {
    role,
    entityCount: entityScores.length,
    avgSimplicityScore: avg,
    minScore: min,
    maxScore: max,
    fullySimpleCount: entityScores.filter((e) => e.simplicityScore >= 90).length,
    highFrictionCount: entityScores.filter((e) => e.simplicityScore < 40).length,
  };
}

function computeScoringDigest(entityScores: EntitySimplicityScore[]): string {
  return sha256ForPayload({
    entities: entityScores
      .map((e) => ({ id: e.entityId, score: e.simplicityScore }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  });
}

const ALL_ROLES: ConvergenceRole[] = ['CLINICIAN', 'ISSUER', 'VERIFIER', 'ENTERPRISE_OPERATOR'];

// ── Public API ────────────────────────────────────────────────────────────────

export function buildActivationSimplicityReport(
  inputs: ActivationSimplicityInputs,
): ActivationSimplicityReport {
  const { signals } = inputs;

  // Group signals by entityId
  const byEntity = new Map<string, ActivationSignal[]>();
  for (const signal of signals) {
    const bucket = byEntity.get(signal.entityId);
    if (bucket) {
      bucket.push(signal);
    } else {
      byEntity.set(signal.entityId, [signal]);
    }
  }

  const entityScores: EntitySimplicityScore[] = [];
  for (const [entityId, entitySignals] of byEntity) {
    const role = entitySignals[0].role;
    const orgId = entitySignals[0].orgId;
    entityScores.push(scoreEntity(entityId, role, orgId, entitySignals));
  }

  entityScores.sort((a, b) => a.entityId.localeCompare(b.entityId));

  const roleSimplicity: Partial<Record<ConvergenceRole, RoleSimplicityState>> = {};
  const roleAvgScores: number[] = [];

  for (const role of ALL_ROLES) {
    const roleScores = entityScores.filter((e) => e.role === role);
    if (roleScores.length === 0) continue;
    const state = buildRoleState(role, roleScores);
    roleSimplicity[role] = state;
    roleAvgScores.push(state.avgSimplicityScore);
  }

  const ecosystemScore =
    roleAvgScores.length === 0
      ? 0
      : Math.round(roleAvgScores.reduce((s, v) => s + v, 0) / roleAvgScores.length);

  return {
    schema: 'vitalcv.activation-simplicity-report.v1',
    entityScores,
    roleSimplicity,
    ecosystemSimplicityScore: ecosystemScore,
    institutionalSimplicityScore: ecosystemScore,
    scoringDigest: computeScoringDigest(entityScores),
    computedAt: new Date().toISOString(),
  };
}
