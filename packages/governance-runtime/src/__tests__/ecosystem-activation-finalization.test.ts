/**
 * W2-PR159A — Institutional Ecosystem Activation Finalization.
 *
 * Verification of ecosystem trust network primitives:
 *   - ENTITY_KINDS vocabulary (3 kinds)
 *   - propagateNetworkTrust — single node, linear chain, attenuation cap invariant,
 *     frozenness, ambiguityIntact passthrough
 *   - buildEcosystemReport — ambiguity-broken (CI gating), isolated-node detection,
 *     trust-amplified-beyond-self detection, hasCiGatingCondition flag
 *
 * Invariant: effectiveTrust ≤ selfTrust (no path amplification).
 * Doctrine: W2-PR62A (ecosystem trust propagation), W2-PR25A (ambiguity preservation).
 */

import { describe, expect, it } from "vitest";

import {
  ENTITY_KINDS,
  propagateNetworkTrust,
  buildEcosystemReport,
} from "../ecosystem-network.js";

import type { NetworkNode, TrustEdge } from "../ecosystem-network.js";

// ─── 1. ENTITY_KINDS vocabulary ──────────────────────────────────────────────

describe("W2-PR159A — ENTITY_KINDS vocabulary", () => {
  it("contains exactly 3 kinds", () => {
    expect(ENTITY_KINDS).toHaveLength(3);
  });

  it("contains ISSUER", () => expect(ENTITY_KINDS).toContain("ISSUER"));
  it("contains VERIFIER", () => expect(ENTITY_KINDS).toContain("VERIFIER"));
  it("contains AGGREGATOR", () => expect(ENTITY_KINDS).toContain("AGGREGATOR"));
});

// ─── 2. propagateNetworkTrust — single node ───────────────────────────────────

describe("W2-PR159A — propagateNetworkTrust: single node", () => {
  const node: NetworkNode = {
    entityId: "e1",
    kind: "ISSUER",
    selfTrust: 0.8,
    preservesAmbiguity: true,
  };

  const result = propagateNetworkTrust([node], []);

  it("returns one entry for a single-node network", () => {
    expect(result).toHaveLength(1);
  });

  it("effectiveTrust equals selfTrust when no inbound edges", () => {
    expect(result[0]?.effectiveTrust).toBeCloseTo(0.8);
  });

  it("ambiguityIntact reflects preservesAmbiguity", () => {
    expect(result[0]?.ambiguityIntact).toBe(true);
  });

  it("inboundEdgeCount is 0 for isolated node", () => {
    expect(result[0]?.inboundEdgeCount).toBe(0);
  });

  it("result array is frozen", () => {
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("result entries are frozen", () => {
    expect(Object.isFrozen(result[0])).toBe(true);
  });
});

// ─── 3. propagateNetworkTrust — two-node linear chain ────────────────────────

describe("W2-PR159A — propagateNetworkTrust: two-node linear chain", () => {
  const source: NetworkNode = {
    entityId: "src",
    kind: "ISSUER",
    selfTrust: 0.9,
    preservesAmbiguity: true,
  };
  const target: NetworkNode = {
    entityId: "tgt",
    kind: "VERIFIER",
    selfTrust: 0.7,
    preservesAmbiguity: true,
  };
  const edge: TrustEdge = {
    fromEntityId: "src",
    toEntityId: "tgt",
    attenuation: 0.8,
  };

  const result = propagateNetworkTrust([source, target], [edge]);

  it("returns two entries", () => {
    expect(result).toHaveLength(2);
  });

  it("target effectiveTrust is capped at selfTrust (not amplified by source)", () => {
    const tgt = result.find((p) => p.entityId === "tgt");
    expect(tgt).toBeDefined();
    // propagated = 0.9 * 0.8 = 0.72, but selfTrust = 0.7 → cap at 0.7
    expect(tgt!.effectiveTrust).toBeCloseTo(0.7);
  });

  it("target effectiveTrust does not exceed selfTrust", () => {
    const tgt = result.find((p) => p.entityId === "tgt");
    expect(tgt!.effectiveTrust).toBeLessThanOrEqual(target.selfTrust + 1e-9);
  });

  it("source effectiveTrust equals its own selfTrust (no inbound)", () => {
    const src = result.find((p) => p.entityId === "src");
    expect(src!.effectiveTrust).toBeCloseTo(0.9);
  });

  it("target inboundEdgeCount is 1", () => {
    const tgt = result.find((p) => p.entityId === "tgt");
    expect(tgt!.inboundEdgeCount).toBe(1);
  });

  it("source inboundEdgeCount is 0", () => {
    const src = result.find((p) => p.entityId === "src");
    expect(src!.inboundEdgeCount).toBe(0);
  });
});

// ─── 4. propagateNetworkTrust — cap invariant across all nodes ────────────────

describe("W2-PR159A — propagateNetworkTrust: cap invariant", () => {
  it("effectiveTrust ≤ selfTrust for every node in a multi-node network", () => {
    const nodes: NetworkNode[] = [
      { entityId: "a", kind: "ISSUER", selfTrust: 0.95, preservesAmbiguity: true },
      { entityId: "b", kind: "AGGREGATOR", selfTrust: 0.5, preservesAmbiguity: true },
      { entityId: "c", kind: "VERIFIER", selfTrust: 0.3, preservesAmbiguity: true },
    ];
    const edges: TrustEdge[] = [
      { fromEntityId: "a", toEntityId: "b", attenuation: 0.9 },
      { fromEntityId: "b", toEntityId: "c", attenuation: 0.9 },
    ];
    const result = propagateNetworkTrust(nodes, edges);
    for (const p of result) {
      const node = nodes.find((n) => n.entityId === p.entityId)!;
      expect(p.effectiveTrust).toBeLessThanOrEqual(node.selfTrust + 1e-9);
    }
  });

  it("high-trust source cannot amplify a low-trust target beyond its selfTrust", () => {
    const nodes: NetworkNode[] = [
      { entityId: "high", kind: "ISSUER", selfTrust: 1.0, preservesAmbiguity: true },
      { entityId: "low", kind: "VERIFIER", selfTrust: 0.1, preservesAmbiguity: true },
    ];
    const edges: TrustEdge[] = [
      { fromEntityId: "high", toEntityId: "low", attenuation: 1.0 },
    ];
    const result = propagateNetworkTrust(nodes, edges);
    const low = result.find((p) => p.entityId === "low")!;
    expect(low.effectiveTrust).toBeCloseTo(0.1);
  });
});

// ─── 5. propagateNetworkTrust — ambiguityIntact passthrough ──────────────────

describe("W2-PR159A — propagateNetworkTrust: ambiguityIntact passthrough", () => {
  it("node with preservesAmbiguity=false has ambiguityIntact=false", () => {
    const node: NetworkNode = {
      entityId: "broken",
      kind: "VERIFIER",
      selfTrust: 0.6,
      preservesAmbiguity: false,
    };
    const result = propagateNetworkTrust([node], []);
    expect(result[0]?.ambiguityIntact).toBe(false);
  });

  it("node with preservesAmbiguity=true has ambiguityIntact=true", () => {
    const node: NetworkNode = {
      entityId: "ok",
      kind: "ISSUER",
      selfTrust: 0.6,
      preservesAmbiguity: true,
    };
    const result = propagateNetworkTrust([node], []);
    expect(result[0]?.ambiguityIntact).toBe(true);
  });
});

// ─── 6. buildEcosystemReport — structure ─────────────────────────────────────

describe("W2-PR159A — buildEcosystemReport: structure", () => {
  const nodes: NetworkNode[] = [
    { entityId: "e1", kind: "ISSUER", selfTrust: 0.8, preservesAmbiguity: true },
  ];
  const NOW = "2026-05-10T00:00:00Z";
  const report = buildEcosystemReport(nodes, [], NOW);

  it("executedAt is the passed ISO string", () => {
    expect(report.executedAt).toBe(NOW);
  });

  it("propagated array is present", () => {
    expect(Array.isArray(report.propagated)).toBe(true);
  });

  it("findings array is present", () => {
    expect(Array.isArray(report.findings)).toBe(true);
  });

  it("report is frozen", () => {
    expect(Object.isFrozen(report)).toBe(true);
  });

  it("findings array is frozen", () => {
    expect(Object.isFrozen(report.findings)).toBe(true);
  });

  it("single-node network has no findings", () => {
    expect(report.findings).toHaveLength(0);
  });

  it("hasCiGatingCondition is false for clean single-node network", () => {
    expect(report.hasCiGatingCondition).toBe(false);
  });
});

// ─── 7. buildEcosystemReport — ambiguity-broken (CI gating) ──────────────────

describe("W2-PR159A — buildEcosystemReport: ambiguity-broken finding", () => {
  const nodes: NetworkNode[] = [
    { entityId: "e1", kind: "ISSUER", selfTrust: 0.8, preservesAmbiguity: false },
  ];
  const report = buildEcosystemReport(nodes, [], "2026-05-10T00:00:00Z");

  it("emits ambiguity-broken finding for node with preservesAmbiguity=false", () => {
    const ambig = report.findings.filter((f) => f.tag === "ambiguity-broken");
    expect(ambig.length).toBeGreaterThan(0);
  });

  it("ambiguity-broken finding has correct entityId", () => {
    const ambig = report.findings.find((f) => f.tag === "ambiguity-broken");
    expect(ambig?.entityId).toBe("e1");
  });

  it("hasCiGatingCondition is true when ambiguity-broken", () => {
    expect(report.hasCiGatingCondition).toBe(true);
  });
});

// ─── 8. buildEcosystemReport — isolated-node detection ───────────────────────

describe("W2-PR159A — buildEcosystemReport: isolated-node finding", () => {
  it("nodes with no inbound edges in a multi-node network emit isolated-node findings", () => {
    const nodes: NetworkNode[] = [
      { entityId: "connected", kind: "ISSUER", selfTrust: 0.8, preservesAmbiguity: true },
      { entityId: "isolated", kind: "VERIFIER", selfTrust: 0.5, preservesAmbiguity: true },
    ];
    const edges: TrustEdge[] = []; // no edges → both nodes have no inbound
    const report = buildEcosystemReport(nodes, edges, "2026-05-10T00:00:00Z");
    const isolated = report.findings.filter((f) => f.tag === "isolated-node");
    expect(isolated.length).toBeGreaterThan(0);
  });

  it("single-node network does NOT emit isolated-node (only flagged in multi-node)", () => {
    const nodes: NetworkNode[] = [
      { entityId: "solo", kind: "ISSUER", selfTrust: 0.9, preservesAmbiguity: true },
    ];
    const report = buildEcosystemReport(nodes, [], "2026-05-10T00:00:00Z");
    expect(report.findings.some((f) => f.tag === "isolated-node")).toBe(false);
  });

  it("connected target node does NOT emit isolated-node", () => {
    const nodes: NetworkNode[] = [
      { entityId: "a", kind: "ISSUER", selfTrust: 0.9, preservesAmbiguity: true },
      { entityId: "b", kind: "VERIFIER", selfTrust: 0.6, preservesAmbiguity: true },
    ];
    const edges: TrustEdge[] = [
      { fromEntityId: "a", toEntityId: "b", attenuation: 0.8 },
    ];
    const report = buildEcosystemReport(nodes, edges, "2026-05-10T00:00:00Z");
    // b has an inbound edge from a → b is NOT isolated
    expect(report.findings.some(
      (f) => f.tag === "isolated-node" && f.entityId === "b"
    )).toBe(false);
  });

  it("isolated-node does NOT set hasCiGatingCondition (it is informational only)", () => {
    const nodes: NetworkNode[] = [
      { entityId: "a", kind: "ISSUER", selfTrust: 0.9, preservesAmbiguity: true },
      { entityId: "b", kind: "VERIFIER", selfTrust: 0.6, preservesAmbiguity: true },
    ];
    const edges: TrustEdge[] = [];
    const report = buildEcosystemReport(nodes, edges, "2026-05-10T00:00:00Z");
    // isolated-node findings may exist but must not gate CI
    expect(report.hasCiGatingCondition).toBe(false);
  });
});

// ─── 9. buildEcosystemReport — trust-amplified-beyond-self detection ──────────

describe("W2-PR159A — buildEcosystemReport: trust-amplified-beyond-self", () => {
  it("does NOT emit trust-amplified-beyond-self when cap invariant holds", () => {
    const nodes: NetworkNode[] = [
      { entityId: "hi", kind: "ISSUER", selfTrust: 1.0, preservesAmbiguity: true },
      { entityId: "lo", kind: "VERIFIER", selfTrust: 0.2, preservesAmbiguity: true },
    ];
    const edges: TrustEdge[] = [
      { fromEntityId: "hi", toEntityId: "lo", attenuation: 1.0 },
    ];
    const report = buildEcosystemReport(nodes, edges, "2026-05-10T00:00:00Z");
    expect(report.findings.some((f) => f.tag === "trust-amplified-beyond-self")).toBe(false);
  });
});

// ─── 10. buildEcosystemReport — combined gating scenarios ────────────────────

describe("W2-PR159A — buildEcosystemReport: combined gating scenarios", () => {
  it("mixed network: ambiguity-broken node sets hasCiGatingCondition=true", () => {
    const nodes: NetworkNode[] = [
      { entityId: "clean", kind: "ISSUER", selfTrust: 0.9, preservesAmbiguity: true },
      { entityId: "broken", kind: "VERIFIER", selfTrust: 0.6, preservesAmbiguity: false },
    ];
    const edges: TrustEdge[] = [
      { fromEntityId: "clean", toEntityId: "broken", attenuation: 0.8 },
    ];
    const report = buildEcosystemReport(nodes, edges, "2026-05-10T00:00:00Z");
    expect(report.hasCiGatingCondition).toBe(true);
    expect(report.findings.some((f) => f.tag === "ambiguity-broken")).toBe(true);
  });

  it("fully-connected ambiguity-preserving network: no ambiguity-broken, hasCiGatingCondition=false", () => {
    const nodes: NetworkNode[] = [
      { entityId: "a", kind: "ISSUER", selfTrust: 0.9, preservesAmbiguity: true },
      { entityId: "b", kind: "AGGREGATOR", selfTrust: 0.7, preservesAmbiguity: true },
      { entityId: "c", kind: "VERIFIER", selfTrust: 0.5, preservesAmbiguity: true },
    ];
    const edges: TrustEdge[] = [
      { fromEntityId: "a", toEntityId: "b", attenuation: 0.8 },
      { fromEntityId: "b", toEntityId: "c", attenuation: 0.8 },
      { fromEntityId: "c", toEntityId: "a", attenuation: 0.8 }, // cycle back
    ];
    const report = buildEcosystemReport(nodes, edges, "2026-05-10T00:00:00Z");
    expect(report.hasCiGatingCondition).toBe(false);
    expect(report.findings.some((f) => f.tag === "ambiguity-broken")).toBe(false);
    expect(report.findings.some((f) => f.tag === "trust-amplified-beyond-self")).toBe(false);
  });

  it("empty network: zero propagated, zero findings", () => {
    const report = buildEcosystemReport([], [], "2026-05-10T00:00:00Z");
    expect(report.propagated).toHaveLength(0);
    expect(report.findings).toHaveLength(0);
    expect(report.hasCiGatingCondition).toBe(false);
  });
});
