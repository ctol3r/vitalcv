/**
 * supersessionLineage.ts — W2-PR44A
 *
 * Deterministic supersession chain reconstruction.
 *
 * A "lineage" for an artifact is the ordered set of ancestors and
 * descendants connected by supersession edges. Cycles are not permitted
 * and are surfaced explicitly via the cycleDetected flag.
 *
 * Determinism:
 *   - Traversal order: BFS, with neighbor lists sorted lexicographically.
 *   - Output ancestors/descendants are ordered by (depth asc, artifactId asc).
 */

import type { LifecycleGraph } from './types';

export interface LineageNode {
  artifactId: string;
  depth: number;
  reachedViaEventIds: string[]; // edges traversed to reach this node, sorted
}

export interface SupersessionLineage {
  rootArtifactId: string;
  ancestors: LineageNode[];
  descendants: LineageNode[];
  cycleDetected: boolean;
  lineageHash: string; // deterministic fingerprint of the lineage shape
}

import { createHash } from 'crypto';

function traverse(
  startId: string,
  adjacency: ReadonlyMap<string, string[]>,
  edgeEvents: ReadonlyMap<string, string[]>,
): { nodes: LineageNode[]; cycle: boolean } {
  const visited = new Set<string>([startId]);
  const queue: Array<{ id: string; depth: number }> = [{ id: startId, depth: 0 }];
  const out: LineageNode[] = [];
  let cycle = false;

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.depth > 0) {
      const reached = edgeEvents.get(`${startId}|${current.id}`) ?? [];
      out.push({
        artifactId: current.id,
        depth: current.depth,
        reachedViaEventIds: [...reached].sort(),
      });
    }
    const neighbors = [...(adjacency.get(current.id) ?? [])].sort();
    for (const neighbor of neighbors) {
      if (neighbor === startId) {
        cycle = true;
        continue;
      }
      if (visited.has(neighbor)) {
        cycle = true;
        continue;
      }
      visited.add(neighbor);
      queue.push({ id: neighbor, depth: current.depth + 1 });
    }
  }

  out.sort((a, b) => {
    if (a.depth !== b.depth) return a.depth - b.depth;
    return a.artifactId < b.artifactId ? -1 : a.artifactId > b.artifactId ? 1 : 0;
  });

  return { nodes: out, cycle };
}

export function reconstructLineage(graph: LifecycleGraph, artifactId: string): SupersessionLineage {
  // Build a per-pair edge event index so each lineage node knows which event
  // edge was traversed (preserves audit trail).
  const ancestorEdgeEvents = new Map<string, string[]>();
  const descendantEdgeEvents = new Map<string, string[]>();
  for (const edge of graph.supersessionEdges) {
    const ancKey = `${artifactId}|${edge.fromArtifactId}`;
    const descKey = `${artifactId}|${edge.toArtifactId}`;
    if (edge.toArtifactId === artifactId || isReachable(graph.predecessorsByArtifact, artifactId, edge.toArtifactId)) {
      const list = ancestorEdgeEvents.get(ancKey) ?? [];
      list.push(edge.establishedByEventId);
      ancestorEdgeEvents.set(ancKey, list);
    }
    if (edge.fromArtifactId === artifactId || isReachable(graph.successorsByArtifact, artifactId, edge.fromArtifactId)) {
      const list = descendantEdgeEvents.get(descKey) ?? [];
      list.push(edge.establishedByEventId);
      descendantEdgeEvents.set(descKey, list);
    }
  }

  const ancestors = traverse(artifactId, graph.predecessorsByArtifact, ancestorEdgeEvents);
  const descendants = traverse(artifactId, graph.successorsByArtifact, descendantEdgeEvents);

  const lineageHash = createHash('sha256')
    .update(
      JSON.stringify({
        root: artifactId,
        ancestors: ancestors.nodes.map(n => ({ id: n.artifactId, depth: n.depth })),
        descendants: descendants.nodes.map(n => ({ id: n.artifactId, depth: n.depth })),
      }),
    )
    .digest('hex');

  return {
    rootArtifactId: artifactId,
    ancestors: ancestors.nodes,
    descendants: descendants.nodes,
    cycleDetected: ancestors.cycle || descendants.cycle,
    lineageHash,
  };
}

function isReachable(
  adjacency: ReadonlyMap<string, string[]>,
  from: string,
  target: string,
): boolean {
  if (from === target) return true;
  const visited = new Set<string>([from]);
  const stack = [from];
  while (stack.length > 0) {
    const current = stack.pop()!;
    const neighbors = adjacency.get(current) ?? [];
    for (const n of neighbors) {
      if (n === target) return true;
      if (!visited.has(n)) {
        visited.add(n);
        stack.push(n);
      }
    }
  }
  return false;
}

/**
 * Verify that every supersession edge in the graph has both endpoints in the
 * node set. Dangling edges break replay determinism.
 */
export function findDanglingSupersessionEdges(graph: LifecycleGraph): Array<{
  edgeKey: string;
  missingEndpoint: 'from' | 'to' | 'both';
}> {
  const dangling: Array<{ edgeKey: string; missingEndpoint: 'from' | 'to' | 'both' }> = [];
  for (const edge of graph.supersessionEdges) {
    const fromMissing = !graph.nodes.has(edge.fromArtifactId);
    const toMissing = !graph.nodes.has(edge.toArtifactId);
    if (fromMissing && toMissing) {
      dangling.push({ edgeKey: edge.deterministicKey, missingEndpoint: 'both' });
    } else if (fromMissing) {
      dangling.push({ edgeKey: edge.deterministicKey, missingEndpoint: 'from' });
    } else if (toMissing) {
      dangling.push({ edgeKey: edge.deterministicKey, missingEndpoint: 'to' });
    }
  }
  return dangling;
}
