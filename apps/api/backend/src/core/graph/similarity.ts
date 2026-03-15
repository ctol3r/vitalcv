import type { GraphEdge, GraphNode } from '../../services/graph-engine/schema';
import type { GraphCentralityScore } from './centrality';
import { buildUndirectedAdjacency, createUndirectedPairKey, orderUndirectedPair } from './centrality';

export interface SimilarityEdgeCandidate {
  sourceNodeId: string;
  targetNodeId: string;
  score: number;
  reasons: string[];
  sharedTokens: string[];
  sharedNeighborIds: string[];
}

type SimilarityDraft = {
  sourceNodeId: string;
  targetNodeId: string;
  sharedTokens: Set<string>;
  sharedNeighborIds: Set<string>;
  seedSameCluster: boolean;
};

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => asString(entry))
    .filter((entry): entry is string => Boolean(entry));
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function isComparableNode(node: GraphNode): boolean {
  return node.type !== 'tag' && node.type !== 'attachment';
}

function collectNodeTokens(node: GraphNode): string[] {
  const metadata = node.metadata ?? {};
  const tokens = new Set<string>([
    ...node.tags.map((tag) => tag.toLowerCase()),
    ...tokenize(node.label),
    ...tokenize(node.title),
    ...tokenize(node.group),
    ...tokenize(node.type),
    ...tokenize(asString(metadata.specialty) ?? ''),
    ...tokenize(asString(metadata.state) ?? ''),
    ...tokenize(asString(metadata.category) ?? ''),
    ...tokenize(asString(metadata.trustTier) ?? ''),
    ...tokenize(asString(metadata.trustBand) ?? ''),
    ...asStringArray(metadata.keywords).flatMap((value) => tokenize(value)),
  ]);

  return [...tokens].sort((left, right) => left.localeCompare(right));
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

export function generateSimilarityEdges(
  nodes: GraphNode[],
  edges: GraphEdge[],
  options?: {
    centrality?: Map<string, GraphCentralityScore>;
    clusterAssignments?: Map<string, string>;
    maxPerNode?: number;
    minScore?: number;
  },
): SimilarityEdgeCandidate[] {
  const comparableNodes = nodes.filter(isComparableNode);
  const comparableNodeIds = new Set(comparableNodes.map((node) => node.id));
  const tokensByNode = new Map(comparableNodes.map((node) => [node.id, collectNodeTokens(node)]));
  const tokenSetsByNode = new Map(comparableNodes.map((node) => [node.id, new Set(tokensByNode.get(node.id) ?? [])]));
  const adjacency = buildUndirectedAdjacency(nodes, edges);
  const drafts = new Map<string, SimilarityDraft>();
  const directConnections = new Set<string>();

  for (const edge of edges) {
    if (edge.type === 'tagged_with' || edge.type === 'attached_to') continue;
    directConnections.add(createUndirectedPairKey(edge.source, edge.target));
  }

  const ensureDraft = (leftNodeId: string, rightNodeId: string): SimilarityDraft | null => {
    if (!comparableNodeIds.has(leftNodeId) || !comparableNodeIds.has(rightNodeId)) return null;
    const [sourceNodeId, targetNodeId] = orderUndirectedPair(leftNodeId, rightNodeId);
    if (sourceNodeId === targetNodeId) return null;
    const pairKey = createUndirectedPairKey(sourceNodeId, targetNodeId);
    if (directConnections.has(pairKey)) return null;

    const existing = drafts.get(pairKey);
    if (existing) return existing;

    const created: SimilarityDraft = {
      sourceNodeId,
      targetNodeId,
      sharedTokens: new Set<string>(),
      sharedNeighborIds: new Set<string>(),
      seedSameCluster: false,
    };
    drafts.set(pairKey, created);
    return created;
  };

  const tokenIndex = new Map<string, string[]>();
  for (const node of comparableNodes) {
    for (const token of tokensByNode.get(node.id) ?? []) {
      const bucket = tokenIndex.get(token) ?? [];
      bucket.push(node.id);
      tokenIndex.set(token, bucket);
    }
  }

  for (const [token, bucket] of tokenIndex.entries()) {
    if (bucket.length < 2 || bucket.length > 20) continue;
    const ordered = [...bucket].sort((left, right) => left.localeCompare(right));
    for (let index = 0; index < ordered.length; index += 1) {
      for (let inner = index + 1; inner < ordered.length; inner += 1) {
        const draft = ensureDraft(ordered[index], ordered[inner]);
        if (draft) draft.sharedTokens.add(token);
      }
    }
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

  if (options?.clusterAssignments) {
    const clusterMembers = new Map<string, string[]>();
    for (const node of comparableNodes) {
      const clusterId = options.clusterAssignments.get(node.id);
      if (!clusterId) continue;
      const bucket = clusterMembers.get(clusterId) ?? [];
      bucket.push(node.id);
      clusterMembers.set(clusterId, bucket);
    }

    for (const memberNodeIds of clusterMembers.values()) {
      if (memberNodeIds.length < 2 || memberNodeIds.length > 12) continue;
      const ordered = [...memberNodeIds].sort((left, right) => left.localeCompare(right));
      for (let index = 0; index < ordered.length; index += 1) {
        for (let inner = index + 1; inner < ordered.length; inner += 1) {
          const draft = ensureDraft(ordered[index], ordered[inner]);
          if (draft) draft.seedSameCluster = true;
        }
      }
    }
  }

  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const perNodeBudget = new Map<string, number>();
  const maxPerNode = options?.maxPerNode ?? 6;
  const minScore = options?.minScore ?? 0.42;

  return [...drafts.values()]
    .map((draft) => {
      const leftNode = nodeMap.get(draft.sourceNodeId);
      const rightNode = nodeMap.get(draft.targetNodeId);
      if (!leftNode || !rightNode) return null;

      const leftTokens = tokenSetsByNode.get(draft.sourceNodeId) ?? new Set<string>();
      const rightTokens = tokenSetsByNode.get(draft.targetNodeId) ?? new Set<string>();
      const leftNeighbors = new Set(adjacency.get(draft.sourceNodeId)?.keys() ?? []);
      const rightNeighbors = new Set(adjacency.get(draft.targetNodeId)?.keys() ?? []);
      const tokenScore = jaccard(leftTokens, rightTokens);
      const neighborScore = jaccard(leftNeighbors, rightNeighbors);
      const sameGroup = leftNode.group === rightNode.group ? 1 : 0;
      const sameType = leftNode.type === rightNode.type ? 1 : 0;
      const sameCluster = draft.seedSameCluster ? 1 : 0;
      const centralityBoost = Math.min(
        1,
        ((options?.centrality?.get(draft.sourceNodeId)?.composite ?? 0)
          + (options?.centrality?.get(draft.targetNodeId)?.composite ?? 0)) / 2,
      );
      const score = Math.min(
        1,
        tokenScore * 0.45
        + neighborScore * 0.25
        + sameGroup * 0.1
        + sameType * 0.1
        + sameCluster * 0.05
        + centralityBoost * 0.05,
      );

      const reasons: string[] = [];
      if (draft.sharedTokens.size > 0) {
        reasons.push(`shared tokens: ${[...draft.sharedTokens].sort((left, right) => left.localeCompare(right)).slice(0, 4).join(', ')}`);
      }
      if (draft.sharedNeighborIds.size > 0) {
        reasons.push(`shared neighbors: ${draft.sharedNeighborIds.size}`);
      }
      if (sameGroup) reasons.push(`same group: ${leftNode.group}`);
      if (sameType) reasons.push(`same type: ${leftNode.type}`);
      if (sameCluster) reasons.push('same community');

      if (score < minScore && !(draft.sharedTokens.size >= 2 && (sameGroup || sameType || sameCluster))) {
        return null;
      }

      return {
        sourceNodeId: draft.sourceNodeId,
        targetNodeId: draft.targetNodeId,
        score: Number(score.toFixed(4)),
        reasons,
        sharedTokens: [...draft.sharedTokens].sort((left, right) => left.localeCompare(right)),
        sharedNeighborIds: [...draft.sharedNeighborIds].sort((left, right) => left.localeCompare(right)),
      } satisfies SimilarityEdgeCandidate;
    })
    .filter((candidate): candidate is SimilarityEdgeCandidate => Boolean(candidate))
    .sort((left, right) =>
      right.score - left.score
      || left.sourceNodeId.localeCompare(right.sourceNodeId)
      || left.targetNodeId.localeCompare(right.targetNodeId))
    .filter((candidate) => {
      const sourceBudget = perNodeBudget.get(candidate.sourceNodeId) ?? 0;
      const targetBudget = perNodeBudget.get(candidate.targetNodeId) ?? 0;
      if (sourceBudget >= maxPerNode || targetBudget >= maxPerNode) return false;
      perNodeBudget.set(candidate.sourceNodeId, sourceBudget + 1);
      perNodeBudget.set(candidate.targetNodeId, targetBudget + 1);
      return true;
    });
}
