import type {
  GraphEdge,
  GraphEvidenceRef,
  GraphNode,
  InvestigationEdgeKind,
  InvestigationNodeKind,
} from '@/components/graph-system/types';

export type WorkspaceSectionId =
  | 'dashboard'
  | 'findings'
  | 'storylines'
  | 'actions'
  | 'providers'
  | 'investigations'
  | 'investigation-workspace'
  | 'calibration'
  | 'system-health'
  | 'graph'
  | 'provider-profile'
  | 'comparison-view';

export type IntelligenceSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type IntelligenceTone = 'healthy' | 'degraded' | 'critical' | 'neutral';
export type IntelligenceAccessMode = 'full' | 'public_snapshot';
export type IntelligenceAccessReason =
  | 'ok'
  | 'missing_session'
  | 'missing_org'
  | 'warming_up'
  | 'backend_unavailable';

export interface IntelligenceAccessMetadata {
  accessMode?: IntelligenceAccessMode;
  reason?: IntelligenceAccessReason;
}

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

export interface ProvidersResponse extends IntelligenceAccessMetadata {
  providers: IntelligenceProvider[];
  watchlist: IntelligenceProvider[];
  comparison: IntelligenceProvider[];
  total: number;
  query: string;
  generatedAt: string;
  pageInfo?: {
    page: number;
    pageSize: number;
    totalPages: number;
    hasNextPage: boolean;
    returned: number;
  };
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
  providerLabel: string | null;
  priorityScore: number;
  confidence: number;
  storylineKey: string | null;
  storylineId: string | null;
  storylineTitle: string | null;
  evidence: IntelligenceEvidence[];
  firstSeenAt: string;
  updatedAt: string;
}

export interface FindingsResponse extends IntelligenceAccessMetadata {
  findings: IntelligenceFinding[];
  alerts: IntelligenceAlert[];
  total: number;
  generatedAt: string;
  pageInfo?: {
    page: number;
    pageSize: number;
    totalPages: number;
    hasNextPage: boolean;
    returned: number;
  };
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

export interface StorylinesResponse extends IntelligenceAccessMetadata {
  storylines: IntelligenceStoryline[];
  total: number;
  generatedAt: string;
  pageInfo?: {
    page: number;
    pageSize: number;
    totalPages: number;
    hasNextPage: boolean;
    returned: number;
  };
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
  sourceFindingIds: string[];
  evidence: IntelligenceEvidence[];
  createdAt: string;
}

export interface ActionsResponse extends IntelligenceAccessMetadata {
  actions: IntelligenceAction[];
  total: number;
  generatedAt: string;
  pageInfo?: {
    page: number;
    pageSize: number;
    totalPages: number;
    hasNextPage: boolean;
    returned: number;
  };
}

export interface HealthStatusCardData {
  id: string;
  label: string;
  tone: IntelligenceTone;
  summary: string;
  detail: string;
}

export interface IntelligenceSystemHealth extends IntelligenceAccessMetadata {
  overall: IntelligenceTone;
  headline: string;
  generatedAt: string;
  cards: HealthStatusCardData[];
  incidents: IntelligenceAlert[];
  sources: Array<{
    source: string;
    status: 'OPERATIONAL' | 'DEGRADED' | 'OUTAGE';
    lastSeen: string | null;
    artifactCount: number;
  }>;
}

export interface IntelligenceGraphStats {
  totalNodes: number;
  totalEdges: number;
  orphanCount: number;
  aiSuggestedLinks: number;
}

export interface IntelligenceGraphResponse extends IntelligenceAccessMetadata {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: IntelligenceGraphStats;
  focusNodeId: string | null;
  generatedAt: string;
}

export interface InvestigationGraphPath {
  pathId: string;
  nodeIds: string[];
  edgeIds: string[];
  relationshipTypes: InvestigationEdgeKind[];
  score: number;
  explanation: string;
}

export interface InvestigationGraphResponse {
  schema?: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: IntelligenceGraphStats & {
    flaggedNodes: number;
    evidenceEdges: number;
    storylineEdges: number;
  };
  focusNodeId: string | null;
  generatedAt: string;
  highlights: {
    nodeIds: string[];
    edgeIds: string[];
  };
  paths: {
    shortestPath: InvestigationGraphPath | null;
    rankedPaths: InvestigationGraphPath[];
  };
  semanticZoom: {
    overviewClusters: Array<{
      id: string;
      label: string;
      nodeCount: number;
      edgeCount: number;
      nodeTypes: string[];
    }>;
    detailNodeCount: number;
    detailEdgeCount: number;
  };
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
  entities?: Array<{
    entityType?: string;
    entityId?: string;
    entityLabel?: string | null;
  }>;
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
  firstSeenAt?: string;
  createdAt?: string;
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
  sourceFindingIds?: string[];
  targetEntity?: {
    entityType?: string;
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

export interface StorylineNavigationLink {
  storylineId: string;
  storylineTitle: string | null;
}

export interface NormalizeFindingsOptions {
  storylineLinksByFindingId?: ReadonlyMap<string, StorylineNavigationLink>;
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

interface CanonicalSystemHealthPayload {
  status?: 'HEALTHY' | 'WARMING' | string;
  providers?: number;
  findings?: number;
  storylines?: number;
  systemState?: string | null;
  lastEventAt?: string | null;
  generatedAt?: string;
  agents?: Array<{
    id: string;
    name: string;
    enabled: boolean;
    lastRun: string | null;
    lastIssueCount: number;
  }>;
  totalIssues?: number;
  totalAutoRepaired?: number;
  totalSurfaced?: number;
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

export function normalizeFindingStatus(value: string | null | undefined): string {
  switch ((value ?? '').toLowerCase()) {
    case 'escalated':
    case 'investigating':
      return 'investigating';
    case 'acknowledged':
      return 'acknowledged';
    case 'resolved':
      return 'resolved';
    case 'dismissed':
      return 'dismissed';
    case 'new':
    default:
      return 'new';
  }
}

export function normalizeActionStatus(value: string | null | undefined): string {
  switch ((value ?? '').toLowerCase()) {
    case 'saved':
    case 'in_progress':
      return 'in_progress';
    case 'executed':
    case 'completed':
      return 'completed';
    case 'dismissed':
    case 'skipped':
      return 'skipped';
    case 'open':
    case 'pending':
    default:
      return 'pending';
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

function asObject(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => asString(entry))
    .filter((entry): entry is string => Boolean(entry));
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function metadataKeywords(metadata: Record<string, unknown>): string {
  return JSON.stringify(metadata).toLowerCase();
}

function isInvestigationNodeKind(value: string): value is InvestigationNodeKind {
  return [
    'provider',
    'institution',
    'company',
    'trial',
    'publication',
    'payment',
    'regulatory',
    'evidence',
  ].includes(value);
}

function isInvestigationEdgeKind(value: string): value is InvestigationEdgeKind {
  return [
    'co_author',
    'co_investigator',
    'financial',
    'institutional',
    'regulatory',
    'storyline_related',
    'evidence_link',
  ].includes(value);
}

function inferInvestigationNodeKind(
  rawType: string | null,
  metadata: Record<string, unknown>,
): InvestigationNodeKind {
  const normalizedType = rawType?.toLowerCase() ?? '';
  const keywords = metadataKeywords(metadata);

  if (rawType && isInvestigationNodeKind(rawType as InvestigationNodeKind)) {
    return rawType as InvestigationNodeKind;
  }

  if (normalizedType === 'clinician' || normalizedType === 'provider') {
    return 'provider';
  }

  if (normalizedType === 'publication') {
    return 'publication';
  }

  if (normalizedType === 'trial' || normalizedType === 'program') {
    return 'trial';
  }

  if (normalizedType === 'payment' || normalizedType === 'receipt') {
    return 'payment';
  }

  if (normalizedType === 'regulatory' || normalizedType === 'decision' || normalizedType === 'exclusion') {
    return 'regulatory';
  }

  if (['artifact', 'source', 'document', 'attachment', 'evidence'].includes(normalizedType)) {
    return 'evidence';
  }

  if (normalizedType === 'claim') {
    if (keywords.includes('payment') || keywords.includes('transfer') || keywords.includes('honoraria')) {
      return 'payment';
    }
    if (keywords.includes('regulator') || keywords.includes('disciplin') || keywords.includes('sanction')) {
      return 'regulatory';
    }
    return 'evidence';
  }

  if (normalizedType === 'organization' || normalizedType === 'company') {
    if (
      keywords.includes('company')
      || keywords.includes('manufacturer')
      || keywords.includes('sponsor')
      || keywords.includes('industry')
      || keywords.includes('vendor')
      || keywords.includes('payer')
    ) {
      return 'company';
    }

    return 'institution';
  }

  return 'institution';
}

function inferInvestigationEdgeKind(input: {
  rawType: string | null;
  metadata: Record<string, unknown>;
  evidenceRefs: GraphEvidenceRef[];
  findingIds: string[];
  storylineIds: string[];
  sourceNodeType: GraphNode['type'] | undefined;
  targetNodeType: GraphNode['type'] | undefined;
}): InvestigationEdgeKind {
  const normalizedType = input.rawType?.toLowerCase() ?? '';
  const keywords = metadataKeywords(input.metadata);

  if (input.rawType && isInvestigationEdgeKind(input.rawType as InvestigationEdgeKind)) {
    return input.rawType as InvestigationEdgeKind;
  }

  if (normalizedType === 'published_with' || normalizedType === 'co_author') {
    return 'co_author';
  }

  if (
    normalizedType === 'co_investigator'
    || normalizedType.includes('investigator')
    || keywords.includes('trial')
    || keywords.includes('principal investigator')
  ) {
    return 'co_investigator';
  }

  if (
    normalizedType === 'financial'
    || keywords.includes('payment')
    || keywords.includes('sponsor')
    || keywords.includes('honoraria')
    || keywords.includes('transfer')
  ) {
    return 'financial';
  }

  if (
    normalizedType === 'storyline_related'
    || input.storylineIds.length > 0
    || keywords.includes('storyline')
  ) {
    return 'storyline_related';
  }

  if (
    normalizedType === 'regulatory'
    || normalizedType === 'issued_by'
    || normalizedType === 'verified_by'
    || normalizedType === 'sanctioned_by'
    || keywords.includes('regulator')
    || keywords.includes('sanction')
    || keywords.includes('board action')
  ) {
    return 'regulatory';
  }

  if (
    normalizedType === 'evidence_link'
    || input.evidenceRefs.length > 0
    || input.sourceNodeType === 'evidence'
    || input.targetNodeType === 'evidence'
  ) {
    return 'evidence_link';
  }

  if (
    normalizedType === 'works_at'
    || normalizedType === 'affiliated_with'
    || normalizedType === 'trained_at'
    || normalizedType === 'institutional'
  ) {
    return 'institutional';
  }

  return 'institutional';
}

function summarizeMetadata(metadata: Record<string, unknown>): string | null {
  const priorityKeys: Array<{ key: string; labeled: boolean }> = [
    { key: 'summary', labeled: false },
    { key: 'rationale', labeled: false },
    { key: 'relationshipSummary', labeled: false },
    { key: 'context', labeled: false },
    { key: 'institutionName', labeled: true },
    { key: 'companyName', labeled: true },
    { key: 'paymentType', labeled: true },
    { key: 'regulator', labeled: true },
  ];

  for (const { key, labeled } of priorityKeys) {
    const value = asString(metadata[key]);
    if (value) {
      return labeled ? `${key}: ${value}` : value;
    }
  }

  const entries = Object.entries(metadata)
    .filter(([, value]) => value !== null && value !== undefined)
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);

  return entries.length > 0 ? entries.join(' • ') : null;
}

function normalizeEvidenceRefs(input: unknown): GraphEvidenceRef[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.reduce<GraphEvidenceRef[]>((items, entry, index) => {
    if (typeof entry === 'string') {
      items.push({
        evidenceId: entry,
        source: null,
        summary: entry,
        observedAt: null,
      });
      return items;
    }

    const record = asObject(entry);
    const evidenceId = asString(record.evidenceId) ?? asString(record.id) ?? `evidence-${index}`;
    const source = asString(record.source) ?? asString(record.sourceLabel) ?? null;
    const summary = asString(record.summary) ?? asString(record.snippet) ?? asString(record.label) ?? evidenceId;

    items.push({
      evidenceId,
      source,
      summary,
      observedAt: asString(record.observedAt),
      findingId: asString(record.findingId),
      storylineId: asString(record.storylineId),
      artifactId: asString(record.artifactId),
      url: asString(record.url),
    });
    return items;
  }, []);
}

function fallbackOverviewClusters(nodes: GraphNode[], edges: GraphEdge[]) {
  const nodeTypesByCluster = new Map<string, Set<string>>();
  const edgeCountsByCluster = new Map<string, number>();

  for (const node of nodes) {
    const clusterId = node.communityId ?? node.group ?? node.type;
    const nodeTypes = nodeTypesByCluster.get(clusterId) ?? new Set<string>();
    nodeTypes.add(node.type);
    nodeTypesByCluster.set(clusterId, nodeTypes);
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  for (const edge of edges) {
    const sourceCluster = nodeById.get(edge.source)?.communityId ?? nodeById.get(edge.source)?.group ?? null;
    if (!sourceCluster) {
      continue;
    }
    edgeCountsByCluster.set(sourceCluster, (edgeCountsByCluster.get(sourceCluster) ?? 0) + 1);
  }

  return [...nodeTypesByCluster.entries()].map(([id, nodeTypes]) => ({
    id,
    label: id,
    nodeCount: nodes.filter((node) => (node.communityId ?? node.group ?? node.type) === id).length,
    edgeCount: edgeCountsByCluster.get(id) ?? 0,
    nodeTypes: [...nodeTypes],
  }));
}

export function normalizeInvestigationGraphPayload(payload: unknown): InvestigationGraphResponse {
  const record = asObject(payload);
  const rawNodes = Array.isArray(record.nodes) ? record.nodes : [];
  const rawEdges = Array.isArray(record.edges) ? record.edges : [];
  const generatedAt = asString(record.generatedAt) ?? new Date().toISOString();

  const nodes = rawNodes.map((entry, index): GraphNode => {
    const rawNode = asObject(entry);
    const metadata = asObject(rawNode.metadata);
    const findingIds = uniqueStrings([
      ...asStringList(rawNode.findingIds),
      ...asStringList(metadata.findingIds),
    ]);
    const storylineIds = uniqueStrings([
      ...asStringList(rawNode.storylineIds),
      ...asStringList(metadata.storylineIds),
    ]);
    const rawType = asString(rawNode.projectedType) ?? asString(rawNode.type);
    const projectedType = inferInvestigationNodeKind(rawType, metadata);
    const label = asString(rawNode.label) ?? asString(metadata.label) ?? `Entity ${index + 1}`;
    const communityId = asString(rawNode.communityId) ?? asString(metadata.communityId) ?? asString(metadata.institutionName) ?? asString(rawNode.group);

    return {
      id: asString(rawNode.id) ?? `node-${index}`,
      type: projectedType,
      projectedType,
      label,
      title: asString(rawNode.title) ?? label,
      color: asString(rawNode.color) ?? '',
      group: asString(rawNode.group) ?? communityId ?? projectedType,
      degree: asNumber(rawNode.degree),
      inDegree: asNumber(rawNode.inDegree),
      outDegree: asNumber(rawNode.outDegree),
      layer: (asString(rawNode.layer) as GraphNode['layer']) ?? 'blended',
      metadata,
      tags: asStringList(rawNode.tags),
      sourceRefs: asStringList(rawNode.sourceRefs),
      trustTier: asString(rawNode.trustTier) ?? undefined,
      trustBand: asString(rawNode.trustBand) ?? undefined,
      confidence: typeof rawNode.confidence === 'number' ? rawNode.confidence : undefined,
      createdAt: asString(rawNode.createdAt) ?? generatedAt,
      updatedAt: asString(rawNode.updatedAt) ?? generatedAt,
      x: typeof rawNode.x === 'number' ? rawNode.x : undefined,
      y: typeof rawNode.y === 'number' ? rawNode.y : undefined,
      fx: typeof rawNode.fx === 'number' ? rawNode.fx : rawNode.fx === null ? null : undefined,
      fy: typeof rawNode.fy === 'number' ? rawNode.fy : rawNode.fy === null ? null : undefined,
      size: typeof rawNode.size === 'number' ? rawNode.size : undefined,
      visible: typeof rawNode.visible === 'boolean' ? rawNode.visible : true,
      highlighted: typeof rawNode.highlighted === 'boolean' ? rawNode.highlighted : false,
      selected: typeof rawNode.selected === 'boolean' ? rawNode.selected : false,
      clusterId: asString(rawNode.clusterId) ?? undefined,
      flagged: typeof rawNode.flagged === 'boolean' ? rawNode.flagged : findingIds.length > 0 || storylineIds.length > 0,
      findingIds,
      storylineIds,
      communityId,
      originNodeIds: asStringList(rawNode.originNodeIds),
    };
  });

  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const edges = rawEdges.map((entry, index): GraphEdge => {
    const rawEdge = asObject(entry);
    const metadata = asObject(rawEdge.metadata);
    const evidenceRefs = normalizeEvidenceRefs(rawEdge.evidenceRefs ?? metadata.evidenceRefs ?? metadata.evidence);
    const findingIds = uniqueStrings([
      ...asStringList(rawEdge.findingIds),
      ...asStringList(metadata.findingIds),
      ...evidenceRefs.flatMap((ref) => ref.findingId ? [ref.findingId] : []),
    ]);
    const storylineIds = uniqueStrings([
      ...asStringList(rawEdge.storylineIds),
      ...asStringList(metadata.storylineIds),
      ...evidenceRefs.flatMap((ref) => ref.storylineId ? [ref.storylineId] : []),
    ]);
    const projectedType = inferInvestigationEdgeKind({
      rawType: asString(rawEdge.projectedType) ?? asString(rawEdge.investigationRelationshipType) ?? asString(rawEdge.type),
      metadata,
      evidenceRefs,
      findingIds,
      storylineIds,
      sourceNodeType: nodesById.get(asString(rawEdge.source) ?? '')?.type,
      targetNodeType: nodesById.get(asString(rawEdge.target) ?? '')?.type,
    });
    const metadataSummary = asString(rawEdge.metadataSummary) ?? summarizeMetadata(metadata) ?? asString(rawEdge.explanation) ?? projectedType.replace(/_/g, ' ');

    return {
      id: asString(rawEdge.id) ?? `edge-${index}`,
      source: asString(rawEdge.source) ?? '',
      target: asString(rawEdge.target) ?? '',
      type: projectedType,
      projectedType,
      directed: typeof rawEdge.directed === 'boolean' ? rawEdge.directed : projectedType !== 'co_author',
      reciprocal: typeof rawEdge.reciprocal === 'boolean' ? rawEdge.reciprocal : projectedType === 'co_author',
      confidence: asNumber(rawEdge.confidence),
      createdBy: asString(rawEdge.createdBy) ?? 'investigation-graph',
      explanation: asString(rawEdge.explanation) ?? metadataSummary,
      status: asString(rawEdge.status) ?? 'ACTIVE',
      weight: asNumber(rawEdge.weight, 1),
      metadata,
      layer: (asString(rawEdge.layer) as GraphEdge['layer']) ?? 'blended',
      createdAt: asString(rawEdge.createdAt) ?? undefined,
      updatedAt: asString(rawEdge.updatedAt) ?? generatedAt,
      color: asString(rawEdge.color) ?? undefined,
      opacity: typeof rawEdge.opacity === 'number' ? rawEdge.opacity : undefined,
      visible: typeof rawEdge.visible === 'boolean' ? rawEdge.visible : true,
      highlighted: typeof rawEdge.highlighted === 'boolean' ? rawEdge.highlighted : false,
      flagged: typeof rawEdge.flagged === 'boolean' ? rawEdge.flagged : findingIds.length > 0 || storylineIds.length > 0,
      findingIds,
      storylineIds,
      evidenceCount: typeof rawEdge.evidenceCount === 'number' ? rawEdge.evidenceCount : evidenceRefs.length,
      evidenceRefs,
      firstSeenAt: asString(rawEdge.firstSeenAt) ?? asString(rawEdge.createdAt),
      lastSeenAt: asString(rawEdge.lastSeenAt) ?? asString(rawEdge.updatedAt),
      metadataSummary,
      openEvidenceTarget: asString(rawEdge.openEvidenceTarget) ?? evidenceRefs[0]?.url ?? null,
      relationshipStrength: typeof rawEdge.relationshipStrength === 'number' ? rawEdge.relationshipStrength : undefined,
      recencyWeight: typeof rawEdge.recencyWeight === 'number' ? rawEdge.recencyWeight : undefined,
      animatedFromNodeId: asString(rawEdge.animatedFromNodeId),
    };
  }).filter((edge) => edge.source.length > 0 && edge.target.length > 0);

  const rawHighlights = asObject(record.highlights);
  const rawPaths = asObject(record.paths);
  const normalizedShortestPath = asObject(rawPaths.shortestPath);
  const rawRankedPaths = Array.isArray(rawPaths.rankedPaths) ? rawPaths.rankedPaths : [];
  const rawSemanticZoom = asObject(record.semanticZoom);
  const rawOverviewClusters = Array.isArray(rawSemanticZoom.overviewClusters)
    ? rawSemanticZoom.overviewClusters
    : [];

  return {
    schema: asString(record.schema) ?? undefined,
    nodes,
    edges,
    stats: {
      ...summarizeGraph(nodes, edges),
      flaggedNodes: nodes.filter((node) => node.flagged).length,
      evidenceEdges: edges.filter((edge) => edge.type === 'evidence_link').length,
      storylineEdges: edges.filter((edge) => edge.type === 'storyline_related').length,
    },
    focusNodeId: asString(record.focusNodeId),
    generatedAt,
    highlights: {
      nodeIds: uniqueStrings(asStringList(rawHighlights.nodeIds)),
      edgeIds: uniqueStrings(asStringList(rawHighlights.edgeIds)),
    },
    paths: {
      shortestPath: Object.keys(normalizedShortestPath).length === 0 ? null : {
        pathId: asString(normalizedShortestPath.pathId) ?? 'shortest',
        nodeIds: asStringList(normalizedShortestPath.nodeIds),
        edgeIds: asStringList(normalizedShortestPath.edgeIds),
        relationshipTypes: asStringList(normalizedShortestPath.relationshipTypes)
          .filter((value): value is InvestigationEdgeKind => isInvestigationEdgeKind(value)),
        score: asNumber(normalizedShortestPath.score),
        explanation: asString(normalizedShortestPath.explanation) ?? 'Path resolved from the current graph slice.',
      },
      rankedPaths: rawRankedPaths.map((path, index): InvestigationGraphPath => {
        const recordPath = asObject(path);
        return {
          pathId: asString(recordPath.pathId) ?? `ranked-${index}`,
          nodeIds: asStringList(recordPath.nodeIds),
          edgeIds: asStringList(recordPath.edgeIds),
          relationshipTypes: asStringList(recordPath.relationshipTypes)
            .filter((value): value is InvestigationEdgeKind => isInvestigationEdgeKind(value)),
          score: asNumber(recordPath.score),
          explanation: asString(recordPath.explanation) ?? 'Candidate path resolved from the current graph slice.',
        };
      }),
    },
    semanticZoom: {
      overviewClusters: rawOverviewClusters.length > 0
        ? rawOverviewClusters.map((cluster, index) => {
          const recordCluster = asObject(cluster);
          return {
            id: asString(recordCluster.id) ?? `cluster-${index}`,
            label: asString(recordCluster.label) ?? asString(recordCluster.id) ?? `Cluster ${index + 1}`,
            nodeCount: asNumber(recordCluster.nodeCount),
            edgeCount: asNumber(recordCluster.edgeCount),
            nodeTypes: asStringList(recordCluster.nodeTypes),
          };
        })
        : fallbackOverviewClusters(nodes, edges),
      detailNodeCount: asNumber(rawSemanticZoom.detailNodeCount, nodes.length),
      detailEdgeCount: asNumber(rawSemanticZoom.detailEdgeCount, edges.length),
    },
  };
}

function findProviderLabel(
  entities: Array<{ entityType?: string; entityId?: string; entityLabel?: string | null }> | undefined,
  metadata: Record<string, unknown> | undefined,
  providerNpi: string | null,
): string | null {
  const providerEntity = (entities ?? []).find((entity) => {
    if (entity.entityType?.toLowerCase() !== 'provider') {
      return false;
    }

    if (!providerNpi || !entity.entityId) {
      return true;
    }

    return entity.entityId === providerNpi || entity.entityId.endsWith(`:${providerNpi}`);
  });

  if (typeof providerEntity?.entityLabel === 'string' && providerEntity.entityLabel.trim().length > 0) {
    return providerEntity.entityLabel.trim();
  }

  for (const candidate of [
    metadata?.providerName,
    metadata?.fullName,
    metadata?.subjectName,
    metadata?.name,
  ]) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return providerNpi ? `Provider ${providerNpi}` : null;
}

export function findProviderNpi(entityIds: string[] | undefined, metadata: Record<string, unknown> | undefined): string | null {
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

export function normalizeFindingsPayload(
  payload: InvestigatorFindingsPayload,
  options: NormalizeFindingsOptions = {},
): FindingsResponse {
  const findings = (payload.findings ?? [])
    .map((finding): IntelligenceFinding => {
      const providerNpi = findProviderNpi(finding.entityIds, finding.metadata);
      const storylineLink = options.storylineLinksByFindingId?.get(finding.findingId);

      return {
        id: finding.findingId,
        investigatorId: finding.investigatorId,
        findingType: finding.findingType,
        severity: severityFromString(finding.severity),
        status: normalizeFindingStatus(finding.status),
        title: finding.title,
        summary: finding.summary,
        explanation: finding.explanation,
        providerNpi,
        providerLabel: findProviderLabel(finding.entities, finding.metadata, providerNpi),
        priorityScore: finding.priorityScore,
        confidence: finding.confidence,
        storylineKey: finding.storylineKey,
        storylineId: storylineLink?.storylineId ?? null,
        storylineTitle: storylineLink?.storylineTitle ?? null,
        evidence: normalizeEvidenceList(finding.supportingEvidence),
        firstSeenAt: finding.firstSeenAt ?? finding.createdAt ?? finding.updatedAt,
        updatedAt: finding.updatedAt,
      };
    })
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
      status: normalizeActionStatus(action.status),
      title: action.recommendedAction,
      explanation: action.explanation,
      confidence: action.confidence,
      providerNpi: maybeNpi(action.targetEntity?.entityId),
      targetLabel: action.targetEntity?.entityLabel ?? null,
      sourceFindingIds: [...(action.sourceFindingIds ?? [])],
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
  const lastHourVerifications = systemStatus?.verificationHealth?.last1h ?? 0;
  const lastDayVerifications = systemStatus?.verificationHealth?.last24h ?? 0;
  const hasArtifactTraffic = connectivity.some((entry) => entry.artifactCount > 0);
  const headline = overall === 'critical'
    ? 'Trust telemetry is failing closed in one or more core subsystems.'
    : degradedSources > 0
      ? 'Trust telemetry is live, but some connectors are degraded or offline.'
      : connectivity.length === 0 && lastHourVerifications === 0 && !hasArtifactTraffic
        ? 'Health checks are online, but no source telemetry has been reported yet.'
        : lastHourVerifications === 0 && lastDayVerifications === 0
          ? 'Connectors are online, but no recent verification traffic has been observed yet.'
          : `${systemStatus?.uptime ?? '0h'} uptime • ${connectivity.length} connected systems`;

  return {
    overall,
    headline,
    generatedAt: systemStatus?.generatedAt ?? new Date().toISOString(),
    cards,
    incidents,
    sources: connectivity,
  };
}

export function normalizeCanonicalSystemHealthPayload(
  payload: CanonicalSystemHealthPayload,
): IntelligenceSystemHealth {
  const providers = payload.providers ?? 0;
  const findings = payload.findings ?? 0;
  const storylines = payload.storylines ?? 0;
  const agents = payload.agents ?? [];
  const enabledAgents = agents.filter((agent) => agent.enabled).length;
  const overall: IntelligenceTone = payload.status === 'HEALTHY'
    ? 'healthy'
    : payload.status === 'WARMING'
      ? 'neutral'
      : toneFromStatus(payload.status);

  const cards: HealthStatusCardData[] = [
    {
      id: 'findings',
      label: 'Findings',
      tone: (findings > 0 ? 'healthy' : 'neutral') as IntelligenceTone,
      summary: `${findings} active findings`,
      detail: `${storylines} storylines tracking ${providers} providers`,
    },
    {
      id: 'providers',
      label: 'Provider graph',
      tone: (providers > 0 ? 'healthy' : 'neutral') as IntelligenceTone,
      summary: `${providers} indexed providers`,
      detail: payload.lastEventAt
        ? `Last system event ${new Date(payload.lastEventAt).toLocaleString('en-US')}`
        : 'No system event has been recorded yet.',
    },
    {
      id: 'storylines',
      label: 'Storylines',
      tone: (storylines > 0 ? 'healthy' : 'neutral') as IntelligenceTone,
      summary: `${storylines} live storylines`,
      detail: `${payload.systemState ?? 'UNKNOWN'} state`,
    },
    {
      id: 'agents',
      label: 'Detail agents',
      tone: (enabledAgents > 0 ? 'healthy' : 'degraded') as IntelligenceTone,
      summary: `${enabledAgents}/${agents.length} agents enabled`,
      detail: `${payload.totalSurfaced ?? 0} surfaced • ${payload.totalAutoRepaired ?? 0} auto-repaired • ${payload.totalIssues ?? 0} total issues`,
    },
  ].sort((left, right) => toneRank(right.tone) - toneRank(left.tone));

  const incidents: IntelligenceAlert[] = (payload.totalSurfaced ?? 0) > 0
    ? [{
        id: 'system-health-surfaced',
        source: 'system',
        severity: (payload.totalSurfaced ?? 0) > 5 ? 'high' : 'medium',
        title: 'Detail agents surfaced issues',
        summary: `${payload.totalSurfaced} issues are awaiting remediation.`,
        providerNpi: null,
        occurredAt: payload.lastEventAt ?? payload.generatedAt ?? null,
      }]
    : [];

  return {
    overall,
    headline: payload.status === 'HEALTHY'
      ? `${findings} findings across ${storylines} storylines are live.`
      : `${providers} providers are indexed and the system is warming for fresh findings.`,
    generatedAt: payload.generatedAt ?? new Date().toISOString(),
    cards,
    incidents,
    sources: agents.map((agent) => ({
      source: agent.name,
      status: agent.enabled ? 'OPERATIONAL' : 'DEGRADED',
      lastSeen: agent.lastRun,
      artifactCount: agent.lastIssueCount,
    })),
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
    if (candidateProviderNpisFromGraphNode(node).includes(provider.npi)) {
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

  for (const candidateNpi of candidateProviderNpisFromGraphNode(node)) {
    const provider = providers.find((entry) => entry.npi === candidateNpi);
    if (provider) {
      return provider;
    }
  }

  return null;
}

function candidateProviderNpisFromGraphNode(node: GraphNode): string[] {
  const metadata = node.metadata ?? {};
  const candidates = [
    maybeNpi(node.id),
    maybeNpi(typeof metadata.npi === 'string' ? metadata.npi : null),
    maybeNpi(typeof metadata.providerNpi === 'string' ? metadata.providerNpi : null),
    maybeNpi(typeof metadata.providerId === 'string' ? metadata.providerId : null),
    maybeNpi(typeof metadata.entityId === 'string' ? metadata.entityId : null),
    maybeNpi(typeof metadata.entityKey === 'string' ? metadata.entityKey : null),
    maybeNpi(typeof metadata.subjectNpi === 'string' ? metadata.subjectNpi : null),
  ];

  return uniqueStrings(candidates.filter((candidate): candidate is string => Boolean(candidate)));
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
