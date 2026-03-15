import type { GraphEdge, GraphNode } from './types';

export interface NodeNeighborSummary {
  id: string;
  label: string;
  type: GraphNode['type'];
  degree: number;
}

export interface ClaimDetail {
  id: string;
  label: string;
  value: string;
  status: 'verified' | 'derived' | 'observed';
  summary: string;
  supportingReceiptCount: number;
  supportingArtifactCount: number;
}

export interface ReceiptDetail {
  id: string;
  title: string;
  summary: string;
  counterparty: string;
  direction: 'incoming' | 'outgoing' | 'bidirectional';
  edgeType: string;
  status: string;
  confidence: number;
  at: string | null;
  payload: Record<string, unknown>;
}

export interface ArtifactDetail {
  id: string;
  title: string;
  summary: string;
  kind: string;
  location: string;
  value: string;
}

export interface RelationshipDetail {
  id: string;
  neighborId: string;
  label: string;
  type: string;
  degree: number;
  direction: 'incoming' | 'outgoing' | 'bidirectional';
  confidence: number;
  edgeTypes: string[];
  explanation: string;
}

export interface TimelineDetail {
  id: string;
  title: string;
  detail: string;
  at: string;
  tone: 'node' | 'receipt' | 'artifact' | 'relationship';
}

export interface EvidenceStackEntry {
  id: string;
  kind: 'claim' | 'receipt' | 'artifact';
  title: string;
  summary: string;
  stamp: string | null;
  status: string;
}

export interface PendingSuggestionDetail {
  id: string;
  targetNodeId: string;
  targetLabel: string;
  confidence: number;
  explanation: string;
  edgeType: string;
}

export interface NodeDetailModel {
  claims: ClaimDetail[];
  receipts: ReceiptDetail[];
  artifacts: ArtifactDetail[];
  relationships: RelationshipDetail[];
  timeline: TimelineDetail[];
  evidenceStack: EvidenceStackEntry[];
  pendingSuggestions: PendingSuggestionDetail[];
  defaultEvidenceId: string | null;
}

const CLAIM_PRIORITY_KEYS = [
  'status',
  'issuer',
  'issuerName',
  'subject',
  'npi',
  'specialty',
  'state',
  'verifiedAt',
  'expiresAt',
  'lifecycleState',
  'registry',
  'documentHash',
] as const;

const ARTIFACT_LIKE_TYPES = new Set([
  'artifact',
  'source',
  'document',
  'attachment',
  'credential',
  'license',
  'receipt',
]);

const RECEIPT_EDGE_TYPES = new Set([
  'verifies',
  'verified_by',
  'issued_by',
  'accepted_by',
  'attested_by',
  'depends_on',
  'derived_from',
  'sourced_from',
  'same_as',
  'related_to',
  'sanctioned_by',
  'enrolled_in',
  'affiliated_with',
  'works_at',
  'trained_at',
  'privileged_at',
  'published_with',
]);

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function isMeaningful(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function isTimestampLike(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const parsed = Date.parse(value);
  return !Number.isNaN(parsed);
}

function humanize(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleCase(value: string): string {
  return humanize(value)
    .split(' ')
    .map((part) => part.length === 0 ? part : `${part[0]!.toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((item) => formatValue(item)).join(', ');
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (value === null || value === undefined) {
    return 'n/a';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

function truncateMiddle(value: string, size = 32): string {
  if (value.length <= size) return value;
  const head = Math.max(8, Math.floor(size / 2) - 2);
  const tail = Math.max(6, Math.floor(size / 2) - 3);
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

function edgeDirection(nodeId: string, edge: GraphEdge): 'incoming' | 'outgoing' | 'bidirectional' {
  if (!edge.directed || edge.reciprocal) return 'bidirectional';
  return edge.source === nodeId ? 'outgoing' : 'incoming';
}

function receiptStatus(edge: GraphEdge): string {
  if (edge.status) return edge.status.toUpperCase();
  return edge.type === 'ai_suggested_link' ? 'PENDING' : 'ACTIVE';
}

function buildReceiptPayload(edge: GraphEdge): Record<string, unknown> {
  return {
    edgeId: edge.id,
    sourceNodeId: edge.source,
    targetNodeId: edge.target,
    edgeType: edge.type,
    confidence: edge.confidence,
    createdBy: edge.createdBy,
    status: receiptStatus(edge),
    explanation: edge.explanation,
    metadata: edge.metadata,
    createdAt: edge.createdAt ?? null,
    updatedAt: edge.updatedAt ?? null,
  };
}

function buildReceipts(
  node: GraphNode,
  edges: GraphEdge[],
  neighbors: NodeNeighborSummary[],
): ReceiptDetail[] {
  const neighborsById = new Map(neighbors.map((neighbor) => [neighbor.id, neighbor]));
  const receipts = edges
    .filter((edge) => RECEIPT_EDGE_TYPES.has(edge.type))
    .map((edge) => {
      const neighborId = edge.source === node.id ? edge.target : edge.source;
      const neighbor = neighborsById.get(neighborId);
      const edgeLabel = titleCase(edge.type);
      return {
        id: edge.id,
        title: `${edgeLabel} • ${neighbor?.label ?? truncateMiddle(neighborId, 24)}`,
        summary: edge.explanation || `${edgeLabel} observed in the evidence graph.`,
        counterparty: neighbor?.label ?? truncateMiddle(neighborId, 24),
        direction: edgeDirection(node.id, edge),
        edgeType: edge.type,
        status: receiptStatus(edge),
        confidence: Number.isFinite(edge.confidence) ? edge.confidence : 0,
        at: edge.createdAt ?? edge.updatedAt ?? null,
        payload: buildReceiptPayload(edge),
      };
    });

  if (receipts.length > 0) {
    return receipts.sort((left, right) =>
      (Date.parse(right.at ?? '') || 0) - (Date.parse(left.at ?? '') || 0)
      || right.confidence - left.confidence
    );
  }

  return [{
    id: `receipt:${node.id}`,
    title: 'Node verification envelope',
    summary: 'Derived from the node record when no direct verification edge is available in the active slice.',
    counterparty: node.label,
    direction: 'bidirectional',
    edgeType: 'derived_from',
    status: 'OBSERVED',
    confidence: node.confidence ?? 0,
    at: node.updatedAt ?? node.createdAt,
    payload: {
      nodeId: node.id,
      label: node.label,
      trustTier: node.trustTier ?? null,
      trustBand: node.trustBand ?? null,
      confidence: node.confidence ?? null,
      updatedAt: node.updatedAt ?? null,
    },
  }];
}

function buildArtifacts(
  node: GraphNode,
  neighbors: NodeNeighborSummary[],
): ArtifactDetail[] {
  const artifacts: ArtifactDetail[] = [];
  const seen = new Set<string>();
  const metadata = asRecord(node.metadata);

  for (const neighbor of neighbors) {
    if (!ARTIFACT_LIKE_TYPES.has(neighbor.type)) continue;
    const artifactId = `neighbor:${neighbor.id}`;
    if (seen.has(artifactId)) continue;
    seen.add(artifactId);
    artifacts.push({
      id: artifactId,
      title: neighbor.label,
      summary: `${titleCase(neighbor.type)} node linked to this subject.`,
      kind: titleCase(neighbor.type),
      location: 'Graph neighbor',
      value: truncateMiddle(neighbor.id, 28),
    });
  }

  for (const ref of node.sourceRefs) {
    const artifactId = `ref:${ref}`;
    if (seen.has(artifactId)) continue;
    seen.add(artifactId);
    artifacts.push({
      id: artifactId,
      title: 'Source reference',
      summary: 'Primary source pointer attached to the node.',
      kind: 'Reference',
      location: 'Source refs',
      value: truncateMiddle(ref, 36),
    });
  }

  const metadataArtifactKeys = [
    'filePath',
    'sourceUrl',
    'resumeUrl',
    'website',
    'documentHash',
    'checksum',
    'artifactId',
    'documentId',
  ];

  for (const key of metadataArtifactKeys) {
    const rawValue = metadata[key];
    if (!isMeaningful(rawValue)) continue;
    const artifactId = `metadata:${key}`;
    if (seen.has(artifactId)) continue;
    seen.add(artifactId);
    artifacts.push({
      id: artifactId,
      title: titleCase(key),
      summary: 'Metadata-bound source artifact for audit replay.',
      kind: 'Metadata',
      location: titleCase(key),
      value: truncateMiddle(formatValue(rawValue), 40),
    });
  }

  return artifacts.slice(0, 8);
}

function buildClaims(
  node: GraphNode,
  receipts: ReceiptDetail[],
  artifacts: ArtifactDetail[],
): ClaimDetail[] {
  const metadata = asRecord(node.metadata);
  const claims: ClaimDetail[] = [];
  const seen = new Set<string>();
  const supportSummary = receipts.length > 0 || artifacts.length > 0
    ? `${receipts.length} receipt${receipts.length === 1 ? '' : 's'} · ${artifacts.length} artifact${artifacts.length === 1 ? '' : 's'}`
    : 'No supporting evidence in the active graph slice';

  const pushClaim = (label: string, value: unknown, status: ClaimDetail['status']) => {
    if (!isMeaningful(value)) return;
    const normalized = `${label}:${formatValue(value)}`;
    if (seen.has(normalized)) return;
    seen.add(normalized);
    claims.push({
      id: `claim:${claims.length + 1}`,
      label,
      value: formatValue(value),
      status,
      summary: supportSummary,
      supportingReceiptCount: receipts.length,
      supportingArtifactCount: artifacts.length,
    });
  };

  pushClaim('Node type', titleCase(node.type), 'observed');
  if (node.trustBand) pushClaim('Trust band', node.trustBand, 'verified');
  if (node.trustTier) pushClaim('Trust tier', node.trustTier, 'verified');
  if (typeof node.confidence === 'number') pushClaim('Confidence', `${Math.round(node.confidence * 100)}%`, 'derived');

  for (const key of CLAIM_PRIORITY_KEYS) {
    pushClaim(titleCase(key), metadata[key], receipts.length > 0 ? 'verified' : 'observed');
  }

  for (const [key, value] of Object.entries(metadata)) {
    if (claims.length >= 8) break;
    if (!isMeaningful(value)) continue;
    if (CLAIM_PRIORITY_KEYS.includes(key as (typeof CLAIM_PRIORITY_KEYS)[number])) continue;
    if (isTimestampLike(value)) continue;
    pushClaim(titleCase(key), value, receipts.length > 0 || artifacts.length > 0 ? 'derived' : 'observed');
  }

  if (claims.length > 0) {
    return claims;
  }

  return [{
    id: 'claim:fallback',
    label: 'Node label',
    value: node.label,
    status: 'observed',
    summary: supportSummary,
    supportingReceiptCount: receipts.length,
    supportingArtifactCount: artifacts.length,
  }];
}

function buildRelationships(
  node: GraphNode,
  edges: GraphEdge[],
  neighbors: NodeNeighborSummary[],
): RelationshipDetail[] {
  const neighborsById = new Map(neighbors.map((neighbor) => [neighbor.id, neighbor]));
  const grouped = new Map<string, {
    label: string;
    type: string;
    degree: number;
    directions: Set<'incoming' | 'outgoing' | 'bidirectional'>;
    confidence: number;
    edgeTypes: Set<string>;
    explanations: string[];
  }>();

  for (const edge of edges) {
    if (edge.type === 'ai_suggested_link') continue;
    const neighborId = edge.source === node.id ? edge.target : edge.source;
    const neighbor = neighborsById.get(neighborId);
    if (!neighbor) continue;
    const current = grouped.get(neighborId) ?? {
      label: neighbor.label,
      type: neighbor.type,
      degree: neighbor.degree,
      directions: new Set(),
      confidence: 0,
      edgeTypes: new Set<string>(),
      explanations: [],
    };
    current.directions.add(edgeDirection(node.id, edge));
    current.confidence = Math.max(current.confidence, edge.confidence ?? 0);
    current.edgeTypes.add(edge.type);
    if (edge.explanation) current.explanations.push(edge.explanation);
    grouped.set(neighborId, current);
  }

  return [...grouped.entries()]
    .map(([neighborId, relationship]) => {
      const direction: RelationshipDetail['direction'] =
        relationship.directions.has('bidirectional') || relationship.directions.size > 1
        ? 'bidirectional'
        : relationship.directions.has('incoming')
          ? 'incoming'
          : 'outgoing';
      return {
        id: `relationship:${neighborId}`,
        neighborId,
        label: relationship.label,
        type: relationship.type,
        degree: relationship.degree,
        direction,
        confidence: relationship.confidence,
        edgeTypes: [...relationship.edgeTypes].sort(),
        explanation: relationship.explanations[0] ?? `${titleCase(relationship.type)} relationship observed in the graph.`,
      };
    })
    .sort((left, right) => right.confidence - left.confidence || right.degree - left.degree);
}

function buildTimeline(
  node: GraphNode,
  receipts: ReceiptDetail[],
  artifacts: ArtifactDetail[],
  relationships: RelationshipDetail[],
): TimelineDetail[] {
  const timeline: TimelineDetail[] = [];
  const seen = new Set<string>();
  const metadata = asRecord(node.metadata);

  const pushTimeline = (
    id: string,
    title: string,
    detail: string,
    at: string | null | undefined,
    tone: TimelineDetail['tone'],
  ) => {
    if (!at || !isTimestampLike(at)) return;
    const dedupe = `${title}:${at}`;
    if (seen.has(dedupe)) return;
    seen.add(dedupe);
    timeline.push({ id, title, detail, at, tone });
  };

  pushTimeline(`node:${node.id}:updated`, 'Node updated', 'Latest node mutation in the graph store.', node.updatedAt, 'node');
  pushTimeline(`node:${node.id}:created`, 'Node created', 'Initial node creation in the graph store.', node.createdAt, 'node');

  for (const [index, receipt] of receipts.entries()) {
    pushTimeline(
      `receipt:${receipt.id}`,
      `Receipt ${index + 1}`,
      receipt.summary,
      receipt.at,
      'receipt',
    );
  }

  for (const [key, value] of Object.entries(metadata)) {
    if (!isTimestampLike(value)) continue;
    pushTimeline(
      `metadata:${key}`,
      titleCase(key),
      `Timestamp from node metadata (${humanize(key)}).`,
      value,
      'artifact',
    );
  }

  if (timeline.length < 6) {
    const relationship = relationships[0];
    if (relationship) {
      pushTimeline(
        `relationship:${relationship.neighborId}`,
        'Relationship observed',
        `${relationship.label} linked via ${relationship.edgeTypes.map((edgeType) => titleCase(edgeType)).join(', ')}.`,
        node.updatedAt,
        'relationship',
      );
    }
  }

  if (timeline.length < 6) {
    for (const artifact of artifacts) {
      pushTimeline(
        `artifact:${artifact.id}`,
        artifact.title,
        artifact.summary,
        node.updatedAt,
        'artifact',
      );
      if (timeline.length >= 6) break;
    }
  }

  return timeline
    .sort((left, right) => Date.parse(right.at) - Date.parse(left.at))
    .slice(0, 8);
}

function buildEvidenceStack(
  claims: ClaimDetail[],
  receipts: ReceiptDetail[],
  artifacts: ArtifactDetail[],
): EvidenceStackEntry[] {
  const claimEntries = claims.slice(0, 4).map((claim) => ({
    id: claim.id,
    kind: 'claim' as const,
    title: `${claim.label}: ${claim.value}`,
    summary: claim.summary,
    stamp: null,
    status: claim.status.toUpperCase(),
  }));

  const receiptEntries = receipts.slice(0, 4).map((receipt) => ({
    id: receipt.id,
    kind: 'receipt' as const,
    title: receipt.title,
    summary: receipt.summary,
    stamp: receipt.at,
    status: receipt.status,
  }));

  const artifactEntries = artifacts.slice(0, 4).map((artifact) => ({
    id: artifact.id,
    kind: 'artifact' as const,
    title: artifact.title,
    summary: artifact.summary,
    stamp: null,
    status: artifact.kind.toUpperCase(),
  }));

  return [...claimEntries, ...receiptEntries, ...artifactEntries];
}

function buildPendingSuggestions(
  node: GraphNode,
  edges: GraphEdge[],
  neighbors: NodeNeighborSummary[],
): PendingSuggestionDetail[] {
  const neighborsById = new Map(neighbors.map((neighbor) => [neighbor.id, neighbor]));
  return edges
    .filter((edge) => edge.type === 'ai_suggested_link')
    .map((edge) => {
      const targetNodeId = edge.source === node.id ? edge.target : edge.source;
      const neighbor = neighborsById.get(targetNodeId);
      const metadata = asRecord(edge.metadata);
      return {
        id: edge.id,
        targetNodeId,
        targetLabel: neighbor?.label ?? truncateMiddle(targetNodeId, 24),
        confidence: edge.confidence ?? 0,
        explanation: edge.explanation || formatValue(metadata.summary ?? 'Pending AI graph suggestion.'),
        edgeType: typeof metadata.semanticEdgeType === 'string' ? metadata.semanticEdgeType : edge.type,
      };
    })
    .sort((left, right) => right.confidence - left.confidence);
}

export function buildNodeDetailModel(
  node: GraphNode,
  edges: GraphEdge[],
  neighbors: NodeNeighborSummary[],
): NodeDetailModel {
  const receipts = buildReceipts(node, edges, neighbors);
  const artifacts = buildArtifacts(node, neighbors);
  const claims = buildClaims(node, receipts, artifacts);
  const relationships = buildRelationships(node, edges, neighbors);
  const timeline = buildTimeline(node, receipts, artifacts, relationships);
  const evidenceStack = buildEvidenceStack(claims, receipts, artifacts);
  const pendingSuggestions = buildPendingSuggestions(node, edges, neighbors);

  return {
    claims,
    receipts,
    artifacts,
    relationships,
    timeline,
    evidenceStack,
    pendingSuggestions,
    defaultEvidenceId: evidenceStack[0]?.id ?? null,
  };
}
