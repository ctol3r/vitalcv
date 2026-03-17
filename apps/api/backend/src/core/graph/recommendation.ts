import type { GraphEdge, GraphNode } from '../../services/graph-engine/schema';
import type { GraphCentralityScore } from './centrality';
import { buildUndirectedAdjacency, createUndirectedPairKey, orderUndirectedPair } from './centrality';
import type { SimilarityEdgeCandidate } from './similarity';

export interface GraphConnectionRecommendation {
  sourceNodeId: string;
  targetNodeId: string;
  score: number;
  reasons: string[];
  sharedNeighborIds: string[];
  sharedTokens: string[];
}

type RecommendationDraft = {
  sourceNodeId: string;
  targetNodeId: string;
  similarityScore: number;
  sharedNeighborIds: Set<string>;
  sharedTokens: Set<string>;
};

function isComparableNode(node: GraphNode): boolean {
  return node.type !== 'tag' && node.type !== 'attachment';
}

export function recommendNodeConnections(
  nodes: GraphNode[],
  baseEdges: GraphEdge[],
  options: {
    centrality: Map<string, GraphCentralityScore>;
    similarityCandidates: SimilarityEdgeCandidate[];
    clusterAssignments?: Map<string, string>;
    maxRecommendations?: number;
    maxRecommendationsPerNode?: number;
  },
): GraphConnectionRecommendation[] {
  const comparableNodes = nodes.filter(isComparableNode);
  const comparableNodeIds = new Set(comparableNodes.map((node) => node.id));
  const drafts = new Map<string, RecommendationDraft>();
  const adjacency = buildUndirectedAdjacency(nodes, baseEdges);
  const directConnections = new Set<string>();

  for (const edge of baseEdges) {
    if (
      edge.type === 'tagged_with'
      || edge.type === 'attached_to'
      || edge.type === 'semantic_similarity'
    ) {
      continue;
    }
    directConnections.add(createUndirectedPairKey(edge.source, edge.target));
  }

  const ensureDraft = (leftNodeId: string, rightNodeId: string): RecommendationDraft | null => {
    if (!comparableNodeIds.has(leftNodeId) || !comparableNodeIds.has(rightNodeId)) return null;
    const [sourceNodeId, targetNodeId] = orderUndirectedPair(leftNodeId, rightNodeId);
    if (sourceNodeId === targetNodeId) return null;
    const pairKey = createUndirectedPairKey(sourceNodeId, targetNodeId);
    if (directConnections.has(pairKey)) return null;

    const existing = drafts.get(pairKey);
    if (existing) return existing;

    const created: RecommendationDraft = {
      sourceNodeId,
      targetNodeId,
      similarityScore: 0,
      sharedNeighborIds: new Set<string>(),
      sharedTokens: new Set<string>(),
    };
    drafts.set(pairKey, created);
    return created;
  };

  for (const candidate of options.similarityCandidates) {
    const draft = ensureDraft(candidate.sourceNodeId, candidate.targetNodeId);
    if (!draft) continue;
    draft.similarityScore = Math.max(draft.similarityScore, candidate.score);
    for (const token of candidate.sharedTokens) draft.sharedTokens.add(token);
    for (const neighborId of candidate.sharedNeighborIds) draft.sharedNeighborIds.add(neighborId);
  }

  for (const [pivotNodeId, neighbors] of adjacency.entries()) {
    const comparableNeighbors = [...neighbors.keys()]
      .filter((neighborId) => comparableNodeIds.has(neighborId))
      .sort((left, right) => left.localeCompare(right))
      .slice(0, 14);

    for (let index = 0; index < comparableNeighbors.length; index += 1) {
      for (let inner = index + 1; inner < comparableNeighbors.length; inner += 1) {
        const draft = ensureDraft(comparableNeighbors[index], comparableNeighbors[inner]);
        if (draft) draft.sharedNeighborIds.add(pivotNodeId);
      }
    }
  }

  const maxRecommendations = options.maxRecommendations ?? 20;
  const maxRecommendationsPerNode = options.maxRecommendationsPerNode ?? 4;
  const perNodeBudget = new Map<string, number>();

  return [...drafts.values()]
    .map((draft) => {
      const leftNode = nodes.find((node) => node.id === draft.sourceNodeId);
      const rightNode = nodes.find((node) => node.id === draft.targetNodeId);
      if (!leftNode || !rightNode) return null;

      const sameCluster = options.clusterAssignments
        && options.clusterAssignments.get(draft.sourceNodeId)
        && options.clusterAssignments.get(draft.sourceNodeId) === options.clusterAssignments.get(draft.targetNodeId)
        ? 1
        : 0;
      const sameGroup = leftNode.group === rightNode.group ? 1 : 0;
      const sameType = leftNode.type === rightNode.type ? 1 : 0;
      const centralitySignal = Math.min(
        1,
        ((options.centrality.get(draft.sourceNodeId)?.composite ?? 0)
          + (options.centrality.get(draft.targetNodeId)?.composite ?? 0)) / 2,
      );
      const sharedNeighborScore = Math.min(1, draft.sharedNeighborIds.size / 4);
      const score = Math.min(
        1,
        draft.similarityScore * 0.55
        + sharedNeighborScore * 0.25
        + sameCluster * 0.1
        + sameType * 0.06
        + sameGroup * 0.04
        + centralitySignal * 0.1,
      );

      if (score < 0.45) return null;

      const reasons: string[] = [];
      if (draft.similarityScore > 0) reasons.push(`similarity=${draft.similarityScore.toFixed(2)}`);
      if (draft.sharedNeighborIds.size > 0) reasons.push(`shared_neighbors=${draft.sharedNeighborIds.size}`);
      if (draft.sharedTokens.size > 0) reasons.push(`shared_tokens=${[...draft.sharedTokens].slice(0, 4).join(',')}`);
      if (sameType) reasons.push(`same_type=${leftNode.type}`);
      if (sameGroup) reasons.push(`same_group=${leftNode.group}`);
      if (sameCluster) reasons.push('same_cluster');

      return {
        sourceNodeId: draft.sourceNodeId,
        targetNodeId: draft.targetNodeId,
        score: Number(score.toFixed(4)),
        reasons,
        sharedNeighborIds: [...draft.sharedNeighborIds].sort((left, right) => left.localeCompare(right)),
        sharedTokens: [...draft.sharedTokens].sort((left, right) => left.localeCompare(right)),
      } satisfies GraphConnectionRecommendation;
    })
    .filter((candidate): candidate is GraphConnectionRecommendation => Boolean(candidate))
    .sort((left, right) =>
      right.score - left.score
      || left.sourceNodeId.localeCompare(right.sourceNodeId)
      || left.targetNodeId.localeCompare(right.targetNodeId))
    .filter((candidate) => {
      const sourceBudget = perNodeBudget.get(candidate.sourceNodeId) ?? 0;
      const targetBudget = perNodeBudget.get(candidate.targetNodeId) ?? 0;
      if (sourceBudget >= maxRecommendationsPerNode || targetBudget >= maxRecommendationsPerNode) return false;
      perNodeBudget.set(candidate.sourceNodeId, sourceBudget + 1);
      perNodeBudget.set(candidate.targetNodeId, targetBudget + 1);
      return true;
    })
    .slice(0, maxRecommendations);
}
