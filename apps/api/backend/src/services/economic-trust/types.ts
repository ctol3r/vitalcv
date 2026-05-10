/**
 * economic-trust/types.ts — Evidence-derived economic + operational trust types.
 *
 * Wave: W2-PR60A.
 *
 * These types are deliberately structural, not computed. Every metric carries
 * ambiguity bounds (low / point / high) and a confidence weighting so that
 * downstream consumers — ROI dashboards, CI gates, regulatory exports — never
 * see point-estimates without uncertainty attached. Fail-closed semantics are
 * encoded at the verdict layer: an undersized or malformed sample never
 * produces a PROVEN verdict, regardless of how favorable its means look.
 *
 * The input contract (ReplayEvidence) is a projection of replayEngine's
 * DecisionReplay shape into just the fields needed for economic modeling. It
 * is deliberately decoupled so the metrics engine can run on synthetic /
 * mocked replays in CI without dragging in a Postgres dependency.
 */

/** A single replay observation projected to its economically-relevant fields. */
export interface ReplayEvidence {
  /** Stable replay identifier (matches DecisionReplay.capsuleId in production). */
  replayId: string;
  /** Capsule the replay was derived from. */
  capsuleId: string;
  /** Tenant scope — required so multi-tenant aggregation never leaks across. */
  tenantId: string;
  /** Verifier identity (SYSTEM / ORGANIZATION / HUMAN / AI_AGENT). */
  verifierType: 'SYSTEM' | 'ORGANIZATION' | 'HUMAN' | 'AI_AGENT';
  /** Stable verifier id (org id or system id). */
  verifierId: string;
  /** When the upstream evidence was first verified — drives time-to-start. */
  evidenceVerifiedAt: Date;
  /** When the decision was emitted — endpoint of time-to-start window. */
  decisionEmittedAt: Date;
  /** When the replay itself completed — drives replay throughput. */
  replayCompletedAt: Date;
  /** Replay wall-clock duration in milliseconds. */
  replayDurationMs: number;
  /** Total evidence artifacts consulted in the replay. */
  evidenceArtifactCount: number;
  /** Artifacts reused from a prior verified state (no re-fetch). */
  reusedArtifactCount: number;
  /** Authority chain depth at the time of the decision. */
  authorityChainDepth: number;
  /** Integrity verdict from the replay. */
  integrityVerdict: 'pass' | 'fail' | 'inconclusive';
  /** Decision outcome. */
  decisionOutcome: 'APPROVED' | 'DECLINED' | 'PENDING' | 'WITHDRAWN' | 'ERROR';
  /** Marks evidence the engine should treat as poisoned (chaos / corruption). */
  malformed?: boolean;
}

/**
 * A metric reported with explicit ambiguity bounds.
 *
 * `point` is the central estimate. `low` / `high` form a confidence interval
 * (typically 90%). `confidence` is the engine's self-reported trust in the
 * estimate, in [0,1], driven by sample size, integrity rate, and chaos load.
 * `basis` distinguishes directly observed values from derived / extrapolated
 * ones; CI gates may refuse to publish an "unknown"-basis metric.
 */
export interface AmbiguousMetric<T extends number = number> {
  point: T;
  low: T;
  high: T;
  confidence: number;
  basis: 'observed' | 'derived' | 'unknown';
  sampleSize: number;
  unit?: string;
}

/** Per-verifier efficiency breakdown. */
export interface VerifierEfficiencyReport {
  verifierId: string;
  verifierType: ReplayEvidence['verifierType'];
  decisionsObserved: number;
  meanReplayMs: AmbiguousMetric;
  integrityCertRate: AmbiguousMetric;
  meanAuthorityDepth: AmbiguousMetric;
  /** Decisions per verifier-hour; null when window is zero. */
  decisionsPerHour: AmbiguousMetric | null;
}

/**
 * Verdict ladder, applied conservatively.
 *
 * - PROVEN: large sample, high integrity, no chaos contamination, all metrics observed.
 * - PROBABLE: medium sample with acceptable integrity; useful for steering, not for filings.
 * - INCONCLUSIVE: too few observations, too much noise, or mixed integrity. Engines must NOT
 *   claim ROI. Dashboards must render the verdict, never the value.
 * - FAIL_CLOSED: structural failure — corrupted input, contradictory windows, or chaos-injected
 *   poison crossed the threshold. Caller must treat all numeric fields as untrustworthy.
 */
export type EconomicVerdict = 'PROVEN' | 'PROBABLE' | 'INCONCLUSIVE' | 'FAIL_CLOSED';

/** Why a verdict was set. Surfaced in CI logs and ops dashboards. */
export interface VerdictReason {
  code:
    | 'SAMPLE_TOO_SMALL'
    | 'CONFIDENCE_BELOW_THRESHOLD'
    | 'INTEGRITY_FAILURE_RATE_HIGH'
    | 'CHAOS_THRESHOLD_EXCEEDED'
    | 'MALFORMED_INPUT'
    | 'TENANT_AMBIGUITY'
    | 'WINDOW_CONTRADICTION'
    | 'OK';
  detail: string;
}

/** Manual cost baseline used by the operational-savings calculator. */
export interface ManualCostBaseline {
  /** Lower bound USD per manual credential check (preserves ambiguity). */
  lowUsdPerCheck: number;
  /** Upper bound USD per manual credential check. */
  highUsdPerCheck: number;
  /** Source descriptor — e.g. "NCQA 2024 vendor benchmark range". */
  citation: string;
}

/** Default manual cost baseline. Wide intentionally — narrow only when calibrated. */
export const DEFAULT_MANUAL_COST_BASELINE: ManualCostBaseline = {
  lowUsdPerCheck: 25,
  highUsdPerCheck: 75,
  citation: 'industry vendor range, conservative; replace with calibrated tenant data when available',
};

/** A longitudinal datapoint emitted into the trend stream. */
export interface LongitudinalDatapoint {
  windowStart: Date;
  windowEnd: Date;
  verdict: EconomicVerdict;
  trustEfficiencyPoint: number;
  replayReuseEfficiencyPoint: number;
  operationalSavingsLowUsd: number;
  operationalSavingsHighUsd: number;
  sampleSize: number;
}

/** Chaos-simulation result summary. */
export interface ChaosScenarioResult {
  scenario: string;
  injectedFailureRate: number;
  observedVerdict: EconomicVerdict;
  trustEfficiencyDelta: number;
  failedClosed: boolean;
  notes: string;
}

/** Top-level report produced by computeEconomicTrustReport(). */
export interface EconomicTrustReport {
  /** Overall verdict; never PROVEN under any non-OK reason. */
  verdict: EconomicVerdict;
  reasons: VerdictReason[];
  generatedAt: Date;
  windowStart: Date;
  windowEnd: Date;
  totalReplays: number;
  tenantCount: number;
  /** Time-to-start in ms (evidenceVerifiedAt → decisionEmittedAt). */
  timeToStartMs: AmbiguousMetric;
  /** Replay reuse efficiency: reused / total artifacts, in [0,1]. */
  replayReuseEfficiency: AmbiguousMetric;
  /** Composite trust-efficiency score, 0..100. */
  trustEfficiencyScore: AmbiguousMetric;
  /** Aggregate operational savings in USD over the window. */
  operationalSavingsUsd: AmbiguousMetric;
  /** Per-verifier breakdown, sorted by decisionsObserved desc. */
  verifierEfficiency: VerifierEfficiencyReport[];
  /** Trend slice for longitudinal dashboards (one entry per call by default). */
  trend: LongitudinalDatapoint[];
  /** Surface of fail-closed reasons for ops triage. */
  failClosedReasons: string[];
  /** Hash of the input dataset for audit reproducibility. */
  inputDigest: string;
}
