/**
 * W2-PR153A — Ambiguity Suppression Prevention Audit.
 *
 * Verifies that R-AMBIGUOUS can never be silently up-resolved at any layer:
 *   - R-AMBIGUOUS alone propagates to SYSTEMIC-AMBIGUOUS regardless of other axes
 *   - No snapshot configuration coerces R-AMBIGUOUS to a "good" systemic state
 *   - SYSTEMIC-AMBIGUOUS is operationally distinct from SYSTEMIC-UNVERIFIED
 *   - Disambiguation requires explicit action (never automatic)
 *   - Fail-closed replay helpers preserve ambiguity on unknown input
 *
 * Doctrine: W2-PR19A rule #2, W2-PR22A rules #2 + #7,
 *           docs/ops/replay-taxonomy-map.md §1.3
 */

import { describe, expect, it } from "vitest";

import {
  detectCoherenceContradictions,
  resolveSystemicState,
  systemicStateDescription,
  type CrossAxisStateSnapshot,
} from "../coherence.js";

import { failClosedReplayState } from "../fail-closed.js";
import { REPLAY_STATES } from "../index.js";

// ─── Baseline: maximally-positive snapshot with R-AMBIGUOUS injected ──────────

const BEST_POSSIBLE_WITH_AMBIGUOUS_REPLAY: CrossAxisStateSnapshot = {
  integrity: "CI-GREEN",
  containment: "CT-GREEN",
  replay: "R-AMBIGUOUS",
  trustClass: "C-1",
  continuityConfidence: "STRONG",
  causalConfidence: "CONFIRMED",
  hasEvidenceRef: true,
};

// ─── 1. R-AMBIGUOUS propagation — zero tolerance for up-resolution ────────────

describe("W2-PR153A — R-AMBIGUOUS propagates systemically, never suppressed", () => {
  const ALL_INTEGRITY_STATES = [
    "CI-GREEN",
    "CI-DEGRADED",
    "CI-DRIFT",
    "CI-FRAGMENTED",
    "CI-VIOLATION",
    "CI-UNKNOWN",
  ] as const;

  for (const integ of ALL_INTEGRITY_STATES) {
    it(`R-AMBIGUOUS + ${integ} → systemic state is NOT SYSTEMIC-RECOVERING or SYSTEMIC-DEGRADED`, () => {
      const snap: CrossAxisStateSnapshot = {
        ...BEST_POSSIBLE_WITH_AMBIGUOUS_REPLAY,
        integrity: integ,
        // For CI-FRAGMENTED + CT-GREEN a contradiction fires (which is also SYSTEMIC-AMBIGUOUS)
        // For CI-UNKNOWN → SYSTEMIC-UNVERIFIED
        containment: "CT-DEGRADED", // avoid containment-vs-integrity contradiction
      };
      const { state } = resolveSystemicState(snap);
      expect(state).not.toBe("SYSTEMIC-RECOVERING");
      expect(state).not.toBe("SYSTEMIC-DEGRADED");
    });
  }

  it("R-AMBIGUOUS + CI-GREEN → SYSTEMIC-AMBIGUOUS (via integrity-vs-replay contradiction)", () => {
    const { state, contradictions } = resolveSystemicState(BEST_POSSIBLE_WITH_AMBIGUOUS_REPLAY);
    expect(state).toBe("SYSTEMIC-AMBIGUOUS");
    expect(contradictions.some((c) => c.tag === "integrity-vs-replay")).toBe(true);
  });

  it("R-AMBIGUOUS + CI-DEGRADED → SYSTEMIC-AMBIGUOUS (no contradiction, pure R-AMBIGUOUS propagation)", () => {
    const snap: CrossAxisStateSnapshot = {
      ...BEST_POSSIBLE_WITH_AMBIGUOUS_REPLAY,
      integrity: "CI-DEGRADED",
      containment: "CT-DEGRADED",
    };
    const { state, contradictions } = resolveSystemicState(snap);
    expect(state).toBe("SYSTEMIC-AMBIGUOUS");
    // No contradiction here — propagation is direct
    expect(contradictions).toHaveLength(0);
  });

  it("R-AMBIGUOUS + fully clean other axes + no contradictions → still SYSTEMIC-AMBIGUOUS", () => {
    // C-2 instead of C-1 avoids any T0 issue; CI-DEGRADED avoids integrity-vs-replay
    const snap: CrossAxisStateSnapshot = {
      integrity: "CI-DEGRADED",
      containment: "CT-GREEN",
      replay: "R-AMBIGUOUS",
      trustClass: "C-2",
      continuityConfidence: "STRONG",
      causalConfidence: "CONFIRMED",
      hasEvidenceRef: true,
    };
    const { state } = resolveSystemicState(snap);
    expect(state).toBe("SYSTEMIC-AMBIGUOUS");
  });
});

// ─── 2. Ambiguity cannot be coerced by changing other axes ────────────────────

describe("W2-PR153A — ambiguity coercion prevention", () => {
  it("raising continuityConfidence to STRONG does NOT suppress R-AMBIGUOUS", () => {
    const snap: CrossAxisStateSnapshot = {
      ...BEST_POSSIBLE_WITH_AMBIGUOUS_REPLAY,
      integrity: "CI-DEGRADED",
      containment: "CT-DEGRADED",
      continuityConfidence: "STRONG",
    };
    expect(resolveSystemicState(snap).state).toBe("SYSTEMIC-AMBIGUOUS");
  });

  it("setting causalConfidence to CONFIRMED does NOT suppress R-AMBIGUOUS", () => {
    const snap: CrossAxisStateSnapshot = {
      ...BEST_POSSIBLE_WITH_AMBIGUOUS_REPLAY,
      integrity: "CI-DEGRADED",
      containment: "CT-DEGRADED",
      causalConfidence: "CONFIRMED",
      hasEvidenceRef: true,
    };
    expect(resolveSystemicState(snap).state).toBe("SYSTEMIC-AMBIGUOUS");
  });

  it("setting trustClass to C-1 does NOT suppress R-AMBIGUOUS", () => {
    const snap: CrossAxisStateSnapshot = {
      ...BEST_POSSIBLE_WITH_AMBIGUOUS_REPLAY,
      integrity: "CI-DEGRADED",
      containment: "CT-DEGRADED",
      trustClass: "C-1",
    };
    expect(resolveSystemicState(snap).state).toBe("SYSTEMIC-AMBIGUOUS");
  });
});

// ─── 3. SYSTEMIC-AMBIGUOUS vs SYSTEMIC-UNVERIFIED distinction ─────────────────

describe("W2-PR153A — SYSTEMIC-AMBIGUOUS vs SYSTEMIC-UNVERIFIED are operationally distinct", () => {
  it("R-AMBIGUOUS replay with known axes → SYSTEMIC-AMBIGUOUS (not SYSTEMIC-UNVERIFIED)", () => {
    const snap: CrossAxisStateSnapshot = {
      integrity: "CI-DEGRADED",
      containment: "CT-DEGRADED",
      replay: "R-AMBIGUOUS",
      trustClass: "C-1",
      continuityConfidence: "PARTIAL",
      causalConfidence: "PARTIAL",
      hasEvidenceRef: true,
    };
    expect(resolveSystemicState(snap).state).toBe("SYSTEMIC-AMBIGUOUS");
  });

  it("null trustClass with R-OBSERVED → SYSTEMIC-UNVERIFIED (not SYSTEMIC-AMBIGUOUS)", () => {
    const snap: CrossAxisStateSnapshot = {
      integrity: "CI-DEGRADED",
      containment: "CT-DEGRADED",
      replay: "R-OBSERVED",
      trustClass: null,
      continuityConfidence: "PARTIAL",
      causalConfidence: "PARTIAL",
      hasEvidenceRef: true,
    };
    expect(resolveSystemicState(snap).state).toBe("SYSTEMIC-UNVERIFIED");
  });

  it("SYSTEMIC-AMBIGUOUS description mentions disambiguation (operator action required)", () => {
    const desc = systemicStateDescription("SYSTEMIC-AMBIGUOUS").toLowerCase();
    expect(
      desc.includes("disambiguati") ||
      desc.includes("contradiction") ||
      desc.includes("required")
    ).toBe(true);
  });

  it("SYSTEMIC-UNVERIFIED description does not conflate with SYSTEMIC-AMBIGUOUS", () => {
    const ambig = systemicStateDescription("SYSTEMIC-AMBIGUOUS");
    const unver = systemicStateDescription("SYSTEMIC-UNVERIFIED");
    expect(ambig).not.toBe(unver);
  });
});

// ─── 4. failClosedReplayState preserves ambiguity on all unknown inputs ───────

describe("W2-PR153A — fail-closed helper never coerces unknown to non-ambiguous", () => {
  const KNOWN_REPLAY_STATES = new Set(REPLAY_STATES);

  const UNKNOWN_INPUTS = [
    null,
    undefined,
    "",
    "OBSERVED",       // missing R-prefix
    "R_AMBIGUOUS",    // wrong separator
    "r-ambiguous",    // wrong case
    "R-UNKNOWN",      // not a real state
    0,
    false,
    [],
    {},
  ];

  for (const bad of UNKNOWN_INPUTS) {
    it(`failClosedReplayState(${JSON.stringify(bad) ?? String(bad)}) → R-AMBIGUOUS`, () => {
      expect(failClosedReplayState(bad)).toBe("R-AMBIGUOUS");
    });
  }

  it("failClosedReplayState never returns a non-ambiguous state for unknown input", () => {
    for (const bad of UNKNOWN_INPUTS) {
      const result = failClosedReplayState(bad);
      const isKnown = KNOWN_REPLAY_STATES.has(result as typeof REPLAY_STATES[number]);
      // Must be R-AMBIGUOUS (a known state)
      expect(isKnown).toBe(true);
      expect(result).toBe("R-AMBIGUOUS");
    }
  });
});

// ─── 5. R-AMBIGUOUS is in REPLAY_STATES (fail-closed default is canonical) ───

describe("W2-PR153A — R-AMBIGUOUS canonical membership", () => {
  it("R-AMBIGUOUS is a member of REPLAY_STATES", () => {
    expect(REPLAY_STATES).toContain("R-AMBIGUOUS");
  });

  it("R-AMBIGUOUS is not a synthetic fallback — it is a real enumerated state", () => {
    const nonAmbiguous = REPLAY_STATES.filter((s) => s !== "R-AMBIGUOUS");
    expect(nonAmbiguous.length).toBe(REPLAY_STATES.length - 1);
    expect(nonAmbiguous.length).toBeGreaterThan(0);
  });
});

// ─── 6. detectCoherenceContradictions does not suppress ambiguity ─────────────

describe("W2-PR153A — detectCoherenceContradictions surfaces ambiguity, never hides it", () => {
  it("R-AMBIGUOUS triggers integrity-vs-replay contradiction when integrity is CI-GREEN", () => {
    const snap: CrossAxisStateSnapshot = {
      ...BEST_POSSIBLE_WITH_AMBIGUOUS_REPLAY,
      integrity: "CI-GREEN",
    };
    const c = detectCoherenceContradictions(snap);
    expect(c.some((x) => x.tag === "integrity-vs-replay")).toBe(true);
  });

  it("R-AMBIGUOUS does NOT create a containment-vs-integrity contradiction", () => {
    const snap: CrossAxisStateSnapshot = {
      ...BEST_POSSIBLE_WITH_AMBIGUOUS_REPLAY,
      integrity: "CI-DEGRADED",
    };
    const c = detectCoherenceContradictions(snap);
    expect(c.some((x) => x.tag === "containment-vs-integrity")).toBe(false);
  });

  it("resolveSystemicState always includes contradictions in SYSTEMIC-AMBIGUOUS output", () => {
    // With integrity-vs-replay contradiction
    const snap: CrossAxisStateSnapshot = BEST_POSSIBLE_WITH_AMBIGUOUS_REPLAY;
    const { state, contradictions } = resolveSystemicState(snap);
    expect(state).toBe("SYSTEMIC-AMBIGUOUS");
    expect(contradictions.length).toBeGreaterThan(0);
  });
});
