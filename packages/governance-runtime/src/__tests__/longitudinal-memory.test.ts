/**
 * W2-PR30A — Longitudinal governance memory + multi-epoch chaos simulations.
 */

import { describe, expect, it } from "vitest";

import {
  appendEpoch,
  buildInstitutionalDriftReport,
  detectDriftTrajectories,
  deriveFatigueMetrics,
  deriveHistoricalTrustModifier,
  emptyLedger,
  type GovernanceEpoch,
  type GovernanceLedger,
} from "../longitudinal-memory.js";

function epoch(overrides: Partial<GovernanceEpoch> & { observedAt: string }): GovernanceEpoch {
  return {
    activeOverrideCount: 0,
    expiredOverrideCount: 0,
    overRenewedOverrideCount: 0,
    replayAmbiguousCount: 0,
    replayCollapsedCount: 0,
    integrityDegradedCount: 0,
    containmentDegradedCount: 0,
    recoveryAttemptCount: 0,
    recoveryFailureCount: 0,
    contradictionCount: 0,
    aggregateVerificationConfidence: "VERIFIED",
    degradedDomainTallies: {},
    ...overrides,
  };
}

function buildLedger(seq: GovernanceEpoch[]): GovernanceLedger {
  return seq.reduce((l, e) => appendEpoch(l, e), emptyLedger());
}

function isoFromHour(h: number): string {
  return new Date(Date.parse("2026-01-01T00:00:00Z") + h * 3600 * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
}

describe("W2-PR30A — TARGET 1: governance memory ledger", () => {
  it("appendEpoch preserves chronological order and is pure", () => {
    const a = epoch({ observedAt: isoFromHour(0) });
    const b = epoch({ observedAt: isoFromHour(1) });
    const ledger0 = emptyLedger();
    const ledger1 = appendEpoch(ledger0, a);
    const ledger2 = appendEpoch(ledger1, b);
    expect(ledger0.epochs.length).toBe(0);
    expect(ledger1.epochs.length).toBe(1);
    expect(ledger2.epochs.length).toBe(2);
    expect(ledger2.epochs[0]).toBe(a);
    expect(ledger2.epochs[1]).toBe(b);
  });

  it("rejects out-of-order appends (preserves historical durability)", () => {
    const ledger = appendEpoch(emptyLedger(), epoch({ observedAt: isoFromHour(5) }));
    expect(() =>
      appendEpoch(ledger, epoch({ observedAt: isoFromHour(1) })),
    ).toThrow(/append-only/);
  });

  it("ledger is frozen — direct mutation attempts fail silently or throw", () => {
    const ledger = appendEpoch(emptyLedger(), epoch({ observedAt: isoFromHour(0) }));
    expect(Object.isFrozen(ledger)).toBe(true);
    expect(Object.isFrozen(ledger.epochs)).toBe(true);
  });
});

describe("W2-PR30A — TARGET 2: drift trajectory detection", () => {
  it("detects increasing-override-normalization on rising override count", () => {
    const epochs: GovernanceEpoch[] = Array.from({ length: 12 }).map((_, i) =>
      epoch({
        observedAt: isoFromHour(i),
        activeOverrideCount: 1 + i,
        expiredOverrideCount: i,
      }),
    );
    const findings = detectDriftTrajectories(buildLedger(epochs));
    expect(findings.some((f) => f.tag === "increasing-override-normalization")).toBe(true);
  });

  it("detects rising-ambiguity-persistence on rising R-AMBIGUOUS counts", () => {
    const epochs: GovernanceEpoch[] = Array.from({ length: 12 }).map((_, i) =>
      epoch({ observedAt: isoFromHour(i), replayAmbiguousCount: i * 2 }),
    );
    const findings = detectDriftTrajectories(buildLedger(epochs));
    expect(findings.some((f) => f.tag === "rising-ambiguity-persistence")).toBe(true);
  });

  it("detects replay-fragility-concentration when R-COLLAPSED in ≥30% of epochs", () => {
    const epochs: GovernanceEpoch[] = Array.from({ length: 10 }).map((_, i) =>
      epoch({
        observedAt: isoFromHour(i),
        replayCollapsedCount: i % 2 === 0 ? 1 : 0,
      }),
    );
    const findings = detectDriftTrajectories(buildLedger(epochs));
    expect(findings.some((f) => f.tag === "replay-fragility-concentration")).toBe(true);
  });

  it("detects repeated-degradation-domains for chronic single-domain hits", () => {
    const epochs: GovernanceEpoch[] = Array.from({ length: 10 }).map((_, i) =>
      epoch({
        observedAt: isoFromHour(i),
        degradedDomainTallies: { "containment-state": 1 },
      }),
    );
    const findings = detectDriftTrajectories(buildLedger(epochs));
    const f = findings.find((x) => x.tag === "repeated-degradation-domains");
    expect(f).toBeDefined();
    expect(f!.description).toContain("containment-state");
  });

  it("detects chronic-recovery-instability when failure rate > 25%", () => {
    const epochs: GovernanceEpoch[] = Array.from({ length: 8 }).map((_, i) =>
      epoch({
        observedAt: isoFromHour(i),
        recoveryAttemptCount: 4,
        recoveryFailureCount: 2, // 50% failure
      }),
    );
    const findings = detectDriftTrajectories(buildLedger(epochs));
    expect(findings.some((f) => f.tag === "chronic-recovery-instability")).toBe(true);
  });

  it("detects confidence-erosion-acceleration on declining aggregate confidence", () => {
    const states: GovernanceEpoch["aggregateVerificationConfidence"][] = [
      "VERIFIED",
      "VERIFIED",
      "PARTIALLY-VERIFIED",
      "PARTIALLY-VERIFIED",
      "ASSUMED",
      "ASSUMED",
      "UNVERIFIED",
      "UNVERIFIED",
    ];
    const epochs = states.map((s, i) =>
      epoch({ observedAt: isoFromHour(i), aggregateVerificationConfidence: s }),
    );
    const findings = detectDriftTrajectories(buildLedger(epochs));
    expect(findings.some((f) => f.tag === "confidence-erosion-acceleration")).toBe(true);
  });

  it("returns empty findings for healthy ledger (no false-positives)", () => {
    const epochs = Array.from({ length: 12 }).map((_, i) =>
      epoch({ observedAt: isoFromHour(i) }),
    );
    expect(detectDriftTrajectories(buildLedger(epochs))).toEqual([]);
  });
});

describe("W2-PR30A — TARGET 3: governance fatigue", () => {
  it("returns CALM for empty ledger", () => {
    const m = deriveFatigueMetrics(emptyLedger());
    expect(m.severity).toBe("CALM");
    expect(m.score).toBe(0);
    expect(m.propagateForward).toBe(false);
  });

  it("escalates severity with chronic over-renewals + degradation + ambiguity", () => {
    const epochs = Array.from({ length: 12 }).map((_, i) =>
      epoch({
        observedAt: isoFromHour(i),
        activeOverrideCount: 4,
        overRenewedOverrideCount: 1,
        integrityDegradedCount: 1,
        containmentDegradedCount: 1,
        replayAmbiguousCount: 1,
        degradedDomainTallies: { "containment-state": 1 },
      }),
    );
    const m = deriveFatigueMetrics(buildLedger(epochs));
    expect(m.severity === "CHRONIC" || m.severity === "CRITICAL").toBe(true);
    expect(m.chronicallyUnstableDomains).toContain("containment-state");
    expect(m.propagateForward).toBe(true);
  });

  it("contributors are transparent and bounded by their declared caps", () => {
    const epochs = Array.from({ length: 12 }).map((_, i) =>
      epoch({
        observedAt: isoFromHour(i),
        activeOverrideCount: 100,
        overRenewedOverrideCount: 5,
        integrityDegradedCount: 5,
        replayAmbiguousCount: 5,
      }),
    );
    const m = deriveFatigueMetrics(buildLedger(epochs));
    expect(m.contributors.overrideRepetition).toBeLessThanOrEqual(30);
    expect(m.contributors.exceptionGrowth).toBeLessThanOrEqual(20);
    expect(m.contributors.recurringSuppression).toBeLessThanOrEqual(20);
    expect(m.contributors.degradedStateRecurrence).toBeLessThanOrEqual(15);
    expect(m.contributors.unresolvedAmbiguityAge).toBeLessThanOrEqual(15);
  });
});

describe("W2-PR30A — TARGET 4: historical trust modifiers", () => {
  it("repeated recovery failures reduce recoveryConfidenceMultiplier", () => {
    const epochs = Array.from({ length: 6 }).map((_, i) =>
      epoch({
        observedAt: isoFromHour(i),
        recoveryAttemptCount: 5,
        recoveryFailureCount: 4, // 80% fail
      }),
    );
    const m = deriveHistoricalTrustModifier(buildLedger(epochs));
    expect(m.recoveryConfidenceMultiplier).toBeLessThan(0.6);
    expect(m.reasons.some((r) => r.includes("recovery"))).toBe(true);
  });

  it("chronic over-renewals reduce overrideTrustMultiplier", () => {
    const epochs = Array.from({ length: 8 }).map((_, i) =>
      epoch({ observedAt: isoFromHour(i), overRenewedOverrideCount: 1 }),
    );
    const m = deriveHistoricalTrustModifier(buildLedger(epochs));
    expect(m.overrideTrustMultiplier).toBeLessThan(0.5);
  });

  it("persistent ambiguity adds verificationConfidencePenalty (cap 25)", () => {
    const epochs = Array.from({ length: 8 }).map((_, i) =>
      epoch({ observedAt: isoFromHour(i), replayAmbiguousCount: 3 }),
    );
    const m = deriveHistoricalTrustModifier(buildLedger(epochs));
    expect(m.verificationConfidencePenalty).toBeGreaterThan(20);
    expect(m.verificationConfidencePenalty).toBeLessThanOrEqual(25);
  });

  it("empty ledger returns neutral modifier with explicit reason", () => {
    const m = deriveHistoricalTrustModifier(emptyLedger());
    expect(m.recoveryConfidenceMultiplier).toBe(1);
    expect(m.overrideTrustMultiplier).toBe(1);
    expect(m.verificationConfidencePenalty).toBe(0);
    expect(m.reasons[0]).toContain("empty ledger");
  });
});

describe("W2-PR30A — TARGET 6: longitudinal chaos scenarios", () => {
  it("CHAOS: years of recurring overrides — fatigue escalates above CALM", () => {
    // 24 epochs (synthetic 'years') with rising override pressure
    const epochs = Array.from({ length: 24 }).map((_, i) =>
      epoch({
        observedAt: isoFromHour(i),
        activeOverrideCount: 5 + i,
        expiredOverrideCount: 1,
        overRenewedOverrideCount: i % 3 === 0 ? 1 : 0,
      }),
    );
    const m = deriveFatigueMetrics(buildLedger(epochs));
    expect(["ELEVATED", "CHRONIC", "CRITICAL"]).toContain(m.severity);
    expect(m.propagateForward).toBe(true);
  });

  it("CHAOS: repeated replay instability — fragility surface in drift report", () => {
    const epochs = Array.from({ length: 12 }).map((_, i) =>
      epoch({
        observedAt: isoFromHour(i),
        replayCollapsedCount: 1,
        replayAmbiguousCount: 2,
      }),
    );
    const report = buildInstitutionalDriftReport(buildLedger(epochs), isoFromHour(13));
    expect(report.driftFindings.some((f) => f.tag === "replay-fragility-concentration")).toBe(true);
  });

  it("CHAOS: chronic ambiguity persistence — verification confidence penalty propagates", () => {
    const epochs = Array.from({ length: 12 }).map((_, i) =>
      epoch({ observedAt: isoFromHour(i), replayAmbiguousCount: 1 }),
    );
    const report = buildInstitutionalDriftReport(buildLedger(epochs), isoFromHour(13));
    expect(report.historicalTrustModifier.verificationConfidencePenalty).toBeGreaterThan(0);
  });

  it("CHAOS: repeated failed recoveries — forward instability propagates", () => {
    const epochs = Array.from({ length: 12 }).map((_, i) =>
      epoch({
        observedAt: isoFromHour(i),
        recoveryAttemptCount: 3,
        recoveryFailureCount: 2,
        overRenewedOverrideCount: 1,
      }),
    );
    const m = deriveHistoricalTrustModifier(buildLedger(epochs));
    expect(m.forwardInstabilityScore).toBeGreaterThan(20);
    expect(m.recoveryConfidenceMultiplier).toBeLessThan(1);
    expect(m.overrideTrustMultiplier).toBeLessThan(1);
  });

  it("CHAOS: governance fatigue accumulation — CI gating fires above failThreshold", () => {
    // Construct an extremely degraded ledger
    const epochs = Array.from({ length: 12 }).map((_, i) =>
      epoch({
        observedAt: isoFromHour(i),
        activeOverrideCount: 8,
        overRenewedOverrideCount: 2,
        replayAmbiguousCount: 4,
        replayCollapsedCount: 2,
        integrityDegradedCount: 2,
        containmentDegradedCount: 2,
        recoveryAttemptCount: 4,
        recoveryFailureCount: 3,
        aggregateVerificationConfidence: i < 4 ? "VERIFIED" : i < 8 ? "ASSUMED" : "UNVERIFIED",
        degradedDomainTallies: {
          "containment-state": 1,
          "integrity-state": 1,
          "replay-state": 1,
        },
      }),
    );
    const report = buildInstitutionalDriftReport(buildLedger(epochs), isoFromHour(13));
    expect(report.hasCiWarning).toBe(true);
    expect(report.fatigue.severity === "CHRONIC" || report.fatigue.severity === "CRITICAL").toBe(true);
    expect(report.driftFindings.length).toBeGreaterThan(2);
  });

  it("CHAOS: clean multi-year ledger yields no false drift findings", () => {
    const epochs = Array.from({ length: 24 }).map((_, i) =>
      epoch({ observedAt: isoFromHour(i), aggregateVerificationConfidence: "VERIFIED" }),
    );
    const report = buildInstitutionalDriftReport(buildLedger(epochs), isoFromHour(25));
    expect(report.driftFindings.length).toBe(0);
    expect(report.fatigue.severity).toBe("CALM");
    expect(report.hasCiWarning).toBe(false);
    expect(report.hasCiFailure).toBe(false);
  });

  it("CHAOS: replay fragility history is preserved across appendEpoch (not erased)", () => {
    let ledger = emptyLedger();
    for (let i = 0; i < 5; i++) {
      ledger = appendEpoch(
        ledger,
        epoch({ observedAt: isoFromHour(i), replayCollapsedCount: 1 }),
      );
    }
    // Append 5 clean epochs — history must remain
    for (let i = 5; i < 10; i++) {
      ledger = appendEpoch(ledger, epoch({ observedAt: isoFromHour(i) }));
    }
    expect(ledger.epochs.filter((e) => e.replayCollapsedCount > 0).length).toBe(5);
  });
});
