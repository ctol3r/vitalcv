/**
 * W2-PR73A — Replay-cognitive compression tests + cognitive chaos.
 */

import { describe, expect, it } from "vitest";

import {
  appendEpoch,
  emptyLedger,
  type GovernanceEpoch,
  type GovernanceLedger,
} from "../longitudinal-memory.js";
import { buildReplaySurvivabilityReport } from "../replay-survivability.js";
import {
  buildOperatorReplayDigest,
  buildReplayCognitionReport,
  REPLAY_ABSTRACTION_LEVELS,
  validateOperatorReplayDigest,
  type OperatorReplayDigest,
} from "../replay-cognition.js";

function epoch(o: Partial<GovernanceEpoch> & { observedAt: string }): GovernanceEpoch {
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
    ...o,
  };
}
function iso(h: number): string {
  return new Date(Date.parse("2026-05-09T00:00:00Z") + h * 3600 * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
}
function buildLedger(eps: GovernanceEpoch[]): GovernanceLedger {
  return eps.reduce((l, e) => appendEpoch(l, e), emptyLedger());
}

describe("W2-PR73A — abstraction levels", () => {
  it("REPLAY_ABSTRACTION_LEVELS has 4 levels", () => {
    expect(REPLAY_ABSTRACTION_LEVELS.length).toBe(4);
    expect(REPLAY_ABSTRACTION_LEVELS).toEqual(["HEADLINE", "SUMMARY", "DETAIL", "RAW"]);
  });
});

describe("W2-PR73A — digest builds + cognitive load progression", () => {
  it("HEADLINE returns exactly 1 indicator", () => {
    const eps = Array.from({ length: 3 }).map((_, i) => epoch({ observedAt: iso(i), replayAmbiguousCount: 1 }));
    const src = buildReplaySurvivabilityReport(buildLedger(eps), iso(4));
    const d = buildOperatorReplayDigest(src, "HEADLINE");
    expect(d.indicators.length).toBe(1);
    expect(d.indicators[0]).toMatch(/replay/i);
  });

  it("SUMMARY caps at 7 indicators", () => {
    const eps = Array.from({ length: 8 }).map((_, i) => epoch({ observedAt: iso(i), replayAmbiguousCount: 1 }));
    const src = buildReplaySurvivabilityReport(buildLedger(eps), iso(9));
    const d = buildOperatorReplayDigest(src, "SUMMARY");
    expect(d.indicators.length).toBeLessThanOrEqual(7);
  });

  it("cognitive load grows monotonically by level (HEADLINE < SUMMARY < DETAIL ≤ RAW)", () => {
    const eps = Array.from({ length: 5 }).map((_, i) => epoch({ observedAt: iso(i), replayAmbiguousCount: 1 }));
    const src = buildReplaySurvivabilityReport(buildLedger(eps), iso(6));
    const h = buildOperatorReplayDigest(src, "HEADLINE");
    const s = buildOperatorReplayDigest(src, "SUMMARY");
    const d = buildOperatorReplayDigest(src, "DETAIL");
    const r = buildOperatorReplayDigest(src, "RAW");
    expect(h.cognitiveLoadScore).toBeLessThan(s.cognitiveLoadScore);
    expect(s.cognitiveLoadScore).toBeLessThan(d.cognitiveLoadScore);
    expect(d.cognitiveLoadScore).toBeLessThanOrEqual(r.cognitiveLoadScore);
  });

  it("digestHash is deterministic", () => {
    const eps = [epoch({ observedAt: iso(0), replayAmbiguousCount: 1 })];
    const src = buildReplaySurvivabilityReport(buildLedger(eps), iso(1));
    const a = buildOperatorReplayDigest(src, "SUMMARY");
    const b = buildOperatorReplayDigest(src, "SUMMARY");
    expect(a.digestHash).toBe(b.digestHash);
  });
});

describe("W2-PR73A — validators (cognitive contract)", () => {
  it("clean digest at every level passes validation", () => {
    const eps = Array.from({ length: 3 }).map((_, i) => epoch({ observedAt: iso(i), replayAmbiguousCount: 1 }));
    const src = buildReplaySurvivabilityReport(buildLedger(eps), iso(4));
    for (const level of REPLAY_ABSTRACTION_LEVELS) {
      const d = buildOperatorReplayDigest(src, level);
      expect(validateOperatorReplayDigest(d, src)).toEqual([]);
    }
  });

  it("forged ambiguityPreserved=false on a true source ⇒ ambiguity-elided", () => {
    const eps = [epoch({ observedAt: iso(0), replayAmbiguousCount: 5 })];
    const src = buildReplaySurvivabilityReport(buildLedger(eps), iso(1));
    const d = buildOperatorReplayDigest(src, "HEADLINE");
    const tampered: OperatorReplayDigest = { ...d, ambiguityPreserved: false };
    const v = validateOperatorReplayDigest(tampered, src);
    expect(v.some((x) => x.tag === "ambiguity-elided")).toBe(true);
  });

  it("indicator overflow detected when count > cap", () => {
    const eps = [epoch({ observedAt: iso(0), replayAmbiguousCount: 1 })];
    const src = buildReplaySurvivabilityReport(buildLedger(eps), iso(1));
    const d = buildOperatorReplayDigest(src, "SUMMARY");
    const overflowing: OperatorReplayDigest = {
      ...d,
      indicators: [...d.indicators, "x", "y", "z", "a", "b", "c", "d", "e"],
    };
    const v = validateOperatorReplayDigest(overflowing, src);
    expect(v.some((x) => x.tag === "indicator-overflow")).toBe(true);
  });

  it("digest hash tampering is detected", () => {
    const eps = [epoch({ observedAt: iso(0), replayAmbiguousCount: 1 })];
    const src = buildReplaySurvivabilityReport(buildLedger(eps), iso(1));
    const d = buildOperatorReplayDigest(src, "DETAIL");
    const tampered: OperatorReplayDigest = { ...d, digestHash: "0".repeat(64) };
    const v = validateOperatorReplayDigest(tampered, src);
    expect(v.some((x) => x.tag === "digest-hash-mismatch")).toBe(true);
  });

  it("lineage severance (sourceScore stripped) detected", () => {
    const eps = [epoch({ observedAt: iso(0), replayAmbiguousCount: 1 })];
    const src = buildReplaySurvivabilityReport(buildLedger(eps), iso(1));
    const d = buildOperatorReplayDigest(src, "SUMMARY");
    const tampered: OperatorReplayDigest = { ...d, sourceScore: 999 };
    const v = validateOperatorReplayDigest(tampered, src);
    expect(v.some((x) => x.tag === "lineage-severed")).toBe(true);
  });
});

describe("W2-PR73A — TARGET 6: cognitive chaos", () => {
  it("CHAOS: UNRECONSTRUCTABLE source surfaces in HEADLINE indicator", () => {
    const eps = Array.from({ length: 12 }).map((_, i) => epoch({ observedAt: iso(i) }));
    const src = buildReplaySurvivabilityReport(buildLedger(eps), iso(13));
    const d = buildOperatorReplayDigest(src, "HEADLINE");
    expect(d.sourceConfidence).toBe("UNRECONSTRUCTABLE");
    // HEADLINE must mention UNRECONSTRUCTABLE so operator can't miss it
    expect(d.indicators[0]!.toUpperCase()).toContain("UNRECONSTRUCTABLE");
  });

  it("CHAOS: SUMMARY of UNRECONSTRUCTABLE source still surfaces it", () => {
    const eps = Array.from({ length: 12 }).map((_, i) => epoch({ observedAt: iso(i) }));
    const src = buildReplaySurvivabilityReport(buildLedger(eps), iso(13));
    const d = buildOperatorReplayDigest(src, "SUMMARY");
    expect(d.indicators.some((i) => i.toUpperCase().includes("UNRECONSTRUCTABLE"))).toBe(true);
  });

  it("CHAOS: empty replay window does not crash; produces low-load HEADLINE", () => {
    const src = buildReplaySurvivabilityReport(emptyLedger(), iso(0));
    const d = buildOperatorReplayDigest(src, "HEADLINE");
    expect(d.indicators.length).toBe(1);
    expect(d.cognitiveLoadScore).toBeLessThan(50);
  });

  it("CHAOS: CI gate clean on healthy source", () => {
    const eps = Array.from({ length: 3 }).map((_, i) => epoch({ observedAt: iso(i), replayAmbiguousCount: 1 }));
    const src = buildReplaySurvivabilityReport(buildLedger(eps), iso(4));
    const r = buildReplayCognitionReport(src, "SUMMARY", iso(4));
    expect(r.hasCiGatingCondition).toBe(false);
  });
});
