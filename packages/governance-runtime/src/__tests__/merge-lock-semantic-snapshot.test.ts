/**
 * W2-PR158A — Constitutional Runtime Merge Lock (Semantic Snapshot).
 *
 * Verification of semantic-snapshot merge-lock primitives:
 *   - buildSemanticSnapshot — structure, state-set completeness
 *   - diffSemanticSnapshots — all SemanticMutation types + severity classification
 *   - maxEvolutionSeverity — strict ordering
 *   - EVOLUTION_SEVERITY vocabulary (5 levels)
 *
 * Per W2-PR25A: state removal is BREAKING, transition addition is CRITICAL,
 * evidence relaxation is CRITICAL, trust-class inflation is HIGH-RISK.
 *
 * Doctrine: W2-PR25A (semantic evolution), docs/ops/constitutional-enforcement-matrix.md
 */

import { describe, expect, it } from "vitest";

import {
  buildSemanticSnapshot,
  diffSemanticSnapshots,
  maxEvolutionSeverity,
  EVOLUTION_SEVERITY,
} from "../semantic-snapshot.js";

import {
  INTEGRITY_STATES,
  CONTAINMENT_STATES,
  REPLAY_STATES,
} from "../index.js";

// ─── 1. EVOLUTION_SEVERITY vocabulary ────────────────────────────────────────

describe("W2-PR158A — EVOLUTION_SEVERITY vocabulary", () => {
  it("contains exactly 5 levels", () => {
    expect(EVOLUTION_SEVERITY).toHaveLength(5);
  });

  it("contains SAFE", () => expect(EVOLUTION_SEVERITY).toContain("SAFE"));
  it("contains CAUTION", () => expect(EVOLUTION_SEVERITY).toContain("CAUTION"));
  it("contains HIGH-RISK", () => expect(EVOLUTION_SEVERITY).toContain("HIGH-RISK"));
  it("contains CRITICAL", () => expect(EVOLUTION_SEVERITY).toContain("CRITICAL"));
  it("contains BREAKING", () => expect(EVOLUTION_SEVERITY).toContain("BREAKING"));
});

// ─── 2. buildSemanticSnapshot — structure ────────────────────────────────────

describe("W2-PR158A — buildSemanticSnapshot structure", () => {
  const SNAP_TS = "2026-01-01T00:00:00Z";
  const snap = buildSemanticSnapshot(SNAP_TS);

  it("returns version 1", () => {
    expect(snap.version).toBe(1);
  });

  it("capturedAt is the passed ISO string", () => {
    expect(snap.capturedAt).toBe(SNAP_TS);
  });

  it("stateSets.integrity matches INTEGRITY_STATES", () => {
    expect(snap.stateSets.integrity).toEqual([...INTEGRITY_STATES]);
  });

  it("stateSets.containment matches CONTAINMENT_STATES", () => {
    expect(snap.stateSets.containment).toEqual([...CONTAINMENT_STATES]);
  });

  it("stateSets.replay matches REPLAY_STATES", () => {
    expect(snap.stateSets.replay).toEqual([...REPLAY_STATES]);
  });

  it("stateSets.replay contains R-AMBIGUOUS", () => {
    expect(snap.stateSets.replay).toContain("R-AMBIGUOUS");
  });

  it("trustClasses is non-empty", () => {
    expect(snap.trustClasses.length).toBeGreaterThan(0);
  });

  it("transitions.replay is non-empty", () => {
    expect(snap.transitions.replay.length).toBeGreaterThan(0);
  });

  it("two calls with same timestamp produce identical stateSets", () => {
    const s1 = buildSemanticSnapshot(SNAP_TS);
    const s2 = buildSemanticSnapshot(SNAP_TS);
    expect(JSON.stringify(s1.stateSets)).toBe(JSON.stringify(s2.stateSets));
  });

  it("overrideRules.maxRenewals is a positive number", () => {
    expect(snap.overrideRules.maxRenewals).toBeGreaterThan(0);
  });

  it("overrideRules.maxDurationMs is a positive number", () => {
    expect(snap.overrideRules.maxDurationMs).toBeGreaterThan(0);
  });
});

// ─── 3. diffSemanticSnapshots — identical → zero mutations ───────────────────

describe("W2-PR158A — diffSemanticSnapshots: identical snapshots", () => {
  const base = buildSemanticSnapshot("2026-01-01T00:00:00Z");

  it("diffing a snapshot against itself → no mutations", () => {
    expect(diffSemanticSnapshots(base, base)).toHaveLength(0);
  });

  it("diffing two snapshots built from same registry → no mutations", () => {
    const s1 = buildSemanticSnapshot("2026-01-01T00:00:00Z");
    const s2 = buildSemanticSnapshot("2026-01-02T00:00:00Z");
    expect(diffSemanticSnapshots(s1, s2)).toHaveLength(0);
  });
});

// ─── 4. diffSemanticSnapshots — state-removed (BREAKING) ─────────────────────

describe("W2-PR158A — state-removed is BREAKING severity", () => {
  it("removing a replay state → state-removed mutation with BREAKING severity", () => {
    const prev = buildSemanticSnapshot("2026-01-01T00:00:00Z");
    const mutated = {
      ...prev,
      stateSets: {
        ...prev.stateSets,
        replay: prev.stateSets.replay.filter((s) => s !== "R-AMBIGUOUS"),
      },
    };
    const mutations = diffSemanticSnapshots(prev, mutated);
    const removed = mutations.filter((m) => m.tag === "state-removed");
    expect(removed.length).toBeGreaterThan(0);
    expect(removed.every((m) => m.severity === "BREAKING")).toBe(true);
  });

  it("removing an integrity state → state-removed mutation", () => {
    const prev = buildSemanticSnapshot("2026-01-01T00:00:00Z");
    const mutated = {
      ...prev,
      stateSets: {
        ...prev.stateSets,
        integrity: prev.stateSets.integrity.filter((s) => s !== "CI-GREEN"),
      },
    };
    const mutations = diffSemanticSnapshots(prev, mutated);
    expect(mutations.some((m) => m.tag === "state-removed")).toBe(true);
  });

  it("removing R-AMBIGUOUS specifically is BREAKING", () => {
    const prev = buildSemanticSnapshot("2026-01-01T00:00:00Z");
    const mutated = {
      ...prev,
      stateSets: {
        ...prev.stateSets,
        replay: prev.stateSets.replay.filter((s) => s !== "R-AMBIGUOUS"),
      },
    };
    const mutations = diffSemanticSnapshots(prev, mutated);
    const ambigRemoved = mutations.find(
      (m) => m.tag === "state-removed" && m.axis === "replay" && m.state === "R-AMBIGUOUS"
    );
    expect(ambigRemoved).toBeDefined();
    expect(ambigRemoved?.severity).toBe("BREAKING");
  });
});

// ─── 5. diffSemanticSnapshots — state-added (CAUTION) ────────────────────────

describe("W2-PR158A — state-added is CAUTION severity", () => {
  it("adding a replay state → state-added with CAUTION severity", () => {
    const prev = buildSemanticSnapshot("2026-01-01T00:00:00Z");
    const mutated = {
      ...prev,
      stateSets: {
        ...prev.stateSets,
        replay: [...prev.stateSets.replay, "R-PHANTOM"],
      },
    };
    const mutations = diffSemanticSnapshots(prev, mutated);
    const added = mutations.filter((m) => m.tag === "state-added");
    expect(added.length).toBeGreaterThan(0);
    expect(added.every((m) => m.severity === "CAUTION")).toBe(true);
  });
});

// ─── 6. diffSemanticSnapshots — transition-removed (HIGH-RISK) ────────────────

describe("W2-PR158A — transition-removed is HIGH-RISK severity", () => {
  it("removing a replay transition → transition-removed with HIGH-RISK severity", () => {
    const prev = buildSemanticSnapshot("2026-01-01T00:00:00Z");
    const mutated = {
      ...prev,
      transitions: {
        ...prev.transitions,
        replay: prev.transitions.replay.slice(1), // drop first transition
      },
    };
    const mutations = diffSemanticSnapshots(prev, mutated);
    const removed = mutations.filter((m) => m.tag === "transition-removed");
    expect(removed.length).toBeGreaterThan(0);
    expect(removed.every((m) => m.severity === "HIGH-RISK")).toBe(true);
  });
});

// ─── 7. diffSemanticSnapshots — transition-added (CRITICAL) ──────────────────

describe("W2-PR158A — transition-added is CRITICAL severity", () => {
  it("adding a replay transition → transition-added with CRITICAL severity", () => {
    const prev = buildSemanticSnapshot("2026-01-01T00:00:00Z");
    const phantom = { from: "R-OBSERVED", to: "R-PHANTOM", evidenceRequired: null };
    const mutated = {
      ...prev,
      transitions: {
        ...prev.transitions,
        replay: [...prev.transitions.replay, phantom],
      },
    };
    const mutations = diffSemanticSnapshots(prev, mutated);
    const added = mutations.filter((m) => m.tag === "transition-added");
    expect(added.length).toBeGreaterThan(0);
    expect(added.every((m) => m.severity === "CRITICAL")).toBe(true);
  });
});

// ─── 8. diffSemanticSnapshots — evidence-relaxed (CRITICAL) ──────────────────

describe("W2-PR158A — transition-evidence-relaxed is CRITICAL severity", () => {
  it("relaxing evidenceRequired from a string to null → transition-evidence-relaxed CRITICAL", () => {
    const prev = buildSemanticSnapshot("2026-01-01T00:00:00Z");
    // Find a transition that requires evidence (non-null evidenceRequired)
    const withEvidence = prev.transitions.replay.find((t) => t.evidenceRequired !== null);
    if (!withEvidence) return; // Skip if none (unlikely)
    const relaxed = { ...withEvidence, evidenceRequired: null };
    const mutated = {
      ...prev,
      transitions: {
        ...prev.transitions,
        replay: prev.transitions.replay.map((t) =>
          t.from === withEvidence.from && t.to === withEvidence.to ? relaxed : t
        ),
      },
    };
    const mutations = diffSemanticSnapshots(prev, mutated);
    // Evidence relaxed: the prev edge has evidenceRequired; current does not → evidence-relaxed
    const evidenceRelaxed = mutations.filter((m) => m.tag === "transition-evidence-relaxed");
    expect(evidenceRelaxed.length).toBeGreaterThan(0);
    expect(evidenceRelaxed.every((m) => m.severity === "CRITICAL")).toBe(true);
  });
});

// ─── 9. maxEvolutionSeverity ──────────────────────────────────────────────────

// maxEvolutionSeverity takes ReadonlyArray<SemanticMutation>; helper constructs mutations.
import type { SemanticMutation } from "../semantic-snapshot.js";

function fakeMutation(severity: import("../semantic-snapshot.js").EvolutionSeverity): SemanticMutation {
  return { tag: "state-removed", axis: "replay", state: "R-TEST", severity };
}

describe("W2-PR158A — maxEvolutionSeverity ordering", () => {
  it("BREAKING beats CRITICAL", () => {
    expect(maxEvolutionSeverity([fakeMutation("CRITICAL"), fakeMutation("BREAKING")])).toBe("BREAKING");
  });

  it("CRITICAL beats HIGH-RISK", () => {
    expect(maxEvolutionSeverity([fakeMutation("HIGH-RISK"), fakeMutation("CRITICAL")])).toBe("CRITICAL");
  });

  it("HIGH-RISK beats CAUTION", () => {
    expect(maxEvolutionSeverity([fakeMutation("CAUTION"), fakeMutation("HIGH-RISK")])).toBe("HIGH-RISK");
  });

  it("CAUTION beats SAFE", () => {
    expect(maxEvolutionSeverity([fakeMutation("SAFE"), fakeMutation("CAUTION")])).toBe("CAUTION");
  });

  it("single-element array returns that element (SAFE)", () => {
    expect(maxEvolutionSeverity([fakeMutation("SAFE")])).toBe("SAFE");
  });

  it("single-element array returns that element (BREAKING)", () => {
    expect(maxEvolutionSeverity([fakeMutation("BREAKING")])).toBe("BREAKING");
  });

  it("all levels present → BREAKING wins", () => {
    const all = (["SAFE", "CAUTION", "HIGH-RISK", "CRITICAL", "BREAKING"] as const).map(fakeMutation);
    expect(maxEvolutionSeverity(all)).toBe("BREAKING");
  });

  it("state-removed mutation produces BREAKING in diff + max", () => {
    const prev = buildSemanticSnapshot("2026-01-01T00:00:00Z");
    const mutated = {
      ...prev,
      stateSets: {
        ...prev.stateSets,
        replay: prev.stateSets.replay.slice(0, -1),
      },
    };
    const mutations = diffSemanticSnapshots(prev, mutated);
    expect(maxEvolutionSeverity(mutations)).toBe("BREAKING");
  });
});

// ─── 10. maxRenewals / maxDuration relaxation ────────────────────────────────

describe("W2-PR158A — override-rules relaxation detection", () => {
  it("increasing maxRenewals → max-renewal-relaxed CRITICAL mutation", () => {
    const prev = buildSemanticSnapshot("2026-01-01T00:00:00Z");
    const mutated = {
      ...prev,
      overrideRules: {
        ...prev.overrideRules,
        maxRenewals: prev.overrideRules.maxRenewals + 1,
      },
    };
    const mutations = diffSemanticSnapshots(prev, mutated);
    const relaxed = mutations.filter((m) => m.tag === "max-renewal-relaxed");
    expect(relaxed.length).toBe(1);
    expect(relaxed[0]?.severity).toBe("CRITICAL");
  });

  it("increasing maxDurationMs → max-duration-relaxed CRITICAL mutation", () => {
    const prev = buildSemanticSnapshot("2026-01-01T00:00:00Z");
    const mutated = {
      ...prev,
      overrideRules: {
        ...prev.overrideRules,
        maxDurationMs: prev.overrideRules.maxDurationMs + 1000,
      },
    };
    const mutations = diffSemanticSnapshots(prev, mutated);
    const relaxed = mutations.filter((m) => m.tag === "max-duration-relaxed");
    expect(relaxed.length).toBe(1);
    expect(relaxed[0]?.severity).toBe("CRITICAL");
  });

  it("reducing maxRenewals → no max-renewal-relaxed (tightening is safe)", () => {
    const prev = buildSemanticSnapshot("2026-01-01T00:00:00Z");
    const mutated = {
      ...prev,
      overrideRules: {
        ...prev.overrideRules,
        maxRenewals: Math.max(0, prev.overrideRules.maxRenewals - 1),
      },
    };
    const mutations = diffSemanticSnapshots(prev, mutated);
    expect(mutations.some((m) => m.tag === "max-renewal-relaxed")).toBe(false);
  });
});
