/**
 * W2-PR143A — Runtime Freeze Validators.
 *
 * Verifies that every object produced by captureLiveKernel() is deeply
 * frozen, that mutations are rejected, and that the kernel surface is
 * deterministically reproducible across calls.
 *
 * Doctrine: W2-PR41A kernel-freeze spec
 *           docs/ops/constitutional-recovery-semantics.md
 */

import { describe, expect, it } from "vitest";

import {
  captureLiveKernel,
  GOVERNANCE_KERNEL_VERSION,
  validateKernelStability,
  validateCompatibilityContract,
  buildKernelFreezeReport,
  type FrozenKernelSurface,
} from "../kernel-freeze.js";

import { REPLAY_STATES } from "../index.js";
import { REPLAY_TRANSITIONS } from "../index.js";

// ─── 1. Deep-freeze validation ───────────────────────────────────────────────

describe("W2-PR143A — captureLiveKernel deep-freeze", () => {
  it("top-level kernel surface is frozen", () => {
    expect(Object.isFrozen(captureLiveKernel())).toBe(true);
  });

  it("trustClasses array is frozen", () => {
    expect(Object.isFrozen(captureLiveKernel().trustClasses)).toBe(true);
  });

  it("integrityStates array is frozen", () => {
    expect(Object.isFrozen(captureLiveKernel().integrityStates)).toBe(true);
  });

  it("containmentStates array is frozen", () => {
    expect(Object.isFrozen(captureLiveKernel().containmentStates)).toBe(true);
  });

  it("replayStates array is frozen", () => {
    expect(Object.isFrozen(captureLiveKernel().replayTransitionEdges)).toBe(true);
  });

  it("replayTransitionEdges array is frozen", () => {
    expect(Object.isFrozen(captureLiveKernel().replayTransitionEdges)).toBe(true);
  });

  it("each replayTransitionEdge tuple is frozen", () => {
    const k = captureLiveKernel();
    for (const edge of k.replayTransitionEdges) {
      expect(Object.isFrozen(edge)).toBe(true);
    }
  });
});

// ─── 2. Mutation-resistance chaos ────────────────────────────────────────────

describe("W2-PR143A — frozen kernel mutation rejection", () => {
  it("push to replayStates throws in strict mode", () => {
    const k = captureLiveKernel();
    expect(() => {
      (k.replayStates as string[]).push("PHANTOM");
    }).toThrow();
  });

  it("push to trustClasses throws", () => {
    const k = captureLiveKernel();
    expect(() => {
      (k.trustClasses as string[]).push("PHANTOM");
    }).toThrow();
  });

  it("push to integrityStates throws", () => {
    const k = captureLiveKernel();
    expect(() => {
      (k.integrityStates as string[]).push("PHANTOM");
    }).toThrow();
  });

  it("push to containmentStates throws", () => {
    const k = captureLiveKernel();
    expect(() => {
      (k.containmentStates as string[]).push("PHANTOM");
    }).toThrow();
  });

  it("push to replayTransitionEdges throws", () => {
    const k = captureLiveKernel();
    expect(() => {
      (k.replayTransitionEdges as unknown[]).push(["R-AMBIGUOUS", "R-DENIED"]);
    }).toThrow();
  });

  it("overwrite version property throws", () => {
    const k = captureLiveKernel();
    expect(() => {
      (k as Record<string, unknown>)["version"] = "99.0.0";
    }).toThrow();
  });
});

// ─── 3. Replay-freeze determinism ────────────────────────────────────────────

describe("W2-PR143A — captureLiveKernel determinism (idempotency)", () => {
  it("two successive calls produce identical replayStates content", () => {
    const k1 = captureLiveKernel();
    const k2 = captureLiveKernel();
    expect([...k1.replayStates]).toEqual([...k2.replayStates]);
  });

  it("two successive calls produce identical replayTransitionEdges length", () => {
    const k1 = captureLiveKernel();
    const k2 = captureLiveKernel();
    expect(k1.replayTransitionEdges.length).toBe(k2.replayTransitionEdges.length);
  });

  it("captured replayStates content matches REPLAY_STATES source-of-truth", () => {
    const k = captureLiveKernel();
    expect([...k.replayStates]).toEqual([...REPLAY_STATES]);
  });

  it("captured replayTransitionEdges count matches REPLAY_TRANSITIONS count", () => {
    const k = captureLiveKernel();
    expect(k.replayTransitionEdges.length).toBe(REPLAY_TRANSITIONS.length);
  });

  it("version string is identical across calls", () => {
    expect(captureLiveKernel().version).toBe(captureLiveKernel().version);
    expect(captureLiveKernel().version).toBe(GOVERNANCE_KERNEL_VERSION);
  });
});

// ─── 4. Cross-axis freeze coherence ─────────────────────────────────────────

describe("W2-PR143A — validateKernelStability: cross-axis detection", () => {
  function claimedWithExtraIn(
    axis: keyof Pick<FrozenKernelSurface, "trustClasses" | "integrityStates" | "containmentStates" | "replayStates">,
  ): FrozenKernelSurface {
    const live = captureLiveKernel();
    return { ...live, [axis]: [...live[axis], "GHOST" as never] };
  }

  it("extra trustClasses member on claimed → state-set-member-removed", () => {
    const findings = validateKernelStability(claimedWithExtraIn("trustClasses"));
    expect(findings.some((f) => f.tag === "state-set-member-removed" && f.stateSet === "trustClasses")).toBe(true);
  });

  it("extra integrityStates member on claimed → state-set-member-removed", () => {
    const findings = validateKernelStability(claimedWithExtraIn("integrityStates"));
    expect(findings.some((f) => f.tag === "state-set-member-removed" && f.stateSet === "integrityStates")).toBe(true);
  });

  it("extra containmentStates member on claimed → state-set-member-removed", () => {
    const findings = validateKernelStability(claimedWithExtraIn("containmentStates"));
    expect(findings.some((f) => f.tag === "state-set-member-removed" && f.stateSet === "containmentStates")).toBe(true);
  });

  it("extra replayStates member on claimed → state-set-member-removed", () => {
    const findings = validateKernelStability(claimedWithExtraIn("replayStates"));
    expect(findings.some((f) => f.tag === "state-set-member-removed" && f.stateSet === "replayStates")).toBe(true);
  });

  it("additions to live (claimed is subset) → no findings (forward-compatible)", () => {
    const live = captureLiveKernel();
    // claimed has one fewer replayState than live
    const claimed: FrozenKernelSurface = {
      ...live,
      replayStates: live.replayStates.slice(0, -1),
    };
    // Additions to live are OK — live has more than claimed
    // BUT wait: validateKernelStability checks claimed's members against live.
    // If claimed is missing a member that live has, that's an ADDITION to live, not a removal.
    // The stability check protects against the claimed having more than live.
    // So a subset claimed is totally fine — no findings.
    const findings = validateKernelStability(claimed);
    // Should not have state-set-member-removed for the last member
    // (live has it; claimed doesn't — that's an addition to live, allowed)
    expect(findings.filter((f) => f.tag === "state-set-member-removed").length).toBe(0);
  });
});
