import { describe, expect, it } from "vitest";
import {
  buildDistributedResilienceReport,
  NODE_HEALTH,
  RESILIENCE_TIERS,
  scoreDistributedResilience,
  type NodeObservation,
  type QuorumConfig,
} from "../distributed-resilience.js";

const cfg: QuorumConfig = { totalNodes: 5, quorumThreshold: 3, replayLineageMin: 2 };

function obs(o: Partial<NodeObservation> & { nodeId: string }): NodeObservation {
  return {
    health: "HEALTHY",
    lastSeenIso: "2026-05-09T00:00:00Z",
    carriesReplayLineage: true,
    ...o,
  };
}

describe("W2-PR59A — taxonomy", () => {
  it("NODE_HEALTH includes UNKNOWN (ambiguity-preserving)", () => {
    expect(NODE_HEALTH).toContain("UNKNOWN");
  });
  it("RESILIENCE_TIERS has 4 including FAILED-CLOSED", () => {
    expect(RESILIENCE_TIERS).toContain("FAILED-CLOSED");
  });
});

describe("W2-PR59A — scoring", () => {
  it("all healthy + lineage ⇒ RESILIENT", () => {
    const r = scoreDistributedResilience(
      Array.from({ length: 5 }).map((_, i) => obs({ nodeId: `n-${i}` })),
      cfg,
    );
    expect(r.tier).toBe("RESILIENT");
    expect(r.meetsQuorum).toBe(true);
  });
  it("3 partitioned, 2 healthy → quorum not met → FAILED-CLOSED", () => {
    const observations: NodeObservation[] = [
      obs({ nodeId: "n-1" }),
      obs({ nodeId: "n-2" }),
      obs({ nodeId: "n-3", health: "PARTITIONED" }),
      obs({ nodeId: "n-4", health: "PARTITIONED" }),
      obs({ nodeId: "n-5", health: "PARTITIONED", carriesReplayLineage: false }),
    ];
    const r = scoreDistributedResilience(observations, cfg);
    expect(["FAILED-CLOSED", "PARTITIONED", "DEGRADED"]).toContain(r.tier);
    expect(r.meetsQuorum).toBe(false);
  });
  it("UNKNOWN nodes preserve ambiguity (counted as nonVoting, not healthy)", () => {
    const observations: NodeObservation[] = [
      obs({ nodeId: "n-1" }),
      obs({ nodeId: "n-2", health: "UNKNOWN" }),
      obs({ nodeId: "n-3", health: "UNKNOWN" }),
      obs({ nodeId: "n-4" }),
      obs({ nodeId: "n-5" }),
    ];
    const r = scoreDistributedResilience(observations, cfg);
    expect(r.nonVotingNodes).toBe(2);
    expect(r.votingNodes).toBe(3);
    expect(r.partialTrustExplicit).toBe(true);
  });
  it("replay quorum not met → fail-closed scoring drop", () => {
    const observations: NodeObservation[] = Array.from({ length: 5 }).map((_, i) =>
      obs({ nodeId: `n-${i}`, carriesReplayLineage: i === 0 }),
    );
    const r = scoreDistributedResilience(observations, cfg);
    expect(r.meetsReplayQuorum).toBe(false);
  });
});

describe("W2-PR59A — CI gate + chaos", () => {
  it("CHAOS: full healthy fleet → no gating", () => {
    const r = buildDistributedResilienceReport(
      Array.from({ length: 5 }).map((_, i) => obs({ nodeId: `n-${i}` })),
      cfg,
      "2026-05-09T00:00:00Z",
    );
    expect(r.hasCiGatingCondition).toBe(false);
  });
  it("CHAOS: majority partitioned → CI fails", () => {
    const observations: NodeObservation[] = [
      obs({ nodeId: "n-1", health: "PARTITIONED" }),
      obs({ nodeId: "n-2", health: "PARTITIONED" }),
      obs({ nodeId: "n-3", health: "PARTITIONED" }),
      obs({ nodeId: "n-4" }),
      obs({ nodeId: "n-5" }),
    ];
    const r = buildDistributedResilienceReport(observations, cfg, "2026-05-09T00:00:00Z");
    expect(r.hasCiGatingCondition).toBe(true);
    expect(r.findings.some((f) => f.tag === "majority-partitioned")).toBe(true);
  });
});
