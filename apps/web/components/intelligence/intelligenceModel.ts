import type { NodeNeighborSummary } from '@/components/graph-system/nodeDetailModel';
import type { GraphEdge, GraphNode, NodeType } from '@/components/graph-system/types';
import type { GraphZoomBand } from '@/components/graph-system/viewportModel';
import { classifyEdgeType, formatGraphNodeType } from '@/components/graph/state/graphDisplayState';

export type MainWorkspaceSection = 'dashboards' | 'profiles' | 'results';

export interface ProviderProfileSummary {
  id: string;
  label: string;
  title: string;
  type: NodeType;
  summary: string;
  trustTier: string | null;
  trustBand: string | null;
  confidence: number | null;
  degree: number;
  evidenceCount: number;
  tags: string[];
  riskLevel: 'clear' | 'watch' | 'critical';
}

export interface IntelligenceAlertSummary {
  id: string;
  nodeId: string;
  severity: 'critical' | 'elevated' | 'watch';
  title: string;
  summary: string;
}

export interface IntelligenceMetric {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: 'neutral' | 'accent' | 'success' | 'danger';
}

export interface EvidenceListItem {
  id: string;
  title: string;
  summary: string;
  kind: 'source' | 'relationship' | 'metadata';
  stamp: string | null;
}

export interface VerificationRunSummary {
  target: string;
  matchedProfileId: string | null;
  status: 'ready' | 'watch' | 'blocked' | 'no_match';
  score: number | null;
  summary: string;
  checks: string[];
}

const PROVIDER_NODE_TYPES = new Set<NodeType>([
  'clinician',
  'organization',
  'institution',
  'program',
  'specialty',
]);

function safeDate(value: string | undefined): number {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function pickStringValue(
  metadata: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const candidate = metadata[key];
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return undefined;
}

function riskLevelForNode(node: GraphNode, edges: GraphEdge[]): ProviderProfileSummary['riskLevel'] {
  if (node.type === 'exclusion' || (node.trustBand ?? '').toUpperCase() === 'L0') {
    return 'critical';
  }

  if ((node.confidence ?? 1) < 0.66) {
    return 'watch';
  }

  const hasPendingAi = edges.some((edge) => (
    (edge.source === node.id || edge.target === node.id) &&
    edge.type === 'ai_suggested_link'
  ));

  return hasPendingAi ? 'watch' : 'clear';
}

export function isProviderNode(node: GraphNode): boolean {
  return PROVIDER_NODE_TYPES.has(node.type);
}

export function buildProviderProfiles(
  nodes: GraphNode[],
  edges: GraphEdge[],
): ProviderProfileSummary[] {
  return nodes
    .filter(isProviderNode)
    .map((node) => {
      const metadata = node.metadata ?? {};
      const institution = pickStringValue(metadata, ['institution', 'organization', 'facility']);
      const specialty = pickStringValue(metadata, ['specialty', 'specialtyName']);
      const location = pickStringValue(metadata, ['state', 'location', 'city']);
      const summaryParts = [
        specialty,
        institution,
        location,
      ].filter((value): value is string => Boolean(value));

      return {
        id: node.id,
        label: node.label,
        title: node.title || node.label,
        type: node.type,
        summary: summaryParts.join(' • ') || formatGraphNodeType(node.type),
        trustTier: node.trustTier ?? null,
        trustBand: node.trustBand ?? null,
        confidence: Number.isFinite(node.confidence) ? node.confidence ?? null : null,
        degree: node.degree,
        evidenceCount: node.sourceRefs.length + edges.filter((edge) => (
          edge.source === node.id || edge.target === node.id
        )).length,
        tags: node.tags.slice(0, 4),
        riskLevel: riskLevelForNode(node, edges),
      };
    })
    .sort((left, right) => (
      (right.confidence ?? 0) - (left.confidence ?? 0)
      || right.degree - left.degree
      || right.evidenceCount - left.evidenceCount
      || left.label.localeCompare(right.label)
    ));
}

export function buildWatchlist(profiles: ProviderProfileSummary[]): ProviderProfileSummary[] {
  return [...profiles]
    .sort((left, right) => (
      (right.confidence ?? 0) - (left.confidence ?? 0)
      || right.degree - left.degree
      || left.label.localeCompare(right.label)
    ))
    .slice(0, 5);
}

export function buildAlertSummaries(
  nodes: GraphNode[],
  edges: GraphEdge[],
): IntelligenceAlertSummary[] {
  const alerts: IntelligenceAlertSummary[] = [];

  for (const node of nodes) {
    if (!isProviderNode(node)) {
      continue;
    }

    const connectedEdges = edges.filter((edge) => edge.source === node.id || edge.target === node.id);
    const pendingAiLinks = connectedEdges.filter((edge) => edge.type === 'ai_suggested_link').length;

    if ((node.trustBand ?? '').toUpperCase() === 'L0') {
      alerts.push({
        id: `alert:${node.id}:blocked`,
        nodeId: node.id,
        severity: 'critical',
        title: `${node.label} is blocked`,
        summary: 'Trust band L0 requires explicit review before verification can proceed.',
      });
      continue;
    }

    if ((node.confidence ?? 1) < 0.66) {
      alerts.push({
        id: `alert:${node.id}:confidence`,
        nodeId: node.id,
        severity: 'elevated',
        title: `${node.label} needs corroboration`,
        summary: 'Confidence is below the operational threshold for automatic trust promotion.',
      });
    }

    if (pendingAiLinks > 0) {
      alerts.push({
        id: `alert:${node.id}:ai`,
        nodeId: node.id,
        severity: 'watch',
        title: `${pendingAiLinks} pending AI link${pendingAiLinks === 1 ? '' : 's'} for ${node.label}`,
        summary: 'Suggested relationships should be reviewed before they are relied on in downstream verification.',
      });
    }
  }

  return alerts
    .sort((left, right) => (
      severityRank(right.severity) - severityRank(left.severity)
      || left.title.localeCompare(right.title)
    ))
    .slice(0, 8);
}

function severityRank(value: IntelligenceAlertSummary['severity']): number {
  switch (value) {
    case 'critical':
      return 3;
    case 'elevated':
      return 2;
    case 'watch':
    default:
      return 1;
  }
}

export function buildDashboardMetrics(input: {
  profiles: ProviderProfileSummary[];
  alerts: IntelligenceAlertSummary[];
  nodes: GraphNode[];
  edges: GraphEdge[];
  zoomBand: GraphZoomBand;
}): IntelligenceMetric[] {
  const evidenceSources = input.nodes.reduce((total, node) => total + node.sourceRefs.length, 0);
  const trustEdges = input.edges.filter((edge) => classifyEdgeType(edge) === 'trust').length;
  const readyProfiles = input.profiles.filter((profile) => profile.riskLevel === 'clear').length;
  const criticalAlerts = input.alerts.filter((alert) => alert.severity === 'critical').length;

  return [
    {
      id: 'providers',
      label: 'Provider profiles',
      value: String(input.profiles.length),
      detail: `${readyProfiles} ready for automated review`,
      tone: 'success',
    },
    {
      id: 'trust-edges',
      label: 'Trust relationships',
      value: String(trustEdges),
      detail: 'Operational edges in the active graph slice',
      tone: 'accent',
    },
    {
      id: 'evidence',
      label: 'Source evidence',
      value: String(evidenceSources),
      detail: 'Document and registry references in the current slice',
      tone: 'neutral',
    },
    {
      id: 'alerts',
      label: 'Active alerts',
      value: String(input.alerts.length),
      detail: criticalAlerts > 0 ? `${criticalAlerts} critical blockers` : 'No hard blockers in view',
      tone: criticalAlerts > 0 ? 'danger' : 'neutral',
    },
    {
      id: 'zoom',
      label: 'Semantic zoom',
      value: input.zoomBand.toUpperCase(),
      detail: zoomBandCopy[input.zoomBand],
      tone: 'accent',
    },
  ];
}

const zoomBandCopy: Record<GraphZoomBand, string> = {
  overview: 'Map-wide context and cluster drift',
  network: 'Provider relationships and pathfinding',
  evidence: 'Node-level sources and supporting receipts',
};

export function buildEvidenceList(params: {
  node: GraphNode | null;
  edges: GraphEdge[];
  neighbors: NodeNeighborSummary[];
}): EvidenceListItem[] {
  const { node, edges, neighbors } = params;

  if (!node) {
    return [];
  }

  const neighborById = new Map(neighbors.map((neighbor) => [neighbor.id, neighbor]));
  const relationshipEvidence = edges
    .slice(0, 4)
    .map((edge) => {
      const counterpartyId = edge.source === node.id ? edge.target : edge.source;
      const neighbor = neighborById.get(counterpartyId);

      return {
        id: `relationship:${edge.id}`,
        title: neighbor?.label ?? counterpartyId,
        summary: edge.explanation || `${formatGraphNodeType(node.type)} relationship ${edge.type}.`,
        kind: 'relationship' as const,
        stamp: edge.updatedAt ?? edge.createdAt ?? null,
      };
    });

  const sourceEvidence = node.sourceRefs.slice(0, 4).map((sourceRef, index) => ({
    id: `source:${sourceRef}:${index}`,
    title: sourceRef,
    summary: 'Source reference attached directly to the focused node.',
    kind: 'source' as const,
    stamp: node.updatedAt ?? node.createdAt ?? null,
  }));

  const metadataEvidence = Object.entries(node.metadata ?? {})
    .filter(([, value]) => typeof value === 'string' || typeof value === 'number')
    .slice(0, 4)
    .map(([key, value]) => ({
      id: `metadata:${key}`,
      title: key,
      summary: String(value),
      kind: 'metadata' as const,
      stamp: node.updatedAt ?? node.createdAt ?? null,
    }));

  return [...relationshipEvidence, ...sourceEvidence, ...metadataEvidence]
    .sort((left, right) => safeDate(right.stamp ?? undefined) - safeDate(left.stamp ?? undefined));
}

export function buildVerificationRunSummary(params: {
  target: string;
  matchedProfile: ProviderProfileSummary | null;
  alerts: IntelligenceAlertSummary[];
}): VerificationRunSummary {
  const normalizedTarget = params.target.trim();

  if (!params.matchedProfile) {
    return {
      target: normalizedTarget,
      matchedProfileId: null,
      status: 'no_match',
      score: null,
      summary: 'No provider in the active slice matched the verification target.',
      checks: [
        'No provider profile match in the current graph slice',
        'Try a clinician name, organization, or exact node identifier',
      ],
    };
  }

  const profileAlerts = params.alerts.filter((alert) => alert.nodeId === params.matchedProfile?.id);
  const critical = profileAlerts.some((alert) => alert.severity === 'critical');
  const score = params.matchedProfile.confidence == null
    ? null
    : Math.round(params.matchedProfile.confidence * 100);
  const status = critical
    ? 'blocked'
    : profileAlerts.length > 0
      ? 'watch'
      : 'ready';

  return {
    target: normalizedTarget,
    matchedProfileId: params.matchedProfile.id,
    status,
    score,
    summary: critical
      ? `${params.matchedProfile.label} has blocking trust signals that require manual review.`
      : profileAlerts.length > 0
        ? `${params.matchedProfile.label} is matchable, but watch alerts need analyst review.`
        : `${params.matchedProfile.label} is ready for verification against the current evidence slice.`,
    checks: [
      `${params.matchedProfile.evidenceCount} supporting evidence items in view`,
      `${params.matchedProfile.degree} visible graph relationships`,
      profileAlerts.length > 0
        ? `${profileAlerts.length} alert${profileAlerts.length === 1 ? '' : 's'} attached to this profile`
        : 'No alerts attached to the matched profile',
    ],
  };
}

export function filterProfilesBySearch(
  profiles: ProviderProfileSummary[],
  searchTerm: string,
): ProviderProfileSummary[] {
  const normalizedQuery = searchTerm.trim().toLowerCase();
  if (normalizedQuery.length === 0) {
    return profiles.slice(0, 12);
  }

  return profiles.filter((profile) => {
    const searchTargets = [
      profile.id,
      profile.label,
      profile.title,
      profile.summary,
      ...profile.tags,
    ].join(' ').toLowerCase();

    return searchTargets.includes(normalizedQuery);
  });
}

export function findBestMatchingNode(query: string, nodes: GraphNode[]): GraphNode | null {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length === 0) {
    return null;
  }

  let bestMatch: { score: number; node: GraphNode } | null = null;

  for (const node of nodes) {
    const searchTargets = [
      node.id,
      node.label,
      node.title,
      node.group,
      ...node.tags,
      ...node.sourceRefs,
    ].join(' ').toLowerCase();

    if (!searchTargets.includes(normalizedQuery)) {
      continue;
    }

    const score = (
      (node.label.toLowerCase().includes(normalizedQuery) ? 4 : 0) +
      (node.title.toLowerCase().includes(normalizedQuery) ? 3 : 0) +
      (isProviderNode(node) ? 2 : 0) +
      (node.degree * 0.01)
    );

    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { score, node };
    }
  }

  return bestMatch?.node ?? null;
}
