/**
 * onboardingConvergence.ts — W2-PR167A
 *
 * Ecosystem Onboarding Convergence Engine.
 *
 * Consumes a slice of ActivationSignals across all ecosystem roles
 * (CLINICIAN, ISSUER, VERIFIER, ENTERPRISE_OPERATOR) and produces a
 * replay-safe ConvergenceReport.
 *
 * Hard invariants:
 *
 *   1. fail-closed — a signal with no sourceAuditLineageId forces
 *      CONVERGENCE_BREACH for that role. No default success.
 *   2. ambiguity preserved — when two signals for the same entity
 *      contradict, the report surfaces CONVERGENCE_AMBIGUOUS and records
 *      both signals. No silent merge.
 *   3. lineage reconstructable — lineageDigest is a deterministic
 *      sha256 over all input signal IDs and their lineage refs. A
 *      regulator can re-run the hash independently.
 *   4. ecosystem activation measurable — ecosystemConvergenceScore (0-100)
 *      is derived from per-role completeness and lineage fidelity.
 *   5. empty slice → CONVERGENCE_AMBIGUOUS, never a default win.
 *
 * Pure transform — no fetches, no DB writes, no audit-event writes.
 */

import { sha256ForPayload } from '../../utils/deterministic';

// ── Role definitions ──────────────────────────────────────────────────────────

export type ConvergenceRole =
  | 'CLINICIAN'
  | 'ISSUER'
  | 'VERIFIER'
  | 'ENTERPRISE_OPERATOR';

// ── Verdict types ─────────────────────────────────────────────────────────────

export type ConvergenceVerdict =
  | 'CONVERGED'
  | 'CONVERGING'
  | 'DIVERGED'
  | 'CONVERGENCE_AMBIGUOUS'
  | 'CONVERGENCE_BREACH';

export type MilestoneStatus =
  | 'COMPLETED'
  | 'BLOCKED'
  | 'PENDING'
  | 'IN_PROGRESS';

// ── Signal types ──────────────────────────────────────────────────────────────

export interface ActivationSignal {
  schema: 'vitalcv.activation-signal.v1';
  signalId: string;
  observedAt: string;
  entityId: string;
  role: ConvergenceRole;
  milestoneId: string;
  milestoneStatus: MilestoneStatus;
  /**
   * The audit lineage ID this signal derives from.
   * null means lineage is missing — this forces CONVERGENCE_BREACH.
   */
  sourceAuditLineageId: string | null;
  orgId: string;
}

export interface ConvergenceEntity {
  entityId: string;
  role: ConvergenceRole;
  orgId: string;
  enrolledAt: string;
}

// ── Report types ──────────────────────────────────────────────────────────────

export interface ConvergenceAmbiguity {
  entityId: string;
  milestoneId: string;
  conflictingSignalIds: [string, string];
  reason: string;
}

export interface RoleConvergenceState {
  role: ConvergenceRole;
  totalEntities: number;
  fullyConverged: number;
  converging: number;
  breached: number;
  ambiguous: number;
  roleConvergenceScore: number; // 0-100
}

export interface OnboardingConvergenceInputs {
  signals: ActivationSignal[];
  entities: ConvergenceEntity[];
  sliceWindowIso: string;
}

export interface OnboardingConvergenceReport {
  schema: 'vitalcv.onboarding-convergence-report.v1';
  verdict: ConvergenceVerdict;
  roleConvergence: Partial<Record<ConvergenceRole, RoleConvergenceState>>;
  ecosystemConvergenceScore: number;
  lineageDigest: string;
  ambiguities: ConvergenceAmbiguity[];
  breachCount: number;
  signalCount: number;
  computedAt: string;
  sliceWindowIso: string;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

const ALL_ROLES: ConvergenceRole[] = ['CLINICIAN', 'ISSUER', 'VERIFIER', 'ENTERPRISE_OPERATOR'];

function groupBy<T, K extends string>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const bucket = map.get(k);
    if (bucket) {
      bucket.push(item);
    } else {
      map.set(k, [item]);
    }
  }
  return map;
}

function detectAmbiguities(
  signals: ActivationSignal[],
): ConvergenceAmbiguity[] {
  const ambiguities: ConvergenceAmbiguity[] = [];
  // Group by entityId + milestoneId
  const byKey = groupBy(signals, (s) => `${s.entityId}::${s.milestoneId}`);
  for (const [, group] of byKey) {
    if (group.length < 2) continue;
    const statuses = new Set(group.map((s) => s.milestoneStatus));
    if (statuses.size > 1) {
      // Multiple different statuses for same entity+milestone = ambiguity
      ambiguities.push({
        entityId: group[0].entityId,
        milestoneId: group[0].milestoneId,
        conflictingSignalIds: [group[0].signalId, group[1].signalId],
        reason: `Milestone ${group[0].milestoneId} has contradictory states: ${[...statuses].join(', ')}`,
      });
    }
  }
  return ambiguities;
}

function computeRoleState(
  role: ConvergenceRole,
  roleEntities: ConvergenceEntity[],
  roleSignals: ActivationSignal[],
  ambiguities: ConvergenceAmbiguity[],
): RoleConvergenceState {
  const total = roleEntities.length;
  if (total === 0) {
    return {
      role,
      totalEntities: 0,
      fullyConverged: 0,
      converging: 0,
      breached: 0,
      ambiguous: 0,
      roleConvergenceScore: 0,
    };
  }

  const ambiguousEntityIds = new Set(ambiguities.map((a) => a.entityId));
  const signalsByEntity = groupBy(roleSignals, (s) => s.entityId);

  let fullyConverged = 0;
  let converging = 0;
  let breached = 0;
  let ambiguous = 0;

  for (const entity of roleEntities) {
    const entitySignals = signalsByEntity.get(entity.entityId) ?? [];
    const hasBreach = entitySignals.some((s) => s.sourceAuditLineageId === null);
    const isAmbiguous = ambiguousEntityIds.has(entity.entityId);

    if (hasBreach) {
      breached++;
    } else if (isAmbiguous) {
      ambiguous++;
    } else {
      const completedCount = entitySignals.filter((s) => s.milestoneStatus === 'COMPLETED').length;
      const blockedCount = entitySignals.filter((s) => s.milestoneStatus === 'BLOCKED').length;
      if (blockedCount > 0 || completedCount === 0) {
        converging++;
      } else {
        fullyConverged++;
      }
    }
  }

  const safeEntities = total - breached - ambiguous;
  const roleScore =
    total === 0
      ? 0
      : Math.round(
          ((fullyConverged * 100 + converging * 50) / total) *
            (safeEntities / total),
        );

  return {
    role,
    totalEntities: total,
    fullyConverged,
    converging,
    breached,
    ambiguous,
    roleConvergenceScore: Math.min(100, Math.max(0, roleScore)),
  };
}

function computeLineageDigest(signals: ActivationSignal[], sliceWindowIso: string): string {
  return sha256ForPayload({
    sliceWindowIso,
    signals: signals
      .map((s) => ({ id: s.signalId, lineage: s.sourceAuditLineageId }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  });
}

function deriveVerdict(
  roleStates: Partial<Record<ConvergenceRole, RoleConvergenceState>>,
  signalCount: number,
  breachCount: number,
  ambiguityCount: number,
): ConvergenceVerdict {
  if (signalCount === 0) return 'CONVERGENCE_AMBIGUOUS';
  if (breachCount > 0) return 'CONVERGENCE_BREACH';
  if (ambiguityCount > 0) return 'CONVERGENCE_AMBIGUOUS';

  const scores = Object.values(roleStates).map((r) => r.roleConvergenceScore);
  if (scores.length === 0) return 'CONVERGENCE_AMBIGUOUS';
  const avg = scores.reduce((s, v) => s + v, 0) / scores.length;

  if (avg >= 80) return 'CONVERGED';
  if (avg >= 40) return 'CONVERGING';
  return 'DIVERGED';
}

// ── Public API ────────────────────────────────────────────────────────────────

export function buildOnboardingConvergenceReport(
  inputs: OnboardingConvergenceInputs,
): OnboardingConvergenceReport {
  const { signals, entities, sliceWindowIso } = inputs;

  const ambiguities = detectAmbiguities(signals);
  const signalsByRole = groupBy(signals, (s) => s.role);
  const entitiesByRole = groupBy(entities, (e) => e.role);

  const roleStates: Partial<Record<ConvergenceRole, RoleConvergenceState>> = {};
  let totalBreach = 0;

  for (const role of ALL_ROLES) {
    const roleEntities = entitiesByRole.get(role) ?? [];
    const roleSignals = signalsByRole.get(role) ?? [];
    if (roleEntities.length === 0 && roleSignals.length === 0) continue;

    const state = computeRoleState(role, roleEntities, roleSignals, ambiguities);
    roleStates[role] = state;
    totalBreach += state.breached;
  }

  const scores = Object.values(roleStates).map((r) => r.roleConvergenceScore);
  const ecosystemScore =
    scores.length === 0
      ? 0
      : Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);

  const verdict = deriveVerdict(roleStates, signals.length, totalBreach, ambiguities.length);
  const lineageDigest = computeLineageDigest(signals, sliceWindowIso);

  return {
    schema: 'vitalcv.onboarding-convergence-report.v1',
    verdict,
    roleConvergence: roleStates,
    ecosystemConvergenceScore: ecosystemScore,
    lineageDigest,
    ambiguities,
    breachCount: totalBreach,
    signalCount: signals.length,
    computedAt: new Date().toISOString(),
    sliceWindowIso,
  };
}

export function reproduceConvergenceLineageDigest(
  signals: ActivationSignal[],
  sliceWindowIso: string,
): string {
  return computeLineageDigest(signals, sliceWindowIso);
}
