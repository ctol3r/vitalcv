/**
 * covenantObservability.ts — W2-PR157A: Covenant Observability Layer
 *
 * Derives the five Covenant Finalization Board metrics from live covenant
 * compliance verdicts. All percentages are evidence-derived — no operator
 * assertion may set a score without matching evidence.
 *
 * Board metrics:
 *   - Replay Guarantee Integrity %          (REPLAY_GUARANTEE covenant)
 *   - Ambiguity Honesty Permanence %        (AMBIGUITY_HONESTY covenant)
 *   - Institutional Survivability Guarantees % (INSTITUTIONAL_SURVIVABILITY)
 *   - Covenant Stability %                  (ratio of locked + non-violated covenants)
 *   - Covenant Finalization Maturity %      (composite of all four above)
 *
 * Hard invariants:
 *   - A covenant in VIOLATED or QUARANTINED status contributes 0% to its metric.
 *   - A covenant in AMBIGUOUS status contributes 0% — ambiguity is never rounded up.
 *   - Maturity is the floor of all four component scores — the weakest covenant
 *     sets the ceiling, preventing a high aggregate from masking a critical breach.
 *   - The report carries an observabilityHash so consumers can detect tampered reports.
 *
 * No fetches, no DB writes, no audit-event writes. Pure transforms only.
 */

import { sha256ForPayload } from '../../utils/deterministic';
import {
  type CovenantId,
  type CovenantComplianceVerdict,
  CANONICAL_COVENANTS,
  lockAllCovenants,
  buildCovenantLineage,
} from './institutionalCovenant';

// ── Metric types ──────────────────────────────────────────────────────────────

export interface CovenantBoardMetrics {
  /** 0–100 */
  replayGuaranteeIntegrityPct: number;
  /** 0–100 */
  ambiguityHonestyPermanencePct: number;
  /** 0–100 */
  institutionalSurvivabilityGuaranteesPct: number;
  /** 0–100 — ratio of all 6 covenants that are locked and non-violated */
  covenantStabilityPct: number;
  /**
   * 0–100 — floor of all four component scores.
   * The weakest covenant sets the ceiling; no aggregate hides a critical breach.
   */
  covenantFinalizationMaturityPct: number;
}

export interface CovenantObservabilityReport {
  schema: 'vitalcv.covenant-observability.v1';
  generatedAt: string;
  totalCovenants: number;
  lockedCovenantCount: number;
  metrics: CovenantBoardMetrics;
  verdictSummary: {
    compliantCount: number;
    violatedCount: number;
    ambiguousCount: number;
    quarantinedCount: number;
  };
  /** sha256 of the full report body — detects tampered reports */
  observabilityHash: string;
}

// ── Metric derivation ─────────────────────────────────────────────────────────

function isCompliant(verdicts: CovenantComplianceVerdict[], covenantId: CovenantId): boolean {
  return verdicts.some((v) => v.covenantId === covenantId && v.status === 'COMPLIANT');
}

function pct(pass: boolean): number {
  return pass ? 100 : 0;
}

export function deriveCovenantBoardMetrics(
  verdicts: CovenantComplianceVerdict[],
): CovenantBoardMetrics {
  const totalCovenants = CANONICAL_COVENANTS.size;

  const replayGuaranteeIntegrityPct = pct(isCompliant(verdicts, 'REPLAY_GUARANTEE'));
  const ambiguityHonestyPermanencePct = pct(isCompliant(verdicts, 'AMBIGUITY_HONESTY'));
  const institutionalSurvivabilityGuaranteesPct = pct(
    isCompliant(verdicts, 'INSTITUTIONAL_SURVIVABILITY'),
  );

  // Stability = fraction of all covenants that are locked and COMPLIANT
  const locks = lockAllCovenants();
  const lockedAndCompliant = verdicts.filter(
    (v) => v.status === 'COMPLIANT' && locks.has(v.covenantId),
  ).length;
  const covenantStabilityPct = Math.round((lockedAndCompliant / totalCovenants) * 100);

  // Maturity = floor of the four component scores
  const covenantFinalizationMaturityPct = Math.min(
    replayGuaranteeIntegrityPct,
    ambiguityHonestyPermanencePct,
    institutionalSurvivabilityGuaranteesPct,
    covenantStabilityPct,
  );

  return {
    replayGuaranteeIntegrityPct,
    ambiguityHonestyPermanencePct,
    institutionalSurvivabilityGuaranteesPct,
    covenantStabilityPct,
    covenantFinalizationMaturityPct,
  };
}

// ── Full observability report ─────────────────────────────────────────────────

export function buildCovenantObservabilityReport(
  verdicts: CovenantComplianceVerdict[],
  generatedAt?: string,
): CovenantObservabilityReport {
  const locks = lockAllCovenants();
  const metrics = deriveCovenantBoardMetrics(verdicts);

  const compliantCount = verdicts.filter((v) => v.status === 'COMPLIANT').length;
  const violatedCount = verdicts.filter((v) => v.status === 'VIOLATED').length;
  const ambiguousCount = verdicts.filter((v) => v.status === 'AMBIGUOUS').length;
  const quarantinedCount = verdicts.filter((v) => v.status === 'QUARANTINED').length;

  const body = {
    schema: 'vitalcv.covenant-observability.v1' as const,
    generatedAt: generatedAt ?? new Date().toISOString(),
    totalCovenants: CANONICAL_COVENANTS.size,
    lockedCovenantCount: locks.size,
    metrics,
    verdictSummary: {
      compliantCount,
      violatedCount,
      ambiguousCount,
      quarantinedCount,
    },
  };

  return { ...body, observabilityHash: sha256ForPayload(body) };
}

// ── Lineage observability ─────────────────────────────────────────────────────

export function buildCovenantLineageReport() {
  const records = Array.from(CANONICAL_COVENANTS.values());
  return buildCovenantLineage(records);
}

// ── Maturity threshold check ──────────────────────────────────────────────────

/** CI gate uses this to block on maturity below threshold. */
export function assertCovenantMaturityThreshold(
  metrics: CovenantBoardMetrics,
  thresholdPct: number,
): { pass: boolean; actual: number; threshold: number; reason: string } {
  const actual = metrics.covenantFinalizationMaturityPct;
  const pass = actual >= thresholdPct;
  return {
    pass,
    actual,
    threshold: thresholdPct,
    reason: pass
      ? `Covenant finalization maturity ${actual}% meets the ${thresholdPct}% threshold.`
      : `Covenant finalization maturity ${actual}% is below the ${thresholdPct}% threshold — gate blocked.`,
  };
}
