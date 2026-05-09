/**
 * W2-PR41A — Kernel freeze + stability contract tests.
 */

import { describe, expect, it } from "vitest";

import {
  buildKernelFreezeReport,
  captureLiveKernel,
  GOVERNANCE_KERNEL_VERSION,
  validateCompatibilityContract,
  validateKernelStability,
  type CompatibilityContract,
  type FrozenKernelSurface,
} from "../kernel-freeze.js";

describe("W2-PR41A — kernel surface capture", () => {
  it("GOVERNANCE_KERNEL_VERSION is semver-shaped", () => {
    expect(GOVERNANCE_KERNEL_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
  it("captureLiveKernel returns frozen object with expected state-sets", () => {
    const k = captureLiveKernel();
    expect(Object.isFrozen(k)).toBe(true);
    expect(k.trustClasses.length).toBeGreaterThan(0);
    expect(k.replayStates).toContain("R-AMBIGUOUS");
    expect(k.replayStates).toContain("R-COLLAPSED");
    expect(k.replayTransitionEdges.length).toBeGreaterThan(0);
  });
});

describe("W2-PR41A — stability validators", () => {
  it("identical claimed kernel ⇒ no findings", () => {
    const live = captureLiveKernel();
    expect(validateKernelStability(live)).toEqual([]);
  });

  it("removed state-set member is detected", () => {
    const live = captureLiveKernel();
    const claimed: FrozenKernelSurface = {
      ...live,
      replayStates: [...live.replayStates, "GHOST-STATE" as never],
    };
    const findings = validateKernelStability(claimed);
    expect(findings.some((f) => f.tag === "state-set-member-removed")).toBe(true);
  });

  it("reordered state-set members detected", () => {
    const live = captureLiveKernel();
    if (live.replayStates.length < 2) return;
    const swapped = [...live.replayStates];
    [swapped[0], swapped[1]] = [swapped[1]!, swapped[0]!];
    const claimed: FrozenKernelSurface = { ...live, replayStates: swapped as never };
    const findings = validateKernelStability(claimed);
    expect(findings.some((f) => f.tag === "state-set-member-reordered")).toBe(true);
  });

  it("removed replay edge is detected", () => {
    const live = captureLiveKernel();
    const fakeEdge: readonly ["R-AMBIGUOUS", "R-OBSERVED"] = ["R-AMBIGUOUS", "R-OBSERVED"];
    const claimed: FrozenKernelSurface = {
      ...live,
      replayTransitionEdges: [...live.replayTransitionEdges, ["R-OBSERVED", "GHOST-STATE" as never] as never],
    };
    const findings = validateKernelStability(claimed);
    expect(findings.some((f) => f.tag === "replay-edge-removed")).toBe(true);
    expect(fakeEdge[0]).toBe("R-AMBIGUOUS"); // sanity
  });

  it("major-version mismatch is detected", () => {
    const live = captureLiveKernel();
    const claimed: FrozenKernelSurface = { ...live, version: "99.0.0" as never };
    const findings = validateKernelStability(claimed);
    expect(findings.some((f) => f.tag === "version-major-mismatch")).toBe(true);
  });
});

describe("W2-PR41A — compatibility contracts", () => {
  it("contract requiring R-AMBIGUOUS + lower major holds against live", () => {
    const contract: CompatibilityContract = {
      requiresMajor: 1,
      requiredStateMembers: ["R-AMBIGUOUS", "CI-UNKNOWN", "C-1"],
      requiredReplayEdges: [["R-AMBIGUOUS", "R-COLLAPSED"]],
    };
    const v = validateCompatibilityContract(contract);
    expect(v).toEqual([]);
  });

  it("contract demanding non-existent state member is rejected", () => {
    const contract: CompatibilityContract = {
      requiresMajor: 1,
      requiredStateMembers: ["BOGUS-MEMBER"],
      requiredReplayEdges: [],
    };
    const v = validateCompatibilityContract(contract);
    expect(v.some((x) => x.tag === "required-state-member-missing")).toBe(true);
  });

  it("contract demanding non-existent edge is rejected", () => {
    const contract: CompatibilityContract = {
      requiresMajor: 1,
      requiredStateMembers: [],
      requiredReplayEdges: [["R-OBSERVED", "R-COLLAPSED"]], // not in transitions
    };
    const v = validateCompatibilityContract(contract);
    expect(v.some((x) => x.tag === "required-replay-edge-missing")).toBe(true);
  });

  it("contract demanding higher major version is rejected", () => {
    const contract: CompatibilityContract = {
      requiresMajor: 99,
      requiredStateMembers: [],
      requiredReplayEdges: [],
    };
    const v = validateCompatibilityContract(contract);
    expect(v.some((x) => x.tag === "major-version-too-old")).toBe(true);
  });
});

describe("W2-PR41A — CI gate report", () => {
  it("clean baseline + clean contract ⇒ no gating", () => {
    const live = captureLiveKernel();
    const r = buildKernelFreezeReport(
      live,
      { requiresMajor: 1, requiredStateMembers: ["R-AMBIGUOUS"], requiredReplayEdges: [] },
      "2026-05-09T00:00:00Z",
    );
    expect(r.hasCiGatingCondition).toBe(false);
  });

  it("baseline with removed member ⇒ gating fires", () => {
    const live = captureLiveKernel();
    const claimed: FrozenKernelSurface = {
      ...live,
      replayStates: [...live.replayStates, "GHOST" as never],
    };
    const r = buildKernelFreezeReport(claimed, null, "2026-05-09T00:00:00Z");
    expect(r.hasCiGatingCondition).toBe(true);
  });

  it("null baseline + null contract ⇒ no gating (idempotent adoption)", () => {
    const r = buildKernelFreezeReport(null, null, "2026-05-09T00:00:00Z");
    expect(r.hasCiGatingCondition).toBe(false);
  });
});
