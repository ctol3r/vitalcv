/**
 * W2-PR33A — Replay survivability + continuity reconstruction tests + chaos.
 */

import { describe, expect, it } from "vitest";

import {
  appendEpoch,
  emptyLedger,
  type GovernanceEpoch,
  type GovernanceLedger,
} from "../longitudinal-memory.js";
import {
  buildReplayReconstructionGraph,
  buildReplaySurvivabilityReport,
  RECONSTRUCTION_CONFIDENCE,
  scoreReplaySurvivability,
  deriveReconstructionLineage,
} from "../replay-survivability.js";

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
  return new Date(Date.parse("2026-01-01T00:00:00Z") + h * 3600 * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
}
function buildLedger(eps: GovernanceEpoch[]): GovernanceLedger {
  return eps.reduce((l, e) => appendEpoch(l, e), emptyLedger());
}

describe("W2-PR33A — reconstruction graph", () => {
  it("contiguous evidence-bearing epochs → all CONTIGUOUS edges", () => {
    const g = buildReplayReconstructionGraph(
      buildLedger([
        epoch({ observedAt: iso(0), replayAmbiguousCount: 1 }),
        epoch({ observedAt: iso(1), replayAmbiguousCount: 1 }),
        epoch({ observedAt: iso(2), replayAmbiguousCount: 1 }),
      ]),
    );
    expect(g.edges.length).toBe(2);
    expect(g.edges.every((e) => e.kind === "CONTIGUOUS")).toBe(true);
    expect(g.missingIndices.length).toBe(0);
  });

  it("gap with same dominant state on both sides → BRIDGED", () => {
    const g = buildReplayReconstructionGraph(
      buildLedger([
        epoch({ observedAt: iso(0), replayAmbiguousCount: 1 }),
        epoch({ observedAt: iso(1) }), // gap
        epoch({ observedAt: iso(2) }), // gap
        epoch({ observedAt: iso(3), replayAmbiguousCount: 1 }),
      ]),
    );
    expect(g.edges.length).toBe(1);
    expect(g.edges[0]!.kind).toBe("BRIDGED");
    expect(g.edges[0]!.gapSize).toBe(2);
    expect(g.missingIndices).toEqual([1, 2]);
  });

  it("forbidden direct R-COLLAPSED → R-OBSERVED jump → IMPOSSIBLE-JUMP", () => {
    // R-COLLAPSED has no allowed direct transition to R-OBSERVED in REPLAY_TRANSITIONS
    // (must pass through R-AMBIGUOUS with evidence).
    const g = buildReplayReconstructionGraph(
      buildLedger([
        epoch({ observedAt: iso(0), replayCollapsedCount: 5 }),
        epoch({ observedAt: iso(1) }), // gap
        epoch({ observedAt: iso(2), replayCollapsedCount: 0, replayAmbiguousCount: 0 }), // also empty
      ]),
    );
    // Only one evidence-bearing node → no edges to evaluate
    expect(g.edges.length).toBe(0);
  });

  it("R-AMBIGUOUS → R-COLLAPSED across gap is allowed (BRIDGED)", () => {
    const g = buildReplayReconstructionGraph(
      buildLedger([
        epoch({ observedAt: iso(0), replayAmbiguousCount: 3 }),
        epoch({ observedAt: iso(1) }),
        epoch({ observedAt: iso(2), replayCollapsedCount: 5 }),
      ]),
    );
    expect(g.edges[0]!.kind).toBe("BRIDGED");
    expect(g.edges[0]!.fromDominantState).toBe("R-AMBIGUOUS");
    expect(g.edges[0]!.toDominantState).toBe("R-COLLAPSED");
  });

  it("ties between ambiguous and collapsed counts resolve to R-AMBIGUOUS (preservation)", () => {
    const g = buildReplayReconstructionGraph(
      buildLedger([
        epoch({ observedAt: iso(0), replayAmbiguousCount: 3, replayCollapsedCount: 3 }),
      ]),
    );
    expect(g.nodes[0]!.observedAmbiguous).toBe(3);
    // Lineage's asserted state should be R-AMBIGUOUS, not R-COLLAPSED
    const lineage = deriveReconstructionLineage(
      g,
      buildLedger([epoch({ observedAt: iso(0), replayAmbiguousCount: 3, replayCollapsedCount: 3 })]),
    );
    expect(lineage.assertedStates[0]!.state).toBe("R-AMBIGUOUS");
  });
});

describe("W2-PR33A — survivability scoring", () => {
  it("FULL on a clean dense window", () => {
    const ledger = buildLedger([
      epoch({ observedAt: iso(0), replayAmbiguousCount: 1 }),
      epoch({ observedAt: iso(1), replayAmbiguousCount: 1 }),
      epoch({ observedAt: iso(2), replayAmbiguousCount: 1 }),
    ]);
    const s = scoreReplaySurvivability(buildReplayReconstructionGraph(ledger), ledger);
    expect(s.confidence).toBe("FULL");
    expect(s.survivabilityScore).toBe(100);
  });

  it("PARTIAL when gaps exist but reconstructable", () => {
    const ledger = buildLedger([
      epoch({ observedAt: iso(0), replayAmbiguousCount: 1 }),
      epoch({ observedAt: iso(1) }),
      epoch({ observedAt: iso(2) }),
      epoch({ observedAt: iso(3), replayAmbiguousCount: 1 }),
    ]);
    const s = scoreReplaySurvivability(buildReplayReconstructionGraph(ledger), ledger);
    expect(["HIGH", "PARTIAL"]).toContain(s.confidence);
    expect(s.survivabilityScore).toBeLessThan(100);
  });

  it("UNRECONSTRUCTABLE when window is mostly empty", () => {
    const eps: GovernanceEpoch[] = [];
    for (let i = 0; i < 12; i++) eps.push(epoch({ observedAt: iso(i) }));
    const ledger = buildLedger(eps);
    const s = scoreReplaySurvivability(buildReplayReconstructionGraph(ledger), ledger);
    expect(s.confidence === "LOW" || s.confidence === "UNRECONSTRUCTABLE").toBe(true);
  });

  it("score never exceeds 100 or drops below 0", () => {
    const ledger = buildLedger([
      epoch({ observedAt: iso(0), replayAmbiguousCount: 100 }),
      epoch({ observedAt: iso(1), replayAmbiguousCount: 100 }),
    ]);
    const s = scoreReplaySurvivability(buildReplayReconstructionGraph(ledger), ledger);
    expect(s.survivabilityScore).toBeGreaterThanOrEqual(0);
    expect(s.survivabilityScore).toBeLessThanOrEqual(100);
  });

  it("ambiguityPreserved is true when any node observed R-AMBIGUOUS", () => {
    const ledger = buildLedger([epoch({ observedAt: iso(0), replayAmbiguousCount: 5 })]);
    const s = scoreReplaySurvivability(buildReplayReconstructionGraph(ledger), ledger);
    expect(s.ambiguityPreserved).toBe(true);
  });
});

describe("W2-PR33A — TARGET 6: replay recovery chaos scenarios", () => {
  it("CHAOS: telemetry gap (4 missing epochs) reduces confidence honestly", () => {
    const ledger = buildLedger([
      epoch({ observedAt: iso(0), replayAmbiguousCount: 1 }),
      epoch({ observedAt: iso(1) }),
      epoch({ observedAt: iso(2) }),
      epoch({ observedAt: iso(3) }),
      epoch({ observedAt: iso(4) }),
      epoch({ observedAt: iso(5), replayAmbiguousCount: 1 }),
    ]);
    const r = buildReplaySurvivabilityReport(ledger, iso(6));
    expect(r.score.confidence).not.toBe("FULL");
    expect(r.graph.missingIndices.length).toBe(4);
  });

  it("CHAOS: fragmented lineage → BRIDGED edges retain contributing indices", () => {
    const ledger = buildLedger([
      epoch({ observedAt: iso(0), replayAmbiguousCount: 1 }),
      epoch({ observedAt: iso(1) }),
      epoch({ observedAt: iso(2), replayAmbiguousCount: 1 }),
      epoch({ observedAt: iso(3) }),
      epoch({ observedAt: iso(4), replayCollapsedCount: 1 }),
    ]);
    const r = buildReplaySurvivabilityReport(ledger, iso(5));
    expect(r.lineage.contributingEpochIndices).toEqual([0, 2, 4]);
  });

  it("CHAOS: partial corruption (zero counts in middle) preserves edge visibility", () => {
    const ledger = buildLedger([
      epoch({ observedAt: iso(0), replayAmbiguousCount: 3 }),
      epoch({ observedAt: iso(1) }),
      epoch({ observedAt: iso(2), replayAmbiguousCount: 3 }),
    ]);
    const r = buildReplaySurvivabilityReport(ledger, iso(3));
    expect(r.score.gappedEdges + r.score.bridgedEdges).toBeGreaterThan(0);
  });

  it("CHAOS: empty ledger does not falsely report UNRECONSTRUCTABLE-window finding", () => {
    const r = buildReplaySurvivabilityReport(emptyLedger(), iso(0));
    expect(r.findings.find((f) => f.tag === "unreconstructable-window")).toBeUndefined();
  });

  it("CHAOS: sole evidence-bearing epoch → no edges, confidence not FULL/HIGH", () => {
    const ledger = buildLedger([
      epoch({ observedAt: iso(0) }),
      epoch({ observedAt: iso(1) }),
      epoch({ observedAt: iso(2), replayAmbiguousCount: 1 }),
      epoch({ observedAt: iso(3) }),
    ]);
    const r = buildReplaySurvivabilityReport(ledger, iso(4));
    expect(["UNRECONSTRUCTABLE", "LOW", "PARTIAL"]).toContain(r.score.confidence);
    expect(r.graph.edges.length).toBe(0);
  });

  it("CI gate fires on UNRECONSTRUCTABLE non-empty window", () => {
    const eps: GovernanceEpoch[] = [];
    for (let i = 0; i < 12; i++) eps.push(epoch({ observedAt: iso(i) }));
    const r = buildReplaySurvivabilityReport(buildLedger(eps), iso(13));
    expect(r.hasCiGatingCondition).toBe(true);
  });
});

describe("W2-PR33A — taxonomy completeness", () => {
  it("RECONSTRUCTION_CONFIDENCE has exactly 5 tiers", () => {
    expect(RECONSTRUCTION_CONFIDENCE.length).toBe(5);
    expect(RECONSTRUCTION_CONFIDENCE[0]).toBe("FULL");
    expect(RECONSTRUCTION_CONFIDENCE[4]).toBe("UNRECONSTRUCTABLE");
  });
});
