import type { GraphEdge, GraphNode } from '../../services/graph-engine/schema';
import type { GraphCentralityScore } from './centrality';
import { buildUndirectedAdjacency } from './centrality';

export interface EdgeStrengthScore {
  edgeId: string;
  strength: number;
  band: 'weak' | 'moderate' | 'strong';
  signals: string[];
}

export interface EdgeStrengthResult {
  scores: Map<string, EdgeStrengthScore>;
  averageStrength: number;
  maxStrength: number;
}

function jaccard(left: Set<string>, right: Set<string>): number {
  const union = new Set<string>([...left, ...right]);
  if (union.size === 0) return 0;
  let intersection = 0;
  for (const value of left) {
    if (right.has(value)) intersection += 1;
  }
  return intersection / union.size;
}

export function scoreRelationshipEdges(
  nodes: GraphNode[],
  edges: GraphEdge[],
  options: {
    centrality: Map<string, GraphCentralityScore>;
    clusterAssignments?: Map<string, string>;
  },
): EdgeStrengthResult {
  const adjacency = buildUndirectedAdjacency(nodes, edges);
  const scores = new Map<string, EdgeStrengthScore>();
  let totalStrength = 0;
  let maxStrength = 0;

  for (const edge of edges) {
    const baseConfidence = Math.max(0, Math.min(edge.confidence ?? 0.5, 1));
    const edgeWeight = Math.max(0, Math.min(edge.weight ?? baseConfidence, 1));
    const sourceNeighbors = new Set(adjacency.get(edge.source)?.keys() ?? []);
    const targetNeighbors = new Set(adjacency.get(edge.target)?.keys() ?? []);
    sourceNeighbors.delete(edge.target);
    targetNeighbors.delete(edge.source);

    const structuralOverlap = jaccard(sourceNeighbors, targetNeighbors);
    const centralitySignal = Math.min(
      1,
      ((options.centrality.get(edge.source)?.composite ?? 0)
        + (options.centrality.get(edge.target)?.composite ?? 0)) / 2,
    );
    const sameCluster = options.clusterAssignments
      && options.clusterAssignments.get(edge.source)
      && options.clusterAssignments.get(edge.source) === options.clusterAssignments.get(edge.target)
      ? 1
      : 0;
    const reciprocalSignal = edge.reciprocal || !edge.directed ? 1 : 0;

    const strength = Math.min(
      1,
      baseConfidence * 0.4
      + edgeWeight * 0.15
      + structuralOverlap * 0.15
      + centralitySignal * 0.15
      + sameCluster * 0.075
      + reciprocalSignal * 0.075,
    );

    const signals: string[] = [
      `confidence=${baseConfidence.toFixed(2)}`,
      `shared_neighbors=${structuralOverlap.toFixed(2)}`,
      `centrality=${centralitySignal.toFixed(2)}`,
    ];
    if (sameCluster) signals.push('same_cluster');
    if (reciprocalSignal) signals.push('reciprocal');

    const band = strength >= 0.75 ? 'strong' : strength >= 0.5 ? 'moderate' : 'weak';
    const roundedStrength = Number(strength.toFixed(4));
    scores.set(edge.id, {
      edgeId: edge.id,
      strength: roundedStrength,
      band,
      signals,
    });
    totalStrength += roundedStrength;
    maxStrength = Math.max(maxStrength, roundedStrength);
  }

  return {
    scores,
    averageStrength: edges.length > 0 ? Number((totalStrength / edges.length).toFixed(4)) : 0,
    maxStrength: Number(maxStrength.toFixed(4)),
  };
}
