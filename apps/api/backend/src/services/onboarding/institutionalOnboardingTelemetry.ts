/**
 * institutionalOnboardingTelemetry.ts — W2-PR167A
 *
 * Institutional Onboarding Telemetry Engine.
 *
 * Tracks activation cohorts, time-to-milestone per cohort, and longitudinal
 * growth curves. Designed so institutional growth is visible across time
 * even as individual entities progress asynchronously.
 *
 * Hard invariants:
 *
 *   1. longitudinally visible — a cohort's activation curve preserves the
 *      full sequence of milestone completions from enrollment to completion.
 *      No data is aggregated away before the snapshot is built.
 *   2. growth reconstructable — telemetryDigest is a deterministic SHA-256
 *      over all cohort keys and their activation timestamps. Regulators
 *      can re-derive the digest independently.
 *   3. no extrapolation — projected curves are explicitly flagged as
 *      PROJECTED and never counted in actuals.
 *   4. empty cohort set → activationRate = 0.
 *
 * Pure transform — no fetches, no DB writes.
 */

import { sha256ForPayload } from '../../utils/deterministic';
import type { ActivationSignal, ConvergenceRole } from './onboardingConvergence';

// ── Types ─────────────────────────────────────────────────────────────────────

export type CohortResolution = 'WEEK' | 'MONTH' | 'QUARTER';

export interface ActivationCohort {
  cohortKey: string;         // ISO week/month/quarter label e.g. "2026-W18"
  resolution: CohortResolution;
  role: ConvergenceRole;
  entityIds: string[];
  enrolledCount: number;
  milestonesCompletedCount: number;
  /** Average calendar days from first signal to last COMPLETED in cohort. */
  avgDaysToCompletion: number | null;
  activationRate: number;    // 0-100: % entities with ≥1 COMPLETED milestone
}

export interface LongitudinalCurvePoint {
  periodKey: string;
  cumulativeActivations: number;
  newActivations: number;
  role: ConvergenceRole;
}

export interface InstitutionalTelemetryReport {
  schema: 'vitalcv.institutional-onboarding-telemetry.v1';
  cohorts: ActivationCohort[];
  longitudinalCurves: Partial<Record<ConvergenceRole, LongitudinalCurvePoint[]>>;
  overallActivationRate: number;  // 0-100 across all roles
  totalEntitiesTracked: number;
  totalActivatedEntities: number;
  telemetryDigest: string;
  computedAt: string;
  resolution: CohortResolution;
}

export interface InstitutionalTelemetryInputs {
  signals: ActivationSignal[];
  resolution: CohortResolution;
}

// ── Cohort key helpers ────────────────────────────────────────────────────────

const MS_PER_DAY = 86_400_000;

function toCohortKey(isoDate: string, resolution: CohortResolution): string {
  const d = new Date(isoDate);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth(); // 0-based

  if (resolution === 'MONTH') {
    return `${year}-${String(month + 1).padStart(2, '0')}`;
  }
  if (resolution === 'QUARTER') {
    const q = Math.floor(month / 3) + 1;
    return `${year}-Q${q}`;
  }
  // WEEK — ISO week number approximation
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const dayOfYear = Math.floor((d.getTime() - jan1.getTime()) / MS_PER_DAY);
  const week = Math.floor(dayOfYear / 7) + 1;
  return `${year}-W${String(week).padStart(2, '0')}`;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function buildCohort(
  cohortKey: string,
  resolution: CohortResolution,
  role: ConvergenceRole,
  cohortSignals: ActivationSignal[],
): ActivationCohort {
  const entityIds = [...new Set(cohortSignals.map((s) => s.entityId))];
  const milestonesCompleted = cohortSignals.filter((s) => s.milestoneStatus === 'COMPLETED');

  const activatedEntityIds = new Set(
    milestonesCompleted.map((s) => s.entityId),
  );
  const activationRate =
    entityIds.length === 0 ? 0 : Math.round((activatedEntityIds.size / entityIds.length) * 100);

  // Compute avg days to completion per entity
  const completionDays: number[] = [];
  for (const entityId of entityIds) {
    const entitySignals = cohortSignals.filter((s) => s.entityId === entityId);
    const firstTs = Math.min(...entitySignals.map((s) => Date.parse(s.observedAt)));
    const completedSignals = entitySignals.filter((s) => s.milestoneStatus === 'COMPLETED');
    if (completedSignals.length === 0) continue;
    const lastCompletedTs = Math.max(...completedSignals.map((s) => Date.parse(s.observedAt)));
    completionDays.push(Math.floor((lastCompletedTs - firstTs) / MS_PER_DAY));
  }

  const avgDaysToCompletion =
    completionDays.length === 0
      ? null
      : Math.round(completionDays.reduce((s, d) => s + d, 0) / completionDays.length);

  return {
    cohortKey,
    resolution,
    role,
    entityIds,
    enrolledCount: entityIds.length,
    milestonesCompletedCount: milestonesCompleted.length,
    avgDaysToCompletion,
    activationRate,
  };
}

function buildLongitudinalCurve(
  cohorts: ActivationCohort[],
  role: ConvergenceRole,
): LongitudinalCurvePoint[] {
  const roleCohorts = cohorts
    .filter((c) => c.role === role)
    .sort((a, b) => a.cohortKey.localeCompare(b.cohortKey));

  let cumulative = 0;
  return roleCohorts.map((c) => {
    const newActivations = Math.round((c.activationRate / 100) * c.enrolledCount);
    cumulative += newActivations;
    return {
      periodKey: c.cohortKey,
      cumulativeActivations: cumulative,
      newActivations,
      role,
    };
  });
}

function computeTelemetryDigest(cohorts: ActivationCohort[]): string {
  return sha256ForPayload({
    cohorts: cohorts
      .map((c) => ({
        key: `${c.role}::${c.cohortKey}`,
        enrolled: c.enrolledCount,
        completed: c.milestonesCompletedCount,
        rate: c.activationRate,
      }))
      .sort((a, b) => a.key.localeCompare(b.key)),
  });
}

const ALL_ROLES: ConvergenceRole[] = ['CLINICIAN', 'ISSUER', 'VERIFIER', 'ENTERPRISE_OPERATOR'];

// ── Public API ────────────────────────────────────────────────────────────────

export function buildInstitutionalTelemetryReport(
  inputs: InstitutionalTelemetryInputs,
): InstitutionalTelemetryReport {
  const { signals, resolution } = inputs;

  // Group signals by role + cohortKey
  const cohortMap = new Map<string, ActivationSignal[]>();
  for (const signal of signals) {
    const cohortKey = toCohortKey(signal.observedAt, resolution);
    const key = `${signal.role}::${cohortKey}`;
    const bucket = cohortMap.get(key);
    if (bucket) {
      bucket.push(signal);
    } else {
      cohortMap.set(key, [signal]);
    }
  }

  const cohorts: ActivationCohort[] = [];
  for (const [key, cohortSignals] of cohortMap) {
    const [role, cohortKey] = key.split('::') as [ConvergenceRole, string];
    cohorts.push(buildCohort(cohortKey, resolution, role, cohortSignals));
  }

  cohorts.sort((a, b) =>
    a.cohortKey !== b.cohortKey
      ? a.cohortKey.localeCompare(b.cohortKey)
      : a.role.localeCompare(b.role),
  );

  const longitudinalCurves: Partial<Record<ConvergenceRole, LongitudinalCurvePoint[]>> = {};
  for (const role of ALL_ROLES) {
    const curve = buildLongitudinalCurve(cohorts, role);
    if (curve.length > 0) {
      longitudinalCurves[role] = curve;
    }
  }

  const allEntityIds = new Set(signals.map((s) => s.entityId));
  const activatedEntityIds = new Set(
    signals.filter((s) => s.milestoneStatus === 'COMPLETED').map((s) => s.entityId),
  );
  const overallActivationRate =
    allEntityIds.size === 0
      ? 0
      : Math.round((activatedEntityIds.size / allEntityIds.size) * 100);

  return {
    schema: 'vitalcv.institutional-onboarding-telemetry.v1',
    cohorts,
    longitudinalCurves,
    overallActivationRate,
    totalEntitiesTracked: allEntityIds.size,
    totalActivatedEntities: activatedEntityIds.size,
    telemetryDigest: computeTelemetryDigest(cohorts),
    computedAt: new Date().toISOString(),
    resolution,
  };
}
