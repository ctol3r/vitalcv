/**
 * graphSimulation.ts — Wave 84: In-Memory Graph Simulation Layer
 *
 * Clones the trust graph in memory, applies a simulated event,
 * and recalculates decision dependencies and trust state.
 *
 * No database mutations — purely in-memory analysis.
 */

import type { IntelligentGraph, IntelligentNode, IntelligentEdge } from '../graph/graphEngine';

// ── Types ─────────────────────────────────────────────────────────────

export type SimulationEvent =
  | { type: 'credential_expired'; credentialId: string }
  | { type: 'credential_revoked'; credentialId: string }
  | { type: 'credential_added'; credentialId: string; issuerNodeId: string; label: string }
  | { type: 'issuer_revoked'; issuerNodeId: string };

export interface SimulatedGraph {
  nodes: IntelligentNode[];
  edges: IntelligentEdge[];
  affectedNodeIds: Set<string>;
  cascadeDepth: number;
}

// ── Clone ─────────────────────────────────────────────────────────────

function cloneGraph(graph: IntelligentGraph): { nodes: IntelligentNode[]; edges: IntelligentEdge[] } {
  return {
    nodes: graph.nodes.map((n) => ({ ...n, metadata: n.metadata ? { ...n.metadata } : undefined })),
    edges: graph.edges.map((e) => ({ ...e })),
  };
}

// ── BFS Cascade ───────────────────────────────────────────────────────

function cascadeFrom(startIds: string[], edges: IntelligentEdge[]): { visited: Set<string>; maxDepth: number } {
  const adj = new Map<string, Set<string>>();
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, new Set());
    if (!adj.has(e.target)) adj.set(e.target, new Set());
    adj.get(e.source)!.add(e.target);
    adj.get(e.target)!.add(e.source);
  }

  const visited = new Set<string>();
  const queue: Array<{ id: string; depth: number }> = startIds.map((id) => ({ id, depth: 0 }));
  let maxDepth = 0;

  while (queue.length > 0) {
    const item = queue.shift()!;
    if (visited.has(item.id)) continue;
    visited.add(item.id);
    maxDepth = Math.max(maxDepth, item.depth);

    const neighbors = adj.get(item.id);
    if (neighbors) {
      for (const n of neighbors) {
        if (!visited.has(n)) queue.push({ id: n, depth: item.depth + 1 });
      }
    }
  }

  return { visited, maxDepth };
}

// ── Event Application ─────────────────────────────────────────────────

export function applyEvent(graph: IntelligentGraph, event: SimulationEvent): SimulatedGraph {
  const { nodes, edges } = cloneGraph(graph);
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  switch (event.type) {
    case 'credential_expired': {
      const cred = nodeMap.get(event.credentialId);
      if (cred) {
        cred.status = 'EXPIRED';
        cred.trustState = 'expired';
        cred.decisionRisk = 'HIGH';
      }
      const { visited, maxDepth } = cascadeFrom([event.credentialId], edges);
      return { nodes, edges, affectedNodeIds: visited, cascadeDepth: maxDepth };
    }

    case 'credential_revoked': {
      const cred = nodeMap.get(event.credentialId);
      if (cred) {
        cred.status = 'REVOKED';
        cred.trustState = 'revoked';
        cred.decisionRisk = 'CRITICAL';
      }
      const { visited, maxDepth } = cascadeFrom([event.credentialId], edges);
      // Also mark dependent decisions
      for (const id of visited) {
        const node = nodeMap.get(id);
        if (node?.group === 'decision') {
          node.status = 'AT_RISK';
          node.decisionRisk = 'HIGH';
        }
      }
      return { nodes, edges, affectedNodeIds: visited, cascadeDepth: maxDepth };
    }

    case 'credential_added': {
      const clinicianNode = nodes.find((n) => n.group === 'clinician');
      if (clinicianNode) {
        nodes.push({
          id: event.credentialId,
          label: event.label,
          group: 'credential',
          status: 'Valid',
          trustState: 'verified',
          decisionRisk: 'LOW',
          val: 10,
        });
        edges.push({ source: event.issuerNodeId, target: event.credentialId, label: 'issued_by' });
        edges.push({ source: event.credentialId, target: clinicianNode.id, label: 'verified_by' });
      }
      return { nodes, edges, affectedNodeIds: new Set([event.credentialId]), cascadeDepth: 0 };
    }

    case 'issuer_revoked': {
      const issuer = nodeMap.get(event.issuerNodeId);
      if (issuer) {
        issuer.decisionRisk = 'CRITICAL';
        issuer.metadata = { ...issuer.metadata, trust: 'REVOKED' };
      }
      // All credentials from this issuer become at-risk
      const issuedEdges = edges.filter((e) => e.source === event.issuerNodeId && e.label === 'issued_by');
      const affectedCredIds = issuedEdges.map((e) => e.target);
      for (const credId of affectedCredIds) {
        const cred = nodeMap.get(credId);
        if (cred) {
          cred.decisionRisk = 'HIGH';
          cred.trustState = 'issuer_revoked';
        }
      }
      const { visited, maxDepth } = cascadeFrom([event.issuerNodeId, ...affectedCredIds], edges);
      return { nodes, edges, affectedNodeIds: visited, cascadeDepth: maxDepth };
    }
  }
}
