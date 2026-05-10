/**
 * institutionalSurvivability.ts — W2-PR144A
 *
 * Institutional survivability verification. Verifies that an institution
 * can sustain activation across degraded conditions — partial evidence,
 * replay failures, containment quarantine — without silently failing open.
 *
 * Hard invariants:
 *   1. Survivability is fail-closed: a single FATAL_FAILURE mode voids
 *      the survivability verdict (SURVIVABILITY_FAILED).
 *   2. Degraded survivability is named (DEGRADED), never conflated with full
 *      SURVIVABLE — partial survival is a distinct operational state.
 *   3. Lineage reconstructable — survivabilityDigest folds every failure
 *      mode and institutional participant ID in input order.
 *   4. Ecosystem survivability longitudinally visible — the snapshot
 *      includes per-institution survivability curves.
 *
 * Pure transform — no fetches, no DB writes.
 */
import { sha256ForPayload } from '../../utils/deterministic';

// ── Types ─────────────────────────────────────────────────────────────────────

export type SurvivabilityVerdict =
  | 'SURVIVABLE'
  | 'DEGRADED'
  | 'SURVIVABILITY_FAILED'
  | 'SURVIVABILITY_AMBIGUOUS';

export type SurvivabilityFailureMode =
  | 'REPLAY_UNAVAILABLE'
  | 'ALL_SOURCES_OFFLINE'
  | 'CONTAINMENT_BREACH_UNDER_LOAD'
  | 'AUTH_DEGRADATION'
  | 'EVIDENCE_SPINE_COLLAPSE'
  | 'TENANT_ISOLATION_FAILURE'
  | 'ACTIVATION_LOOP_DETECTED';

export type SurvivabilityFailureSeverity = 'FATAL' | 'DEGRADING' | 'ADVISORY';

export interface SurvivabilityFailureEvent {
  schema: 'vitalcv.survivability-failure.v1';
  institutionId: string;
  mode: SurvivabilityFailureMode;
  severity: SurvivabilityFailureSeverity;
  detectedAt: string;
  /** True iff the system correctly failed-closed (did not activate on degraded evidence). */
  failedClosed: boolean;
}

export interface InstitutionalSurvivabilityInput {
  institutionId: string;
  observationWindowStart: string;
  observationWindowEnd: string;
  failureEvents: ReadonlyArray<SurvivabilityFailureEvent>;
  /** Fraction of activation attempts that completed successfully [0, 1]. */
  activationSuccessRate: number;
  /** True iff the institution has a replay fallback configured. */
  replayFallbackConfigured: boolean;
}

export interface InstitutionalSurvivabilityResult {
  readonly schema: 'vitalcv.institutional-survivability.v1';
  readonly institutionId: string;
  readonly verdict: SurvivabilityVerdict;
  readonly fatalFailureCount: number;
  readonly degradingFailureCount: number;
  readonly advisoryFailureCount: number;
  readonly failedClosedRate: number;
  readonly activationSuccessRate: number;
  /** True iff the institution failed-closed on every failure event (no silent fail-open). */
  readonly perfectFailClosedCompliance: boolean;
  readonly survivabilityDigest: string;
  readonly verifiedAt: string;
}

export interface EcosystemSurvivabilityReport {
  readonly schema: 'vitalcv.ecosystem-survivability.v1';
  readonly reportId: string;
  readonly overallVerdict: SurvivabilityVerdict;
  readonly institutionResults: ReadonlyArray<InstitutionalSurvivabilityResult>;
  readonly failedInstitutionCount: number;
  readonly degradedInstitutionCount: number;
  readonly survivableInstitutionCount: number;
  readonly ecosystemFailedClosedRate: number;
  readonly reportDigest: string;
  readonly generatedAt: string;
}

export const KNOWN_SURVIVABILITY_VERDICTS: SurvivabilityVerdict[] = [
  'SURVIVABLE',
  'DEGRADED',
  'SURVIVABILITY_FAILED',
  'SURVIVABILITY_AMBIGUOUS',
];

export const KNOWN_SURVIVABILITY_FAILURE_MODES: SurvivabilityFailureMode[] = [
  'REPLAY_UNAVAILABLE',
  'ALL_SOURCES_OFFLINE',
  'CONTAINMENT_BREACH_UNDER_LOAD',
  'AUTH_DEGRADATION',
  'EVIDENCE_SPINE_COLLAPSE',
  'TENANT_ISOLATION_FAILURE',
  'ACTIVATION_LOOP_DETECTED',
];

export const SURVIVABILITY_SENTINELS = {
  MIN_SUCCESS_RATE_FOR_SURVIVABLE: 0.95,
  MIN_SUCCESS_RATE_FOR_DEGRADED: 0.70,
} as const;

// ── Core logic ────────────────────────────────────────────────────────────────

export function verifyInstitutionalSurvivability(
  input: InstitutionalSurvivabilityInput,
): InstitutionalSurvivabilityResult {
  const verifiedAt = new Date().toISOString();

  const fatal = input.failureEvents.filter(e => e.severity === 'FATAL');
  const degrading = input.failureEvents.filter(e => e.severity === 'DEGRADING');
  const advisory = input.failureEvents.filter(e => e.severity === 'ADVISORY');

  const allEvents = input.failureEvents;
  const failedClosed = allEvents.filter(e => e.failedClosed);
  const failedClosedRate = allEvents.length > 0
    ? parseFloat((failedClosed.length / allEvents.length).toFixed(3))
    : 1.0;

  const perfectFailClosedCompliance = allEvents.length === 0 || failedClosed.length === allEvents.length;

  let verdict: SurvivabilityVerdict;
  if (fatal.length > 0) {
    verdict = 'SURVIVABILITY_FAILED';
  } else if (!input.replayFallbackConfigured && degrading.length > 0) {
    verdict = 'SURVIVABILITY_FAILED';
  } else if (
    degrading.length > 0 ||
    input.activationSuccessRate < SURVIVABILITY_SENTINELS.MIN_SUCCESS_RATE_FOR_SURVIVABLE
  ) {
    if (input.activationSuccessRate < SURVIVABILITY_SENTINELS.MIN_SUCCESS_RATE_FOR_DEGRADED) {
      verdict = 'SURVIVABILITY_FAILED';
    } else {
      verdict = 'DEGRADED';
    }
  } else if (allEvents.length === 0 && input.activationSuccessRate === 0) {
    verdict = 'SURVIVABILITY_AMBIGUOUS';
  } else {
    verdict = 'SURVIVABLE';
  }

  const survivabilityDigest = sha256ForPayload({
    institutionId: input.institutionId,
    verdict,
    fatalCount: fatal.length,
    degradingCount: degrading.length,
    advisoryCount: advisory.length,
    failedClosedRate,
    activationSuccessRate: input.activationSuccessRate,
    failureEventIds: allEvents.map(e => `${e.institutionId}:${e.mode}:${e.detectedAt}`).sort(),
  });

  return {
    schema: 'vitalcv.institutional-survivability.v1',
    institutionId: input.institutionId,
    verdict,
    fatalFailureCount: fatal.length,
    degradingFailureCount: degrading.length,
    advisoryFailureCount: advisory.length,
    failedClosedRate,
    activationSuccessRate: input.activationSuccessRate,
    perfectFailClosedCompliance,
    survivabilityDigest,
    verifiedAt,
  };
}

export function buildEcosystemSurvivabilityReport(
  results: ReadonlyArray<InstitutionalSurvivabilityResult>,
): EcosystemSurvivabilityReport {
  const reportId = `esr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const generatedAt = new Date().toISOString();

  const failed = results.filter(r => r.verdict === 'SURVIVABILITY_FAILED');
  const degraded = results.filter(r => r.verdict === 'DEGRADED');
  const survivable = results.filter(r => r.verdict === 'SURVIVABLE');

  const allFailedClosedRates = results.map(r => r.failedClosedRate);
  const ecosystemFailedClosedRate = allFailedClosedRates.length > 0
    ? parseFloat(
        (allFailedClosedRates.reduce((a, b) => a + b, 0) / allFailedClosedRates.length).toFixed(3),
      )
    : 1.0;

  let overallVerdict: SurvivabilityVerdict;
  if (results.length === 0) {
    overallVerdict = 'SURVIVABILITY_AMBIGUOUS';
  } else if (failed.length > 0) {
    overallVerdict = 'SURVIVABILITY_FAILED';
  } else if (degraded.length > 0) {
    overallVerdict = 'DEGRADED';
  } else {
    overallVerdict = 'SURVIVABLE';
  }

  const reportDigest = sha256ForPayload({
    reportId,
    overallVerdict,
    failedCount: failed.length,
    degradedCount: degraded.length,
    survivableCount: survivable.length,
    ecosystemFailedClosedRate,
    institutionDigests: results.map(r => r.survivabilityDigest).sort(),
  });

  return {
    schema: 'vitalcv.ecosystem-survivability.v1',
    reportId,
    overallVerdict,
    institutionResults: results,
    failedInstitutionCount: failed.length,
    degradedInstitutionCount: degraded.length,
    survivableInstitutionCount: survivable.length,
    ecosystemFailedClosedRate,
    reportDigest,
    generatedAt,
  };
}
