/**
 * Ecosystem trust network convergence (W2-PR62A).
 *
 * Pure model for issuer/verifier topology + bounded trust propagation.
 * Trust propagates along edges with attenuation; no cycle yields
 * unbounded amplification.
 */

export const ENTITY_KINDS = ["ISSUER", "VERIFIER", "AGGREGATOR"] as const;
export type EntityKind = (typeof ENTITY_KINDS)[number];

export interface NetworkNode {
  readonly entityId: string;
  readonly kind: EntityKind;
  /** Self-declared trust level 0..1; caller-supplied. */
  readonly selfTrust: number;
  /** Whether this entity is currently emitting ambiguity-preserving outputs. */
  readonly preservesAmbiguity: boolean;
}

export interface TrustEdge {
  readonly fromEntityId: string;
  readonly toEntityId: string;
  /** Attenuation factor 0..1 — how much of from's trust transfers to. */
  readonly attenuation: number;
}

export interface PropagatedTrust {
  readonly entityId: string;
  /** 0..1 — propagated trust capped by self-trust. */
  readonly effectiveTrust: number;
  readonly ambiguityIntact: boolean;
  readonly inboundEdgeCount: number;
}

/**
 * Compute propagated trust per node. Single-pass BFS from every source;
 * caps at self-trust; multiplies by attenuation; takes max-over-paths.
 * Cycles are bounded because attenuation < 1.
 */
export function propagateNetworkTrust(
  nodes: readonly NetworkNode[],
  edges: readonly TrustEdge[],
  maxHops: number = 4,
): readonly PropagatedTrust[] {
  const byId = new Map<string, NetworkNode>();
  for (const n of nodes) byId.set(n.entityId, n);

  const out: PropagatedTrust[] = [];
  for (const target of nodes) {
    let best = target.selfTrust;
    let inbound = 0;
    for (const source of nodes) {
      if (source.entityId === target.entityId) continue;
      // BFS up to maxHops
      const visited = new Set<string>();
      type Frame = { node: string; trust: number; hops: number };
      const stack: Frame[] = [{ node: source.entityId, trust: source.selfTrust, hops: 0 }];
      while (stack.length > 0) {
        const cur = stack.pop()!;
        if (visited.has(cur.node) || cur.hops > maxHops) continue;
        visited.add(cur.node);
        if (cur.node === target.entityId) {
          if (cur.trust > best) best = cur.trust;
          inbound += 1;
          continue;
        }
        for (const e of edges) {
          if (e.fromEntityId !== cur.node) continue;
          stack.push({ node: e.toEntityId, trust: cur.trust * e.attenuation, hops: cur.hops + 1 });
        }
      }
    }
    if (best > target.selfTrust) best = target.selfTrust;
    out.push(Object.freeze({
      entityId: target.entityId,
      effectiveTrust: best,
      ambiguityIntact: target.preservesAmbiguity,
      inboundEdgeCount: inbound,
    }));
  }
  return Object.freeze(out);
}

export interface EcosystemReport {
  readonly executedAt: string;
  readonly propagated: readonly PropagatedTrust[];
  readonly findings: readonly (
    | { readonly tag: "ambiguity-broken"; readonly entityId: string }
    | { readonly tag: "isolated-node"; readonly entityId: string }
    | { readonly tag: "trust-amplified-beyond-self"; readonly entityId: string; readonly effective: number; readonly self: number }
  )[];
  readonly hasCiGatingCondition: boolean;
}

export function buildEcosystemReport(
  nodes: readonly NetworkNode[],
  edges: readonly TrustEdge[],
  nowIso: string,
): EcosystemReport {
  const propagated = propagateNetworkTrust(nodes, edges);
  const byId = new Map<string, NetworkNode>();
  for (const n of nodes) byId.set(n.entityId, n);
  const findings: EcosystemReport["findings"][number][] = [];
  let gating = false;
  for (const p of propagated) {
    const n = byId.get(p.entityId);
    if (!n) continue;
    if (!p.ambiguityIntact) {
      findings.push({ tag: "ambiguity-broken", entityId: p.entityId });
      gating = true;
    }
    if (p.inboundEdgeCount === 0 && nodes.length > 1) {
      findings.push({ tag: "isolated-node", entityId: p.entityId });
    }
    // Cap invariant — no path may amplify a node beyond its own self-trust
    if (p.effectiveTrust - n.selfTrust > 1e-9) {
      findings.push({ tag: "trust-amplified-beyond-self", entityId: p.entityId, effective: p.effectiveTrust, self: n.selfTrust });
      gating = true;
    }
  }
  return Object.freeze({
    executedAt: nowIso,
    propagated,
    findings: Object.freeze(findings),
    hasCiGatingCondition: gating,
  });
}
