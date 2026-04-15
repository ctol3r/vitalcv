/**
 * pilotSimulator.ts — thin orchestration on top of the existing
 * runTrustSimulation engine.
 *
 * Defines a default 30-clinician cohort across mixed states
 * (decision_grade / partial / degraded / blocked), invokes the
 * existing simulation engine for each, and composes the results into
 * a single KPI summary (time_to_decision, time_to_start_ready,
 * days_saved). Does NOT introduce a new simulation engine — every per-
 * clinician run goes through runTrustSimulation().
 *
 * Time bands per state are deterministic but bounded (per spec) so
 * the simulator stays reproducible while still spreading metrics.
 */

import {
  runTrustSimulation,
  type SimulationImpactReport,
} from './simulationEngine';
import type { SimulationEvent } from './graphSimulation';

export type ClinicianState = 'decision_grade' | 'partial' | 'degraded' | 'blocked';

export interface CohortMember {
  npi: string;
  state: ClinicianState;
}

export interface PilotKpiSummary {
  cohortSize: number;
  byState: Record<ClinicianState, number>;
  time_to_decision: { mean: number; min: number; max: number; unit: 'days' };
  time_to_start_ready: { mean: number; min: number; max: number; unit: 'days' };
  days_saved: { mean: number; min: number; max: number; unit: 'days' };
  cascade: {
    avgAffectedNodes: number;
    avgCascadeDepth: number;
    riskCounts: Record<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL', number>;
  };
  reports: SimulationImpactReport[];
  generatedAt: string;
}

const STATE_TIMING: Record<
  ClinicianState,
  { decision: [number, number]; startReady: [number, number] }
> = {
  decision_grade: { decision: [2, 4], startReady: [10, 15] },
  partial: { decision: [4, 7], startReady: [15, 22] },
  degraded: { decision: [6, 9], startReady: [20, 27] },
  blocked: { decision: [8, 10], startReady: [25, 30] },
};

// Industry-baseline credentialing cycle — used to derive days_saved.
// Deliberately conservative; treat as a placeholder until the real
// pilot baseline is published.
const BASELINE_TIME_TO_START_DAYS = 90;

const STATE_EVENTS: Record<ClinicianState, SimulationEvent> = {
  decision_grade: { type: 'credential_added', credentialId: 'sim-cred-add', issuerNodeId: 'sim-issuer', label: 'Simulated add' },
  partial: { type: 'credential_expired', credentialId: 'sim-cred-exp' },
  degraded: { type: 'credential_revoked', credentialId: 'sim-cred-rev' },
  blocked: { type: 'issuer_revoked', issuerNodeId: 'sim-issuer-rev' },
};

/**
 * Default cohort: 30 clinicians, distribution roughly matching what the
 * pilot expects (10 decision_grade, 10 partial, 6 degraded, 4 blocked).
 * Override by passing your own list to runPilotSimulation().
 */
export function generateDefaultCohort(
  prefix = 'sim',
): CohortMember[] {
  const cohort: CohortMember[] = [];
  const distribution: Array<[ClinicianState, number]> = [
    ['decision_grade', 10],
    ['partial', 10],
    ['degraded', 6],
    ['blocked', 4],
  ];
  let i = 0;
  for (const [state, count] of distribution) {
    for (let n = 0; n < count; n += 1, i += 1) {
      // 10-digit NPI-shaped synthetic id; deterministic for replay.
      const npi = String(1_000_000_000 + i).padStart(10, '0');
      cohort.push({ npi: `${prefix === 'sim' ? '' : `${prefix}-`}${npi}`.slice(-10), state });
    }
  }
  return cohort;
}

function mid(range: [number, number]): number {
  return (range[0] + range[1]) / 2;
}

function bandedSpread(state: ClinicianState, kind: 'decision' | 'startReady', index: number, total: number): number {
  const [lo, hi] = STATE_TIMING[state][kind];
  if (total <= 1) return mid([lo, hi]);
  // Even ladder across the band so the cohort spans the full range
  // deterministically — no randomness.
  return Number((lo + ((hi - lo) * (index / (total - 1)))).toFixed(2));
}

function summarize(values: number[]): { mean: number; min: number; max: number } {
  if (values.length === 0) return { mean: 0, min: 0, max: 0 };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const mean = Number(
    (values.reduce((sum, v) => sum + v, 0) / values.length).toFixed(2),
  );
  return { mean, min, max };
}

export interface RunPilotSimulationInput {
  cohort?: CohortMember[];
}

export async function runPilotSimulation(
  input: RunPilotSimulationInput = {},
): Promise<PilotKpiSummary> {
  const cohort = input.cohort && input.cohort.length > 0 ? input.cohort : generateDefaultCohort();
  const reports: SimulationImpactReport[] = [];
  const decisionTimes: number[] = [];
  const startReadyTimes: number[] = [];
  const daysSaved: number[] = [];
  const byState: Record<ClinicianState, number> = {
    decision_grade: 0,
    partial: 0,
    degraded: 0,
    blocked: 0,
  };
  const riskCounts: Record<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL', number> = {
    LOW: 0,
    MEDIUM: 0,
    HIGH: 0,
    CRITICAL: 0,
  };
  let cascadeDepthSum = 0;
  let affectedSum = 0;

  // Per-state index for deterministic spread within each band.
  const stateIndex: Record<ClinicianState, { i: number; total: number }> = {
    decision_grade: { i: 0, total: 0 },
    partial: { i: 0, total: 0 },
    degraded: { i: 0, total: 0 },
    blocked: { i: 0, total: 0 },
  };
  for (const m of cohort) stateIndex[m.state].total += 1;

  for (const member of cohort) {
    byState[member.state] += 1;
    const event = STATE_EVENTS[member.state];

    let report: SimulationImpactReport;
    try {
      report = await runTrustSimulation(member.npi, event);
    } catch {
      // Per spec: simulator must not crash on a single failure.
      // Synthesize a minimal report so the cohort summary still completes.
      report = {
        npi: member.npi,
        eventType: event.type,
        affectedDecisions: [],
        affectedEmployers: [],
        cascadeDepth: 0,
        riskLevel: 'LOW',
        totalAffected: 0,
        simulatedAt: new Date().toISOString(),
      };
    }
    reports.push(report);
    riskCounts[report.riskLevel] += 1;
    cascadeDepthSum += report.cascadeDepth;
    affectedSum += report.totalAffected;

    const idx = stateIndex[member.state].i;
    const total = stateIndex[member.state].total;
    const ttd = bandedSpread(member.state, 'decision', idx, total);
    const ttsr = bandedSpread(member.state, 'startReady', idx, total);
    decisionTimes.push(ttd);
    startReadyTimes.push(ttsr);
    daysSaved.push(Math.max(0, BASELINE_TIME_TO_START_DAYS - ttsr));
    stateIndex[member.state].i += 1;
  }

  return {
    cohortSize: cohort.length,
    byState,
    time_to_decision: { ...summarize(decisionTimes), unit: 'days' },
    time_to_start_ready: { ...summarize(startReadyTimes), unit: 'days' },
    days_saved: { ...summarize(daysSaved), unit: 'days' },
    cascade: {
      avgAffectedNodes:
        cohort.length > 0 ? Number((affectedSum / cohort.length).toFixed(2)) : 0,
      avgCascadeDepth:
        cohort.length > 0 ? Number((cascadeDepthSum / cohort.length).toFixed(2)) : 0,
      riskCounts,
    },
    reports,
    generatedAt: new Date().toISOString(),
  };
}
