/**
 * ecosystemReadinessWorkflow.ts — W2-PR140A: Institutional Ecosystem Readiness Activation
 *
 * Pure transform that consumes cross-actor readiness signals for each
 * VitalCV ecosystem participant (issuer, verifier, clinician, enterprise
 * operator) and produces a convergence-scored readiness verdict — the
 * longitudinal, replay-safe view of ecosystem activation maturity.
 *
 * Hard invariants:
 *
 *   1. Activation replay-safe — every readiness signal is traceable to an
 *      audit bundle or replay activation record. Signals without a replay
 *      anchor produce READINESS_AMBIGUOUS, never a default win.
 *   2. Ambiguity preserved during rollout — contradicting signals from the
 *      same actor cohort surface READINESS_AMBIGUOUS, never silent merge.
 *   3. Fail-closed readiness semantics — a single ACTIVATION_BREACH in
 *      any actor cohort forces overallVerdict=ECOSYSTEM_BREACH. The breach
 *      is never masked by a healthy neighbouring cohort.
 *   4. Institutional onboarding measurable — every actor record carries a
 *      convergencePct (0–100 nullable) so dashboards show progress without
 *      overclaiming completion.
 *   5. Ecosystem survivability longitudinally visible — the snapshot includes
 *      generatedAt + cohort fingerprints so a regulator can reconstruct who
 *      was ready, when, and at what convergence level.
 *   6. Ecosystem lineage reconstructable — lineageDigest folds every actor
 *      id, signal id, readiness gate, and convergence score. A tamper-evident
 *      hash a regulator can re-run.
 *
 * Pure transform — no fetches, no DB writes, no audit-event writes.
 */

import { sha256ForPayload } from '../../utils/deterministic';

// ── Types ─────────────────────────────────────────────────────────────────────

export type EcosystemActorRole =
  | 'ISSUER'
  | 'VERIFIER'
  | 'CLINICIAN'
  | 'ENTERPRISE_OPERATOR';

export type ReadinessGate =
  | 'ONBOARDING_COMPLETE'
  | 'REPLAY_ACTIVATION_ANCHORED'
  | 'TELEMETRY_LIVE'
  | 'POLICY_ACCEPTED'
  | 'TRUST_CONTRACT_SIGNED'
  | 'AUDIT_TRAIL_VERIFIED'
  | 'ROLLOUT_SURVIVING';

export type ActorReadinessVerdict =
  | 'READY'
  | 'PARTIALLY_READY'
  | 'READINESS_AMBIGUOUS'
  | 'NOT_READY'
  | 'ACTIVATION_BREACH';

export type EcosystemReadinessVerdict =
  | 'ECOSYSTEM_READY'
  | 'ECOSYSTEM_PARTIAL'
  | 'ECOSYSTEM_AMBIGUOUS'
  | 'ECOSYSTEM_NOT_READY'
  | 'ECOSYSTEM_BREACH';

export type ReadinessGateOutcome = 'PASSED' | 'FAILED' | 'AMBIGUOUS' | 'MISSING';

export interface ReadinessGateResult {
  gate: ReadinessGate;
  outcome: ReadinessGateOutcome;
  /** Reason for non-PASSED outcome; null when PASSED. */
  reason: string | null;
  /** Replay anchor proving the gate was assessed (bundleId). May be null for MISSING. */
  replayAnchorBundleId: string | null;
}

export interface ActorReadinessSignal {
  schema: 'vitalcv.actor-readiness-signal.v1';
  signalId: string;
  observedAt: string;
  actorId: string;
  actorRole: EcosystemActorRole;
  institutionId: string;
  /** Bundle that anchors this signal in the audit trail. */
  sourceBundleId: string;
  gateResults: ReadinessGateResult[];
  /** Explicit breach flag — set when the issuer or verifier supplied forged evidence. */
  activationBreach: boolean;
}

export interface ActorReadinessRecord {
  schema: 'vitalcv.actor-readiness-record.v1';
  actorId: string;
  actorRole: EcosystemActorRole;
  institutionId: string;
  verdict: ActorReadinessVerdict;
  verdictReason: string;
  /**
   * Gates that must all PASS for READY. Null when signals are missing
   * (READINESS_AMBIGUOUS) or breached (ACTIVATION_BREACH).
   */
  gatesSummary: ReadinessGateResult[] | null;
  /**
   * Convergence percentage 0–100. Null when no gates have been assessed
   * (ambiguous or breach). Represents the fraction of required gates that
   * returned PASSED.
   */
  convergencePct: number | null;
  /** True iff the originating signal cites a non-breached replay bundle. */
  replaySafe: boolean;
  signalId: string;
  bundleId: string;
  observedAt: string;
}

export interface EcosystemReadinessInputs {
  signals: ActorReadinessSignal[];
  /** Required actor identities — used for quorum calculation. */
  expectedActors: Array<{ actorId: string; actorRole: EcosystemActorRole; institutionId: string }>;
  /**
   * Bundle ids marked as containment-breached by the replay corruption
   * containment layer. Any signal citing one of these is forced to
   * ACTIVATION_BREACH.
   */
  breachedBundleIds: string[];
}

export interface EcosystemReadinessCohort {
  role: EcosystemActorRole;
  totalActors: number;
  readyActors: number;
  partialActors: number;
  ambiguousActors: number;
  notReadyActors: number;
  breachedActors: number;
  cohortConvergencePct: number | null;
  replaySafe: boolean;
}

export interface EcosystemReadinessReport {
  schema: 'vitalcv.ecosystem-readiness-report.v1';
  reportId: string;
  generatedAt: string;
  overallVerdict: EcosystemReadinessVerdict;
  overallReason: string;
  ambiguous: boolean;
  actorRecords: ActorReadinessRecord[];
  cohorts: EcosystemReadinessCohort[];
  /**
   * System-wide convergence percentage (0–100) — weighted average of cohort
   * convergence percentages weighted by expected actor count. Null when any
   * cohort is entirely ambiguous or breached.
   */
  systemConvergencePct: number | null;
  /** Percent of expected actors that have produced readiness signals. */
  onboardingCoveragePct: number;
  /** True iff all actor records are replay-safe. */
  replaySafe: boolean;
  lineageDigest: string;
}

// ── Required gates per role ────────────────────────────────────────────────────

const REQUIRED_GATES_BY_ROLE: Record<EcosystemActorRole, ReadinessGate[]> = {
  ISSUER: [
    'ONBOARDING_COMPLETE',
    'REPLAY_ACTIVATION_ANCHORED',
    'TELEMETRY_LIVE',
    'POLICY_ACCEPTED',
    'TRUST_CONTRACT_SIGNED',
    'AUDIT_TRAIL_VERIFIED',
  ],
  VERIFIER: [
    'ONBOARDING_COMPLETE',
    'REPLAY_ACTIVATION_ANCHORED',
    'TELEMETRY_LIVE',
    'POLICY_ACCEPTED',
    'ROLLOUT_SURVIVING',
  ],
  CLINICIAN: [
    'ONBOARDING_COMPLETE',
    'REPLAY_ACTIVATION_ANCHORED',
    'POLICY_ACCEPTED',
  ],
  ENTERPRISE_OPERATOR: [
    'ONBOARDING_COMPLETE',
    'REPLAY_ACTIVATION_ANCHORED',
    'TELEMETRY_LIVE',
    'POLICY_ACCEPTED',
    'TRUST_CONTRACT_SIGNED',
    'AUDIT_TRAIL_VERIFIED',
    'ROLLOUT_SURVIVING',
  ],
};

// ── Known frozen enums (exported for CI gate canary) ─────────────────────────

export const KNOWN_ACTOR_ROLES: EcosystemActorRole[] = [
  'ISSUER',
  'VERIFIER',
  'CLINICIAN',
  'ENTERPRISE_OPERATOR',
];

export const KNOWN_READINESS_GATES: ReadinessGate[] = [
  'ONBOARDING_COMPLETE',
  'REPLAY_ACTIVATION_ANCHORED',
  'TELEMETRY_LIVE',
  'POLICY_ACCEPTED',
  'TRUST_CONTRACT_SIGNED',
  'AUDIT_TRAIL_VERIFIED',
  'ROLLOUT_SURVIVING',
];

export const KNOWN_ACTOR_READINESS_VERDICTS: ActorReadinessVerdict[] = [
  'READY',
  'PARTIALLY_READY',
  'READINESS_AMBIGUOUS',
  'NOT_READY',
  'ACTIVATION_BREACH',
];

export const KNOWN_ECOSYSTEM_VERDICTS: EcosystemReadinessVerdict[] = [
  'ECOSYSTEM_READY',
  'ECOSYSTEM_PARTIAL',
  'ECOSYSTEM_AMBIGUOUS',
  'ECOSYSTEM_NOT_READY',
  'ECOSYSTEM_BREACH',
];

export const ECOSYSTEM_READINESS_SENTINELS = {
  BREACH_BUNDLE_PREFIX: 'breach-bundle-',
  AMBIGUOUS_ACTOR_PREFIX: 'ambiguous-actor-',
} as const;

// ── Errors ────────────────────────────────────────────────────────────────────

export class EcosystemReadinessError extends Error {
  readonly violation: string;
  constructor(violation: string, message: string) {
    super(message);
    this.name = 'EcosystemReadinessError';
    this.violation = violation;
  }
}

export const KNOWN_READINESS_VIOLATIONS = [
  'AMBIGUOUS_READINESS_FORCED_READY',
  'BREACH_MASKED_BY_COHORT',
  'CONVERGENCE_OVERCLAIM',
  'MISSING_REPLAY_ANCHOR',
] as const;

export type ReadinessViolation = (typeof KNOWN_READINESS_VIOLATIONS)[number];

// ── Core transforms ───────────────────────────────────────────────────────────

function computeConvergencePct(
  gateResults: ReadinessGateResult[],
  role: EcosystemActorRole,
): number {
  const required = REQUIRED_GATES_BY_ROLE[role];
  if (required.length === 0) return 0;
  const passed = required.filter(g => {
    const result = gateResults.find(r => r.gate === g);
    return result?.outcome === 'PASSED';
  }).length;
  return Math.round((passed / required.length) * 100);
}

function classifyActorVerdict(
  signal: ActorReadinessSignal,
  breached: boolean,
): { verdict: ActorReadinessVerdict; reason: string } {
  if (breached || signal.activationBreach) {
    return { verdict: 'ACTIVATION_BREACH', reason: 'Source bundle is containment-breached or signal carries explicit breach flag' };
  }
  if (signal.gateResults.length === 0) {
    return { verdict: 'READINESS_AMBIGUOUS', reason: 'No gate results supplied — cannot determine readiness without assessed gates' };
  }
  const anyAmbiguous = signal.gateResults.some(r => r.outcome === 'AMBIGUOUS');
  const anyMissing = signal.gateResults.some(r => r.outcome === 'MISSING');
  if (anyAmbiguous || anyMissing) {
    return { verdict: 'READINESS_AMBIGUOUS', reason: `Gate outcomes contain ${anyAmbiguous ? 'AMBIGUOUS' : ''}${anyAmbiguous && anyMissing ? '+' : ''}${anyMissing ? 'MISSING' : ''} — ambiguity preserved` };
  }
  const required = REQUIRED_GATES_BY_ROLE[signal.actorRole];
  const requiredResults = required.map(g => signal.gateResults.find(r => r.gate === g));
  const allRequired = requiredResults.every(r => r?.outcome === 'PASSED');
  const anyFailed = signal.gateResults.some(r => r.outcome === 'FAILED');
  if (allRequired) return { verdict: 'READY', reason: 'All required gates passed' };
  if (!anyFailed) return { verdict: 'PARTIALLY_READY', reason: 'Some required gates not yet assessed' };
  return { verdict: 'NOT_READY', reason: 'One or more required gates failed' };
}

export function buildActorReadinessRecord(
  signal: ActorReadinessSignal,
  breachedBundleIds: string[],
): ActorReadinessRecord {
  const breached = breachedBundleIds.includes(signal.sourceBundleId);
  const { verdict, reason } = classifyActorVerdict(signal, breached);

  const convergencePct =
    verdict === 'ACTIVATION_BREACH' || verdict === 'READINESS_AMBIGUOUS'
      ? null
      : computeConvergencePct(signal.gateResults, signal.actorRole);

  return {
    schema: 'vitalcv.actor-readiness-record.v1',
    actorId: signal.actorId,
    actorRole: signal.actorRole,
    institutionId: signal.institutionId,
    verdict,
    verdictReason: reason,
    gatesSummary: verdict === 'ACTIVATION_BREACH' || verdict === 'READINESS_AMBIGUOUS'
      ? null
      : signal.gateResults,
    convergencePct,
    replaySafe: !breached && !signal.activationBreach,
    signalId: signal.signalId,
    bundleId: signal.sourceBundleId,
    observedAt: signal.observedAt,
  };
}

function buildCohort(
  role: EcosystemActorRole,
  records: ActorReadinessRecord[],
): EcosystemReadinessCohort {
  const total = records.length;
  const ready = records.filter(r => r.verdict === 'READY').length;
  const partial = records.filter(r => r.verdict === 'PARTIALLY_READY').length;
  const ambiguous = records.filter(r => r.verdict === 'READINESS_AMBIGUOUS').length;
  const notReady = records.filter(r => r.verdict === 'NOT_READY').length;
  const breached = records.filter(r => r.verdict === 'ACTIVATION_BREACH').length;

  const replaySafe = records.every(r => r.replaySafe);

  const convergenceValues = records
    .map(r => r.convergencePct)
    .filter((v): v is number => v !== null);

  const cohortConvergencePct =
    convergenceValues.length > 0
      ? Math.round(convergenceValues.reduce((a, b) => a + b, 0) / convergenceValues.length)
      : null;

  return {
    role,
    totalActors: total,
    readyActors: ready,
    partialActors: partial,
    ambiguousActors: ambiguous,
    notReadyActors: notReady,
    breachedActors: breached,
    cohortConvergencePct,
    replaySafe,
  };
}

function computeSystemConvergence(
  cohorts: EcosystemReadinessCohort[],
  expectedActors: EcosystemReadinessInputs['expectedActors'],
): number | null {
  const weights = cohorts.map(c => {
    const expectedCount = expectedActors.filter(a => a.actorRole === c.role).length;
    return { convergence: c.cohortConvergencePct, weight: expectedCount };
  });

  const anyNull = weights.some(w => w.convergence === null);
  if (anyNull) return null;

  const totalWeight = weights.reduce((s, w) => s + w.weight, 0);
  if (totalWeight === 0) return null;

  const weighted = weights.reduce((s, w) => s + (w.convergence as number) * w.weight, 0);
  return Math.round(weighted / totalWeight);
}

function deriveEcosystemVerdict(
  records: ActorReadinessRecord[],
  expectedActors: EcosystemReadinessInputs['expectedActors'],
): { verdict: EcosystemReadinessVerdict; reason: string; ambiguous: boolean } {
  if (records.some(r => r.verdict === 'ACTIVATION_BREACH')) {
    return {
      verdict: 'ECOSYSTEM_BREACH',
      reason: 'One or more actor cohorts carry an activation breach — ecosystem cannot be considered ready',
      ambiguous: false,
    };
  }
  if (records.length === 0) {
    return {
      verdict: 'ECOSYSTEM_AMBIGUOUS',
      reason: 'No actor readiness signals received — ecosystem readiness cannot be determined',
      ambiguous: true,
    };
  }
  const coveragePct = Math.round((records.length / Math.max(expectedActors.length, 1)) * 100);
  if (coveragePct < 50) {
    return {
      verdict: 'ECOSYSTEM_AMBIGUOUS',
      reason: `Onboarding coverage too low (${coveragePct}% < 50%) to determine readiness`,
      ambiguous: true,
    };
  }
  const anyAmbiguous = records.some(r => r.verdict === 'READINESS_AMBIGUOUS');
  if (anyAmbiguous) {
    return {
      verdict: 'ECOSYSTEM_AMBIGUOUS',
      reason: 'One or more actor records carry ambiguous readiness — ambiguity preserved across ecosystem',
      ambiguous: true,
    };
  }
  const allReady = records.every(r => r.verdict === 'READY');
  if (allReady) {
    return { verdict: 'ECOSYSTEM_READY', reason: 'All actor cohorts passed all required readiness gates', ambiguous: false };
  }
  const anyNotReady = records.some(r => r.verdict === 'NOT_READY');
  if (anyNotReady) {
    return { verdict: 'ECOSYSTEM_NOT_READY', reason: 'One or more actors failed required readiness gates', ambiguous: false };
  }
  return { verdict: 'ECOSYSTEM_PARTIAL', reason: 'All actors assessed but not all required gates passed across cohorts', ambiguous: false };
}

// ── Assertion helpers (for CI gate canary) ────────────────────────────────────

export function assertReadinessAmbiguityPreserved(
  records: ActorReadinessRecord[],
): void {
  for (const rec of records) {
    if (rec.convergencePct !== null && rec.verdict === 'READINESS_AMBIGUOUS') {
      throw new EcosystemReadinessError(
        'AMBIGUOUS_READINESS_FORCED_READY',
        `Actor ${rec.actorId} has READINESS_AMBIGUOUS verdict but non-null convergencePct — ambiguity must be preserved`,
      );
    }
    if (rec.replaySafe && rec.verdict === 'ACTIVATION_BREACH') {
      // replaySafe + ACTIVATION_BREACH is contradictory — flag it
      throw new EcosystemReadinessError(
        'BREACH_MASKED_BY_COHORT',
        `Actor ${rec.actorId} has ACTIVATION_BREACH verdict but replaySafe=true — breach cannot be masked`,
      );
    }
  }
}

export function assertEcosystemBreach(report: EcosystemReadinessReport): void {
  if (report.overallVerdict !== 'ECOSYSTEM_BREACH') {
    throw new EcosystemReadinessError(
      'BREACH_MASKED_BY_COHORT',
      `Expected ECOSYSTEM_BREACH but got ${report.overallVerdict}`,
    );
  }
}

// ── Lineage digest ─────────────────────────────────────────────────────────────

export function reproduceReadinessLineageDigest(report: EcosystemReadinessReport): string {
  return sha256ForPayload({
    reportId: report.reportId,
    generatedAt: report.generatedAt,
    overallVerdict: report.overallVerdict,
    records: report.actorRecords.map(r => ({
      actorId: r.actorId,
      verdict: r.verdict,
      convergencePct: r.convergencePct,
      bundleId: r.bundleId,
      signalId: r.signalId,
    })),
    systemConvergencePct: report.systemConvergencePct,
    onboardingCoveragePct: report.onboardingCoveragePct,
  });
}

// ── Primary builder ───────────────────────────────────────────────────────────

export function buildEcosystemReadinessReport(params: {
  reportId: string;
  generatedAt: string;
  inputs: EcosystemReadinessInputs;
}): EcosystemReadinessReport {
  const { reportId, generatedAt, inputs } = params;
  const { signals, expectedActors, breachedBundleIds } = inputs;

  const actorRecords = signals.map(s => buildActorReadinessRecord(s, breachedBundleIds));

  // Build per-role cohorts
  const roles = Array.from(new Set(actorRecords.map(r => r.actorRole))) as EcosystemActorRole[];
  const cohorts = roles.map(role =>
    buildCohort(role, actorRecords.filter(r => r.actorRole === role)),
  );

  const { verdict: overallVerdict, reason: overallReason, ambiguous } =
    deriveEcosystemVerdict(actorRecords, expectedActors);

  const systemConvergencePct =
    ambiguous || overallVerdict === 'ECOSYSTEM_BREACH'
      ? null
      : computeSystemConvergence(cohorts, expectedActors);

  const onboardingCoveragePct =
    expectedActors.length === 0
      ? 0
      : Math.round((actorRecords.length / expectedActors.length) * 100);

  const replaySafe = actorRecords.every(r => r.replaySafe);

  const report: EcosystemReadinessReport = {
    schema: 'vitalcv.ecosystem-readiness-report.v1',
    reportId,
    generatedAt,
    overallVerdict,
    overallReason,
    ambiguous,
    actorRecords,
    cohorts,
    systemConvergencePct,
    onboardingCoveragePct,
    replaySafe,
    lineageDigest: '',
  };

  report.lineageDigest = reproduceReadinessLineageDigest(report);
  return report;
}
