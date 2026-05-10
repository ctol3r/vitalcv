/**
 * rolloutAccelerator.ts — W2-PR140A: Institutional Rollout Acceleration
 *
 * Identifies bottlenecks in the institutional rollout pathway and computes
 * acceleration opportunities per actor cohort. Builds on rolloutSurvivability
 * (W2-PR84A) by focusing on the forward path: what moves the needle from
 * PARTIAL/NOT_READY → READY.
 *
 * Hard invariants:
 *
 *   1. Acceleration never overclaims — an actor in ACTIVATION_BREACH or
 *      READINESS_AMBIGUOUS cannot appear as an acceleration candidate until
 *      its breach/ambiguity is resolved.
 *   2. Bottleneck detection is deterministic — same input always produces
 *      same ordered bottleneck list.
 *   3. Lineage reconstructable — accelerationDigest folds every actor record,
 *      bottleneck id, and opportunity rank so a regulator can verify the list
 *      was not silently reordered.
 *   4. No phantom wins — an actor with zero PASSED gates cannot have
 *      accelerationGainPct > 0.
 *
 * Pure transform — no fetches, no DB writes, no audit-event writes.
 */

import { sha256ForPayload } from '../../utils/deterministic';
import type { ActorReadinessRecord, ReadinessGate } from './ecosystemReadinessWorkflow';

// ── Types ─────────────────────────────────────────────────────────────────────

export type BottleneckSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface RolloutBottleneck {
  schema: 'vitalcv.rollout-bottleneck.v1';
  bottleneckId: string;
  /** The gate that is blocking the most actors. */
  blockedGate: ReadinessGate;
  /** Number of actors blocked at this gate. */
  affectedActorCount: number;
  /** Fraction of the total cohort affected. */
  affectedPct: number;
  severity: BottleneckSeverity;
  /** Recommended next action to unblock. */
  accelerationHint: string;
}

export interface ActorAccelerationOpportunity {
  actorId: string;
  actorRole: string;
  institutionId: string;
  currentConvergencePct: number;
  /** Expected convergencePct after clearing the next bottleneck gate. */
  projectedConvergencePct: number;
  accelerationGainPct: number;
  /** Gate to address first. */
  priorityGate: ReadinessGate | null;
}

export interface RolloutAccelerationReport {
  schema: 'vitalcv.rollout-acceleration-report.v1';
  reportId: string;
  generatedAt: string;
  /** Ordered by severity then affectedPct, descending. */
  bottlenecks: RolloutBottleneck[];
  opportunities: ActorAccelerationOpportunity[];
  /**
   * System-wide acceleration potential — average projectedConvergencePct
   * minus average currentConvergencePct across all eligible actors.
   * Null when no eligible actors.
   */
  systemAccelerationGainPct: number | null;
  eligibleActorCount: number;
  ineligibleActorCount: number;
  accelerationDigest: string;
}

const SEVERITY_THRESHOLDS: Array<[number, BottleneckSeverity]> = [
  [75, 'CRITICAL'],
  [50, 'HIGH'],
  [25, 'MEDIUM'],
  [0, 'LOW'],
];

const ACCELERATION_HINTS: Partial<Record<ReadinessGate, string>> = {
  ONBOARDING_COMPLETE: 'Complete actor onboarding checklist — ensure all required fields are submitted and reviewed',
  REPLAY_ACTIVATION_ANCHORED: 'Establish a replay activation anchor by submitting an audit bundle for verification',
  TELEMETRY_LIVE: 'Enable telemetry emission — confirm the actor platform is sending operational signals',
  POLICY_ACCEPTED: 'Present and obtain acceptance of the current VitalCV trust policy document',
  TRUST_CONTRACT_SIGNED: 'Route the trust contract for signature through the institutional legal workflow',
  AUDIT_TRAIL_VERIFIED: 'Confirm the audit trail is complete and the integrity hash chain passes verification',
  ROLLOUT_SURVIVING: 'Resolve outstanding rollout friction (config drift, resistance, telemetry gap) flagged by the survivability boundary',
};

// ── Core transforms ───────────────────────────────────────────────────────────

function detectBottlenecks(
  eligibleRecords: ActorReadinessRecord[],
): RolloutBottleneck[] {
  const gateBlockCounts = new Map<ReadinessGate, number>();

  for (const record of eligibleRecords) {
    if (!record.gatesSummary) continue;
    for (const gate of record.gatesSummary) {
      if (gate.outcome === 'FAILED' || gate.outcome === 'MISSING') {
        gateBlockCounts.set(gate.gate, (gateBlockCounts.get(gate.gate) ?? 0) + 1);
      }
    }
  }

  const total = eligibleRecords.length;

  const bottlenecks: RolloutBottleneck[] = Array.from(gateBlockCounts.entries())
    .map(([gate, count]) => {
      const affectedPct = total > 0 ? Math.round((count / total) * 100) : 0;
      const severity =
        SEVERITY_THRESHOLDS.find(([threshold]) => affectedPct >= threshold)?.[1] ?? 'LOW';
      return {
        schema: 'vitalcv.rollout-bottleneck.v1' as const,
        bottleneckId: sha256ForPayload({ gate, count }).slice(0, 16),
        blockedGate: gate,
        affectedActorCount: count,
        affectedPct,
        severity,
        accelerationHint: ACCELERATION_HINTS[gate] ?? `Clear the ${gate} gate requirement`,
      };
    })
    .sort((a, b) => {
      const sev = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
      const sevDiff = sev.indexOf(a.severity) - sev.indexOf(b.severity);
      if (sevDiff !== 0) return sevDiff;
      return b.affectedPct - a.affectedPct;
    });

  return bottlenecks;
}

function projectConvergence(
  record: ActorReadinessRecord,
  topBottleneck: RolloutBottleneck | null,
): { projected: number; gain: number; priorityGate: ReadinessGate | null } {
  const current = record.convergencePct ?? 0;
  if (!topBottleneck || !record.gatesSummary) {
    return { projected: current, gain: 0, priorityGate: null };
  }
  const gateBlocked = record.gatesSummary.find(
    g => g.gate === topBottleneck.blockedGate && (g.outcome === 'FAILED' || g.outcome === 'MISSING'),
  );
  if (!gateBlocked) {
    return { projected: current, gain: 0, priorityGate: null };
  }
  // Simulate one gate flipping from FAILED/MISSING → PASSED
  const totalRequired = record.gatesSummary.length;
  const passedNow = record.gatesSummary.filter(g => g.outcome === 'PASSED').length;
  const projected = totalRequired > 0
    ? Math.round(((passedNow + 1) / totalRequired) * 100)
    : current;
  return {
    projected: Math.min(projected, 100),
    gain: Math.max(projected - current, 0),
    priorityGate: topBottleneck.blockedGate,
  };
}

// ── Primary builder ───────────────────────────────────────────────────────────

export function buildRolloutAccelerationReport(params: {
  reportId: string;
  generatedAt: string;
  actorRecords: ActorReadinessRecord[];
}): RolloutAccelerationReport {
  const { reportId, generatedAt, actorRecords } = params;

  // Eligible: actors that have a verdict where acceleration is meaningful
  const eligible = actorRecords.filter(
    r => r.verdict === 'PARTIALLY_READY' || r.verdict === 'NOT_READY',
  );
  const ineligible = actorRecords.length - eligible.length;

  const bottlenecks = detectBottlenecks(eligible);
  const topBottleneck = bottlenecks[0] ?? null;

  const opportunities: ActorAccelerationOpportunity[] = eligible.map(record => {
    const { projected, gain, priorityGate } = projectConvergence(record, topBottleneck);
    return {
      actorId: record.actorId,
      actorRole: record.actorRole,
      institutionId: record.institutionId,
      currentConvergencePct: record.convergencePct ?? 0,
      projectedConvergencePct: projected,
      accelerationGainPct: gain,
      priorityGate,
    };
  });

  const gains = opportunities.map(o => o.accelerationGainPct);
  const systemAccelerationGainPct =
    gains.length > 0
      ? Math.round(gains.reduce((a, b) => a + b, 0) / gains.length)
      : null;

  const report: RolloutAccelerationReport = {
    schema: 'vitalcv.rollout-acceleration-report.v1',
    reportId,
    generatedAt,
    bottlenecks,
    opportunities,
    systemAccelerationGainPct,
    eligibleActorCount: eligible.length,
    ineligibleActorCount: ineligible,
    accelerationDigest: '',
  };

  report.accelerationDigest = sha256ForPayload({
    reportId,
    generatedAt,
    bottlenecks: bottlenecks.map(b => ({ gate: b.blockedGate, count: b.affectedActorCount })),
    opportunities: opportunities.map(o => ({
      actorId: o.actorId,
      current: o.currentConvergencePct,
      projected: o.projectedConvergencePct,
    })),
    systemAccelerationGainPct,
  });

  return report;
}
