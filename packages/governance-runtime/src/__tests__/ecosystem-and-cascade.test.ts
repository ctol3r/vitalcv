import { describe, expect, it } from "vitest";
import {
  buildEcosystemReport,
  ENTITY_KINDS,
  propagateNetworkTrust,
  type NetworkNode,
  type TrustEdge,
} from "../ecosystem-network.js";
import {
  buildRevocationCascadeReport,
  computeRevocationCascade,
} from "../revocation-cascade.js";
import { computeGrantId, type DelegationGrant } from "../delegated-trust.js";

// ---------------------------------------------------------------------------
// W2-PR62A — ecosystem network
// ---------------------------------------------------------------------------

describe("W2-PR62A — ecosystem trust network", () => {
  const nodes: NetworkNode[] = [
    { entityId: "issuer-a", kind: "ISSUER", selfTrust: 0.9, preservesAmbiguity: true },
    { entityId: "verifier-b", kind: "VERIFIER", selfTrust: 0.7, preservesAmbiguity: true },
    { entityId: "aggregator-c", kind: "AGGREGATOR", selfTrust: 0.5, preservesAmbiguity: true },
  ];
  const edges: TrustEdge[] = [
    { fromEntityId: "issuer-a", toEntityId: "verifier-b", attenuation: 0.8 },
    { fromEntityId: "verifier-b", toEntityId: "aggregator-c", attenuation: 0.6 },
  ];

  it("ENTITY_KINDS has 3", () => expect(ENTITY_KINDS.length).toBe(3));

  it("trust never exceeds self-trust (cap invariant)", () => {
    const propagated = propagateNetworkTrust(nodes, edges);
    for (const p of propagated) {
      const self = nodes.find((n) => n.entityId === p.entityId)!.selfTrust;
      expect(p.effectiveTrust).toBeLessThanOrEqual(self + 1e-9);
    }
  });

  it("ambiguity-broken node fires CI gating", () => {
    const tampered: NetworkNode[] = [
      ...nodes.slice(0, 2),
      { ...nodes[2]!, preservesAmbiguity: false },
    ];
    const r = buildEcosystemReport(tampered, edges, "2026-05-09T00:00:00Z");
    expect(r.hasCiGatingCondition).toBe(true);
    expect(r.findings.some((f) => f.tag === "ambiguity-broken")).toBe(true);
  });

  it("cycles bounded by attenuation (no unbounded amplification)", () => {
    const cycleEdges: TrustEdge[] = [
      ...edges,
      { fromEntityId: "aggregator-c", toEntityId: "issuer-a", attenuation: 0.5 },
    ];
    const propagated = propagateNetworkTrust(nodes, cycleEdges, 8);
    for (const p of propagated) {
      const self = nodes.find((n) => n.entityId === p.entityId)!.selfTrust;
      expect(p.effectiveTrust).toBeLessThanOrEqual(self + 1e-9);
    }
  });
});

// ---------------------------------------------------------------------------
// W2-PR63A — revocation cascade
// ---------------------------------------------------------------------------

function grant(o: Partial<DelegationGrant> = {}): DelegationGrant {
  const base = {
    delegatorId: "u-owner",
    delegateId: "u-mid",
    grantedActions: ["READ_GOVERNANCE_STATE"] as const,
    subjectScope: ["org:acme"] as const,
    issuedAt: "2026-05-09T00:00:00Z",
    expiresAt: "2026-05-12T00:00:00Z",
    parentGrantId: null,
  };
  return {
    grantId: computeGrantId(base),
    state: "ACTIVE",
    stateReason: null,
    ...base,
    ...o,
  };
}

describe("W2-PR63A — revocation cascade", () => {
  it("direct + transitive descendants are computed deterministically", () => {
    const root = grant({ delegateId: "mid", grantedActions: ["READ_GOVERNANCE_STATE"] as const });
    const childA = grant({
      delegatorId: "mid",
      delegateId: "junior-a",
      parentGrantId: root.grantId,
    });
    const childAWithId = { ...childA, grantId: computeGrantId({ ...childA, parentGrantId: root.grantId }) };
    const grandchild = grant({
      delegatorId: "junior-a",
      delegateId: "intern",
      parentGrantId: childAWithId.grantId,
    });
    const grandchildWithId = { ...grandchild, grantId: computeGrantId({ ...grandchild, parentGrantId: childAWithId.grantId }) };
    const result = computeRevocationCascade(
      [root, childAWithId, grandchildWithId],
      { revokedGrantId: root.grantId, reason: "owner removed", revokedAt: "2026-05-10T00:00:00Z" },
    );
    expect(result.directlyRevoked).toContain(childAWithId.grantId);
    expect(result.cascadeRevokedDescendants).toContain(grandchildWithId.grantId);
    expect(result.blastRadiusScore).toBeGreaterThan(0);
  });

  it("CHAOS: cascade with active descendant → CI gating fires", () => {
    const root = grant();
    const child = grant({ delegatorId: "mid", parentGrantId: root.grantId });
    const childWithId = { ...child, grantId: computeGrantId({ ...child, parentGrantId: root.grantId }) };
    const r = buildRevocationCascadeReport(
      [root, childWithId],
      { revokedGrantId: root.grantId, reason: "owner removed", revokedAt: "2026-05-10T00:00:00Z" },
      "2026-05-10T00:00:00Z",
    );
    expect(r.hasCiGatingCondition).toBe(true);
    expect(r.findings.some((f) => f.tag === "uncollapsed-descendant-active")).toBe(true);
  });

  it("idempotency: identical inputs ⇒ identical cascade", () => {
    const root = grant();
    const child = grant({ delegatorId: "mid", parentGrantId: root.grantId });
    const childWithId = { ...child, grantId: computeGrantId({ ...child, parentGrantId: root.grantId }) };
    const ev = { revokedGrantId: root.grantId, reason: "x", revokedAt: "2026-05-10T00:00:00Z" };
    const a = computeRevocationCascade([root, childWithId], ev);
    const b = computeRevocationCascade([root, childWithId], ev);
    expect(a.cascadeRevokedDescendants).toEqual(b.cascadeRevokedDescendants);
  });
});
