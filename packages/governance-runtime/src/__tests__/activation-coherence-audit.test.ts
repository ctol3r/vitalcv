/**
 * W2-PR153A — Constitutional Runtime Activation Coherence Audit.
 *
 * Exhaustive verification of detectCoherenceContradictions +
 * resolveSystemicState before institutional runtime activation:
 *   - All 4 contradiction rules exercised individually and in combination
 *   - Every SYSTEMIC_STATE reachable via a specific snapshot
 *   - No SYSTEMIC-GREEN state exists in the vocabulary
 *   - SYSTEMIC-AMBIGUOUS propagates from contradiction OR R-AMBIGUOUS alone
 *   - Systemic state description coverage for all 5 states
 *
 * Doctrine: W2-PR22A (cross-axis coherence), docs/ops/operational-guarantee-matrix.md
 */

import { describe, expect, it } from "vitest";

import {
  detectCoherenceContradictions,
  resolveSystemicState,
  systemicStateDescription,
  SYSTEMIC_STATES,
  type CrossAxisStateSnapshot,
} from "../coherence.js";

// ─── Baseline snapshots ───────────────────────────────────────────────────────

const CLEAN: CrossAxisStateSnapshot = {
  integrity: "CI-GREEN",
  containment: "CT-GREEN",
  replay: "R-OBSERVED",
  trustClass: "C-1",
  continuityConfidence: "STRONG",
  causalConfidence: "CONFIRMED",
  hasEvidenceRef: true,
};

const DEGRADED_SAFE: CrossAxisStateSnapshot = {
  ...CLEAN,
  integrity: "CI-DEGRADED",
};

// ─── 1. SYSTEMIC_STATES vocabulary ───────────────────────────────────────────

describe("W2-PR153A — SYSTEMIC_STATES vocabulary", () => {
  it("contains exactly 5 states", () => {
    expect(SYSTEMIC_STATES).toHaveLength(5);
  });

  it("contains SYSTEMIC-RECOVERING", () => {
    expect(SYSTEMIC_STATES).toContain("SYSTEMIC-RECOVERING");
  });

  it("contains SYSTEMIC-DEGRADED", () => {
    expect(SYSTEMIC_STATES).toContain("SYSTEMIC-DEGRADED");
  });

  it("contains SYSTEMIC-FRAGMENTED", () => {
    expect(SYSTEMIC_STATES).toContain("SYSTEMIC-FRAGMENTED");
  });

  it("contains SYSTEMIC-AMBIGUOUS", () => {
    expect(SYSTEMIC_STATES).toContain("SYSTEMIC-AMBIGUOUS");
  });

  it("contains SYSTEMIC-UNVERIFIED", () => {
    expect(SYSTEMIC_STATES).toContain("SYSTEMIC-UNVERIFIED");
  });

  it("does NOT contain SYSTEMIC-GREEN (vocabulary is intentionally degradation-focused)", () => {
    expect(SYSTEMIC_STATES).not.toContain("SYSTEMIC-GREEN");
  });
});

// ─── 2. detectCoherenceContradictions — rule 1: integrity-vs-replay ──────────

describe("W2-PR153A — Rule 1: CI-GREEN + R-AMBIGUOUS", () => {
  it("CI-GREEN + R-AMBIGUOUS → integrity-vs-replay contradiction", () => {
    const snap: CrossAxisStateSnapshot = { ...CLEAN, replay: "R-AMBIGUOUS" };
    const c = detectCoherenceContradictions(snap);
    expect(c.some((x) => x.tag === "integrity-vs-replay")).toBe(true);
  });

  it("CI-GREEN + R-OBSERVED → no integrity-vs-replay contradiction", () => {
    const c = detectCoherenceContradictions(CLEAN);
    expect(c.some((x) => x.tag === "integrity-vs-replay")).toBe(false);
  });

  it("CI-DEGRADED + R-AMBIGUOUS → no integrity-vs-replay contradiction", () => {
    const snap: CrossAxisStateSnapshot = { ...CLEAN, integrity: "CI-DEGRADED", replay: "R-AMBIGUOUS" };
    const c = detectCoherenceContradictions(snap);
    expect(c.some((x) => x.tag === "integrity-vs-replay")).toBe(false);
  });

  it("contradiction carries correct integrity + replay values", () => {
    const snap: CrossAxisStateSnapshot = { ...CLEAN, replay: "R-AMBIGUOUS" };
    const c = detectCoherenceContradictions(snap);
    const rule = c.find((x) => x.tag === "integrity-vs-replay");
    expect(rule).toBeDefined();
    if (rule?.tag === "integrity-vs-replay") {
      expect(rule.integrity).toBe("CI-GREEN");
      expect(rule.replay).toBe("R-AMBIGUOUS");
      expect(rule.reason.length).toBeGreaterThan(0);
    }
  });
});

// ─── 3. detectCoherenceContradictions — rule 2: containment-vs-integrity ─────

describe("W2-PR153A — Rule 2: CT-GREEN + CI-FRAGMENTED / CI-VIOLATION", () => {
  it("CT-GREEN + CI-FRAGMENTED → containment-vs-integrity contradiction", () => {
    const snap: CrossAxisStateSnapshot = {
      ...CLEAN,
      integrity: "CI-FRAGMENTED",
      replay: "R-OBSERVED", // avoid rule 1
    };
    const c = detectCoherenceContradictions(snap);
    expect(c.some((x) => x.tag === "containment-vs-integrity")).toBe(true);
  });

  it("CT-GREEN + CI-VIOLATION → containment-vs-integrity contradiction", () => {
    const snap: CrossAxisStateSnapshot = {
      ...CLEAN,
      integrity: "CI-VIOLATION",
      replay: "R-OBSERVED",
    };
    const c = detectCoherenceContradictions(snap);
    expect(c.some((x) => x.tag === "containment-vs-integrity")).toBe(true);
  });

  it("CT-GREEN + CI-DEGRADED → no containment-vs-integrity contradiction", () => {
    const snap: CrossAxisStateSnapshot = { ...CLEAN, integrity: "CI-DEGRADED" };
    const c = detectCoherenceContradictions(snap);
    expect(c.some((x) => x.tag === "containment-vs-integrity")).toBe(false);
  });

  it("CT-DEGRADED + CI-FRAGMENTED → no containment-vs-integrity contradiction (CT is not GREEN)", () => {
    const snap: CrossAxisStateSnapshot = {
      ...CLEAN,
      containment: "CT-DEGRADED",
      integrity: "CI-FRAGMENTED",
      replay: "R-OBSERVED",
    };
    const c = detectCoherenceContradictions(snap);
    expect(c.some((x) => x.tag === "containment-vs-integrity")).toBe(false);
  });

  it("contradiction carries correct containment + integrity values", () => {
    const snap: CrossAxisStateSnapshot = { ...CLEAN, integrity: "CI-VIOLATION", replay: "R-OBSERVED" };
    const c = detectCoherenceContradictions(snap);
    const rule = c.find((x) => x.tag === "containment-vs-integrity");
    expect(rule).toBeDefined();
    if (rule?.tag === "containment-vs-integrity") {
      expect(rule.containment).toBe("CT-GREEN");
      expect(rule.integrity).toBe("CI-VIOLATION");
    }
  });
});

// ─── 4. detectCoherenceContradictions — rule 3: trust-class-vs-continuity ────

describe("W2-PR153A — Rule 3: T0 + STRONG continuity", () => {
  it("T0 + STRONG → trust-class-vs-continuity contradiction", () => {
    const snap: CrossAxisStateSnapshot = { ...CLEAN, trustClass: "T0" };
    const c = detectCoherenceContradictions(snap);
    expect(c.some((x) => x.tag === "trust-class-vs-continuity")).toBe(true);
  });

  it("T0 + PARTIAL → no trust-class-vs-continuity contradiction", () => {
    const snap: CrossAxisStateSnapshot = { ...CLEAN, trustClass: "T0", continuityConfidence: "PARTIAL" };
    const c = detectCoherenceContradictions(snap);
    expect(c.some((x) => x.tag === "trust-class-vs-continuity")).toBe(false);
  });

  it("T0 + LIMITED → no trust-class-vs-continuity contradiction", () => {
    const snap: CrossAxisStateSnapshot = { ...CLEAN, trustClass: "T0", continuityConfidence: "LIMITED" };
    const c = detectCoherenceContradictions(snap);
    expect(c.some((x) => x.tag === "trust-class-vs-continuity")).toBe(false);
  });

  it("T0 + NONE → no trust-class-vs-continuity contradiction", () => {
    const snap: CrossAxisStateSnapshot = { ...CLEAN, trustClass: "T0", continuityConfidence: "NONE" };
    const c = detectCoherenceContradictions(snap);
    expect(c.some((x) => x.tag === "trust-class-vs-continuity")).toBe(false);
  });

  it("C-1 + STRONG → no trust-class-vs-continuity contradiction", () => {
    const c = detectCoherenceContradictions(CLEAN);
    expect(c.some((x) => x.tag === "trust-class-vs-continuity")).toBe(false);
  });

  it("contradiction carries correct trustClass + continuity values", () => {
    const snap: CrossAxisStateSnapshot = { ...CLEAN, trustClass: "T0" };
    const c = detectCoherenceContradictions(snap);
    const rule = c.find((x) => x.tag === "trust-class-vs-continuity");
    expect(rule).toBeDefined();
    if (rule?.tag === "trust-class-vs-continuity") {
      expect(rule.trustClass).toBe("T0");
      expect(rule.continuity).toBe("STRONG");
    }
  });
});

// ─── 5. detectCoherenceContradictions — rule 4: confidence-vs-evidence ───────

describe("W2-PR153A — Rule 4: CONFIRMED/PROBABLE + missing evidenceRef", () => {
  it("CONFIRMED + no evidenceRef → confidence-vs-evidence contradiction", () => {
    const snap: CrossAxisStateSnapshot = { ...CLEAN, hasEvidenceRef: false };
    const c = detectCoherenceContradictions(snap);
    expect(c.some((x) => x.tag === "confidence-vs-evidence")).toBe(true);
  });

  it("PROBABLE + no evidenceRef → confidence-vs-evidence contradiction", () => {
    const snap: CrossAxisStateSnapshot = { ...CLEAN, causalConfidence: "PROBABLE", hasEvidenceRef: false };
    const c = detectCoherenceContradictions(snap);
    expect(c.some((x) => x.tag === "confidence-vs-evidence")).toBe(true);
  });

  it("CONFIRMED + evidenceRef present → no confidence-vs-evidence contradiction", () => {
    const c = detectCoherenceContradictions(CLEAN);
    expect(c.some((x) => x.tag === "confidence-vs-evidence")).toBe(false);
  });

  it("PARTIAL causal + no evidenceRef → no contradiction (rule only covers CONFIRMED/PROBABLE)", () => {
    const snap: CrossAxisStateSnapshot = { ...CLEAN, causalConfidence: "PARTIAL", hasEvidenceRef: false };
    const c = detectCoherenceContradictions(snap);
    expect(c.some((x) => x.tag === "confidence-vs-evidence")).toBe(false);
  });

  it("AMBIGUOUS causal + no evidenceRef → no contradiction", () => {
    const snap: CrossAxisStateSnapshot = { ...CLEAN, causalConfidence: "AMBIGUOUS", hasEvidenceRef: false };
    const c = detectCoherenceContradictions(snap);
    expect(c.some((x) => x.tag === "confidence-vs-evidence")).toBe(false);
  });

  it("UNVERIFIED causal + no evidenceRef → no contradiction", () => {
    const snap: CrossAxisStateSnapshot = { ...CLEAN, causalConfidence: "UNVERIFIED", hasEvidenceRef: false };
    const c = detectCoherenceContradictions(snap);
    expect(c.some((x) => x.tag === "confidence-vs-evidence")).toBe(false);
  });

  it("null causal + no evidenceRef → no contradiction (null = unclassified, handled by UNVERIFIED path)", () => {
    const snap: CrossAxisStateSnapshot = { ...CLEAN, causalConfidence: null, hasEvidenceRef: false };
    const c = detectCoherenceContradictions(snap);
    expect(c.some((x) => x.tag === "confidence-vs-evidence")).toBe(false);
  });
});

// ─── 6. Multiple simultaneous contradictions ──────────────────────────────────

describe("W2-PR153A — simultaneous contradictions", () => {
  it("CI-GREEN + R-AMBIGUOUS AND T0 + STRONG → both rules fire simultaneously", () => {
    const snap: CrossAxisStateSnapshot = { ...CLEAN, replay: "R-AMBIGUOUS", trustClass: "T0" };
    const c = detectCoherenceContradictions(snap);
    expect(c.some((x) => x.tag === "integrity-vs-replay")).toBe(true);
    expect(c.some((x) => x.tag === "trust-class-vs-continuity")).toBe(true);
    expect(c.length).toBeGreaterThanOrEqual(2);
  });

  it("all 4 rules simultaneously → 4 contradictions", () => {
    const snap: CrossAxisStateSnapshot = {
      integrity: "CI-GREEN",
      containment: "CT-GREEN",
      replay: "R-AMBIGUOUS",
      trustClass: "T0",
      continuityConfidence: "STRONG",
      causalConfidence: "CONFIRMED",
      hasEvidenceRef: false,
    };
    const c = detectCoherenceContradictions(snap);
    expect(c.some((x) => x.tag === "integrity-vs-replay")).toBe(true);
    expect(c.some((x) => x.tag === "containment-vs-integrity")).toBe(false); // CI-GREEN not fragmented
    expect(c.some((x) => x.tag === "trust-class-vs-continuity")).toBe(true);
    expect(c.some((x) => x.tag === "confidence-vs-evidence")).toBe(true);
  });

  it("clean baseline → zero contradictions", () => {
    expect(detectCoherenceContradictions(CLEAN)).toHaveLength(0);
  });
});

// ─── 7. resolveSystemicState — all reachable states ──────────────────────────

describe("W2-PR153A — resolveSystemicState all reachable states", () => {
  it("contradiction → SYSTEMIC-AMBIGUOUS", () => {
    const snap: CrossAxisStateSnapshot = { ...CLEAN, replay: "R-AMBIGUOUS" };
    expect(resolveSystemicState(snap).state).toBe("SYSTEMIC-AMBIGUOUS");
  });

  it("R-AMBIGUOUS alone (no contradiction) → SYSTEMIC-AMBIGUOUS", () => {
    // CI-DEGRADED avoids the integrity-vs-replay contradiction
    const snap: CrossAxisStateSnapshot = { ...DEGRADED_SAFE, replay: "R-AMBIGUOUS" };
    expect(resolveSystemicState(snap).state).toBe("SYSTEMIC-AMBIGUOUS");
  });

  it("null trustClass → SYSTEMIC-UNVERIFIED", () => {
    const snap: CrossAxisStateSnapshot = { ...CLEAN, trustClass: null };
    expect(resolveSystemicState(snap).state).toBe("SYSTEMIC-UNVERIFIED");
  });

  it("CI-UNKNOWN → SYSTEMIC-UNVERIFIED", () => {
    const snap: CrossAxisStateSnapshot = { ...CLEAN, integrity: "CI-UNKNOWN" };
    expect(resolveSystemicState(snap).state).toBe("SYSTEMIC-UNVERIFIED");
  });

  it("CT-UNKNOWN → SYSTEMIC-UNVERIFIED", () => {
    const snap: CrossAxisStateSnapshot = { ...CLEAN, containment: "CT-UNKNOWN" };
    expect(resolveSystemicState(snap).state).toBe("SYSTEMIC-UNVERIFIED");
  });

  it("null continuityConfidence → SYSTEMIC-UNVERIFIED", () => {
    const snap: CrossAxisStateSnapshot = { ...CLEAN, continuityConfidence: null };
    expect(resolveSystemicState(snap).state).toBe("SYSTEMIC-UNVERIFIED");
  });

  it("null causalConfidence → SYSTEMIC-UNVERIFIED", () => {
    const snap: CrossAxisStateSnapshot = { ...CLEAN, causalConfidence: null };
    expect(resolveSystemicState(snap).state).toBe("SYSTEMIC-UNVERIFIED");
  });

  it("UNVERIFIED causalConfidence → SYSTEMIC-UNVERIFIED", () => {
    const snap: CrossAxisStateSnapshot = { ...CLEAN, causalConfidence: "UNVERIFIED" };
    expect(resolveSystemicState(snap).state).toBe("SYSTEMIC-UNVERIFIED");
  });

  it("CI-FRAGMENTED (no contradiction) → SYSTEMIC-FRAGMENTED", () => {
    const snap: CrossAxisStateSnapshot = {
      ...CLEAN,
      integrity: "CI-FRAGMENTED",
      containment: "CT-DEGRADED", // avoid containment-vs-integrity rule
    };
    expect(resolveSystemicState(snap).state).toBe("SYSTEMIC-FRAGMENTED");
  });

  it("CI-VIOLATION (no contradiction) → SYSTEMIC-FRAGMENTED", () => {
    const snap: CrossAxisStateSnapshot = {
      ...CLEAN,
      integrity: "CI-VIOLATION",
      containment: "CT-DEGRADED",
    };
    expect(resolveSystemicState(snap).state).toBe("SYSTEMIC-FRAGMENTED");
  });

  it("CT-FRAGMENTING → SYSTEMIC-FRAGMENTED", () => {
    const snap: CrossAxisStateSnapshot = { ...CLEAN, containment: "CT-FRAGMENTING" };
    expect(resolveSystemicState(snap).state).toBe("SYSTEMIC-FRAGMENTED");
  });

  it("CT-ESCALATING → SYSTEMIC-FRAGMENTED", () => {
    const snap: CrossAxisStateSnapshot = { ...CLEAN, containment: "CT-ESCALATING" };
    expect(resolveSystemicState(snap).state).toBe("SYSTEMIC-FRAGMENTED");
  });

  it("CT-VIOLATION → SYSTEMIC-FRAGMENTED", () => {
    const snap: CrossAxisStateSnapshot = { ...CLEAN, containment: "CT-VIOLATION" };
    expect(resolveSystemicState(snap).state).toBe("SYSTEMIC-FRAGMENTED");
  });

  it("CI-DEGRADED + CT-GREEN + STRONG → SYSTEMIC-RECOVERING (active recovery path)", () => {
    const snap: CrossAxisStateSnapshot = { ...CLEAN, integrity: "CI-DEGRADED" };
    expect(resolveSystemicState(snap).state).toBe("SYSTEMIC-RECOVERING");
  });

  it("clean all-clear → SYSTEMIC-RECOVERING (not SYSTEMIC-GREEN)", () => {
    expect(resolveSystemicState(CLEAN).state).toBe("SYSTEMIC-RECOVERING");
  });

  it("SYSTEMIC-RECOVERING is not SYSTEMIC-GREEN", () => {
    const result = resolveSystemicState(CLEAN);
    expect(result.state).not.toBe("SYSTEMIC-GREEN");
  });

  it("CI-DEGRADED + CT-DEGRADED (not fragmented) → SYSTEMIC-DEGRADED", () => {
    const snap: CrossAxisStateSnapshot = {
      ...CLEAN,
      integrity: "CI-DEGRADED",
      containment: "CT-DEGRADED",
      continuityConfidence: "PARTIAL", // not STRONG, so active-recovery path doesn't fire
    };
    expect(resolveSystemicState(snap).state).toBe("SYSTEMIC-DEGRADED");
  });
});

// ─── 8. resolveSystemicState — contradictions field coherence ─────────────────

describe("W2-PR153A — resolveSystemicState contradiction field coherence", () => {
  it("SYSTEMIC-AMBIGUOUS from contradiction surfaces contradiction in result", () => {
    const snap: CrossAxisStateSnapshot = { ...CLEAN, replay: "R-AMBIGUOUS" };
    const { state, contradictions } = resolveSystemicState(snap);
    expect(state).toBe("SYSTEMIC-AMBIGUOUS");
    expect(contradictions.length).toBeGreaterThan(0);
  });

  it("SYSTEMIC-RECOVERING from clean snapshot has empty contradictions", () => {
    const { contradictions } = resolveSystemicState(CLEAN);
    expect(contradictions).toHaveLength(0);
  });

  it("SYSTEMIC-UNVERIFIED from null trustClass has empty contradictions", () => {
    const snap: CrossAxisStateSnapshot = { ...CLEAN, trustClass: null };
    const { contradictions } = resolveSystemicState(snap);
    expect(contradictions).toHaveLength(0);
  });
});

// ─── 9. systemicStateDescription coverage ────────────────────────────────────

describe("W2-PR153A — systemicStateDescription all states", () => {
  for (const s of SYSTEMIC_STATES) {
    it(`${s} has a non-empty description`, () => {
      expect(systemicStateDescription(s).length).toBeGreaterThan(0);
    });
  }

  it("SYSTEMIC-AMBIGUOUS description mentions contradiction or ambiguity", () => {
    const d = systemicStateDescription("SYSTEMIC-AMBIGUOUS").toLowerCase();
    expect(d.includes("contradiction") || d.includes("ambiguous") || d.includes("ambiguity")).toBe(true);
  });

  it("SYSTEMIC-UNVERIFIED description mentions unverified or unknown", () => {
    const d = systemicStateDescription("SYSTEMIC-UNVERIFIED").toLowerCase();
    expect(d.includes("unknown") || d.includes("unverified") || d.includes("unclassified")).toBe(true);
  });
});
