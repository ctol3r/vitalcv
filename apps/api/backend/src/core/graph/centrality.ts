import type { GraphEdge, GraphNode } from '../../services/graph-engine/schema';

export type GraphAdjacency = Map<string, Map<string, number>>;

export interface GraphCentralityScore {
  nodeId: string;
  degree: number;
  weightedDegree: number;
  closeness: number;
  eigenvector: number;
  composite: number;
  rank: number;
  percentile: number;
}

export interface GraphHubNode {
  nodeId: string;
  score: number;
  rank: number;
  percentile: number;
  reason: string;
}

function normalizeWeight(edge: GraphEdge): number {
  const candidate = edge.weight ?? edge.confidence ?? 1;
  return Number.isFinite(candidate) ? Math.max(0.05, Math.min(candidate, 1.5)) : 1;
}

export function createUndirectedPairKey(left: string, right: string): string {
  return left.localeCompare(right) <= 0 ? `${left}|${right}` : `${right}|${left}`;
}

export function orderUndirectedPair(left: string, right: string): [string, string] {
  return left.localeCompare(right) <= 0 ? [left, right] : [right, left];
}

export function buildUndirectedAdjacency(nodes: GraphNode[], edges: GraphEdge[]): GraphAdjacency {
  const adjacency: GraphAdjacency = new Map(nodes.map((node) => [node.id, new Map<string, number>()]));
  const pairWeights = new Map<string, number>();

  for (const edge of edges) {
    const pairKey = createUndirectedPairKey(edge.source, edge.target);
    const weight = normalizeWeight(edge);
    const current = pairWeights.get(pairKey) ?? 0;
    pairWeights.set(pairKey, Math.max(current, weight));
  }

  for (const [pairKey, weight] of pairWeights.entries()) {
    const [left, right] = pairKey.split('|');
    if (!adjacency.has(left) || !adjacency.has(right)) continue;
    adjacency.get(left)!.set(right, weight);
    adjacency.get(right)!.set(left, weight);
  }

  return adjacency;
}

function computeExactCloseness(nodeIds: string[], adjacency: GraphAdjacency): Map<string, number> {
  const closeness = new Map<string, number>();

  for (const nodeId of nodeIds) {
    const visited = new Map<string, number>([[nodeId, 0]]);
    const queue = [nodeId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const depth = visited.get(current)!;
      for (const neighbor of adjacency.get(current)?.keys() ?? []) {
        if (visited.has(neighbor)) continue;
        visited.set(neighbor, depth + 1);
        queue.push(neighbor);
      }
    }

    const distances = [...visited.values()].filter((value) => value > 0);
    if (distances.length === 0) {
      closeness.set(nodeId, 0);
      continue;
    }

    const reachable = distances.length;
    const totalDistance = distances.reduce((sum, value) => sum + value, 0);
    const reachabilityPenalty = reachable / Math.max(1, nodeIds.length - 1);
    closeness.set(nodeId, (reachable / totalDistance) * reachabilityPenalty);
  }

  return closeness;
}

function computeApproximateCloseness(nodeIds: string[], adjacency: GraphAdjacency): Map<string, number> {
  const closeness = new Map<string, number>();

  for (const nodeId of nodeIds) {
    const oneHop = adjacency.get(nodeId) ?? new Map<string, number>();
    const withinTwoHops = new Set<string>();

    for (const neighbor of oneHop.keys()) {
      withinTwoHops.add(neighbor);
      for (const secondHop of adjacency.get(neighbor)?.keys() ?? []) {
        if (secondHop !== nodeId) withinTwoHops.add(secondHop);
      }
    }

    const direct = oneHop.size;
    const indirect = Math.max(0, withinTwoHops.size - direct);
    closeness.set(nodeId, (direct + indirect * 0.5) / Math.max(1, nodeIds.length - 1));
  }

  return closeness;
}

function computeEigenvector(nodeIds: string[], adjacency: GraphAdjacency): Map<string, number> {
  if (nodeIds.length === 0) return new Map();

  let vector = new Map(nodeIds.map((nodeId) => [nodeId, 1 / nodeIds.length]));
  for (let iteration = 0; iteration < 12; iteration += 1) {
    const next = new Map<string, number>();
    let norm = 0;

    for (const nodeId of nodeIds) {
      let score = 0;
      for (const [neighborId, weight] of adjacency.get(nodeId)?.entries() ?? []) {
        score += weight * (vector.get(neighborId) ?? 0);
      }
      next.set(nodeId, score);
      norm += score * score;
    }

    const divisor = Math.sqrt(norm) || 1;
    vector = new Map([...next.entries()].map(([nodeId, score]) => [nodeId, score / divisor]));
  }

  const maxScore = Math.max(0, ...vector.values());
  return new Map([...vector.entries()].map(([nodeId, score]) => [nodeId, maxScore > 0 ? score / maxScore : 0]));
}

export function computeNodeCentrality(nodes: GraphNode[], edges: GraphEdge[]): Map<string, GraphCentralityScore> {
  const nodeIds = nodes.map((node) => node.id);
  const adjacency = buildUndirectedAdjacency(nodes, edges);
  const closeness = nodeIds.length <= 300
    ? computeExactCloseness(nodeIds, adjacency)
    : computeApproximateCloseness(nodeIds, adjacency);
  const eigenvector = computeEigenvector(nodeIds, adjacency);
  const weightedDegrees = new Map<string, number>();
  let maxWeightedDegree = 0;

  for (const nodeId of nodeIds) {
    const weightedDegree = [...(adjacency.get(nodeId)?.values() ?? [])].reduce((sum, value) => sum + value, 0);
    weightedDegrees.set(nodeId, weightedDegree);
    maxWeightedDegree = Math.max(maxWeightedDegree, weightedDegree);
  }

  const scored = nodeIds.map((nodeId) => {
    const degree = adjacency.get(nodeId)?.size ?? 0;
    const weightedDegree = weightedDegrees.get(nodeId) ?? 0;
    const degreeScore = maxWeightedDegree > 0 ? weightedDegree / maxWeightedDegree : 0;
    const closenessScore = closeness.get(nodeId) ?? 0;
    const eigenvectorScore = eigenvector.get(nodeId) ?? 0;
    const composite = Math.min(
      1,
      degreeScore * 0.45
      + closenessScore * 0.25
      + eigenvectorScore * 0.3,
    );

    return {
      nodeId,
      degree,
      weightedDegree,
      closeness: Number(closenessScore.toFixed(4)),
      eigenvector: Number(eigenvectorScore.toFixed(4)),
      composite: Number(composite.toFixed(4)),
      rank: 0,
      percentile: 0,
    } satisfies GraphCentralityScore;
  });

  scored.sort((left, right) =>
    right.composite - left.composite
    || right.weightedDegree - left.weightedDegree
    || left.nodeId.localeCompare(right.nodeId));

  return new Map(scored.map((score, index) => {
    const percentile = nodeIds.length <= 1 ? 1 : 1 - index / (nodeIds.length - 1);
    return [
      score.nodeId,
      {
        ...score,
        rank: index + 1,
        percentile: Number(percentile.toFixed(4)),
      },
    ];
  }));
}

export function detectHubNodes(centrality: Map<string, GraphCentralityScore>): GraphHubNode[] {
  const scores = [...centrality.values()].sort((left, right) =>
    left.rank - right.rank
    || right.weightedDegree - left.weightedDegree
    || left.nodeId.localeCompare(right.nodeId));

  if (scores.length === 0) return [];

  const composites = scores.map((score) => score.composite);
  const mean = composites.reduce((sum, value) => sum + value, 0) / composites.length;
  const variance = composites.reduce((sum, value) => sum + (value - mean) ** 2, 0) / composites.length;
  const stddev = Math.sqrt(variance);
  const threshold = Math.max(0.5, mean + stddev * 0.75);
  const minHubCount = scores.length >= 5 ? 1 : 0;

  let hubs = scores.filter((score) => score.degree >= 2 && score.composite >= threshold);
  if (hubs.length < minHubCount) {
    hubs = scores.filter((score) => score.degree >= 2).slice(0, minHubCount);
  }

  const maxHubCount = Math.max(1, Math.ceil(scores.length * 0.2));
  return hubs.slice(0, maxHubCount).map((hub) => ({
    nodeId: hub.nodeId,
    score: hub.composite,
    rank: hub.rank,
    percentile: hub.percentile,
    reason: hub.percentile >= 0.9
      ? 'top-centrality percentile'
      : hub.weightedDegree >= 3
        ? 'high weighted degree'
        : 'community bridge',
  }));
}
