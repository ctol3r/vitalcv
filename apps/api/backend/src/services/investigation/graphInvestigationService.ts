import type { PrismaClient } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import type { GraphEdge, GraphNode } from '../graph-engine/schema';
import { queryGraph } from '../graph-engine/queryService';
import { createGraphNodeId } from '../graph-engine/ids';
import type {
  InvestigationGraphEdge,
  InvestigationGraphNode,
  InvestigationProjectedEdgeKind,
  InvestigationProjectedEvidenceRef,
  InvestigationProjectedNodeKind,
  NetworkGraphInvestigationPayload,
  NetworkGraphPath,
} from './contracts';
import {
  getInvestigatorFinding,
  listInvestigatorFindings,
} from '../investigators/investigatorEngineService';
import { getHardenedStorylineDetail } from './storylineIntelligenceService';
import { listStorylines } from '../storylines/storylineService';

export interface GraphInvestigationQuery {
  providerId?: string | null;
  focusNodeId?: string | null;
  depth?: number;
  relationshipTypes?: InvestigationProjectedEdgeKind[];
  entityTypes?: InvestigationProjectedNodeKind[];
  dateFrom?: string | null;
  dateTo?: string | null;
  findingId?: string | null;
  storylineId?: string | null;
  sourceNodeId?: string | null;
  targetNodeId?: string | null;
  onlyFlagged?: boolean;
  onlyStorylineRelated?: boolean;
  limit?: number;
}

interface ContextFinding {
  findingId: string;
  title: string;
  summary: string;
  entityIds: string[];
  evidence: InvestigationProjectedEvidenceRef[];
  lastSeenAt: string;
}

interface ContextStoryline {
  storylineId: string;
  title: string;
  summary: string;
  entityIds: string[];
  findingIds: string[];
  evidence: InvestigationProjectedEvidenceRef[];
  lastSeenAt: string;
}

function clamp01(value: number, fallback = 0): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.min(1, Math.round(value * 10_000) / 10_000));
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function uniqueEvidenceRefs(values: InvestigationProjectedEvidenceRef[]): InvestigationProjectedEvidenceRef[] {
  const seen = new Set<string>();
  const deduped: InvestigationProjectedEvidenceRef[] = [];

  for (const value of values) {
    const key = [
      value.evidenceId,
      value.findingId ?? '',
      value.storylineId ?? '',
      value.artifactId ?? '',
      value.url ?? '',
    ].join('::');

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(value);
  }

  return deduped;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function asStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((entry) => asString(entry)).filter((entry): entry is string => Boolean(entry))
    : [];
}

function normalizeKey(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return value.trim().toLowerCase();
}

function metadataKeywords(metadata: Record<string, unknown>): string {
  return JSON.stringify(metadata).toLowerCase();
}

function daysSince(timestamp: string, now: string): number {
  return Math.max(0, (Date.parse(now) - Date.parse(timestamp)) / (1000 * 60 * 60 * 24));
}

function edgeRecencyWeight(edge: GraphEdge, now: string): number {
  return clamp01(1 - (daysSince(edge.updatedAt, now) / 365), 0.2);
}

function matchesDateWindow(timestamp: string | null | undefined, dateFrom?: string | null, dateTo?: string | null): boolean {
  const parsed = timestamp ? Date.parse(timestamp) : Number.NaN;
  if (!Number.isFinite(parsed)) {
    return true;
  }
  if (dateFrom) {
    const start = Date.parse(dateFrom);
    if (Number.isFinite(start) && parsed < start) {
      return false;
    }
  }
  if (dateTo) {
    const end = Date.parse(dateTo);
    if (Number.isFinite(end) && parsed > end) {
      return false;
    }
  }
  return true;
}

function nodeKeys(node: {
  id: string;
  label: string;
  title: string;
  group: string;
  metadata: unknown;
}): string[] {
  const metadata = asRecord(node.metadata);
  const rawKeys = [
    node.id,
    node.label,
    node.title,
    node.group,
    asString(metadata.npi),
    asString(metadata.entityId),
    asString(metadata.providerId),
    asString(metadata.providerNpi),
    asString(metadata.institutionName),
    asString(metadata.companyName),
    asString(metadata.organizationName),
    asString(metadata.name),
  ];

  return unique(rawKeys
    .map((value) => normalizeKey(value))
    .filter((value): value is string => Boolean(value)));
}

function fallbackNodeKeys(nodeId: string): string[] {
  const normalized = normalizeKey(nodeId);
  return normalized ? [normalized] : [];
}

function evidenceRefsFromFindingEvidence(input: unknown): InvestigationProjectedEvidenceRef[] {
  return Array.isArray(input)
    ? input.map((entry, index) => {
      const record = asRecord(entry);
      return {
        evidenceId: asString(record.evidenceId) ?? `evidence-${index}`,
        source: asString(record.sourceLabel) ?? asString(record.sourceId),
        summary: asString(record.snippet) ?? asString(record.evidenceType) ?? `Evidence ${index + 1}`,
        observedAt: asString(record.observedAt),
        url: asString(record.url),
        artifactId: asString(record.recordId),
      };
    })
    : [];
}

function mapNodeKind(node: GraphNode): InvestigationProjectedNodeKind {
  const metadata = asRecord(node.metadata);
  const keywords = metadataKeywords(metadata);

  switch (node.type) {
    case 'clinician':
      return 'provider';
    case 'publication':
      return 'publication';
    case 'trial':
    case 'program':
      return 'trial';
    case 'receipt':
      return 'payment';
    case 'decision':
    case 'exclusion':
    case 'license':
      return 'regulatory';
    case 'source':
      if (keywords.includes('regulator') || keywords.includes('board') || keywords.includes('oig') || keywords.includes('cms')) {
        return 'regulatory';
      }
      return 'evidence';
    case 'artifact':
    case 'credential':
      return 'evidence';
    case 'claim':
      if (keywords.includes('payment') || keywords.includes('honoraria') || keywords.includes('transfer')) {
        return 'payment';
      }
      if (keywords.includes('regulator') || keywords.includes('sanction') || keywords.includes('disciplinary')) {
        return 'regulatory';
      }
      return 'evidence';
    case 'organization':
      if (
        keywords.includes('company')
        || keywords.includes('manufacturer')
        || keywords.includes('sponsor')
        || keywords.includes('vendor')
        || keywords.includes('industry')
      ) {
        return 'company';
      }
      return 'institution';
    case 'institution':
    case 'specialty':
    case 'enrollment':
    default:
      return 'institution';
  }
}

function mapEdgeKind(edge: GraphEdge, sourceNode: InvestigationGraphNode | undefined, targetNode: InvestigationGraphNode | undefined): InvestigationProjectedEdgeKind {
  const keywords = metadataKeywords(asRecord(edge.metadata));

  if (edge.type === 'published_with' || (sourceNode?.type === 'publication' || targetNode?.type === 'publication')) {
    return 'co_author';
  }

  if (sourceNode?.type === 'trial' || targetNode?.type === 'trial' || keywords.includes('trial') || keywords.includes('principal investigator')) {
    return 'co_investigator';
  }

  if (keywords.includes('payment') || keywords.includes('sponsor') || keywords.includes('honoraria') || keywords.includes('transfer')) {
    return 'financial';
  }

  if (
    edge.type === 'issued_by'
    || edge.type === 'verified_by'
    || edge.type === 'sanctioned_by'
    || keywords.includes('regulator')
    || keywords.includes('sanction')
  ) {
    return 'regulatory';
  }

  return 'institutional';
}

function summarizeMetadata(edge: GraphEdge): string {
  const metadata = asRecord(edge.metadata);
  const preferred = [
    metadata.summary,
    metadata.relationshipSummary,
    metadata.context,
    edge.explanation,
  ];

  for (const candidate of preferred) {
    const value = asString(candidate);
    if (value) {
      return value;
    }
  }

  const entries = Object.entries(metadata)
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);

  return entries.join(' • ') || 'Relationship metadata recorded in the graph slice.';
}

function buildOpenEvidenceTarget(
  providerId: string | null | undefined,
  findingIds: string[],
  storylineIds: string[],
): string | null {
  if (findingIds.length > 0) {
    return `/investigations?findingId=${encodeURIComponent(findingIds[0]!)}`;
  }
  if (storylineIds.length > 0) {
    return `/investigations?storylineId=${encodeURIComponent(storylineIds[0]!)}`;
  }
  if (providerId) {
    return `/investigations?npi=${encodeURIComponent(providerId)}`;
  }
  return null;
}

function keysFromFindingLike(input: {
  entityIds: string[];
  title: string;
  summary: string;
}): string[] {
  return unique([
    ...input.entityIds.map((value) => normalizeKey(value)).filter((value): value is string => Boolean(value)),
    normalizeKey(input.title),
    normalizeKey(input.summary),
  ].filter((value): value is string => Boolean(value)));
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

function materializePath(nodeIds: string[], pathEdges: InvestigationGraphEdge[]): NetworkGraphPath {
  const relationshipTypes = pathEdges.map((edge) => edge.type);
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

function pathEligible(edge: InvestigationGraphEdge): boolean {
  if (edge.type === 'storyline_related') {
    return false;
  }

  return true;
}

function shortestPath(sourceNodeId: string, targetNodeId: string, adjacency: Map<string, InvestigationGraphEdge[]>): NetworkGraphPath | null {
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
      if (!pathEligible(edge) || seen.has(edge.target)) {
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

  function walk(currentNodeId: string, nodeIds: string[], pathEdges: InvestigationGraphEdge[], visited: Set<string>): void {
    if (pathEdges.length > maxDepth || paths.length >= maxPaths * 3) {
      return;
    }

    if (currentNodeId === targetNodeId && pathEdges.length > 0) {
      paths.push(materializePath(nodeIds, pathEdges));
      return;
    }

    for (const edge of adjacency.get(currentNodeId) ?? []) {
      if (!pathEligible(edge) || visited.has(edge.target)) {
        continue;
      }

      const nextVisited = new Set(visited);
      nextVisited.add(edge.target);
      walk(edge.target, [...nodeIds, edge.target], [...pathEdges, edge], nextVisited);
    }
  }

  walk(sourceNodeId, [sourceNodeId], [], new Set([sourceNodeId]));
  return paths
    .sort((left, right) => right.score - left.score || left.nodeIds.length - right.nodeIds.length)
    .slice(0, maxPaths);
}

async function loadContext(input: GraphInvestigationQuery): Promise<{
  findings: ContextFinding[];
  storylines: ContextStoryline[];
}> {
  const findings: ContextFinding[] = [];
  const storylines: ContextStoryline[] = [];

  if (input.providerId) {
    const providerFindings = await listInvestigatorFindings({
      provider: input.providerId,
      limit: 40,
    });

    findings.push(...providerFindings.findings.map((finding) => ({
      findingId: finding.findingId,
      title: finding.title,
      summary: finding.summary,
      entityIds: unique([
        ...finding.entityIds,
        ...finding.entities.map((entity) => entity.entityId),
        ...finding.entities.map((entity) => entity.entityLabel ?? '').filter((value) => value.length > 0),
      ]),
      evidence: evidenceRefsFromFindingEvidence(finding.supportingEvidence).map((evidence) => ({
        ...evidence,
        findingId: finding.findingId,
      })),
      lastSeenAt: finding.lastSeenAt,
    })));

    const providerStorylines = await listStorylines({
      provider: input.providerId,
      sync: false,
      limit: 20,
    });

    storylines.push(...providerStorylines.storylines.map((storyline) => ({
      storylineId: storyline.storylineId,
      title: storyline.title,
      summary: storyline.summary,
      entityIds: unique(storyline.entityIds),
      findingIds: unique(storyline.findingIds),
      evidence: storyline.supportingEvidence.map((evidence, index) => ({
        evidenceId: `${storyline.storylineId}:evidence:${index}`,
        source: evidence.source,
        summary: evidence.bullet,
        observedAt: evidence.observedAt,
        findingId: evidence.findingId,
        artifactId: evidence.artifactId,
        storylineId: storyline.storylineId,
      })),
      lastSeenAt: storyline.lastActivityAt,
    })));
  }

  if (input.findingId) {
    const finding = await getInvestigatorFinding(input.findingId);
    if (finding) {
      findings.push({
        findingId: finding.findingId,
        title: finding.title,
        summary: finding.summary,
        entityIds: unique([
          ...finding.entityIds,
          ...finding.entities.map((entity) => entity.entityId),
          ...finding.entities.map((entity) => entity.entityLabel ?? '').filter((value) => value.length > 0),
        ]),
        evidence: evidenceRefsFromFindingEvidence(finding.supportingEvidence).map((evidence) => ({
          ...evidence,
          findingId: finding.findingId,
        })),
        lastSeenAt: finding.lastSeenAt,
      });
    }
  }

  if (input.storylineId) {
    const storyline = await getHardenedStorylineDetail(input.storylineId);
    if (storyline) {
      storylines.push({
        storylineId: storyline.storyline.storylineId,
        title: storyline.storyline.title,
        summary: storyline.storyline.summary,
        entityIds: unique(storyline.storyline.entityIds),
        findingIds: unique(storyline.storyline.findingIds),
        evidence: storyline.evidenceRefs.map((evidence) => ({
          evidenceId: evidence.evidenceId,
          source: evidence.source,
          summary: evidence.summary,
          observedAt: evidence.observedAt,
          findingId: evidence.findingId,
          artifactId: evidence.artifactId,
          storylineId: storyline.storyline.storylineId,
        })),
        lastSeenAt: storyline.storyline.lastActivityAt,
      });
    }
  }

  return {
    findings: [...new Map(findings.map((finding) => [finding.findingId, finding])).values()],
    storylines: [...new Map(storylines.map((storyline) => [storyline.storylineId, storyline])).values()],
  };
}

export async function buildGraphInvestigationPayload(
  input: GraphInvestigationQuery,
  prismaClient: PrismaClient = prisma,
): Promise<NetworkGraphInvestigationPayload> {
  const focusNodeId = input.focusNodeId
    ?? (input.providerId
      ? createGraphNodeId({ type: 'clinician', sourceKind: 'npi', sourceId: input.providerId })
      : null);
  const requestedLimit = Math.max(1, Math.min(input.limit ?? 40, 120));
  const graph = await queryGraph({
    scope: focusNodeId ? 'local' : 'global',
    focusNodeId,
    depth: Math.max(1, Math.min(input.depth ?? 2, 4)),
    graphMode: 'blended',
    limit: Math.max(160, requestedLimit * 4),
  }, prismaClient);
  const now = new Date().toISOString();
  const context = await loadContext(input);

  const findingIdsByKey = new Map<string, Set<string>>();
  const storylineIdsByKey = new Map<string, Set<string>>();
  const evidenceByKey = new Map<string, InvestigationProjectedEvidenceRef[]>();

  for (const finding of context.findings) {
    const findingKeys = keysFromFindingLike(finding);
    for (const key of findingKeys) {
      const findingIds = findingIdsByKey.get(key) ?? new Set<string>();
      findingIds.add(finding.findingId);
      findingIdsByKey.set(key, findingIds);

      const evidenceList = evidenceByKey.get(key) ?? [];
      evidenceList.push(...finding.evidence);
      evidenceByKey.set(key, evidenceList);
    }
  }

  for (const storyline of context.storylines) {
    const storylineKeys = keysFromFindingLike({
      entityIds: storyline.entityIds,
      title: storyline.title,
      summary: storyline.summary,
    });

    for (const key of storylineKeys) {
      const storylineIds = storylineIdsByKey.get(key) ?? new Set<string>();
      storylineIds.add(storyline.storylineId);
      storylineIdsByKey.set(key, storylineIds);

      const evidenceList = evidenceByKey.get(key) ?? [];
      evidenceList.push(...storyline.evidence);
      evidenceByKey.set(key, evidenceList);
    }
  }

  const projectedNodes = graph.chunk.nodes.map((node): InvestigationGraphNode => {
    const keys = nodeKeys(node);
    const findingIds = unique(keys.flatMap((key) => [...(findingIdsByKey.get(key) ?? new Set<string>())]));
    const storylineIds = unique(keys.flatMap((key) => [...(storylineIdsByKey.get(key) ?? new Set<string>())]));
    const projectedType = mapNodeKind(node);
    return {
      ...node,
      type: projectedType,
      projectedType,
      flagged: findingIds.length > 0 || storylineIds.length > 0,
      findingIds,
      storylineIds,
      communityId: asString(asRecord(node.metadata).institutionName) ?? node.group,
    };
  });
  const projectedNodesById = new Map(projectedNodes.map((node) => [node.id, node]));

  const highlightNodeIds = unique(projectedNodes
    .filter((node) => {
      if (input.providerId) {
        const metadata = asRecord(node.metadata);
        return asString(metadata.npi) === input.providerId || node.id === focusNodeId;
      }
      if (input.findingId && node.findingIds.includes(input.findingId)) {
        return true;
      }
      if (input.storylineId && node.storylineIds.includes(input.storylineId)) {
        return true;
      }
      return false;
    })
    .map((node) => node.id));

  const projectedEdges = graph.chunk.edges.map((edge): InvestigationGraphEdge => {
    const sourceNode = projectedNodesById.get(edge.source);
    const targetNode = projectedNodesById.get(edge.target);
    const findingIds = unique([
      ...(sourceNode?.findingIds ?? []),
      ...(targetNode?.findingIds ?? []),
    ]);
    const storylineIds = unique([
      ...(sourceNode?.storylineIds ?? []),
      ...(targetNode?.storylineIds ?? []),
    ]);
    const evidenceRefs = uniqueEvidenceRefs([
      ...(sourceNode ? nodeKeys(sourceNode) : fallbackNodeKeys(edge.source)).flatMap((key) => evidenceByKey.get(key) ?? []),
      ...(targetNode ? nodeKeys(targetNode) : fallbackNodeKeys(edge.target)).flatMap((key) => evidenceByKey.get(key) ?? []),
    ]);
    const projectedType = mapEdgeKind(edge, sourceNode, targetNode);

    return {
      ...edge,
      type: projectedType,
      projectedType,
      recencyWeight: edgeRecencyWeight(edge, now),
      relationshipStrength: clamp01(edge.confidence),
      flagged: findingIds.length > 0 || storylineIds.length > 0,
      findingIds,
      storylineIds,
      evidenceCount: evidenceRefs.length,
      evidenceRefs,
      firstSeenAt: edge.createdAt,
      lastSeenAt: edge.updatedAt,
      metadataSummary: summarizeMetadata(edge),
      openEvidenceTarget: buildOpenEvidenceTarget(input.providerId, findingIds, storylineIds),
    };
  });

  const evidenceNodeIdsByEvidenceId = new Map<string, string>();
  const syntheticEvidenceNodes: InvestigationGraphNode[] = [];
  const syntheticEvidenceEdges: InvestigationGraphEdge[] = [];
  for (const node of projectedNodes) {
    if (node.type === 'evidence') {
      continue;
    }

    const nodeEvidence = uniqueEvidenceRefs(nodeKeys(node).flatMap((key) => evidenceByKey.get(key) ?? []));
    for (const evidence of nodeEvidence) {
      const evidenceNodeId = evidenceNodeIdsByEvidenceId.get(evidence.evidenceId) ?? `evidence:${evidence.evidenceId}`;
      if (!evidenceNodeIdsByEvidenceId.has(evidence.evidenceId)) {
        evidenceNodeIdsByEvidenceId.set(evidence.evidenceId, evidenceNodeId);
        syntheticEvidenceNodes.push({
          id: evidenceNodeId,
          type: 'evidence',
          projectedType: 'evidence',
          label: evidence.summary.length > 80 ? `${evidence.summary.slice(0, 77)}...` : evidence.summary,
          title: evidence.summary,
          color: '#94a3b8',
          group: 'Evidence',
          degree: 1,
          inDegree: 0,
          outDegree: 1,
          layer: 'blended',
          metadata: {
            source: evidence.source,
            url: evidence.url ?? null,
          },
          tags: evidence.source ? [evidence.source] : [],
          sourceRefs: [evidence.evidenceId],
          createdAt: evidence.observedAt ?? now,
          updatedAt: evidence.observedAt ?? now,
          flagged: true,
          findingIds: evidence.findingId ? [evidence.findingId] : [],
          storylineIds: evidence.storylineId ? [evidence.storylineId] : [],
          communityId: 'Evidence',
        });
      }

      syntheticEvidenceEdges.push({
        id: `evidence_link:${evidenceNodeId}:${node.id}`,
        source: evidenceNodeId,
        target: node.id,
        type: 'evidence_link',
        projectedType: 'evidence_link',
        directed: true,
        reciprocal: false,
        confidence: 1,
        createdBy: 'system',
        explanation: evidence.summary,
        status: 'active',
        weight: 1,
        metadata: {
          source: evidence.source,
        },
        layer: 'blended',
        createdAt: evidence.observedAt ?? now,
        updatedAt: evidence.observedAt ?? now,
        recencyWeight: 1,
        relationshipStrength: 1,
        flagged: true,
        findingIds: evidence.findingId ? [evidence.findingId] : [],
        storylineIds: evidence.storylineId ? [evidence.storylineId] : [],
        evidenceCount: 1,
        evidenceRefs: [evidence],
        firstSeenAt: evidence.observedAt ?? now,
        lastSeenAt: evidence.observedAt ?? now,
        metadataSummary: evidence.summary,
        openEvidenceTarget: evidence.url ?? buildOpenEvidenceTarget(input.providerId, evidence.findingId ? [evidence.findingId] : [], evidence.storylineId ? [evidence.storylineId] : []),
      });
    }
  }

  const visibleNodeIds = new Set(projectedNodes.map((node) => node.id));
  const syntheticStorylineEdges: InvestigationGraphEdge[] = [];
  for (const storyline of context.storylines) {
    const storylineNodeIds = projectedNodes
      .filter((node) => node.storylineIds.includes(storyline.storylineId))
      .map((node) => node.id);
    const anchorNodeId = highlightNodeIds.find((nodeId) => storylineNodeIds.includes(nodeId)) ?? storylineNodeIds[0] ?? null;
    if (!anchorNodeId) {
      continue;
    }

    for (const nodeId of storylineNodeIds) {
      if (nodeId === anchorNodeId || !visibleNodeIds.has(nodeId)) {
        continue;
      }

      syntheticStorylineEdges.push({
        id: `storyline_related:${storyline.storylineId}:${anchorNodeId}:${nodeId}`,
        source: anchorNodeId,
        target: nodeId,
        type: 'storyline_related',
        projectedType: 'storyline_related',
        directed: false,
        reciprocal: true,
        confidence: 0.92,
        createdBy: 'system',
        explanation: storyline.summary,
        status: 'active',
        weight: 1,
        metadata: {
          storylineId: storyline.storylineId,
          title: storyline.title,
        },
        layer: 'blended',
        createdAt: storyline.lastSeenAt,
        updatedAt: storyline.lastSeenAt,
        recencyWeight: 0.9,
        relationshipStrength: 0.9,
        flagged: true,
        findingIds: storyline.findingIds,
        storylineIds: [storyline.storylineId],
        evidenceCount: storyline.evidence.length,
        evidenceRefs: storyline.evidence,
        firstSeenAt: storyline.lastSeenAt,
        lastSeenAt: storyline.lastSeenAt,
        metadataSummary: storyline.title,
        openEvidenceTarget: `/investigations?storylineId=${encodeURIComponent(storyline.storylineId)}`,
      });
    }
  }

  const allNodes = [...projectedNodes, ...syntheticEvidenceNodes];
  let allEdges = [...projectedEdges, ...syntheticEvidenceEdges, ...syntheticStorylineEdges];

  allEdges = allEdges
    .filter((edge) => matchesDateWindow(edge.lastSeenAt ?? edge.updatedAt, input.dateFrom, input.dateTo))
    .filter((edge) => !input.relationshipTypes || input.relationshipTypes.length === 0 || input.relationshipTypes.includes(edge.type))
    .filter((edge) => !input.onlyFlagged || edge.flagged)
    .filter((edge) => !input.onlyStorylineRelated || edge.type === 'storyline_related' || edge.storylineIds.length > 0);

  let filteredNodes = allNodes
    .filter((node) => !input.entityTypes || input.entityTypes.length === 0 || input.entityTypes.includes(node.type))
    .filter((node) => !input.onlyFlagged || node.flagged)
    .filter((node) => !input.onlyStorylineRelated || node.storylineIds.length > 0 || node.type === 'evidence');

  const nodeIdsAfterNodeFilters = new Set(filteredNodes.map((node) => node.id));
  allEdges = allEdges.filter((edge) => nodeIdsAfterNodeFilters.has(edge.source) && nodeIdsAfterNodeFilters.has(edge.target));

  const connectedNodeIds = new Set(allEdges.flatMap((edge) => [edge.source, edge.target]));
  filteredNodes = filteredNodes
    .filter((node) => connectedNodeIds.has(node.id) || node.id === focusNodeId || highlightNodeIds.includes(node.id))
    .sort((left, right) => (
      Number(highlightNodeIds.includes(right.id)) - Number(highlightNodeIds.includes(left.id))
      || Number(right.flagged) - Number(left.flagged)
      || right.degree - left.degree
      || left.label.localeCompare(right.label)
    ));

  const limitedNodes = filteredNodes.slice(0, requestedLimit);
  const limitedNodeIds = new Set(limitedNodes.map((node) => node.id));
  const limitedEdges = allEdges.filter((edge) => limitedNodeIds.has(edge.source) && limitedNodeIds.has(edge.target));
  const edgeIdsByHighlight = limitedEdges
    .filter((edge) => highlightNodeIds.includes(edge.source) || highlightNodeIds.includes(edge.target))
    .map((edge) => edge.id);

  const adjacency = buildAdjacency(limitedEdges);
  const sourceNodeId = input.sourceNodeId ?? highlightNodeIds[0] ?? focusNodeId ?? null;
  const targetNodeId = input.targetNodeId ?? highlightNodeIds[1] ?? null;
  const shortest = sourceNodeId && targetNodeId ? shortestPath(sourceNodeId, targetNodeId, adjacency) : null;
  const ranked = sourceNodeId && targetNodeId ? rankedPaths(sourceNodeId, targetNodeId, adjacency) : [];

  const overviewClusters = [...new Map(
    limitedNodes.map((node) => [`${node.communityId ?? node.group}:${node.type}`, {
      id: `${node.communityId ?? node.group}:${node.type}`,
      label: node.communityId ?? node.group,
      nodeCount: 0,
      edgeCount: 0,
      nodeTypes: new Set<string>(),
    }]),
  ).values()];

  for (const cluster of overviewClusters) {
    cluster.nodeCount = limitedNodes.filter((node) => `${node.communityId ?? node.group}:${node.type}` === cluster.id).length;
    cluster.edgeCount = limitedEdges.filter((edge) => {
      const source = limitedNodes.find((node) => node.id === edge.source);
      return source ? `${source.communityId ?? source.group}:${source.type}` === cluster.id : false;
    }).length;
    for (const node of limitedNodes.filter((candidate) => `${candidate.communityId ?? candidate.group}:${candidate.type}` === cluster.id)) {
      cluster.nodeTypes.add(node.type);
    }
  }

  return {
    generatedAt: graph.generatedAt,
    focusNodeId: focusNodeId ?? null,
    nodes: limitedNodes.map((node) => ({
      ...node,
      highlighted: highlightNodeIds.includes(node.id),
      selected: node.id === focusNodeId,
    })),
    edges: limitedEdges.map((edge) => ({
      ...edge,
      highlighted: edgeIdsByHighlight.includes(edge.id),
    })),
    highlights: {
      nodeIds: highlightNodeIds.filter((nodeId) => limitedNodeIds.has(nodeId)),
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
      detailNodeCount: limitedNodes.length,
      detailEdgeCount: limitedEdges.length,
    },
  };
}
