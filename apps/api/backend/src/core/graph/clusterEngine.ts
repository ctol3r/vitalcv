import type { GraphEdge, GraphNode } from '../../services/graph-engine/schema';
import { buildUndirectedAdjacency } from './centrality';

export interface GraphCluster {
  clusterId: string;
  label: string;
  memberNodeIds: string[];
  size: number;
  density: number;
  bridgeNodeIds: string[];
}

export interface ClusterDetectionResult {
  assignments: Map<string, string>;
  clusters: GraphCluster[];
}

function selectDominantLabel(values: string[]): string {
  const counts = new Map<string, number>();
  for (const value of values.filter(Boolean)) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  const best = [...counts.entries()].sort((left, right) =>
    right[1] - left[1]
    || left[0].localeCompare(right[0]))[0];

  return best?.[0] ?? 'graph';
}

export function detectClusters(nodes: GraphNode[], edges: GraphEdge[]): ClusterDetectionResult {
  const adjacency = buildUndirectedAdjacency(nodes, edges);
  const labels = new Map(nodes.map((node) => [node.id, node.id]));
  const orderedNodes = [...nodes].sort((left, right) => left.id.localeCompare(right.id));

  for (let iteration = 0; iteration < 8; iteration += 1) {
    let changed = false;

    for (const node of orderedNodes) {
      const votes = new Map<string, number>();
      for (const [neighborId, weight] of adjacency.get(node.id)?.entries() ?? []) {
        const label = labels.get(neighborId) ?? neighborId;
        votes.set(label, (votes.get(label) ?? 0) + weight);
      }

      const currentLabel = labels.get(node.id) ?? node.id;
      votes.set(currentLabel, (votes.get(currentLabel) ?? 0) + 0.05);

      const best = [...votes.entries()].sort((left, right) =>
        right[1] - left[1]
        || left[0].localeCompare(right[0]))[0];

      if (best && best[0] !== currentLabel) {
        labels.set(node.id, best[0]);
        changed = true;
      }
    }

    if (!changed) break;
  }

  const clusterMembers = new Map<string, string[]>();
  for (const node of orderedNodes) {
    const label = labels.get(node.id) ?? node.id;
    const clusterId = `community:${label}`;
    const members = clusterMembers.get(clusterId) ?? [];
    members.push(node.id);
    clusterMembers.set(clusterId, members);
  }

  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const pairSeen = new Set<string>();
  const internalEdgeCount = new Map<string, number>();

  for (const edge of edges) {
    const sourceCluster = `community:${labels.get(edge.source) ?? edge.source}`;
    const targetCluster = `community:${labels.get(edge.target) ?? edge.target}`;
    if (sourceCluster !== targetCluster) continue;

    const pairKey = edge.source.localeCompare(edge.target) <= 0
      ? `${sourceCluster}|${edge.source}|${edge.target}`
      : `${sourceCluster}|${edge.target}|${edge.source}`;

    if (pairSeen.has(pairKey)) continue;
    pairSeen.add(pairKey);
    internalEdgeCount.set(sourceCluster, (internalEdgeCount.get(sourceCluster) ?? 0) + 1);
  }

  const clusters = [...clusterMembers.entries()]
    .map(([clusterId, memberNodeIds]) => {
      const members = memberNodeIds.map((nodeId) => nodeMap.get(nodeId)).filter(Boolean) as GraphNode[];
      const possibleInternalEdges = memberNodeIds.length > 1
        ? (memberNodeIds.length * (memberNodeIds.length - 1)) / 2
        : 1;
      const bridgeNodeIds = memberNodeIds.filter((nodeId) =>
        [...(adjacency.get(nodeId)?.keys() ?? [])].some((neighborId) => !memberNodeIds.includes(neighborId)));

      return {
        clusterId,
        label: `${selectDominantLabel(members.map((member) => member.group || member.type))} community`,
        memberNodeIds: [...memberNodeIds].sort((left, right) => left.localeCompare(right)),
        size: memberNodeIds.length,
        density: Number(((internalEdgeCount.get(clusterId) ?? 0) / possibleInternalEdges).toFixed(4)),
        bridgeNodeIds: [...bridgeNodeIds].sort((left, right) => left.localeCompare(right)),
      } satisfies GraphCluster;
    })
    .sort((left, right) =>
      right.size - left.size
      || right.density - left.density
      || left.clusterId.localeCompare(right.clusterId));

  return {
    assignments: new Map(nodes.map((node) => [node.id, `community:${labels.get(node.id) ?? node.id}`])),
    clusters,
  };
}
