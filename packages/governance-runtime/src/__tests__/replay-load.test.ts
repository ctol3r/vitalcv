/**
 * W2-PR113A — Multi-institution replay load testing + chaos.
 */

import { describe, expect, it } from "vitest";
import {
  buildReplayLoadReport,
  deriveContentionMap,
  SATURATION_LEVELS,
  simulateReplayLoad,
  type OrgWorkload,
  type SystemCapacity,
} from "../replay-load.js";

const NOW = "2026-05-10T00:00:00Z";

const SMALL_CAP: SystemCapacity = {
  cpuUnitsPerSecond: 1000,
  maxConcurrentInFlight: 200,
  baseLatencyMs: 20,
};

function org(o: Partial<OrgWorkload> & { orgId: string }): OrgWorkload {
  return {
    requestsPerSecond: 100,
    ambiguityRatio: 0.1,
    cpuCostPerRequest: 1,
    ...o,
  };
}

describe("W2-PR113A — taxonomy", () => {
  it("SATURATION_LEVELS has 5 tiers", () => {
    expect(SATURATION_LEVELS.length).toBe(5);
    expect(SATURATION_LEVELS).toContain("COLLAPSED");
  });
});

describe("W2-PR113A — simulator determinism + saturation tiers", () => {
  it("identical input ⇒ identical simulationHash", () => {
    const workloads = [org({ orgId: "a" }), org({ orgId: "b" })];
    const a = simulateReplayLoad(workloads, SMALL_CAP, NOW);
    const b = simulateReplayLoad(workloads, SMALL_CAP, NOW);
    expect(a.simulationHash).toBe(b.simulationHash);
  });

  it("input order does not affect simulationHash", () => {
    const a = simulateReplayLoad([org({ orgId: "a" }), org({ orgId: "b" })], SMALL_CAP, NOW);
    const b = simulateReplayLoad([org({ orgId: "b" }), org({ orgId: "a" })], SMALL_CAP, NOW);
    expect(a.simulationHash).toBe(b.simulationHash);
  });

  it("low load ⇒ UNDERUTILIZED", () => {
    const sim = simulateReplayLoad([org({ orgId: "a", requestsPerSecond: 100 })], SMALL_CAP, NOW);
    expect(sim.saturationLevel).toBe("UNDERUTILIZED");
    expect(sim.perOrg[0]!.contended).toBe(false);
  });

  it("modest load ⇒ HEALTHY", () => {
    const sim = simulateReplayLoad([org({ orgId: "a", requestsPerSecond: 500 })], SMALL_CAP, NOW);
    expect(sim.saturationLevel).toBe("HEALTHY");
  });

  it("near-cap ⇒ PRESSURED", () => {
    const sim = simulateReplayLoad([org({ orgId: "a", requestsPerSecond: 900 })], SMALL_CAP, NOW);
    expect(sim.saturationLevel).toBe("PRESSURED");
  });

  it("over-cap ⇒ SATURATED with proportional dropping", () => {
    const sim = simulateReplayLoad(
      [org({ orgId: "a", requestsPerSecond: 1000 }), org({ orgId: "b", requestsPerSecond: 1000 })],
      SMALL_CAP,
      NOW,
    );
    expect(sim.saturationLevel === "SATURATED" || sim.saturationLevel === "COLLAPSED").toBe(true);
    expect(sim.aggregateServedRatio).toBeLessThan(1);
    expect(sim.perOrg[0]!.droppedRps).toBeGreaterThan(0);
    expect(sim.perOrg[1]!.droppedRps).toBeGreaterThan(0);
  });
});

describe("W2-PR113A — proportional fairness", () => {
  it("equal-priority orgs receive proportional service under saturation", () => {
    const sim = simulateReplayLoad(
      [org({ orgId: "a", requestsPerSecond: 1000 }), org({ orgId: "b", requestsPerSecond: 1000 })],
      SMALL_CAP,
      NOW,
    );
    const ratioA = sim.perOrg[0]!.servedRps / sim.perOrg[0]!.offeredRps;
    const ratioB = sim.perOrg[1]!.servedRps / sim.perOrg[1]!.offeredRps;
    expect(Math.abs(ratioA - ratioB)).toBeLessThan(0.01);
  });

  it("contention map shows contended orgs and zero unfairness in proportional model", () => {
    const sim = simulateReplayLoad(
      [org({ orgId: "a", requestsPerSecond: 1000 }), org({ orgId: "b", requestsPerSecond: 1000 })],
      SMALL_CAP,
      NOW,
    );
    const c = deriveContentionMap(sim);
    expect(c.contendedOrgs.length).toBe(2);
    expect(c.maxFairnessGap).toBeLessThan(0.01);
  });
});

describe("W2-PR113A — ambiguity preservation under load", () => {
  it("ambiguity ratio matches offered ratio (no silent erasure)", () => {
    const sim = simulateReplayLoad(
      [org({ orgId: "a", requestsPerSecond: 2000, ambiguityRatio: 0.4 })],
      SMALL_CAP,
      NOW,
    );
    expect(sim.perOrg[0]!.observedAmbiguityRatio).toBeCloseTo(0.4);
    expect(sim.ambiguityErasureDetected).toBe(false);
  });
});

describe("W2-PR113A — TARGET 6: load chaos", () => {
  it("CHAOS: COLLAPSED tier fires when in-flight exceeds maxConcurrentInFlight", () => {
    const tinyCap: SystemCapacity = { cpuUnitsPerSecond: 100000, maxConcurrentInFlight: 10, baseLatencyMs: 100 };
    const sim = simulateReplayLoad([org({ orgId: "a", requestsPerSecond: 5000 })], tinyCap, NOW);
    expect(sim.saturationLevel).toBe("COLLAPSED");
  });

  it("CHAOS: p99 latency spike fires CI gate", () => {
    const r = buildReplayLoadReport(
      [org({ orgId: "a", requestsPerSecond: 5000 })],
      SMALL_CAP,
      NOW,
      { p99LatencyThresholdMs: 100 },
    );
    expect(r.findings.some((f) => f.tag === "p99-latency-spike")).toBe(true);
  });

  it("CHAOS: served ratio below floor fires CI gate", () => {
    const r = buildReplayLoadReport(
      [org({ orgId: "a", requestsPerSecond: 10000 })],
      SMALL_CAP,
      NOW,
    );
    expect(r.findings.some((f) => f.tag === "served-ratio-below-floor")).toBe(true);
  });

  it("CHAOS: empty workload ⇒ no findings, no gating", () => {
    const r = buildReplayLoadReport([], SMALL_CAP, NOW);
    expect(r.hasCiGatingCondition).toBe(false);
  });

  it("CHAOS: zero-capacity system fails closed (utilization=∞ ⇒ SATURATED+findings)", () => {
    const zeroCap: SystemCapacity = { cpuUnitsPerSecond: 0, maxConcurrentInFlight: 100, baseLatencyMs: 20 };
    const r = buildReplayLoadReport([org({ orgId: "a" })], zeroCap, NOW);
    expect(r.hasCiGatingCondition).toBe(true);
  });
});
