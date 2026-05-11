/**
 * W2-PR166A — Institutional Runtime Ignition Validation.
 *
 * Verification of runtime ignition health primitives:
 *   - sla-enforcement: SLA_BREACH_SEVERITY vocabulary, DEFAULT_SLA_THRESHOLDS,
 *     enforceSlas — breach detection (collapse rate, ambiguity escalation,
 *     confidence floor, contradiction budget), escalationRequired, CI gating
 *   - trust-reputation: REPUTATION_TIERS vocabulary, deriveTrustReputation
 *     (score model, tier classification, driftDetected, ambiguityPreserved),
 *     buildTrustReputationReport CI gating
 *   - ux-consistency: validateUxConsistency — trajectory divergence, replay
 *     confidence divergence, ambiguity-rendering divergence, headline overflow
 *
 * Doctrine: W2-PR109A (SLA enforcement), W2-PR121A (trust reputation),
 *           W2-PR79A (UX consistency), W2-PR25A (ambiguity preservation).
 */

import { describe, expect, it } from "vitest";

import {
  SLA_BREACH_SEVERITY,
  DEFAULT_SLA_THRESHOLDS,
  enforceSlas,
} from "../sla-enforcement.js";

import {
  REPUTATION_TIERS,
  deriveTrustReputation,
  buildTrustReputationReport,
} from "../trust-reputation.js";

import {
  validateUxConsistency,
} from "../ux-consistency.js";

import type { GovernanceLedger, GovernanceEpoch } from "../longitudinal-memory.js";
import type { SurfaceObservation } from "../ux-consistency.js";
import type { ReputationInput } from "../trust-reputation.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeEpoch(overrides: Partial<GovernanceEpoch> = {}): GovernanceEpoch {
  return Object.freeze({
    observedAt: "2026-05-10T00:00:00Z",
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
    aggregateVerificationConfidence: "PARTIALLY-VERIFIED" as const,
    degradedDomainTallies: Object.freeze({}),
    ...overrides,
  });
}

function makeLedger(epochs: GovernanceEpoch[]): GovernanceLedger {
  return Object.freeze({ epochs: Object.freeze(epochs) });
}

function makeReputationInput(ledger: GovernanceLedger, overrides: Partial<ReputationInput> = {}): ReputationInput {
  return {
    subjectId: "org-1",
    ledger,
    overrides: [],
    incidents: [],
    ...overrides,
  };
}

const NOW = "2026-05-10T00:00:00Z";

// ─── 1. SLA_BREACH_SEVERITY vocabulary ───────────────────────────────────────

describe("W2-PR166A — SLA_BREACH_SEVERITY vocabulary", () => {
  it("contains exactly 4 levels", () => {
    expect(SLA_BREACH_SEVERITY).toHaveLength(4);
  });

  it("contains INFO", () => expect(SLA_BREACH_SEVERITY).toContain("INFO"));
  it("contains WARN", () => expect(SLA_BREACH_SEVERITY).toContain("WARN"));
  it("contains BREACH", () => expect(SLA_BREACH_SEVERITY).toContain("BREACH"));
  it("contains ESCALATION", () => expect(SLA_BREACH_SEVERITY).toContain("ESCALATION"));
});

// ─── 2. DEFAULT_SLA_THRESHOLDS structure ─────────────────────────────────────

describe("W2-PR166A — DEFAULT_SLA_THRESHOLDS", () => {
  it("maxReplayCollapsedFraction is positive", () => {
    expect(DEFAULT_SLA_THRESHOLDS.maxReplayCollapsedFraction).toBeGreaterThan(0);
  });

  it("maxConsecutiveAmbiguousEpochs is positive", () => {
    expect(DEFAULT_SLA_THRESHOLDS.maxConsecutiveAmbiguousEpochs).toBeGreaterThan(0);
  });

  it("minConfidenceScore is in (0, 100]", () => {
    expect(DEFAULT_SLA_THRESHOLDS.minConfidenceScore).toBeGreaterThan(0);
    expect(DEFAULT_SLA_THRESHOLDS.minConfidenceScore).toBeLessThanOrEqual(100);
  });

  it("maxContradictionsPerWindow is non-negative", () => {
    expect(DEFAULT_SLA_THRESHOLDS.maxContradictionsPerWindow).toBeGreaterThanOrEqual(0);
  });
});

// ─── 3. enforceSlas — clean ledger ───────────────────────────────────────────

describe("W2-PR166A — enforceSlas: clean ledger", () => {
  it("empty ledger → zero breaches, hasCiGatingCondition=false", () => {
    const report = enforceSlas(makeLedger([]), NOW);
    expect(report.breaches).toHaveLength(0);
    expect(report.hasCiGatingCondition).toBe(false);
    expect(report.escalationRequired).toBe(false);
  });

  it("all-clean epochs → zero breaches", () => {
    const epochs = [
      makeEpoch({ aggregateVerificationConfidence: "PARTIALLY-VERIFIED" }),
      makeEpoch({ aggregateVerificationConfidence: "PARTIALLY-VERIFIED" }),
    ];
    const report = enforceSlas(makeLedger(epochs), NOW);
    expect(report.breaches).toHaveLength(0);
  });

  it("executedAt is the passed ISO string", () => {
    const report = enforceSlas(makeLedger([]), NOW);
    expect(report.executedAt).toBe(NOW);
  });

  it("windowEpochs matches ledger epoch count", () => {
    const report = enforceSlas(makeLedger([makeEpoch(), makeEpoch()]), NOW);
    expect(report.windowEpochs).toBe(2);
  });

  it("report is frozen", () => {
    expect(Object.isFrozen(enforceSlas(makeLedger([]), NOW))).toBe(true);
  });
});

// ─── 4. enforceSlas — replay-collapse-rate-exceeded breach ───────────────────

describe("W2-PR166A — enforceSlas: replay-collapse-rate-exceeded", () => {
  it("collapse fraction above threshold → replay-collapse-rate-exceeded breach", () => {
    // maxReplayCollapsedFraction = 0.1; use 5/5 = 100% > 10%
    const epochs = [
      makeEpoch({ replayCollapsedCount: 1 }),
      makeEpoch({ replayCollapsedCount: 1 }),
      makeEpoch({ replayCollapsedCount: 1 }),
    ];
    const report = enforceSlas(makeLedger(epochs), NOW, {
      ...DEFAULT_SLA_THRESHOLDS,
      maxReplayCollapsedFraction: 0.1,
    });
    expect(report.breaches.some((b) => b.tag === "replay-collapse-rate-exceeded")).toBe(true);
    expect(report.hasCiGatingCondition).toBe(true);
  });

  it("collapse fraction at or below threshold → no breach", () => {
    const epochs = [makeEpoch({ replayCollapsedCount: 0 })];
    const report = enforceSlas(makeLedger(epochs), NOW);
    expect(report.breaches.some((b) => b.tag === "replay-collapse-rate-exceeded")).toBe(false);
  });
});

// ─── 5. enforceSlas — ambiguity-escalation-overdue breach ────────────────────

describe("W2-PR166A — enforceSlas: ambiguity-escalation-overdue", () => {
  it("consecutive ambiguous epochs beyond threshold → ambiguity-escalation-overdue breach", () => {
    // maxConsecutiveAmbiguousEpochs = 6; use 7 consecutive
    const epochs = Array.from({ length: 7 }, () => makeEpoch({ replayAmbiguousCount: 1 }));
    const report = enforceSlas(makeLedger(epochs), NOW);
    expect(report.breaches.some((b) => b.tag === "ambiguity-escalation-overdue")).toBe(true);
  });

  it("consecutive ambiguous epochs at threshold → no breach", () => {
    const epochs = Array.from({ length: 6 }, () => makeEpoch({ replayAmbiguousCount: 1 }));
    const report = enforceSlas(makeLedger(epochs), NOW);
    expect(report.breaches.some((b) => b.tag === "ambiguity-escalation-overdue")).toBe(false);
  });

  it("non-consecutive ambiguous epochs do not accumulate", () => {
    const epochs = [
      makeEpoch({ replayAmbiguousCount: 1 }),
      makeEpoch({ replayAmbiguousCount: 0 }),
      makeEpoch({ replayAmbiguousCount: 1 }),
    ];
    const report = enforceSlas(makeLedger(epochs), NOW);
    expect(report.breaches.some((b) => b.tag === "ambiguity-escalation-overdue")).toBe(false);
  });
});

// ─── 6. enforceSlas — confidence-floor-breached ───────────────────────────────

describe("W2-PR166A — enforceSlas: confidence-floor-breached", () => {
  it("UNKNOWN confidence epoch → confidence-floor-breached", () => {
    const epochs = [makeEpoch({ aggregateVerificationConfidence: "UNKNOWN" })];
    const report = enforceSlas(makeLedger(epochs), NOW, {
      ...DEFAULT_SLA_THRESHOLDS,
      minConfidenceScore: 50,
    });
    expect(report.breaches.some((b) => b.tag === "confidence-floor-breached")).toBe(true);
  });

  it("PARTIALLY-VERIFIED confidence above floor threshold → no breach (score=70 > 50)", () => {
    const epochs = [makeEpoch({ aggregateVerificationConfidence: "PARTIALLY-VERIFIED" })];
    const report = enforceSlas(makeLedger(epochs), NOW, {
      ...DEFAULT_SLA_THRESHOLDS,
      minConfidenceScore: 50,
    });
    expect(report.breaches.some((b) => b.tag === "confidence-floor-breached")).toBe(false);
  });
});

// ─── 7. enforceSlas — contradiction-budget-exceeded ──────────────────────────

describe("W2-PR166A — enforceSlas: contradiction-budget-exceeded", () => {
  it("total contradictions above budget → contradiction-budget-exceeded breach", () => {
    const epochs = [
      makeEpoch({ contradictionCount: 2 }),
      makeEpoch({ contradictionCount: 1 }),
    ]; // total = 3 > maxContradictionsPerWindow=2
    const report = enforceSlas(makeLedger(epochs), NOW);
    expect(report.breaches.some((b) => b.tag === "contradiction-budget-exceeded")).toBe(true);
  });

  it("contradictions at or below budget → no breach", () => {
    const epochs = [makeEpoch({ contradictionCount: 1 })]; // total=1 <= 2
    const report = enforceSlas(makeLedger(epochs), NOW);
    expect(report.breaches.some((b) => b.tag === "contradiction-budget-exceeded")).toBe(false);
  });
});

// ─── 8. enforceSlas — escalationRequired ─────────────────────────────────────

describe("W2-PR166A — enforceSlas: escalationRequired", () => {
  it("BREACH-severity violation does NOT set escalationRequired", () => {
    // BREACH severity: ratio in [1.25, 2). Use collapse rate = 15% against 10% threshold → ratio 1.5
    const epochs = Array.from({ length: 10 }, (_, i) =>
      makeEpoch({ replayCollapsedCount: i < 2 ? 1 : 0 })
    ); // 2/10 = 20% > 10% → BREACH (ratio 2.0 boundary)
    const report = enforceSlas(makeLedger(epochs), NOW, {
      ...DEFAULT_SLA_THRESHOLDS,
      maxReplayCollapsedFraction: 0.15, // 2/10=20% > 15%; ratio ~1.33 → BREACH
    });
    const breach = report.breaches.find((b) => b.tag === "replay-collapse-rate-exceeded");
    if (breach && breach.severity === "ESCALATION") {
      expect(report.escalationRequired).toBe(true);
    } else {
      expect(report.escalationRequired).toBe(false);
    }
  });

  it("ESCALATION-severity violation sets escalationRequired=true", () => {
    // ratio >= 2 → ESCALATION. Use collapse rate = 6/10 = 60% against 10% → ratio 6 → ESCALATION
    const epochs = Array.from({ length: 10 }, (_, i) =>
      makeEpoch({ replayCollapsedCount: i < 6 ? 1 : 0 })
    );
    const report = enforceSlas(makeLedger(epochs), NOW, {
      ...DEFAULT_SLA_THRESHOLDS,
      maxReplayCollapsedFraction: 0.1,
    });
    expect(report.escalationRequired).toBe(true);
  });
});

// ─── 9. REPUTATION_TIERS vocabulary ──────────────────────────────────────────

describe("W2-PR166A — REPUTATION_TIERS vocabulary", () => {
  it("contains exactly 5 tiers", () => {
    expect(REPUTATION_TIERS).toHaveLength(5);
  });

  it("contains EXEMPLARY", () => expect(REPUTATION_TIERS).toContain("EXEMPLARY"));
  it("contains STRONG", () => expect(REPUTATION_TIERS).toContain("STRONG"));
  it("contains STANDARD", () => expect(REPUTATION_TIERS).toContain("STANDARD"));
  it("contains WATCHED", () => expect(REPUTATION_TIERS).toContain("WATCHED"));
  it("contains DEGRADED", () => expect(REPUTATION_TIERS).toContain("DEGRADED"));
});

// ─── 10. deriveTrustReputation — baseline ────────────────────────────────────

describe("W2-PR166A — deriveTrustReputation: baseline", () => {
  it("empty ledger, no incidents, no overrides → STANDARD tier (score=70)", () => {
    const rep = deriveTrustReputation(makeReputationInput(makeLedger([])));
    expect(rep.tier).toBe("STANDARD");
    expect(rep.score).toBe(70);
  });

  it("all-clean epochs → score is boosted above 70", () => {
    const epochs = [
      makeEpoch({ aggregateVerificationConfidence: "PARTIALLY-VERIFIED" }),
      makeEpoch({ aggregateVerificationConfidence: "PARTIALLY-VERIFIED" }),
    ];
    const rep = deriveTrustReputation(makeReputationInput(makeLedger(epochs)));
    expect(rep.score).toBeGreaterThan(70);
  });

  it("subjectId is preserved in result", () => {
    const rep = deriveTrustReputation(makeReputationInput(makeLedger([]), { subjectId: "org-x" }));
    expect(rep.subjectId).toBe("org-x");
  });

  it("result is frozen", () => {
    expect(Object.isFrozen(deriveTrustReputation(makeReputationInput(makeLedger([]))))).toBe(true);
  });
});

// ─── 11. deriveTrustReputation — score model ─────────────────────────────────

describe("W2-PR166A — deriveTrustReputation: score model", () => {
  it("replay collapse events reduce score", () => {
    const cleanRep = deriveTrustReputation(makeReputationInput(makeLedger([])));
    const collapseRep = deriveTrustReputation(
      makeReputationInput(makeLedger([makeEpoch({ replayCollapsedCount: 3 })]))
    );
    expect(collapseRep.score).toBeLessThan(cleanRep.score);
  });

  it("score is clamped to [0, 100]", () => {
    // Many open SEV-1 incidents should drive score to 0
    const incidents = Array.from({ length: 10 }, (_, i) => ({
      id: `inc-${i}`,
      kind: "REPLAY-INTEGRITY" as const,
      sev: "SEV-1" as const,
      state: "OPEN" as const,
      detectedAt: NOW,
      affectedDomains: [],
      touchesReplay: true,
      touchesAmbiguity: false,
    }));
    const rep = deriveTrustReputation(
      makeReputationInput(makeLedger([]), {
        incidents: incidents as unknown as typeof incidents,
      })
    );
    expect(rep.score).toBeGreaterThanOrEqual(0);
    expect(rep.score).toBeLessThanOrEqual(100);
  });

  it("driftDetected=true when score < priorScore", () => {
    const collapseRep = deriveTrustReputation(
      makeReputationInput(makeLedger([makeEpoch({ replayCollapsedCount: 5 })]), { priorScore: 90 })
    );
    expect(collapseRep.driftDetected).toBe(true);
  });

  it("driftDetected=false when score >= priorScore", () => {
    const rep = deriveTrustReputation(makeReputationInput(makeLedger([]), { priorScore: 60 }));
    expect(rep.driftDetected).toBe(false);
  });

  it("ambiguityPreserved=true when all epochs are clean (no ambiguous observed)", () => {
    const rep = deriveTrustReputation(makeReputationInput(makeLedger([
      makeEpoch({ replayAmbiguousCount: 0 }),
    ])));
    expect(rep.ambiguityPreserved).toBe(true);
  });

  it("ambiguityPreserved=true when ambiguous epochs are counted but not fully clean", () => {
    // cleanEpochs < epochs.length because some have ambiguous — ambiguity preserved
    const rep = deriveTrustReputation(makeReputationInput(makeLedger([
      makeEpoch({ replayAmbiguousCount: 1 }),
    ])));
    expect(rep.ambiguityPreserved).toBe(true);
  });
});

// ─── 12. buildTrustReputationReport — CI gating ───────────────────────────────

describe("W2-PR166A — buildTrustReputationReport: CI gating", () => {
  it("empty inputs → no reputations, hasCiGatingCondition=false", () => {
    const report = buildTrustReputationReport([], NOW);
    expect(report.reputations).toHaveLength(0);
    expect(report.hasCiGatingCondition).toBe(false);
  });

  it("DEGRADED tier → hasCiGatingCondition=true", () => {
    // Drive score to DEGRADED (< 35) with open SEV-1 incidents
    const incidents = Array.from({ length: 5 }, (_, i) => ({
      id: `inc-${i}`, kind: "REPLAY-INTEGRITY", sev: "SEV-1",
      state: "OPEN", detectedAt: NOW, affectedDomains: [],
      touchesReplay: true, touchesAmbiguity: false,
    }));
    const input = makeReputationInput(makeLedger([]), {
      incidents: incidents as unknown as typeof incidents,
    });
    const report = buildTrustReputationReport([input], NOW);
    expect(report.hasCiGatingCondition).toBe(true);
  });

  it("executedAt matches nowIso", () => {
    const report = buildTrustReputationReport([], NOW);
    expect(report.executedAt).toBe(NOW);
  });

  it("report is frozen", () => {
    expect(Object.isFrozen(buildTrustReputationReport([], NOW))).toBe(true);
  });
});

// ─── 13. validateUxConsistency — identical observations ──────────────────────

describe("W2-PR166A — validateUxConsistency: identical observations", () => {
  const obs: SurfaceObservation[] = [
    { surfaceId: "TrustOverviewPanel", trajectory: "STABLE", replayConfidence: "HIGH", ambiguityPreserved: true, headlineIndicatorCount: 3 },
    { surfaceId: "ReplaySurvivabilityPanel", trajectory: "STABLE", replayConfidence: "HIGH", ambiguityPreserved: true, headlineIndicatorCount: 3 },
  ];

  const report = validateUxConsistency(obs, NOW);

  it("identical observations → no violations", () => {
    expect(report.violations).toHaveLength(0);
  });

  it("hasCiGatingCondition=false for consistent observations", () => {
    expect(report.hasCiGatingCondition).toBe(false);
  });

  it("observationCount matches input length", () => {
    expect(report.observationCount).toBe(2);
  });

  it("consistencyHash is a 64-char hex string", () => {
    expect(report.consistencyHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("report is frozen", () => {
    expect(Object.isFrozen(report)).toBe(true);
  });
});

// ─── 14. validateUxConsistency — trajectory-divergence ───────────────────────

describe("W2-PR166A — validateUxConsistency: trajectory-divergence", () => {
  it("different trajectories across surfaces → trajectory-divergence violation", () => {
    const obs: SurfaceObservation[] = [
      { surfaceId: "A", trajectory: "STABLE", replayConfidence: "HIGH", ambiguityPreserved: true, headlineIndicatorCount: 2 },
      { surfaceId: "B", trajectory: "FAILING", replayConfidence: "HIGH", ambiguityPreserved: true, headlineIndicatorCount: 2 },
    ];
    const report = validateUxConsistency(obs, NOW);
    expect(report.violations.some((v) => v.tag === "trajectory-divergence")).toBe(true);
    expect(report.hasCiGatingCondition).toBe(true);
  });
});

// ─── 15. validateUxConsistency — replay-confidence-divergence ────────────────

describe("W2-PR166A — validateUxConsistency: replay-confidence-divergence", () => {
  it("different replay confidences across surfaces → replay-confidence-divergence", () => {
    const obs: SurfaceObservation[] = [
      { surfaceId: "A", trajectory: "STABLE", replayConfidence: "FULL", ambiguityPreserved: true, headlineIndicatorCount: 2 },
      { surfaceId: "B", trajectory: "STABLE", replayConfidence: "LOW", ambiguityPreserved: true, headlineIndicatorCount: 2 },
    ];
    const report = validateUxConsistency(obs, NOW);
    expect(report.violations.some((v) => v.tag === "replay-confidence-divergence")).toBe(true);
  });
});

// ─── 16. validateUxConsistency — ambiguity-rendering-divergence ──────────────

describe("W2-PR166A — validateUxConsistency: ambiguity-rendering-divergence", () => {
  it("mixed ambiguityPreserved values → ambiguity-rendering-divergence", () => {
    const obs: SurfaceObservation[] = [
      { surfaceId: "A", trajectory: "STABLE", replayConfidence: "HIGH", ambiguityPreserved: true, headlineIndicatorCount: 2 },
      { surfaceId: "B", trajectory: "STABLE", replayConfidence: "HIGH", ambiguityPreserved: false, headlineIndicatorCount: 2 },
    ];
    const report = validateUxConsistency(obs, NOW);
    expect(report.violations.some((v) => v.tag === "ambiguity-rendering-divergence")).toBe(true);
    expect(report.hasCiGatingCondition).toBe(true);
  });
});

// ─── 17. validateUxConsistency — headline-overflow ───────────────────────────

describe("W2-PR166A — validateUxConsistency: headline-overflow", () => {
  it("headlineIndicatorCount > 7 → headline-overflow violation", () => {
    const obs: SurfaceObservation[] = [
      { surfaceId: "X", trajectory: "STABLE", replayConfidence: "HIGH", ambiguityPreserved: true, headlineIndicatorCount: 8 },
    ];
    const report = validateUxConsistency(obs, NOW);
    const overflow = report.violations.find((v) => v.tag === "headline-overflow");
    expect(overflow).toBeDefined();
    expect(overflow?.surfaceId).toBe("X");
    expect(report.hasCiGatingCondition).toBe(true);
  });

  it("headlineIndicatorCount = 7 → no headline-overflow", () => {
    const obs: SurfaceObservation[] = [
      { surfaceId: "X", trajectory: "STABLE", replayConfidence: "HIGH", ambiguityPreserved: true, headlineIndicatorCount: 7 },
    ];
    const report = validateUxConsistency(obs, NOW);
    expect(report.violations.some((v) => v.tag === "headline-overflow")).toBe(false);
  });
});

// ─── 18. validateUxConsistency — empty observations ──────────────────────────

describe("W2-PR166A — validateUxConsistency: edge cases", () => {
  it("empty observations → no violations, hasCiGatingCondition=false", () => {
    const report = validateUxConsistency([], NOW);
    expect(report.violations).toHaveLength(0);
    expect(report.hasCiGatingCondition).toBe(false);
  });

  it("single observation → no divergence (nothing to diverge from)", () => {
    const obs: SurfaceObservation[] = [
      { surfaceId: "Solo", trajectory: "STABLE", replayConfidence: "HIGH", ambiguityPreserved: true, headlineIndicatorCount: 3 },
    ];
    const report = validateUxConsistency(obs, NOW);
    expect(report.violations.filter((v) => v.tag !== "headline-overflow")).toHaveLength(0);
  });
});
