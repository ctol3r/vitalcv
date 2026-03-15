import {
  articulationPoints,
  betweennessCentrality,
  pageRank,
} from '../graph/algorithms';
import type { GraphProjection } from '../graph/types';
import { rankScores } from '../graph/utils';

export type IntelligenceInsightType =
  | 'HIGH_INFLUENCE_NODE'
  | 'LIKELY_INVESTIGATOR'
  | 'UNUSUAL_SPECIALTY_CLUSTER'
  | 'ANOMALOUS_RELATIONSHIP';

export interface IntelligenceGraphNode {
  id: string;
  type: string;
  label: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

export interface IntelligenceGraphEdge {
  source: string;
  target: string;
  type: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
}

export interface GraphCentralityScore {
  nodeId: string;
  score: number;
  rank: number;
}

export interface GraphCluster {
  clusterId: string;
  memberNodeIds: string[];
  size: number;
  dominantSpecialty: string | null;
}

export interface RelationshipStrengthScore {
  edgeKey: string;
  sourceNodeId: string;
  targetNodeId: string;
  score: number;
  reasons: string[];
}

export interface NodeRecommendation {
  sourceNodeId: string;
  targetNodeId: string;
  score: number;
  reasons: string[];
}

export interface GraphInsightRecord {
  nodeId: string;
  insightType: IntelligenceInsightType;
  confidence: number;
  explanation: string;
  relatedNodeIds: string[];
  insightScore: number;
  timestamp: string;
  metadata: Record<string, unknown>;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Math.round(value * 10_000) / 10_000));
}

function buildAdjacency(edges: IntelligenceGraphEdge[]): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>();

  for (const edge of edges) {
    const sourceNeighbors = adjacency.get(edge.source) ?? new Set<string>();
    sourceNeighbors.add(edge.target);
    adjacency.set(edge.source, sourceNeighbors);

    const targetNeighbors = adjacency.get(edge.target) ?? new Set<string>();
    targetNeighbors.add(edge.source);
    adjacency.set(edge.target, targetNeighbors);
  }

  return adjacency;
}

function readMetadataString(node: IntelligenceGraphNode, key: string): string | null {
  const value = node.metadata?.[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

function toProjection(
  nodes: IntelligenceGraphNode[],
  edges: IntelligenceGraphEdge[],
): GraphProjection {
  return {
    nodes: nodes.map((node) => ({
      id: node.id,
      kind: node.type,
      label: node.label,
      layer: 'dual',
      confidence: 1,
      metadata: node.metadata ?? {},
    })),
    edges: edges.map((edge, index) => ({
      id: `edge:${index}:${edge.source}:${edge.target}:${edge.type}`,
      source: edge.source,
      target: edge.target,
      relation: edge.type,
      directed: true,
      weight: edge.confidence ?? 0.5,
      confidence: edge.confidence ?? 0.5,
      layer: 'dual',
      metadata: edge.metadata ?? {},
    })),
  };
}

export function graphCentrality(
  nodes: IntelligenceGraphNode[],
  edges: IntelligenceGraphEdge[],
): GraphCentralityScore[] {
  const adjacency = buildAdjacency(edges);
  const maxDegree = Math.max(1, ...nodes.map((node) => adjacency.get(node.id)?.size ?? 0));
  const scores = nodes.map((node) => {
    const degree = adjacency.get(node.id)?.size ?? 0;
    const weightedConfidence = edges
      .filter((edge) => edge.source === node.id || edge.target === node.id)
      .reduce((sum, edge) => sum + (edge.confidence ?? 0.5), 0);
    const averageConfidence = degree > 0 ? weightedConfidence / degree : 0;
    const score = clamp01(((degree / maxDegree) * 0.7) + (averageConfidence * 0.3));

    return {
      nodeId: node.id,
      score,
      rank: 0,
    };
  });

  scores.sort((left, right) => right.score - left.score || left.nodeId.localeCompare(right.nodeId));

  return scores.map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }));
}

export function clusterDetection(
  nodes: IntelligenceGraphNode[],
  edges: IntelligenceGraphEdge[],
): GraphCluster[] {
  const adjacency = buildAdjacency(edges);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const visited = new Set<string>();
  const clusters: GraphCluster[] = [];

  for (const node of nodes) {
    if (visited.has(node.id)) {
      continue;
    }

    const queue = [node.id];
    const memberNodeIds: string[] = [];

    while (queue.length > 0) {
      const currentId = queue.shift();
      if (!currentId || visited.has(currentId)) {
        continue;
      }

      visited.add(currentId);
      memberNodeIds.push(currentId);

      for (const neighbor of adjacency.get(currentId) ?? []) {
        if (!visited.has(neighbor)) {
          queue.push(neighbor);
        }
      }
    }

    const specialtyCounts = new Map<string, number>();
    for (const memberNodeId of memberNodeIds) {
      const member = nodeById.get(memberNodeId);
      if (!member) {
        continue;
      }

      const specialty = readMetadataString(member, 'specialty')
        ?? readMetadataString(member, 'taxonomy')
        ?? member.tags?.find((tag) => tag.toLowerCase().includes('ology'))
        ?? null;
      if (!specialty) {
        continue;
      }

      specialtyCounts.set(specialty, (specialtyCounts.get(specialty) ?? 0) + 1);
    }

    const dominantSpecialty = [...specialtyCounts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ?? null;

    clusters.push({
      clusterId: `cluster:${clusters.length + 1}`,
      memberNodeIds: memberNodeIds.sort(),
      size: memberNodeIds.length,
      dominantSpecialty,
    });
  }

  return clusters.sort((left, right) => right.size - left.size || left.clusterId.localeCompare(right.clusterId));
}

export function relationshipStrength(
  nodes: IntelligenceGraphNode[],
  edges: IntelligenceGraphEdge[],
): RelationshipStrengthScore[] {
  const adjacency = buildAdjacency(edges);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  return edges.map((edge) => {
    const sourceNeighbors = adjacency.get(edge.source) ?? new Set<string>();
    const targetNeighbors = adjacency.get(edge.target) ?? new Set<string>();
    const sharedNeighbors = [...sourceNeighbors].filter((neighbor) => targetNeighbors.has(neighbor)).length;
    const sharedNeighborScore = sharedNeighbors / Math.max(1, Math.min(sourceNeighbors.size, targetNeighbors.size));
    const sourceNode = nodeById.get(edge.source);
    const targetNode = nodeById.get(edge.target);
    const sameSpecialty = Boolean(
      sourceNode
      && targetNode
      && readMetadataString(sourceNode, 'specialty')
      && readMetadataString(sourceNode, 'specialty') === readMetadataString(targetNode, 'specialty'),
    );
    const reasons = [`confidence:${(edge.confidence ?? 0.5).toFixed(2)}`];
    if (sharedNeighbors > 0) {
      reasons.push(`shared_neighbors:${sharedNeighbors}`);
    }
    if (sameSpecialty) {
      reasons.push('same_specialty');
    }

    const score = clamp01(
      ((edge.confidence ?? 0.5) * 0.6)
      + (sharedNeighborScore * 0.25)
      + (sameSpecialty ? 0.15 : 0),
    );

    return {
      edgeKey: `${edge.source}:${edge.target}:${edge.type}`,
      sourceNodeId: edge.source,
      targetNodeId: edge.target,
      score,
      reasons,
    };
  });
}

export function nodeRecommendation(
  nodes: IntelligenceGraphNode[],
  edges: IntelligenceGraphEdge[],
): NodeRecommendation[] {
  const adjacency = buildAdjacency(edges);
  const existingPairs = new Set(edges.map((edge) => {
    const pair = [edge.source, edge.target].sort();
    return `${pair[0]}:${pair[1]}`;
  }));
  const recommendations: NodeRecommendation[] = [];

  for (let index = 0; index < nodes.length; index += 1) {
    for (let inner = index + 1; inner < nodes.length; inner += 1) {
      const sourceNode = nodes[index]!;
      const targetNode = nodes[inner]!;
      const pairKey = `${sourceNode.id}:${targetNode.id}`;
      const undirectedPairKey = [sourceNode.id, targetNode.id].sort().join(':');
      if (existingPairs.has(undirectedPairKey)) {
        continue;
      }

      const sourceNeighbors = adjacency.get(sourceNode.id) ?? new Set<string>();
      const targetNeighbors = adjacency.get(targetNode.id) ?? new Set<string>();
      const sharedNeighbors = [...sourceNeighbors].filter((neighbor) => targetNeighbors.has(neighbor));
      const sharedTags = (sourceNode.tags ?? []).filter((tag) => (targetNode.tags ?? []).includes(tag));
      const sameSpecialty = Boolean(
        readMetadataString(sourceNode, 'specialty')
        && readMetadataString(sourceNode, 'specialty') === readMetadataString(targetNode, 'specialty'),
      );

      const score = clamp01(
        Math.min(0.5, sharedNeighbors.length * 0.15)
        + Math.min(0.3, sharedTags.length * 0.1)
        + (sameSpecialty ? 0.2 : 0),
      );
      if (score < 0.35) {
        continue;
      }

      const reasons: string[] = [];
      if (sharedNeighbors.length > 0) {
        reasons.push(`shared_neighbors:${sharedNeighbors.length}`);
      }
      if (sharedTags.length > 0) {
        reasons.push(`shared_tags:${sharedTags.join('|')}`);
      }
      if (sameSpecialty) {
        reasons.push('same_specialty');
      }

      recommendations.push({
        sourceNodeId: sourceNode.id,
        targetNodeId: targetNode.id,
        score,
        reasons,
      });
      existingPairs.add(pairKey);
    }
  }

  return recommendations.sort((left, right) => right.score - left.score
    || left.sourceNodeId.localeCompare(right.sourceNodeId)
    || left.targetNodeId.localeCompare(right.targetNodeId));
}

export function deriveGraphInsights(
  nodes: IntelligenceGraphNode[],
  edges: IntelligenceGraphEdge[],
  now: Date = new Date(),
): GraphInsightRecord[] {
  const timestamp = now.toISOString();
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const centrality = graphCentrality(nodes, edges);
  const projection = toProjection(nodes, edges);
  const advancedPageRank = new Map(pageRank(projection).map((entry) => [entry.nodeId, entry]));
  const advancedBetweenness = new Map(
    betweennessCentrality(projection).map((entry) => [entry.nodeId, entry]),
  );
  const articulationPointIds = new Set(articulationPoints(projection));
  const influenceScores = rankScores(nodes.map((node) => {
    const pageRankScore = advancedPageRank.get(node.id)?.score ?? 0;
    const betweennessScore = advancedBetweenness.get(node.id)?.score ?? 0;
    const articulationBoost = articulationPointIds.has(node.id) ? 0.15 : 0;
    return {
      nodeId: node.id,
      score: clamp01(
        (pageRankScore * 0.55)
          + (betweennessScore * 0.3)
          + articulationBoost,
      ),
    };
  }));
  const clusters = clusterDetection(nodes, edges);
  const strengths = relationshipStrength(nodes, edges);
  const clusterByNode = new Map<string, GraphCluster>();
  const specialtyClusters = new Map<string, number>();

  for (const cluster of clusters) {
    if (cluster.dominantSpecialty) {
      specialtyClusters.set(
        normalizeToken(cluster.dominantSpecialty),
        (specialtyClusters.get(normalizeToken(cluster.dominantSpecialty)) ?? 0) + 1,
      );
    }

    for (const nodeId of cluster.memberNodeIds) {
      clusterByNode.set(nodeId, cluster);
    }
  }

  const insights: GraphInsightRecord[] = [];

  for (const entry of influenceScores.slice(0, Math.max(1, Math.ceil(influenceScores.length * 0.1)))) {
    if (entry.score < 0.45) {
      continue;
    }

    const pageRankScore = advancedPageRank.get(entry.nodeId)?.score ?? 0;
    const betweennessScore = advancedBetweenness.get(entry.nodeId)?.score ?? 0;
    const reasons = [];
    if (pageRankScore >= 0.5) {
      reasons.push('pagerank');
    }
    if (betweennessScore >= 0.5) {
      reasons.push('betweenness');
    }
    if (articulationPointIds.has(entry.nodeId)) {
      reasons.push('articulation_point');
    }

    insights.push({
      nodeId: entry.nodeId,
      insightType: 'HIGH_INFLUENCE_NODE',
      confidence: entry.score,
      explanation: `${nodeById.get(entry.nodeId)?.label ?? entry.nodeId} sits on high-traffic trust paths and exerts disproportionate network influence.`,
      relatedNodeIds: [...(buildAdjacency(edges).get(entry.nodeId) ?? [])].slice(0, 8),
      insightScore: entry.score,
      timestamp,
      metadata: {
        rank: entry.rank,
        pageRank: pageRankScore,
        betweennessCentrality: betweennessScore,
        articulationPoint: articulationPointIds.has(entry.nodeId),
        reasons,
      },
    });
  }

  for (const node of nodes) {
    const researchConnections = edges.filter((edge) => (
      edge.source === node.id || edge.target === node.id
    ) && (
      nodeById.get(edge.source)?.type === 'publication'
      || nodeById.get(edge.target)?.type === 'publication'
      || nodeById.get(edge.source)?.type === 'trial'
      || nodeById.get(edge.target)?.type === 'trial'
    ));

    if ((node.type === 'clinician' || node.type === 'person') && researchConnections.length >= 2) {
      insights.push({
        nodeId: node.id,
        insightType: 'LIKELY_INVESTIGATOR',
        confidence: clamp01(0.45 + (researchConnections.length * 0.1)),
        explanation: `${node.label} is linked to repeated research-oriented entities and behaves like an investigator node.`,
        relatedNodeIds: [...new Set(researchConnections.flatMap((edge) => [edge.source, edge.target]).filter((id) => id !== node.id))].slice(0, 8),
        insightScore: clamp01(0.45 + (researchConnections.length * 0.1)),
        timestamp,
        metadata: {
          researchConnections: researchConnections.length,
        },
      });
    }
  }

  for (const cluster of clusters) {
    if (!cluster.dominantSpecialty || cluster.size < 3) {
      continue;
    }

    const specialtyFrequency = specialtyClusters.get(normalizeToken(cluster.dominantSpecialty)) ?? 0;
    if (specialtyFrequency > 1) {
      continue;
    }

    const anchorNodeId = cluster.memberNodeIds[0]!;
    insights.push({
      nodeId: anchorNodeId,
      insightType: 'UNUSUAL_SPECIALTY_CLUSTER',
      confidence: clamp01(Math.min(0.95, 0.5 + (cluster.size * 0.08))),
      explanation: `Cluster ${cluster.clusterId} is dominated by ${cluster.dominantSpecialty} relationships and stands out from the rest of the graph.`,
      relatedNodeIds: cluster.memberNodeIds.slice(1, 12),
      insightScore: clamp01(Math.min(0.95, 0.5 + (cluster.size * 0.08))),
      timestamp,
      metadata: {
        clusterId: cluster.clusterId,
        clusterSize: cluster.size,
        dominantSpecialty: cluster.dominantSpecialty,
      },
    });
  }

  for (const strength of strengths) {
    const sourceCluster = clusterByNode.get(strength.sourceNodeId)?.clusterId ?? null;
    const targetCluster = clusterByNode.get(strength.targetNodeId)?.clusterId ?? null;
    if (strength.score > 0.3 || sourceCluster === targetCluster) {
      continue;
    }

    insights.push({
      nodeId: strength.sourceNodeId,
      insightType: 'ANOMALOUS_RELATIONSHIP',
      confidence: clamp01(1 - strength.score),
      explanation: `${nodeById.get(strength.sourceNodeId)?.label ?? strength.sourceNodeId} is connected to ${nodeById.get(strength.targetNodeId)?.label ?? strength.targetNodeId} with weak graph support.`,
      relatedNodeIds: [strength.targetNodeId],
      insightScore: clamp01(1 - strength.score),
      timestamp,
      metadata: {
        reasons: strength.reasons,
      },
    });
  }

  const deduped = new Map<string, GraphInsightRecord>();
  for (const insight of insights) {
    const key = `${insight.nodeId}:${insight.insightType}:${insight.relatedNodeIds.join('|')}`;
    const existing = deduped.get(key);
    if (!existing || existing.confidence < insight.confidence) {
      deduped.set(key, insight);
    }
  }

  return [...deduped.values()].sort((left, right) => right.confidence - left.confidence
    || left.nodeId.localeCompare(right.nodeId)
    || left.insightType.localeCompare(right.insightType));
}
