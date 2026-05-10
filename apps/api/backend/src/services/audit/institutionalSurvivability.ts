/**
 * institutionalSurvivability.ts — Institutional Survivability Checks
 *
 * Evaluates whether a production deployment can survive institutional failure
 * modes: auth degradation, replay-store unavailability, tenant isolation
 * breach attempts, and partial evidence-spine corruption.
 *
 * All checks are fail-closed: a check that cannot be evaluated returns FAIL,
 * not SKIP. Ambiguity is preserved and reported, never resolved optimistically.
 */

import { createHash } from 'crypto';

// ── Check types ────────────────────────────────────────────────────────────────

export type SurvivabilityCheckId =
  | 'AUTH_DEGRADED_FAIL_CLOSED'
  | 'REPLAY_STORE_UNAVAILABLE'
  | 'TENANT_ISOLATION_BOUNDARY'
  | 'EVIDENCE_SPINE_PARTIAL_CORRUPTION'
  | 'AUDIT_LEDGER_WRITE_FAILURE'
  | 'CONFIDENCE_FLOOR_ENFORCEMENT'
  | 'RATE_LIMIT_EXHAUSTION'
  | 'CLOCK_SKEW_CONTAINMENT'
  | 'SCHEMA_VERSION_MISMATCH'
  | 'INSTITUTIONAL_CREDENTIAL_EXPIRY';

export type SurvivabilityOutcome = 'PASS' | 'FAIL' | 'DEGRADED' | 'AMBIGUOUS';

export type SurvivabilityCategory =
  | 'AUTH'
  | 'REPLAY'
  | 'TENANT'
  | 'EVIDENCE'
  | 'AUDIT'
  | 'CONFIDENCE'
  | 'OPERATIONAL';

// ── Input ──────────────────────────────────────────────────────────────────────

export interface SurvivabilityProbe {
  checkId: SurvivabilityCheckId;
  category: SurvivabilityCategory;
  simulatedCondition: string;
  observedBehavior: string;
  expectedBehavior: string;
  failClosedVerified: boolean;
  ambiguous: boolean;
  ambiguityReason: string | null;
  evidenceRef: string | null;
}

export interface InstitutionalSurvivabilityInput {
  deploymentId: string;
  institutionId: string;
  probes: SurvivabilityProbe[];
  checkedAt: string;
}

// ── Output ─────────────────────────────────────────────────────────────────────

export interface SurvivabilityCheckResult {
  checkId: SurvivabilityCheckId;
  category: SurvivabilityCategory;
  outcome: SurvivabilityOutcome;
  failClosedEnforced: boolean;
  ambiguityPreserved: boolean;
  gap: string | null;
  remediationRequired: boolean;
}

export interface InstitutionalSurvivabilityReport {
  schema: 'https://vitalcv.com/survivability/v1';
  reportVersion: '1.0';
  deploymentId: string;
  institutionId: string;
  checks: SurvivabilityCheckResult[];
  summary: {
    totalChecks: number;
    passing: number;
    failing: number;
    degraded: number;
    ambiguous: number;
    institutionallyReadyPercent: number;
    deploymentSurvivabilityPercent: number;
    blockers: string[];
  };
  overallOutcome: SurvivabilityOutcome;
  checkedAt: string;
  checkFingerprint: string;
}

// ── Exported sentinels ─────────────────────────────────────────────────────────

export const SURVIVABILITY_SENTINELS = {
  FAIL_CLOSED_REQUIRED:    'FAIL_CLOSED_REQUIRED',
  AMBIGUITY_NOT_PASS:      'AMBIGUITY_NOT_PASS',
  UNEVALUATED_IS_FAIL:     'UNEVALUATED_IS_FAIL',
  DEGRADED_BLOCKS_PROD:    'DEGRADED_BLOCKS_PROD',
} as const;

export const KNOWN_SURVIVABILITY_OUTCOMES: SurvivabilityOutcome[] = [
  'PASS', 'FAIL', 'DEGRADED', 'AMBIGUOUS',
];

export const KNOWN_SURVIVABILITY_CHECKS: SurvivabilityCheckId[] = [
  'AUTH_DEGRADED_FAIL_CLOSED',
  'REPLAY_STORE_UNAVAILABLE',
  'TENANT_ISOLATION_BOUNDARY',
  'EVIDENCE_SPINE_PARTIAL_CORRUPTION',
  'AUDIT_LEDGER_WRITE_FAILURE',
  'CONFIDENCE_FLOOR_ENFORCEMENT',
  'RATE_LIMIT_EXHAUSTION',
  'CLOCK_SKEW_CONTAINMENT',
  'SCHEMA_VERSION_MISMATCH',
  'INSTITUTIONAL_CREDENTIAL_EXPIRY',
];

// ── Check evaluation ───────────────────────────────────────────────────────────

function evaluateProbe(probe: SurvivabilityProbe): SurvivabilityCheckResult {
  const behaviorMatches =
    probe.observedBehavior.trim() === probe.expectedBehavior.trim();

  let outcome: SurvivabilityOutcome;
  let gap: string | null = null;

  if (probe.ambiguous) {
    outcome = 'AMBIGUOUS';
    gap = probe.ambiguityReason ?? 'Observed behavior could not be unambiguously classified.';
  } else if (!probe.failClosedVerified) {
    outcome = 'FAIL';
    gap = `Fail-closed behavior not verified for condition: ${probe.simulatedCondition}`;
  } else if (!behaviorMatches) {
    outcome = 'DEGRADED';
    gap = `Expected: "${probe.expectedBehavior}" — Observed: "${probe.observedBehavior}"`;
  } else {
    outcome = 'PASS';
  }

  return {
    checkId: probe.checkId,
    category: probe.category,
    outcome,
    failClosedEnforced: probe.failClosedVerified,
    ambiguityPreserved: probe.ambiguous,
    gap,
    remediationRequired: outcome !== 'PASS',
  };
}

function computeSurvivabilityPercent(checks: SurvivabilityCheckResult[]): number {
  if (checks.length === 0) return 0;
  const passing = checks.filter(c => c.outcome === 'PASS').length;
  return Math.round((passing / checks.length) * 100);
}

function computeInstitutionalReadinessPercent(checks: SurvivabilityCheckResult[]): number {
  if (checks.length === 0) return 0;
  // Institutional readiness counts PASS at full weight, DEGRADED at half, others at zero
  const score = checks.reduce((acc, c) => {
    if (c.outcome === 'PASS')     return acc + 1;
    if (c.outcome === 'DEGRADED') return acc + 0.5;
    return acc;
  }, 0);
  return Math.round((score / checks.length) * 100);
}

function buildCheckFingerprint(input: InstitutionalSurvivabilityInput): string {
  const stable = {
    deploymentId: input.deploymentId,
    institutionId: input.institutionId,
    checkIds: input.probes.map(p => p.checkId).sort(),
    behaviors: input.probes.map(p => p.observedBehavior).sort(),
  };
  return createHash('sha256').update(JSON.stringify(stable)).digest('hex');
}

export function runInstitutionalSurvivabilityChecks(
  input: InstitutionalSurvivabilityInput,
): InstitutionalSurvivabilityReport {
  const checks = input.probes.map(evaluateProbe);

  const passing   = checks.filter(c => c.outcome === 'PASS').length;
  const failing   = checks.filter(c => c.outcome === 'FAIL').length;
  const degraded  = checks.filter(c => c.outcome === 'DEGRADED').length;
  const ambiguous = checks.filter(c => c.outcome === 'AMBIGUOUS').length;

  const blockers = checks
    .filter(c => c.remediationRequired && c.gap)
    .map(c => `[${c.checkId}] ${c.gap}`);

  const overallOutcome: SurvivabilityOutcome =
    failing   > 0                     ? 'FAIL'     :
    ambiguous > 0                     ? 'AMBIGUOUS' :
    degraded  > 0                     ? 'DEGRADED'  :
    /* all pass */                      'PASS';

  return {
    schema: 'https://vitalcv.com/survivability/v1',
    reportVersion: '1.0',
    deploymentId: input.deploymentId,
    institutionId: input.institutionId,
    checks,
    summary: {
      totalChecks: checks.length,
      passing,
      failing,
      degraded,
      ambiguous,
      institutionallyReadyPercent: computeInstitutionalReadinessPercent(checks),
      deploymentSurvivabilityPercent: computeSurvivabilityPercent(checks),
      blockers,
    },
    overallOutcome,
    checkedAt: input.checkedAt,
    checkFingerprint: buildCheckFingerprint(input),
  };
}
