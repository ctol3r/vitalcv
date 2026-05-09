/**
 * Longitudinal governance memory — institutional drift intelligence.
 *
 * Wave: W2-PR30A — Longitudinal Governance Memory + Institutional Drift Intelligence.
 *
 * Builds an append-only ledger of governance epochs (snapshots-at-time)
 * and derives drift trajectories, fatigue metrics, and historical trust
 * modifiers. The ledger itself is a pure data structure; persistence is
 * the caller's responsibility (file, DB, etc.).
 *
 * Non-negotiable rules (from W2-PR30A directive):
 *   1. Governance memory must remain historically durable.
 *   2. Chronic instability must remain visible.
 *   3. Repeated failures reduce institutional trust.
 *   4. Historical drift must propagate forward.
 *   5. Replay fragility history may not be erased.
 *   6. Governance fatigue is an operational risk.
 *   7. Institutional memory must resist normalization.
 *
 * Pure transforms. No fetches. No DB writes. Caller persists.
 */

import type { GovernanceDomain } from "./meta-verification.js";

// ---------------------------------------------------------------------------
// TARGET 1 — Governance Memory Ledger
// ---------------------------------------------------------------------------

/**
 * One observation epoch — a snapshot of governance state at a point in time.
 *
 * Append-only by convention. The ledger is the array of these in
 * chronological order.
 */
export interface GovernanceEpoch {
  /** ISO-8601 UTC observation instant. */
  readonly observedAt: string;
  /** Number of currently-active human overrides at this instant. */
  readonly activeOverrideCount: number;
  /** Number of overrides observed to have entered EXPIRED state in this epoch. */
  readonly expiredOverrideCount: number;
  /** Number of overrides observed to have entered OVER-RENEWED state. */
  readonly overRenewedOverrideCount: number;
  /** Count of replay-state observations classified R-AMBIGUOUS. */
  readonly replayAmbiguousCount: number;
  /** Count of replay-state observations classified R-COLLAPSED. */
  readonly replayCollapsedCount: number;
  /** Count of integrity-state observations at CI-DEGRADED or worse. */
  readonly integrityDegradedCount: number;
  /** Count of containment-state observations at CT-FRAGMENTING or worse. */
  readonly containmentDegradedCount: number;
  /** Count of recovery transitions attempted in this epoch. */
  readonly recoveryAttemptCount: number;
  /** Count of recovery transitions that failed (re-entered degraded). */
  readonly recoveryFailureCount: number;
  /** Count of cross-axis contradictions detected. */
  readonly contradictionCount: number;
  /** Aggregate verification confidence at this epoch (mirrors meta-verification). */
  readonly aggregateVerificationConfidence:
    | "VERIFIED"
    | "PARTIALLY-VERIFIED"
    | "ASSUMED"
    | "UNVERIFIED"
    | "UNKNOWN";
  /**
   * Per-domain degraded count for this epoch (counts of domains that
   * registered any degraded state during the epoch).
   */
  readonly degradedDomainTallies: Readonly<Partial<Record<GovernanceDomain, number>>>;
}

export interface GovernanceLedger {
  /** Chronologically ordered, append-only. Caller MUST NOT mutate or reorder. */
  readonly epochs: readonly GovernanceEpoch[];
}

/**
 * Append a new epoch to the ledger. Pure: returns a new ledger; does not
 * mutate the input. Rejects out-of-order observations to preserve
 * historical durability.
 */
export function appendEpoch(
  ledger: GovernanceLedger,
  epoch: GovernanceEpoch,
): GovernanceLedger {
  if (ledger.epochs.length > 0) {
    const last = ledger.epochs[ledger.epochs.length - 1];
    if (last && Date.parse(epoch.observedAt) < Date.parse(last.observedAt)) {
      throw new Error(
        `appendEpoch: out-of-order epoch (incoming=${epoch.observedAt} < last=${last.observedAt}); ledger is append-only`,
      );
    }
  }
  return Object.freeze({ epochs: Object.freeze([...ledger.epochs, epoch]) });
}

/** Empty starting ledger. */
export function emptyLedger(): GovernanceLedger {
  return Object.freeze({ epochs: Object.freeze([]) });
}

// ---------------------------------------------------------------------------
// TARGET 2 — Drift Trajectory Detection
// ---------------------------------------------------------------------------

export const DRIFT_TRAJECTORY_TAGS = [
  "increasing-override-normalization",
  "rising-ambiguity-persistence",
  "replay-fragility-concentration",
  "repeated-degradation-domains",
  "chronic-recovery-instability",
  "confidence-erosion-acceleration",
] as const;
export type DriftTrajectoryTag = (typeof DRIFT_TRAJECTORY_TAGS)[number];

export interface DriftTrajectoryFinding {
  readonly tag: DriftTrajectoryTag;
  /** Severity 0..100; ≥ 60 is the CI warn threshold; ≥ 80 is fail. */
  readonly severity: number;
  /** Window length (epochs) the finding was derived from. */
  readonly windowEpochs: number;
  /** Human-readable explanation. */
  readonly description: string;
}

/**
 * Linear trend slope on a numeric series — positive = increasing.
 * Returns slope per epoch index. Empty/single-element returns 0.
 */
function slope(series: readonly number[]): number {
  const n = series.length;
  if (n < 2) return 0;
  const xs = Array.from({ length: n }, (_, i) => i);
  const meanX = (n - 1) / 2;
  const meanY = series.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const x = xs[i] as number;
    const y = series[i] as number;
    num += (x - meanX) * (y - meanY);
    den += (x - meanX) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

const CONFIDENCE_NUMERIC: Readonly<Record<GovernanceEpoch["aggregateVerificationConfidence"], number>> =
  Object.freeze({
    VERIFIED: 100,
    "PARTIALLY-VERIFIED": 70,
    ASSUMED: 50,
    UNVERIFIED: 20,
    UNKNOWN: 0,
  });

/**
 * Derive drift trajectory findings from a ledger window.
 *
 * windowEpochs: number of most-recent epochs to consider (default 12).
 * Empty window → zero findings.
 */
export function detectDriftTrajectories(
  ledger: GovernanceLedger,
  windowEpochs: number = 12,
): readonly DriftTrajectoryFinding[] {
  const window = ledger.epochs.slice(-windowEpochs);
  if (window.length < 2) return [];

  const findings: DriftTrajectoryFinding[] = [];

  // 1. Increasing override normalization
  const overrideSlope = slope(window.map((e) => e.activeOverrideCount + e.expiredOverrideCount));
  if (overrideSlope > 0.25) {
    findings.push({
      tag: "increasing-override-normalization",
      severity: clamp(40 + overrideSlope * 30, 0, 100),
      windowEpochs: window.length,
      description: `override volume slope ${overrideSlope.toFixed(2)}/epoch over ${window.length} epochs — normalization risk`,
    });
  }

  // 2. Rising ambiguity persistence
  const ambigSlope = slope(window.map((e) => e.replayAmbiguousCount));
  if (ambigSlope > 0.5) {
    findings.push({
      tag: "rising-ambiguity-persistence",
      severity: clamp(35 + ambigSlope * 20, 0, 100),
      windowEpochs: window.length,
      description: `R-AMBIGUOUS observation count rising ${ambigSlope.toFixed(2)}/epoch — operator may be ignoring ambiguity`,
    });
  }

  // 3. Replay fragility concentration (collapsed > 0 in ≥ 30% of epochs)
  const collapsedEpochs = window.filter((e) => e.replayCollapsedCount > 0).length;
  if (collapsedEpochs / window.length >= 0.3) {
    findings.push({
      tag: "replay-fragility-concentration",
      severity: clamp(50 + (collapsedEpochs / window.length) * 50, 0, 100),
      windowEpochs: window.length,
      description: `R-COLLAPSED observed in ${collapsedEpochs}/${window.length} epochs — replay fragility recurring`,
    });
  }

  // 4. Repeated degradation domains (any single domain degraded in ≥ 50% of epochs)
  const domainHits = new Map<string, number>();
  for (const e of window) {
    for (const [domain, count] of Object.entries(e.degradedDomainTallies)) {
      if ((count ?? 0) > 0) domainHits.set(domain, (domainHits.get(domain) ?? 0) + 1);
    }
  }
  for (const [domain, hits] of domainHits) {
    if (hits / window.length >= 0.5) {
      findings.push({
        tag: "repeated-degradation-domains",
        severity: clamp(40 + (hits / window.length) * 40, 0, 100),
        windowEpochs: window.length,
        description: `domain '${domain}' degraded in ${hits}/${window.length} epochs — chronic`,
      });
    }
  }

  // 5. Chronic recovery instability — failure rate > 25% across attempts
  const totalAttempts = window.reduce((a, e) => a + e.recoveryAttemptCount, 0);
  const totalFailures = window.reduce((a, e) => a + e.recoveryFailureCount, 0);
  if (totalAttempts > 0 && totalFailures / totalAttempts > 0.25) {
    findings.push({
      tag: "chronic-recovery-instability",
      severity: clamp(40 + (totalFailures / totalAttempts) * 60, 0, 100),
      windowEpochs: window.length,
      description: `recovery failure rate ${(totalFailures / totalAttempts * 100).toFixed(0)}% across ${totalAttempts} attempts`,
    });
  }

  // 6. Confidence erosion acceleration — slope on numeric confidence < 0
  const confSeries = window.map((e) => CONFIDENCE_NUMERIC[e.aggregateVerificationConfidence]);
  const confSlope = slope(confSeries);
  if (confSlope < -1.5) {
    findings.push({
      tag: "confidence-erosion-acceleration",
      severity: clamp(50 + Math.abs(confSlope) * 10, 0, 100),
      windowEpochs: window.length,
      description: `verification confidence eroding ${confSlope.toFixed(2)}/epoch — accelerating loss`,
    });
  }

  return findings;
}

// ---------------------------------------------------------------------------
// TARGET 3 — Governance Fatigue Semantics
// ---------------------------------------------------------------------------

export const FATIGUE_SEVERITY = ["CALM", "ELEVATED", "CHRONIC", "CRITICAL"] as const;
export type FatigueSeverity = (typeof FATIGUE_SEVERITY)[number];

export interface FatigueMetrics {
  /** Composite fatigue score 0..100. */
  readonly score: number;
  readonly severity: FatigueSeverity;
  /** Individual contributors (transparent — no black-box scoring). */
  readonly contributors: {
    readonly overrideRepetition: number; // 0..30
    readonly exceptionGrowth: number; // 0..20
    readonly recurringSuppression: number; // 0..20
    readonly degradedStateRecurrence: number; // 0..15
    readonly unresolvedAmbiguityAge: number; // 0..15
  };
  /** Domains showing chronic instability (degraded in ≥ 50% of window). */
  readonly chronicallyUnstableDomains: readonly string[];
  /** True if fatigue should propagate forward (score ≥ ELEVATED threshold). */
  readonly propagateForward: boolean;
}

export function deriveFatigueMetrics(
  ledger: GovernanceLedger,
  windowEpochs: number = 12,
): FatigueMetrics {
  const window = ledger.epochs.slice(-windowEpochs);
  if (window.length === 0) {
    return Object.freeze({
      score: 0,
      severity: "CALM" as FatigueSeverity,
      contributors: Object.freeze({
        overrideRepetition: 0,
        exceptionGrowth: 0,
        recurringSuppression: 0,
        degradedStateRecurrence: 0,
        unresolvedAmbiguityAge: 0,
      }),
      chronicallyUnstableDomains: Object.freeze([]),
      propagateForward: false,
    });
  }

  // Override repetition — sum of active overrides normalised by window length, capped at 30
  const totalActive = window.reduce((a, e) => a + e.activeOverrideCount, 0);
  const overrideRepetition = clamp((totalActive / window.length) * 5, 0, 30);

  // Exception growth — slope on activeOverrideCount, scaled
  const expSlope = slope(window.map((e) => e.activeOverrideCount));
  const exceptionGrowth = clamp(Math.max(0, expSlope) * 8, 0, 20);

  // Recurring suppression — count of epochs with overRenewedOverrideCount > 0
  const overRenewedEpochs = window.filter((e) => e.overRenewedOverrideCount > 0).length;
  const recurringSuppression = clamp((overRenewedEpochs / window.length) * 20, 0, 20);

  // Degraded state recurrence — fraction of epochs with any degradation
  const degradedEpochs = window.filter(
    (e) => e.integrityDegradedCount + e.containmentDegradedCount > 0,
  ).length;
  const degradedStateRecurrence = clamp((degradedEpochs / window.length) * 15, 0, 15);

  // Unresolved ambiguity age — count of consecutive trailing epochs with replayAmbiguousCount > 0
  let trailing = 0;
  for (let i = window.length - 1; i >= 0; i--) {
    const e = window[i];
    if (e && e.replayAmbiguousCount > 0) trailing++;
    else break;
  }
  const unresolvedAmbiguityAge = clamp(trailing * 1.5, 0, 15);

  const score =
    overrideRepetition +
    exceptionGrowth +
    recurringSuppression +
    degradedStateRecurrence +
    unresolvedAmbiguityAge;

  let severity: FatigueSeverity = "CALM";
  if (score >= 75) severity = "CRITICAL";
  else if (score >= 50) severity = "CHRONIC";
  else if (score >= 25) severity = "ELEVATED";

  const domainHits = new Map<string, number>();
  for (const e of window) {
    for (const [domain, count] of Object.entries(e.degradedDomainTallies)) {
      if ((count ?? 0) > 0) domainHits.set(domain, (domainHits.get(domain) ?? 0) + 1);
    }
  }
  const chronicallyUnstableDomains: string[] = [];
  for (const [domain, hits] of domainHits) {
    if (hits / window.length >= 0.5) chronicallyUnstableDomains.push(domain);
  }

  return Object.freeze({
    score,
    severity,
    contributors: Object.freeze({
      overrideRepetition,
      exceptionGrowth,
      recurringSuppression,
      degradedStateRecurrence,
      unresolvedAmbiguityAge,
    }),
    chronicallyUnstableDomains: Object.freeze(chronicallyUnstableDomains),
    propagateForward: score >= 25,
  });
}

// ---------------------------------------------------------------------------
// TARGET 4 — Historical Trust Weighting
// ---------------------------------------------------------------------------

export interface HistoricalTrustModifier {
  /** Multiplier applied to recovery confidence — < 1 reduces. */
  readonly recoveryConfidenceMultiplier: number;
  /** Multiplier applied to override-trust legitimacy — < 1 reduces. */
  readonly overrideTrustMultiplier: number;
  /** Penalty applied to verification confidence (subtracted from numeric score). */
  readonly verificationConfidencePenalty: number;
  /** Forward-propagating instability score 0..100. */
  readonly forwardInstabilityScore: number;
  /** Brief reason strings explaining each modifier. */
  readonly reasons: readonly string[];
}

/**
 * Derive historical trust modifiers from the ledger.
 *
 * Repeated relapses, chronic overrides, and recurring ambiguity all REDUCE
 * forward trust (multiplier < 1, penalty > 0). No isolated-event-only
 * reasoning — modifiers always reflect history.
 */
export function deriveHistoricalTrustModifier(
  ledger: GovernanceLedger,
  windowEpochs: number = 12,
): HistoricalTrustModifier {
  const window = ledger.epochs.slice(-windowEpochs);
  const reasons: string[] = [];

  if (window.length === 0) {
    return Object.freeze({
      recoveryConfidenceMultiplier: 1,
      overrideTrustMultiplier: 1,
      verificationConfidencePenalty: 0,
      forwardInstabilityScore: 0,
      reasons: Object.freeze(["empty ledger — no historical adjustment"]),
    });
  }

  // Recovery: failure rate caps multiplier
  const totalAttempts = window.reduce((a, e) => a + e.recoveryAttemptCount, 0);
  const totalFailures = window.reduce((a, e) => a + e.recoveryFailureCount, 0);
  const recoveryFailureRate = totalAttempts > 0 ? totalFailures / totalAttempts : 0;
  const recoveryConfidenceMultiplier = clamp(1 - recoveryFailureRate * 0.7, 0.2, 1);
  if (recoveryFailureRate > 0) {
    reasons.push(
      `recovery failure rate ${(recoveryFailureRate * 100).toFixed(0)}% over ${totalAttempts} attempts → recovery multiplier ${recoveryConfidenceMultiplier.toFixed(2)}`,
    );
  }

  // Override trust: chronic-override fraction reduces legitimacy
  const overRenewedEpochs = window.filter((e) => e.overRenewedOverrideCount > 0).length;
  const overrideTrustMultiplier = clamp(1 - (overRenewedEpochs / window.length) * 0.6, 0.3, 1);
  if (overRenewedEpochs > 0) {
    reasons.push(
      `OVER-RENEWED overrides observed in ${overRenewedEpochs}/${window.length} epochs → override-trust multiplier ${overrideTrustMultiplier.toFixed(2)}`,
    );
  }

  // Verification confidence penalty: persistent ambiguity reduces it
  const ambigEpochs = window.filter((e) => e.replayAmbiguousCount > 0).length;
  const verificationConfidencePenalty = clamp((ambigEpochs / window.length) * 25, 0, 25);
  if (ambigEpochs > 0) {
    reasons.push(
      `R-AMBIGUOUS observations in ${ambigEpochs}/${window.length} epochs → verification confidence penalty −${verificationConfidencePenalty.toFixed(0)}`,
    );
  }

  // Forward instability: combined score
  const fatigue = deriveFatigueMetrics(ledger, windowEpochs);
  const forwardInstabilityScore = clamp(
    fatigue.score * 0.6 +
      recoveryFailureRate * 30 +
      (overRenewedEpochs / window.length) * 10,
    0,
    100,
  );
  reasons.push(
    `forward instability ${forwardInstabilityScore.toFixed(0)} = fatigue×0.6 + recovery + override-renewal`,
  );

  return Object.freeze({
    recoveryConfidenceMultiplier,
    overrideTrustMultiplier,
    verificationConfidencePenalty,
    forwardInstabilityScore,
    reasons: Object.freeze(reasons),
  });
}

// ---------------------------------------------------------------------------
// TARGET 7 — Institutional Drift CI Gate report
// ---------------------------------------------------------------------------

export interface InstitutionalDriftReport {
  readonly executedAt: string;
  readonly epochsObserved: number;
  readonly windowEpochs: number;
  readonly driftFindings: readonly DriftTrajectoryFinding[];
  readonly fatigue: FatigueMetrics;
  readonly historicalTrustModifier: HistoricalTrustModifier;
  /** True if any finding ≥ warnThreshold (default 60). */
  readonly hasCiWarning: boolean;
  /** True if any finding ≥ failThreshold (default 80) OR fatigue CRITICAL. */
  readonly hasCiFailure: boolean;
}

export interface DriftReportOptions {
  readonly windowEpochs?: number;
  readonly warnThresholdSeverity?: number;
  readonly failThresholdSeverity?: number;
}

export function buildInstitutionalDriftReport(
  ledger: GovernanceLedger,
  nowIso: string,
  opts: DriftReportOptions = {},
): InstitutionalDriftReport {
  const windowEpochs = opts.windowEpochs ?? 12;
  const warnThreshold = opts.warnThresholdSeverity ?? 60;
  const failThreshold = opts.failThresholdSeverity ?? 80;

  const driftFindings = detectDriftTrajectories(ledger, windowEpochs);
  const fatigue = deriveFatigueMetrics(ledger, windowEpochs);
  const historicalTrustModifier = deriveHistoricalTrustModifier(ledger, windowEpochs);

  const hasWarn = driftFindings.some((f) => f.severity >= warnThreshold);
  const hasFail =
    driftFindings.some((f) => f.severity >= failThreshold) || fatigue.severity === "CRITICAL";

  return Object.freeze({
    executedAt: nowIso,
    epochsObserved: ledger.epochs.length,
    windowEpochs,
    driftFindings,
    fatigue,
    historicalTrustModifier,
    hasCiWarning: hasWarn,
    hasCiFailure: hasFail,
  });
}
