import { LRUCache } from 'lru-cache';
import { Prisma, type PrismaClient } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import { stableStringify } from '../../utils/deterministic';
import { detectHubNodes, computeNodeCentrality, createUndirectedPairKey, orderUndirectedPair } from '../../core/graph/centrality';
import { detectClusters } from '../../core/graph/clusterEngine';
import { scoreRelationshipEdges } from '../../core/graph/edgeScoring';
import { recommendNodeConnections } from '../../core/graph/recommendation';
import { generateSimilarityEdges } from '../../core/graph/similarity';
import {
  AI_EDGE_TYPES,
  EXPLICIT_EDGE_TYPES,
  GRAPH_FILTER_SCHEMA_VERSION,
  GRAPH_SCHEMA_VERSION,
  INFERRED_EDGE_TYPES,
  defaultGraphQueryFilters,
  edgeLayer,
  nodeLayer,
  normalizeClusterMode,
  normalizeGraphMode,
  type ClusterMode,
  type EdgeType,
  type GraphEdge,
  type GraphIntelligenceReport,
  type GraphLayer,
  type GraphNode,
  type GraphQueryFilters,
  type GraphQueryResult,
  type GraphStats,
  type NodeType,
} from './schema';
import {
  createGraphEdgeId,
  createGraphClusterAssignmentId,
  createGraphSnapshotId,
  createGraphSnapshotQuerySignature,
} from './ids';
import { getGraphCacheEpoch } from './invalidation';

type JsonRecord = Record<string, unknown>;

const responseCache = new LRUCache<string, GraphQueryResult>({
  max: 200,
  ttl: 60_000,
});

function asRecord(value: unknown): JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function normalizeTrustTier(value: string | undefined): 'GOLD' | 'SILVER' | 'BRONZE' | undefined {
  return value === 'GOLD' || value === 'SILVER' || value === 'BRONZE' ? value : undefined;
}

function normalizeTrustBand(value: string | undefined): 'L0' | 'L1' | 'L2' | 'L3' | undefined {
  return value === 'L0' || value === 'L1' || value === 'L2' || value === 'L3' ? value : undefined;
}

function buildFilterSignature(filters: GraphQueryFilters): string {
  return stableStringify({
    graphMode: filters.graphMode,
    scope: filters.scope,
    focusNodeId: filters.focusNodeId ?? null,
    depth: filters.depth,
    nodeTypes: filters.nodeTypes,
    edgeTypes: filters.edgeTypes,
    tags: [...filters.tags].sort(),
    groups: [...filters.groups].sort(),
    trustTiers: [...filters.trustTiers].sort(),
    searchTerm: filters.searchTerm.trim().toLowerCase(),
    showAttachments: filters.showAttachments,
    showExistingFilesOnly: filters.showExistingFilesOnly,
    showOrphans: filters.showOrphans,
    showExplicit: filters.showExplicit,
    showInferred: filters.showInferred,
    showAiLinks: filters.showAiLinks,
    includeEdgeStatus: [...filters.includeEdgeStatus].sort(),
    clusterMode: filters.clusterMode,
    filterSchemaVersion: GRAPH_FILTER_SCHEMA_VERSION,
  });
}

function cacheKeyForSignature(querySignature: string): string {
  return `${getGraphCacheEpoch()}:${querySignature}`;
}

function toApiNode(row: Awaited<ReturnType<typeof prisma.graphNode.findMany>>[number]): GraphNode {
  const metadata = asRecord(row.metadata);
  const type = row.type as NodeType;
  return {
    id: row.id,
    type,
    label: row.label,
    title: row.title,
    color: row.colorGroup,
    group: row.groupKey ?? row.type,
    degree: row.degree,
    inDegree: row.inDegree,
    outDegree: row.outDegree,
    layer: nodeLayer(type),
    metadata,
    tags: [...row.tags],
    sourceRefs: [...row.sourceRefs],
    trustTier: normalizeTrustTier(asString(metadata.trustTier) ?? undefined),
    trustBand: normalizeTrustBand(asString(metadata.trustBand) ?? undefined),
    confidence: asNumber(metadata.confidenceScore),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function normalizeEdgeStatus(value: string): GraphEdge['status'] {
  const lowered = value.toLowerCase();
  return lowered === 'pending' || lowered === 'rejected' || lowered === 'superseded'
    ? lowered
    : 'active';
}

function toApiEdge(row: Awaited<ReturnType<typeof prisma.graphEdge.findMany>>[number]): GraphEdge {
  const type = row.edgeType as EdgeType;
  return {
    id: row.id,
    source: row.sourceNodeId,
    target: row.targetNodeId,
    type,
    directed: row.directed,
    reciprocal: row.reciprocal,
    confidence: row.confidence,
    createdBy: row.createdBy as GraphEdge['createdBy'],
    explanation: row.explanation ?? '',
    status: normalizeEdgeStatus(row.status),
    weight: row.confidence,
    metadata: asRecord(row.provenance),
    layer: edgeLayer(type),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toSuggestionEdge(
  row: Awaited<ReturnType<typeof prisma.graphLinkSuggestion.findMany>>[number],
): GraphEdge {
  const explanation = asRecord(row.explanation);
  return {
    id: row.id,
    source: row.sourceNodeId,
    target: row.targetNodeId,
    type: 'ai_suggested_link',
    directed: row.directed,
    reciprocal: row.reciprocal,
    confidence: row.confidence,
    createdBy: 'ai',
    explanation: asString(explanation.summary) ?? 'Pending AI graph suggestion',
    status: normalizeEdgeStatus(row.state),
    weight: row.confidence,
    metadata: {
      ...explanation,
      signalBreakdown: row.signalBreakdown,
      semanticEdgeType: row.edgeType,
    },
    layer: edgeLayer('ai_suggested_link'),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function recomputeNodeDegrees(nodes: GraphNode[], edges: GraphEdge[]): GraphNode[] {
  const degreeMap = new Map<string, { degree: number; inDegree: number; outDegree: number }>();
  for (const node of nodes) {
    degreeMap.set(node.id, { degree: 0, inDegree: 0, outDegree: 0 });
  }

  for (const edge of edges) {
    const sourceDegree = degreeMap.get(edge.source);
    if (sourceDegree) {
      sourceDegree.degree += 1;
      sourceDegree.outDegree += 1;
    }

    const targetDegree = degreeMap.get(edge.target);
    if (targetDegree) {
      targetDegree.degree += 1;
      targetDegree.inDegree += 1;
    }
  }

  const maxDegree = Math.max(1, ...nodes.map((node) => degreeMap.get(node.id)?.degree ?? 0));
  return nodes.map((node) => {
    const degree = degreeMap.get(node.id) ?? { degree: 0, inDegree: 0, outDegree: 0 };
    return {
      ...node,
      degree: degree.degree,
      inDegree: degree.inDegree,
      outDegree: degree.outDegree,
      size: 4 + (degree.degree / maxDegree) * 16,
    };
  });
}

function mergeSimilarityEdges(
  edges: GraphEdge[],
  similarityCandidates: ReturnType<typeof generateSimilarityEdges>,
): GraphEdge[] {
  const now = new Date().toISOString();
  const existingSemanticPairs = new Set(
    edges
      .filter((edge) => edge.type === 'semantic_similarity')
      .map((edge) => createUndirectedPairKey(edge.source, edge.target)),
  );
  const similarityByPair = new Map(
    similarityCandidates.map((candidate) => [
      createUndirectedPairKey(candidate.sourceNodeId, candidate.targetNodeId),
      candidate,
    ]),
  );

  const enrichedExisting = edges.map((edge) => {
    if (edge.type !== 'semantic_similarity') return edge;
    const candidate = similarityByPair.get(createUndirectedPairKey(edge.source, edge.target));
    if (!candidate) return edge;
    return {
      ...edge,
      confidence: Math.max(edge.confidence, candidate.score),
      weight: Math.max(edge.weight ?? 0, candidate.score),
      metadata: {
        ...edge.metadata,
        similarityScore: Math.max(edge.confidence, candidate.score),
        sharedTokens: candidate.sharedTokens,
        sharedNeighborIds: candidate.sharedNeighborIds,
        similarityReasons: candidate.reasons,
      },
    };
  });

  const generated = similarityCandidates
    .filter((candidate) => !existingSemanticPairs.has(createUndirectedPairKey(candidate.sourceNodeId, candidate.targetNodeId)))
    .map((candidate) => {
      const [sourceNodeId, targetNodeId] = orderUndirectedPair(candidate.sourceNodeId, candidate.targetNodeId);
      return {
        id: createGraphEdgeId({
          sourceNodeId,
          targetNodeId,
          edgeType: 'semantic_similarity',
          directed: false,
          createdBy: 'system',
          materialHash: null,
        }),
        source: sourceNodeId,
        target: targetNodeId,
        type: 'semantic_similarity',
        directed: false,
        reciprocal: true,
        confidence: candidate.score,
        createdBy: 'system',
        explanation: `Inferred semantic similarity (${candidate.reasons.join('; ')})`,
        status: 'active',
        weight: candidate.score,
        metadata: {
          similarityScore: candidate.score,
          similarityReasons: candidate.reasons,
          sharedTokens: candidate.sharedTokens,
          sharedNeighborIds: candidate.sharedNeighborIds,
          generatedAtQuery: true,
        },
        layer: edgeLayer('semantic_similarity'),
        createdAt: now,
        updatedAt: now,
      } satisfies GraphEdge;
    });

  return [...enrichedExisting, ...generated];
}

function attachEdgeIntelligence(
  edges: GraphEdge[],
  strengthResult: ReturnType<typeof scoreRelationshipEdges>,
): GraphEdge[] {
  return edges.map((edge) => {
    const strength = strengthResult.scores.get(edge.id);
    if (!strength) return edge;
    return {
      ...edge,
      weight: strength.strength,
      metadata: {
        ...edge.metadata,
        relationshipStrength: strength.strength,
        relationshipBand: strength.band,
        relationshipSignals: strength.signals,
      },
    };
  });
}

function attachNodeIntelligence(
  nodes: GraphNode[],
  intelligence: GraphIntelligenceReport,
  centrality: ReturnType<typeof computeNodeCentrality>,
): GraphNode[] {
  const hubMap = new Map(intelligence.hubs.map((hub) => [hub.nodeId, hub]));
  const clusterByNode = new Map<string, GraphIntelligenceReport['clusters'][number]>();
  for (const cluster of intelligence.clusters) {
    for (const nodeId of cluster.memberNodeIds) {
      clusterByNode.set(nodeId, cluster);
    }
  }

  const recommendationsByNode = new Map<string, Array<{ nodeId: string; score: number; reasons: string[] }>>();
  for (const recommendation of intelligence.recommendations) {
    const forward = recommendationsByNode.get(recommendation.sourceNodeId) ?? [];
    forward.push({
      nodeId: recommendation.targetNodeId,
      score: recommendation.score,
      reasons: recommendation.reasons,
    });
    recommendationsByNode.set(recommendation.sourceNodeId, forward);

    const reverse = recommendationsByNode.get(recommendation.targetNodeId) ?? [];
    reverse.push({
      nodeId: recommendation.sourceNodeId,
      score: recommendation.score,
      reasons: recommendation.reasons,
    });
    recommendationsByNode.set(recommendation.targetNodeId, reverse);
  }

  return nodes.map((node) => ({
    ...node,
    metadata: {
      ...node.metadata,
      intelligence: {
        centrality: centrality.get(node.id) ?? null,
        hub: hubMap.get(node.id) ?? null,
        detectedClusterId: clusterByNode.get(node.id)?.clusterId ?? null,
        recommendations: (recommendationsByNode.get(node.id) ?? [])
          .sort((left, right) => right.score - left.score || left.nodeId.localeCompare(right.nodeId))
          .slice(0, 3),
      },
    },
  }));
}

function buildIntelligenceReport(params: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  strengthResult: ReturnType<typeof scoreRelationshipEdges>;
  clusters: ReturnType<typeof detectClusters>;
  centrality: ReturnType<typeof computeNodeCentrality>;
  recommendations: ReturnType<typeof recommendNodeConnections>;
}): GraphIntelligenceReport {
  const hubs = detectHubNodes(params.centrality);
  return {
    version: '1',
    generatedAt: new Date().toISOString(),
    hubs,
    clusters: params.clusters.clusters,
    recommendations: params.recommendations,
    metrics: {
      clusterCount: params.clusters.clusters.filter((cluster) => cluster.size > 1).length,
      hubCount: hubs.length,
      similarityEdgeCount: params.edges.filter((edge) => edge.type === 'semantic_similarity').length,
      recommendationCount: params.recommendations.length,
      avgRelationshipStrength: params.strengthResult.averageStrength,
    },
  };
}

function matchesMode(node: GraphNode | GraphEdge, graphMode: GraphLayer): boolean {
  if (graphMode === 'blended') return true;
  return node.layer === graphMode;
}

function matchesSearch(node: GraphNode, searchTerm: string): boolean {
  if (searchTerm.trim().length === 0) return true;
  const needle = searchTerm.trim().toLowerCase();
  const haystack = [
    node.label,
    node.title,
    ...node.tags,
    asString(node.metadata.specialty) ?? '',
    asString(node.metadata.state) ?? '',
  ].join(' ').toLowerCase();
  return haystack.includes(needle);
}

function matchesTrustTier(node: GraphNode, trustTiers: string[]): boolean {
  if (trustTiers.length === 0) return true;
  if (node.layer === 'knowledge') return true;
  if (!node.trustTier) return true;
  return trustTiers.includes(node.trustTier);
}

function matchesExistingFile(node: GraphNode): boolean {
  const metadata = asRecord(node.metadata);
  return Boolean(
    asString(metadata.filePath)
    ?? asString(metadata.sourceUrl)
    ?? asString(metadata.resumeUrl)
    ?? asString(metadata.website),
  );
}

function filterNodes(filters: GraphQueryFilters, nodes: GraphNode[]): GraphNode[] {
  return nodes.filter((node) =>
    matchesMode(node, filters.graphMode)
    && filters.nodeTypes.includes(node.type)
    && matchesSearch(node, filters.searchTerm)
    && matchesTrustTier(node, filters.trustTiers)
    && (filters.groups.length === 0 || filters.groups.includes(node.group))
    && (filters.tags.length === 0 || filters.tags.some((tag) => node.tags.includes(tag)))
    && (filters.showAttachments || node.type !== 'attachment')
    && (!filters.showExistingFilesOnly || matchesExistingFile(node)),
  );
}

function filterEdges(filters: GraphQueryFilters, edges: GraphEdge[]): GraphEdge[] {
  return edges.filter((edge) => {
    if (!matchesMode(edge, filters.graphMode)) return false;
    if (!filters.edgeTypes.includes(edge.type)) return false;
    if (!filters.includeEdgeStatus.includes(edge.status)) return false;
    if (!filters.showExplicit && EXPLICIT_EDGE_TYPES.has(edge.type)) return false;
    if (!filters.showAiLinks && (AI_EDGE_TYPES.has(edge.type) || edge.createdBy === 'ai')) return false;
    if (!filters.showInferred && INFERRED_EDGE_TYPES.has(edge.type)) return false;
    return true;
  });
}

function extractLocalGraph(
  focusNodeId: string,
  depth: number,
  nodes: GraphNode[],
  edges: GraphEdge[],
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const adjacency = new Map<string, Set<string>>();
  for (const edge of edges) {
    const source = adjacency.get(edge.source) ?? new Set<string>();
    source.add(edge.target);
    adjacency.set(edge.source, source);

    const target = adjacency.get(edge.target) ?? new Set<string>();
    target.add(edge.source);
    adjacency.set(edge.target, target);
  }

  const visited = new Set<string>();
  const queue: Array<{ nodeId: string; depth: number }> = [{ nodeId: focusNodeId, depth: 0 }];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current.nodeId)) continue;
    visited.add(current.nodeId);
    if (current.depth >= depth) continue;
    for (const neighbor of adjacency.get(current.nodeId) ?? []) {
      if (!visited.has(neighbor)) {
        queue.push({ nodeId: neighbor, depth: current.depth + 1 });
      }
    }
  }

  return {
    nodes: nodes.filter((node) => visited.has(node.id)),
    edges: edges.filter((edge) => visited.has(edge.source) && visited.has(edge.target)),
  };
}

function filterOrphans(filters: GraphQueryFilters, nodes: GraphNode[], edges: GraphEdge[]): { nodes: GraphNode[]; edges: GraphEdge[] } {
  if (!filters.showOrphans) return { nodes, edges };
  const connected = new Set<string>();
  for (const edge of edges) {
    connected.add(edge.source);
    connected.add(edge.target);
  }
  return {
    nodes: nodes.filter((node) => !connected.has(node.id)),
    edges: [],
  };
}

function applyCursor(
  filters: GraphQueryFilters,
  nodes: GraphNode[],
  edges: GraphEdge[],
): { nodes: GraphNode[]; edges: GraphEdge[]; nextCursor: string | null; truncated: boolean } {
  const sortedNodes = [...nodes].sort((left, right) =>
    right.degree - left.degree || left.id.localeCompare(right.id));
  const startIndex = filters.cursor ? Number.parseInt(filters.cursor, 10) || 0 : 0;
  const pagedNodes = sortedNodes.slice(startIndex, startIndex + filters.limit);
  const nodeIds = new Set(pagedNodes.map((node) => node.id));
  const pagedEdges = edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target));
  const nextIndex = startIndex + filters.limit;
  return {
    nodes: pagedNodes,
    edges: pagedEdges,
    nextCursor: nextIndex < sortedNodes.length ? String(nextIndex) : null,
    truncated: nextIndex < sortedNodes.length,
  };
}

function buildStats(
  nodes: GraphNode[],
  edges: GraphEdge[],
  clusterMode: ClusterMode,
  intelligence?: GraphIntelligenceReport,
): GraphStats & {
  payloadBytes: number;
  clusterMode: ClusterMode;
  invalidated: boolean;
} {
  const nodesByType: Record<string, number> = {};
  const edgesByType: Record<string, number> = {};
  let aiSuggestedLinks = 0;
  let aiAcceptedLinks = 0;
  let explicitLinks = 0;
  let inferredLinks = 0;
  let maxDegree = 0;

  for (const node of nodes) {
    nodesByType[node.type] = (nodesByType[node.type] ?? 0) + 1;
    maxDegree = Math.max(maxDegree, node.degree);
  }

  for (const edge of edges) {
    edgesByType[edge.type] = (edgesByType[edge.type] ?? 0) + 1;
    if (edge.type === 'ai_suggested_link') aiSuggestedLinks += 1;
    if (edge.type === 'ai_accepted_link') aiAcceptedLinks += 1;
    if (EXPLICIT_EDGE_TYPES.has(edge.type)) explicitLinks += 1;
    if (INFERRED_EDGE_TYPES.has(edge.type)) inferredLinks += 1;
  }

  const orphanCount = nodes.filter((node) => node.degree === 0).length;
  const payloadBytes = Buffer.byteLength(JSON.stringify({ nodes, edges }));

  return {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    orphanCount,
    avgDegree: nodes.length > 0 ? Math.round((edges.length * 2 / nodes.length) * 100) / 100 : 0,
    maxDegree,
    clusterCount: new Set(nodes.map((node) => node.clusterId).filter(Boolean)).size,
    aiSuggestedLinks,
    aiAcceptedLinks,
    explicitLinks,
    inferredLinks,
    hubCount: intelligence?.metrics.hubCount ?? 0,
    similarityEdgeCount: intelligence?.metrics.similarityEdgeCount ?? 0,
    recommendationCount: intelligence?.metrics.recommendationCount ?? 0,
    avgRelationshipStrength: intelligence?.metrics.avgRelationshipStrength ?? 0,
    nodesByType,
    edgesByType,
    payloadBytes,
    clusterMode,
    invalidated: false,
  };
}

async function applyClusterAssignments(
  prismaClient: PrismaClient,
  snapshotId: string,
  clusterMode: ClusterMode,
  nodes: GraphNode[],
  edges: GraphEdge[],
  detectedClusterMap?: Map<string, string>,
): Promise<GraphNode[]> {
  if (clusterMode === 'none') return nodes;

  let clusterMap = new Map<string, string>();
  if (clusterMode === 'type') {
    clusterMap = new Map(nodes.map((node) => [node.id, `type:${node.type}`]));
  } else if (clusterMode === 'group') {
    clusterMap = new Map(nodes.map((node) => [node.id, `group:${node.group}`]));
  } else if (clusterMode === 'tier') {
    clusterMap = new Map(nodes.map((node) => [node.id, `tier:${node.trustTier ?? node.trustBand ?? 'none'}`]));
  } else {
    clusterMap = detectedClusterMap ?? detectClusters(nodes, edges).assignments;
  }

  await prismaClient.graphClusterAssignment.deleteMany({
    where: {
      snapshotId,
      clusterMode,
    },
  });

  if (nodes.length > 0) {
    await prismaClient.graphClusterAssignment.createMany({
      data: nodes.map((node) => {
        const clusterKey = clusterMap.get(node.id) ?? `${clusterMode}:${node.id}`;
        return {
          id: createGraphClusterAssignmentId({
            nodeId: node.id,
            snapshotId,
            clusterMode,
            clusterKey,
          }),
          nodeId: node.id,
          snapshotId,
          clusterMode,
          clusterKey,
          score: Math.max(1, node.degree),
          metadata: { clusterMode },
        };
      }),
      skipDuplicates: true,
    });
  }

  return nodes.map((node) => ({
    ...node,
    clusterId: clusterMap.get(node.id),
  }));
}

async function buildFreshQueryResult(
  filters: GraphQueryFilters,
  prismaClient: PrismaClient,
  buildRunId?: string | null,
): Promise<GraphQueryResult> {
  const filterSignature = buildFilterSignature(filters);
  const scopeKey = filters.scope === 'local' ? (filters.focusNodeId ?? 'missing') : filters.graphMode;
  const querySignature = createGraphSnapshotQuerySignature({
    scopeType: filters.scope,
    scopeKey,
    graphMode: filters.graphMode,
    focusNodeId: filters.focusNodeId ?? null,
    depth: filters.depth,
    filterSignature,
    schemaVersion: GRAPH_SCHEMA_VERSION,
  });
  const snapshotId = createGraphSnapshotId({
    scopeType: filters.scope,
    scopeKey,
    graphMode: filters.graphMode,
    focusNodeId: filters.focusNodeId ?? null,
    depth: filters.depth,
    filterSignature,
    schemaVersion: GRAPH_SCHEMA_VERSION,
  });

  const [nodeRows, edgeRows, suggestionRows] = await Promise.all([
    prismaClient.graphNode.findMany({
      where: { active: true },
      orderBy: [{ degree: 'desc' }, { id: 'asc' }],
    }),
    prismaClient.graphEdge.findMany({
      where: {
        status: { in: filters.includeEdgeStatus.map((status) => status.toUpperCase()) },
      },
      orderBy: [{ confidence: 'desc' }, { id: 'asc' }],
    }),
    filters.showAiLinks
      ? prismaClient.graphLinkSuggestion.findMany({
          where: {
            state: { in: ['PENDING', 'IGNORED'] },
          },
          orderBy: [{ confidence: 'desc' }, { id: 'asc' }],
        })
      : Promise.resolve([]),
  ]);

  let nodes = filterNodes(filters, nodeRows.map(toApiNode));
  let edges = filterEdges(filters, edgeRows.map(toApiEdge));
  const suggestionEdges = filters.showAiLinks
    ? filterEdges(filters, suggestionRows.map(toSuggestionEdge))
    : [];
  edges = [...edges, ...suggestionEdges];

  if (filters.scope === 'local' && filters.focusNodeId) {
    const local = extractLocalGraph(filters.focusNodeId, filters.depth, nodes, edges);
    nodes = local.nodes;
    edges = local.edges;
  }

  const nodeIds = new Set(nodes.map((node) => node.id));
  edges = edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target));

  const orphanFiltered = filterOrphans(filters, nodes, edges);
  nodes = orphanFiltered.nodes;
  edges = orphanFiltered.edges;

  const placeholderBuiltAt = new Date();
  await prismaClient.graphSnapshot.upsert({
    where: { querySignature },
    update: {
      id: snapshotId,
      scopeType: filters.scope,
      scopeKey,
      graphMode: filters.graphMode,
      focusNodeId: filters.focusNodeId ?? null,
      depth: filters.depth,
      filterSignature,
      schemaVersion: GRAPH_SCHEMA_VERSION,
      nodeCount: 0,
      edgeCount: 0,
      payloadBytes: 0,
      payload: toJsonValue({ status: 'building' }),
      stats: toJsonValue({ status: 'building' }),
      invalidatedAt: placeholderBuiltAt,
      lastInvalidationReason: 'snapshot_building',
      lastInvalidationScope: toJsonValue({
        scopeType: filters.scope,
        scopeKey,
      }),
      builtAt: placeholderBuiltAt,
      lastAccessedAt: placeholderBuiltAt,
      buildRunId: buildRunId ?? null,
    },
    create: {
      id: snapshotId,
      querySignature,
      scopeType: filters.scope,
      scopeKey,
      graphMode: filters.graphMode,
      focusNodeId: filters.focusNodeId ?? null,
      depth: filters.depth,
      filterSignature,
      schemaVersion: GRAPH_SCHEMA_VERSION,
      nodeCount: 0,
      edgeCount: 0,
      payloadBytes: 0,
      payload: toJsonValue({ status: 'building' }),
      stats: toJsonValue({ status: 'building' }),
      invalidatedAt: placeholderBuiltAt,
      lastInvalidationReason: 'snapshot_building',
      lastInvalidationScope: toJsonValue({
        scopeType: filters.scope,
        scopeKey,
      }),
      builtAt: placeholderBuiltAt,
      lastAccessedAt: placeholderBuiltAt,
      buildRunId: buildRunId ?? null,
      createdAt: placeholderBuiltAt,
      updatedAt: placeholderBuiltAt,
    },
  });

  const baseEdges = edges;
  const seedCentrality = computeNodeCentrality(nodes, baseEdges);
  const seedClusters = detectClusters(nodes, baseEdges);
  const similarityCandidates = generateSimilarityEdges(nodes, baseEdges, {
    centrality: seedCentrality,
    clusterAssignments: seedClusters.assignments,
  });

  edges = mergeSimilarityEdges(baseEdges, similarityCandidates);
  nodes = recomputeNodeDegrees(nodes, edges);

  const finalCentrality = computeNodeCentrality(nodes, edges);
  const detectedClusters = detectClusters(nodes, edges);
  const strengthResult = scoreRelationshipEdges(nodes, edges, {
    centrality: finalCentrality,
    clusterAssignments: detectedClusters.assignments,
  });
  const recommendations = recommendNodeConnections(nodes, baseEdges, {
    centrality: finalCentrality,
    similarityCandidates,
    clusterAssignments: detectedClusters.assignments,
  });
  const intelligence = buildIntelligenceReport({
    nodes,
    edges,
    strengthResult,
    clusters: detectedClusters,
    centrality: finalCentrality,
    recommendations,
  });

  edges = attachEdgeIntelligence(edges, strengthResult);
  nodes = attachNodeIntelligence(nodes, intelligence, finalCentrality);
  nodes = await applyClusterAssignments(
    prismaClient,
    snapshotId,
    normalizeClusterMode(filters.clusterMode),
    nodes,
    edges,
    detectedClusters.assignments,
  );
  const chunk = applyCursor(filters, nodes, edges);
  const generatedAt = new Date().toISOString();
  const stats = buildStats(nodes, edges, filters.clusterMode, intelligence);
  const payloadBytes = Buffer.byteLength(JSON.stringify({
    snapshotId,
    graphMode: filters.graphMode,
    scope: filters.scope,
    focusNodeId: filters.focusNodeId ?? null,
    depth: filters.depth,
    generatedAt,
    filters,
    chunk,
    intelligence,
    stats,
  }));

  const result: GraphQueryResult = {
    snapshotId,
    graphMode: filters.graphMode,
    scope: filters.scope,
    focusNodeId: filters.focusNodeId ?? null,
    depth: filters.depth,
    generatedAt,
    cacheStatus: 'miss',
    filters,
    chunk,
    intelligence,
    stats,
  };

  await prismaClient.graphSnapshot.upsert({
    where: { querySignature },
    update: {
      id: snapshotId,
      scopeType: filters.scope,
      scopeKey,
      graphMode: filters.graphMode,
      focusNodeId: filters.focusNodeId ?? null,
      depth: filters.depth,
      filterSignature,
      schemaVersion: GRAPH_SCHEMA_VERSION,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      payloadBytes,
      payload: toJsonValue(result),
      stats: toJsonValue(stats),
      invalidatedAt: null,
      lastInvalidationReason: null,
      lastInvalidationScope: Prisma.JsonNull,
      builtAt: new Date(generatedAt),
      lastAccessedAt: new Date(generatedAt),
      buildRunId: buildRunId ?? null,
    },
    create: {
      id: snapshotId,
      querySignature,
      scopeType: filters.scope,
      scopeKey,
      graphMode: filters.graphMode,
      focusNodeId: filters.focusNodeId ?? null,
      depth: filters.depth,
      filterSignature,
      schemaVersion: GRAPH_SCHEMA_VERSION,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      payloadBytes,
      payload: toJsonValue(result),
      stats: toJsonValue(stats),
      lastInvalidationReason: null,
      lastInvalidationScope: Prisma.JsonNull,
      builtAt: new Date(generatedAt),
      lastAccessedAt: new Date(generatedAt),
      buildRunId: buildRunId ?? null,
      createdAt: new Date(generatedAt),
      updatedAt: new Date(generatedAt),
    },
  });

  responseCache.set(cacheKeyForSignature(querySignature), result);
  return result;
}

export async function queryGraph(
  partialFilters: Partial<GraphQueryFilters>,
  prismaClient: PrismaClient = prisma,
  options?: { buildRunId?: string | null },
): Promise<GraphQueryResult> {
  const filters: GraphQueryFilters = {
    ...defaultGraphQueryFilters(),
    ...partialFilters,
    graphMode: normalizeGraphMode(partialFilters.graphMode ?? defaultGraphQueryFilters().graphMode),
    clusterMode: normalizeClusterMode(partialFilters.clusterMode ?? defaultGraphQueryFilters().clusterMode),
  };
  const filterSignature = buildFilterSignature(filters);
  const scopeKey = filters.scope === 'local' ? (filters.focusNodeId ?? 'missing') : filters.graphMode;
  const querySignature = createGraphSnapshotQuerySignature({
    scopeType: filters.scope,
    scopeKey,
    graphMode: filters.graphMode,
    focusNodeId: filters.focusNodeId ?? null,
    depth: filters.depth,
    filterSignature,
    schemaVersion: GRAPH_SCHEMA_VERSION,
  });

  const cached = responseCache.get(cacheKeyForSignature(querySignature));
  if (cached) {
    return {
      ...cached,
      cacheStatus: 'hit',
    };
  }

  const snapshot = await prismaClient.graphSnapshot.findUnique({
    where: { querySignature },
  });

  if (snapshot && !snapshot.invalidatedAt) {
    const payload = snapshot.payload as unknown as GraphQueryResult;
    responseCache.set(cacheKeyForSignature(querySignature), payload);
    await prismaClient.graphSnapshot.update({
      where: { id: snapshot.id },
      data: { lastAccessedAt: new Date() },
    }).catch(() => undefined);
    return {
      ...payload,
      cacheStatus: 'hit',
      stats: {
        ...payload.stats,
        invalidated: false,
      },
    };
  }

  return buildFreshQueryResult(filters, prismaClient, options?.buildRunId);
}

export async function getGraphNode(
  nodeId: string,
  prismaClient: PrismaClient = prisma,
): Promise<GraphNode | null> {
  const row = await prismaClient.graphNode.findUnique({ where: { id: nodeId } });
  return row ? toApiNode(row) : null;
}

export async function getGraphNodeNeighbors(
  nodeId: string,
  depth: number,
  prismaClient: PrismaClient = prisma,
): Promise<GraphQueryResult> {
  return queryGraph({
    scope: 'local',
    focusNodeId: nodeId,
    depth,
  }, prismaClient);
}

export async function searchGraphNodes(
  searchTerm: string,
  prismaClient: PrismaClient = prisma,
): Promise<GraphNode[]> {
  const result = await queryGraph({
    graphMode: 'blended',
    scope: 'global',
    searchTerm,
    limit: 50,
  }, prismaClient);
  return result.chunk.nodes;
}

export async function listGraphGroups(
  graphMode: GraphLayer,
  prismaClient: PrismaClient = prisma,
): Promise<Array<{ group: string; count: number }>> {
  const result = await queryGraph({
    graphMode,
    scope: 'global',
    limit: 2000,
  }, prismaClient);
  const counts = new Map<string, number>();
  for (const node of result.chunk.nodes) {
    counts.set(node.group, (counts.get(node.group) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([group, count]) => ({ group, count }))
    .sort((left, right) => right.count - left.count || left.group.localeCompare(right.group));
}

export async function primeGraphSnapshots(input: {
  buildRunId?: string | null;
  graphMode?: GraphLayer | null;
  targetNodeId?: string | null;
}, prismaClient: PrismaClient = prisma): Promise<string[]> {
  const snapshotIds: string[] = [];
  const graphModes = input.graphMode && input.graphMode !== 'blended'
    ? [input.graphMode, 'blended' as const]
    : ['knowledge', 'trust', 'blended'] as const;

  for (const graphMode of graphModes) {
    const result = await queryGraph({
      graphMode,
      scope: 'global',
      limit: 300,
    }, prismaClient, { buildRunId: input.buildRunId ?? null });
    snapshotIds.push(result.snapshotId);
  }

  if (input.targetNodeId) {
    for (const graphMode of graphModes) {
      const local = await queryGraph({
        graphMode,
        scope: 'local',
        focusNodeId: input.targetNodeId,
        depth: 2,
        limit: 300,
      }, prismaClient, { buildRunId: input.buildRunId ?? null });
      snapshotIds.push(local.snapshotId);
    }
  }

  log('info', 'graph_query: primed snapshots', {
    buildRunId: input.buildRunId,
    snapshotCount: snapshotIds.length,
  });

  return snapshotIds;
}
