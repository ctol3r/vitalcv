import type { GraphAlgorithmBundle, GraphCommunity, GraphEdge, GraphProjection, GraphScore } from './types';
import { clamp01, createDeterministicId, rankScores, roundTo } from './utils';

interface Neighbor {
  nodeId: string;
  weight: number;
}

function edgeStrength(edge: GraphEdge): number {
  return Math.max(0.0001, edge.weight * Math.max(0.0001, edge.confidence));
}

function buildAdjacency(graph: GraphProjection, directed = false): Map<string, Neighbor[]> {
  const adjacency = new Map<string, Neighbor[]>();

  for (const node of graph.nodes) {
    adjacency.set(node.id, []);
  }

  for (const edge of graph.edges) {
    const weight = edgeStrength(edge);
    adjacency.get(edge.source)?.push({ nodeId: edge.target, weight });
    if (!edge.directed || !directed) {
      adjacency.get(edge.target)?.push({ nodeId: edge.source, weight });
    }
  }

  return adjacency;
}

function buildInboundAdjacency(graph: GraphProjection): Map<string, Neighbor[]> {
  const adjacency = new Map<string, Neighbor[]>();
  for (const node of graph.nodes) {
    adjacency.set(node.id, []);
  }

  for (const edge of graph.edges) {
    const weight = edgeStrength(edge);
    adjacency.get(edge.target)?.push({ nodeId: edge.source, weight });
    if (!edge.directed) {
      adjacency.get(edge.source)?.push({ nodeId: edge.target, weight });
    }
  }

  return adjacency;
}

export function pageRank(
  graph: GraphProjection,
  options: {
    dampingFactor?: number;
    maxIterations?: number;
    tolerance?: number;
  } = {},
): GraphScore[] {
  if (graph.nodes.length === 0) {
    return [];
  }

  const dampingFactor = options.dampingFactor ?? 0.85;
  const maxIterations = options.maxIterations ?? 100;
  const tolerance = options.tolerance ?? 1e-6;
  const nodeIds = graph.nodes.map((node) => node.id);
  const adjacency = buildAdjacency(graph, true);
  const inbound = buildInboundAdjacency(graph);
  const nodeCount = nodeIds.length;
  let scores = new Map(nodeIds.map((nodeId) => [nodeId, 1 / nodeCount]));

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const nextScores = new Map<string, number>();
    let sinkMass = 0;

    for (const nodeId of nodeIds) {
      const neighbors = adjacency.get(nodeId) ?? [];
      if (neighbors.length === 0) {
        sinkMass += scores.get(nodeId) ?? 0;
      }
    }

    let delta = 0;
    for (const nodeId of nodeIds) {
      const inboundNeighbors = inbound.get(nodeId) ?? [];
      let rank = ((1 - dampingFactor) / nodeCount) + ((dampingFactor * sinkMass) / nodeCount);

      for (const neighbor of inboundNeighbors) {
        const sourceNeighbors = adjacency.get(neighbor.nodeId) ?? [];
        const totalOutboundWeight = sourceNeighbors.reduce((sum, entry) => sum + entry.weight, 0);
        if (totalOutboundWeight <= 0) {
          continue;
        }

        rank += dampingFactor * ((scores.get(neighbor.nodeId) ?? 0) * (neighbor.weight / totalOutboundWeight));
      }

      nextScores.set(nodeId, rank);
      delta += Math.abs(rank - (scores.get(nodeId) ?? 0));
    }

    scores = nextScores;
    if (delta <= tolerance) {
      break;
    }
  }

  return rankScores(nodeIds.map((nodeId) => ({
    nodeId,
    score: scores.get(nodeId) ?? 0,
  })));
}

function buildWeightedNeighborMap(graph: GraphProjection, directed = false): Map<string, Map<string, number>> {
  const neighborMap = new Map<string, Map<string, number>>();

  for (const node of graph.nodes) {
    neighborMap.set(node.id, new Map());
  }

  for (const edge of graph.edges) {
    const weight = edgeStrength(edge);
    const sourceNeighbors = neighborMap.get(edge.source) ?? new Map<string, number>();
    sourceNeighbors.set(edge.target, Math.max(sourceNeighbors.get(edge.target) ?? 0, weight));
    neighborMap.set(edge.source, sourceNeighbors);

    if (!edge.directed || !directed) {
      const targetNeighbors = neighborMap.get(edge.target) ?? new Map<string, number>();
      targetNeighbors.set(edge.source, Math.max(targetNeighbors.get(edge.source) ?? 0, weight));
      neighborMap.set(edge.target, targetNeighbors);
    }
  }

  return neighborMap;
}

export function betweennessCentrality(
  graph: GraphProjection,
  options: {
    directed?: boolean;
  } = {},
): GraphScore[] {
  const directed = options.directed ?? false;
  const nodeIds = graph.nodes.map((node) => node.id);
  const neighborMap = buildWeightedNeighborMap(graph, directed);
  const centrality = new Map(nodeIds.map((nodeId) => [nodeId, 0]));

  for (const source of nodeIds) {
    const stack: string[] = [];
    const predecessors = new Map<string, string[]>(nodeIds.map((nodeId) => [nodeId, []]));
    const sigma = new Map(nodeIds.map((nodeId) => [nodeId, 0]));
    const distance = new Map(nodeIds.map((nodeId) => [nodeId, Number.POSITIVE_INFINITY]));
    const queue = new Set(nodeIds);

    sigma.set(source, 1);
    distance.set(source, 0);

    while (queue.size > 0) {
      let current: string | null = null;
      let minDistance = Number.POSITIVE_INFINITY;

      for (const candidate of queue) {
        const candidateDistance = distance.get(candidate) ?? Number.POSITIVE_INFINITY;
        if (candidateDistance < minDistance) {
          minDistance = candidateDistance;
          current = candidate;
        }
      }

      if (!current || !Number.isFinite(minDistance)) {
        break;
      }

      queue.delete(current);
      stack.push(current);

      for (const [target, strength] of neighborMap.get(current) ?? []) {
        const cost = 1 / Math.max(strength, 0.0001);
        const candidateDistance = (distance.get(current) ?? Number.POSITIVE_INFINITY) + cost;
        const existingDistance = distance.get(target) ?? Number.POSITIVE_INFINITY;

        if (candidateDistance + 1e-9 < existingDistance) {
          distance.set(target, candidateDistance);
          sigma.set(target, sigma.get(current) ?? 0);
          predecessors.set(target, [current]);
        } else if (Math.abs(candidateDistance - existingDistance) <= 1e-9) {
          sigma.set(target, (sigma.get(target) ?? 0) + (sigma.get(current) ?? 0));
          predecessors.get(target)?.push(current);
        }
      }
    }

    const dependency = new Map(nodeIds.map((nodeId) => [nodeId, 0]));
    while (stack.length > 0) {
      const nodeId = stack.pop()!;
      for (const predecessor of predecessors.get(nodeId) ?? []) {
        const sigmaNode = sigma.get(nodeId) ?? 1;
        const sigmaPredecessor = sigma.get(predecessor) ?? 0;
        const dependencyContribution = sigmaNode === 0
          ? 0
          : (sigmaPredecessor / sigmaNode) * (1 + (dependency.get(nodeId) ?? 0));
        dependency.set(predecessor, (dependency.get(predecessor) ?? 0) + dependencyContribution);
      }

      if (nodeId !== source) {
        centrality.set(nodeId, (centrality.get(nodeId) ?? 0) + (dependency.get(nodeId) ?? 0));
      }
    }
  }

  if (!directed) {
    for (const nodeId of nodeIds) {
      centrality.set(nodeId, (centrality.get(nodeId) ?? 0) / 2);
    }
  }

  const maxValue = Math.max(0, ...centrality.values());
  return rankScores(nodeIds.map((nodeId) => ({
    nodeId,
    score: maxValue === 0 ? 0 : (centrality.get(nodeId) ?? 0) / maxValue,
  })));
}

export function articulationPoints(graph: GraphProjection): string[] {
  const adjacency = buildWeightedNeighborMap(graph, false);
  const visited = new Set<string>();
  const discovery = new Map<string, number>();
  const low = new Map<string, number>();
  const parent = new Map<string, string | null>();
  const points = new Set<string>();
  let time = 0;

  function dfs(nodeId: string): void {
    visited.add(nodeId);
    time += 1;
    discovery.set(nodeId, time);
    low.set(nodeId, time);
    let childCount = 0;

    for (const neighborId of adjacency.get(nodeId)?.keys() ?? []) {
      if (!visited.has(neighborId)) {
        childCount += 1;
        parent.set(neighborId, nodeId);
        dfs(neighborId);
        low.set(nodeId, Math.min(low.get(nodeId) ?? time, low.get(neighborId) ?? time));

        if (!parent.has(nodeId) && childCount > 1) {
          points.add(nodeId);
        }

        if (parent.has(nodeId) && (low.get(neighborId) ?? time) >= (discovery.get(nodeId) ?? time)) {
          points.add(nodeId);
        }
      } else if (neighborId !== parent.get(nodeId)) {
        low.set(nodeId, Math.min(low.get(nodeId) ?? time, discovery.get(neighborId) ?? time));
      }
    }
  }

  for (const node of graph.nodes) {
    if (!visited.has(node.id)) {
      dfs(node.id);
    }
  }

  return [...points].sort((left, right) => left.localeCompare(right));
}

export function communityDetection(
  graph: GraphProjection,
  options: {
    maxIterations?: number;
  } = {},
): GraphCommunity[] {
  if (graph.nodes.length === 0) {
    return [];
  }

  const maxIterations = options.maxIterations ?? 50;
  const nodeIds = graph.nodes.map((node) => node.id).sort((left, right) => left.localeCompare(right));
  const adjacency = buildWeightedNeighborMap(graph, false);
  const labels = new Map(nodeIds.map((nodeId) => [nodeId, nodeId]));

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    let changed = false;

    for (const nodeId of nodeIds) {
      const labelWeights = new Map<string, number>();
      for (const [neighborId, weight] of adjacency.get(nodeId) ?? []) {
        const label = labels.get(neighborId) ?? neighborId;
        labelWeights.set(label, (labelWeights.get(label) ?? 0) + weight);
      }

      if (labelWeights.size === 0) {
        continue;
      }

      const currentLabel = labels.get(nodeId) ?? nodeId;
      const bestLabel = [...labelWeights.entries()].sort((left, right) => (
        right[1] - left[1]
          || (left[0] === currentLabel ? -1 : right[0] === currentLabel ? 1 : left[0].localeCompare(right[0]))
      ))[0]?.[0] ?? currentLabel;

      if (bestLabel !== currentLabel) {
        labels.set(nodeId, bestLabel);
        changed = true;
      }
    }

    if (!changed) {
      break;
    }
  }

  const groups = new Map<string, string[]>();
  for (const nodeId of nodeIds) {
    const label = labels.get(nodeId) ?? nodeId;
    const members = groups.get(label) ?? [];
    members.push(nodeId);
    groups.set(label, members);
  }

  const communities = [...groups.values()].map((members) => {
    const sortedMembers = members.sort((left, right) => left.localeCompare(right));
    let internalEdges = 0;
    let internalWeight = 0;

    for (const edge of graph.edges) {
      if (sortedMembers.includes(edge.source) && sortedMembers.includes(edge.target)) {
        internalEdges += 1;
        internalWeight += edgeStrength(edge);
      }
    }

    const maxPossibleEdges = sortedMembers.length <= 1
      ? 1
      : (sortedMembers.length * (sortedMembers.length - 1)) / 2;

    return {
      communityId: createDeterministicId('community', sortedMembers),
      memberNodeIds: sortedMembers,
      size: sortedMembers.length,
      density: roundTo(internalEdges / maxPossibleEdges),
      cohesion: roundTo(clamp01(internalWeight / Math.max(1, sortedMembers.length))),
    };
  });

  return communities.sort((left, right) => right.size - left.size || left.communityId.localeCompare(right.communityId));
}

export function analyzeGraph(graph: GraphProjection): GraphAlgorithmBundle {
  return {
    pageRank: pageRank(graph),
    betweennessCentrality: betweennessCentrality(graph),
    articulationPoints: articulationPoints(graph),
    communities: communityDetection(graph),
  };
}
