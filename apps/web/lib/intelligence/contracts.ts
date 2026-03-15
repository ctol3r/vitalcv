import type { GraphEdge, GraphNode } from '@/components/graph-system/types';

export type WorkspaceSectionId =
  | 'dashboard'
  | 'provider-profile'
  | 'investigation-workspace'
  | 'comparison-view';

export type IntelligenceSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type IntelligenceTone = 'healthy' | 'degraded' | 'critical' | 'neutral';

export interface IntelligenceProvider {
  id: string;
  npi: string;
  name: string;
  specialties: string[];
  credentialHealth: 'VERIFIED' | 'EXPIRED' | 'REVOKED' | 'PENDING';
  trustScore: number;
  activeCredentials: number;
  credentialCount: number;
  primaryIssuer: string | null;
  lastVerifiedAt: string | null;
  summary: string;
  tags: string[];
  risk: IntelligenceTone;
}

export interface IntelligenceAlert {
  id: string;
  source: 'finding' | 'system';
  severity: IntelligenceSeverity;
  title: string;
  summary: string;
  providerNpi: string | null;
  occurredAt: string | null;
}

export interface ProvidersResponse {
  providers: IntelligenceProvider[];
  watchlist: IntelligenceProvider[];
  comparison: IntelligenceProvider[];
  total: number;
  query: string;
  generatedAt: string;
}

export interface IntelligenceEvidence {
  id: string;
  label: string;
  snippet: string | null;
  source: string | null;
  observedAt: string | null;
}

export interface IntelligenceFinding {
  id: string;
  investigatorId: string;
  findingType: string;
  severity: IntelligenceSeverity;
  status: string;
  title: string;
  summary: string;
  explanation: string;
  providerNpi: string | null;
  priorityScore: number;
  confidence: number;
  storylineKey: string | null;
  evidence: IntelligenceEvidence[];
  updatedAt: string;
}

export interface FindingsResponse {
  findings: IntelligenceFinding[];
  alerts: IntelligenceAlert[];
  total: number;
  generatedAt: string;
}

export interface IntelligenceStoryline {
  id: string;
  storylineType: string;
  perspective: string;
  title: string;
  summary: string;
  whyItMatters: string;
  severity: IntelligenceSeverity;
  status: string;
  confidence: number;
  providerNpi: string | null;
  recommendedActions: string[];
  evidence: IntelligenceEvidence[];
  findingIds: string[];
  progressionScore: number;
  lastActivityAt: string;
}

export interface StorylinesResponse {
  storylines: IntelligenceStoryline[];
  total: number;
  generatedAt: string;
}

export interface IntelligenceAction {
  id: string;
  actionType: string;
  priority: string;
  priorityScore: number;
  status: string;
  title: string;
  explanation: string;
  confidence: number;
  providerNpi: string | null;
  targetLabel: string | null;
  evidence: IntelligenceEvidence[];
  createdAt: string;
}

export interface ActionsResponse {
  actions: IntelligenceAction[];
  total: number;
  generatedAt: string;
}

export interface HealthStatusCardData {
  id: string;
  label: string;
  tone: IntelligenceTone;
  summary: string;
  detail: string;
}

export interface IntelligenceSystemHealth {
  overall: IntelligenceTone;
  headline: string;
  generatedAt: string;
  cards: HealthStatusCardData[];
  incidents: IntelligenceAlert[];
}

export interface IntelligenceGraphStats {
  totalNodes: number;
  totalEdges: number;
  orphanCount: number;
  aiSuggestedLinks: number;
}

export interface IntelligenceGraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: IntelligenceGraphStats;
  focusNodeId: string | null;
  generatedAt: string;
}

export interface IntelligenceSource {
  id: string;
  title: string;
  detail: string;
  source: string | null;
  observedAt: string | null;
  kind: 'finding' | 'storyline' | 'action' | 'provider';
}

interface DirectoryEntryPayload {
  npi: string;
  fullName: string;
  specialties: string[];
  credentialCount: number;
  activeCredentials: number;
  primaryIssuer: string | null;
  credentialHealth: IntelligenceProvider['credentialHealth'];
  lastVerifiedAt: string | null;
  trustScore: number;
}

interface ProviderDirectoryPayload {
  entries?: DirectoryEntryPayload[];
}

interface InvestigatorFindingPayload {
  findingId: string;
  investigatorId: string;
  findingType: string;
  severity: string;
  status: string;
  title: string;
  summary: string;
  explanation: string;
  entityIds?: string[];
  metadata?: Record<string, unknown>;
  priorityScore: number;
  confidence: number;
  storylineKey: string | null;
  supportingEvidence?: Array<{
    evidenceId?: string;
    evidenceType?: string;
    snippet?: string | null;
    sourceLabel?: string | null;
    sourceId?: string | null;
    observedAt?: string | null;
  }>;
  updatedAt: string;
}

interface InvestigatorFindingsPayload {
  findings?: InvestigatorFindingPayload[];
  total?: number;
}

interface StorylinePayload {
  storylineId: string;
  storylineType: string;
  perspective: string;
  title: string;
  summary: string;
  whyItMatters: string;
  severity: string;
  status: string;
  confidence: number;
  entityIds: string[];
  recommendedActions: string[];
  supportingEvidence?: Array<{
    source: string;
    bullet: string;
    observedAt: string;
    confidence: number;
  }>;
  findingIds: string[];
  progressionScore: number;
  lastActivityAt: string;
}

interface StorylineListPayload {
  storylines?: StorylinePayload[];
  total?: number;
}

interface ActionPayload {
  actionId: string;
  actionType: string;
  priority: string;
  priorityScore: number;
  status: string;
  recommendedAction: string;
  explanation: string;
  confidence: number;
  createdAt: string;
  targetEntity?: {
    entityId?: string;
    entityLabel?: string | null;
  };
  evidence?: Array<{
    label?: string;
    snippet?: string | null;
    source?: string | null;
  }>;
}

interface ActionListPayload {
  actions?: ActionPayload[];
  total?: number;
}

interface SystemStatusPayload {
  overall?: 'OPERATIONAL' | 'DEGRADED' | 'OUTAGE';
  uptime?: string;
  verificationHealth?: {
    status?: 'OPERATIONAL' | 'DEGRADED' | 'OUTAGE';
    last24h?: number;
    last1h?: number;
  };
  sourceConnectivity?: Array<{
    source: string;
    status: 'OPERATIONAL' | 'DEGRADED' | 'OUTAGE';
    lastSeen: string | null;
    artifactCount: number;
  }>;
  incidents?: Array<{
    id: string;
    severity: 'INFO' | 'WARNING' | 'CRITICAL';
    title: string;
    description: string;
    detectedAt: string;
  }>;
  generatedAt?: string;
}

interface IntegrityPayload {
  status?: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  checks?: Array<{
    name: string;
    passed: boolean;
    details: string;
    count?: number;
  }>;
  stats?: {
    totalArtifacts: number;
    totalCapsules: number;
    totalEdges: number;
    totalMonitoringStreams: number;
  };
}

interface GraphIntegrityPayload {
  orphanedNodes?: string[];
  invalidEdges?: string[];
  missingCapsuleEdges?: string[];
}

const NPI_RE = /^\d{10}$/;

function severityRank(value: IntelligenceSeverity): number {
  switch (value) {
    case 'critical':
      return 5;
    case 'high':
      return 4;
    case 'medium':
      return 3;
    case 'low':
      return 2;
    case 'info':
    default:
      return 1;
  }
}

function toneRank(value: IntelligenceTone): number {
  switch (value) {
    case 'critical':
      return 4;
    case 'degraded':
      return 3;
    case 'healthy':
      return 2;
    case 'neutral':
    default:
      return 1;
  }
}

export function severityFromString(value: string | null | undefined): IntelligenceSeverity {
  switch ((value ?? '').toLowerCase()) {
    case 'critical':
      return 'critical';
    case 'high':
    case 'warning':
      return 'high';
    case 'medium':
    case 'degraded':
      return 'medium';
    case 'low':
      return 'low';
    case 'info':
    case 'operational':
    default:
      return 'info';
  }
}

export function toneFromStatus(value: string | null | undefined): IntelligenceTone {
  switch ((value ?? '').toUpperCase()) {
    case 'HEALTHY':
    case 'OPERATIONAL':
    case 'VERIFIED':
      return 'healthy';
    case 'DEGRADED':
    case 'PENDING':
    case 'EXPIRED':
      return 'degraded';
    case 'CRITICAL':
    case 'OUTAGE':
    case 'REVOKED':
      return 'critical';
    default:
      return 'neutral';
  }
}

function providerRiskFromScore(
  trustScore: number,
  credentialHealth: IntelligenceProvider['credentialHealth'],
): IntelligenceTone {
  if (credentialHealth === 'REVOKED' || trustScore < 45) {
    return 'critical';
  }

  if (credentialHealth === 'EXPIRED' || credentialHealth === 'PENDING' || trustScore < 75) {
    return 'degraded';
  }

  return 'healthy';
}

function maybeNpi(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return NPI_RE.test(value) ? value : null;
}

function findProviderNpi(entityIds: string[] | undefined, metadata: Record<string, unknown> | undefined): string | null {
  const metadataNpi = typeof metadata?.npi === 'string' ? metadata.npi : null;
  if (maybeNpi(metadataNpi)) {
    return metadataNpi;
  }

  for (const entityId of entityIds ?? []) {
    const exact = maybeNpi(entityId);
    if (exact) {
      return exact;
    }

    const match = entityId.match(/(\d{10})/);
    if (match) {
      return match[1] ?? null;
    }
  }

  return null;
}

function compareProviders(left: IntelligenceProvider, right: IntelligenceProvider): number {
  return (
    right.trustScore - left.trustScore ||
    right.activeCredentials - left.activeCredentials ||
    right.credentialCount - left.credentialCount ||
    left.name.localeCompare(right.name)
  );
}

export function normalizeProvidersPayload(
  payload: ProviderDirectoryPayload,
  query = '',
): ProvidersResponse {
  const trimmedQuery = query.trim().toLowerCase();
  const providers = (payload.entries ?? [])
    .map((entry): IntelligenceProvider => {
      const summary = [
        entry.specialties.slice(0, 2).join(', '),
        entry.primaryIssuer,
        entry.lastVerifiedAt ? `verified ${new Date(entry.lastVerifiedAt).toLocaleDateString('en-US')}` : null,
      ].filter((value): value is string => Boolean(value)).join(' • ');

      return {
        id: entry.npi,
        npi: entry.npi,
        name: entry.fullName,
        specialties: entry.specialties,
        credentialHealth: entry.credentialHealth,
        trustScore: entry.trustScore,
        activeCredentials: entry.activeCredentials,
        credentialCount: entry.credentialCount,
        primaryIssuer: entry.primaryIssuer,
        lastVerifiedAt: entry.lastVerifiedAt,
        summary,
        tags: [entry.credentialHealth, ...(entry.specialties ?? []).slice(0, 3)],
        risk: providerRiskFromScore(entry.trustScore, entry.credentialHealth),
      };
    })
    .filter((provider) => {
      if (trimmedQuery.length === 0) {
        return true;
      }

      const haystack = [
        provider.npi,
        provider.name,
        provider.primaryIssuer ?? '',
        provider.summary,
        provider.specialties.join(' '),
      ].join(' ').toLowerCase();

      return haystack.includes(trimmedQuery);
    })
    .sort(compareProviders);

  return {
    providers,
    watchlist: providers.slice(0, 5),
    comparison: providers.slice(0, 3),
    total: providers.length,
    query,
    generatedAt: new Date().toISOString(),
  };
}

function normalizeEvidenceList(
  items: Array<{
    evidenceId?: string;
    evidenceType?: string;
    snippet?: string | null;
    sourceLabel?: string | null;
    sourceId?: string | null;
    observedAt?: string | null;
  }> | undefined,
): IntelligenceEvidence[] {
  return (items ?? []).map((item, index) => ({
    id: item.evidenceId ?? `evidence-${index}`,
    label: item.evidenceType ?? 'evidence',
    snippet: item.snippet ?? null,
    source: item.sourceLabel ?? item.sourceId ?? null,
    observedAt: item.observedAt ?? null,
  }));
}

export function normalizeFindingsPayload(payload: InvestigatorFindingsPayload): FindingsResponse {
  const findings = (payload.findings ?? [])
    .map((finding): IntelligenceFinding => ({
      id: finding.findingId,
      investigatorId: finding.investigatorId,
      findingType: finding.findingType,
      severity: severityFromString(finding.severity),
      status: finding.status,
      title: finding.title,
      summary: finding.summary,
      explanation: finding.explanation,
      providerNpi: findProviderNpi(finding.entityIds, finding.metadata),
      priorityScore: finding.priorityScore,
      confidence: finding.confidence,
      storylineKey: finding.storylineKey,
      evidence: normalizeEvidenceList(finding.supportingEvidence),
      updatedAt: finding.updatedAt,
    }))
    .sort((left, right) => (
      severityRank(right.severity) - severityRank(left.severity) ||
      right.priorityScore - left.priorityScore ||
      Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
    ));

  return {
    findings,
    alerts: findings.slice(0, 6).map((finding) => ({
      id: `finding:${finding.id}`,
      source: 'finding',
      severity: finding.severity,
      title: finding.title,
      summary: finding.summary,
      providerNpi: finding.providerNpi,
      occurredAt: finding.updatedAt,
    })),
    total: payload.total ?? findings.length,
    generatedAt: new Date().toISOString(),
  };
}

export function normalizeStorylinesPayload(payload: StorylineListPayload): StorylinesResponse {
  const storylines = (payload.storylines ?? [])
    .map((storyline): IntelligenceStoryline => ({
      id: storyline.storylineId,
      storylineType: storyline.storylineType,
      perspective: storyline.perspective,
      title: storyline.title,
      summary: storyline.summary,
      whyItMatters: storyline.whyItMatters,
      severity: severityFromString(storyline.severity),
      status: storyline.status,
      confidence: storyline.confidence,
      providerNpi: findProviderNpi(storyline.entityIds, undefined),
      recommendedActions: storyline.recommendedActions,
      evidence: (storyline.supportingEvidence ?? []).map((evidence, index) => ({
        id: `${storyline.storylineId}:${index}`,
        label: evidence.source,
        snippet: evidence.bullet,
        source: evidence.source,
        observedAt: evidence.observedAt,
      })),
      findingIds: storyline.findingIds,
      progressionScore: storyline.progressionScore,
      lastActivityAt: storyline.lastActivityAt,
    }))
    .sort((left, right) => (
      severityRank(right.severity) - severityRank(left.severity) ||
      right.progressionScore - left.progressionScore ||
      Date.parse(right.lastActivityAt) - Date.parse(left.lastActivityAt)
    ));

  return {
    storylines,
    total: payload.total ?? storylines.length,
    generatedAt: new Date().toISOString(),
  };
}

export function normalizeActionsPayload(payload: ActionListPayload): ActionsResponse {
  const actions = (payload.actions ?? [])
    .map((action): IntelligenceAction => ({
      id: action.actionId,
      actionType: action.actionType,
      priority: action.priority,
      priorityScore: action.priorityScore,
      status: action.status,
      title: action.recommendedAction,
      explanation: action.explanation,
      confidence: action.confidence,
      providerNpi: maybeNpi(action.targetEntity?.entityId),
      targetLabel: action.targetEntity?.entityLabel ?? null,
      evidence: (action.evidence ?? []).map((evidence, index) => ({
        id: `${action.actionId}:${index}`,
        label: evidence.label ?? 'evidence',
        snippet: evidence.snippet ?? null,
        source: evidence.source ?? null,
        observedAt: null,
      })),
      createdAt: action.createdAt,
    }))
    .sort((left, right) => (
      right.priorityScore - left.priorityScore ||
      Date.parse(right.createdAt) - Date.parse(left.createdAt)
    ));

  return {
    actions,
    total: payload.total ?? actions.length,
    generatedAt: new Date().toISOString(),
  };
}

export function normalizeSystemHealthPayload(input: {
  systemStatus?: SystemStatusPayload | null;
  integrity?: IntegrityPayload | null;
  graphIntegrity?: GraphIntegrityPayload | null;
}): IntelligenceSystemHealth {
  const systemStatus = input.systemStatus ?? null;
  const integrity = input.integrity ?? null;
  const graphIntegrity = input.graphIntegrity ?? null;

  const connectivity = systemStatus?.sourceConnectivity ?? [];
  const degradedSources = connectivity.filter((entry) => entry.status !== 'OPERATIONAL').length;
  const failingChecks = (integrity?.checks ?? []).filter((check) => !check.passed).length;
  const invalidEdgeCount = (graphIntegrity?.invalidEdges ?? []).length;
  const missingCapsuleEdgeCount = (graphIntegrity?.missingCapsuleEdges ?? []).length;
  const orphanedNodeCount = (graphIntegrity?.orphanedNodes ?? []).length;

  const cards: HealthStatusCardData[] = [
    {
      id: 'pipeline',
      label: 'Trust pipeline',
      tone: toneFromStatus(integrity?.status),
      summary: integrity?.status ?? 'Unknown',
      detail: failingChecks > 0
        ? `${failingChecks} integrity checks need remediation.`
        : 'Pipeline integrity checks are clear.',
    },
    {
      id: 'graph',
      label: 'Graph integrity',
      tone: (invalidEdgeCount + missingCapsuleEdgeCount > 0 ? 'critical' : orphanedNodeCount > 0 ? 'degraded' : 'healthy') as IntelligenceTone,
      summary: `${invalidEdgeCount} invalid edges`,
      detail: `${missingCapsuleEdgeCount} missing capsule edges • ${orphanedNodeCount} orphaned nodes`,
    },
    {
      id: 'verification',
      label: 'Verification throughput',
      tone: toneFromStatus(systemStatus?.verificationHealth?.status),
      summary: `${systemStatus?.verificationHealth?.last1h ?? 0} verifications in the last hour`,
      detail: `${systemStatus?.verificationHealth?.last24h ?? 0} verifications in the last 24 hours`,
    },
    {
      id: 'connectivity',
      label: 'Source connectivity',
      tone: (degradedSources > 2 ? 'critical' : degradedSources > 0 ? 'degraded' : 'healthy') as IntelligenceTone,
      summary: `${connectivity.length - degradedSources}/${connectivity.length} sources nominal`,
      detail: degradedSources > 0
        ? `${degradedSources} sources are degraded or offline.`
        : 'All visible sources report operational status.',
    },
  ].sort((left, right) => toneRank(right.tone as IntelligenceTone) - toneRank(left.tone as IntelligenceTone));

  const incidents = (systemStatus?.incidents ?? []).map((incident) => ({
    id: incident.id,
    source: 'system' as const,
    severity: severityFromString(incident.severity),
    title: incident.title,
    summary: incident.description,
    providerNpi: null,
    occurredAt: incident.detectedAt,
  })).sort((left, right) => severityRank(right.severity) - severityRank(left.severity));

  const overallCandidates: IntelligenceTone[] = [
    toneFromStatus(systemStatus?.overall),
    toneFromStatus(integrity?.status),
    cards[0]?.tone ?? 'neutral',
  ];
  const overall = [...overallCandidates].sort((left, right) => toneRank(right) - toneRank(left))[0] ?? 'neutral';

  return {
    overall,
    headline: `${systemStatus?.uptime ?? '0h'} uptime • ${connectivity.length} connected systems`,
    generatedAt: systemStatus?.generatedAt ?? new Date().toISOString(),
    cards,
    incidents,
  };
}

export function summarizeGraph(nodes: GraphNode[], edges: GraphEdge[]): IntelligenceGraphStats {
  const connected = new Set<string>();

  for (const edge of edges) {
    connected.add(edge.source);
    connected.add(edge.target);
  }

  return {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    orphanCount: nodes.filter((node) => !connected.has(node.id)).length,
    aiSuggestedLinks: edges.filter((edge) => edge.type === 'ai_suggested_link').length,
  };
}

export function findGraphNodeIdForProvider(
  provider: IntelligenceProvider | null | undefined,
  nodes: GraphNode[],
): string | null {
  if (!provider) {
    return null;
  }

  for (const node of nodes) {
    if (node.id === provider.npi) {
      return node.id;
    }

    const metadataNpi = typeof node.metadata?.npi === 'string' ? node.metadata.npi : null;
    if (metadataNpi === provider.npi) {
      return node.id;
    }
  }

  return null;
}

export function findProviderForGraphNode(
  nodeId: string | null,
  nodes: GraphNode[],
  providers: IntelligenceProvider[],
): IntelligenceProvider | null {
  if (!nodeId) {
    return null;
  }

  const node = nodes.find((candidate) => candidate.id === nodeId);
  if (!node) {
    return null;
  }

  const metadataNpi = typeof node.metadata?.npi === 'string' ? node.metadata.npi : null;
  const matchId = maybeNpi(metadataNpi) ?? maybeNpi(node.id);
  if (!matchId) {
    return null;
  }

  return providers.find((provider) => provider.npi === matchId) ?? null;
}

export function buildSourceEntries(input: {
  provider: IntelligenceProvider | null;
  findings: IntelligenceFinding[];
  storylines: IntelligenceStoryline[];
  actions: IntelligenceAction[];
}): IntelligenceSource[] {
  const sources: IntelligenceSource[] = [];

  if (input.provider) {
    sources.push({
      id: `provider:${input.provider.npi}`,
      title: input.provider.name,
      detail: `${input.provider.credentialHealth} • trust ${input.provider.trustScore}`,
      source: input.provider.primaryIssuer,
      observedAt: input.provider.lastVerifiedAt,
      kind: 'provider',
    });
  }

  for (const finding of input.findings.slice(0, 4)) {
    for (const evidence of finding.evidence.slice(0, 2)) {
      sources.push({
        id: `finding:${finding.id}:${evidence.id}`,
        title: finding.title,
        detail: evidence.snippet ?? finding.summary,
        source: evidence.source,
        observedAt: evidence.observedAt ?? finding.updatedAt,
        kind: 'finding',
      });
    }
  }

  for (const storyline of input.storylines.slice(0, 3)) {
    for (const evidence of storyline.evidence.slice(0, 2)) {
      sources.push({
        id: `storyline:${storyline.id}:${evidence.id}`,
        title: storyline.title,
        detail: evidence.snippet ?? storyline.summary,
        source: evidence.source,
        observedAt: evidence.observedAt ?? storyline.lastActivityAt,
        kind: 'storyline',
      });
    }
  }

  for (const action of input.actions.slice(0, 3)) {
    for (const evidence of action.evidence.slice(0, 1)) {
      sources.push({
        id: `action:${action.id}:${evidence.id}`,
        title: action.title,
        detail: evidence.snippet ?? action.explanation,
        source: evidence.source,
        observedAt: action.createdAt,
        kind: 'action',
      });
    }
  }

  return sources
    .sort((left, right) => Date.parse(right.observedAt ?? '') - Date.parse(left.observedAt ?? ''))
    .slice(0, 12);
}
