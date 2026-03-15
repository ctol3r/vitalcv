import type { NormalizedClaim, VerificationReceipt } from '../identity/evidenceModel';
import type { GraphEdge, GraphNode, GraphQueryResult } from '../graph-engine/schema';

export const IDENTITY_MOBILE_SCHEMA = 'https://vitalcv.com/mobile/identity/v1';
export const GRAPH_MOBILE_SCHEMA = 'https://vitalcv.com/mobile/graph/v1';
export const WATCHTOWER_MOBILE_SCHEMA = 'https://vitalcv.com/mobile/watchtower/v1';

export const DEFAULT_MOBILE_DEPTH = 1;
export const DEFAULT_MOBILE_LIMIT = 20;
export const MAX_MOBILE_DEPTH = 2;
export const MAX_MOBILE_LIMIT = 50;
export const MAX_MOBILE_GRAPH_LIMIT = 60;

export type MobileView = 'full' | 'mobile';

export interface MobilePage {
  limit: number;
  cursor: string | null;
  nextCursor: string | null;
  returned: number;
  total: number;
  hasMore: boolean;
}

export interface PaginatedMobileItems<T> {
  items: T[];
  page: MobilePage;
}

export interface IdentityMobileClaimItem {
  claimId: string;
  claimType: string;
  status: string;
  sourceId: string;
  tier: string;
  confidenceScore: number;
  observedAt: string;
  validUntil: string | null;
  summary: string;
}

export interface IdentityMobileReceiptItem {
  receiptId: string;
  claimId: string;
  field: string;
  tier: string;
  confidence: number;
  observedAt: string;
  expiresAt: string | null;
  summary: string;
}

export interface IdentityMobileRelationshipItem {
  kind: 'PRACTICE_LOCATION' | 'INSTITUTION_AFFILIATION' | 'GROUP_AFFILIATION';
  label: string;
  state?: string | null;
  organization?: string | null;
  sourceId: string;
  observedAt: string;
}

export interface IdentityMobilePayload {
  schema: string;
  view: 'mobile';
  npi: string;
  status: 'READY' | 'NOT_INGESTED';
  generatedAt: string;
  depth: number;
  identity: {
    fullName: string | null;
    credential: string | null;
    npiStatus: string;
    enumerationType: string;
    specialties: string[];
    practiceStates: string[];
    exclusionStatus: string;
    medicareEnrolled: boolean | null;
    hasActiveLicense: boolean;
    hasBoardCert: boolean;
  } | null;
  evidenceSummary: {
    claimCount: number;
    goldClaimCount: number;
    highestTier: string;
    claimsByType: Record<string, number>;
    lastIngestedAt: string | null;
  } | null;
  previews: {
    claims: IdentityMobileClaimItem[];
    receipts: IdentityMobileReceiptItem[];
    relationships: IdentityMobileRelationshipItem[];
  };
  paging: {
    limit: number;
    claimsReturned: number;
    receiptsReturned: number;
    relationshipsReturned: number;
  };
  links: {
    self: string;
    claims: string;
    receipts: string;
    relationships: string;
    watchtower: string;
    graph: string | null;
    ingest: string;
  };
}

export interface GraphMobileNode {
  id: string;
  type: string;
  label: string;
  group: string;
  trustTier?: string;
  trustBand?: string;
  confidence?: number;
}

export interface GraphMobileRelationship {
  id: string;
  source: string;
  target: string;
  type: string;
  weight: number;
  status: string;
}

export interface GraphMobilePayload {
  schema: string;
  view: 'mobile';
  focusNodeId: string | null;
  snapshotId: string;
  depth: number;
  generatedAt: string;
  cacheStatus: 'hit' | 'miss';
  nodes: GraphMobileNode[];
  relationships: GraphMobileRelationship[];
  page: MobilePage;
  stats: {
    totalNodes: number;
    totalRelationships: number;
    hubCount: number;
    recommendationCount: number;
    payloadBytes: number;
  };
  links: {
    self: string;
    next: string | null;
    expand: string | null;
  };
}

export interface MobileAlertItem {
  eventId: string;
  type: 'LICENSE_CHANGE' | 'TRUST_SCORE_DROP' | 'ANOMALY_EVENT' | 'WATCHTOWER_ALERT';
  providerNpi: string | null;
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  summary: string;
  link: string;
  status?: string;
  recommendedAction?: string;
}

export interface WatchtowerMobilePayload {
  schema: string;
  view: 'mobile';
  generatedAt: string;
  providerNpi?: string;
  subscriptionId?: string;
  summary: {
    totalAlerts: number;
    criticalAlerts: number;
    highAlerts: number;
    pendingQueueItems?: number;
  };
  alerts: MobileAlertItem[];
  page: MobilePage;
  links: {
    self: string;
    next: string | null;
    subscribe?: string;
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

export function normalizeMobileView(value: unknown): MobileView {
  return value === 'mobile' ? 'mobile' : 'full';
}

export function parseBoundedInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const parsed = typeof value === 'string' || typeof value === 'number'
    ? Number(value)
    : Number.NaN;
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(minimum, Math.min(maximum, Math.floor(parsed)));
}

export function parseCursor(value: unknown): number {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function paginateMobileItems<T>(
  items: readonly T[],
  limit: number,
  cursor: unknown,
): PaginatedMobileItems<T> {
  const start = parseCursor(cursor);
  const paged = items.slice(start, start + limit);
  const nextIndex = start + limit;
  return {
    items: [...paged],
    page: {
      limit,
      cursor: start > 0 ? String(start) : null,
      nextCursor: nextIndex < items.length ? String(nextIndex) : null,
      returned: paged.length,
      total: items.length,
      hasMore: nextIndex < items.length,
    },
  };
}

function nonEmpty(value: string | null): value is string {
  return Boolean(value);
}

export function summarizeClaim(claim: NormalizedClaim): string {
  const value = asRecord(claim.value);
  switch (claim.claimType) {
    case 'PERSONAL_IDENTITY':
      return [
        asString(value.firstName),
        asString(value.lastName),
      ].filter(nonEmpty).join(' ') || 'Personal identity';
    case 'SPECIALTY':
      return asString(value.taxonomyDescription) ?? asString(value.taxonomyCode) ?? 'Specialty';
    case 'PRACTICE_LOCATION':
    case 'MAILING_ADDRESS':
      return [
        asString(value.city),
        asString(value.state),
      ].filter(nonEmpty).join(', ') || 'Practice location';
    case 'LICENSE':
    case 'NURSING_LICENSE':
      return [
        asString(value.state),
        asString(value.licenseStatus),
      ].filter(nonEmpty).join(' ') || 'License status';
    case 'INSTITUTION_AFFILIATION':
      return asString(value.institution) ?? 'Institution affiliation';
    case 'GROUP_AFFILIATION':
      return asString(value.groupName) ?? asString(value.organizationName) ?? 'Group affiliation';
    case 'EXCLUSION_STATUS':
      return asBoolean(value.excluded) ? 'Excluded' : 'Clear';
    case 'BOARD_CERTIFICATION':
    case 'BOARD_CERT_FLAG':
      return asString(value.specialty) ?? asString(value.certifyingBoard) ?? 'Board certification';
    case 'ENROLLMENT_STATUS':
      return asBoolean(value.enrolled) ? 'Enrolled' : 'Not enrolled';
    default:
      return asString(value.title) ?? asString(value.name) ?? claim.claimType;
  }
}

export function mapClaimToMobileItem(claim: NormalizedClaim): IdentityMobileClaimItem {
  return {
    claimId: claim.claimId,
    claimType: claim.claimType,
    status: claim.status,
    sourceId: claim.sourceId,
    tier: claim.tier,
    confidenceScore: claim.confidenceScore,
    observedAt: claim.observedAt,
    validUntil: claim.validUntil,
    summary: summarizeClaim(claim),
  };
}

export function mapReceiptToMobileItem(receipt: VerificationReceipt): IdentityMobileReceiptItem {
  const value = asRecord(receipt.value);
  return {
    receiptId: receipt.receipt_id,
    claimId: receipt.claim_id,
    field: receipt.field,
    tier: receipt.tier,
    confidence: receipt.confidence,
    observedAt: receipt.observed_at,
    expiresAt: receipt.expires_at,
    summary: asString(value.title)
      ?? asString(value.name)
      ?? asString(value.status)
      ?? receipt.field,
  };
}

export function mapRelationshipClaimToMobileItem(
  claim: NormalizedClaim,
): IdentityMobileRelationshipItem | null {
  const value = asRecord(claim.value);
  if (claim.claimType === 'PRACTICE_LOCATION') {
    return {
      kind: 'PRACTICE_LOCATION',
      label: [
        asString(value.city),
        asString(value.state),
      ].filter(nonEmpty).join(', ') || 'Practice location',
      state: asString(value.state),
      sourceId: claim.sourceId,
      observedAt: claim.observedAt,
    };
  }

  if (claim.claimType === 'INSTITUTION_AFFILIATION') {
    return {
      kind: 'INSTITUTION_AFFILIATION',
      label: asString(value.institution) ?? 'Institution affiliation',
      organization: asString(value.institution),
      state: asString(value.state),
      sourceId: claim.sourceId,
      observedAt: claim.observedAt,
    };
  }

  if (claim.claimType === 'GROUP_AFFILIATION') {
    const organization = asString(value.groupName) ?? asString(value.organizationName);
    return {
      kind: 'GROUP_AFFILIATION',
      label: organization ?? 'Group affiliation',
      organization,
      state: asString(value.state),
      sourceId: claim.sourceId,
      observedAt: claim.observedAt,
    };
  }

  return null;
}

export function mapGraphNodeToMobileNode(node: GraphNode): GraphMobileNode {
  return {
    id: node.id,
    type: node.type,
    label: node.label,
    group: node.group,
    ...(node.trustTier ? { trustTier: node.trustTier } : {}),
    ...(node.trustBand ? { trustBand: node.trustBand } : {}),
    ...(typeof node.confidence === 'number' ? { confidence: node.confidence } : {}),
  };
}

export function mapGraphEdgeToMobileRelationship(edge: GraphEdge): GraphMobileRelationship {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: edge.type,
    weight: edge.weight,
    status: edge.status,
  };
}

export function buildGraphMobilePayload(
  result: GraphQueryResult,
  links: {
    self: string;
    next: string | null;
    expand: string | null;
  },
): GraphMobilePayload {
  return {
    schema: GRAPH_MOBILE_SCHEMA,
    view: 'mobile',
    focusNodeId: result.focusNodeId,
    snapshotId: result.snapshotId,
    depth: result.depth,
    generatedAt: result.generatedAt,
    cacheStatus: result.cacheStatus,
    nodes: result.chunk.nodes.map(mapGraphNodeToMobileNode),
    relationships: result.chunk.edges.map(mapGraphEdgeToMobileRelationship),
    page: {
      limit: result.filters.limit,
      cursor: result.filters.cursor ?? null,
      nextCursor: result.chunk.nextCursor,
      returned: result.chunk.nodes.length,
      total: result.stats.totalNodes,
      hasMore: result.chunk.truncated,
    },
    stats: {
      totalNodes: result.stats.totalNodes,
      totalRelationships: result.stats.totalEdges,
      hubCount: result.intelligence?.metrics.hubCount ?? 0,
      recommendationCount: result.intelligence?.metrics.recommendationCount ?? 0,
      payloadBytes: result.stats.payloadBytes,
    },
    links,
  };
}

function normalizeMobileSeverity(value: string | null): MobileAlertItem['severity'] {
  switch (value) {
    case 'CRITICAL':
      return 'critical';
    case 'HIGH':
    case 'WARNING':
      return 'high';
    case 'MEDIUM':
      return 'medium';
    default:
      return 'low';
  }
}

export function classifyMobileAlertType(input: {
  type?: string | null;
  title?: string | null;
  description?: string | null;
  severity?: string | null;
}): MobileAlertItem['type'] {
  const title = `${input.title ?? ''} ${input.description ?? ''}`.toLowerCase();

  if (title.includes('license')) {
    return 'LICENSE_CHANGE';
  }

  if (input.type === 'source_stale') {
    return 'TRUST_SCORE_DROP';
  }

  if (input.type === 'claim_delta' || input.type === 'watchtower_delta' || input.type === 'identity_delta') {
    if (input.severity === 'CRITICAL' || input.severity === 'HIGH') {
      return 'TRUST_SCORE_DROP';
    }
    return 'ANOMALY_EVENT';
  }

  return 'WATCHTOWER_ALERT';
}

function toIsoString(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return new Date(parsed).toISOString();
    }
    return value;
  }
  return new Date().toISOString();
}

export function mapAlertToMobileItem(input: {
  eventId: string;
  alertId?: string | null;
  type?: string | null;
  subject?: string | null;
  title?: string | null;
  description?: string | null;
  severity?: string | null;
  observedAt?: unknown;
  createdAt?: unknown;
  status?: string | null;
  recommendedAction?: string | null;
}): MobileAlertItem {
  const timestamp = input.observedAt ?? input.createdAt;
  const providerNpi = input.subject ?? null;
  return {
    eventId: input.eventId,
    type: classifyMobileAlertType({
      type: input.type ?? null,
      title: input.title ?? null,
      description: input.description ?? null,
      severity: input.severity ?? null,
    }),
    providerNpi,
    title: input.title ?? 'Watchtower alert',
    severity: normalizeMobileSeverity(input.severity ?? null),
    timestamp: toIsoString(timestamp),
    summary: input.description ?? 'Watchtower alert received.',
    link: providerNpi ? `/provider/${providerNpi}` : `/api/alerts/${input.alertId ?? input.eventId}`,
    ...(input.status ? { status: input.status } : {}),
    ...(input.recommendedAction ? { recommendedAction: input.recommendedAction } : {}),
  };
}
