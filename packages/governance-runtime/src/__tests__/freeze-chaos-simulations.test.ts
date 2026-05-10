/**
 * W2-PR143A — Freeze Chaos Simulations + Stability Scoring.
 *
 * Aggressive edge cases for kernel stability validation:
 *   - Empty claimed kernel (all arrays empty)
 *   - All edges removed from claimed
 *   - Claimed is strict superset of live (additions — allowed)
 *   - Multiple simultaneous violations
 *   - tamper-evident canonicalize determinism under freeze
 *   - buildKernelFreezeReport gating properties
 *
 * Doctrine: W2-PR41A, W2-PR32A (tamper-evident persistence)
 */

import { describe, expect, it } from "vitest";

import {
  captureLiveKernel,
  GOVERNANCE_KERNEL_VERSION,
  validateKernelStability,
  validateCompatibilityContract,
  buildKernelFreezeReport,
  type FrozenKernelSurface,
  type CompatibilityContract,
} from "../kernel-freeze.js";

import { canonicalize } from "../tamper-evident-persistence.js";

// ─── 1. Empty claimed kernel chaos ───────────────────────────────────────────

describe("W2-PR143A — CHAOS: empty claimed kernel", () => {
  const live = captureLiveKernel();
  const emptyClaimed: FrozenKernelSurface = {
    version: live.version,
    trustClasses: [],
    integrityStates: [],
    containmentStates: [],
    replayStates: [],
    replayTransitionEdges: [],
  };

  it("empty claimed: no state-set-member-removed findings (empty claimed is a subset — all live members are additions)", () => {
    const findings = validateKernelStability(emptyClaimed);
    // claimed has nothing; live has everything.
    // validateKernelStability checks claimed's members against live.
    // Empty claimed has no members to check removal for.
    expect(findings.filter((f) => f.tag === "state-set-member-removed").length).toBe(0);
  });

  it("empty claimed: no replay-edge-removed findings (no edges to check)", () => {
    const findings = validateKernelStability(emptyClaimed);
    expect(findings.filter((f) => f.tag === "replay-edge-removed").length).toBe(0);
  });

  it("empty claimed: no gating condition (empty is trivially compatible)", () => {
    const r = buildKernelFreezeReport(emptyClaimed, null, "2026-01-01T00:00:00Z");
    expect(r.hasCiGatingCondition).toBe(false);
  });
});

// ─── 2. All-edges-removed chaos ──────────────────────────────────────────────

describe("W2-PR143A — CHAOS: claimed has all edges but live has none", () => {
  it("every edge in live claimed as removed triggers replay-edge-removed findings", () => {
    const live = captureLiveKernel();
    // claimed has ALL live edges, but we're testing the inverse:
    // claimed thinks ALL edges exist but live has none (simulate kernel regression)
    // We fake a live with zero edges by claiming the live edges against an empty live.
    // The real scenario: claimed has edges that live no longer has.
    const allEdges = live.replayTransitionEdges;
    const claimedWithAllEdges: FrozenKernelSurface = {
      version: live.version,
      trustClasses: [...live.trustClasses],
      integrityStates: [...live.integrityStates],
      containmentStates: [...live.containmentStates],
      replayStates: [...live.replayStates],
      // Add a ghost edge that live doesn't have
      replayTransitionEdges: [
        ...allEdges,
        Object.freeze(["R-OBSERVED", "R-COLLAPSED"] as const), // forbidden ghost
      ],
    };
    const findings = validateKernelStability(claimedWithAllEdges);
    // The ghost edge R-OBSERVED→R-COLLAPSED doesn't exist in live REPLAY_TRANSITIONS
    expect(findings.some((f) => f.tag === "replay-edge-removed")).toBe(true);
  });
});

// ─── 3. Multiple simultaneous violations ────────────────────────────────────

describe("W2-PR143A — CHAOS: simultaneous violations", () => {
  it("version mismatch + removed member → both findings present", () => {
    const live = captureLiveKernel();
    const multiViolation: FrozenKernelSurface = {
      ...live,
      version: "99.0.0" as never,
      replayStates: [...live.replayStates, "PHANTOM" as never],
    };
    const findings = validateKernelStability(multiViolation);
    expect(findings.some((f) => f.tag === "version-major-mismatch")).toBe(true);
    expect(findings.some((f) => f.tag === "state-set-member-removed")).toBe(true);
  });

  it("CI gate fires when any finding exists", () => {
    const live = captureLiveKernel();
    const bad: FrozenKernelSurface = {
      ...live,
      replayStates: [...live.replayStates, "PHANTOM" as never],
    };
    const r = buildKernelFreezeReport(bad, null, "2026-01-01T00:00:00Z");
    expect(r.hasCiGatingCondition).toBe(true);
  });

  it("CI gate fires when contract violation + no baseline violation", () => {
    const badContract: CompatibilityContract = {
      requiresMajor: 99,
      requiredStateMembers: [],
      requiredReplayEdges: [],
    };
    const r = buildKernelFreezeReport(null, badContract, "2026-01-01T00:00:00Z");
    expect(r.hasCiGatingCondition).toBe(true);
  });
});

// ─── 4. Compatibility contract edge cases ────────────────────────────────────

describe("W2-PR143A — compatibility contract exhaustive", () => {
  it("empty contract (no requirements) → no violations", () => {
    const empty: CompatibilityContract = {
      requiresMajor: 1,
      requiredStateMembers: [],
      requiredReplayEdges: [],
    };
    expect(validateCompatibilityContract(empty)).toEqual([]);
  });

  it("contract requiring all canonical replay states → no violations", () => {
    const allReplay: CompatibilityContract = {
      requiresMajor: 1,
      requiredStateMembers: ["R-OBSERVED", "R-DENIED", "R-ACCEPTED", "R-COLLAPSED", "R-AMBIGUOUS"],
      requiredReplayEdges: [],
    };
    expect(validateCompatibilityContract(allReplay)).toEqual([]);
  });

  it("contract requiring every allowed R-AMBIGUOUS transition edge → no violations", () => {
    const live = captureLiveKernel();
    const ambigEdges = live.replayTransitionEdges.filter(([f]) => f === "R-AMBIGUOUS");
    const contract: CompatibilityContract = {
      requiresMajor: 1,
      requiredStateMembers: [],
      requiredReplayEdges: [...ambigEdges],
    };
    expect(validateCompatibilityContract(contract)).toEqual([]);
  });

  it("contract requiring both state members and edges simultaneously passes when live satisfies both", () => {
    const contract: CompatibilityContract = {
      requiresMajor: 1,
      requiredStateMembers: ["R-AMBIGUOUS", "CI-UNKNOWN", "CT-UNKNOWN", "C-1"],
      requiredReplayEdges: [
        ["R-AMBIGUOUS", "R-OBSERVED"],
        ["R-OBSERVED", "R-AMBIGUOUS"],
      ],
    };
    expect(validateCompatibilityContract(contract)).toEqual([]);
  });

  it("version 0 major is satisfied by live v1 (live is newer)", () => {
    const contract: CompatibilityContract = {
      requiresMajor: 0,
      requiredStateMembers: [],
      requiredReplayEdges: [],
    };
    expect(validateCompatibilityContract(contract)).toEqual([]);
  });
});

// ─── 5. canonicalize determinism under frozen replay objects ─────────────────

describe("W2-PR143A — canonicalize determinism (tamper-evident freeze)", () => {
  it("two canonicalize calls on identical frozen replay objects produce the same hash", () => {
    const edge1 = Object.freeze({ from: "R-AMBIGUOUS", to: "R-OBSERVED", evidenceRequired: "row found" });
    const edge2 = Object.freeze({ from: "R-AMBIGUOUS", to: "R-OBSERVED", evidenceRequired: "row found" });
    expect(canonicalize(edge1)).toBe(canonicalize(edge2));
  });

  it("canonicalize output is stable across different key-insertion orders", () => {
    const a = canonicalize({ to: "R-OBSERVED", from: "R-AMBIGUOUS" });
    const b = canonicalize({ from: "R-AMBIGUOUS", to: "R-OBSERVED" });
    // Canonicalize sorts keys, so both should produce the same string
    expect(a).toBe(b);
  });

  it("frozen REPLAY_STATES array produces the same canonical string on repeated calls", () => {
    const k = captureLiveKernel();
    const c1 = canonicalize([...k.replayStates]);
    const c2 = canonicalize([...k.replayStates]);
    expect(c1).toBe(c2);
  });

  it("canonicalize rejects non-finite numbers (no NaN in freeze records)", () => {
    expect(() => canonicalize(NaN)).toThrow();
    expect(() => canonicalize(Infinity)).toThrow();
    expect(() => canonicalize(-Infinity)).toThrow();
  });

  it("canonicalize omits undefined values (stable under partial objects)", () => {
    const withUndefined = canonicalize({ a: 1, b: undefined, c: 2 });
    const withoutB = canonicalize({ a: 1, c: 2 });
    expect(withUndefined).toBe(withoutB);
  });
});

// ─── 6. GOVERNANCE_KERNEL_VERSION stability ──────────────────────────────────

describe("W2-PR143A — GOVERNANCE_KERNEL_VERSION stability pin", () => {
  it("is semver-shaped", () => {
    expect(GOVERNANCE_KERNEL_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("major version is 1 (no accidental major bump)", () => {
    const major = parseInt(GOVERNANCE_KERNEL_VERSION.split(".")[0]!, 10);
    expect(major).toBe(1);
  });

  it("captured kernel reports same version", () => {
    expect(captureLiveKernel().version).toBe(GOVERNANCE_KERNEL_VERSION);
  });

  it("version is a const string literal (not dynamic)", () => {
    expect(typeof GOVERNANCE_KERNEL_VERSION).toBe("string");
    // Referential equality check — the literal is the literal
    const v: typeof GOVERNANCE_KERNEL_VERSION = "1.0.0";
    expect(v).toBe(GOVERNANCE_KERNEL_VERSION);
  });
});
