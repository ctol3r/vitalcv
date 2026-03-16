import type { PrismaClient } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import type { GraphEdge, GraphNode } from '../graph-engine/schema';
import { queryGraph } from '../graph-engine/queryService';
import { createGraphNodeId } from '../graph-engine/ids';
import type {
  InvestigationGraphEdge,
  InvestigationRelationshipType,
  NetworkGraphInvestigationPayload,
  NetworkGraphPath,
} from './contracts';
import { getInvestigatorFinding } from '../investigators/investigatorEngineService';
import { getHardenedStorylineDetail } from './storylineIntelligenceService';

export interface GraphInvestigationQuery {
  providerId?: string | null;
  focusNodeId?: string | null;
  depth?: number;
  relationshipTypes?: InvestigationRelationshipType[];
  dateFrom?: string | null;
  dateTo?: string | null;
  findingId?: string | null;
  storylineId?: string | null;
  sourceNodeId?: string | null;
  targetNodeId?: string | null;
}

function clamp01(value: number, fallback = 0): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.min(1, Math.round(value * 10_000) / 10_000));
}

function daysSince(timestamp: string, now: string): number {
  return Math.max(0, (Date.parse(now) - Date.parse(timestamp)) / (1000 * 60 * 60 * 24));
}

function edgeRecencyWeight(edge: GraphEdge, now: string): number {
  return clamp01(1 - (daysSince(edge.updatedAt, now) / 365), 0.2);
}

function mapRelationshipType(edge: GraphEdge, nodesById: Map<string, GraphNode>): InvestigationRelationshipType {
  const source = nodesById.get(edge.source);
  const target = nodesById.get(edge.target);
  const sourceTypes = new Set(
    [source?.type, target?.type].filter((value): value is GraphNode['type'] => value !== undefined),
  );
  const metadataString = JSON.stringify(edge.metadata ?? {}).toLowerCase();

  if (edge.type === 'published_with' || (sourceTypes.has('publication') && sourceTypes.has('clinician'))) {
    return 'co_author';
  }

  if (
    metadataString.includes('trial')
    || sourceTypes.has('trial')
    || metadataString.includes('principal investigator')
  ) {
    return 'co_investigator';
  }

  if (
    metadataString.includes('payment')
    || metadataString.includes('payer')
    || metadataString.includes('sponsor')
  ) {
    return 'financial';
  }

  if (
    edge.type === 'works_at'
    || edge.type === 'affiliated_with'
    || edge.type === 'trained_at'
    || sourceTypes.has('institution')
    || sourceTypes.has('organization')
  ) {
    return edge.type === 'trained_at' ? 'mentorship' : 'institutional';
  }

  if (
    edge.type === 'issued_by'
    || edge.type === 'verified_by'
    || edge.type === 'sanctioned_by'
    || metadataString.includes('regulator')
  ) {
    return 'regulatory';
  }

  if (metadataString.includes('corporate') || metadataString.includes('manufacturer') || metadataString.includes('company')) {
    return 'corporate';
  }

  return 'unknown';
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function matchesDateWindow(edge: GraphEdge, dateFrom?: string | null, dateTo?: string | null): boolean {
  const timestamp = Date.parse(edge.updatedAt);
  if (!Number.isFinite(timestamp)) {
    return false;
  }
  if (dateFrom) {
    const start = Date.parse(dateFrom);
    if (Number.isFinite(start) && timestamp < start) {
      return false;
    }
  }
  if (dateTo) {
    const end = Date.parse(dateTo);
    if (Number.isFinite(end) && timestamp > end) {
      return false;
    }
  }
  return true;
}

function buildAdjacency(edges: InvestigationGraphEdge[]): Map<string, InvestigationGraphEdge[]> {
  const adjacency = new Map<string, InvestigationGraphEdge[]>();
  for (const edge of edges) {
    const sourceList = adjacency.get(edge.source) ?? [];
    sourceList.push(edge);
    adjacency.set(edge.source, sourceList);

    const targetList = adjacency.get(edge.target) ?? [];
    targetList.push({ ...edge, source: edge.target, target: edge.source });
    adjacency.set(edge.target, targetList);
  }
  return adjacency;
}

function materializePath(
  nodeIds: string[],
  pathEdges: InvestigationGraphEdge[],
): NetworkGraphPath {
  const relationshipTypes = pathEdges.map((edge) => edge.investigationRelationshipType);
  const score = pathEdges.length === 0
    ? 0
    : pathEdges.reduce((sum, edge) => sum + ((edge.relationshipStrength * 0.7) + (edge.recencyWeight * 0.3)), 0) / pathEdges.length;
  return {
    pathId: `${nodeIds.join('>')}:${pathEdges.map((edge) => edge.id).join('|')}`,
    nodeIds,
    edgeIds: pathEdges.map((edge) => edge.id),
    relationshipTypes,
    score: clamp01(score),
    explanation: pathEdges.length === 0
      ? 'No path available.'
      : `${relationshipTypes.join(' -> ')} relationships connect the selected entities.`,
  };
}

function shortestPath(
  sourceNodeId: string,
  targetNodeId: string,
  adjacency: Map<string, InvestigationGraphEdge[]>,
): NetworkGraphPath | null {
  if (sourceNodeId === targetNodeId) {
    return {
      pathId: `${sourceNodeId}:self`,
      nodeIds: [sourceNodeId],
      edgeIds: [],
      relationshipTypes: [],
      score: 1,
      explanation: 'Source and target are the same node.',
    };
  }

  const queue: Array<{ nodeId: string; nodeIds: string[]; edges: InvestigationGraphEdge[] }> = [{
    nodeId: sourceNodeId,
    nodeIds: [sourceNodeId],
    edges: [],
  }];
  const seen = new Set<string>([sourceNodeId]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const edge of adjacency.get(current.nodeId) ?? []) {
      if (seen.has(edge.target)) {
        continue;
      }

      const nextNodeIds = [...current.nodeIds, edge.target];
      const nextEdges = [...current.edges, edge];
      if (edge.target === targetNodeId) {
        return materializePath(nextNodeIds, nextEdges);
      }

      seen.add(edge.target);
      queue.push({
        nodeId: edge.target,
        nodeIds: nextNodeIds,
        edges: nextEdges,
      });
    }
  }

  return null;
}

function rankedPaths(
  sourceNodeId: string,
  targetNodeId: string,
  adjacency: Map<string, InvestigationGraphEdge[]>,
  maxDepth = 4,
  maxPaths = 5,
): NetworkGraphPath[] {
  const paths: NetworkGraphPath[] = [];

  function walk(
    currentNodeId: string,
    nodeIds: string[],
    pathEdges: InvestigationGraphEdge[],
    visited: Set<string>,
  ): void {
    if (pathEdges.length > maxDepth || paths.length >= maxPaths * 3) {
      return;
    }

    if (currentNodeId === targetNodeId && pathEdges.length > 0) {
      paths.push(materializePath(nodeIds, pathEdges));
      return;
    }

    for (const edge of adjacency.get(currentNodeId) ?? []) {
      if (visited.has(edge.target)) {
        continue;
      }

      const nextVisited = new Set(visited);
      nextVisited.add(edge.target);
      walk(
        edge.target,
        [...nodeIds, edge.target],
        [...pathEdges, edge],
        nextVisited,
      );
    }
  }

  walk(sourceNodeId, [sourceNodeId], [], new Set([sourceNodeId]));
  return paths
    .sort((left, right) => right.score - left.score || left.nodeIds.length - right.nodeIds.length)
    .slice(0, maxPaths);
}

function candidateGraphNodeIds(entityIds: string[], nodes: GraphNode[]): string[] {
  const entitySet = new Set(entityIds);
  return nodes
    .filter((node) => {
      const metadata = node.metadata ?? {};
      const metadataNpi = typeof metadata.npi === 'string' ? metadata.npi : null;
      return entitySet.has(node.id)
        || (metadataNpi ? entitySet.has(metadataNpi) : false)
        || (node.type === 'clinician' && metadataNpi && entitySet.has(metadataNpi));
    })
    .map((node) => node.id);
}

async function resolveHighlightNodeIds(
  input: GraphInvestigationQuery,
  nodes: GraphNode[],
): Promise<string[]> {
  const requested: string[] = [];

  if (input.providerId) {
    requested.push(input.providerId);
  }

  if (input.findingId) {
    const finding = await getInvestigatorFinding(input.findingId);
    if (finding) {
      requested.push(...finding.entityIds);
    }
  }

  if (input.storylineId) {
    const storyline = await getHardenedStorylineDetail(input.storylineId);
    if (storyline) {
      requested.push(...storyline.storyline.entityIds);
    }
  }

  return candidateGraphNodeIds(unique(requested), nodes);
}

export async function buildGraphInvestigationPayload(
  input: GraphInvestigationQuery,
  prismaClient: PrismaClient = prisma,
): Promise<NetworkGraphInvestigationPayload> {
  const focusNodeId = input.focusNodeId
    ?? (input.providerId
      ? createGraphNodeId({ type: 'clinician', sourceKind: 'npi', sourceId: input.providerId })
      : null);
  const graph = await queryGraph({
    scope: focusNodeId ? 'local' : 'global',
    focusNodeId,
    depth: Math.max(1, Math.min(input.depth ?? 2, 4)),
    graphMode: 'blended',
    showOrphans: true,
    limit: 600,
  }, prismaClient);
  const now = new Date().toISOString();
  const nodesById = new Map(graph.chunk.nodes.map((node) => [node.id, node]));
  const highlightNodeIds = await resolveHighlightNodeIds(input, graph.chunk.nodes);
  const filteredEdges = graph.chunk.edges
    .map((edge): InvestigationGraphEdge => {
      const investigationRelationshipType = mapRelationshipType(edge, nodesById);
      return {
        ...edge,
        investigationRelationshipType,
        recencyWeight: edgeRecencyWeight(edge, now),
        relationshipStrength: clamp01(edge.confidence),
      };
    })
    .filter((edge) => matchesDateWindow(edge, input.dateFrom, input.dateTo))
    .filter((edge) => (
      !input.relationshipTypes || input.relationshipTypes.length === 0
        ? true
        : input.relationshipTypes.includes(edge.investigationRelationshipType)
    ));

  const edgeIdsByHighlight = filteredEdges
    .filter((edge) => highlightNodeIds.includes(edge.source) || highlightNodeIds.includes(edge.target))
    .map((edge) => edge.id);

  const adjacency = buildAdjacency(filteredEdges);
  const sourceNodeId = input.sourceNodeId ?? highlightNodeIds[0] ?? focusNodeId ?? null;
  const targetNodeId = input.targetNodeId ?? highlightNodeIds[1] ?? null;
  const shortest = sourceNodeId && targetNodeId ? shortestPath(sourceNodeId, targetNodeId, adjacency) : null;
  const ranked = sourceNodeId && targetNodeId ? rankedPaths(sourceNodeId, targetNodeId, adjacency) : [];

  const overviewClusters = [...new Map(
    graph.chunk.nodes.map((node) => [`${node.group}:${node.type}`, {
      id: `${node.group}:${node.type}`,
      label: node.group,
      nodeCount: 0,
      edgeCount: 0,
      nodeTypes: new Set<string>(),
    }]),
  ).values()];

  for (const cluster of overviewClusters) {
    cluster.nodeCount = graph.chunk.nodes.filter((node) => `${node.group}:${node.type}` === cluster.id).length;
    cluster.edgeCount = filteredEdges.filter((edge) => {
      const source = nodesById.get(edge.source);
      return source ? `${source.group}:${source.type}` === cluster.id : false;
    }).length;
    for (const node of graph.chunk.nodes.filter((candidate) => `${candidate.group}:${candidate.type}` === cluster.id)) {
      cluster.nodeTypes.add(node.type);
    }
  }

  return {
    generatedAt: graph.generatedAt,
    focusNodeId: graph.focusNodeId,
    nodes: graph.chunk.nodes.map((node) => ({
      ...node,
      highlighted: highlightNodeIds.includes(node.id),
      selected: node.id === graph.focusNodeId,
    })),
    edges: filteredEdges.map((edge) => ({
      ...edge,
      highlighted: edgeIdsByHighlight.includes(edge.id),
    })),
    highlights: {
      nodeIds: highlightNodeIds,
      edgeIds: edgeIdsByHighlight,
    },
    paths: {
      shortestPath: shortest,
      rankedPaths: ranked,
    },
    semanticZoom: {
      overviewClusters: overviewClusters.map((cluster) => ({
        id: cluster.id,
        label: cluster.label,
        nodeCount: cluster.nodeCount,
        edgeCount: cluster.edgeCount,
        nodeTypes: [...cluster.nodeTypes],
      })),
      detailNodeCount: graph.chunk.nodes.length,
      detailEdgeCount: filteredEdges.length,
    },
  };
}
